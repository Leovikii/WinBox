import { ref, computed, shallowRef } from 'vue'
import * as Backend from '../../wailsjs/go/internal/App'
import type { useAppState } from './useAppState'

export function useProfiles(appState: ReturnType<typeof useAppState>) {
  const profiles = shallowRef<any[]>([])
  const activeProfile = ref<any>(null)
  const isUpdatingProfile = ref(false)
  const isProfileListExpanded = ref(false)

  const showAddProfileModal = ref(false)
  const newName = ref("")
  const newUrl = ref("")
  const isAddingProfile = ref(false)

  const otherProfiles = computed(() =>
    profiles.value.filter(p => activeProfile.value && p.id !== activeProfile.value.id)
  )

  const cleanLog = (text: string) =>
    text.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')

  const addProfile = async () => {
    if (!newName.value || !newUrl.value) {
      appState.msg.value = "Input missing"
      return
    }
    isAddingProfile.value = true
    appState.msg.value = "Downloading Config..."
    const res = await Backend.AddProfile(newName.value, newUrl.value)
    isAddingProfile.value = false
    if (res === "Success") {
      appState.msg.value = "Success"
      newName.value = ""
      newUrl.value = ""
      showAddProfileModal.value = false
      await appState.refreshData()
      const data = await Backend.GetInitData()
      profiles.value = data.profiles || []
      activeProfile.value = data.activeProfile || null
    } else {
      appState.msg.value = "Error"
      appState.errorLog.value = cleanLog(res)
    }
  }

  const switchProfile = async (id: string, e: any) => {
    e.stopPropagation()
    const res = await Backend.SelectProfile(id)
    if (res === "Success") {
      appState.msg.value = "Switched"
      isProfileListExpanded.value = false
      await appState.refreshData()
      const data = await Backend.GetInitData()
      profiles.value = data.profiles || []
      activeProfile.value = data.activeProfile || null
    } else {
      appState.msg.value = "Error"
      appState.errorLog.value = cleanLog(res)
    }
  }

  const deleteProfile = async (id: string, e: any) => {
    e.stopPropagation()
    if (confirm("Delete?")) {
      await Backend.DeleteProfile(id)
      await appState.refreshData()
      const data = await Backend.GetInitData()
      profiles.value = data.profiles || []
      activeProfile.value = data.activeProfile || null
    }
  }

  const updateActive = async (e: any) => {
    e.stopPropagation()
    if (isUpdatingProfile.value) return
    isUpdatingProfile.value = true
    appState.msg.value = "Updating..."
    const res = await Backend.UpdateActiveProfile()
    isUpdatingProfile.value = false
    if (res !== "Success") {
      appState.msg.value = "Error"
      appState.errorLog.value = cleanLog(res)
    } else {
      appState.msg.value = "Updated"
      await appState.refreshData()
      const data = await Backend.GetInitData()
      profiles.value = data.profiles || []
      activeProfile.value = data.activeProfile || null
    }
  }

  return {
    profiles, activeProfile, isUpdatingProfile, isProfileListExpanded,
    showAddProfileModal, newName, newUrl, isAddingProfile,
    otherProfiles,
    addProfile, switchProfile, deleteProfile, updateActive
  }
}
