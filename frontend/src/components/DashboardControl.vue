<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import * as Backend from '../../wailsjs/go/internal/App'
import { WButton, WSelect, WModal, WInput, WScrollArea, WSegmentedControl } from './ui'

interface Profile {
  name: string
  url: string
  updated: string
}

const props = defineProps<{
  running: boolean
  coreExists: boolean
  tunMode: boolean
  sysProxy: boolean
  isProcessing: boolean
  profilesState: any
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

const modeOptions = [
  { label: 'PROXY', value: 'proxy', color: '#10b981' }, // emerald
  { label: 'TUN', value: 'tun', color: '#3b82f6' }, // blue
  { label: 'FULL', value: 'full', color: '#d946ef' } // fuchsia
]

const currentMode = computed({
  get() {
    if (props.tunMode && props.sysProxy) return 'full'
    if (props.tunMode) return 'tun'
    return 'proxy'
  },
  set(val: string) {
    let tun = false
    let sys = false
    if (val === 'full') { tun = true; sys = true }
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
  return props.profilesState.activeProfile.value?.name || ''
})

const profileOptions = computed(() => {
  return props.profilesState.profiles.value.map((p: Profile) => ({
    label: p.name,
    value: p.name
  }))
})

const handleProfileChange = (val: string | number) => {
  if (props.isProcessing) return
  const p = props.profilesState.profiles.value.find((p: Profile) => p.name === val)
  if (p) {
    props.profilesState.switchProfile(p.id)
  }
}

const handleEdit = (e: any) => {
  const p = props.profilesState.activeProfile.value
  if (p) props.profilesState.editProfile(p.id, e)
}

const handleDelete = (e: any) => {
  const p = props.profilesState.activeProfile.value
  if (p) props.profilesState.deleteProfile(p.id, e)
}

// Log Viewer Logic
const appLogContent = ref("")
const showLogModal = ref(false)
const inlineLogContainer = ref<HTMLElement | null>(null)
const fullLogContainer = ref<HTMLElement | null>(null)
const copyState = ref("COPY")
let logInterval: any = null

const loadAppLog = async () => {
  try {
    const content = await Backend.GetAppLog()
    if (content !== appLogContent.value) {
      appLogContent.value = content
      nextTick(() => {
        if (inlineLogContainer.value) {
          inlineLogContainer.value.scrollTop = inlineLogContainer.value.scrollHeight
        }
        if (fullLogContainer.value && showLogModal.value) {
          fullLogContainer.value.scrollTop = fullLogContainer.value.scrollHeight
        }
      })
    }
  } catch (error) {
    appLogContent.value = "> Failed to load app log"
  }
}

const clearAppLog = async () => {
  const res = await Backend.ClearAppLog()
  if (res === "Success") {
    appLogContent.value = ""
    await loadAppLog()
  }
}

const copyAppLog = async () => {
  if (!appLogContent.value) return
  try {
    await navigator.clipboard.writeText(appLogContent.value)
    copyState.value = "COPIED!"
    setTimeout(() => {
      copyState.value = "COPY"
    }, 2000)
  } catch (err) {
    console.error('Failed to copy text: ', err)
  }
}

onMounted(() => {
  loadAppLog()
  logInterval = setInterval(loadAppLog, 1500)
})

onUnmounted(() => {
  if (logInterval) {
    clearInterval(logInterval)
  }
})
</script>

<template>
  <div class="w-full h-full flex flex-col justify-center gap-6 relative px-6 py-6 items-center overflow-hidden">
    
    <!-- ==================== TOP AREA: DISPLAY ==================== -->
    <div class="glass-card pointer-events-auto flex flex-col w-full max-w-[26rem] p-5 relative flex-1 min-h-0 z-10">
        <div class="text-[2.75rem] leading-none font-black tracking-tighter whitespace-nowrap transition-all duration-500 select-none mb-0 text-center" :style="getStatusStyle">
          {{ getStatusText }}
        </div>

        <!-- Speed Info (Fixed Height to prevent jumping) -->
        <div class="w-full h-6 mt-1">
          <div v-if="showSpeedInfo" class="flex items-center justify-center gap-6 h-full">
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
        </div>

        <!-- Inline Log Area (Skeuomorphic Monitor Style) -->
        <div class="w-full flex-1 min-h-0 mt-2 relative bg-[#050505] rounded-[10px] border border-[#1a1a1a] shadow-[inset_0_5px_20px_rgba(0,0,0,1)] overflow-hidden group">
          <!-- Screen Glare / Reflection -->
          <div class="absolute inset-0 pointer-events-none bg-gradient-to-tr from-transparent via-white/[0.01] to-white/[0.04]"></div>
          
          <!-- Maximize Button -->
          <button 
            @click="showLogModal = true"
            class="absolute top-2 right-2 w-6 h-6 rounded bg-white/5 hover:bg-white/10 text-white/30 hover:text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 z-10"
          >
            <i class="fas fa-expand text-[10px]"></i>
          </button>
          
          <!-- Log Content -->
          <WScrollArea class="w-full h-full p-4 text-[10px] font-mono leading-relaxed text-[#8b949e] break-all whitespace-pre-wrap select-text relative z-0" ref="inlineLogContainer">
            {{ appLogContent || 'No logs available.' }}
          </WScrollArea>
        </div>

    </div>

    <!-- ==================== BOTTOM AREA: CONTROLS ==================== -->
    <div class="glass-card pointer-events-auto flex flex-col w-full max-w-[26rem] p-4 relative flex-1 min-h-0 z-20 justify-between gap-1">
      
      <!-- Row 1: Profile Title & Add -->
      <div class="flex justify-between items-center shrink-0">
          <div class="flex items-center gap-3">
            <i class="fas fa-server text-[var(--accent-color)] w-4 text-center"></i>
            <span class="text-xs font-bold text-gray-400 tracking-wider">PROFILE</span>
          </div>
          <WButton 
            variant="secondary" 
            size="sm" 
            icon="fas fa-plus" 
            @click="profilesState.showAddProfileModal.value = true"
            :disabled="isProcessing"
          >
            ADD
          </WButton>
        </div>

      <!-- Row 2 & 3: Profile Selection, Actions & Mode -->
      <div v-if="profilesState.profiles.value.length > 0" class="grid grid-cols-3 gap-x-2 gap-y-3 flex-1 content-between">
          
          <!-- Select Dropdown (Col 1-2) -->
          <div class="col-span-2">
            <WSelect
              :modelValue="activeProfileName"
              @update:modelValue="handleProfileChange"
              :options="profileOptions"
              :disabled="isProcessing"
              class="w-full"
            />
          </div>
          
          <!-- Date Text (Col 3) -->
          <div class="col-span-1 flex justify-end items-center">
            <span class="text-[10px] text-gray-500 font-medium whitespace-nowrap text-right uppercase tracking-wide">
              {{ profilesState.activeProfile.value?.updated || 'NEVER UPDATED' }}
            </span>
          </div>

          <!-- Buttons -->
          <WButton 
            class="col-span-1 w-full"
            variant="secondary" 
            size="sm" 
            icon="fas fa-pen" 
            @click="handleEdit"
            :disabled="isProcessing || !profilesState.activeProfile.value"
          >
            EDIT
          </WButton>
          <WButton 
            class="col-span-1 w-full"
            variant="secondary" 
            size="sm" 
            icon="fas fa-rotate" 
            @click="profilesState.updateActive"
            :disabled="isProcessing || !profilesState.activeProfile.value || profilesState.isUpdatingProfile.value"
            :loading="profilesState.isUpdatingProfile.value"
          >
            UPDATE
          </WButton>
          <WButton 
            class="col-span-1 w-full"
            variant="danger" 
            size="sm" 
            icon="fas fa-trash" 
            @click="handleDelete"
            :disabled="isProcessing || !profilesState.activeProfile.value"
          >
            DELETE
          </WButton>

          <!-- Divider between row 2 and 3 -->
          <div class="col-span-3 h-[1px] bg-white/[0.05] my-1"></div>

          <!-- Mode Label (Col 1) -->
          <div class="col-span-1 flex items-center gap-3">
            <i class="fas fa-rocket text-[var(--accent-color)] w-4 text-center"></i>
            <span class="text-xs font-bold text-gray-400 tracking-wider">MODE</span>
          </div>

          <!-- Mode Dropdown (Col 2-3) -->
          <div class="col-span-2">
            <WSegmentedControl 
              v-model="currentMode" 
              :options="modeOptions" 
              :disabled="isProcessing"
              class="w-full" 
            />
          </div>

          <!-- Kernel Control Row -->
          <TransitionGroup 
            name="dock-btn" 
            tag="div" 
            class="col-span-3 flex justify-between gap-2 w-full relative h-9"
          >
            <WButton 
              v-if="running && hasDashboard"
              key="dashboard"
              class="w-[calc((100%-1rem)/3)] shrink-0 px-0"
              variant="secondary" 
              icon="fas fa-globe" 
              @click="emit('open-dashboard')"
              :disabled="isProcessing"
            >
              WEB UI
            </WButton>

            <WButton 
              key="power"
              variant="primary"
              class="transition-all duration-400 ease-out shrink-0 px-0"
              :class="running ? 'w-[calc((100%-1rem)/3)]' : 'absolute inset-0 w-full'"
              :loading="isProcessing"
              :disabled="!coreExists || !profilesState.activeProfile.value"
              @click="emit('toggle-service')"
              :style="{
                backgroundColor: running ? '#dc2626' : activeColor,
                borderColor: running ? '#ef4444' : activeColor,
                boxShadow: `0 4px 12px ${running ? '#dc262666' : activeColor + '66'}`
              }"
              :icon="running ? 'fas fa-square' : 'fas fa-power-off'"
            >
              {{ running ? 'STOP' : 'START' }}
            </WButton>

            <WButton 
              v-if="running"
              key="restart"
              class="w-[calc((100%-1rem)/3)] shrink-0 px-0"
              variant="secondary" 
              icon="fas fa-rotate-right" 
              @click="emit('restart-core')"
              :disabled="isProcessing"
            >
              RESTART
            </WButton>
          </TransitionGroup>

      </div>

      <!-- Empty State -->
      <div v-else class="flex-1 flex flex-col items-center justify-center text-center opacity-40 select-none">
        <i class="fa-solid fa-ghost text-4xl mb-3"></i>
        <p class="text-xs font-medium tracking-wide">No profiles yet.</p>
        <p class="text-[10px] mt-1">Click + ADD to start your journey.</p>
      </div>
      
    </div>

    <!-- Modals -->
    <WModal
      :model-value="profilesState.showAddProfileModal.value"
      @update:model-value="profilesState.showAddProfileModal.value = false"
      title="ADD PROFILE"
    >
      <div class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-gray-400 tracking-wider mb-2">NAME</label>
          <WInput
            v-model="profilesState.newName.value"
            placeholder="e.g. My Provider"
            @keyup.enter="profilesState.addProfile"
          />
        </div>
        <div>
          <label class="block text-xs font-bold text-gray-400 tracking-wider mb-2">SUBSCRIPTION URL</label>
          <WInput
            v-model="profilesState.newUrl.value"
            placeholder="https://..."
            @keyup.enter="profilesState.addProfile"
          />
        </div>
      </div>
      <template #footer>
        <div class="flex gap-3 w-full">
          <WButton variant="secondary" class="flex-1" @click="profilesState.showAddProfileModal.value = false" :disabled="profilesState.isAddingProfile.value">CANCEL</WButton>
          <WButton variant="primary" class="flex-1" @click="profilesState.addProfile" :loading="profilesState.isAddingProfile.value">ADD</WButton>
        </div>
      </template>
    </WModal>

    <WModal
      :model-value="profilesState.showEditProfileModal.value"
      @update:model-value="profilesState.showEditProfileModal.value = false"
      title="EDIT PROFILE"
    >
      <div class="space-y-4">
        <div>
          <label class="block text-xs font-bold text-gray-400 tracking-wider mb-2">NAME</label>
          <WInput
            v-model="profilesState.editName.value"
            placeholder="e.g. My Provider"
            @keyup.enter="profilesState.saveEditProfile"
          />
        </div>
        <div>
          <label class="block text-xs font-bold text-gray-400 tracking-wider mb-2">SUBSCRIPTION URL</label>
          <WInput
            v-model="profilesState.editUrl.value"
            placeholder="https://..."
            @keyup.enter="profilesState.saveEditProfile"
          />
        </div>
      </div>
      <template #footer>
        <div class="flex gap-3 w-full">
          <WButton variant="secondary" class="flex-1" @click="profilesState.showEditProfileModal.value = false" :disabled="profilesState.isEditingProfile.value">CANCEL</WButton>
          <WButton variant="primary" class="flex-1" @click="profilesState.saveEditProfile" :loading="profilesState.isEditingProfile.value">SAVE</WButton>
        </div>
      </template>
    </WModal>

    <WModal
      :model-value="profilesState.showDeleteConfirm.value"
      @update:model-value="profilesState.showDeleteConfirm.value = false"
      title="DELETE PROFILE"
    >
      <div class="text-sm text-gray-300">Are you sure you want to delete this profile? This cannot be undone.</div>
      <template #footer>
        <div class="flex gap-3 w-full">
          <WButton variant="secondary" class="flex-1" @click="profilesState.showDeleteConfirm.value = false">CANCEL</WButton>
          <WButton variant="danger" class="flex-1" @click="profilesState.confirmDelete">DELETE</WButton>
        </div>
      </template>
    </WModal>

    <!-- App Log Fullscreen Modal -->
    <Transition name="slide-fade">
      <div v-if="showLogModal" class="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
        <div class="w-full h-full max-w-4xl bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl flex flex-col relative overflow-hidden">
          <!-- Header -->
          <div class="h-14 flex items-center justify-between px-6 border-b border-white/5 shrink-0 bg-[#0f0f0f]">
            <div class="flex items-center gap-3">
              <i class="fas fa-file-lines text-[var(--accent-color)]"></i>
              <span class="text-sm font-bold tracking-widest text-gray-200">APP LOGS</span>
            </div>
            <button @click="showLogModal = false" class="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
              <i class="fas fa-xmark text-lg"></i>
            </button>
          </div>
          
          <!-- Content -->
          <WScrollArea class="flex-1 w-full h-full p-6 font-mono text-[11px] leading-relaxed text-gray-300 whitespace-pre-wrap break-all" ref="fullLogContainer">
            {{ appLogContent || 'No logs available.' }}
          </WScrollArea>

          <!-- Fixed Bottom Right Controls -->
          <div class="absolute bottom-6 right-6 flex items-center gap-3">
            <WButton variant="secondary" size="sm" icon="fas fa-trash" @click="clearAppLog">
              CLEAR
            </WButton>
            <WButton variant="primary" size="sm" :icon="copyState === 'COPIED!' ? 'fas fa-check' : 'fas fa-copy'" @click="copyAppLog" class="min-w-[90px]">
              {{ copyState }}
            </WButton>
          </div>
        </div>
      </div>
    </Transition>

  </div>
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

.glass-card {
  border-radius: 1rem;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.03) 100%);
  backdrop-filter: blur(20px);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.05);
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
