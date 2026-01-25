<script setup lang="ts">
import type { ComputedRef } from 'vue'
import { WButton, WIconButton, WSwitch, WDivider } from '@/components/ui'

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
  'toggle-service': []
  'open-drawer': [drawer: 'settings' | 'profiles' | 'logs']
  'open-dashboard': []
  'quit': []
}>()
</script>

<template>
  <div class="w-full pt-4">
    <div class="text-[9px] font-bold text-[#444] mb-2 tracking-widest uppercase ml-1">Active Configuration</div>
    <div @click="emit('open-drawer', 'profiles')" class="w-full bg-[#131313] border border-[#222] rounded-xl p-4 cursor-pointer group relative overflow-hidden h-20 flex items-center transition-all duration-300 hover:border-[#333] hover:shadow-[0_0_20px_rgba(255,255,255,0.03)] active:scale-[0.98]">
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
    <div :class="['w-full bg-[#111] border border-[#222] rounded-xl p-8 flex flex-col gap-6 relative overflow-hidden transition-opacity duration-500', isProcessing ? 'opacity-80 pointer-events-none grayscale' : 'opacity-100']">
      <div :class="['absolute inset-0 blur-[32px] opacity-40 pointer-events-none transition-opacity duration-1000', getControlBg]"></div>
      <!-- TUN Mode Glow -->
      <div v-if="tunMode" class="absolute inset-0 bg-(--accent-color)/10 blur-[40px] pointer-events-none transition-opacity duration-1000"></div>
      <!-- Proxy Mode Glow -->
      <div v-if="sysProxy" class="absolute inset-0 bg-(--accent-color)/10 blur-[40px] pointer-events-none transition-opacity duration-1000"></div>
      <div class="text-center z-10 cursor-pointer group relative" @click="() => { if (msg === 'ERROR' || errorLog) { emit('open-drawer', 'logs') } else { emit('toggle-service') } }">
        <!-- Hover Glow Effect -->
        <div :class="[
          'absolute inset-0 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none',
          (running && (tunMode || sysProxy)) ? 'bg-(--accent-color)/20' :
          running ? 'bg-emerald-500/20' :
          msg === 'ERROR' ? 'bg-red-500/20' :
          'bg-gray-500/20'
        ]"></div>
        <div :class="['text-4xl font-black tracking-tighter transition-transform duration-500 whitespace-nowrap relative z-10', getStatusGlow, 'group-hover:scale-105']">{{ getStatusText }}</div>
        <div class="text-[9px] text-[#444] group-hover:text-[#666] font-mono uppercase tracking-widest mt-2 h-3 transition-colors relative z-10">{{ msg === "ERROR" ? "VIEW ERROR LOGS" : (running ? "TAP TO STOP" : "TAP TO START") }}</div>
      </div>
      
      <WDivider class="mx-auto w-[90%]" />
      
      <div class="flex flex-col gap-6 z-10 px-1">
        <!-- TUN MODE -->
        <div @click="emit('toggle', 'tun')" class="flex items-center justify-between cursor-pointer group select-none py-1">
          <div class="flex items-center gap-4">
            <div :class="['w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-sm transition-colors duration-500', tunMode ? 'bg-(--accent-color) text-white shadow-[0_0_12px_1px_rgba(var(--accent-color-rgb),0.6)]' : 'bg-[#1a1a1a] text-[#444] group-hover:text-[#666] group-hover:bg-[#222]']">
              <i class="fas fa-shield-alt"></i>
            </div>
            <div class="flex flex-col min-w-0">
              <div :class="['text-xs font-bold tracking-wide transition-colors duration-300 whitespace-nowrap', tunMode ? 'text-white' : 'text-[#555] group-hover:text-gray-400']">TUN MODE</div>
              <div class="text-[9px] text-[#444] whitespace-nowrap group-hover:text-[#555] transition-colors">Virtual Network Interface</div>
            </div>
          </div>
          <WSwitch :model-value="tunMode" />
        </div>

        <!-- SYSTEM PROXY -->
        <div @click="emit('toggle', 'proxy')" class="flex items-center justify-between cursor-pointer group select-none py-1">
          <div class="flex items-center gap-4">
            <div :class="['w-10 h-10 shrink-0 rounded-xl flex items-center justify-center text-sm transition-colors duration-500', sysProxy ? 'bg-(--accent-color) text-white shadow-[0_0_12px_1px_rgba(var(--accent-color-rgb),0.6)]' : 'bg-[#1a1a1a] text-[#444] group-hover:text-[#666] group-hover:bg-[#222]']">
              <i class="fas fa-globe"></i>
            </div>
            <div class="flex flex-col min-w-0">
              <div :class="['text-xs font-bold tracking-wide transition-colors duration-300 whitespace-nowrap', sysProxy ? 'text-white' : 'text-[#555] group-hover:text-gray-400']">SYSTEM PROXY</div>
              <div class="text-[9px] text-[#444] whitespace-nowrap group-hover:text-[#555] transition-colors">Global HTTP Proxy</div>
            </div>
          </div>
          <WSwitch :model-value="sysProxy" />
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
