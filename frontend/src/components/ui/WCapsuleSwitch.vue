<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  tunMode: boolean
  sysProxy: boolean
  running: boolean
  isProcessing: boolean
}>()

const emit = defineEmits<{
  'click-left': []
  'click-center': []
  'click-right': []
}>()

const sliderPosition = computed(() => {
  if (!props.running) return 'center'
  if (props.tunMode && props.sysProxy) return 'center'
  if (props.tunMode) return 'left'
  if (props.sysProxy) return 'right'
  return 'center'
})

const sliderColor = computed(() => {
  if (!props.running) return 'bg-[#333] shadow-none'
  if (props.tunMode && props.sysProxy) return 'bg-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.6)]'
  if (props.tunMode) return 'bg-[#165E83] shadow-[0_0_20px_rgba(22,94,131,0.6)]'
  if (props.sysProxy) return 'bg-[#00896C] shadow-[0_0_20px_rgba(0,137,108,0.6)]'
  return 'bg-[#333]'
})
</script>

<template>
  <div class="w-full h-16 bg-[#0a0a0a] border border-[#222] rounded-full relative flex items-center p-1.5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] overflow-hidden select-none">
    
    <div 
      class="absolute left-6 text-xs font-bold tracking-widest text-[#555] transition-all duration-500 pointer-events-none z-0"
      :class="[
        sliderPosition === 'right' ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'
      ]"
    >
      SYS PROXY
    </div>

    <div 
      class="absolute right-6 text-xs font-bold tracking-widest text-[#555] transition-all duration-500 pointer-events-none z-0"
      :class="[
        sliderPosition === 'left' ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'
      ]"
    >
      TUN MODE
    </div>

    <div 
      class="absolute h-[calc(100%-12px)] rounded-full transition-all duration-500 cubic-bezier(0.2, 0.8, 0.2, 1) z-50 flex items-center justify-center cursor-pointer group"
      :class="[
        sliderColor,
        sliderPosition === 'left' ? 'w-1/3 left-1.5' : '',
        sliderPosition === 'right' ? 'w-1/3 left-[calc(66.66%-6px)]' : '',
        sliderPosition === 'center' ? 'w-1/3 left-[calc(33.33%-3px)]' : ''
      ]"
      @click.stop="!isProcessing && emit('click-center')"
    >
      <div class="w-8 h-1 bg-white/20 rounded-full group-hover:bg-white/40 transition-colors"></div>
      
      <div 
        class="absolute -bottom-6 text-[9px] font-bold tracking-widest text-white/40 whitespace-nowrap transition-all duration-300"
        :class="[
          running && tunMode && sysProxy ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
        ]"
      >
        FULL MODE
      </div>
    </div>

    <div class="absolute inset-0 flex z-10">
      <div class="flex-1 cursor-pointer" @click="!isProcessing && emit('click-left')"></div>
      <div class="flex-1 cursor-pointer" @click="!isProcessing && emit('click-center')"></div>
      <div class="flex-1 cursor-pointer" @click="!isProcessing && emit('click-right')"></div>
    </div>
  </div>
</template>