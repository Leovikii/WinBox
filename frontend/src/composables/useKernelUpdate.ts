import { ref, onMounted } from 'vue'
import * as Backend from '../../wailsjs/go/internal/App'
import { EventsOn } from '../../wailsjs/runtime/runtime'
import type { useAppState } from './useAppState'

export function useKernelUpdate(appState: ReturnType<typeof useAppState>) {
  const localVer = ref("Unknown")
  const remoteVer = ref("Unknown")
  const updateState = ref("idle")
  const downloadProgress = ref(0)

  const showEditor = ref(false)
  const editingType = ref<"tun" | "mixed" | "mirror">("tun")
  const editorContent = ref("")
  const saveBtnText = ref("SAVE")

  const cleanLog = (text: string) =>
    text.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')

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
      setTimeout(() => updateState.value = "idle", 2000)
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
      setTimeout(() => {
        showEditor.value = false
      }, 800)
    } else {
      alert(res)
    }
  }

  const resetEditor = async () => {
    if (confirm("Reset to default?")) {
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
  }

  onMounted(() => {
    EventsOn("download-progress", (pct: number) => {
      downloadProgress.value = pct
    })
  })

  return {
    localVer, remoteVer, updateState, downloadProgress,
    showEditor, editingType, editorContent, saveBtnText,
    checkUpdate, performUpdate, openEditor, saveEditor, resetEditor
  }
}
