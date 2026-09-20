import { ref, onMounted, onUnmounted } from 'vue'
import * as Backend from '../api/backend'
import { EventsOn } from '../api/backend'
import { useAppState } from './useAppState'
import { isNewerVersion } from '../utils/versionCompare'

const programLocalVer = ref("Unknown")
const programRemoteVer = ref("Unknown")
const programUpdateState = ref("idle")
const programDownloadProgress = ref(0)
const programChangelog = ref("")

let updateStateTimeout: number | null = null
let unsubscribeDownloadProgress: (() => void) | null = null
let productVersionPromise: Promise<void> | null = null
let mountedUsers = 0

export function useProgramUpdate() {
  const appState = useAppState()

  const loadProductVersion = () => {
    if (!productVersionPromise) {
      productVersionPromise = Backend.getProductVersion()
        .then((version) => {
          programLocalVer.value = version
        })
        .catch(() => {
          // Keep the explicit Unknown value when the runtime cannot provide metadata.
        })
    }
    return productVersionPromise
  }

  const checkProgramUpdate = async () => {
    await loadProductVersion()
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
    mountedUsers += 1
    if (mountedUsers === 1) {
      void loadProductVersion()
      unsubscribeDownloadProgress = EventsOn("download-progress", (pct: number) => {
        if (programUpdateState.value === "updating") {
          programDownloadProgress.value = pct
        }
      })
    }
  })

  onUnmounted(() => {
    mountedUsers = Math.max(0, mountedUsers - 1)
    if (mountedUsers === 0) {
      unsubscribeDownloadProgress?.()
      unsubscribeDownloadProgress = null
      if (updateStateTimeout) clearTimeout(updateStateTimeout)
      updateStateTimeout = null
    }
  })



  return {
    programLocalVer, programRemoteVer, programUpdateState, programDownloadProgress, programChangelog,
    checkProgramUpdate, performProgramUpdate
  }
}
