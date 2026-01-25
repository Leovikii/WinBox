<script setup lang="ts">
import { ref } from 'vue'
import { WButton, WSwitch, WSelect, WCard, WExpandable, WModal, WTextarea } from '@/components/ui'
import WColorPicker from '@/components/ui/WColorPicker.vue'

defineProps<{
  isOpen: boolean
  localVer: string
  remoteVer: string
  updateState: string
  downloadProgress: number
  coreExists: boolean
  mirrorUrl: string
  mirrorEnabled: boolean
  startOnBoot: boolean
  autoConnect: boolean
  autoConnectMode: string
  showEditor: boolean
  editingType: string
  editorContent: string
  saveBtnText: string
  showResetConfirm: boolean
  showErrorAlert: boolean
  errorAlertMessage: string
  accentColor: string
}>()

const emit = defineEmits<{
  'close': []
  'check-update': []
  'perform-update': []
  'toggle-mirror': []
  'toggle-start-on-boot': []
  'toggle-auto-connect': []
  'change-auto-connect-mode': [value: string | number]
  'open-editor': [type: 'tun' | 'mixed' | 'mirror']
  'save-editor': []
  'reset-editor': []
  'close-editor': []
  'update:editorContent': [value: string]
  'confirm-reset': []
  'close-reset-confirm': []
  'close-error-alert': []
  'change-accent-color': [value: string]
}>()

const showThemeModal = ref(false)
const customColor = ref('#2563eb')

const handleOpenThemeModal = () => {
  showThemeModal.value = true
}

const handleCloseThemeModal = () => {
  showThemeModal.value = false
}

const handleSelectPresetColor = (color: string) => {
  customColor.value = color
  emit('change-accent-color', color)
}

const handleCustomColorChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  customColor.value = target.value
}

const handleApplyCustomColor = () => {
  emit('change-accent-color', customColor.value)
  showThemeModal.value = false
}

</script>

<template>
  <div :class="['absolute inset-x-0 top-12 bottom-0 z-40 bg-[#090909]/95 backdrop-blur-3xl flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] backface-hidden contain-[layout_style_paint]', isOpen ? 'translate-y-0' : 'translate-y-full']">
    <div class="h-10 shrink-0 flex justify-between items-center px-6 border-b border-[#222]">
      <h2 class="text-xs font-bold text-[#888] uppercase tracking-widest">System Settings</h2>
      <WButton variant="link" size="sm" @click="emit('close')">DONE</WButton>
    </div>
    <div class="relative flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar [&::-webkit-scrollbar]:hidden bg-[#0a0a0a]">
      
      <!-- CARD 1: GENERAL SETTINGS -->
      <WCard variant="default" padding="lg">
        <div class="flex items-center gap-2 mb-4">
          <i class="fa-solid fa-cog text-gray-400 text-sm"></i>
          <h3 class="text-xs font-bold text-gray-300 uppercase tracking-wider">General Settings</h3>
        </div>

        <!-- Local Kernel -->
        <div class="flex justify-between items-center py-2 min-h-10">
          <span class="text-xs font-bold text-gray-400">Local Kernel</span>
          <div class="flex items-center gap-3">
            <span class="text-xs text-gray-500 font-mono">{{ localVer }}</span>
            <WButton 
              v-if="updateState === 'checking'"
              variant="secondary"
              size="sm"
              disabled
              loading
            >
              CHECKING
            </WButton>
            <WButton 
              v-else-if="updateState === 'available'"
              variant="primary"
              size="sm"
              class="animate-pulse"
              @click="emit('perform-update')"
            >
              UP TO {{ remoteVer }}
            </WButton>
            <WButton 
              v-else-if="updateState === 'updating'"
              variant="secondary"
              size="sm"
              disabled
              class="relative overflow-hidden w-24"
            >
              <div class="absolute inset-0 bg-blue-600/30 transition-all duration-300" :style="{ width: `${downloadProgress}%` }"></div>
              <span class="relative z-10">{{ downloadProgress }}%</span>
            </WButton>
            <WButton 
              v-else-if="updateState === 'success'"
              variant="success"
              size="sm"
              disabled
            >
              UPDATED
            </WButton>
            <WButton 
              v-else-if="updateState === 'latest'"
              variant="secondary"
              size="sm"
              disabled
              class="opacity-50"
            >
              LATEST
            </WButton>
            <WButton 
              v-else
              variant="secondary"
              size="sm"
              :class="!coreExists ? 'border-yellow-600 text-yellow-500' : ''"
              @click="emit('check-update')"
            >
              {{ coreExists ? "CHECK" : "DOWNLOAD" }}
            </WButton>
          </div>
        </div>

        <!-- GitHub Mirror -->
        <div class="flex justify-between items-center py-2 min-h-10">
          <span class="text-xs font-bold text-gray-400">GitHub Mirror</span>
          <WSwitch :model-value="mirrorEnabled" @update:model-value="emit('toggle-mirror')" />
        </div>

        <WExpandable :expanded="mirrorEnabled">
          <div class="flex justify-between items-center py-2 pl-4 border-l-2 border-[#2a2a2a]">
            <span class="text-xs font-bold text-gray-400">Mirror Config</span>
            <WButton variant="secondary" size="sm" @click="emit('open-editor', 'mirror')">EDIT</WButton>
          </div>
        </WExpandable>

        <!-- Start With Windows -->
        <div class="flex justify-between items-center py-2 min-h-10">
          <span class="text-xs font-bold text-gray-400">Start With Windows</span>
          <WSwitch :model-value="startOnBoot" @update:model-value="emit('toggle-start-on-boot')" />
        </div>

        <!-- Auto Connect -->
        <div class="flex justify-between items-center py-2 min-h-10">
          <span class="text-xs font-bold text-gray-400">Auto Connect</span>
          <WSwitch :model-value="autoConnect" @update:model-value="emit('toggle-auto-connect')" />
        </div>

        <WExpandable :expanded="autoConnect">
          <div class="flex justify-between items-center py-2 pl-4 border-l-2 border-[#2a2a2a] min-h-10">
            <span class="text-xs font-bold text-gray-400">Startup Mode</span>
            <WSelect
              :model-value="autoConnectMode"
              @update:model-value="emit('change-auto-connect-mode', $event)"
              :options="[
                { value: 'full', label: 'FULL' },
                { value: 'tun', label: 'TUN' },
                { value: 'proxy', label: 'PROXY' }
              ]"
              class="w-20"
            />
          </div>
        </WExpandable>
      </WCard>

      <!-- CARD 2: CONFIGURATION -->
      <WCard variant="default" padding="lg">
        <div class="flex items-center gap-2 mb-4">
          <i class="fa-solid fa-file-code text-gray-400 text-sm"></i>
          <h3 class="text-xs font-bold text-gray-300 uppercase tracking-wider">Configuration</h3>
        </div>

        <!-- TUN Config -->
        <div class="flex justify-between items-center py-2 min-h-10">
          <span class="text-xs font-bold text-gray-400">TUN Config</span>
          <WButton variant="secondary" size="sm" @click="emit('open-editor', 'tun')">EDIT</WButton>
        </div>
        
        <!-- Mixed Config -->
        <div class="flex justify-between items-center py-2 min-h-10">
          <span class="text-xs font-bold text-gray-400">Mixed Config</span>
          <WButton variant="secondary" size="sm" @click="emit('open-editor', 'mixed')">EDIT</WButton>
        </div>
      </WCard>

      <!-- CARD 3: APPEARANCE -->
      <WCard variant="default" padding="lg">
        <div class="flex items-center gap-2 mb-4">
          <i class="fa-solid fa-palette text-gray-400 text-sm"></i>
          <h3 class="text-xs font-bold text-gray-300 uppercase tracking-wider">Appearance</h3>
        </div>

        <!-- Theme Color -->
        <div class="flex justify-between items-center py-2 min-h-10">
          <span class="text-xs font-bold text-gray-400">Theme Color</span>
          <WButton variant="secondary" size="sm" @click="handleOpenThemeModal">
            <div class="flex items-center gap-2">
              <div class="w-4 h-4 rounded-full border border-gray-600" :style="{ backgroundColor: accentColor }"></div>
              <span>SELECT</span>
            </div>
          </WButton>
        </div>
      </WCard>
    </div>
  </div>

  <!-- EDITOR MODAL -->
  <WModal
    :model-value="showEditor"
    @update:model-value="emit('close-editor')"
    width="lg"
    height="lg"
  >
    <template #header>
      <h2 class="text-xs font-bold text-[#888] uppercase tracking-widest whitespace-nowrap">EDIT {{ editingType.toUpperCase() }}</h2>
    </template>
    <div class="relative h-full flex flex-col">
      <WTextarea
        :model-value="editorContent"
        @update:model-value="emit('update:editorContent', $event)"
        mono
        :resize="false"
        class="flex-1 w-full bg-[#050505] p-4"
        :rows="20"
      />
      <div class="absolute bottom-4 right-4 flex gap-2">
        <WButton variant="warning" size="sm" @click="emit('reset-editor')">RESET</WButton>
        <WButton variant="secondary" size="sm" @click="emit('close-editor')">CANCEL</WButton>
        <WButton
          :variant="saveBtnText === 'SAVED' ? 'success' : 'primary'"
          size="sm"
          @click="emit('save-editor')"
        >
          {{ saveBtnText }}
        </WButton>
      </div>
    </div>
  </WModal>

  <!-- RESET CONFIRMATION MODAL -->
  <WModal
    :model-value="showResetConfirm"
    @update:model-value="emit('close-reset-confirm')"
    title="CONFIRM RESET"
    width="md"
  >
    <div class="text-sm text-gray-300">Reset to default configuration?</div>
    <template #footer>
      <div class="flex gap-3 w-full">
        <WButton variant="secondary" class="flex-1" @click="emit('close-reset-confirm')">CANCEL</WButton>
        <WButton variant="warning" class="flex-1" @click="emit('confirm-reset')">RESET</WButton>
      </div>
    </template>
  </WModal>

  <!-- THEME COLOR MODAL -->
  <WModal
    :model-value="showThemeModal"
    @update:model-value="handleCloseThemeModal"
    title="THEME COLOR"
    width="md"
  >
    <div class="space-y-4">
      <!-- Preset Colors -->
      <div>
        <h4 class="text-xs font-bold text-gray-400 mb-3">PRESET COLORS</h4>
        <WColorPicker
          :model-value="accentColor"
          @update:model-value="handleSelectPresetColor"
          :colors="[
            { name: 'Blue', value: '#2563eb' },
            { name: 'Purple', value: '#a855f7' },
            { name: 'Pink', value: '#ec4899' },
            { name: 'Red', value: '#ef4444' },
            { name: 'Orange', value: '#f97316' },
            { name: 'Green', value: '#10b981' },
            { name: 'Teal', value: '#14b8a6' },
            { name: 'Cyan', value: '#06b6d4' }
          ]"
        />
      </div>

      <!-- Custom Color -->
      <div>
        <h4 class="text-xs font-bold text-gray-400 mb-3">CUSTOM COLOR</h4>
        <div class="flex items-center gap-3">
          <label class="relative cursor-pointer">
            <input
              type="color"
              :value="customColor"
              @input="handleCustomColorChange"
              class="absolute inset-0 opacity-0 cursor-pointer"
            />
            <div class="w-12 h-12 rounded-full border-2 border-gray-600 flex items-center justify-center bg-linear-to-br from-red-500 via-green-500 to-blue-500 hover:border-gray-400 transition-colors">
              <i class="fa-solid fa-edit text-white text-sm drop-shadow-lg"></i>
            </div>
          </label>
          <div class="flex-1">
            <div class="text-xs text-gray-400 mb-1">Click the circle to pick a custom color</div>
            <div class="text-xs text-gray-500 font-mono">{{ customColor }}</div>
          </div>
        </div>
      </div>
    </div>
    <template #footer>
      <div class="flex gap-3 w-full">
        <WButton variant="secondary" class="flex-1" @click="handleCloseThemeModal">CANCEL</WButton>
        <WButton variant="primary" class="flex-1" @click="handleApplyCustomColor">APPLY</WButton>
      </div>
    </template>
  </WModal>


  <!-- ERROR ALERT MODAL -->
  <WModal
    :model-value="showErrorAlert"
    @update:model-value="emit('close-error-alert')"
    title="ERROR"
    width="md"
  >
    <div class="text-sm text-red-400 font-mono">{{ errorAlertMessage }}</div>
    <template #footer>
      <WButton variant="primary" full-width @click="emit('close-error-alert')">OK</WButton>
    </template>
  </WModal>
</template>
