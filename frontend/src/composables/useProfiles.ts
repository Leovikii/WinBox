import { ref, computed, shallowRef } from 'vue'
import * as Backend from '../../wailsjs/go/internal/App'
import { useAppState } from './useAppState'
import { cleanLog } from '../utils/logUtils'

const profiles = shallowRef<any[]>([])
const activeProfile = ref<any>(null)
const isUpdatingProfile = ref(false)



const showManageProfilesModal = ref(false)
const manageProfilesList = ref<any[]>([])
const isSavingProfiles = ref(false)

export function useProfiles() {
  const appState = useAppState()

  const refreshProfiles = async () => {
    const data = await appState.refreshData()
    profiles.value = data.profiles || []
    activeProfile.value = data.activeProfile || null
  }



  const switchProfile = async (id: string, e?: any) => {
    if (e) e.stopPropagation()
    if (activeProfile.value && id === activeProfile.value.id) return

    const res = await Backend.SelectProfile(id)
    if (res === "Success") {
      appState.msg.value = "Switched"
      await refreshProfiles()
    } else {
      appState.msg.value = "Error"
      appState.errorLog.value = cleanLog(res)
    }
  }

  const openManageProfiles = (e?: any) => {
    if (e) e.stopPropagation()
    // Create a deep copy for editing
    manageProfilesList.value = JSON.parse(JSON.stringify(profiles.value))
    
    if (manageProfilesList.value.length === 0) {
      addNewDraftProfile()
    }
    
    showManageProfilesModal.value = true
  }

  const removeProfileFromManageList = (id: string) => {
    manageProfilesList.value = manageProfilesList.value.filter(p => p.id !== id)
  }

  const addNewDraftProfile = () => {
    manageProfilesList.value.push({
      id: 'new_' + Date.now(),
      name: '',
      url: ''
    })
  }

  const saveManageProfiles = async () => {
    isSavingProfiles.value = true
    let hasError = false
    let lastError = ""

    // 1. Delete profiles that are no longer in manageProfilesList
    const draftIds = new Set(manageProfilesList.value.map(p => p.id))
    for (const original of profiles.value) {
      if (!draftIds.has(original.id)) {
        await Backend.DeleteProfile(original.id)
      }
    }

    // 2. Edit profiles that have changed
    for (const draft of manageProfilesList.value) {
      const original = profiles.value.find(p => p.id === draft.id)
      if (original) {
        if (original.name !== draft.name || original.url !== draft.url) {
          if (!draft.name || !draft.url) {
            hasError = true
            lastError = "Name and URL cannot be empty"
            continue
          }
          const res = await Backend.EditProfile(draft.id, draft.name, draft.url)
          if (res !== "Success") {
            hasError = true
            lastError = res
          }
        }
      } else if (draft.id.startsWith('new_')) {
        // 3. Add new profiles
        if (!draft.name || !draft.url) {
          hasError = true
          lastError = "Name and URL cannot be empty"
          continue
        }
        appState.msg.value = "Downloading Config..."
        const res = await Backend.AddProfile(draft.name, draft.url)
        if (res !== "Success") {
          hasError = true
          lastError = res
        }
      }
    }

    isSavingProfiles.value = false
    
    if (hasError) {
      appState.msg.value = "Error saving some changes"
      appState.errorLog.value = cleanLog(lastError)
    } else {
      appState.msg.value = "Changes saved"
      showManageProfilesModal.value = false
    }
    
    await refreshProfiles()
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
      await refreshProfiles()
    }
  }

  return {
    profiles, activeProfile, isUpdatingProfile,
    showManageProfilesModal, manageProfilesList, isSavingProfiles,
    openManageProfiles, removeProfileFromManageList, addNewDraftProfile, saveManageProfiles,
    switchProfile, updateActive
  }
}
