<script setup lang="ts">
import { WCapsuleSwitch, WButton } from './ui'

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
  hasDashboard: boolean
}>()

const emit = defineEmits<{
  'toggle-service': []
  'switch-mode': [{ tunMode: boolean, sysProxy: boolean }]
  'open-dashboard': []
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

      <div class="relative h-0">
        <Transition
          enter-active-class="transition-all duration-300"
          enter-from-class="opacity-0 scale-90"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition-all duration-200"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-90"
        >
          <div v-if="running && (tunMode || sysProxy) && !isProcessing && hasDashboard" class="absolute left-1/2 -translate-x-1/2 top-4">
            <WButton
              variant="link"
              size="sm"
              icon="fas fa-gauge"
              @click="emit('open-dashboard')"
            >
              DASHBOARD
            </WButton>
          </div>
        </Transition>
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