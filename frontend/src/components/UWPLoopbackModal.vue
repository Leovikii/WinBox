<script setup lang="ts">
import { computed, watch } from 'vue'
import { WModal, WButton, WScrollArea } from './ui'
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
    title="UWP Loopback Exemption"
    
  >
    <div class="flex flex-col gap-4">
      <!-- Header with stats and actions -->
      <div class="flex items-center justify-between pb-3 border-b border-black/10 dark:border-white/10">
        <div class="text-sm text-gray-900 dark:text-gray-200">
          Selected: <span class="text-gray-900 dark:text-white font-medium">{{ selectedCount }}</span> / {{ totalCount }}
        </div>
        <div class="flex gap-2">
          <WButton
            variant="secondary"
            size="sm"
            icon="fas fa-check-double"
            @click="emit('selectAll')"
            :disabled="loading || saving"
          >All</WButton>
          <WButton
            variant="secondary"
            size="sm"
            icon="fas fa-times"
            @click="emit('deselectAll')"
            :disabled="loading || saving"
          >None</WButton>
        </div>
      </div>

      <!-- Loading state -->
      <div v-if="loading" class="flex items-center justify-center py-12">
        <div class="flex flex-col items-center gap-3">
          <div class="w-8 h-8 border-2 border-[var(--accent-color)] border-t-transparent rounded-full animate-spin"></div>
          <div class="text-sm text-gray-900 dark:text-gray-200">Loading UWP applications...</div>
        </div>
      </div>

      <!-- App list -->
      <WScrollArea v-else-if="apps.length > 0" class="max-h-64">
        <div class="space-y-1">
          <div
            v-for="app in sortedApps"
            :key="app.sid"
            class="flex items-center gap-3 p-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer group"
            @click="emit('toggle', app.sid)"
          >
            <div class="shrink-0">
              <div
                :class="[
                  'w-5 h-5 rounded border-2 flex items-center justify-center transition-all',
                  selectedSIDs.includes(app.sid)
                    ? 'bg-[var(--accent-color)] border-[var(--accent-color)]'
                    : 'border-gray-300 dark:border-gray-600 group-hover:border-gray-400 dark:group-hover:border-gray-500'
                ]"
              >
                <i
                  v-if="selectedSIDs.includes(app.sid)"
                  class="fas fa-check text-white text-xs"
                ></i>
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-gray-800 dark:text-white truncate">
                {{ app.displayName }}
              </div>
              <div v-if="app.packageName" class="text-xs text-gray-500 truncate">
                {{ app.packageName }}
              </div>
            </div>
          </div>
        </div>
      </WScrollArea>

      <!-- Empty state -->
      <div v-else class="flex items-center justify-center py-12">
        <div class="text-center">
          <i class="fas fa-inbox text-4xl text-gray-300 dark:text-gray-600 mb-3"></i>
          <div class="text-sm text-gray-500 dark:text-gray-400">No UWP applications found</div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="flex items-center justify-end gap-3 w-full">
        <WButton
          variant="secondary"
          class="min-w-[80px]"
          @click="emit('update:modelValue', false)"
          :disabled="saving"
        >Cancel</WButton>
        <WButton
          variant="primary"
          class="min-w-[80px]"
          @click="emit('save')"
          :disabled="loading || saving || !hasChanges"
          :loading="saving"
        >
          {{ saving ? 'Saving...' : 'Save' }}
        </WButton>
      </div>
    </template>
  </WModal>
</template>

