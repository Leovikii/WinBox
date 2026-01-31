import { ref, computed, shallowRef } from 'vue'
import * as Backend from '../../wailsjs/go/internal/App'
import type { useAppState } from './useAppState'
import { cleanLog } from '../utils/logUtils'

export function useProfiles(appState: ReturnType<typeof useAppState>) {
  const profiles = shallowRef<any[]>([])
  const activeProfile = ref<any>(null)
  const isUpdatingProfile = ref(false)

  const showAddProfileModal = ref(false)
  const newName = ref("")
  const newUrl = ref("")
  const isAddingProfile = ref(false)

  const showEditProfileModal = ref(false)
  const editingProfileId = ref("")
  const editName = ref("")
  const editUrl = ref("")
  const isEditingProfile = ref(false)

  const showDeleteConfirm = ref(false)
  const deletingProfileId = ref("")

  const refreshProfiles = async () => {
    const data = await appState.refreshData()
    profiles.value = data.profiles || []
    activeProfile.value = data.activeProfile || null
  }

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
      await refreshProfiles()
    } else {
      appState.msg.value = "Error"
      appState.errorLog.value = cleanLog(res)
    }
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

  const deleteProfile = (id: string, e: any) => {
    e.stopPropagation()
    deletingProfileId.value = id
    showDeleteConfirm.value = true
  }

  const confirmDelete = async () => {
    showDeleteConfirm.value = false
    if (deletingProfileId.value) {
      await Backend.DeleteProfile(deletingProfileId.value)
      await refreshProfiles()
      deletingProfileId.value = ""
    }
  }

  const editProfile = async (id: string, e: any) => {
    e.stopPropagation()
    const profile = profiles.value.find(p => p.id === id)
    if (profile) {
      editingProfileId.value = id
      editName.value = profile.name
      editUrl.value = profile.url
      showEditProfileModal.value = true
    }
  }

  const saveEditProfile = async () => {
    if (!editName.value || !editUrl.value) {
      appState.msg.value = "Input missing"
      return
    }
    isEditingProfile.value = true
    const res = await Backend.EditProfile(editingProfileId.value, editName.value, editUrl.value)
    isEditingProfile.value = false
    if (res === "Success") {
      appState.msg.value = "Updated"
      showEditProfileModal.value = false
      await refreshProfiles()
    } else {
      appState.msg.value = "Error"
      appState.errorLog.value = cleanLog(res)
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
      await refreshProfiles()
    }
  }

  return {
    profiles, activeProfile, isUpdatingProfile,
    showAddProfileModal, newName, newUrl, isAddingProfile,
    showEditProfileModal, editingProfileId, editName, editUrl, isEditingProfile,
    showDeleteConfirm, deletingProfileId,
    addProfile, switchProfile, deleteProfile, confirmDelete, updateActive, editProfile, saveEditProfile
  }
}
