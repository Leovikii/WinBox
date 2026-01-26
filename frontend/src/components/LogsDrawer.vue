<script setup lang="ts">
import { ref } from 'vue'
import { WButton } from '@/components/ui'

const props = defineProps<{
  isOpen: boolean
  errorLog: string
}>()

const emit = defineEmits<{
  close: []
}>()

const copyState = ref("COPY")

const copyLog = () => {
  navigator.clipboard.writeText(props.errorLog)
  copyState.value = "COPIED!"
  setTimeout(() => copyState.value = "COPY", 2000)
}
</script>

<template>
  <div class="w-full h-full flex flex-col bg-[#090909]">
    <div class="h-16 shrink-0 flex items-center justify-between px-6 border-b border-[#222]/50">
      <h2 class="text-xs font-bold text-[#555] uppercase tracking-[0.2em]">Runtime Logs</h2>
    </div>
    
    <div class="flex-1 overflow-y-auto p-4 pb-28 custom-scrollbar [&::-webkit-scrollbar]:hidden">
      <pre class="text-[10px] text-gray-400 font-mono whitespace-pre-wrap break-all leading-relaxed">{{ errorLog || "> No active logs available." }}</pre>
    </div>

    <div class="absolute bottom-24 right-4 z-10">
      <WButton
        :variant="copyState === 'COPIED!' ? 'success' : 'secondary'"
        size="sm"
        class="shadow-lg backdrop-blur-md bg-[#222]/80"
        @click="copyLog"
      >
        {{ copyState }}
      </WButton>
    </div>
  </div>
</template>