import { ref } from 'vue'
import * as Backend from '../../wailsjs/go/internal/App'

export interface UWPApp {
  sid: string
  displayName: string
  packageName: string
  isExempt: boolean
}

export function useUWPLoopback() {
  const apps = ref<UWPApp[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const selectedSIDs = ref<string[]>([])

  const loadApps = async () => {
    loading.value = true
    try {
      const result = await Backend.GetUWPApps()
      apps.value = result || []

      selectedSIDs.value = apps.value
        .filter(app => app.isExempt)
        .map(app => app.sid)
    } catch (error) {
      apps.value = []
    } finally {
      loading.value = false
    }
  }

  const saveExemptions = async () => {
    saving.value = true
    try {
      const result = await Backend.SetUWPLoopbackExemptions(selectedSIDs.value)
      if (result === 'Success') {
        apps.value.forEach(app => {
          app.isExempt = selectedSIDs.value.includes(app.sid)
        })
        return true
      } else {
        return false
      }
    } catch (error) {
      return false
    } finally {
      saving.value = false
    }
  }

  const toggleApp = (sid: string) => {
    const index = selectedSIDs.value.indexOf(sid)
    if (index > -1) {
      selectedSIDs.value.splice(index, 1)
    } else {
      selectedSIDs.value.push(sid)
    }
  }

  const selectAll = () => {
    selectedSIDs.value = apps.value.map(app => app.sid)
  }

  const deselectAll = () => {
    selectedSIDs.value = []
  }

  const hasChanges = () => {
    const currentExempt = apps.value
      .filter(app => app.isExempt)
      .map(app => app.sid)
      .sort()
    const selected = [...selectedSIDs.value].sort()

    if (currentExempt.length !== selected.length) return true

    for (let i = 0; i < currentExempt.length; i++) {
      if (currentExempt[i] !== selected[i]) return true
    }

    return false
  }

  return {
    apps,
    loading,
    saving,
    selectedSIDs,
    loadApps,
    saveExemptions,
    toggleApp,
    selectAll,
    deselectAll,
    hasChanges
  }
}
