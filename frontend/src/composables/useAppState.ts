import { ref, computed, onMounted } from 'vue'
import * as Backend from '../../wailsjs/go/internal/App'
import { EventsOn } from '../../wailsjs/runtime/runtime'

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

  const cleanLog = (text: string) =>
    text.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')

  const getStatusText = computed(() => {
    if (!coreExists.value) return "MISSING"
    if (msg.value === "ERROR") return "ERROR"
    if (!running.value) return "OFFLINE"
    if (tunMode.value && sysProxy.value) return "FULL MODE"
    if (tunMode.value) return "TUN MODE"
    if (sysProxy.value) return "PROXY MODE"
    return "ONLINE"
  })

  const getStatusGlow = computed(() => {
    if (!coreExists.value || msg.value === "ERROR")
      return "text-red-500 drop-shadow-[0_0_25px_rgba(220,38,38,0.8)]"
    if (!running.value) return "text-[#333] drop-shadow-none"
    if (tunMode.value && sysProxy.value)
      return "text-white drop-shadow-[0_0_35px_rgba(147,51,234,0.8)]"
    if (tunMode.value)
      return "text-white drop-shadow-[0_0_35px_rgba(37,99,235,0.8)]"
    if (sysProxy.value)
      return "text-white drop-shadow-[0_0_35px_rgba(168,85,247,0.8)]"
    return "text-white drop-shadow-[0_0_25px_rgba(255,255,255,0.5)]"
  })

  const getControlBg = computed(() => {
    if (tunMode.value && sysProxy.value)
      return "bg-gradient-to-br from-blue-600/40 via-purple-600/40 to-blue-900/40"
    if (tunMode.value) return "bg-blue-600/20"
    if (sysProxy.value) return "bg-purple-600/20"
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
    return data
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

    tunMode.value = newTun
    sysProxy.value = newProxy
    msg.value = newTun || newProxy ? "STARTING..." : "STOPPING..."

    const res = await Backend.ApplyState(newTun, newProxy)
    isProcessing.value = false

    if (res === "Success" || res === "Stopped") {
      msg.value = newTun || newProxy ? "RUNNING" : "STOPPED"
      running.value = newTun || newProxy
    } else {
      msg.value = "ERROR"
      errorLog.value = res
      tunMode.value = !newTun
      sysProxy.value = !newProxy
    }
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

  const handleAutoConnectModeChange = async (e: Event) => {
    const newMode = (e.target as HTMLSelectElement).value
    const res = await Backend.SetAutoConnect(autoConnect.value, newMode)
    if (res === "Success") autoConnectMode.value = newMode
  }

  const setupEventListeners = () => {
    EventsOn("status", (state: boolean) => {
      running.value = state
    })

    EventsOn("state-sync", (state: any) => {
      tunMode.value = state.tunMode
      sysProxy.value = state.sysProxy
    })

    EventsOn("log", (logMsg: string) => {
      const cleaned = cleanLog(logMsg)
      const ignoreKeywords = [
        "forcibly closed", "connection upload closed", "raw-read tcp",
        "use of closed network connection", "context canceled"
      ]

      if (ignoreKeywords.some(k => cleaned.includes(k))) return

      if (cleaned.includes("ERROR") || cleaned.includes("FATAL") ||
          cleaned.includes("bind: address already in use") ||
          cleaned.includes("Access is denied")) {
        msg.value = "ERROR"
        running.value = false
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

  return {
    running, coreExists, msg, tunMode, sysProxy, isProcessing,
    errorLog, startOnBoot, autoConnect, autoConnectMode,
    mirrorUrl, mirrorEnabled,
    getStatusText, getStatusGlow, getControlBg,
    handleToggle, refreshData, handleMirrorToggle,
    handleStartOnBootToggle, handleAutoConnectToggle,
    handleAutoConnectModeChange
  }
}
