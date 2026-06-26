import { ref, computed, onMounted, onUnmounted } from 'vue'
import * as Backend from '../../wailsjs/go/internal/App'
import { EventsOn } from '../../wailsjs/runtime/runtime'
import { cleanLog } from '../utils/logUtils'
import { getModeColor } from '../utils/modeColors'

export function useAppState() {
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
  const logLevel = ref("warning")
  const logToFile = ref(true)

  let unsubscribeStatus: (() => void) | null = null
  let unsubscribeStateSync: (() => void) | null = null
  let unsubscribeLog: (() => void) | null = null

  const getStatusText = computed(() => {
    if (!coreExists.value) return "WARNING"
    if (msg.value === "ERROR") return "ERROR"

    if (isProcessing.value) {
      if (msg.value === "STARTING...") return "STARTING..."
      if (msg.value === "STOPPING...") return "STOPPING..."
    }

    if (["DETECTING", "STANDBY", "NET TIMEOUT"].includes(msg.value)) {
      return msg.value
    }

    if (!running.value) return "OFFLINE"
    if (tunMode.value && sysProxy.value) return "FULL MODE"
    if (tunMode.value) return "TUNNEL"
    if (sysProxy.value) return "SYS PROXY"
    return "ONLINE"
  })

  const getStatusStyle = computed(() => {
    if (!coreExists.value)
      return { color: '#FCD575 !important', filter: 'drop-shadow(0 0 25px rgba(248, 181, 0, 0.8))' }

    if (msg.value === "ERROR" || msg.value === "NET TIMEOUT")
      return { color: '#F4A7B0 !important', filter: 'drop-shadow(0 0 25px rgba(233, 84, 100, 0.8))' }

    if (msg.value === "DETECTING" || (isProcessing.value && (msg.value === "STARTING..." || msg.value === "STOPPING...")))
      return { color: '#FCD575 !important', filter: 'drop-shadow(0 0 25px rgba(248, 181, 0, 0.6))' }

    if (msg.value === "STANDBY")
      return { color: '#B4A2CC !important', filter: 'drop-shadow(0 0 25px rgba(180, 162, 204, 0.8))' }

    if (!running.value)
      return { color: '#9E9E9E !important', filter: 'none' }

    if (tunMode.value && sysProxy.value)
      return { color: '#C5A3BF !important', filter: 'drop-shadow(0 0 25px rgba(139, 127, 168, 0.8))' }

    if (tunMode.value)
      return { color: '#89C3EB !important', filter: 'drop-shadow(0 0 25px rgba(83, 131, 195, 0.8))' }

    if (sysProxy.value)
      return { color: '#7EBEAB !important', filter: 'drop-shadow(0 0 25px rgba(56, 180, 139, 0.8))' }

    return { color: '#F0F0F0 !important', filter: 'drop-shadow(0 0 25px rgba(224, 224, 224, 0.5))' }
  })

  const getControlBg = computed(() => {
    const color = getModeColor(
      tunMode.value,
      sysProxy.value,
      msg.value === "ERROR" || !coreExists.value || msg.value === "NET TIMEOUT",
      running.value
    )

    if (!coreExists.value)
      return `bg-[#F8B500]/20`

    if (msg.value === "ERROR" || msg.value === "NET TIMEOUT")
      return `bg-[${color.hex}]/20`

    if (msg.value === "DETECTING")
      return `bg-[#F8B500]/20`

    if (msg.value === "STANDBY")
      return `bg-[#B4A2CC]/20`

    if (tunMode.value && sysProxy.value)
      return `bg-[${color.hex}]/20`

    if (tunMode.value || sysProxy.value)
      return `bg-[${color.hex}]/20`

    return "bg-transparent"
  })

  const refreshData = async () => {
    const data = await Backend.GetInitData()
    running.value = data.running
    coreExists.value = data.coreExists
    if (!data.coreExists) msg.value = "Kernel Missing"
    tunMode.value = data.tunMode
    sysProxy.value = data.sysProxy
    startOnBoot.value = data.startOnBoot
    autoConnectState.value = data.autoConnectState
    mirrorUrl.value = data.mirror
    mirrorEnabled.value = data.mirrorEnabled
    ipv6Enabled.value = data.ipv6_enabled !== undefined ? data.ipv6_enabled : true
    preRelease.value = data.pre_release
    logLevel.value = data.log_level || "warning"
    logToFile.value = data.log_to_file !== undefined ? data.log_to_file : true
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
      
      msg.value = "STARTING..."
      const res = await Backend.ApplyState(applyTun, applyProxy)

      if (res === "Success") {
        msg.value = "RUNNING"
        running.value = true
        await new Promise(resolve => setTimeout(resolve, 1500))
      } else {
        msg.value = "ERROR"
        errorLog.value = res
        // Keep the selected mode, don't reset it
      }
      isProcessing.value = false
    } else {
      msg.value = "STOPPING..."
      const res = await Backend.ApplyState(false, false)

      if (res === "Success" || res === "Stopped") {
        msg.value = "STOPPED"
        running.value = false
        await new Promise(resolve => setTimeout(resolve, 1500))
      } else {
        msg.value = "ERROR"
        errorLog.value = res
      }
      isProcessing.value = false
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
    msg.value = newTun || newProxy ? "STARTING..." : "STOPPING..."

    const res = await Backend.ApplyState(newTun, newProxy)

    if (res === "Success" || res === "Stopped") {
      msg.value = newTun || newProxy ? "RUNNING" : "STOPPED"
      running.value = newTun || newProxy
      await new Promise(resolve => setTimeout(resolve, 1500))
    } else if (res === "config-missing") {
      msg.value = "ERROR"
      errorLog.value = "No active configuration selected"
      // Revert optimistic update
      tunMode.value = prevTun
      sysProxy.value = prevProxy
      isProcessing.value = false
      return { error: 'config-missing' }
    } else {
      msg.value = "ERROR"
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
    msg.value = "RESTARTING..."

    const res = await Backend.ApplyState(newTun, newProxy)

    if (res === "Success" || res === "Stopped") {
      msg.value = newTun || newProxy ? "RUNNING" : "STOPPED"
      running.value = newTun || newProxy
      await new Promise(resolve => setTimeout(resolve, 1500))
    } else if (res === "config-missing") {
      msg.value = "ERROR"
      errorLog.value = "No active configuration selected"
      // Revert optimistic update
      tunMode.value = prevTun
      sysProxy.value = prevProxy
      isProcessing.value = false
      return { error: 'config-missing' }
    } else {
      msg.value = "ERROR"
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

  const handleLogConfigChange = async (level: string, toFile: boolean) => {
    const res = await Backend.SetLogConfig(level, toFile)
    if (res === "Success") {
      logLevel.value = level
      logToFile.value = toFile
    } else {
      errorAlertMessage.value = res
      showErrorAlert.value = true
    }
  }

  const setupEventListeners = () => {
    unsubscribeStatus = EventsOn("status", (isRunning: boolean) => {
      running.value = isRunning
      if (!isRunning) {
        if (msg.value !== "STANDBY" && msg.value !== "NET TIMEOUT") {
          msg.value = "STOPPED"
        }
      } else {
        if (["DETECTING", "STANDBY", "NET TIMEOUT"].includes(msg.value)) {
          msg.value = ""
        }
      }
    })

    unsubscribeStateSync = EventsOn("state-sync", (state: any) => {
      tunMode.value = state.tunMode
      sysProxy.value = state.sysProxy
    })

    unsubscribeLog = EventsOn("log", (logMsg: string) => {
      const cleaned = cleanLog(logMsg)

      if (cleaned.startsWith("Error:") || cleaned.includes("failed")) {
        msg.value = "ERROR"
        errorLog.value = cleaned
      } else {
        msg.value = cleaned
      }
    })
  }

  onMounted(() => {
    refreshData()
    setupEventListeners()
  })

  onUnmounted(() => {
    if (unsubscribeStatus) unsubscribeStatus()
    if (unsubscribeStateSync) unsubscribeStateSync()
    if (unsubscribeLog) unsubscribeLog()
  })

  return {
    running, coreExists, msg, tunMode, sysProxy, isProcessing,
    errorLog, startOnBoot, autoConnectState,
    mirrorUrl, mirrorEnabled, ipv6Enabled, preRelease, logLevel, logToFile,
    showErrorAlert, errorAlertMessage,
    getStatusText, getStatusStyle, getControlBg,
    handleToggle, handleSwitchMode, handleServiceToggle, refreshData, handleMirrorToggle,
    handleStartOnBootToggle, handleAutoConnectChange,
    handleIPv6Toggle, handlePreReleaseToggle, handleLogConfigChange
  }
}
