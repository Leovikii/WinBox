<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, onActivated, nextTick } from 'vue'
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
const inlineLogContainer = ref<any>(null)
const fullLogContainer = ref<any>(null)
const copyState = ref("COPY")
let logInterval: any = null

const scrollToBottom = () => {
  nextTick(() => {
    if (inlineLogContainer.value) inlineLogContainer.value.scrollToBottom()
    if (fullLogContainer.value && showLogModal.value) fullLogContainer.value.scrollToBottom()
  })
}

const loadAppLog = async () => {
  try {
    const content = await Backend.GetAppLog()
    if (content !== appLogContent.value) {
      appLogContent.value = content
      scrollToBottom()
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
  scrollToBottom()
  logInterval = setInterval(loadAppLog, 1500)
})

onUnmounted(() => {
  if (logInterval) {
    clearInterval(logInterval)
  }
})

onActivated(() => {
  scrollToBottom()
})
</script>

<template>
  <div class="w-full h-full flex flex-col justify-center gap-6 relative px-6 py-6 items-center overflow-hidden">
    
    <!-- ==================== TOP AREA: DISPLAY ==================== -->
    <div class="glass-card pointer-events-auto flex flex-col w-full max-w-[26rem] relative flex-1 min-h-0 z-10 overflow-hidden">
        
        <!-- Header: Status & Speed -->
        <div class="h-11 shrink-0 flex justify-between items-center px-4 border-b border-white/5 bg-linear-to-b from-white/[0.03] to-transparent">
          <!-- Left: Icon + Status -->
          <div class="flex items-center gap-2" :style="getStatusStyle">
            <!-- Icon with Hardware LED Bloom -->
            <div class="relative flex items-center justify-center">
              <!-- Ambient background bloom -->
              <div 
                class="absolute inset-0 scale-[3] blur-[6px] transition-opacity duration-1000 pointer-events-none"
                :class="{'opacity-40': running || getStatusText.includes('ING'), 'opacity-0': !running && !getStatusText.includes('ING')}"
                style="background-color: currentColor;"
              ></div>
              <!-- Core Icon -->
              <i class="fas text-[11px] relative z-10 transition-all duration-500" 
                 :class="{
                   'fa-spinner fa-spin drop-shadow-[0_0_6px_currentColor]': getStatusText.includes('ING'),
                   'fa-bolt drop-shadow-[0_0_6px_currentColor]': running && !getStatusText.includes('ING'),
                   'fa-power-off opacity-60': !running && !getStatusText.includes('ING')
                 }">
              </i>
            </div>
            <span class="text-sm font-bold tracking-widest uppercase relative z-10 ml-1">{{ getStatusText }}</span>
          </div>

          <!-- Right: Speed -->
          <div class="flex items-center gap-4">
            <div v-if="showSpeedInfo" class="flex items-center gap-3">
              <div class="flex items-center gap-1.5 opacity-90">
                <i class="fas fa-arrow-up text-[10px] speed-upload"></i>
                <span class="text-[11px] font-mono font-medium tracking-wider speed-upload">{{ formatSpeed(uploadSpeed) }}</span>
              </div>
              <div class="flex items-center gap-1.5 opacity-90">
                <i class="fas fa-arrow-down text-[10px] speed-download"></i>
                <span class="text-[11px] font-mono font-medium tracking-wider speed-download">{{ formatSpeed(downloadSpeed) }}</span>
              </div>
            </div>
            <div v-else class="text-[10px] font-mono font-medium text-gray-600 tracking-widest uppercase">
              IDLE
            </div>
          </div>
        </div>

        <!-- Inline Log Area (Seamless) -->
        <div class="w-full flex-1 min-h-0 relative group bg-transparent">
          <!-- Maximize Button -->
          <button 
            @click="showLogModal = true"
            class="absolute top-2 right-2 w-6 h-6 rounded bg-white/5 hover:bg-white/10 text-gray-500 hover:text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 z-10 backdrop-blur-md shadow-sm"
          >
            <i class="fas fa-expand text-[10px]"></i>
          </button>
          
          <!-- Log Content -->
          <div class="absolute inset-0">
            <WScrollArea height="100%" class="w-full p-4 text-[10px] font-mono leading-relaxed text-[#8b949e] break-all whitespace-pre-wrap select-text relative z-0" ref="inlineLogContainer">
              {{ appLogContent || 'No logs available.' }}
            </WScrollArea>
          </div>
        </div>
    </div>

    <!-- ==================== BOTTOM AREA: CONTROLS ==================== -->
    <div class="glass-card pointer-events-auto flex flex-col w-full max-w-[26rem] p-5 relative flex-1 min-h-0 z-20 justify-between">
      
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

      <!-- Row 2 to 6: Configs -->
      <template v-if="profilesState.profiles.value.length > 0">
          
          <!-- Row 2: Select & Date -->
          <div class="flex gap-2 w-full">
            <div class="w-2/3">
              <WSelect
                :modelValue="activeProfileName"
                @update:modelValue="handleProfileChange"
                :options="profileOptions"
                :disabled="isProcessing"
                class="w-full"
              />
            </div>
            <div class="w-1/3 flex justify-end items-center">
              <span class="text-[10px] text-gray-500 font-medium whitespace-nowrap text-right uppercase tracking-wide">
                {{ profilesState.activeProfile.value?.updated || 'NEVER UPDATED' }}
              </span>
            </div>
          </div>

          <!-- Row 3: Buttons -->
          <div class="flex gap-2 w-full">
            <WButton 
              class="flex-1"
              variant="secondary" 
              size="sm" 
              icon="fas fa-pen" 
              @click="handleEdit"
              :disabled="isProcessing || !profilesState.activeProfile.value"
            >
              EDIT
            </WButton>
            <WButton 
              class="flex-1"
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
              class="flex-1"
              variant="danger" 
              size="sm" 
              icon="fas fa-trash" 
              @click="handleDelete"
              :disabled="isProcessing || !profilesState.activeProfile.value"
            >
              DELETE
            </WButton>
          </div>

          <!-- Divider (Row 4) -->
          <div class="w-full h-[1px] bg-white/[0.05]"></div>

          <!-- Row 5: Mode -->
          <div class="flex gap-2 w-full">
            <div class="w-1/3 flex items-center gap-3">
              <i class="fas fa-rocket text-[var(--accent-color)] w-4 text-center"></i>
              <span class="text-xs font-bold text-gray-400 tracking-wider">MODE</span>
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
              :icon="(getStatusText === 'STARTING...' || getStatusText === 'STOPPING...') ? 'fas fa-spinner fa-spin' : (running ? 'fas fa-square' : 'fas fa-power-off')"
            >
              {{ running ? (getStatusText === 'STOPPING...' ? 'STOPPING' : 'STOP') : (getStatusText === 'STARTING...' ? 'STARTING' : 'START') }}
            </WButton>

            <WButton 
              v-if="running"
              key="restart"
              class="w-[calc((100%-1rem)/3)] shrink-0 px-0"
              variant="secondary" 
              :icon="getStatusText === 'RESTARTING...' ? 'fas fa-spinner fa-spin' : 'fas fa-rotate-right'" 
              @click="emit('restart-core')"
              :disabled="isProcessing"
            >
              RESTART
            </WButton>
          </TransitionGroup>
      </template>

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
    <Transition name="w-modal">
      <div v-if="showLogModal" class="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
        <div class="w-full h-full max-w-4xl mica-card border border-[#333] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] flex flex-col relative overflow-hidden w-modal-container">
          <!-- Header -->
          <div class="h-10 shrink-0 flex justify-between items-center px-4 border-b border-[#2a2a2a] bg-linear-to-b from-[#1a1a1a]/40 to-transparent">
            <div class="flex items-center gap-2">
              <i class="fas fa-file-lines text-[var(--accent-color)] text-xs"></i>
              <h2 class="text-xs font-bold text-[#888] uppercase tracking-widest">APP LOGS</h2>
            </div>
            <button @click="showLogModal = false" class="text-[#888] hover:text-white transition-colors shrink-0 ml-4">
              <i class="fas fa-times"></i>
            </button>
          </div>
          
          <!-- Content -->
          <WScrollArea height="100%" class="flex-1 w-full p-5 font-mono text-[11px] leading-relaxed text-gray-300 whitespace-pre-wrap break-all" ref="fullLogContainer">
            {{ appLogContent || 'No logs available.' }}
          </WScrollArea>

          <!-- Fixed Bottom Right Controls -->
          <div class="absolute bottom-5 right-5 flex items-center gap-3">
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
  background: #1c1c1c; /* Solid WinUI 3 card */
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
