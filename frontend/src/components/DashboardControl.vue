<script setup lang="ts">
import { WButton, WIconButton, WDivider } from '@/components/ui'

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
</script>

<template>
  <div class="w-full pt-4">
    <div class="text-[9px] font-bold text-[#444] mb-2 tracking-widest uppercase ml-1">Active Configuration</div>
    <div @click="emit('open-drawer', 'profiles')" class="w-full bg-[#131313] border border-[#222] rounded-xl p-4 cursor-pointer group relative overflow-hidden h-20 flex items-center transition-all duration-300 hover:border-[#333] hover:shadow-[0_0_20px_rgba(255,255,255,0.03)] active:scale-[0.98] hover:-translate-y-0.5">
      <div class="flex justify-between items-center w-full z-10 relative">
        <div class="overflow-hidden mr-4">
          <div class="text-sm font-bold text-white mb-1 truncate">{{ activeProfile ? activeProfile.name : "Select Profile" }}</div>
          <div class="text-[10px] text-[#555] font-mono truncate group-hover:text-[#777] transition-colors">{{ activeProfile && activeProfile.updated ? `Updated: ${activeProfile.updated}` : "Tap to select" }}</div>
        </div>
        <div class="text-[#333] group-hover:text-(--accent-color) transition-colors duration-300"><i class="fas fa-chevron-down text-xs"></i></div>
      </div>
    </div>
  </div>

  <div class="w-full flex-1 flex flex-col justify-center relative">
    <div :class="['w-full bg-[#111] border border-[#222] rounded-xl p-8 flex flex-col gap-6 relative overflow-hidden transition-opacity duration-300', isProcessing ? 'opacity-80 pointer-events-none grayscale' : 'opacity-100']">
      <div class="text-center z-10 cursor-pointer group relative" @click="() => { if (msg === 'ERROR' || errorLog) { emit('open-drawer', 'logs') } else { emit('toggle-service') } }">
        <div :class="['text-4xl font-black tracking-tighter whitespace-nowrap relative z-10 transition-all duration-300 group-hover:scale-[1.02]', running ? '[text-shadow:0_0_20px_currentColor,0_0_10px_currentColor]' : '']" :style="getStatusStyle">{{ getStatusText }}</div>
        <div class="text-[9px] text-[#444] group-hover:text-[#666] font-mono uppercase tracking-widest mt-2 h-3 transition-colors duration-200 relative z-10">{{ msg === "ERROR" ? "VIEW ERROR LOGS" : (running ? "TAP TO STOP" : "TAP TO START") }}</div>
      </div>
      
      <WDivider class="mx-auto w-[90%]" />
      
      <div class="flex flex-col gap-6 z-10 px-1">
        <div @click="emit('toggle', 'tun')" class="flex items-center justify-between cursor-pointer group select-none py-1">
          <div class="flex items-center gap-4">
            <div :class="['w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-sm transition-colors duration-200', tunMode ? 'bg-[#165E83] text-white shadow-[0_0_12px_1px_rgba(22,94,131,0.6)]' : 'bg-[#1a1a1a] text-[#444] group-hover:text-[#666] group-hover:bg-[#222]']">
              <i class="fas fa-shield-alt"></i>
            </div>
            <div class="flex flex-col min-w-0">
              <div :class="['text-xs font-bold tracking-wide transition-colors duration-200 whitespace-nowrap', tunMode ? 'text-[#89C3EB]' : 'text-[#555] group-hover:text-gray-400']">TUN MODE</div>
              <div class="text-[9px] text-[#444] whitespace-nowrap group-hover:text-[#555] transition-colors duration-200">Virtual Network Interface</div>
            </div>
          </div>
          <div class="rounded-full p-0.5 cursor-pointer transition-colors duration-200 relative w-11 h-6" :class="tunMode ? 'bg-[#165E83]' : 'bg-[#2a2a2a]'">
            <div class="bg-white rounded-full transition-transform duration-200 shadow-lg absolute top-1 left-1 w-4 h-4" :class="tunMode ? 'translate-x-5' : 'translate-x-0'"></div>
          </div>
        </div>

        <div @click="emit('toggle', 'proxy')" class="flex items-center justify-between cursor-pointer group select-none py-1">
          <div class="flex items-center gap-4">
            <div :class="['w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-sm transition-colors duration-200', sysProxy ? 'bg-[#00896C] text-white shadow-[0_0_12px_1px_rgba(0,137,108,0.6)]' : 'bg-[#1a1a1a] text-[#444] group-hover:text-[#666] group-hover:bg-[#222]']">
              <i class="fas fa-globe"></i>
            </div>
            <div class="flex flex-col min-w-0">
              <div :class="['text-xs font-bold tracking-wide transition-colors duration-200 whitespace-nowrap', sysProxy ? 'text-[#7EBEAB]' : 'text-[#555] group-hover:text-gray-400']">SYSTEM PROXY</div>
              <div class="text-[9px] text-[#444] whitespace-nowrap group-hover:text-[#555] transition-colors duration-200">Global HTTP Proxy</div>
            </div>
          </div>
          <div class="rounded-full p-0.5 cursor-pointer transition-colors duration-200 relative w-11 h-6" :class="sysProxy ? 'bg-[#00896C]' : 'bg-[#2a2a2a]'">
            <div class="bg-white rounded-full transition-transform duration-200 shadow-lg absolute top-1 left-1 w-4 h-4" :class="sysProxy ? 'translate-x-5' : 'translate-x-0'"></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="w-full flex gap-3 z-10 pt-4">
    <WButton
      variant="primary"
      size="lg"
      class="flex-2"
      :disabled="!running"
      @click="emit('open-dashboard')"
    >
      DASHBOARD
    </WButton>

    <WIconButton
      icon="fas fa-file-lines"
      size="lg"
      class="flex-1"
      :variant="msg === 'ERROR' ? 'danger' : 'default'"
      @click="emit('open-drawer', 'logs')"
    />

    <WIconButton
      icon="fas fa-cog"
      size="lg"
      class="flex-1"
      @click="emit('open-drawer', 'settings')"
    />
  </div>
</template>
