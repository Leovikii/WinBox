<template>
  <WModal
    :model-value="logState.showLogModal.value"
    @update:model-value="logState.showLogModal.value = $event"
    title="App logs"
    ref="fullLogContainer"
  >
    <div class="w-full h-[400px] bg-white dark:bg-[#050505] border border-black/10 dark:border-white/5 rounded-md relative overflow-hidden">
      <WScrollArea height="100%" class="w-full h-full" ref="logScrollbox">
        <div class="w-full font-mono antialiased text-[11px] leading-relaxed text-gray-900 dark:text-gray-300 whitespace-pre-wrap break-all p-4 select-text">
          {{ logState.appLogContent.value || 'No logs available.' }}
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

// Auto scroll to bottom when new logs arrive and modal is open
watch(() => logState.appLogContent.value, () => {
  if (logState.showLogModal.value) {
    nextTick(() => {
      if (logScrollbox.value) {
        // Only scroll if already near bottom to not interrupt user reading
        const el = logScrollbox.value.$el || logScrollbox.value
        const scrollEl = el.querySelector('.simplebar-content-wrapper') || el
        if (scrollEl) {
          const isAtBottom = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < 50
          if (isAtBottom) {
            logScrollbox.value.scrollToBottom()
          }
        }
      }
    })
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
