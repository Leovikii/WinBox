<script setup lang="ts">
import { computed, watch } from 'vue'
import { WModal, WButton } from './ui'
import type { UWPApp } from '../composables/useUWPLoopback'

const props = defineProps<{
  modelValue: boolean
  apps: UWPApp[]
  selectedSIDs: string[]
  loading: boolean
  saving: boolean
  hasChanges: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'toggle': [sid: string]
  'selectAll': []
  'deselectAll': []
  'save': []
}>()

const sortedApps = computed(() => {
  return [...props.apps].sort((a, b) => a.displayName.localeCompare(b.displayName))
})

const selectedCount = computed(() => props.selectedSIDs.length)
const totalCount = computed(() => props.apps.length)

watch(() => props.modelValue, (newVal) => {
  if (!newVal) {
    // Reset on close if no changes saved
  }
})
</script>

<template>
  <WModal
    :model-value="modelValue"
    @update:model-value="emit('update:modelValue', $event)"
    title="UWP LOOPBACK EXEMPTION"
    width="lg"
  >
    <div class="flex flex-col gap-4">
      <!-- Header with stats and actions -->
      <div class="flex items-center justify-between pb-3 border-b border-white/10">
        <div class="text-sm text-gray-400">
          Selected: <span class="text-white font-medium">{{ selectedCount }}</span> / {{ totalCount }}
        </div>
        <div class="flex gap-2">
          <WButton
            variant="secondary"
            size="sm"
            @click="emit('selectAll')"
            :disabled="loading || saving"
          >
            SELECT ALL
          </WButton>
          <WButton
            variant="secondary"
            size="sm"
            @click="emit('deselectAll')"
            :disabled="loading || saving"
          >
            DESELECT ALL
          </WButton>
        </div>
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="flex items-center justify-center py-12">
        <div class="flex flex-col items-center gap-3">
          <div class="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <div class="text-sm text-gray-400">Loading UWP applications...</div>
        </div>
      </div>

      <!-- App list -->
      <div v-else-if="apps.length > 0" class="max-h-64 overflow-y-auto custom-scrollbar">
        <div class="space-y-1">
          <div
            v-for="app in sortedApps"
            :key="app.sid"
            class="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer group"
            @click="emit('toggle', app.sid)"
          >
            <div class="flex-shrink-0">
              <div
                :class="[
                  'w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
                  selectedSIDs.includes(app.sid)
                    ? 'bg-blue-500 border-blue-500'
                    : 'border-gray-600 group-hover:border-gray-500'
                ]"
              >
                <i
                  v-if="selectedSIDs.includes(app.sid)"
                  class="fas fa-check text-white text-xs"
                ></i>
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-white truncate">
                {{ app.displayName }}
              </div>
              <div v-if="app.packageName" class="text-xs text-gray-500 truncate">
                {{ app.packageName }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else class="flex items-center justify-center py-12">
        <div class="text-center">
          <i class="fas fa-inbox text-4xl text-gray-600 mb-3"></i>
          <div class="text-sm text-gray-400">No UWP applications found</div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex gap-3 w-full">
        <WButton
          variant="secondary"
          class="flex-1"
          @click="emit('update:modelValue', false)"
          :disabled="saving"
        >
          CANCEL
        </WButton>
        <WButton
          variant="primary"
          class="flex-1"
          @click="emit('save')"
          :disabled="loading || saving || !hasChanges"
          :loading="saving"
        >
          {{ saving ? 'SAVING...' : 'SAVE' }}
        </WButton>
      </div>
    </template>
  </WModal>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>
