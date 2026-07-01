import { ref } from 'vue'
import * as Backend from '../../wailsjs/go/internal/App'
import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime'

const appLogContent = ref("")
const showLogModal = ref(false)
const copyState = ref("Copy")

let isInitialized = false

export function useAppLogs() {
  const loadAppLog = async () => {
    try {
      const content = await Backend.GetAppLog()
      appLogContent.value = content
    } catch (error) {
      appLogContent.value = "> Failed to load app log"
    }
  }

  const clearAppLog = async () => {
    const res = await Backend.ClearAppLog()
    if (res === "Success") {
      appLogContent.value = ""
      await loadAppLog()
    }
  }

  const copyAppLog = async () => {
    if (!appLogContent.value) return
    try {
      await navigator.clipboard.writeText(appLogContent.value)
      copyState.value = "COPIED!"
      setTimeout(() => {
        copyState.value = "Copy"
      }, 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  const handleNewLog = (newLogLine: string) => {
    appLogContent.value += newLogLine
    
    // Prevent unbounded memory growth
    if (appLogContent.value.length > 600000) {
      const sliceIndex = appLogContent.value.indexOf('\n', 100000)
      if (sliceIndex !== -1) {
        appLogContent.value = appLogContent.value.substring(sliceIndex + 1)
      }
    }
  }

  const initLogs = () => {
    if (!isInitialized) {
      isInitialized = true
      loadAppLog()
      EventsOn("onAppLog", handleNewLog)
    }
  }

  return {
    appLogContent, showLogModal, copyState,
    clearAppLog, copyAppLog, initLogs
  }
}
