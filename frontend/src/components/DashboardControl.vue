<script setup lang="ts">
import * as Backend from '../../wailsjs/go/internal/App'
import { WCapsuleSwitch } from './ui'

defineProps<{
  running: boolean
  coreExists: boolean
  msg: string
  tunMode: boolean
  sysProxy: boolean
  isProcessing: boolean
  activeProfile: any
  errorLog: string
  getStatusText: string
  getStatusStyle: { color: string; filter: string }
  getControlBg: string
}>()

const emit = defineEmits<{
  'toggle': [target: 'tun' | 'proxy']
  'toggle-service': []
  'open-drawer': [drawer: 'settings' | 'profiles' | 'logs']
  'open-dashboard': []
  'quit': []
}>()

const handleLeftClick = () => {
  Backend.ApplyState(true, false)
}

const handleRightClick = () => {
  Backend.ApplyState(false, true)
}

const handleCenterClick = (running: boolean) => {
  if (running) {
    emit('toggle-service')
  } else {
    Backend.ApplyState(true, true)
  }
}
</script>

<template>
  <div class="w-full h-full flex flex-col items-center justify-center relative pb-32">
    
    <div class="flex flex-col items-center justify-center mb-16 relative z-10 pointer-events-none">
      <div 
        class="text-6xl font-black tracking-tighter whitespace-nowrap transition-all duration-500 select-none flex flex-col items-center pointer-events-auto" 
        :style="getStatusStyle"
      >
        {{ getStatusText }}
      </div>
      
      <div class="text-[10px] font-mono tracking-[0.4em] text-white/30 mt-6 uppercase h-4">
        {{ msg === 'ERROR' ? 'Check Logs' : (running ? 'Active Service' : 'Ready to Connect') }}
      </div>
    </div>

    <div class="w-full px-8 max-w-sm z-20 relative">
      <WCapsuleSwitch
        :tun-mode="tunMode"
        :sys-proxy="sysProxy"
        :running="running"
        :is-processing="isProcessing"
        @click-left="handleLeftClick"
        @click-right="handleRightClick"
        @click-center="() => handleCenterClick(running)"
      />
    </div>

  </div>
</template>