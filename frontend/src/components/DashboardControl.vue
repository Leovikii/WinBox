<script setup lang="ts">
import { WCapsuleSwitch } from './ui'

const props = defineProps<{
  running: boolean
  coreExists: boolean
  tunMode: boolean
  sysProxy: boolean
  isProcessing: boolean
  activeProfile: any
  getStatusText: string
  getStatusStyle: { color: string; filter: string }
  localVer: string
  accentColor: string
}>()

const emit = defineEmits<{
  'toggle-service': []
  'switch-mode': [{ tunMode: boolean, sysProxy: boolean }]
}>()
</script>

<template>
  <div class="w-full h-full flex flex-col items-center relative pb-28">
    <div class="flex-1"></div>

    <div class="relative z-10 pointer-events-auto flex flex-col items-center">
      <div
        class="text-5xl font-black tracking-tighter whitespace-nowrap transition-all duration-500 select-none mb-5"
        :style="getStatusStyle"
      >
        {{ getStatusText }}
      </div>

      <div class="flex flex-col gap-2.5 w-auto">
        <div class="flex items-center justify-between gap-8 group cursor-default">
          <span class="text-[10px] text-white/25 uppercase tracking-[0.15em] font-medium transition-colors duration-200 group-hover:text-white/40">Kernel Version</span>
          <span
            class="text-[10px] uppercase tracking-[0.15em] font-medium transition-all duration-200 group-hover:brightness-110"
            :style="{ color: accentColor }"
          >
            {{ localVer || 'Not Installed' }}
          </span>
        </div>

        <div class="flex items-center justify-between gap-8 group cursor-default">
          <span class="text-[10px] text-white/25 uppercase tracking-[0.15em] font-medium transition-colors duration-200 group-hover:text-white/40">Active Profile</span>
          <span
            class="text-[10px] uppercase tracking-[0.15em] font-medium transition-all duration-200 group-hover:brightness-110"
            :style="{ color: accentColor }"
          >
            {{ activeProfile?.name || 'No Profile Selected' }}
          </span>
        </div>
      </div>
    </div>

    <div class="flex-1"></div>

    <div class="w-full px-8 max-w-sm z-20 relative">
      <WCapsuleSwitch
        :tun-mode="tunMode"
        :sys-proxy="sysProxy"
        :running="running"
        :is-processing="isProcessing"
        @switch-mode="(target) => emit('switch-mode', target)"
      />
    </div>

    <div class="flex-1"></div>
  </div>
</template>