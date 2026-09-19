import { ref, computed, onMounted, onUnmounted } from 'vue'
import * as Backend from '../api/backend'
import { EventsOn } from '../api/backend'
import type { StateSyncDto } from '../api/backend'
import { cleanLog } from '../utils/logUtils'
import { getModeColor } from '../utils/modeColors'

const running = ref(false)
const coreExists = ref(true)
const msg = ref("READY")
const tunMode = ref(false)
const sysProxy = ref(false)
const isProcessing = ref(false)
const errorLog = ref("")

const showErrorAlert = ref(false)
const errorAlertMessage = ref("")

const startOnBoot = ref(false)
const autoConnectState = ref("smart")
const mirrorUrl = ref("")
const mirrorEnabled = ref(false)

const ipv6Enabled = ref(true)
const preRelease = ref(false)
const logLevel = ref("")
const logToFile = ref(true)
const closeBehavior = ref("ask")

const eventUnsubscribers: Array<() => void> = []
let mountedUsers = 0

export function useAppState() {

  const getStatusText = computed(() => {
    if (!coreExists.value) return "Warning"
    if (msg.value === "Error") return "Error"

    if (isProcessing.value) {
      if (msg.value === "Starting...") return "Starting..."
      if (msg.value === "Stopping...") return "Stopping..."
      if (msg.value === "Restarting...") return "Restarting..."
    }

    if (["Detecting", "Standby", "Net Timeout"].includes(msg.value)) {
      return msg.value
    }

    if (!running.value) return "Offline"
    if (tunMode.value && sysProxy.value) return "Mixed Routing"
    if (tunMode.value) return "Tun Adapter"
    if (sysProxy.value) return "System Proxy"
    return "Online"
  })

  const getStatusStyle = computed(() => {
    if (!coreExists.value)
      return { color: 'var(--status-warning)', filter: 'none' }

    if (msg.value === "Error" || msg.value === "Net Timeout")
      return { color: 'var(--status-error)', filter: 'none' }

    if (msg.value === "Detecting" || (isProcessing.value && (msg.value === "Starting..." || msg.value === "Stopping..." || msg.value === "Restarting...")))
      return { color: 'var(--status-warning)', filter: 'none' }

    if (msg.value === "Standby")
      return { color: 'var(--status-standby)', filter: 'none' }

    if (!running.value)
      return { color: 'var(--status-offline)', filter: 'none' }

    if (tunMode.value && sysProxy.value)
      return { color: 'var(--status-mixed)', filter: 'none' }

    if (tunMode.value)
      return { color: 'var(--status-tun)', filter: 'none' }

    if (sysProxy.value)
      return { color: 'var(--status-proxy)', filter: 'none' }

    return { color: 'var(--status-default)', filter: 'none' }
  })

  const getControlBg = computed(() => {
    const color = getModeColor(
      tunMode.value,
      sysProxy.value,
      msg.value === "Error" || !coreExists.value || msg.value === "Net Timeout",
      running.value
    )

    if (!coreExists.value)
      return `bg-[#F8B500]/20`

    if (msg.value === "Error" || msg.value === "Net Timeout")
      return `bg-[${color.hex}]/20`

    if (msg.value === "Detecting")
      return `bg-[#F8B500]/20`

    if (msg.value === "Standby")
      return `bg-[#B4A2CC]/20`

    if (tunMode.value && sysProxy.value)
      return `bg-[${color.hex}]/20`

    if (tunMode.value || sysProxy.value)
      return `bg-[${color.hex}]/20`

    return "bg-transparent"
  })

  const refreshData = async () => {
    const data = await Backend.getInitData()
    running.value = data.running
    coreExists.value = data.coreExists
    if (!data.coreExists) msg.value = "Kernel Missing"
    tunMode.value = data.tunMode
    sysProxy.value = data.sysProxy

    // Enforce default mode (Proxy) if none selected
    if (!tunMode.value && !sysProxy.value) {
      sysProxy.value = true
      Backend.SaveMode(false, true)
    }

    startOnBoot.value = data.startOnBoot
    autoConnectState.value = data.autoConnectState
    mirrorUrl.value = data.mirror
    mirrorEnabled.value = data.mirrorEnabled
    ipv6Enabled.value = data.ipv6Enabled
    preRelease.value = data.preRelease
    logLevel.value = data.logLevel
    logToFile.value = data.logToFile
    closeBehavior.value = data.closeBehavior || "ask"
    return data
  }

  const handleServiceToggle = async () => {
    if (isProcessing.value) return
    if (!coreExists.value) {
      msg.value = "KERNEL MISSING!"
      return { error: 'kernel-missing' }
    }

    isProcessing.value = true
    const willStart = !running.value

    if (willStart) {
      // Use current selected mode instead of hardcoding true
      const applyTun = tunMode.value
      const applyProxy = sysProxy.value

      const res = await Backend.ApplyState(applyTun, applyProxy)
      if (res !== "Success") {
        msg.value = "Error"
        errorLog.value = res
        isProcessing.value = false
      }
    } else {
      const res = await Backend.ApplyState(false, false)
      if (res !== "Success" && res !== "Stopped") {
        msg.value = "Error"
        errorLog.value = res
        isProcessing.value = false
      }
    }
  }

  const handleToggle = async (target: 'tun' | 'proxy') => {
    if (isProcessing.value) return
    if (!coreExists.value) {
      msg.value = "KERNEL MISSING!"
      return { error: 'kernel-missing' }
    }

    isProcessing.value = true
    let newTun = tunMode.value
    let newProxy = sysProxy.value

    // Save previous state for rollback
    const prevTun = tunMode.value
    const prevProxy = sysProxy.value

    if (target === 'tun') newTun = !tunMode.value
    if (target === 'proxy') newProxy = !sysProxy.value

    // Optimistically update UI
    tunMode.value = newTun
    sysProxy.value = newProxy
    msg.value = newTun || newProxy ? "Starting..." : "Stopping..."

    const res = await Backend.ApplyState(newTun, newProxy)

    if (res === "Success" || res === "Stopped") {
      msg.value = newTun || newProxy ? "RUNNING" : "STOPPED"
      running.value = newTun || newProxy
      await new Promise(resolve => setTimeout(resolve, 1500))
    } else if (res === "config-missing") {
      msg.value = "Error"
      errorLog.value = "No active configuration selected"
      // Revert optimistic update
      tunMode.value = prevTun
      sysProxy.value = prevProxy
      isProcessing.value = false
      return { error: 'config-missing' }
    } else {
      msg.value = "Error"
      errorLog.value = res
      // Revert optimistic update
      tunMode.value = prevTun
      sysProxy.value = prevProxy
    }
    isProcessing.value = false
  }

  const handleSwitchMode = async (target: { tunMode: boolean, sysProxy: boolean }) => {
    if (isProcessing.value) return
    if (!coreExists.value) {
      msg.value = "KERNEL MISSING!"
      return { error: 'kernel-missing' }
    }

    const newTun = target.tunMode
    const newProxy = target.sysProxy

    // If not running, just update the setting state
    if (!running.value) {
      tunMode.value = newTun
      sysProxy.value = newProxy
      Backend.SaveMode(newTun, newProxy)
      return
    }

    // If running, apply the state and restart
    isProcessing.value = true

    // Save previous state for rollback
    const prevTun = tunMode.value
    const prevProxy = sysProxy.value

    // Optimistically update UI
    tunMode.value = newTun
    sysProxy.value = newProxy
    msg.value = "Restarting..."

    const res = await Backend.ApplyState(newTun, newProxy)

    if (res === "Success" || res === "Stopped") {
      msg.value = newTun || newProxy ? "RUNNING" : "STOPPED"
      running.value = newTun || newProxy
      await new Promise(resolve => setTimeout(resolve, 1500))
    } else if (res === "config-missing") {
      msg.value = "Error"
      errorLog.value = "No active configuration selected"
      // Revert optimistic update
      tunMode.value = prevTun
      sysProxy.value = prevProxy
      isProcessing.value = false
      return { error: 'config-missing' }
    } else {
      msg.value = "Error"
      errorLog.value = res
      // Revert optimistic update
      tunMode.value = prevTun
      sysProxy.value = prevProxy
    }
    isProcessing.value = false
  }

  const handleMirrorToggle = async () => {
    const newState = !mirrorEnabled.value
    mirrorEnabled.value = newState
    await Backend.SaveSettings(mirrorUrl.value, newState)
  }

  const handleStartOnBootToggle = async () => {
    const newState = !startOnBoot.value
    const res = await Backend.SetStartOnBoot(newState)
    if (res === "Success") {
      startOnBoot.value = newState
      if (newState && autoConnectState.value === "off") {
        await Backend.SetAutoConnect("smart")
        autoConnectState.value = "smart"
      }
    } else {
      errorAlertMessage.value = res
      showErrorAlert.value = true
    }
  }

  const handleAutoConnectChange = async (newState: string | number) => {
    const stateStr = String(newState)
    const res = await Backend.SetAutoConnect(stateStr)
    if (res === "Success") autoConnectState.value = stateStr
    else {
      errorAlertMessage.value = res
      showErrorAlert.value = true
    }
  }

  const handleIPv6Toggle = async () => {
    const newState = !ipv6Enabled.value
    const res = await Backend.ToggleIPv6(newState)
    if (res === "Success") ipv6Enabled.value = newState
    else {
      errorAlertMessage.value = res
      showErrorAlert.value = true
    }
  }

  const handlePreReleaseToggle = async () => {
    const newState = !preRelease.value
    const res = await Backend.SetPreRelease(newState)
    if (res === "Success") preRelease.value = newState
    else {
      errorAlertMessage.value = res
      showErrorAlert.value = true
    }
  }

  const handleLogLevelChange = async (level: string) => {
    const res = await Backend.SetLogConfig(level, logToFile.value)
    if (res === "Success") {
      logLevel.value = level
    } else {
      errorAlertMessage.value = res
      showErrorAlert.value = true
    }
  }

  const handleLogToFileToggle = async () => {
    const newState = !logToFile.value
    const res = await Backend.SetLogConfig(logLevel.value, newState)
    if (res === "Success") {
      logToFile.value = newState
    } else {
      errorAlertMessage.value = res
      showErrorAlert.value = true
    }
  }

  const setupEventListeners = () => {
    msg.value = "Offline"

    // Setup state sync events
    eventUnsubscribers.push(EventsOn("core-starting", () => {
      isProcessing.value = true
      msg.value = "Starting..."
    }))

    eventUnsubscribers.push(EventsOn("core-stopping", () => {
      isProcessing.value = true
      msg.value = "Stopping..."
    }))

    eventUnsubscribers.push(EventsOn("core-restarting", () => {
      isProcessing.value = true
      msg.value = "Restarting..."
    }))

    eventUnsubscribers.push(EventsOn("core-lock", (isLocked: boolean) => {
      isProcessing.value = isLocked
    }))

    eventUnsubscribers.push(EventsOn("status", (isRunning: boolean) => {
      // Ignore intermediate offline signals during start/restart
      if (isProcessing.value && !isRunning) {
        if (msg.value === "Starting..." || msg.value === "Restarting...") {
          return
        }
      }

      running.value = isRunning

      if (!isRunning) {
        if (msg.value !== "Standby" && msg.value !== "Net Timeout") {
          msg.value = "Stopped"
        }
      } else {
        msg.value = "Running"
      }
      isProcessing.value = false
    }))

    eventUnsubscribers.push(EventsOn("state-sync", (state: StateSyncDto) => {
      tunMode.value = state.tunMode
      sysProxy.value = state.sysProxy

      // Enforce default mode (Proxy) if none selected
      if (!tunMode.value && !sysProxy.value) {
        sysProxy.value = true
        Backend.SaveMode(false, true)
      }
    }))

    eventUnsubscribers.push(EventsOn("log", (logMsg: string) => {
      const cleaned = cleanLog(logMsg)

      if (cleaned.startsWith("Error:") || cleaned.includes("failed")) {
        msg.value = "Error"
        errorLog.value = cleaned
      } else {
        msg.value = cleaned
      }
    }))
  }

  onMounted(() => {
    mountedUsers += 1
    if (mountedUsers === 1) {
      setupEventListeners()
      void Backend.waitForEventsReady().then(() => refreshData())
    }
  })

  onUnmounted(() => {
    mountedUsers = Math.max(0, mountedUsers - 1)
    if (mountedUsers === 0) {
      for (const unsubscribe of eventUnsubscribers.splice(0)) unsubscribe()
    }
  })


  return {
    running, coreExists, msg, tunMode, sysProxy, isProcessing,
    errorLog, startOnBoot, autoConnectState,
    mirrorUrl, mirrorEnabled, ipv6Enabled, preRelease, logLevel, logToFile, closeBehavior,
    showErrorAlert, errorAlertMessage,
    getStatusText, getStatusStyle, getControlBg,
    handleToggle, handleSwitchMode, handleServiceToggle, refreshData, handleMirrorToggle,
    handleStartOnBootToggle, handleAutoConnectChange,
    handleIPv6Toggle, handlePreReleaseToggle, handleLogLevelChange, handleLogToFileToggle
  }
}
