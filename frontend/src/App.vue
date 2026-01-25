<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import * as Backend from '../wailsjs/go/internal/App';
import { useAppState } from './composables/useAppState';
import { useProfiles } from './composables/useProfiles';
import { useKernelUpdate } from './composables/useKernelUpdate';
import DashboardControl from './components/DashboardControl.vue';
import SettingsDrawer from './components/SettingsDrawer.vue';
import ProfilesDrawer from './components/ProfilesDrawer.vue';
import LogsDrawer from './components/LogsDrawer.vue';

type DrawerType = 'none' | 'settings' | 'profiles' | 'logs';

const activeDrawer = ref<DrawerType>('none');

const appState = useAppState();
const profilesState = useProfiles(appState);
const kernelState = useKernelUpdate(appState);

const minimize = () => Backend.Minimize();
const minimizeToTray = () => Backend.MinimizeToTray();
const quitApp = () => Backend.Quit();

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
  }
};
</script>

<template>
  <div class="h-screen w-screen relative bg-[#090909] text-white select-none border border-[#222] rounded-xl overflow-hidden font-sans flex flex-col shadow-2xl">
    <div class="h-10 shrink-0 flex justify-between items-center px-4 bg-[#090909] z-70 relative border-b border-[#1a1a1a]" style="--wails-draggable: drag">
      <div class="text-[10px] font-bold tracking-[0.2em] text-[#666] flex items-center gap-2">
        <div :class="['w-1.5 h-1.5 rounded-full shadow-[0_0_8px_currentcolor]', appState.coreExists.value ? 'bg-emerald-500 text-emerald-500' : 'bg-red-500 text-red-500']"></div> WINBOX
      </div>
      <div class="flex gap-2" style="--wails-draggable: no-drag">
        <button @click="minimize" class="text-[#666] p-1 w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/10 hover:text-white transition-colors"><i class="fas fa-minus text-sm"></i></button>
        <button @click="minimizeToTray" class="text-[#666] p-1 w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/10 hover:text-white transition-colors"><i class="fas fa-angle-down text-sm"></i></button>
      </div>
    </div>

    <div :class="['absolute inset-0 pt-16 px-6 pb-8 flex flex-col justify-between items-center transition-all duration-500', isDrawerOpen ? 'scale-95 opacity-50 blur-[2px]' : 'scale-100 opacity-100']">
      <DashboardControl
        :running="appState.running.value"
        :coreExists="appState.coreExists.value"
        :msg="appState.msg.value"
        :tunMode="appState.tunMode.value"
        :sysProxy="appState.sysProxy.value"
        :isProcessing="appState.isProcessing.value"
        :activeProfile="profilesState.activeProfile.value"
        :errorLog="appState.errorLog.value"
        :getStatusText="appState.getStatusText"
        :getStatusGlow="appState.getStatusGlow"
        :getControlBg="appState.getControlBg"
        @toggle="handleToggle"
        @open-drawer="activeDrawer = $event"
        @open-dashboard="Backend.OpenDashboard"
        @quit="quitApp"
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
    />

    <ProfilesDrawer
      :isOpen="activeDrawer === 'profiles'"
      :profiles="profilesState.profiles.value"
      :activeProfile="profilesState.activeProfile.value"
      :otherProfiles="profilesState.otherProfiles.value"
      :isUpdatingProfile="profilesState.isUpdatingProfile.value"
      :isProfileListExpanded="profilesState.isProfileListExpanded.value"
      :showAddProfileModal="profilesState.showAddProfileModal.value"
      :newName="profilesState.newName.value"
      :newUrl="profilesState.newUrl.value"
      :isAddingProfile="profilesState.isAddingProfile.value"
      @close="activeDrawer = 'none'"
      @switch-profile="profilesState.switchProfile"
      @delete-profile="profilesState.deleteProfile"
      @update-active="profilesState.updateActive"
      @toggle-list="profilesState.isProfileListExpanded.value = !profilesState.isProfileListExpanded.value"
      @open-add-modal="profilesState.showAddProfileModal.value = true"
      @update:newName="(val) => profilesState.newName.value = val"
      @update:newUrl="(val) => profilesState.newUrl.value = val"
      @update:showAddProfileModal="(val) => profilesState.showAddProfileModal.value = val"
      @add-profile="profilesState.addProfile"
    />

    <LogsDrawer
      :isOpen="activeDrawer === 'logs'"
      :errorLog="appState.errorLog.value"
      @close="activeDrawer = 'none'"
    />
  </div>
</template>
