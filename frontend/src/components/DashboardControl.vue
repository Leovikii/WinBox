<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, onActivated, nextTick } from 'vue'
import * as Backend from '../../wailsjs/go/internal/App'
import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime'
import { WButton, WSelect, WModal, WInput, WScrollArea, WSegmentedControl, WSpeedChart } from './ui'
import ManageProfilesModal from './ManageProfilesModal.vue'
import AppLogsModal from './AppLogsModal.vue'

import { useAppState } from '../composables/useAppState'
import { useProfiles } from '../composables/useProfiles'
import { useAppLogs } from '@/composables/useAppLogs'
import { useTheme } from '../composables/useTheme'

interface Profile {
  name: string
  url: string
  updated: string
}

const appState = useAppState()
const profilesState = useProfiles()
const logState = useAppLogs()
const themeState = useTheme()

const {
  running, coreExists, tunMode, sysProxy, isProcessing, msg, errorLog,
  getStatusText, getStatusStyle, getControlBg, handleServiceToggle
} = appState

const { accentColor } = themeState

const props = defineProps<{
  hasDashboard: boolean
  uploadSpeed: number
  downloadSpeed: number
}>()

const emit = defineEmits<{
  'switch-mode': [{ tunMode: boolean, sysProxy: boolean }]
  'open-dashboard': []
  'restart-core': []
  'open-settings': []
}>()

const formatSpeed = (bytesPerSecond: number): string => {
  if (bytesPerSecond < 1024) return `${bytesPerSecond} B/s`
  const kbps = bytesPerSecond / 1024
  if (kbps < 1024) return `${kbps.toFixed(1)} KB/s`
  const mbps = kbps / 1024
  return `${mbps.toFixed(2)} MB/s`
}

const showSpeedInfo = computed(() => {
  return running.value && (tunMode.value || sysProxy.value) && !isProcessing.value
})

const modeOptions = [
  { label: 'Proxy', value: 'proxy', color: '#10b981' }, // emerald
  { label: 'Tun', value: 'tun', color: '#3b82f6' }, // blue
  { label: 'Mixed', value: 'mixed', color: '#d946ef' } // fuchsia
]

const currentMode = computed({
  get() {
    if (tunMode.value && sysProxy.value) return 'mixed'
    if (tunMode.value) return 'tun'
    return 'proxy'
  },
  set(val: string) {
    let tun = false
    let sys = false
    if (val === 'mixed') { tun = true; sys = true }
    else if (val === 'tun') { tun = true }
    else if (val === 'proxy') { sys = true }
    emit('switch-mode', { tunMode: tun, sysProxy: sys })
  }
})

const activeColor = computed(() => {
  const opt = modeOptions.find(o => o.value === currentMode.value)
  return opt?.color || '#3b82f6'
})

const activeProfileName = computed(() => {
  return profilesState.activeProfile.value?.name || ''
})

const profileOptions = computed(() => {
  return profilesState.profiles.value.map((p: Profile) => ({
    label: p.name,
    value: p.name
  }))
})

const handleProfileChange = (val: string | number) => {
  if (isProcessing.value) return
  const p = profilesState.profiles.value.find((p: Profile) => p.name === val)
  if (p) {
    profilesState.switchProfile(p.id)
  }
}


const formattedUpdatedTime = computed(() => {
  const updatedStr = profilesState.activeProfile.value?.updated
  if (!updatedStr) return 'Never'
  
  const updatedDate = new Date(updatedStr)
  if (isNaN(updatedDate.getTime())) return updatedStr

  const now = new Date()
  const diffSecs = Math.floor((now.getTime() - updatedDate.getTime()) / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return 'Just now'
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? 's' : ''} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  
  return updatedStr.split(' ')[0]
})



// Log Viewer Logic
const inlineLogContainer = ref<any>(null)

const openFullLog = () => {
  logState.showLogModal.value = true
}

onMounted(() => {
  logState.initLogs()
})

// Only scroll inline log on activation or log updates
watch(() => logState.appLogContent.value, () => {
  nextTick(() => {
    if (inlineLogContainer.value) {
      const el = inlineLogContainer.value.$el || inlineLogContainer.value
      const scrollEl = el.querySelector('.simplebar-content-wrapper') || el
      if (scrollEl) {
        const isAtBottom = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight < 50
        if (isAtBottom) {
          inlineLogContainer.value.scrollToBottom()
        }
      }
    }
  })
})

onUnmounted(() => {
})

onActivated(() => {
  nextTick(() => {
    if (inlineLogContainer.value) {
      inlineLogContainer.value.scrollToBottom()
    }
  })
})
</script>

<template>
  <div class="w-full h-full flex flex-col gap-6 relative px-6 py-6 items-center overflow-hidden">
    
    <!-- ==================== AREA 1: INFO ==================== -->
    <div 
      class="bg-[#fdfdfd] dark:bg-[#2a2a2a] border border-black/10 dark:border-white/5 shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] rounded-lg pointer-events-auto flex flex-col w-full max-w-[26rem] relative z-10 transition-all duration-500 overflow-hidden shrink-0"
      :class="running ? 'h-[calc((100%-4.5rem)/4)] p-6 pb-2 opacity-100' : 'h-[58px] px-6 py-4 opacity-100'"
    >
        <!-- Header: Status & Speed -->
        <div class="shrink-0 flex justify-between bg-transparent" :class="running ? 'pb-2 items-start' : 'items-center'">
          <!-- Left: Icon + Status -->
          <div class="flex items-center gap-3" :class="running ? 'mt-1' : ''" :style="getStatusStyle">
            <!-- Icon with Hardware LED Bloom -->
            <div class="relative flex items-center justify-center w-4">
              <!-- Ambient background bloom -->
              <div 
                class="absolute inset-0 scale-[3] blur-[6px] transition-opacity duration-1000 pointer-events-none"
                :class="{'opacity-40': running || ['Starting...', 'Stopping...'].includes(getStatusText), 'opacity-0': !running && !['Starting...', 'Stopping...'].includes(getStatusText)}"
                style="background-color: currentColor;"
              ></div>
              <!-- Core Icon -->
              <i class="fas text-[11px] relative z-10 transition-all duration-500" 
                 :class="{
                   'fa-spinner fa-spin drop-shadow-[0_0_6px_currentColor]': ['Starting...', 'Stopping...'].includes(getStatusText),
                   'fa-bolt drop-shadow-[0_0_6px_currentColor]': running && !['Starting...', 'Stopping...'].includes(getStatusText),
                   'fa-exclamation-triangle': getStatusText === 'Warning',
                   'fa-power-off opacity-60': !running && !['Starting...', 'Stopping...'].includes(getStatusText) && getStatusText !== 'Warning'
                 }">
              </i>
            </div>
            <span class="text-sm font-semibold relative z-10 capitalize">{{ getStatusText.toLowerCase() }}</span>
          </div>

          <!-- Right: Speed or Idle -->
          <Transition name="fade" mode="out-in">
            <div v-if="running && showSpeedInfo" class="flex items-center justify-center w-24 h-9 shrink-0 text-gray-900 dark:text-gray-200 group hover:bg-black/5 dark:hover:bg-white/5 rounded-md transition-colors cursor-default -mt-2">
              <div class="grid grid-cols-[12px_1fr] gap-x-1 gap-y-[2px] w-full px-2 items-center">
                <i class="fas fa-arrow-up text-[9px] speed-upload opacity-50 justify-self-center"></i>
                <span class="text-[10px] font-mono antialiased font-semibold tracking-wide speed-upload text-right">{{ formatSpeed(uploadSpeed) }}</span>
                
                <i class="fas fa-arrow-down text-[9px] speed-download opacity-50 justify-self-center"></i>
                <span class="text-[10px] font-mono antialiased font-semibold tracking-wide speed-download text-right">{{ formatSpeed(downloadSpeed) }}</span>
              </div>
            </div>
            <div v-else-if="!running" class="flex items-center justify-center w-7 h-7 rounded shrink-0 text-gray-400 dark:text-gray-500 hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-default" title="Idle">
              <i class="fas fa-link-slash text-[10px]"></i>
            </div>
          </Transition>
        </div>
        
        <!-- Placeholder for Speed Chart -->
        <div class="w-full flex-1 min-h-0 relative bg-transparent pointer-events-none transition-opacity duration-300" :class="running ? 'opacity-100' : 'opacity-0'">
          <WSpeedChart 
            v-if="running"
            :upload-speed="uploadSpeed"
            :download-speed="downloadSpeed"
          />
        </div>
    </div>

    <!-- ==================== AREA 2: PROFILE ==================== -->
    <div 
      class="bg-[#fdfdfd] dark:bg-[#2a2a2a] border border-black/10 dark:border-white/5 shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] rounded-lg pointer-events-auto flex flex-col w-full max-w-[26rem] relative z-20 justify-between transition-all duration-500 overflow-hidden shrink-0"
      :class="!running ? 'h-[calc((100%-4.5rem)/4)] p-6 opacity-100' : 'h-[58px] px-6 py-4 opacity-100'"
    >
      <template v-if="profilesState.profiles.value.length > 0">
        <!-- Row 1: Profile Title & Global Actions (Dynamic based on running) -->
        <div class="flex items-center justify-between shrink-0 w-full gap-2">
            <div class="flex items-center gap-2 justify-start shrink-0">
              <i class="fas fa-server text-[var(--accent-color)] w-4 text-center"></i>
              <span class="text-sm font-semibold text-gray-900 dark:text-gray-200">Profile</span>
            </div>
            
            <!-- When collapsed (running): show mini dropdown -->
            <Transition name="fade" mode="out-in">
              <div v-if="running" class="flex-1 max-w-[150px]">
                <WSelect
                  :modelValue="activeProfileName"
                  @update:modelValue="handleProfileChange"
                  :options="profileOptions"
                  :disabled="isProcessing"
                  class="w-full !min-h-[26px] text-xs"
                />
              </div>
              <!-- When expanded (!running): show MANAGE button -->
              <div v-else>
                <WButton 
                  variant="secondary" 
                  size="sm" 
                  class="w-7 !px-0"
                  icon="fas fa-sliders" 
                  @click="profilesState.openManageProfiles"
                  :disabled="isProcessing"
                  title="Manage Profiles"
                />
              </div>
            </Transition>
        </div>

        <!-- Row 2: Profile Selection & Actions (Visible only when NOT running) -->
        <div class="flex gap-2 w-full mt-3 transition-opacity duration-300" :class="!running ? 'opacity-100' : 'opacity-0 pointer-events-none'">
          <!-- Left: Dropdown -->
          <div class="flex-1 min-w-0">
            <WSelect
              :modelValue="activeProfileName"
              @update:modelValue="handleProfileChange"
              :options="profileOptions"
              :disabled="isProcessing"
              class="w-full"
            />
          </div>

          <!-- Right: Action Buttons -->
          <div class="flex gap-2 shrink-0">
            <!-- Update Button (with Date) -->
            <WButton 
              variant="secondary" 
              size="sm" 
              icon="fas fa-rotate" 
              @click="profilesState.updateActive"
              :disabled="isProcessing || !profilesState.activeProfile.value || profilesState.isUpdatingProfile.value"
              :loading="profilesState.isUpdatingProfile.value"
              title="Update"
            >
              {{ formattedUpdatedTime }}
            </WButton>
          </div>
        </div>
      </template>

      <!-- Empty Profile State -->
      <div v-else class="flex-1 flex flex-col items-center justify-center text-center select-none" :class="!coreExists ? 'opacity-30' : 'opacity-100'">
        <i class="fa-solid fa-server text-2xl mb-3 text-gray-400"></i>
        <p class="text-sm font-semibold text-gray-400" :class="coreExists ? 'mb-4' : ''">No profile found</p>
        <WButton 
          v-if="coreExists"
          variant="secondary" 
          size="sm" 
          @click="profilesState.openManageProfiles"
        >
          Add Profile
        </WButton>
      </div>
    </div>

    <!-- ==================== AREA 3: CORE CONTROLS ==================== -->
    <div class="bg-[#fdfdfd] dark:bg-[#2a2a2a] border border-black/10 dark:border-white/5 shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] rounded-lg pointer-events-auto flex flex-col w-full max-w-[26rem] p-6 relative z-20 justify-between shrink-0 h-[calc((100%-4.5rem)/4)]">
      <template v-if="profilesState.profiles.value.length > 0">

          <!-- Row 3: Mode -->
          <div class="flex gap-2 w-full items-center mb-6">
            <div class="w-1/3 flex items-center gap-3">
              <i class="fas fa-rocket text-[var(--accent-color)] w-4 text-center"></i>
              <span class="text-sm font-semibold text-gray-900 dark:text-gray-200">Mode</span>
            </div>
            <div class="w-2/3">
              <WSegmentedControl 
                v-model="currentMode" 
                :options="modeOptions" 
                :disabled="isProcessing"
                class="w-full" 
              />
            </div>
          </div>

          <!-- Row 6: Kernel Control Row -->
          <TransitionGroup 
            name="dock-btn" 
            tag="div" 
            class="flex justify-between gap-2 w-full relative h-9"
          >
            <WButton 
              v-if="running && hasDashboard"
              key="dashboard"
              class="w-[calc((100%_-_1rem)_/_3)] shrink-0 px-0 whitespace-nowrap"
              variant="secondary" 
              icon="fas fa-globe" 
              @click="emit('open-dashboard')"
              :disabled="isProcessing"
            >
              Web UI
            </WButton>

            <WButton 
              key="power"
              variant="primary"
              class="transition-all duration-400 ease-out shrink-0 px-0 whitespace-nowrap"
              :class="running ? 'w-[calc((100%_-_1rem)_/_3)]' : 'absolute inset-0 w-full'"
              :loading="isProcessing"
              :disabled="!coreExists || !profilesState.activeProfile.value"
              @click="handleServiceToggle"
              :style="{
                backgroundColor: running ? '#dc2626' : activeColor,
                borderColor: running ? '#ef4444' : activeColor,
                boxShadow: `0 4px 12px ${running ? '#dc262666' : activeColor + '66'}`
              }"
              :icon="(getStatusText === 'Starting...' || getStatusText === 'Stopping...') ? 'fas fa-spinner fa-spin' : (running ? 'fas fa-square' : 'fas fa-power-off')"
            >
              {{ running ? (getStatusText === 'Stopping...' ? 'Stopping' : 'Stop') : (getStatusText === 'Starting...' ? 'Starting' : 'Start') }}
            </WButton>

            <WButton 
              v-if="running"
              key="restart"
              class="w-[calc((100%_-_1rem)_/_3)] shrink-0 px-0 whitespace-nowrap"
              variant="secondary" 
              :icon="getStatusText === 'Restarting...' ? 'fas fa-spinner fa-spin' : 'fas fa-rotate-right'" 
              @click="emit('restart-core')"
              :disabled="isProcessing"
            >
              Restart
            </WButton>
          </TransitionGroup>
      </template>

      <!-- Empty State -->
      <div v-else class="flex-1 flex flex-col items-center justify-center text-center select-none" :class="!coreExists ? 'opacity-100' : 'opacity-30'">
        <template v-if="!coreExists">
          <i class="fa-solid fa-download text-2xl mb-3 text-gray-400"></i>
          <p class="text-sm font-semibold text-gray-400 mb-4">Kernel missing</p>
          <WButton variant="secondary" size="sm" @click="emit('open-settings')">Install kernel</WButton>
        </template>
        <template v-else>
          <i class="fa-solid fa-lock text-2xl mb-3 text-gray-400"></i>
          <p class="text-sm font-semibold text-gray-400">Profile required</p>
        </template>
      </div>
      
    </div>

    <!-- ==================== AREA 4: LOGS ==================== -->
    <div class="bg-[#fdfdfd] dark:bg-[#2a2a2a] border border-black/10 dark:border-white/5 shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] rounded-lg pointer-events-auto flex flex-col w-full max-w-[26rem] relative z-10 overflow-hidden flex-1 min-h-0">
        
        <!-- Header: Logs & Expand -->
        <div class="shrink-0 flex justify-between items-center p-6 pb-3 bg-transparent">
          <div class="flex items-center gap-3">
            <i class="fas fa-file-lines text-[var(--accent-color)] w-4 text-center"></i>
            <span class="text-sm font-semibold text-gray-900 dark:text-gray-200">Logs</span>
          </div>
          <!-- Maximize Button -->
          <WButton 
            variant="secondary"
            size="sm"
            class="w-7 !px-0"
            icon="fas fa-expand text-[10px]"
            @click="openFullLog"
            title="Expand Logs"
          />
        </div>

        <!-- Inline Log Area (Seamless) -->
        <div class="w-full flex-1 min-h-0 relative bg-transparent">
          <!-- Log Content -->
          <div class="absolute inset-0">
            <WScrollArea height="100%" class="w-full relative z-0" ref="inlineLogContainer">
              <div class="px-6 pb-6 pt-0 text-[10px] font-mono antialiased leading-relaxed text-[#8b949e] break-all whitespace-pre-wrap select-text">
                {{ logState.appLogContent.value || 'No logs available.' }}
              </div>
            </WScrollArea>
          </div>
        </div>
    </div>

  </div>

    <!-- Modals -->
    <ManageProfilesModal />

    <!-- App Log Modal -->
    <!-- App Log Modal -->
    <AppLogsModal />
</template>

<style scoped>
.hide-scrollbar {
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.hide-scrollbar::-webkit-scrollbar {
  display: none;
}

.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.slide-fade-enter-from,
.slide-fade-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(10px);
}



.expandable-content {
  overflow: hidden;
  transition: max-height 0.4s ease-out, opacity 0.4s ease-out;
}

.speed-upload {
  color: #10b981;
}

.speed-download {
  color: #3b82f6;
}

/* Dock Button Transitions */
.dock-btn-move,
.dock-btn-enter-active,
.dock-btn-leave-active {
  transition: all 0.4s cubic-bezier(0.25, 1, 0.5, 1);
}
.dock-btn-leave-active {
  position: absolute;
}
.dock-btn-enter-from,
.dock-btn-leave-to {
  opacity: 0;
  transform: scale(0.8) translateY(10px);
}
</style>
