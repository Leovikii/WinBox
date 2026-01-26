<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  tunMode: boolean
  sysProxy: boolean
  running: boolean
  isProcessing: boolean
}>()

const emit = defineEmits<{
  'switch-mode': [{ tunMode: boolean, sysProxy: boolean }]
}>()

const sliderColor = '#2a2a2a'
const sliderShadow = '0 4px 12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15), inset 0 -2px 8px rgba(0,0,0,0.4)'

const sliderPosition = computed(() => {
  if (!props.running) return 'center'
  if (props.tunMode && props.sysProxy) return 'center'
  if (props.tunMode) return 'left'
  if (props.sysProxy) return 'right'
  return 'center'
})

const lightBarColor = computed(() => {
  if (!props.running) return 'rgba(255,255,255,0.2)'
  if (props.tunMode && props.sysProxy) return 'rgba(200,130,255,1)'
  if (props.tunMode) return 'rgba(100,180,230,1)'
  if (props.sysProxy) return 'rgba(80,220,180,1)'
  return 'rgba(255,255,255,0.2)'
})

const lightBarGlow = computed(() => {
  if (!props.running) return 'none'
  if (props.tunMode && props.sysProxy) {
    return '0 0 12px rgba(200,130,255,0.9), 0 0 24px rgba(200,130,255,0.5), inset 0 0 6px rgba(255,255,255,0.6)'
  }
  if (props.tunMode) {
    return '0 0 12px rgba(100,180,230,0.9), 0 0 24px rgba(100,180,230,0.5), inset 0 0 6px rgba(255,255,255,0.6)'
  }
  if (props.sysProxy) {
    return '0 0 12px rgba(80,220,180,0.9), 0 0 24px rgba(80,220,180,0.5), inset 0 0 6px rgba(255,255,255,0.6)'
  }
  return 'none'
})

function handleClick(area: 'left' | 'center' | 'right') {
  if (props.isProcessing) return

  let targetTun = props.tunMode
  let targetProxy = props.sysProxy

  if (!props.running) {
    if (area === 'left') {
      targetTun = true
      targetProxy = false
    } else if (area === 'center') {
      targetTun = true
      targetProxy = true
    } else if (area === 'right') {
      targetTun = false
      targetProxy = true
    }
  } else if (props.tunMode && props.sysProxy) {
    if (area === 'left') {
      targetTun = true
      targetProxy = false
    } else if (area === 'center') {
      targetTun = false
      targetProxy = false
    } else if (area === 'right') {
      targetTun = false
      targetProxy = true
    }
  } else if (props.tunMode && !props.sysProxy) {
    if (area === 'left') {
      targetTun = true
      targetProxy = true
    } else if (area === 'center') {
      targetTun = false
      targetProxy = false
    } else if (area === 'right') {
      targetTun = false
      targetProxy = true
    }
  } else if (!props.tunMode && props.sysProxy) {
    if (area === 'left') {
      targetTun = true
      targetProxy = false
    } else if (area === 'center') {
      targetTun = false
      targetProxy = false
    } else if (area === 'right') {
      targetTun = true
      targetProxy = true
    }
  }

  emit('switch-mode', { tunMode: targetTun, sysProxy: targetProxy })
}
</script>

<template>
  <div
    class="w-full h-16 rounded-full relative flex items-center p-1.5 overflow-visible select-none transition-all duration-300"
    :class="isProcessing ? 'opacity-50' : 'opacity-100'"
    style="
      background: #0f0f0f;
      border: 1px solid #2a2a2a;
      box-shadow:
        inset 0 2px 8px rgba(0,0,0,0.8),
        0 2px 12px rgba(0,0,0,0.5);
    "
  >

    
    <div
      class="absolute h-[calc(100%-12px)] rounded-full transition-all duration-500 ease-out z-50 flex items-center justify-center pointer-events-none"
      :class="[
        sliderPosition === 'left' ? 'w-1/3 left-1.5' : '',
        sliderPosition === 'right' ? 'w-1/3 left-[calc(66.66%-6px)]' : '',
        sliderPosition === 'center' ? 'w-1/3 left-[calc(33.33%-3px)]' : ''
      ]"
      :style="{
        background: `linear-gradient(180deg, #3a3a3a 0%, ${sliderColor} 50%, #1a1a1a 100%)`,
        boxShadow: sliderShadow
      }"
    >
      
      <div
        class="w-12 h-1.5 rounded-full transition-all duration-500 relative overflow-hidden"
        :style="{
          backgroundColor: lightBarColor,
          boxShadow: lightBarGlow
        }"
      >
        
        <div
          v-if="running"
          class="absolute inset-0 bg-linear-to-r from-transparent via-white/30 to-transparent"
        ></div>
      </div>

      
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
      
      <div
        class="flex-1 cursor-pointer flex flex-col items-center justify-center gap-1 transition-all duration-300 rounded-l-full group relative"
        :class="[
          isProcessing ? 'opacity-50 cursor-not-allowed' : ''
        ]"
        @click="handleClick('left')"
      >
        <i class="fas fa-network-wired text-sm text-[#165E83]/70 group-hover:text-[#165E83] group-hover:scale-110 transition-all duration-300"></i>
        <span class="text-[8px] font-bold tracking-wider text-[#165E83]/50 group-hover:text-[#165E83] transition-all duration-300">TUN</span>
      </div>

      
      <div
        class="flex-1 cursor-pointer flex flex-col items-center justify-center gap-1 transition-all duration-300 group relative"
        :class="[
          isProcessing ? 'opacity-50 cursor-not-allowed' : ''
        ]"
        @click="handleClick('center')"
      >
        <i
          :class="[
            running ? 'fas fa-power-off' : 'fas fa-bolt',
            'text-sm transition-all duration-300',
            running ? 'text-red-500/70 group-hover:text-red-500 group-hover:scale-110' : 'text-purple-500/70 group-hover:text-purple-500 group-hover:scale-110'
          ]"
        ></i>
        <span
          class="text-[8px] font-bold tracking-wider transition-all duration-300"
          :class="[
            running ? 'text-red-500/50 group-hover:text-red-500' : 'text-purple-500/50 group-hover:text-purple-500'
          ]"
        >
          {{ running ? 'STOP' : 'FULL' }}
        </span>
      </div>

      
      <div
        class="flex-1 cursor-pointer flex flex-col items-center justify-center gap-1 transition-all duration-300 rounded-r-full group relative"
        :class="[
          isProcessing ? 'opacity-50 cursor-not-allowed' : ''
        ]"
        @click="handleClick('right')"
      >
        <i class="fas fa-globe text-sm text-[#00896C]/70 group-hover:text-[#00896C] group-hover:scale-110 transition-all duration-300"></i>
        <span class="text-[8px] font-bold tracking-wider text-[#00896C]/50 group-hover:text-[#00896C] transition-all duration-300">PROXY</span>
      </div>
    </div>
  </div>
</template>
