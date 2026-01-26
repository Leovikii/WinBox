<script setup lang="ts">
import { WButton, WIconButton, WCard, WInput, WModal, WListItem } from '@/components/ui'

defineProps<{
  isOpen: boolean
  profiles: any[]
  activeProfile: any
  isUpdatingProfile: boolean
  showAddProfileModal: boolean
  newName: string
  newUrl: string
  isAddingProfile: boolean
  showEditProfileModal: boolean
  editName: string
  editUrl: string
  isEditingProfile: boolean
  showDeleteConfirm: boolean
}>()

const emit = defineEmits<{
  'close': []
  'switch-profile': [id: string, e: any]
  'delete-profile': [id: string, e: any]
  'confirm-delete': []
  'close-delete-confirm': []
  'update-active': [e: any]
  'open-add-modal': []
  'update:newName': [value: string]
  'update:newUrl': [value: string]
  'update:showAddProfileModal': [value: boolean]
  'add-profile': []
  'edit-profile': [id: string, e: any]
  'update:editName': [value: string]
  'update:editUrl': [value: string]
  'update:showEditProfileModal': [value: boolean]
  'save-edit-profile': []
}>()
</script>

<template>
  <div class="w-full h-full flex flex-col bg-[#090909]">
    <div class="h-16 shrink-0 flex items-center px-6">
      <h2 class="text-xs font-bold text-[#555] uppercase tracking-[0.2em]">Profiles Manager</h2>
    </div>

    <div class="flex-1 overflow-y-auto px-4 pb-28 space-y-6 custom-scrollbar [&::-webkit-scrollbar]:hidden">
      <WCard variant="default" padding="none" class="overflow-hidden">
        <div class="p-4 flex justify-between items-center bg-[#111]">
          <span class="text-xs font-bold text-gray-400">Current Profile</span>
          <span class="text-xs text-(--accent-color) font-bold font-mono truncate max-w-xs">{{ activeProfile ? activeProfile.name : "None" }}</span>
        </div>
        <div class="px-4 pb-4 pt-4 bg-[#0a0a0a]">
          <div class="flex justify-between items-center h-10">
            <span class="text-xs font-bold text-gray-500">Last Updated</span>
            <div class="flex items-center gap-3">
              <span class="text-[10px] text-[#444] font-mono">{{ activeProfile && activeProfile.updated ? activeProfile.updated : "Never" }}</span>
              <WButton 
                variant="secondary" 
                size="sm" 
                :disabled="!activeProfile || isUpdatingProfile"
                :loading="isUpdatingProfile"
                icon="fas fa-sync-alt"
                @click="emit('update-active', $event)"
              >
                {{ isUpdatingProfile ? "UPDATING" : "UPDATE" }}
              </WButton>
            </div>
          </div>
        </div>
      </WCard>

      <WCard variant="default" padding="none" class="overflow-hidden">
        <div class="p-4 flex justify-between items-center bg-[#111] border-b border-[#222]">
          <span class="text-xs font-bold text-gray-400">All Profiles</span>
          <WButton 
            variant="primary" 
            size="sm" 
            icon="fas fa-plus"
            @click="emit('open-add-modal')"
            class="min-w-17.5"
          >
            ADD
          </WButton>
        </div>
        <div class="p-2 bg-[#0a0a0a]">
          <WListItem
            v-for="p in profiles"
            :key="p.id"
            :title="p.name"
            :subtitle="p.url"
            :active="activeProfile && p.id === activeProfile.id"
            @click="emit('switch-profile', p.id, $event)"
          >
            <template #actions>
              <WIconButton 
                icon="fas fa-pen" 
                size="sm"
                @click.stop="emit('edit-profile', p.id, $event)"
              />
              <WIconButton
                v-if="!(activeProfile && p.id === activeProfile.id)"
                icon="fas fa-trash"
                variant="danger"
                size="sm"
                @click.stop="emit('delete-profile', p.id, $event)"
              />
            </template>
          </WListItem>
        </div>
      </WCard>
    </div>
  </div>

  <WModal 
    :model-value="showAddProfileModal"
    @update:model-value="emit('update:showAddProfileModal', $event)"
    title="NEW CONFIG"
    width="md"
  >
    <WInput 
      :model-value="newName"
      @update:model-value="emit('update:newName', $event)"
      placeholder="Profile Name"
    />
    <WInput 
      :model-value="newUrl"
      @update:model-value="emit('update:newUrl', $event)"
      placeholder="Subscription URL"
      mono
    />
    <template #footer>
      <WButton 
        variant="primary"
        full-width
        :loading="isAddingProfile"
        @click="emit('add-profile')"
      >
        {{ isAddingProfile ? "DOWNLOADING..." : "ADD PROFILE" }}
      </WButton>
    </template>
  </WModal>

  <WModal 
    :model-value="showEditProfileModal"
    @update:model-value="emit('update:showEditProfileModal', $event)"
    title="EDIT CONFIG"
    width="md"
  >
    <WInput 
      :model-value="editName"
      @update:model-value="emit('update:editName', $event)"
      placeholder="Profile Name"
    />
    <WInput 
      :model-value="editUrl"
      @update:model-value="emit('update:editUrl', $event)"
      placeholder="Subscription URL"
      mono
    />
    <template #footer>
      <WButton 
        variant="primary"
        full-width
        :loading="isEditingProfile"
        @click="emit('save-edit-profile')"
      >
        {{ isEditingProfile ? "SAVING..." : "SAVE CHANGES" }}
      </WButton>
    </template>
  </WModal>

  <WModal
    :model-value="showDeleteConfirm"
    @update:model-value="emit('close-delete-confirm')"
    title="CONFIRM DELETE"
    width="md"
  >
    <div class="text-sm text-gray-300">Are you sure you want to delete this profile?</div>
    <template #footer>
      <div class="flex gap-3 w-full">
        <WButton variant="secondary" class="flex-1" @click="emit('close-delete-confirm')">CANCEL</WButton>
        <WButton variant="danger" class="flex-1" @click="emit('confirm-delete')">DELETE</WButton>
      </div>
    </template>
  </WModal>
</template>