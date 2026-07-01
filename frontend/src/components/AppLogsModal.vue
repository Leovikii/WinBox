<template>
  <WModal
    :model-value="logState.showLogModal.value"
    @update:model-value="logState.showLogModal.value = $event"
    title="App logs"
    ref="fullLogContainer"
  >
    <div class="w-full h-[400px] bg-white dark:bg-[#050505] border border-black/10 dark:border-white/5 rounded-md relative overflow-hidden">
      <WScrollArea height="100%" class="w-full h-full" ref="logScrollbox">
        <div class="p-6 text-[11px] font-mono antialiased leading-relaxed text-[#8b949e] break-all whitespace-pre-wrap select-text min-h-full" v-text="logState.appLogContent.value || 'No logs available.'">
        </div>
      </WScrollArea>
    </div>
    
    <template #footer>
      <div class="flex items-center justify-end gap-3 w-full">
        <WButton variant="secondary" class="min-w-[80px]" @click="logState.clearAppLog">
          Clear
        </WButton>
        <WButton variant="primary" class="min-w-[80px]" @click="logState.copyAppLog">
          {{ logState.copyState.value === 'COPIED!' ? 'Copied!' : 'Copy' }}
        </WButton>
      </div>
    </template>
  </WModal>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { WModal, WScrollArea, WButton } from './ui'
import { useAppLogs } from '@/composables/useAppLogs'

const logState = useAppLogs()
const logScrollbox = ref<any>(null)

watch(() => logState.appLogContent.value, () => {
  if (logState.showLogModal.value && logScrollbox.value && logScrollbox.value.isAtBottom) {
    const wasAtBottom = logScrollbox.value.isAtBottom()
    if (wasAtBottom) {
      // Use a short timeout to let the DOM mutation and OverlayScrollbars update their internal sizes
      setTimeout(() => {
        if (logScrollbox.value) {
          logScrollbox.value.scrollToBottom()
        }
      }, 50)
    }
  }
})

// Scroll to bottom when modal opens
watch(() => logState.showLogModal.value, (newVal) => {
  if (newVal) {
    nextTick(() => {
      if (logScrollbox.value) {
        logScrollbox.value.scrollToBottom()
      }
    })
  }
})
</script>
