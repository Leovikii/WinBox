<script setup lang="ts">
import { ref } from 'vue'
import { WButton, WSwitch, WSelect, WCard, WExpandable, WModal, WTextarea, WScrollArea } from '@/components/ui'
import WColorPicker from '@/components/ui/WColorPicker.vue'
import UWPLoopbackModal from '@/components/UWPLoopbackModal.vue'
import { BrowserOpenURL } from '../../wailsjs/runtime/runtime'

import { useAppState } from '@/composables/useAppState'
import { useKernelUpdate } from '@/composables/useKernelUpdate'
import { useProgramUpdate } from '@/composables/useProgramUpdate'
import { useTheme } from '@/composables/useTheme'
import { useUWPLoopback } from '@/composables/useUWPLoopback'
import * as Backend from '../../wailsjs/go/internal/App'

const appState = useAppState()
const kernelState = useKernelUpdate()
const programState = useProgramUpdate()
const themeState = useTheme()
const uwpState = useUWPLoopback()

const {
  coreExists, preRelease, mirrorUrl, mirrorEnabled, startOnBoot, autoConnectState,
  showErrorAlert, errorAlertMessage, ipv6Enabled, logLevel, logToFile, closeBehavior,
  handleMirrorToggle, handleStartOnBootToggle, handleAutoConnectChange, handleIPv6Toggle, handleLogConfigChange
} = appState

const {
  localVer, remoteVer, updateState, downloadProgress, showEditor, editingType, editorContent, saveBtnText,
  showResetConfirm, checkUpdate, performUpdate, openEditor, saveEditor, resetEditor, confirmReset, switchEditorTab
} = kernelState

const {
  programLocalVer, programRemoteVer, programUpdateState, programDownloadProgress, checkProgramUpdate, performProgramUpdate
} = programState

const { accentColor, themeMode, setThemeColor, setThemeMode } = themeState

const themeModeOptions = [
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
  { label: 'System', value: 'system' }
]

const {
  apps: uwpApps, selectedSIDs: uwpSelectedSIDs, loading: uwpLoading, saving: uwpSaving,
  hasChanges: uwpHasChanges, toggleApp: toggleUwpApp, selectAll: selectAllUwp, deselectAll: deselectAllUwp,
  saveExemptions, loadApps
} = uwpState

defineProps<{
  isOpen: boolean
  showUWPModal: boolean
}>()

const emit = defineEmits<{
  'close': []
  'open-program-changelog': []
  'open-uwp-modal': []
  'close-uwp-modal': []
}>()

const handlePreReleaseToggleWrapper = async () => {
  await appState.handlePreReleaseToggle();
  kernelState.updateState.value = "idle";
  programState.programUpdateState.value = "idle";
}

const updateCloseBehavior = (val: string) => {
  appState.closeBehavior.value = val;
  Backend.SetCloseBehavior(val);
}

const showThemeModal = ref(false)
const customColor = ref('#2563eb')

const handleOpenThemeModal = () => {
  customColor.value = accentColor.value
  showThemeModal.value = true
}

const handleCloseThemeModal = () => {
  showThemeModal.value = false
}

const handleSelectPresetColor = (color: string) => {
  customColor.value = color
}

const handleCustomColorChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  customColor.value = target.value
}

const applyCustomColor = () => {
  setThemeColor(customColor.value)
  showThemeModal.value = false
}

const openGitHub = () => {
  BrowserOpenURL("https://github.com/Leovikii/WinBox")
}

</script>

<template>
  <div class="w-full h-full relative">
    <div class="w-full h-full flex flex-col bg-transparent">
      <WScrollArea class="flex-1">
        <div class="px-4 pt-6 pb-28 space-y-4">

      <!-- About Section -->
      <WCard variant="mica" padding="lg">
        <div class="flex items-center gap-2 mb-4 justify-start">
          <i class="fa-solid fa-info-circle text-[var(--accent-color)] w-4 text-center"></i>
          <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-400">About</h3>
        </div>

        <div class="flex justify-between items-center py-2 min-h-10">
          <span class="text-xs font-bold text-gray-600 dark:text-gray-400">App Version</span>
          <div class="flex items-center gap-3">
            <span class="text-xs text-gray-600 dark:text-gray-500 font-mono">{{ programLocalVer }}</span>
            <WButton
              v-if="programUpdateState === 'checking'"
              variant="secondary"
              size="sm"
              icon="fas fa-spinner fa-spin"
            >Checking</WButton>
            <WButton
              v-else-if="programUpdateState === 'available'"
              variant="primary"
              size="sm"
              icon="fas fa-arrow-up"
              @click="emit('open-program-changelog')"
            >
              UP TO {{ programRemoteVer }}
            </WButton>
            <WButton
              v-else-if="programUpdateState === 'updating'"
              variant="secondary"
              size="sm"
              icon="fas fa-download"
              class="relative overflow-hidden w-24"
            >
              <div class="absolute inset-0 bg-blue-600/30 transition-all duration-300" :style="{ width: `${programDownloadProgress}%` }"></div>
              <span class="relative z-10">{{ programDownloadProgress }}%</span>
            </WButton>
            <WButton
              v-else-if="programUpdateState === 'success'"
              variant="success"
              size="sm"
              icon="fas fa-check"
            >
              RESTARTING
            </WButton>
            <WButton
              v-else-if="programUpdateState === 'latest'"
              variant="secondary"
              size="sm"
              icon="fas fa-check-circle"
            >Latest</WButton>
            <WButton
              v-else-if="programUpdateState === 'error'"
              variant="warning"
              size="sm"
              icon="fas fa-exclamation-triangle"
              @click="checkProgramUpdate()"
            >
              FAILED
            </WButton>
            <WButton
              v-else
              variant="secondary"
              size="sm"
              icon="fas fa-rotate"
              @click="checkProgramUpdate()"
              class="min-w-[5rem]"
            >Check</WButton>
          </div>
        </div>

        <div class="flex justify-between items-center py-2 min-h-10">
          <span class="text-xs font-bold text-gray-600 dark:text-gray-400">Kernel Version</span>
          <div class="flex items-center gap-3">
            <span class="text-xs text-gray-600 dark:text-gray-500 font-mono">{{ localVer }}</span>
            <WButton
              v-if="updateState === 'checking'"
              variant="secondary"
              size="sm"
              icon="fas fa-spinner fa-spin"
            >Checking</WButton>
            <WButton
              v-else-if="updateState === 'available'"
              variant="primary"
              size="sm"
              icon="fas fa-arrow-up"
              @click="performUpdate()"
            >
              UP TO {{ remoteVer }}
            </WButton>
            <WButton
              v-else-if="updateState === 'updating'"
              variant="secondary"
              size="sm"
              icon="fas fa-download"
              class="relative overflow-hidden w-24"
            >
              <div class="absolute inset-0 bg-blue-600/30 transition-all duration-300" :style="{ width: `${downloadProgress}%` }"></div>
              <span class="relative z-10">{{ downloadProgress }}%</span>
            </WButton>
            <WButton
              v-else-if="updateState === 'success'"
              variant="success"
              size="sm"
              icon="fas fa-check"
            >
              UPDATED
            </WButton>
            <WButton
              v-else-if="updateState === 'latest'"
              variant="secondary"
              size="sm"
              icon="fas fa-check-circle"
            >Latest</WButton>
            <WButton
              v-else-if="updateState === 'error'"
              variant="warning"
              size="sm"
              icon="fas fa-exclamation-triangle"
              @click="checkUpdate()"
            >
              FAILED
            </WButton>
            <WButton
              v-else
              variant="secondary"
              size="sm"
              icon="fas fa-rotate"
              :class="[!coreExists ? 'border-yellow-600 text-yellow-500' : '', 'min-w-[5rem]']"
              @click="checkUpdate()"
            >
              {{ coreExists ? "Check" : "Download" }}
            </WButton>
          </div>
        </div>

        <div class="flex justify-between items-center py-2 min-h-10">
          <span class="text-xs font-bold text-gray-600 dark:text-gray-400">Pre-release Updates</span>
          <WSwitch :model-value="preRelease" @update:model-value="handlePreReleaseToggleWrapper()" />
        </div>

        <div class="flex justify-between items-center py-2 min-h-10">
          <span class="text-xs font-bold text-gray-600 dark:text-gray-400">GitHub Repository</span>
          <WButton
            variant="secondary"
            size="sm"
            icon="fa-brands fa-github"
            @click="openGitHub"
            class="min-w-[5rem]"
          >Open</WButton>
        </div>
      </WCard>

      <!-- General Section -->
      <WCard variant="mica" padding="lg">
        <div class="flex items-center gap-2 mb-4 justify-start">
          <i class="fa-solid fa-cog text-[var(--accent-color)] w-4 text-center"></i>
          <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-400">General</h3>
        </div>

        <div class="flex justify-between items-center py-2 min-h-10">
          <span class="text-xs font-bold text-gray-600 dark:text-gray-400">Close Window Behavior</span>
          <WSelect
            :model-value="closeBehavior"
            @update:model-value="updateCloseBehavior($event as string)"
            :options="[
              { value: 'ask', label: 'Ask' },
              { value: 'tray', label: 'Minimize' },
              { value: 'quit', label: 'Quit' }
            ]"
            class="w-28"
          />
        </div>

        <div class="flex justify-between items-center py-2 min-h-10">
          <span class="text-xs font-bold text-gray-600 dark:text-gray-400">Start With Windows</span>
          <WSwitch :model-value="startOnBoot" @update:model-value="handleStartOnBootToggle()" />
        </div>

        <div class="flex justify-between items-center py-2 min-h-10">
          <span class="text-xs font-bold text-gray-600 dark:text-gray-400">Auto Connect</span>
          <WSelect
            :model-value="autoConnectState"
            @update:model-value="handleAutoConnectChange($event)"
            :options="[
              { value: 'smart', label: 'Smart' },
              { value: 'on', label: 'On' },
              { value: 'off', label: 'Off' }
            ]"
            class="w-28"
          />
        </div>

        <div class="flex justify-between items-center py-2 min-h-10">
          <span class="text-xs font-bold text-gray-600 dark:text-gray-400">Theme</span>
          <div class="flex items-center gap-2">
            <WButton variant="secondary" size="sm" @click="handleOpenThemeModal" class="w-8 h-8 !p-0 flex items-center justify-center rounded-full">
              <div class="w-4 h-4 rounded-full shadow-inner border border-white/20" :style="{ backgroundColor: accentColor }"></div>
            </WButton>
            <WSelect v-model="themeMode" :options="themeModeOptions" @update:modelValue="(val) => setThemeMode(val as string)" class="w-28" />
          </div>
        </div>
      </WCard>

      <!-- Config Override Section -->
      <WCard variant="mica" padding="lg">
        <div class="flex items-center gap-2 mb-4 justify-start">
          <i class="fa-solid fa-file-code text-[var(--accent-color)] w-4 text-center"></i>
          <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-400">Config Override</h3>
        </div>

        <div class="flex justify-between items-center py-2 min-h-10">
          <span class="text-xs font-bold text-gray-600 dark:text-gray-400">Inbound Config</span>
          <WButton variant="secondary" size="sm" icon="fas fa-pen" @click="openEditor('tun')" class="min-w-[5rem]">Edit</WButton>
        </div>

        <div class="flex justify-between items-center py-2 min-h-10">
          <span class="text-xs font-bold text-gray-600 dark:text-gray-400">IPv6 Support</span>
          <WSwitch :model-value="ipv6Enabled" @update:model-value="handleIPv6Toggle()" />
        </div>

        <div class="flex justify-between items-center py-2 min-h-10">
          <span class="text-xs font-bold text-gray-600 dark:text-gray-400">Log To File</span>
          <WSwitch :model-value="logToFile" @update:model-value="handleLogConfigChange(logLevel, $event)" />
        </div>

        <div class="flex justify-between items-center py-2 min-h-10">
          <span class="text-xs font-bold text-gray-600 dark:text-gray-400">Log Level</span>
          <WSelect
            :model-value="logLevel"
            @update:model-value="handleLogConfigChange(String($event), logToFile)"
            :options="[
              { value: 'debug', label: 'Debug' },
              { value: 'info', label: 'Info' },
              { value: 'warning', label: 'Warning' },
              { value: 'error', label: 'Error' }
            ]"
            class="w-28"
          />
        </div>
      </WCard>

      <!-- Network Section -->
      <WCard variant="mica" padding="lg">
        <div class="flex items-center gap-2 mb-4 justify-start">
          <i class="fa-solid fa-network-wired text-[var(--accent-color)] w-4 text-center"></i>
          <h3 class="text-sm font-semibold text-gray-600 dark:text-gray-400">Network</h3>
        </div>

        <div class="flex justify-between items-center py-2 min-h-10">
          <span class="text-xs font-bold text-gray-600 dark:text-gray-400">GitHub Mirror</span>
          <WSwitch :model-value="mirrorEnabled" @update:model-value="handleMirrorToggle()" />
        </div>

        <WExpandable :expanded="mirrorEnabled">
          <div class="flex justify-between items-center py-2 pl-4 border-l-2 border-[#2a2a2a]">
            <span class="text-xs font-bold text-gray-600 dark:text-gray-500">Mirror Config</span>
            <WButton variant="secondary" size="sm" icon="fas fa-pen" @click="openEditor('mirror')" class="min-w-[5rem]">Edit</WButton>
          </div>
        </WExpandable>

        <div class="flex justify-between items-center py-2 min-h-10">
          <span class="text-xs font-bold text-gray-600 dark:text-gray-400">UWP Loopback</span>
          <WButton variant="secondary" size="sm" icon="fas fa-gear" @click="emit('open-uwp-modal')" class="min-w-[5rem]">Manage</WButton>
        </div>
      </WCard>
        </div>
      </WScrollArea>
    </div>

  <!-- UWP Loopback Modal -->
  <UWPLoopbackModal
    :model-value="showUWPModal"
    :apps="uwpApps"
    :selectedSIDs="uwpSelectedSIDs"
    :loading="uwpLoading"
    :saving="uwpSaving"
    :hasChanges="uwpHasChanges()"
    @update:model-value="emit('close-uwp-modal')"
    @toggle="toggleUwpApp($event)"
    @selectAll="selectAllUwp()"
    @deselectAll="deselectAllUwp()"
    @save="saveExemptions()"
  />

  <!-- Editor Modal -->
  <WModal
    :model-value="showEditor"
    @update:model-value="showEditor = false"
  >
    <template #header>
      <div class="flex items-center gap-4">
        <h2 class="text-xs font-bold text-gray-800 dark:text-[#888] tracking-widest whitespace-nowrap">
          Edit {{ editingType === 'mirror' ? 'Mirror' : 'Inbound' }}
        </h2>
        <div v-if="editingType !== 'mirror'" class="flex gap-2">
          <WButton
            :variant="editingType === 'tun' ? 'primary' : 'secondary'"
            size="sm"
            icon="fas fa-diagram-project"
            @click="switchEditorTab('tun')"
          >Tun</WButton>
          <WButton
            :variant="editingType === 'mixed' ? 'primary' : 'secondary'"
            size="sm"
            icon="fas fa-shuffle"
            @click="switchEditorTab('mixed')"
          >Mixed</WButton>
        </div>
      </div>
    </template>
    <div class="h-full flex flex-col">
        <WTextarea
          :model-value="editorContent"
          @update:model-value="editorContent = $event"
          mono
          :resize="false"
          class="flex-1 w-full bg-white dark:bg-[#050505] text-gray-900 dark:text-gray-100 p-4 border border-black/10 dark:border-white/5 rounded-md"
          :rows="20"
        />
      </div>
      <template #footer>
        <div class="flex items-center justify-end gap-3 w-full">
          <WButton variant="warning" class="min-w-[80px]" icon="fas fa-undo" @click="resetEditor()">Reset</WButton>
          <WButton variant="secondary" class="min-w-[80px]" icon="fas fa-times" @click="showEditor = false">Cancel</WButton>
          <WButton
            :variant="saveBtnText === 'Saved' ? 'success' : 'primary'"
            class="min-w-[80px]"
            :icon="saveBtnText === 'Saved' ? 'fas fa-check' : 'fas fa-save'"
            @click="saveEditor()"
          >
            {{ saveBtnText }}
          </WButton>
        </div>
      </template>
    </WModal>

  <!-- Reset Confirmation Modal -->
  <WModal
    :model-value="showResetConfirm"
    @update:model-value="showResetConfirm = false"
    title="Confirm Reset"
    width="md"
  >
    <div class="text-sm text-gray-800 dark:text-gray-300">Reset to default configuration?</div>
    <template #footer>
      <div class="flex items-center justify-end gap-3 w-full">
        <WButton variant="secondary" class="min-w-[80px]" icon="fas fa-times" @click="showResetConfirm = false">Cancel</WButton>
        <WButton variant="warning" class="min-w-[80px]" icon="fas fa-undo" @click="confirmReset()">Reset</WButton>
      </div>
    </template>
  </WModal>

  <!-- Theme Color Modal -->
  <WModal
    :model-value="showThemeModal"
    @update:model-value="handleCloseThemeModal"
    title="Theme Color"
    width="md"
  >
    <div class="space-y-4">
      <div>
        <h4 class="text-xs font-bold text-gray-600 dark:text-gray-400 mb-3">Preset Colors</h4>
        <WColorPicker
          :model-value="customColor"
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

      <div>
        <h4 class="text-xs font-bold text-gray-600 dark:text-gray-400 mb-3">Custom Color</h4>
        <div class="flex items-center gap-3">
          <label class="relative cursor-pointer">
            <input
              type="color"
              :value="customColor"
              @input="handleCustomColorChange"
              class="absolute inset-0 opacity-0 cursor-pointer"
            />
            <div class="w-12 h-12 rounded-full border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center bg-linear-to-br from-red-500 via-green-500 to-blue-500 hover:border-gray-400 dark:hover:border-gray-400 transition-colors">
              <i class="fa-solid fa-edit text-white text-sm drop-shadow-lg"></i>
            </div>
          </label>
          <div class="min-w-[80px]">
            <div class="text-xs text-gray-600 dark:text-gray-400 mb-1">Click the circle to pick a custom color</div>
            <div class="text-xs text-gray-700 dark:text-gray-500 font-mono">{{ customColor }}</div>
          </div>
        </div>
      </div>
    </div>
    <template #footer>
      <div class="flex items-center justify-end gap-3 w-full">
        <WButton variant="secondary" class="min-w-[80px]" icon="fas fa-times" @click="handleCloseThemeModal">Cancel</WButton>
        <WButton variant="primary" class="min-w-[80px]" icon="fas fa-check" @click="applyCustomColor">Apply</WButton>
      </div>
    </template>
  </WModal>

  <!-- Error Alert Modal -->
  <WModal
    :model-value="showErrorAlert"
    @update:model-value="showErrorAlert = false; appState.showErrorAlert.value = false"
    title="Error"
    width="md"
  >
    <div class="text-sm text-red-500 dark:text-red-400 font-mono">{{ errorAlertMessage }}</div>
    <template #footer>
      <WButton variant="primary" full-width icon="fas fa-check" @click="showErrorAlert = false; appState.showErrorAlert.value = false">OK</WButton>
    </template>
  </WModal>
  </div>
</template>
