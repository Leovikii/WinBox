<script setup lang="ts">
import type { ComputedRef } from 'vue'

defineProps<{
  running: boolean
  coreExists: boolean
  msg: string
  tunMode: boolean
  sysProxy: boolean
  isProcessing: boolean
  activeProfile: any
  errorLog: string
  getStatusText: ComputedRef<string>
  getStatusGlow: ComputedRef<string>
  getControlBg: ComputedRef<string>
}>()

const emit = defineEmits<{
  'toggle': [target: 'tun' | 'proxy']
  'open-drawer': [drawer: 'settings' | 'profiles' | 'logs']
  'open-dashboard': []
  'quit': []
}>()
</script>

<template>
  <div class="w-full pt-4">
    <div class="text-[9px] font-bold text-[#444] mb-2 tracking-widest uppercase ml-1">Active Configuration</div>
    <div @click="emit('open-drawer', 'profiles')" class="w-full bg-[#131313] border border-[#222] rounded-2xl p-4 cursor-pointer group relative overflow-hidden h-20 flex items-center transition-all duration-300 hover:border-[#333] hover:shadow-[0_0_20px_rgba(255,255,255,0.03)] active:scale-[0.98]">
      <div class="flex justify-between items-center w-full z-10 relative">
        <div class="overflow-hidden mr-4">
          <div class="text-sm font-bold text-white mb-1 truncate">{{ activeProfile ? activeProfile.name : "Select Profile" }}</div>
          <div class="text-[10px] text-[#555] font-mono truncate group-hover:text-[#777] transition-colors">{{ activeProfile && activeProfile.updated ? `Updated: ${activeProfile.updated}` : "Tap to select" }}</div>
        </div>
        <div class="text-[#333] group-hover:text-blue-500 transition-colors duration-300"><i class="fas fa-chevron-down text-xs"></i></div>
      </div>
      <div v-if="running" class="absolute inset-0 bg-blue-500/5 animate-pulse pointer-events-none"></div>
    </div>
  </div>

  <div class="w-full flex-1 flex flex-col justify-center relative">
    <div :class="['w-full bg-[#111] border border-[#222] rounded-4xl p-8 flex flex-col gap-6 relative overflow-hidden transition-all duration-500', isProcessing ? 'opacity-80 pointer-events-none grayscale' : 'opacity-100']">
      <div :class="['absolute inset-0 blur-[60px] opacity-40 pointer-events-none transition-all duration-1000', getControlBg]"></div>
      <div class="text-center z-10 cursor-pointer" @click="() => { if (msg === 'ERROR' || errorLog) emit('open-drawer', 'logs') }">
        <div :class="['text-4xl font-black tracking-tighter transition-all duration-500 whitespace-nowrap', getStatusGlow]">{{ getStatusText }}</div>
        <div class="text-[9px] text-[#444] group-hover:text-[#666] font-mono uppercase tracking-widest mt-2 h-3 transition-colors">{{ msg === "ERROR" ? "VIEW ERROR LOGS" : msg }}</div>
      </div>
      <div class="h-px bg-[#222]/80 z-10 mx-auto w-[90%]"></div>
      <div class="flex flex-col gap-6 z-10 px-1">
        <!-- TUN MODE -->
        <div @click="emit('toggle', 'tun')" class="flex items-center justify-between cursor-pointer group select-none py-1">
          <div class="flex items-center gap-4">
            <div :class="['w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-sm transition-all duration-500', tunMode ? 'bg-blue-600 text-white shadow-[0_0_20px_2px_rgba(37,99,235,0.6)]' : 'bg-[#1a1a1a] text-[#444] group-hover:text-[#666] group-hover:bg-[#222]']">
              <i class="fas fa-shield-alt"></i>
            </div>
            <div class="flex flex-col min-w-0">
              <div :class="['text-xs font-bold tracking-wide transition-colors duration-300 whitespace-nowrap', tunMode ? 'text-white' : 'text-[#555] group-hover:text-gray-400']">TUN MODE</div>
              <div class="text-[9px] text-[#444] whitespace-nowrap group-hover:text-[#555] transition-colors">Virtual Network Interface</div>
            </div>
          </div>
          <div :class="['w-11 h-6 shrink-0 rounded-full transition-colors duration-300 relative', tunMode ? 'bg-blue-600' : 'bg-[#222] group-hover:bg-[#2a2a2a]']">
            <div :class="['absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-md', tunMode ? 'translate-x-5' : 'translate-x-0']"></div>
          </div>
        </div>
        <!-- SYSTEM PROXY -->
        <div @click="emit('toggle', 'proxy')" class="flex items-center justify-between cursor-pointer group select-none py-1">
          <div class="flex items-center gap-4">
            <div :class="['w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-sm transition-all duration-500', sysProxy ? 'bg-purple-600 text-white shadow-[0_0_20px_2px_rgba(147,51,234,0.6)]' : 'bg-[#1a1a1a] text-[#444] group-hover:text-[#666] group-hover:bg-[#222]']">
              <i class="fas fa-globe"></i>
            </div>
            <div class="flex flex-col min-w-0">
              <div :class="['text-xs font-bold tracking-wide transition-colors duration-300 whitespace-nowrap', sysProxy ? 'text-white' : 'text-[#555] group-hover:text-gray-400']">SYSTEM PROXY</div>
              <div class="text-[9px] text-[#444] whitespace-nowrap group-hover:text-[#555] transition-colors">Global HTTP Proxy</div>
            </div>
          </div>
          <div :class="['w-11 h-6 shrink-0 rounded-full transition-colors duration-300 relative', sysProxy ? 'bg-purple-600' : 'bg-[#222] group-hover:bg-[#2a2a2a]']">
            <div :class="['absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-md', sysProxy ? 'translate-x-5' : 'translate-x-0']"></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="w-full flex gap-3 z-10 pt-4">
    <button @click="emit('open-dashboard')" :disabled="!running" :class="['flex-1 h-12 rounded-xl text-xs font-bold tracking-wide border border-transparent transition-all duration-300 active:scale-95', running ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-[0_0_30px_rgba(37,99,235,0.4)]' : 'bg-[#1a1a1a] text-[#444] border-[#222] cursor-not-allowed']">DASHBOARD</button>
    <button @click="emit('open-drawer', 'logs')" :class="['w-12 h-12 rounded-xl border bg-[#1a1a1a] text-[#666] flex items-center justify-center transition-all duration-300 hover:bg-[#222] hover:text-white active:scale-95', msg === 'ERROR' ? 'border-red-500 text-red-500 bg-red-900/10 shadow-[0_0_15px_rgba(220,38,38,0.3)]' : 'border-[#222]']"><i class="fas fa-file-lines"></i></button>
    <button @click="emit('open-drawer', 'settings')" class="w-12 h-12 rounded-xl border border-[#222] bg-[#1a1a1a] text-[#666] flex items-center justify-center transition-all duration-300 hover:bg-[#222] hover:text-white active:scale-95"><i class="fas fa-cog"></i></button>
    <button @click="emit('quit')" class="w-12 h-12 rounded-xl border border-[#222] bg-[#1a1a1a] text-[#666] flex items-center justify-center transition-all duration-300 hover:border-red-900/50 hover:text-red-500 hover:bg-red-900/10 active:scale-95"><i class="fas fa-power-off"></i></button>
  </div>
</template>
