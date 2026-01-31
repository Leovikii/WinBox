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

const sliderStyle = computed(() => {
  const padding = '6px'
  const widthCalc = `calc((100% - 12px) / 3)`
  
  let leftCalc = padding
  
  let position = 'center'
  if (!props.running) position = 'center'
  else if (props.tunMode && props.sysProxy) position = 'center'
  else if (props.tunMode) position = 'left'
  else if (props.sysProxy) position = 'right'

  if (position === 'center') {
    leftCalc = `calc(${padding} + ${widthCalc})`
  } else if (position === 'right') {
    leftCalc = `calc(${padding} + ${widthCalc} * 2)`
  }

  return {
    width: widthCalc,
    left: leftCalc,
  }
})

const ledState = computed(() => {
  if (!props.running) {
    return {
      color: '#333333',
      shadow: 'inset 0 1px 3px rgba(0,0,0,0.8), 0 1px 0 rgba(255,255,255,0.1)',
      opacity: 0.5
    }
  }
  if (props.tunMode && props.sysProxy) {
    return {
      color: '#a855f7',
      shadow: '0 0 10px #a855f7, 0 0 20px rgba(168, 85, 247, 0.6), inset 0 1px 4px rgba(255,255,255,0.9)',
      opacity: 1
    }
  }
  if (props.tunMode) {
    return {
      color: '#3b82f6',
      shadow: '0 0 10px #3b82f6, 0 0 20px rgba(59, 130, 246, 0.6), inset 0 1px 4px rgba(255,255,255,0.9)',
      opacity: 1
    }
  }
  if (props.sysProxy) {
    return {
      color: '#10b981',
      shadow: '0 0 10px #10b981, 0 0 20px rgba(16, 185, 129, 0.6), inset 0 1px 4px rgba(255,255,255,0.9)',
      opacity: 1
    }
  }
  return {
    color: '#333333',
    shadow: 'inset 0 1px 3px rgba(0,0,0,0.8)',
    opacity: 0.5
  }
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
    class="w-full h-16 rounded-full relative flex items-center p-1.5 select-none transition-all duration-300"
    :class="isProcessing ? 'opacity-60 grayscale' : 'opacity-100'"
    style="
      background: #111111;
      box-shadow: 
        inset 0 2px 5px rgba(0,0,0,0.9), 
        inset 0 10px 20px rgba(0,0,0,0.5), 
        0 1px 0 rgba(255,255,255,0.08);
      border-bottom: 1px solid rgba(255,255,255,0.05);
    "
  >
    <div class="absolute inset-0 flex z-10 p-1.5 items-center">
      <div
        class="flex-1 h-full cursor-pointer flex flex-col items-center justify-center gap-1 transition-all duration-300 group rounded-l-full"
        @click="handleClick('left')"
      >
        <i
          class="fas fa-network-wired text-sm transition-all duration-300 relative"
          :class="[
            tunMode ? 'text-[#3b82f6]' : 'text-[#444] group-hover:text-[#666]'
          ]"
          :style="tunMode ? 'text-shadow: 0 0 10px rgba(59, 130, 246, 0.6)' : 'text-shadow: 0 1px 1px rgba(0,0,0,0.8), 0 -1px 0 rgba(0,0,0,0.5)'"
        ></i>
        <span
          class="text-[9px] font-black tracking-widest transition-all duration-300"
          :class="[
            tunMode ? 'text-[#3b82f6]' : 'text-[#333] group-hover:text-[#444]'
          ]"
          style="text-shadow: 0 1px 1px rgba(255,255,255,0.03), 0 -1px 1px rgba(0,0,0,0.8);"
        >TUN</span>
      </div>

      <div
        class="flex-1 h-full cursor-pointer flex flex-col items-center justify-center gap-1 transition-all duration-300 group"
        @click="handleClick('center')"
      >
        <i
          :class="[
            running ? 'fas fa-power-off' : 'fas fa-bolt',
            'text-sm transition-all duration-300 relative',
            running
              ? (tunMode && sysProxy ? 'text-[#a855f7] scale-110' : 'text-red-500')
              : 'text-[#444] group-hover:text-[#666]'
          ]"
          :style="running
            ? (tunMode && sysProxy
                ? 'text-shadow: 0 0 12px rgba(168, 85, 247, 0.8)'
                : 'text-shadow: 0 0 8px rgba(239, 68, 68, 0.5)')
            : 'text-shadow: 0 1px 1px rgba(0,0,0,0.8), 0 -1px 0 rgba(0,0,0,0.5)'"
        ></i>
        <span
          class="text-[9px] font-black tracking-widest transition-all duration-300"
          :class="[
             running
              ? (tunMode && sysProxy ? 'text-[#a855f7]' : 'text-red-500/70')
              : 'text-[#333] group-hover:text-[#444]'
          ]"
          style="text-shadow: 0 1px 1px rgba(255,255,255,0.03), 0 -1px 1px rgba(0,0,0,0.8);"
        >
          {{ running ? 'STOP' : 'FULL' }}
        </span>
      </div>

      <div
        class="flex-1 h-full cursor-pointer flex flex-col items-center justify-center gap-1 transition-all duration-300 group rounded-r-full"
        @click="handleClick('right')"
      >
        <i
          class="fas fa-globe text-sm transition-all duration-300 relative"
          :class="[
            sysProxy ? 'text-[#10b981]' : 'text-[#444] group-hover:text-[#666]'
          ]"
          :style="sysProxy ? 'text-shadow: 0 0 10px rgba(16, 185, 129, 0.6)' : 'text-shadow: 0 1px 1px rgba(0,0,0,0.8), 0 -1px 0 rgba(0,0,0,0.5)'"
        ></i>
        <span
          class="text-[9px] font-black tracking-widest transition-all duration-300"
          :class="[
            sysProxy ? 'text-[#10b981]' : 'text-[#333] group-hover:text-[#444]'
          ]"
          style="text-shadow: 0 1px 1px rgba(255,255,255,0.03), 0 -1px 1px rgba(0,0,0,0.8);"
        >PROXY</span>
      </div>
    </div>

    <div
      class="absolute h-[calc(100%-12px)] rounded-full z-20 flex items-center justify-center transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1) pointer-events-none"
      :style="{
        background: `linear-gradient(180deg, #323232 0%, #262626 50%, #1a1a1a 100%)`,
        boxShadow: `0 4px 8px rgba(0,0,0,0.6), 0 1px 2px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.12), inset 0 0 2px rgba(255,255,255,0.03)`,
        borderTop: `1px solid #3e3e3e`,
        borderBottom: `1px solid #111`,
        width: sliderStyle.width,
        left: sliderStyle.left
      }"
    >
      <div
        class="w-10 h-1.5 rounded-full relative overflow-hidden transition-all duration-300 z-10"
        :style="{
          backgroundColor: ledState.color,
          boxShadow: ledState.shadow,
          opacity: ledState.opacity
        }"
      >
        <div class="absolute inset-0 bg-white/20 blur-[1px]"></div>
      </div>
    </div>

  </div>
</template>