<script setup lang="ts">
import { computed } from 'vue'
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
  accentColor: string
  hasDashboard: boolean
  uploadSpeed: number
  downloadSpeed: number
}>()

const emit = defineEmits<{
  'toggle-service': []
  'switch-mode': [{ tunMode: boolean, sysProxy: boolean }]
  'open-dashboard': []
  'restart-core': []
}>()

const formatSpeed = (bytesPerSecond: number): string => {
  if (bytesPerSecond < 1024) return `${bytesPerSecond} B/s`
  const kbps = bytesPerSecond / 1024
  if (kbps < 1024) return `${kbps.toFixed(1)} KB/s`
  const mbps = kbps / 1024
  return `${mbps.toFixed(2)} MB/s`
}

const showSpeedInfo = computed(() => {
  return props.running && (props.tunMode || props.sysProxy) && !props.isProcessing
})
</script>

<template>
  <div class="w-full h-full flex flex-col items-center relative">
    <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full px-8 max-w-sm z-20">
      <WCapsuleSwitch
        :tun-mode="tunMode"
        :sys-proxy="sysProxy"
        :running="running"
        :is-processing="isProcessing"
        @switch-mode="(target) => emit('switch-mode', target)"
      />
    </div>

    <div class="absolute left-1/2 info-card pointer-events-auto" style="top: 12%; transform: translateX(-50%);">
      <div class="fixed-content">
        <div
          class="text-5xl font-black tracking-tighter whitespace-nowrap transition-all duration-500 select-none text-center mb-4"
          :style="getStatusStyle"
        >
          {{ getStatusText }}
        </div>

        <div class="profile-section">
          <span class="text-[10px] text-white/40 uppercase tracking-wider font-medium">
            Current Profile
          </span>
          <span class="text-xs font-semibold uppercase tracking-wide" :style="{ color: accentColor }">
            {{ activeProfile?.name || 'N/A' }}
          </span>
        </div>
      </div>

      <Transition
        enter-active-class="transition-all duration-400 ease-out"
        enter-from-class="max-h-0 opacity-0"
        enter-to-class="max-h-40 opacity-100"
        leave-active-class="transition-all duration-300 ease-in"
        leave-from-class="max-h-40 opacity-100"
        leave-to-class="max-h-0 opacity-0"
      >
        <div v-if="showSpeedInfo" class="expandable-content">
          <div class="flex items-center justify-center gap-6 py-2">
            <div class="flex items-center gap-2">
              <i class="fas fa-arrow-up text-xs speed-upload"></i>
              <span class="text-xs font-mono font-medium tracking-wide speed-upload">
                {{ formatSpeed(uploadSpeed) }}
              </span>
            </div>

            <div class="flex items-center gap-2">
              <i class="fas fa-arrow-down text-xs speed-download"></i>
              <span class="text-xs font-mono font-medium tracking-wide speed-download">
                {{ formatSpeed(downloadSpeed) }}
              </span>
            </div>
          </div>

          <div v-if="hasDashboard" class="flex items-center justify-between gap-2 pt-1">
            <WButton
              variant="link"
              size="sm"
              icon="fas fa-gauge"
              @click="emit('open-dashboard')"
              class="flex-1"
            >
              DASHBOARD
            </WButton>
            <WButton
              variant="link"
              size="sm"
              icon="fas fa-rotate-right"
              @click="emit('restart-core')"
              class="flex-1"
            >
              RESTART
            </WButton>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.info-card {
  width: auto;
  min-width: 320px;
  max-width: 400px;
  border-radius: 1rem;
  padding: 1.5rem 1.5rem 0.5rem;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.03) 100%);
  backdrop-filter: blur(20px);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.fixed-content {
  position: relative;
}

.profile-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 0;
}

.expandable-content {
  overflow: hidden;
  transition: max-height 0.4s ease-out, opacity 0.4s ease-out;
  padding-bottom: 0.5rem;
}

.speed-upload {
  color: #10b981;
}

.speed-download {
  color: #3b82f6;
}
</style>
