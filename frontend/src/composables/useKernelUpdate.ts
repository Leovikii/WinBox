import { ref, computed, onMounted, onUnmounted } from 'vue'
import * as Backend from '../../wailsjs/go/internal/App'
import { EventsOn } from '../../wailsjs/runtime/runtime'
import { useAppState } from './useAppState'
import { cleanLog } from '../utils/logUtils'
import { isNewerVersion } from '../utils/versionCompare'

const localVer = ref("Unknown")
const remoteVer = ref("Unknown")
const updateState = ref("idle")
const downloadProgress = ref(0)

const showEditor = ref(false)
const editingType = ref<"tun" | "mixed" | "mirror">("tun")
const editorContent = ref("")
const editorOriginalContent = ref("")
const editorDefaultContent = ref("")

const showResetConfirm = ref(false)
const showErrorAlert = ref(false)
const errorAlertMessage = ref("")

// Store timeout IDs for cleanup
let updateStateTimeout: number | null = null
let editorCloseTimeout: number | null = null

let isInitialized = false
let unsubscribeDownloadProgress: (() => void) | null = null

export function useKernelUpdate() {
  const appState = useAppState()
  const saveBtnText = ref("Save")

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

    if (isNewerVersion(ver, localVer.value)) {
      updateState.value = "available"
    } else {
      updateState.value = "latest"
    }
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
    saveBtnText.value = "Save"
    if (type === 'mirror') {
      editorContent.value = appState.mirrorUrl.value
      editorOriginalContent.value = appState.mirrorUrl.value
      editorDefaultContent.value = "https://gh-proxy.com/"
    } else {
      const content = await Backend.GetOverride(type)
      const defaultContentRaw = await Backend.GetDefaultOverride(type)
      try {
        const obj = JSON.parse(content)
        editorContent.value = JSON.stringify(obj, null, 2)
      } catch {
        editorContent.value = content
      }
      editorOriginalContent.value = editorContent.value
      try {
        const defaultObj = JSON.parse(defaultContentRaw)
        editorDefaultContent.value = JSON.stringify(defaultObj, null, 2)
      } catch {
        editorDefaultContent.value = defaultContentRaw
      }
    }
    showErrorAlert.value = false
    errorAlertMessage.value = ""
    showEditor.value = true
  }

  const saveEditor = async () => {
    let res = ""
    if (editingType.value === 'mirror') {
      try {
        new URL(editorContent.value)
      } catch {
        errorAlertMessage.value = "Invalid Mirror URL format"
        showErrorAlert.value = true
        return
      }
      res = await Backend.SaveSettings(editorContent.value, appState.mirrorEnabled.value)
      if (res === "Success") {
        appState.mirrorUrl.value = editorContent.value
        editorOriginalContent.value = editorContent.value
      }
    } else {
      try {
        const parsed = JSON.parse(editorContent.value)
        editorContent.value = JSON.stringify(parsed, null, 2)
      } catch (e) {
        errorAlertMessage.value = "Invalid JSON format"
        showErrorAlert.value = true
        return
      }
      res = await Backend.SaveOverride(editingType.value as string, editorContent.value)
      if (res === "Success") {
        editorOriginalContent.value = editorContent.value
      }
    }
    if (res === "Success") {
      saveBtnText.value = "Saved"
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

  const switchEditorTab = async (type: "tun" | "mixed") => {
    editingType.value = type
    saveBtnText.value = "Save"
    const content = await Backend.GetOverride(type)
    const defaultContentRaw = await Backend.GetDefaultOverride(type)
    try {
      const obj = JSON.parse(content)
      editorContent.value = JSON.stringify(obj, null, 2)
    } catch {
      editorContent.value = content
    }
    editorOriginalContent.value = editorContent.value
    try {
      const defaultObj = JSON.parse(defaultContentRaw)
      editorDefaultContent.value = JSON.stringify(defaultObj, null, 2)
    } catch {
      editorDefaultContent.value = defaultContentRaw
    }
  }

  onMounted(() => {
    if (!isInitialized) {
      isInitialized = true
      unsubscribeDownloadProgress = EventsOn("download-progress", (pct: number) => {
        downloadProgress.value = pct
      })
    }
  })

  onUnmounted(() => {
    // For global state, we don't unsubscribe from EventsOn here.
    // Timeouts can still be cleared safely if we leave a component, but since
    // multiple might share this, we just leave them or clear if needed.
    // if (updateStateTimeout) clearTimeout(updateStateTimeout)
    // if (editorCloseTimeout) clearTimeout(editorCloseTimeout)
  })

  const isEditorChanged = computed(() => {
    return editorContent.value !== editorOriginalContent.value
  })

  return {
    localVer, remoteVer, updateState, downloadProgress,
    showEditor, editingType, editorContent, editorOriginalContent, editorDefaultContent, isEditorChanged, saveBtnText,
    showResetConfirm, showErrorAlert, errorAlertMessage,
    checkUpdate, performUpdate, openEditor, saveEditor, resetEditor, confirmReset, switchEditorTab
  }
}
