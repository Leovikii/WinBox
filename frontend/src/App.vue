<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import * as Backend from '../wailsjs/go/internal/App';
import wailsConfig from '@wails';
import { useAppState } from './composables/useAppState';
import { useProfiles } from './composables/useProfiles';
import { useKernelUpdate } from './composables/useKernelUpdate';
import { useTheme } from './composables/useTheme';
import DashboardControl from './components/DashboardControl.vue';
import SettingsDrawer from './components/SettingsDrawer.vue';
import ProfilesDrawer from './components/ProfilesDrawer.vue';
import LogsDrawer from './components/LogsDrawer.vue';
import { WModal, WButton, WNavBar } from './components/ui';

type TabType = 'home' | 'logs' | 'profiles' | 'settings';

const tabs = [
  { id: 'home', label: 'Home', icon: 'fas fa-house' },
  { id: 'logs', label: 'Logs', icon: 'fas fa-file-lines' },
  { id: 'profiles', label: 'Profiles', icon: 'fas fa-rocket' },
  { id: 'settings', label: 'Settings', icon: 'fas fa-gear' }
];

const currentTab = ref<TabType>('home');
const direction = ref<'left' | 'right'>('right');
const showQuitConfirm = ref(false);

const appState = useAppState();
const profilesState = useProfiles(appState);
const kernelState = useKernelUpdate(appState);
const themeState = useTheme();

const minimize = () => Backend.Minimize();
const minimizeToTray = () => Backend.MinimizeToTray();
const requestQuit = () => { showQuitConfirm.value = true; };
const confirmQuit = () => { showQuitConfirm.value = false; Backend.Quit(); };

onMounted(async () => {
  const data = await Backend.GetInitData();
  profilesState.profiles.value = data.profiles || [];
  profilesState.activeProfile.value = data.activeProfile || null;
  kernelState.localVer.value = data.localVersion;
});

const switchTab = (id: string) => {
  const newTab = id as TabType;
  if (currentTab.value === newTab) return;
  
  const order = ['home', 'logs', 'profiles', 'settings'];
  const oldIndex = order.indexOf(currentTab.value);
  const newIndex = order.indexOf(newTab);
  
  direction.value = newIndex > oldIndex ? 'left' : 'right';
  currentTab.value = newTab;
};

const handleToggle = async (target: 'tun' | 'proxy') => {
  const result = await appState.handleToggle(target);
  if (result && result.error === 'kernel-missing') {
    switchTab('settings');
  } else if (result && result.error === 'config-missing') {
    switchTab('profiles');
  }
};

const handleSwitchMode = async (target: { tunMode: boolean, sysProxy: boolean }) => {
  const result = await appState.handleSwitchMode(target);
  if (result && result.error === 'kernel-missing') {
    switchTab('settings');
  } else if (result && result.error === 'config-missing') {
    switchTab('profiles');
  }
};

const handleAccentColorChange = (color: string) => {
  themeState.setTheme(color);
};

const transitionName = computed(() => `slide-${direction.value}`);
</script>

<template>
  <div class="h-screen w-screen relative bg-[#090909] text-white select-none overflow-hidden font-sans flex flex-col">
    <div class="h-12 shrink-0 flex justify-between items-center px-4 bg-[#0a0a0a] z-60 relative border-b border-white/5" style="--wails-draggable: drag">
      <div class="text-xs font-bold tracking-[0.2em] text-[#888] flex items-center gap-2.5">
        <div :class="['w-2 h-2 rounded-full shadow-[0_0_10px_currentcolor]', appState.coreExists.value ? 'bg-emerald-500 text-emerald-500' : 'bg-red-500 text-red-500']"></div>
        WINBOX
        <span class="text-xs font-medium text-white/30 tracking-normal">v{{ wailsConfig.info.productVersion }}</span>
      </div>
      <div class="flex" style="--wails-draggable: no-drag">
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
      <Transition :name="transitionName">
        <div v-if="currentTab === 'home'" class="absolute inset-0 overflow-y-auto w-full h-full pb-24">
          <DashboardControl
            :running="appState.running.value"
            :coreExists="appState.coreExists.value"
            :msg="appState.msg.value"
            :tunMode="appState.tunMode.value"
            :sysProxy="appState.sysProxy.value"
            :isProcessing="appState.isProcessing.value"
            :activeProfile="profilesState.activeProfile.value"
            :errorLog="appState.errorLog.value"
            :getStatusText="appState.getStatusText.value"
            :getStatusStyle="appState.getStatusStyle.value"
            :getControlBg="appState.getControlBg.value"
            :localVer="kernelState.localVer.value"
            :accentColor="themeState.accentColor.value"
            :hasDashboard="true"
            @toggle="handleToggle"
            @toggle-service="appState.handleServiceToggle"
            @switch-mode="handleSwitchMode"
            @open-drawer="(target: string) => switchTab(target as TabType)"
            @open-dashboard="Backend.OpenDashboard"
          />
        </div>

        <div v-else-if="currentTab === 'logs'" class="absolute inset-0 w-full h-full bg-[#090909]">
          <LogsDrawer
            :isOpen="true"
            :errorLog="appState.errorLog.value"
            @close="switchTab('home')"
          />
        </div>

        <div v-else-if="currentTab === 'profiles'" class="absolute inset-0 w-full h-full bg-[#090909]">
          <ProfilesDrawer
            :isOpen="true"
            :profiles="profilesState.profiles.value"
            :activeProfile="profilesState.activeProfile.value"
            :isUpdatingProfile="profilesState.isUpdatingProfile.value"
            :showAddProfileModal="profilesState.showAddProfileModal.value"
            :newName="profilesState.newName.value"
            :newUrl="profilesState.newUrl.value"
            :isAddingProfile="profilesState.isAddingProfile.value"
            :showEditProfileModal="profilesState.showEditProfileModal.value"
            :editName="profilesState.editName.value"
            :editUrl="profilesState.editUrl.value"
            :isEditingProfile="profilesState.isEditingProfile.value"
            :showDeleteConfirm="profilesState.showDeleteConfirm.value"
            @close="switchTab('home')"
            @switch-profile="profilesState.switchProfile"
            @delete-profile="profilesState.deleteProfile"
            @confirm-delete="profilesState.confirmDelete"
            @close-delete-confirm="profilesState.showDeleteConfirm.value = false"
            @update-active="profilesState.updateActive"
            @open-add-modal="profilesState.showAddProfileModal.value = true"
            @update:newName="(val) => profilesState.newName.value = val"
            @update:newUrl="(val) => profilesState.newUrl.value = val"
            @update:showAddProfileModal="(val) => profilesState.showAddProfileModal.value = val"
            @add-profile="profilesState.addProfile"
            @edit-profile="profilesState.editProfile"
            @update:editName="(val) => profilesState.editName.value = val"
            @update:editUrl="(val) => profilesState.editUrl.value = val"
            @update:showEditProfileModal="(val) => profilesState.showEditProfileModal.value = val"
            @save-edit-profile="profilesState.saveEditProfile"
          />
        </div>

        <div v-else-if="currentTab === 'settings'" class="absolute inset-0 w-full h-full bg-[#090909]">
          <SettingsDrawer
            :isOpen="true"
            :localVer="kernelState.localVer.value"
            :remoteVer="kernelState.remoteVer.value"
            :updateState="kernelState.updateState.value"
            :downloadProgress="kernelState.downloadProgress.value"
            :coreExists="appState.coreExists.value"
            :mirrorUrl="appState.mirrorUrl.value"
            :mirrorEnabled="appState.mirrorEnabled.value"
            :startOnBoot="appState.startOnBoot.value"
            :autoConnect="appState.autoConnect.value"
            :autoConnectMode="appState.autoConnectMode.value"
            :showEditor="kernelState.showEditor.value"
            :editingType="kernelState.editingType.value"
            :editorContent="kernelState.editorContent.value"
            :saveBtnText="kernelState.saveBtnText.value"
            :showResetConfirm="kernelState.showResetConfirm.value"
            :showErrorAlert="kernelState.showErrorAlert.value"
            :errorAlertMessage="kernelState.errorAlertMessage.value"
            :accentColor="themeState.accentColor.value"
            @close="switchTab('home')"
            @check-update="kernelState.checkUpdate"
            @perform-update="kernelState.performUpdate"
            @toggle-mirror="appState.handleMirrorToggle"
            @toggle-start-on-boot="appState.handleStartOnBootToggle"
            @toggle-auto-connect="appState.handleAutoConnectToggle"
            @change-auto-connect-mode="appState.handleAutoConnectModeChange"
            @open-editor="kernelState.openEditor"
            @save-editor="kernelState.saveEditor"
            @reset-editor="kernelState.resetEditor"
            @close-editor="kernelState.showEditor.value = false"
            @update:editorContent="(val) => kernelState.editorContent.value = val"
            @confirm-reset="kernelState.confirmReset"
            @close-reset-confirm="kernelState.showResetConfirm.value = false"
            @close-error-alert="kernelState.showErrorAlert.value = false"
            @change-accent-color="handleAccentColorChange"
          />
        </div>
      </Transition>
    </div>

    <WNavBar
      :tabs="tabs"
      :current-tab="currentTab"
      :accent-color="themeState.accentColor.value"
      @change="switchTab"
    />

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
  </div>
</template>

<style>
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