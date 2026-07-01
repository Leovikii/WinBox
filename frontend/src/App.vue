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
import SettingsPage from './components/SettingsPage.vue';
import { WModal, WButton, WScrollArea } from './components/ui';
import TrayIconUrl from '@/assets/icon-builder/src/tray.svg';

const showSettings = ref(false);
const showQuitConfirm = ref(false);
const showUWPModal = ref(false);
const showChangelogModal = ref(false);
const rememberCloseChoice = ref(false);

const transitionName = ref('slide-forward');

const toggleSettings = (open: boolean) => {
  transitionName.value = open ? 'slide-forward' : 'slide-back';
  showSettings.value = open;
};

// Traffic speed state
const uploadSpeed = ref(0);
const downloadSpeed = ref(0);

const appState = useAppState();
const profilesState = useProfiles();
const kernelState = useKernelUpdate();
const programState = useProgramUpdate();
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
const requestQuit = () => {
  if (appState.closeBehavior.value === "tray") {
    minimizeToTray();
  } else if (appState.closeBehavior.value === "quit") {
    confirmQuit();
  } else {
    showQuitConfirm.value = true;
  }
};
const confirmQuit = () => { showQuitConfirm.value = false; Backend.Quit(); };

const handleMinimizeChoice = async () => {
  if (rememberCloseChoice.value) {
    appState.closeBehavior.value = "tray";
    await Backend.SetCloseBehavior("tray");
  }
  showQuitConfirm.value = false;
  minimizeToTray();
};

const handleQuitChoice = async () => {
  if (rememberCloseChoice.value) {
    appState.closeBehavior.value = "quit";
    await Backend.SetCloseBehavior("quit");
  }
  showQuitConfirm.value = false;
  Backend.Quit();
};

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
    toggleSettings(true);
  }
};

const handleSwitchMode = async (target: { tunMode: boolean, sysProxy: boolean }) => {
  const result = await appState.handleSwitchMode(target);
  if (result && result.error === 'kernel-missing') {
    toggleSettings(true);
  }
};

const handleAccentColorChange = (color: string) => {
  themeState.setThemeColor(color);
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
  <div class="h-screen w-screen relative bg-transparent text-white select-none overflow-hidden font-sans flex flex-col">
    <div class="h-12 shrink-0 flex justify-between items-center px-4 bg-transparent z-60 relative" style="--wails-draggable: drag">
      <div class="text-sm font-semibold text-gray-800 dark:text-white flex items-center gap-2.5">
        <img :src="TrayIconUrl" class="w-4 h-4 opacity-90" alt="WinBox" />
        WinBox
      </div>
      <div class="flex" style="--wails-draggable: no-drag">
        <button 
          @click="toggleSettings(!showSettings)" 
          class="text-gray-500 dark:text-[#888] w-12 h-12 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 hover:text-gray-800 dark:hover:text-white transition-all duration-200 relative"
          :title="showSettings ? 'Back to Home' : 'Settings'"
        >
          <i :class="showSettings ? 'fas fa-arrow-left' : 'fas fa-gear'" class="text-xs"></i>
          <span 
            v-if="programState.programUpdateState.value === 'available'"
            class="absolute top-[14px] right-[14px] w-1.5 h-1.5 bg-blue-500 rounded-full shadow-[0_0_5px_rgba(59,130,246,0.8)] animate-pulse pointer-events-none"
          ></span>
        </button>
        <button @click="minimize" class="text-gray-500 dark:text-[#888] w-12 h-12 flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 hover:text-gray-800 dark:hover:text-white transition-all duration-200">
          <i class="fas fa-minus text-[10px]"></i>
        </button>
        <button @click="requestQuit" class="text-gray-500 dark:text-[#888] w-12 h-12 flex items-center justify-center hover:bg-red-600/90 hover:text-white transition-all duration-200">
          <i class="fas fa-xmark text-base"></i>
        </button>
      </div>
    </div>

    <div class="flex-1 relative overflow-hidden w-full">
      <Transition :name="transitionName">
        <KeepAlive>
          <WScrollArea key="dashboard" v-if="!showSettings" class="absolute inset-0 w-full h-full">
            <DashboardControl
              :hasDashboard="true"
              :uploadSpeed="uploadSpeed"
              :downloadSpeed="downloadSpeed"
              @switch-mode="handleSwitchMode"
              @open-dashboard="Backend.OpenDashboard"
              @restart-core="handleRestartCore"
              @open-settings="toggleSettings(true)"
            />
          </WScrollArea>

          <SettingsPage key="settings" v-else class="absolute inset-0 w-full h-full"
            :isOpen="true"
            :showUWPModal="showUWPModal"
            @close="toggleSettings(false)"
            @open-program-changelog="showChangelogModal = true"
            @open-uwp-modal="handleOpenUWPModal"
            @close-uwp-modal="handleCloseUWPModal"
          />
        </KeepAlive>
      </Transition>
    </div>

    <WModal
      :model-value="showQuitConfirm"
      @update:model-value="showQuitConfirm = false"
      title="Exit options"
      width="md"
    >
      <div class="text-sm text-gray-800 dark:text-gray-300 mb-4">Do you want to minimize to the system tray or quit the application?</div>
      
      <label class="flex items-center gap-2 cursor-pointer mb-2 w-fit group">
        <div class="relative flex items-center justify-center w-4 h-4 rounded border transition-colors duration-200"
             :class="rememberCloseChoice ? 'bg-[var(--accent-color)] border-[var(--accent-color)]' : 'border-gray-400 dark:border-gray-500 group-hover:border-gray-500 dark:group-hover:border-gray-400'">
          <i class="fas fa-check text-[10px] text-white opacity-0 transition-opacity duration-200"
             :class="{'opacity-100': rememberCloseChoice}"></i>
        </div>
        <span class="text-xs text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-300 transition-colors">Remember my choice and don't ask again</span>
        <input type="checkbox" v-model="rememberCloseChoice" class="hidden" />
      </label>

      <template #footer>
        <div class="flex gap-3 w-full">
          <WButton variant="secondary" class="flex-1" @click="handleMinimizeChoice">Minimize</WButton>
          <WButton variant="danger" class="flex-1" @click="handleQuitChoice">Quit</WButton>
        </div>
      </template>
    </WModal>

    <!-- Changelog Modal -->
    <WModal
      :model-value="showChangelogModal"
      @update:model-value="showChangelogModal = false"
      :title="`What's new in ${programState.programRemoteVer.value}`"
      width="md"
    >
      <div 
        class="text-sm text-gray-800 dark:text-gray-300 pr-2 markdown-body" 
        v-html="renderedChangelog"
      ></div>
      <template #footer>
        <div class="flex gap-3 w-full">
          <WButton variant="secondary" class="flex-1" @click="showChangelogModal = false">Later</WButton>
          <WButton 
            variant="primary" 
            class="flex-1" 
            @click="() => { showChangelogModal = false; showSettings = true; programState.performProgramUpdate(); }"
          >
            Update now
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



.depth-enter-active,
.depth-leave-active {
  transition: all 0.25s cubic-bezier(0.2, 0, 0, 1);
  position: absolute;
  width: 100%;
}

.depth-enter-from {
  opacity: 0;
  transform: scale(1.02);
}

.depth-leave-to {
  opacity: 0;
  transform: scale(0.98);
}
</style>