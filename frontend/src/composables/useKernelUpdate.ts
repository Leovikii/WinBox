import { ref, onMounted, onUnmounted } from 'vue'
import * as Backend from '../../wailsjs/go/internal/App'
import { EventsOn } from '../../wailsjs/runtime/runtime'
import type { useAppState } from './useAppState'
import { cleanLog } from '../utils/logUtils'

export function useKernelUpdate(appState: ReturnType<typeof useAppState>) {
  const localVer = ref("Unknown")
  const remoteVer = ref("Unknown")
  const updateState = ref("idle")
  const downloadProgress = ref(0)

  const showEditor = ref(false)
  const editingType = ref<"tun" | "mixed" | "mirror">("tun")
  const editorContent = ref("")
  const saveBtnText = ref("SAVE")

  const showResetConfirm = ref(false)
  const showErrorAlert = ref(false)
  const errorAlertMessage = ref("")

  // Store timeout IDs for cleanup
  let updateStateTimeout: number | null = null
  let editorCloseTimeout: number | null = null

  const checkUpdate = async () => {
    updateState.value = "checking"
    const ver = await Backend.CheckUpdate()
    if (ver.includes("Error") || ver.includes("Failed") || ver.includes("No tag")) {
      appState.msg.value = "Check Failed"
      appState.errorLog.value = ver
      updateState.value = "idle"
      return
    }
    remoteVer.value = ver
    updateState.value = ver.replace("v", "") !== localVer.value.replace("v", "") ? "available" : "latest"
  }

  const performUpdate = async () => {
    updateState.value = "updating"
    appState.msg.value = "Init Download..."
    const effectiveMirror = appState.mirrorEnabled.value ? appState.mirrorUrl.value : ""
    const res = await Backend.UpdateKernel(effectiveMirror)
    if (res === "Success") {
      appState.coreExists.value = true
      appState.msg.value = "Updated!"
      localVer.value = remoteVer.value.replace("v", "")
      updateState.value = "success"
      if (updateStateTimeout) clearTimeout(updateStateTimeout)
      updateStateTimeout = window.setTimeout(() => updateState.value = "idle", 2000)
    } else {
      appState.msg.value = "Failed"
      appState.errorLog.value = cleanLog(res)
      updateState.value = "error"
    }
  }

  const openEditor = async (type: "tun" | "mixed" | "mirror") => {
    editingType.value = type
    saveBtnText.value = "SAVE"
    if (type === 'mirror') {
      editorContent.value = appState.mirrorUrl.value
    } else {
      const content = await Backend.GetOverride(type)
      try {
        const obj = JSON.parse(content)
        editorContent.value = JSON.stringify(obj, null, 2)
      } catch {
        editorContent.value = content
      }
    }
    showEditor.value = true
  }

  const saveEditor = async () => {
    let res = ""
    if (editingType.value === 'mirror') {
      res = await Backend.SaveSettings(editorContent.value, appState.mirrorEnabled.value)
      if (res === "Success") {
        appState.mirrorUrl.value = editorContent.value
      }
    } else {
      res = await Backend.SaveOverride(editingType.value as string, editorContent.value)
    }
    if (res === "Success") {
      saveBtnText.value = "SAVED"
      if (appState.running.value && editingType.value !== 'mirror') appState.msg.value = "RESTART TO APPLY"
      if (editorCloseTimeout) clearTimeout(editorCloseTimeout)
      editorCloseTimeout = window.setTimeout(() => {
        showEditor.value = false
      }, 800)
    } else {
      errorAlertMessage.value = res
      showErrorAlert.value = true
    }
  }

  const resetEditor = () => {
    showResetConfirm.value = true
  }

  const confirmReset = async () => {
    showResetConfirm.value = false
    if (editingType.value === 'mirror') {
      editorContent.value = "https://gh-proxy.com/"
    } else {
      const res = await Backend.ResetOverride(editingType.value)
      try {
        const content = res === "Success" ? await Backend.GetOverride(editingType.value) : "{}"
        const obj = JSON.parse(content)
        editorContent.value = JSON.stringify(obj, null, 2)
      } catch {
        editorContent.value = "Error"
      }
    }
  }

  onMounted(() => {
    EventsOn("download-progress", (pct: number) => {
      downloadProgress.value = pct
    })
  })

  onUnmounted(() => {
    // Clean up any pending timeouts
    if (updateStateTimeout) clearTimeout(updateStateTimeout)
    if (editorCloseTimeout) clearTimeout(editorCloseTimeout)
  })

  return {
    localVer, remoteVer, updateState, downloadProgress,
    showEditor, editingType, editorContent, saveBtnText,
    showResetConfirm, showErrorAlert, errorAlertMessage,
    checkUpdate, performUpdate, openEditor, saveEditor, resetEditor, confirmReset
  }
}
