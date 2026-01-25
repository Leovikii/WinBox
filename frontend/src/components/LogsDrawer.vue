<script setup lang="ts">
import { ref } from 'vue'

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
  <div :class="['absolute inset-x-0 bottom-0 top-10 z-60 bg-[#090909]/95 backdrop-blur-3xl flex flex-col transition-transform duration-500', isOpen ? 'translate-y-0' : 'translate-y-full']">
    <div class="h-12 border-b border-[#222] flex items-center justify-between px-6">
      <h2 class="text-xs font-bold text-[#666] uppercase tracking-widest">LOGS</h2>
      <button @click="emit('close')" class="h-7 px-3 rounded-lg text-[11px] font-bold bg-[#1a1a1a] border border-[#333] text-gray-300 hover:bg-[#222] transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95">CLOSE</button>
    </div>
    <div class="flex-1 overflow-y-auto p-6 bg-[#050505] custom-scrollbar [&::-webkit-scrollbar]:hidden">
      <pre class="text-[10px] text-gray-400 font-mono whitespace-pre-wrap break-all">{{ errorLog || "No logs." }}</pre>
    </div>
    <div class="p-4 border-t border-[#222] flex justify-end">
      <button @click="copyLog" :class="['h-7 px-3 rounded-lg text-[11px] font-bold transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95', copyState === 'COPIED!' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-[#1a1a1a] border border-[#333] text-gray-300 hover:bg-[#222]']">{{ copyState }}</button>
    </div>
  </div>
</template>
