<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { marked } from 'marked';
import * as Backend from '../wailsjs/go/internal/App';
import wailsConfig from '@wails';
import { EventsOn, EventsOff } from '../wailsjs/runtime/runtime';
import { useAppState } from './composables/useAppState';
import { useProfiles } from './composables/useProfiles';
import { useKernelUpdate } from './composables/useKernelUpdate';
import { useProgramUpdate } from './composables/useProgramUpdate';
import { useTheme } from './composables/useTheme';
import { useUWPLoopback } from './composables/useUWPLoopback';
import DashboardControl from './components/DashboardControl.vue';
import SettingsDrawer from './components/SettingsDrawer.vue';
import { WModal, WButton, WScrollArea } from './components/ui';

const showSettings = ref(false);
const showQuitConfirm = ref(false);
const showUWPModal = ref(false);
const showChangelogModal = ref(false);

// Traffic speed state
const uploadSpeed = ref(0);
const downloadSpeed = ref(0);

const appState = useAppState();
const profilesState = useProfiles(appState);
const kernelState = useKernelUpdate(appState);
const programState = useProgramUpdate(appState);
const themeState = useTheme();
const uwpState = useUWPLoopback();

const renderedChangelog = computed(() => {
  if (!programState.programChangelog.value) return '';
  // Since marked.parse can return a Promise if async is enabled, await it or cast it.
  // In default synchronous usage it returns a string.
  return marked.parse(programState.programChangelog.value) as string;
});

const handlePreReleaseToggleWrapper = async () => {
  await appState.handlePreReleaseToggle();
  // Reset the update checking states so the user can re-check immediately
  kernelState.updateState.value = "idle";
  programState.programUpdateState.value = "idle";
};

const minimize = () => Backend.Minimize();
const minimizeToTray = () => Backend.MinimizeToTray();
const requestQuit = () => { showQuitConfirm.value = true; };
const confirmQuit = () => { showQuitConfirm.value = false; Backend.Quit(); };

onMounted(async () => {
  const data = await Backend.GetInitData();
  profilesState.profiles.value = data.profiles || [];
  profilesState.activeProfile.value = data.activeProfile || null;
  kernelState.localVer.value = data.localVersion;

  // Listen for traffic updates
  EventsOn('traffic-update', (data: { upload: number; download: number }) => {
    uploadSpeed.value = data.upload;
    downloadSpeed.value = data.download;
  });
  // Silent background check for program update
  programState.checkProgramUpdate();
});

onUnmounted(() => {
  EventsOff('traffic-update');
});

const handleToggle = async (target: 'tun' | 'proxy') => {
  const result = await appState.handleToggle(target);
  if (result && result.error === 'kernel-missing') {
    showSettings.value = true;
  }
};

const handleSwitchMode = async (target: { tunMode: boolean, sysProxy: boolean }) => {
  const result = await appState.handleSwitchMode(target);
  if (result && result.error === 'kernel-missing') {
    showSettings.value = true;
  }
};

const handleAccentColorChange = (color: string) => {
  themeState.setTheme(color);
};

const handleOpenUWPModal = async () => {
  showUWPModal.value = true;
  await uwpState.loadApps();
};

const handleCloseUWPModal = () => {
  showUWPModal.value = false;
};

const handleSaveUWPExemptions = async () => {
  const success = await uwpState.saveExemptions();
  if (success) {
    showUWPModal.value = false;
  }
};

const handleRestartCore = async () => {
  const result = await Backend.RestartCore();
  if (result !== "Success") {
    appState.errorAlertMessage.value = result;
    appState.showErrorAlert.value = true;
  }
};
</script>

<template>
  <div class="h-screen w-screen relative bg-[#090909] text-white select-none overflow-hidden font-sans flex flex-col">
    <div class="h-12 shrink-0 flex justify-between items-center px-4 bg-[#0a0a0a] z-60 relative border-b border-white/5" style="--wails-draggable: drag">
      <div class="text-xs font-bold tracking-[0.2em] text-white flex items-center gap-2.5">
        <div :class="['w-2 h-2 rounded-full shadow-[0_0_10px_currentcolor]', appState.coreExists.value ? 'bg-emerald-500 text-emerald-500' : 'bg-red-500 text-red-500']"></div>
        WINBOX
        <span 
          class="text-xs font-medium tracking-normal relative transition-colors duration-200"
          style="--wails-draggable: no-drag"
          :title="programState.programUpdateState.value === 'available' ? 'Click to view update' : ''"
          :class="programState.programUpdateState.value === 'available' ? 'text-blue-400 cursor-pointer hover:text-blue-300' : 'text-white/30'"
          @click="programState.programUpdateState.value === 'available' && (showChangelogModal = true)"
        >
          v{{ wailsConfig.info.productVersion }}
          <span 
            v-if="programState.programUpdateState.value === 'available'"
            class="absolute -bottom-0.5 -right-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_5px_rgba(59,130,246,0.8)] animate-pulse"
          ></span>
        </span>
      </div>
      <div class="flex" style="--wails-draggable: no-drag">
        <button 
          @click="showSettings = !showSettings" 
          class="text-[#888] w-12 h-12 flex items-center justify-center hover:bg-white/5 hover:text-white transition-all duration-200"
          :title="showSettings ? 'Back to Home' : 'Settings'"
        >
          <i :class="showSettings ? 'fas fa-arrow-left' : 'fas fa-gear'" class="text-xs"></i>
        </button>
        <button @click="minimize" class="text-[#888] w-12 h-12 flex items-center justify-center hover:bg-white/5 hover:text-white transition-all duration-200">
          <i class="fas fa-minus text-[10px]"></i>
        </button>
        <button @click="minimizeToTray" class="text-[#888] w-12 h-12 flex items-center justify-center hover:bg-white/5 hover:text-white transition-all duration-200">
          <i class="fas fa-angle-down text-xs"></i>
        </button>
        <button @click="requestQuit" class="text-[#888] w-12 h-12 flex items-center justify-center hover:bg-red-600/90 hover:text-white transition-all duration-200">
          <i class="fas fa-xmark text-base"></i>
        </button>
      </div>
    </div>

    <div class="flex-1 relative overflow-hidden w-full">
      <Transition name="slide-left">
        <WScrollArea v-if="!showSettings" class="absolute inset-0 w-full h-full">
          <DashboardControl
            :running="appState.running.value"
            :coreExists="appState.coreExists.value"
            :msg="appState.msg.value"
            :tunMode="appState.tunMode.value"
            :sysProxy="appState.sysProxy.value"
            :isProcessing="appState.isProcessing.value"
            :profilesState="profilesState"
            :errorLog="appState.errorLog.value"
            :getStatusText="appState.getStatusText.value"
            :getStatusStyle="appState.getStatusStyle.value"
            :getControlBg="appState.getControlBg.value"
            :accentColor="themeState.accentColor.value"
            :hasDashboard="true"
            :uploadSpeed="uploadSpeed"
            :downloadSpeed="downloadSpeed"
            @toggle="handleToggle"
            @toggle-service="appState.handleServiceToggle"
            @switch-mode="handleSwitchMode"
            @open-dashboard="Backend.OpenDashboard"
            @restart-core="handleRestartCore"
          />
        </WScrollArea>

        <div v-else class="absolute inset-0 w-full h-full bg-[#090909]">
          <SettingsDrawer
            :isOpen="true"
            :programLocalVer="programState.programLocalVer.value"
            :programRemoteVer="programState.programRemoteVer.value"
            :programUpdateState="programState.programUpdateState.value"
            :programDownloadProgress="programState.programDownloadProgress.value"
            :localVer="kernelState.localVer.value"
            :remoteVer="kernelState.remoteVer.value"
            :updateState="kernelState.updateState.value"
            :downloadProgress="kernelState.downloadProgress.value"
            :coreExists="appState.coreExists.value"
            :mirrorUrl="appState.mirrorUrl.value"
            :mirrorEnabled="appState.mirrorEnabled.value"
            :startOnBoot="appState.startOnBoot.value"
            :autoConnectState="appState.autoConnectState.value"
            :showEditor="kernelState.showEditor.value"
            :editingType="kernelState.editingType.value"
            :editorContent="kernelState.editorContent.value"
            :saveBtnText="kernelState.saveBtnText.value"
            :showResetConfirm="kernelState.showResetConfirm.value"
            :showErrorAlert="kernelState.showErrorAlert.value || appState.showErrorAlert.value"
            :errorAlertMessage="kernelState.showErrorAlert.value ? kernelState.errorAlertMessage.value : appState.errorAlertMessage.value"
            :accentColor="themeState.accentColor.value"
            :ipv6Enabled="appState.ipv6Enabled.value"
            :preRelease="appState.preRelease.value"
            :logLevel="appState.logLevel.value"
            :logToFile="appState.logToFile.value"
            :showUWPModal="showUWPModal"
            :uwpApps="uwpState.apps.value"
            :uwpSelectedSIDs="uwpState.selectedSIDs.value"
            :uwpLoading="uwpState.loading.value"
            :uwpSaving="uwpState.saving.value"
            :uwpHasChanges="uwpState.hasChanges()"
            @close="showSettings = false"
            @check-program-update="programState.checkProgramUpdate"
            @open-program-changelog="showChangelogModal = true"
            @perform-program-update="programState.performProgramUpdate"
            @check-update="kernelState.checkUpdate"
            @perform-update="kernelState.performUpdate"
            @toggle-pre-release="appState.handlePreReleaseToggle"
            @toggle-mirror="appState.handleMirrorToggle"
            @toggle-start-on-boot="appState.handleStartOnBootToggle"
            @change-auto-connect="appState.handleAutoConnectChange"
            @open-editor="kernelState.openEditor"
            @save-editor="kernelState.saveEditor"
            @reset-editor="kernelState.resetEditor"
            @close-editor="kernelState.showEditor.value = false"
            @update:editorContent="(val) => kernelState.editorContent.value = val"
            @confirm-reset="kernelState.confirmReset"
            @close-reset-confirm="kernelState.showResetConfirm.value = false"
            @close-error-alert="kernelState.showErrorAlert.value = false; appState.showErrorAlert.value = false"
            @change-accent-color="handleAccentColorChange"
            @toggle-ipv6="appState.handleIPv6Toggle"
            @change-log-config="appState.handleLogConfigChange"
            @switch-editor-tab="kernelState.switchEditorTab"
            @open-uwp-modal="handleOpenUWPModal"
            @close-uwp-modal="handleCloseUWPModal"
            @toggle-uwp-app="uwpState.toggleApp"
            @select-all-uwp="uwpState.selectAll"
            @deselect-all-uwp="uwpState.deselectAll"
            @save-uwp-exemptions="handleSaveUWPExemptions"
          />
        </div>
      </Transition>
    </div>

    <WModal
      :model-value="showQuitConfirm"
      @update:model-value="showQuitConfirm = false"
      title="CONFIRM EXIT"
      width="md"
    >
      <div class="text-sm text-gray-300">Are you sure you want to exit WinBox?</div>
      <template #footer>
        <div class="flex gap-3 w-full">
          <WButton variant="secondary" class="flex-1" @click="showQuitConfirm = false">CANCEL</WButton>
          <WButton variant="danger" class="flex-1" @click="confirmQuit">EXIT</WButton>
        </div>
      </template>
    </WModal>

    <!-- Changelog Modal -->
    <WModal
      :model-value="showChangelogModal"
      @update:model-value="showChangelogModal = false"
      :title="'WHAT\'S NEW IN ' + programState.programRemoteVer.value"
      width="md"
    >
      <div 
        class="text-sm text-gray-300 pr-2 markdown-body" 
        v-html="renderedChangelog"
      ></div>
      <template #footer>
        <div class="flex gap-3 w-full">
          <WButton variant="secondary" class="flex-1" @click="showChangelogModal = false">LATER</WButton>
          <WButton 
            variant="primary" 
            class="flex-1" 
            @click="() => { showChangelogModal = false; showSettings = true; programState.performProgramUpdate(); }"
          >
            UPDATE NOW
          </WButton>
        </div>
      </template>
    </WModal>
  </div>
</template>

<style>
.markdown-body {
  color: #d1d5db;
  line-height: 1.6;
}
.markdown-body h1, .markdown-body h2, .markdown-body h3 {
  color: #f3f4f6;
  font-weight: 600;
  margin-top: 1.25rem;
  margin-bottom: 0.75rem;
}
.markdown-body h1 { font-size: 1.5rem; border-bottom: 1px solid #374151; padding-bottom: 0.3rem; }
.markdown-body h2 { font-size: 1.25rem; border-bottom: 1px solid #374151; padding-bottom: 0.3rem; }
.markdown-body h3 { font-size: 1.125rem; }
.markdown-body p { margin-bottom: 1rem; }
.markdown-body ul { list-style-type: disc; padding-left: 1.5rem; margin-bottom: 1rem; }
.markdown-body ol { list-style-type: decimal; padding-left: 1.5rem; margin-bottom: 1rem; }
.markdown-body li { margin-bottom: 0.25rem; }
.markdown-body a { color: #60a5fa; text-decoration: none; }
.markdown-body a:hover { text-decoration: underline; }
.markdown-body code { 
  background-color: rgba(255, 255, 255, 0.1); 
  padding: 0.2em 0.4em; 
  border-radius: 0.375rem; 
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; 
  font-size: 85%;
}
.markdown-body pre { 
  background-color: #1f2937; 
  padding: 1rem; 
  border-radius: 0.5rem; 
  overflow-x: auto; 
  margin-bottom: 1rem; 
  border: 1px solid #374151;
}
.markdown-body pre code { 
  background-color: transparent; 
  padding: 0; 
  font-size: 100%;
}
.markdown-body blockquote { 
  border-left: 4px solid #4b5563; 
  padding-left: 1rem; 
  color: #9ca3af; 
  margin-bottom: 1rem; 
  font-style: italic;
}
.markdown-body hr {
  border: 0;
  border-top: 1px solid #374151;
  margin: 1.5rem 0;
}

.slide-left-enter-active,
.slide-left-leave-active,
.slide-right-enter-active,
.slide-right-leave-active {
  transition: all 0.35s cubic-bezier(0.25, 1, 0.5, 1);
  position: absolute;
  width: 100%;
}

.slide-left-enter-from {
  transform: translateX(20%);
  opacity: 0;
}
.slide-left-leave-to {
  transform: translateX(-20%);
  opacity: 0;
  filter: blur(4px);
}

.slide-right-enter-from {
  transform: translateX(-20%);
  opacity: 0;
}
.slide-right-leave-to {
  transform: translateX(20%);
  opacity: 0;
  filter: blur(4px);
}
</style>