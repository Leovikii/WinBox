import { ref, onMounted, onUnmounted } from 'vue'
import * as Backend from '../../wailsjs/go/internal/App'
import { EventsOn } from '../../wailsjs/runtime/runtime'
import wailsConfig from '@wails'
import { useAppState } from './useAppState'
import { isNewerVersion } from '../utils/versionCompare'

const programLocalVer = ref(wailsConfig.info.productVersion)
const programRemoteVer = ref("Unknown")
const programUpdateState = ref("idle")
const programDownloadProgress = ref(0)
const programChangelog = ref("")

let updateStateTimeout: number | null = null
let isInitialized = false
let unsubscribeDownloadProgress: (() => void) | null = null

export function useProgramUpdate() {
  const appState = useAppState()

  const checkProgramUpdate = async () => {
    programUpdateState.value = "checking"
    const res = await Backend.CheckProgramUpdate() as any
    if (res.error) {
      appState.msg.value = "Update Check Failed"
      appState.errorLog.value = res.error
      programUpdateState.value = "error"
      if (updateStateTimeout) clearTimeout(updateStateTimeout)
      updateStateTimeout = window.setTimeout(() => {
        programUpdateState.value = "idle"
      }, 3000)
      return
    }
    programRemoteVer.value = res.version
    programChangelog.value = res.changelog || "No changelog provided."

    if (isNewerVersion(res.version, programLocalVer.value)) {
      programUpdateState.value = "available"
    } else {
      programUpdateState.value = "latest"
    }
  }

  const performProgramUpdate = async () => {
    programUpdateState.value = "updating"
    const effectiveMirror = appState.mirrorEnabled.value ? appState.mirrorUrl.value : ""
    const res = await Backend.UpdateProgram(effectiveMirror)
    if (res === "Success") {
      programUpdateState.value = "success"
    } else {
      appState.msg.value = "Update Failed"
      appState.errorLog.value = res
      programUpdateState.value = "error"
      if (updateStateTimeout) clearTimeout(updateStateTimeout)
      updateStateTimeout = window.setTimeout(() => {
        programUpdateState.value = "idle"
      }, 3000)
    }
  }

  onMounted(() => {
    if (!isInitialized) {
      isInitialized = true
      unsubscribeDownloadProgress = EventsOn("download-progress", (pct: number) => {
        if (programUpdateState.value === "updating") {
          programDownloadProgress.value = pct
        }
      })
    }
  })

  onUnmounted(() => {
    // if (updateStateTimeout) clearTimeout(updateStateTimeout)
  })

  return {
    programLocalVer, programRemoteVer, programUpdateState, programDownloadProgress, programChangelog,
    checkProgramUpdate, performProgramUpdate
  }
}
