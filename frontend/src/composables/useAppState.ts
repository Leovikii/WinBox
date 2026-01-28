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

  const startOnBoot = ref(false)
  const autoConnect = ref(false)
  const autoConnectMode = ref("full")
  const mirrorUrl = ref("")
  const mirrorEnabled = ref(false)

  const ipv6Enabled = ref(true)
  const logLevel = ref("warning")
  const logToFile = ref(true)
  const logAutoRefresh = ref(true)

  let unsubscribeStatus: (() => void) | null = null
  let unsubscribeStateSync: (() => void) | null = null
  let unsubscribeLog: (() => void) | null = null

  const getStatusText = computed(() => {
    if (!coreExists.value) return "WARNING"
    if (msg.value === "ERROR") return "ERROR"
    if (!running.value) return "OFFLINE"
    if (tunMode.value && sysProxy.value) return "FULL MODE"
    if (tunMode.value) return "TUN MODE"
    if (sysProxy.value) return "PROXY MODE"
    return "ONLINE"
  })

  const getStatusStyle = computed(() => {
    if (!coreExists.value)
      return { color: '#FCD575 !important', filter: 'drop-shadow(0 0 25px rgba(248, 181, 0, 0.8))' }

    if (msg.value === "ERROR")
      return { color: '#F4A7B0 !important', filter: 'drop-shadow(0 0 25px rgba(233, 84, 100, 0.8))' }

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
      msg.value === "ERROR" || !coreExists.value,
      running.value
    )

    if (!coreExists.value)
      return `bg-[#F8B500]/20`

    if (msg.value === "ERROR")
      return `bg-[${color.hex}]/20`

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
    tunMode.value = data.running && data.tunMode
    sysProxy.value = data.running && data.sysProxy
    startOnBoot.value = data.startOnBoot
    autoConnect.value = data.autoConnect
    autoConnectMode.value = data.autoConnectMode
    mirrorUrl.value = data.mirror
    mirrorEnabled.value = data.mirrorEnabled
    ipv6Enabled.value = data.ipv6_enabled !== undefined ? data.ipv6_enabled : true
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
      tunMode.value = true
      sysProxy.value = true
      msg.value = "STARTING..."
      const res = await Backend.ApplyState(true, true)

      if (res === "Success") {
        msg.value = "RUNNING"
        running.value = true
        await new Promise(resolve => setTimeout(resolve, 1500))
      } else {
        msg.value = "ERROR"
        errorLog.value = res
        tunMode.value = false
        sysProxy.value = false
      }
      isProcessing.value = false
    } else {
      tunMode.value = false
      sysProxy.value = false
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

    if (target === 'tun') newTun = !tunMode.value
    if (target === 'proxy') newProxy = !sysProxy.value

    msg.value = newTun || newProxy ? "STARTING..." : "STOPPING..."

    const res = await Backend.ApplyState(newTun, newProxy)

    if (res === "Success" || res === "Stopped") {
      tunMode.value = newTun
      sysProxy.value = newProxy
      msg.value = newTun || newProxy ? "RUNNING" : "STOPPED"
      running.value = newTun || newProxy
      await new Promise(resolve => setTimeout(resolve, 1500))
    } else if (res === "config-missing") {
      msg.value = "ERROR"
      errorLog.value = "No active configuration selected"
      isProcessing.value = false
      return { error: 'config-missing' }
    } else {
      msg.value = "ERROR"
      errorLog.value = res
    }
    isProcessing.value = false
  }

  const handleSwitchMode = async (target: { tunMode: boolean, sysProxy: boolean }) => {
    if (isProcessing.value) return
    if (!coreExists.value) {
      msg.value = "KERNEL MISSING!"
      return { error: 'kernel-missing' }
    }

    isProcessing.value = true
    const newTun = target.tunMode
    const newProxy = target.sysProxy

    msg.value = newTun || newProxy ? "STARTING..." : "STOPPING..."

    const res = await Backend.ApplyState(newTun, newProxy)

    if (res === "Success" || res === "Stopped") {
      tunMode.value = newTun
      sysProxy.value = newProxy
      msg.value = newTun || newProxy ? "RUNNING" : "STOPPED"
      running.value = newTun || newProxy
      await new Promise(resolve => setTimeout(resolve, 1500))
    } else if (res === "config-missing") {
      msg.value = "ERROR"
      errorLog.value = "No active configuration selected"
      isProcessing.value = false
      return { error: 'config-missing' }
    } else {
      msg.value = "ERROR"
      errorLog.value = res
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
      if (newState && !autoConnect.value) {
        await Backend.SetAutoConnect(true, autoConnectMode.value)
        autoConnect.value = true
      }
    } else {
      alert(res)
    }
  }

  const handleAutoConnectToggle = async () => {
    const newState = !autoConnect.value
    const res = await Backend.SetAutoConnect(newState, autoConnectMode.value)
    if (res === "Success") autoConnect.value = newState
    else alert(res)
  }

  const handleAutoConnectModeChange = async (newMode: string | number) => {
    const mode = String(newMode)
    const res = await Backend.SetAutoConnect(autoConnect.value, mode)
    if (res === "Success") autoConnectMode.value = mode
  }

  const handleIPv6Toggle = async () => {
    const newState = !ipv6Enabled.value
    const res = await Backend.ToggleIPv6(newState)
    if (res === "Success") ipv6Enabled.value = newState
    else alert(res)
  }

  const handleLogConfigChange = async (level: string, toFile: boolean) => {
    const res = await Backend.SetLogConfig(level, toFile)
    if (res === "Success") {
      logLevel.value = level
      logToFile.value = toFile
    } else {
      alert(res)
    }
  }

  const setupEventListeners = () => {
    unsubscribeStatus = EventsOn("status", (state: boolean) => {
      running.value = state
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
    errorLog, startOnBoot, autoConnect, autoConnectMode,
    mirrorUrl, mirrorEnabled, ipv6Enabled, logLevel, logToFile, logAutoRefresh,
    getStatusText, getStatusStyle, getControlBg,
    handleToggle, handleSwitchMode, handleServiceToggle, refreshData, handleMirrorToggle,
    handleStartOnBootToggle, handleAutoConnectToggle,
    handleAutoConnectModeChange, handleIPv6Toggle, handleLogConfigChange
  }
}
