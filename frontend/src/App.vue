<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import * as Backend from '../wailsjs/go/internal/App';
import { useAppState } from './composables/useAppState';
import { useProfiles } from './composables/useProfiles';
import { useKernelUpdate } from './composables/useKernelUpdate';
import { useTheme } from './composables/useTheme';
import DashboardControl from './components/DashboardControl.vue';
import SettingsDrawer from './components/SettingsDrawer.vue';
import ProfilesDrawer from './components/ProfilesDrawer.vue';
import LogsDrawer from './components/LogsDrawer.vue';
import { WModal, WButton } from './components/ui';

type DrawerType = 'none' | 'settings' | 'profiles' | 'logs';

const activeDrawer = ref<DrawerType>('none');
const showQuitConfirm = ref(false);

const appState = useAppState();
const profilesState = useProfiles(appState);
const kernelState = useKernelUpdate(appState);
const themeState = useTheme();

const minimize = () => Backend.Minimize();
const minimizeToTray = () => Backend.MinimizeToTray();
const requestQuit = () => { showQuitConfirm.value = true; };
const confirmQuit = () => { showQuitConfirm.value = false; Backend.Quit(); };

const isDrawerOpen = computed(() => activeDrawer.value !== 'none');

onMounted(async () => {
  const data = await Backend.GetInitData();
  profilesState.profiles.value = data.profiles || [];
  profilesState.activeProfile.value = data.activeProfile || null;
  kernelState.localVer.value = data.localVersion;
});

const handleToggle = async (target: 'tun' | 'proxy') => {
  const result = await appState.handleToggle(target);
  if (result && result.error === 'kernel-missing') {
    activeDrawer.value = 'settings';
  } else if (result && result.error === 'config-missing') {
    activeDrawer.value = 'profiles';
  }
};

const handleAccentColorChange = (color: string) => {
  themeState.setTheme(color);
};
</script>

<template>
  <div class="h-screen w-screen relative bg-[#090909] text-white select-none overflow-hidden font-sans flex flex-col">
    <!-- Title Bar - Windows 11 Style -->
    <div class="h-12 shrink-0 flex justify-between items-center px-4 bg-[#0a0a0a] z-70 relative" style="--wails-draggable: drag">
      <div class="text-xs font-bold tracking-[0.2em] text-[#888] flex items-center gap-2.5">
        <div :class="['w-2 h-2 rounded-full shadow-[0_0_10px_currentcolor]', appState.coreExists.value ? 'bg-emerald-500 text-emerald-500' : 'bg-red-500 text-red-500']"></div> WINBOX
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

    <div :class="['absolute inset-0 pt-20 px-6 pb-8 flex flex-col justify-between items-center transition-all duration-300', isDrawerOpen ? 'scale-95 opacity-50' : 'scale-100 opacity-100']">
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
        @toggle="handleToggle"
        @toggle-service="appState.handleServiceToggle"
        @open-drawer="activeDrawer = $event"
        @open-dashboard="Backend.OpenDashboard"
      />
    </div>

    <SettingsDrawer
      :isOpen="activeDrawer === 'settings'"
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
      @close="activeDrawer = 'none'"
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

    <ProfilesDrawer
      :isOpen="activeDrawer === 'profiles'"
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
      @close="activeDrawer = 'none'"
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

    <LogsDrawer
      :isOpen="activeDrawer === 'logs'"
      :errorLog="appState.errorLog.value"
      @close="activeDrawer = 'none'"
    />

    <!-- QUIT CONFIRMATION MODAL -->
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
