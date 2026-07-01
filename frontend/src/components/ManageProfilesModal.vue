<template>
  <WModal
    :model-value="profilesState.showManageProfilesModal.value"
    @update:model-value="profilesState.showManageProfilesModal.value = false"
    title="Manage Profiles"
  >
    <WInfoBar 
      v-model:show="showError" 
      severity="error" 
      :message="profilesState.manageProfilesError.value" 
    />
    <WScrollArea maxHeight="40vh" class="pr-2" ref="profilesScrollbox">
      <TransitionGroup name="list" tag="div" class="relative pb-3">
        <template v-if="profilesState.manageProfilesList.value.length === 0">
          <div class="text-center text-sm text-gray-500 py-4">No profiles found</div>
        </template>
        <div 
          v-for="profile in profilesState.manageProfilesList.value" 
          :key="profile.id"
          class="bg-gray-50 dark:bg-[#1f1f1f] border border-black/10 dark:border-white/5 rounded-lg p-4 mb-3 flex gap-3 items-center group relative list-item-transition"
        >
        <div class="flex-1 space-y-3 min-w-0">
          <div>
            <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
            <WInput
              v-model="profile.name"
              placeholder="Profile Name"
              class="!h-7 text-xs manage-profile-name-input"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Subscription URL</label>
            <WInput
              v-model="profile.url"
              placeholder="https://..."
              class="!h-7 text-xs font-mono"
            />
          </div>
        </div>
        <div class="shrink-0 flex items-center justify-center">
          <WButton 
            variant="ghost" 
            size="sm" 
            class="w-8 h-8 !px-0 opacity-40 group-hover:opacity-100 hover:!bg-red-500/10 hover:!text-red-500 transition-all duration-200"
            icon="fas fa-trash" 
            @click="profilesState.removeProfileFromManageList(profile.id)"
            title="Delete"
          />
        </div>
        </div>
      </TransitionGroup>
    </WScrollArea>
    <template #footer>
      <div class="flex items-center justify-between w-full">
        <WButton variant="ghost" class="whitespace-nowrap" icon="fas fa-plus" @click="handleAddProfile">Add Profile</WButton>
        <div class="flex items-center justify-end gap-3">
          <WButton variant="secondary" class="min-w-[80px]" @click="profilesState.showManageProfilesModal.value = false" :disabled="profilesState.isSavingProfiles.value">Cancel</WButton>
          <WButton variant="primary" class="min-w-[80px]" @click="profilesState.saveManageProfiles" :loading="profilesState.isSavingProfiles.value" :disabled="!profilesState.isManageProfilesChanged.value">Save</WButton>
        </div>
      </div>
    </template>
  </WModal>
</template>

<script setup lang="ts">
import { ref, nextTick, computed } from 'vue'
import { WModal, WScrollArea, WInput, WButton, WInfoBar } from './ui'
import { useProfiles } from '../composables/useProfiles'

const profilesState = useProfiles()

const profilesScrollbox = ref<any>(null)

const showError = computed({
  get: () => !!profilesState.manageProfilesError.value,
  set: (val) => { if (!val) profilesState.manageProfilesError.value = "" }
})

const handleAddProfile = () => {
  profilesState.addNewDraftProfile()
  nextTick(() => {
    if (profilesScrollbox.value) {
      profilesScrollbox.value.scrollToBottom()
    }
    setTimeout(() => {
      const inputs = document.querySelectorAll('.manage-profile-name-input input')
      if (inputs.length > 0) {
        ;(inputs[inputs.length - 1] as HTMLInputElement).focus()
      }
    }, 50)
  })
}
</script>

<style scoped>
.list-move,
.list-enter-active,
.list-leave-active {
  transition: all 0.4s cubic-bezier(0.25, 1, 0.5, 1);
}

.list-enter-from {
  opacity: 0;
  transform: translateY(15px);
}

.list-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

.list-leave-active {
  position: absolute;
  width: 100%;
}
</style>
