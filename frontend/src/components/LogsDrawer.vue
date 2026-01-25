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
  <div :class="['absolute inset-x-0 bottom-0 top-10 z-60 flex flex-col transition-transform duration-500', isOpen ? 'translate-y-0' : 'translate-y-full']">
    <!-- Fixed backdrop-filter background layer -->
    <div class="absolute inset-0 bg-[#090909]/95 backdrop-blur-[24px] pointer-events-none"></div>

    <div class="relative h-12 border-b border-[#222] flex items-center justify-between px-6">
      <h2 class="text-xs font-bold text-[#666] uppercase tracking-widest">LOGS</h2>
      <WButton variant="secondary" size="sm" @click="emit('close')">CLOSE</WButton>
    </div>
    <div class="relative flex-1 overflow-y-auto p-6 bg-[#050505] custom-scrollbar [&::-webkit-scrollbar]:hidden">
      <pre class="text-[10px] text-gray-400 font-mono whitespace-pre-wrap break-all">{{ errorLog || "No logs." }}</pre>
    </div>
    <div class="relative p-4 border-t border-[#222] flex justify-end">
      <WButton
        :variant="copyState === 'COPIED!' ? 'success' : 'secondary'"
        size="sm"
        @click="copyLog"
      >
        {{ copyState }}
      </WButton>
    </div>
  </div>
</template>
