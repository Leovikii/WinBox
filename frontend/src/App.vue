<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import * as Backend from '../wailsjs/go/internal/App';
import { EventsOn } from '../wailsjs/runtime/runtime';

type DrawerType = 'none' | 'settings' | 'profiles' | 'logs';

// State
const running = ref(false);
const coreExists = ref(true);
const msg = ref("READY");
const activeDrawer = ref<DrawerType>('none');

const tunMode = ref(false);
const sysProxy = ref(false);
const isProcessing = ref(false);

const copyState = ref("COPY");
const errorLog = ref("");
const localVer = ref("Unknown");
const remoteVer = ref("Unknown");
const mirrorUrl = ref("");
const mirrorEnabled = ref(false);
const updateState = ref("idle");
const downloadProgress = ref(0);

const startOnBoot = ref(false);
const autoConnect = ref(false);
const autoConnectMode = ref("full");

const profiles = ref<any[]>([]);
const activeProfile = ref<any>(null);
const isUpdatingProfile = ref(false);
const isProfileListExpanded = ref(false);

const showAddProfileModal = ref(false);
const newName = ref("");
const newUrl = ref("");
const isAddingProfile = ref(false);

const showEditor = ref(false);
const editingType = ref<"tun" | "mixed" | "mirror">("tun");
const editorContent = ref("");
const saveBtnText = ref("SAVE");

// Helper functions
const cleanLog = (text: string) => text.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
const copyLog = () => {
  navigator.clipboard.writeText(errorLog.value);
  copyState.value = "COPIED!";
  setTimeout(() => copyState.value = "COPY", 2000);
};

// Event listeners
onMounted(() => {
  refreshData();
  EventsOn("status", (state: boolean) => {
    running.value = state;
  });
  EventsOn("state-sync", (state: any) => {
    tunMode.value = state.tunMode;
    sysProxy.value = state.sysProxy;
  });
  EventsOn("log", (logMsg: string) => {
    const cleaned = cleanLog(logMsg);
    const ignoreKeywords = ["forcibly closed", "connection upload closed", "raw-read tcp", "use of closed network connection", "context canceled"];
    if (ignoreKeywords.some(k => cleaned.includes(k))) return;
    if (cleaned.includes("ERROR") || cleaned.includes("FATAL") || cleaned.includes("bind: address already in use") || cleaned.includes("Access is denied")) {
      msg.value = "ERROR";
      running.value = false;
      errorLog.value = cleaned;
    } else {
      msg.value = cleaned;
    }
  });
  EventsOn("download-progress", (pct: number) => {
    downloadProgress.value = pct;
  });
});

const refreshData = async () => {
  const data = await Backend.GetInitData();
  running.value = data.running;
  profiles.value = data.profiles || [];
  activeProfile.value = data.activeProfile || null;
  coreExists.value = data.coreExists;
  if (!data.coreExists) msg.value = "Kernel Missing";
  localVer.value = data.localVersion;
  mirrorUrl.value = data.mirror;
  mirrorEnabled.value = data.mirrorEnabled;
  tunMode.value = data.running && data.tunMode;
  sysProxy.value = data.running && data.sysProxy;
  startOnBoot.value = data.startOnBoot;
  autoConnect.value = data.autoConnect;
  autoConnectMode.value = data.autoConnectMode;
};

const handleToggle = async (target: 'tun' | 'proxy') => {
  if (isProcessing.value) return;
  if (!coreExists.value) {
    msg.value = "KERNEL MISSING!";
    activeDrawer.value = 'settings';
    return;
  }
  isProcessing.value = true;
  let newTun = tunMode.value;
  let newProxy = sysProxy.value;
  if (target === 'tun') newTun = !tunMode.value;
  if (target === 'proxy') newProxy = !sysProxy.value;
  tunMode.value = newTun;
  sysProxy.value = newProxy;
  msg.value = newTun || newProxy ? "STARTING..." : "STOPPING...";
  const res = await Backend.ApplyState(newTun, newProxy);
  isProcessing.value = false;
  if (res === "Success" || res === "Stopped") {
    msg.value = newTun || newProxy ? "RUNNING" : "STOPPED";
    if (!newTun && !newProxy) running.value = false;
    else running.value = true;
  } else {
    msg.value = "ERROR";
    errorLog.value = res;
    tunMode.value = tunMode.value;
    sysProxy.value = sysProxy.value;
  }
};

const handleMirrorToggle = async () => {
  const newState = !mirrorEnabled.value;
  mirrorEnabled.value = newState;
  await Backend.SaveSettings(mirrorUrl.value, newState);
};

const handleStartOnBootToggle = async () => {
  const newState = !startOnBoot.value;
  const res = await Backend.SetStartOnBoot(newState);
  if (res === "Success") {
    startOnBoot.value = newState;
    if (newState && !autoConnect.value) {
      await Backend.SetAutoConnect(true, autoConnectMode.value);
      autoConnect.value = true;
    }
  } else alert(res);
};

const handleAutoConnectToggle = async () => {
  const newState = !autoConnect.value;
  const res = await Backend.SetAutoConnect(newState, autoConnectMode.value);
  if (res === "Success") autoConnect.value = newState;
  else alert(res);
};

const handleAutoConnectModeChange = async (e: Event) => {
  const newMode = (e.target as HTMLSelectElement).value;
  const res = await Backend.SetAutoConnect(autoConnect.value, newMode);
  if (res === "Success") autoConnectMode.value = newMode;
};

const openEditor = async (type: "tun" | "mixed" | "mirror") => {
  editingType.value = type;
  saveBtnText.value = "SAVE";
  if (type === 'mirror') {
    editorContent.value = mirrorUrl.value;
  } else {
    const content = await Backend.GetOverride(type);
    try {
      const obj = JSON.parse(content);
      editorContent.value = JSON.stringify(obj, null, 2);
    } catch {
      editorContent.value = content;
    }
  }
  showEditor.value = true;
};

const saveEditor = async () => {
  let res = "";
  if (editingType.value === 'mirror') {
    res = await Backend.SaveSettings(editorContent.value, mirrorEnabled.value);
    if (res === "Success") {
      mirrorUrl.value = editorContent.value;
    }
  } else {
    res = await Backend.SaveOverride(editingType.value as string, editorContent.value);
  }
  if (res === "Success") {
    saveBtnText.value = "SAVED";
    if (running.value && editingType.value !== 'mirror') msg.value = "RESTART TO APPLY";
    setTimeout(() => {
      showEditor.value = false;
    }, 800);
  } else {
    alert(res);
  }
};

const resetEditor = async () => {
  if (confirm("Reset to default?")) {
    if (editingType.value === 'mirror') {
      editorContent.value = "https://gh-proxy.com/";
    } else {
      const res = await Backend.ResetOverride(editingType.value);
      try {
        const content = res === "Success" ? await Backend.GetOverride(editingType.value) : "{}";
        const obj = JSON.parse(content);
        editorContent.value = JSON.stringify(obj, null, 2);
      } catch {
        editorContent.value = "Error";
      }
    }
  }
};

const checkUpdate = async () => {
  updateState.value = "checking";
  const ver = await Backend.CheckUpdate();
  if (ver.includes("Error") || ver.includes("Failed") || ver.includes("No tag")) {
    msg.value = "Check Failed";
    errorLog.value = ver;
    updateState.value = "idle";
    return;
  }
  remoteVer.value = ver;
  updateState.value = ver.replace("v", "") !== localVer.value.replace("v", "") ? "available" : "latest";
};

const performUpdate = async () => {
  updateState.value = "updating";
  msg.value = "Init Download...";
  const effectiveMirror = mirrorEnabled.value ? mirrorUrl.value : "";
  const res = await Backend.UpdateKernel(effectiveMirror);
  if (res === "Success") {
    coreExists.value = true;
    msg.value = "Updated!";
    localVer.value = remoteVer.value.replace("v", "");
    updateState.value = "success";
    setTimeout(() => updateState.value = "idle", 2000);
  } else {
    msg.value = "Failed";
    errorLog.value = cleanLog(res);
    updateState.value = "error";
  }
};

const addProfile = async () => {
  if (!newName.value || !newUrl.value) {
    msg.value = "Input missing";
    return;
  }
  isAddingProfile.value = true;
  msg.value = "Downloading Config...";
  const res = await Backend.AddProfile(newName.value, newUrl.value);
  isAddingProfile.value = false;
  if (res === "Success") {
    msg.value = "Success";
    newName.value = "";
    newUrl.value = "";
    showAddProfileModal.value = false;
    refreshData();
  } else {
    msg.value = "Error";
    errorLog.value = cleanLog(res);
  }
};

const switchProfile = async (id: string, e: any) => {
  e.stopPropagation();
  const res = await Backend.SelectProfile(id);
  if (res === "Success") {
    msg.value = "Switched";
    isProfileListExpanded.value = false;
    refreshData();
  } else {
    msg.value = "Error";
    errorLog.value = cleanLog(res);
  }
};

const deleteProfile = async (id: string, e: any) => {
  e.stopPropagation();
  if (confirm("Delete?")) {
    await Backend.DeleteProfile(id);
    refreshData();
  }
};

const updateActive = async (e: any) => {
  e.stopPropagation();
  if (isUpdatingProfile.value) return;
  isUpdatingProfile.value = true;
  msg.value = "Updating...";
  const res = await Backend.UpdateActiveProfile();
  isUpdatingProfile.value = false;
  if (res !== "Success") {
    msg.value = "Error";
    errorLog.value = cleanLog(res);
  } else {
    msg.value = "Updated";
    refreshData();
  }
};

const minimize = () => Backend.Minimize();
const minimizeToTray = () => Backend.MinimizeToTray();
const quitApp = () => Backend.Quit();

// Computed properties
const getStatusText = computed(() => {
  if (!coreExists.value) return "MISSING";
  if (msg.value === "ERROR") return "ERROR";
  if (!running.value) return "OFFLINE";
  if (tunMode.value && sysProxy.value) return "FULL MODE";
  if (tunMode.value) return "TUN MODE";
  if (sysProxy.value) return "PROXY MODE";
  return "ONLINE";
});

const getStatusGlow = computed(() => {
  if (!coreExists.value || msg.value === "ERROR") return "text-red-500 drop-shadow-[0_0_25px_rgba(220,38,38,0.8)]";
  if (!running.value) return "text-[#333] drop-shadow-none";
  if (tunMode.value && sysProxy.value) return "text-white drop-shadow-[0_0_35px_rgba(147,51,234,0.8)]";
  if (tunMode.value) return "text-white drop-shadow-[0_0_35px_rgba(37,99,235,0.8)]";
  if (sysProxy.value) return "text-white drop-shadow-[0_0_35px_rgba(168,85,247,0.8)]";
  return "text-white drop-shadow-[0_0_25px_rgba(255,255,255,0.5)]";
});

const getControlBg = computed(() => {
  if (tunMode.value && sysProxy.value) return "bg-gradient-to-br from-blue-600/40 via-purple-600/40 to-blue-900/40";
  if (tunMode.value) return "bg-blue-600/20";
  if (sysProxy.value) return "bg-purple-600/20";
  return "bg-transparent";
});

const isDrawerOpen = computed(() => activeDrawer.value !== 'none');
const otherProfiles = computed(() => profiles.value.filter(p => activeProfile.value && p.id !== activeProfile.value.id));
</script>

<template>
  <div class="h-screen w-screen relative bg-[#090909] text-white select-none border border-[#222] rounded-xl overflow-hidden font-sans flex flex-col shadow-2xl">
    <!-- Title Bar -->
    <div class="h-10 shrink-0 flex justify-between items-center px-4 bg-[#090909] z-70 relative border-b border-[#1a1a1a]" style="--wails-draggable: drag">
      <div class="text-[10px] font-bold tracking-[0.2em] text-[#666] flex items-center gap-2">
        <div :class="['w-1.5 h-1.5 rounded-full shadow-[0_0_8px_currentcolor]', coreExists ? 'bg-emerald-500 text-emerald-500' : 'bg-red-500 text-red-500']"></div> WINBOX
      </div>
      <div class="flex gap-2" style="--wails-draggable: no-drag">
        <button @click="minimize" class="text-[#666] p-1 w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/10 hover:text-white transition-colors"><i class="fas fa-minus text-sm"></i></button>
        <button @click="minimizeToTray" class="text-[#666] p-1 w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/10 hover:text-white transition-colors"><i class="fas fa-angle-down text-sm"></i></button>
      </div>
    </div>

    <!-- Main Content -->
    <div :class="['absolute inset-0 pt-16 px-6 pb-8 flex flex-col justify-between items-center transition-all duration-500', isDrawerOpen ? 'scale-95 opacity-50 blur-[2px]' : 'scale-100 opacity-100']">
      <!-- Active Profile Card -->
      <div class="w-full pt-4">
        <div class="text-[9px] font-bold text-[#444] mb-2 tracking-widest uppercase ml-1">Active Configuration</div>
        <div @click="activeDrawer = 'profiles'" class="w-full bg-[#131313] border border-[#222] rounded-2xl p-4 cursor-pointer group relative overflow-hidden h-20 flex items-center transition-all duration-300 hover:border-[#333] hover:shadow-[0_0_20px_rgba(255,255,255,0.03)] active:scale-[0.98]">
          <div class="flex justify-between items-center w-full z-10 relative">
            <div class="overflow-hidden mr-4">
              <div class="text-sm font-bold text-white mb-1 truncate">{{ activeProfile ? activeProfile.name : "Select Profile" }}</div>
              <div class="text-[10px] text-[#555] font-mono truncate group-hover:text-[#777] transition-colors">{{ activeProfile && activeProfile.updated ? `Updated: ${activeProfile.updated}` : "Tap to select" }}</div>
            </div>
            <div class="text-[#333] group-hover:text-blue-500 transition-colors duration-300"><i class="fas fa-chevron-down text-xs"></i></div>
          </div>
          <div v-if="running" class="absolute inset-0 bg-blue-500/5 animate-pulse pointer-events-none"></div>
        </div>
      </div>

      <!-- Dashboard Controls -->
      <div class="w-full flex-1 flex flex-col justify-center relative">
        <div :class="['w-full bg-[#111] border border-[#222] rounded-4xl p-8 flex flex-col gap-6 relative overflow-hidden transition-all duration-500', isProcessing ? 'opacity-80 pointer-events-none grayscale' : 'opacity-100']">
          <div :class="['absolute inset-0 blur-[60px] opacity-40 pointer-events-none transition-all duration-1000', getControlBg]"></div>
          <div class="text-center z-10 cursor-pointer" @click="() => { if (msg === 'ERROR' || errorLog) activeDrawer = 'logs' }">
            <div :class="['text-4xl font-black tracking-tighter transition-all duration-500 whitespace-nowrap', getStatusGlow]">{{ getStatusText }}</div>
            <div class="text-[9px] text-[#444] group-hover:text-[#666] font-mono uppercase tracking-widest mt-2 h-3 transition-colors">{{ msg === "ERROR" ? "VIEW ERROR LOGS" : msg }}</div>
          </div>
          <div class="h-px bg-[#222]/80 z-10 mx-auto w-[90%]"></div>
          <div class="flex flex-col gap-6 z-10 px-1">
            <!-- TUN MODE -->
            <div @click="handleToggle('tun')" class="flex items-center justify-between cursor-pointer group select-none py-1">
              <div class="flex items-center gap-4">
                <div :class="['w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-sm transition-all duration-500', tunMode ? 'bg-blue-600 text-white shadow-[0_0_20px_2px_rgba(37,99,235,0.6)]' : 'bg-[#1a1a1a] text-[#444] group-hover:text-[#666] group-hover:bg-[#222]']">
                  <i class="fas fa-shield-alt"></i>
                </div>
                <div class="flex flex-col min-w-0">
                  <div :class="['text-xs font-bold tracking-wide transition-colors duration-300 whitespace-nowrap', tunMode ? 'text-white' : 'text-[#555] group-hover:text-gray-400']">TUN MODE</div>
                  <div class="text-[9px] text-[#444] whitespace-nowrap group-hover:text-[#555] transition-colors">Virtual Network Interface</div>
                </div>
              </div>
              <div :class="['w-11 h-6 shrink-0 rounded-full transition-colors duration-300 relative', tunMode ? 'bg-blue-600' : 'bg-[#222] group-hover:bg-[#2a2a2a]']">
                <div :class="['absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-md', tunMode ? 'translate-x-5' : 'translate-x-0']"></div>
              </div>
            </div>
            <!-- SYSTEM PROXY -->
            <div @click="handleToggle('proxy')" class="flex items-center justify-between cursor-pointer group select-none py-1">
              <div class="flex items-center gap-4">
                <div :class="['w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-sm transition-all duration-500', sysProxy ? 'bg-purple-600 text-white shadow-[0_0_20px_2px_rgba(147,51,234,0.6)]' : 'bg-[#1a1a1a] text-[#444] group-hover:text-[#666] group-hover:bg-[#222]']">
                  <i class="fas fa-globe"></i>
                </div>
                <div class="flex flex-col min-w-0">
                  <div :class="['text-xs font-bold tracking-wide transition-colors duration-300 whitespace-nowrap', sysProxy ? 'text-white' : 'text-[#555] group-hover:text-gray-400']">SYSTEM PROXY</div>
                  <div class="text-[9px] text-[#444] whitespace-nowrap group-hover:text-[#555] transition-colors">Global HTTP Proxy</div>
                </div>
              </div>
              <div :class="['w-11 h-6 shrink-0 rounded-full transition-colors duration-300 relative', sysProxy ? 'bg-purple-600' : 'bg-[#222] group-hover:bg-[#2a2a2a]']">
                <div :class="['absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow-md', sysProxy ? 'translate-x-5' : 'translate-x-0']"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom Actions -->
      <div class="w-full flex gap-3 z-10 pt-4">
        <button @click="Backend.OpenDashboard" :disabled="!running" :class="['flex-1 h-12 rounded-xl text-xs font-bold tracking-wide border border-transparent transition-all duration-300 active:scale-95', running ? 'bg-blue-600 text-white hover:bg-blue-500 shadow-[0_0_30px_rgba(37,99,235,0.4)]' : 'bg-[#1a1a1a] text-[#444] border-[#222] cursor-not-allowed']">DASHBOARD</button>
        <button @click="activeDrawer = 'logs'" :class="['w-12 h-12 rounded-xl border bg-[#1a1a1a] text-[#666] flex items-center justify-center transition-all duration-300 hover:bg-[#222] hover:text-white active:scale-95', msg === 'ERROR' ? 'border-red-500 text-red-500 bg-red-900/10 shadow-[0_0_15px_rgba(220,38,38,0.3)]' : 'border-[#222]']"><i class="fas fa-file-lines"></i></button>
        <button @click="activeDrawer = 'settings'" class="w-12 h-12 rounded-xl border border-[#222] bg-[#1a1a1a] text-[#666] flex items-center justify-center transition-all duration-300 hover:bg-[#222] hover:text-white active:scale-95"><i class="fas fa-cog"></i></button>
        <button @click="quitApp" class="w-12 h-12 rounded-xl border border-[#222] bg-[#1a1a1a] text-[#666] flex items-center justify-center transition-all duration-300 hover:border-red-900/50 hover:text-red-500 hover:bg-red-900/10 active:scale-95"><i class="fas fa-power-off"></i></button>
      </div>
    </div>

    <!-- SETTINGS DRAWER -->
    <div :class="['absolute inset-x-0 top-10 bottom-0 z-40 bg-[#090909]/95 backdrop-blur-3xl flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]', activeDrawer === 'settings' ? 'translate-y-0' : 'translate-y-full']">
      <div class="h-10 shrink-0 flex justify-between items-center px-6 border-b border-[#222]">
        <h2 class="text-xs font-bold text-[#666] uppercase tracking-widest">System Settings</h2>
        <button @click="activeDrawer = 'none'" class="h-7 px-3 rounded-lg text-[11px] font-bold bg-blue-500/10 text-blue-500 border-none hover:bg-blue-500/20 transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95">DONE</button>
      </div>
      <div class="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar [&::-webkit-scrollbar]:hidden">
        <div class="bg-[#131313] p-5 rounded-xl border border-[#222] shadow-lg">
          <!-- Local Kernel -->
          <div class="flex justify-between items-center py-2 min-h-10 border-b border-[#222]/50 last:border-0">
            <span class="text-xs font-bold text-gray-400">Local Kernel</span>
            <div class="flex items-center gap-3">
              <span class="text-xs text-gray-500 font-mono">{{ localVer }}</span>
              <button v-if="updateState === 'checking'" disabled class="h-7 px-3 rounded-lg text-[11px] font-bold bg-[#1a1a1a] border border-[#333] text-gray-300 transition-all duration-200 flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed">
                <i class="fas fa-circle-notch fa-spin"></i>CHECKING
              </button>
              <button v-else-if="updateState === 'available'" @click="performUpdate" class="h-7 px-3 rounded-lg text-[11px] font-bold bg-blue-600 text-white hover:bg-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.4)] border border-blue-500 transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95 animate-pulse">UP TO {{ remoteVer }}</button>
              <button v-else-if="updateState === 'updating'" disabled class="h-7 px-3 rounded-lg text-[11px] font-bold bg-[#1a1a1a] border border-[#333] text-gray-300 transition-all duration-200 flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed relative overflow-hidden w-24">
                <div class="absolute inset-0 bg-blue-600/30 transition-all duration-300" :style="{ width: `${downloadProgress}%` }"></div>
                <span class="relative z-10">{{ downloadProgress }}%</span>
              </button>
              <button v-else-if="updateState === 'success'" disabled class="h-7 px-3 rounded-lg text-[11px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 transition-all duration-200 flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed">UPDATED</button>
              <button v-else-if="updateState === 'latest'" disabled class="h-7 px-3 rounded-lg text-[11px] font-bold bg-[#1a1a1a] border border-[#333] text-gray-300 transition-all duration-200 flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed opacity-50">LATEST</button>
              <button v-else @click="checkUpdate" :class="['h-7 px-3 rounded-lg text-[11px] font-bold bg-[#1a1a1a] border border-[#333] text-gray-300 hover:bg-[#222] transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95', !coreExists ? 'border-yellow-600 text-yellow-500' : '']">{{ coreExists ? "CHECK" : "DOWNLOAD" }}</button>
            </div>
          </div>
          
          <!-- GitHub Mirror -->
          <div class="flex justify-between items-center py-2 min-h-10 border-b border-[#222]/50 last:border-0">
            <span class="text-xs font-bold text-gray-400">GitHub Mirror</span>
            <div class="flex items-center gap-2">
              <div @click="handleMirrorToggle" :class="['w-8 h-4 rounded-full p-0.5 cursor-pointer transition-colors duration-300', mirrorEnabled ? 'bg-blue-600' : 'bg-[#333]']">
                <div :class="['w-3 h-3 bg-white rounded-full transition-transform duration-300', mirrorEnabled ? 'translate-x-4' : 'translate-x-0']"></div>
              </div>
            </div>
          </div>
          
          <div :class="['expand-wrapper', mirrorEnabled ? 'open' : '']">
            <div class="expand-inner">
              <div class="flex justify-between items-center py-2 pl-4 border-l-2 border-[#222]">
                <span class="text-xs font-bold text-gray-400">Mirror Config</span>
                <button @click="openEditor('mirror')" class="h-7 px-3 rounded-lg text-[11px] font-bold bg-[#1a1a1a] border border-[#333] text-gray-300 hover:bg-[#222] transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95">EDIT</button>
              </div>
            </div>
          </div>

          <!-- Start With Windows -->
          <div class="flex justify-between items-center py-2 min-h-10 border-b border-[#222]/50 last:border-0">
            <span class="text-xs font-bold text-gray-400">Start With Windows</span>
            <div @click="handleStartOnBootToggle" :class="['w-8 h-4 rounded-full p-0.5 cursor-pointer transition-colors duration-300', startOnBoot ? 'bg-blue-600' : 'bg-[#333]']">
              <div :class="['w-3 h-3 bg-white rounded-full transition-transform duration-300', startOnBoot ? 'translate-x-4' : 'translate-x-0']"></div>
            </div>
          </div>
          
          <!-- Auto Connect -->
          <div class="flex justify-between items-center py-2 min-h-10 border-b border-[#222]/50 last:border-0">
            <span class="text-xs font-bold text-gray-400">Auto Connect</span>
            <div @click="handleAutoConnectToggle" :class="['w-8 h-4 rounded-full p-0.5 cursor-pointer transition-colors duration-300', autoConnect ? 'bg-blue-600' : 'bg-[#333]']">
              <div :class="['w-3 h-3 bg-white rounded-full transition-transform duration-300', autoConnect ? 'translate-x-4' : 'translate-x-0']"></div>
            </div>
          </div>
          
          <div :class="['expand-wrapper', autoConnect ? 'open' : '']">
            <div class="expand-inner">
              <div class="flex justify-between items-center py-2 pl-4 border-l-2 border-[#222]">
                <span class="text-xs font-bold text-gray-400">Startup Mode</span>
                <select :value="autoConnectMode" @change="handleAutoConnectModeChange" class="bg-[#1a1a1a] text-[11px] text-gray-300 border border-[#333] rounded-lg px-2 outline-none focus:border-blue-500/50 appearance-none text-center font-bold w-20 cursor-pointer h-7">
                  <option value="full">FULL</option>
                  <option value="tun">TUN</option>
                  <option value="proxy">PROXY</option>
                </select>
              </div>
            </div>
          </div>
          
          <div class="h-px bg-[#222] my-2"></div>
          
          <!-- TUN Config -->
          <div class="flex justify-between items-center py-2 min-h-10 border-b border-[#222]/50 last:border-0">
            <span class="text-xs font-bold text-gray-400">TUN Config</span>
            <button @click="openEditor('tun')" class="h-7 px-3 rounded-lg text-[11px] font-bold bg-[#1a1a1a] border border-[#333] text-gray-300 hover:bg-[#222] transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95">EDIT</button>
          </div>
          <!-- Mixed Config -->
          <div class="flex justify-between items-center py-2 min-h-10">
            <span class="text-xs font-bold text-gray-400">Mixed Config</span>
            <button @click="openEditor('mixed')" class="h-7 px-3 rounded-lg text-[11px] font-bold bg-[#1a1a1a] border border-[#333] text-gray-300 hover:bg-[#222] transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95">EDIT</button>
          </div>
        </div>
      </div>
    </div>

    <!-- PROFILES DRAWER -->
    <div :class="['absolute inset-x-0 top-10 bottom-0 z-40 bg-[#090909]/95 backdrop-blur-3xl flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]', activeDrawer === 'profiles' ? 'translate-y-0' : '-translate-y-full']">
      <div class="h-10 shrink-0 flex justify-between items-center px-6 border-b border-[#222]">
        <h2 class="text-xs font-bold text-[#666] uppercase tracking-widest">Profiles Manager</h2>
        <button @click="activeDrawer = 'none'" class="h-7 px-3 rounded-lg text-[11px] font-bold bg-blue-500/10 text-blue-500 border-none hover:bg-blue-500/20 transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95">DONE</button>
      </div>
      
      <div class="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar [&::-webkit-scrollbar]:hidden">
        <!-- Collapsible Profile Card -->
        <div class="bg-[#131313] rounded-2xl border border-[#222] shadow-[0_0_30px_rgba(0,0,0,0.3)] overflow-hidden transition-all duration-300">
          <!-- Header: Current Profile Name -->
          <div :class="['p-4 flex justify-between items-center cursor-pointer transition-colors', otherProfiles.length > 0 ? 'hover:bg-[#1a1a1a]' : '']" @click="otherProfiles.length > 0 && (isProfileListExpanded = !isProfileListExpanded)">
            <span class="text-xs font-bold text-gray-400">Current Profile</span>
            <div class="flex items-center gap-3">
              <span class="text-xs text-blue-400 font-bold font-mono truncate max-w-37.5">{{ activeProfile ? activeProfile.name : "None" }}</span>
              <i v-if="otherProfiles.length > 0" :class="['fas fa-chevron-down text-xs text-[#444] transition-transform duration-300', isProfileListExpanded ? 'rotate-180' : '']"></i>
            </div>
          </div>
          
          <!-- Dropdown: Other Profiles -->
          <div :class="['expand-wrapper', (isProfileListExpanded && otherProfiles.length > 0) ? 'open' : '']">
            <div class="expand-inner">
              <div class="border-t border-[#222] bg-[#0f0f0f]">
                <div v-for="p in otherProfiles" :key="p.id" class="p-3 border-b border-[#222]/50 last:border-0 flex justify-between items-center hover:bg-[#161616] transition-colors pl-6">
                  <div class="overflow-hidden pr-3">
                    <div class="text-xs font-bold text-gray-300 truncate mb-0.5">{{ p.name }}</div>
                    <div class="text-[9px] text-[#555] truncate font-mono">{{ p.url }}</div>
                  </div>
                  <div class="flex gap-2">
                    <button @click="switchProfile(p.id, $event)" class="h-7 px-3 rounded-lg text-[11px] font-bold bg-[#1a1a1a] border border-[#333] text-gray-300 hover:bg-[#222] transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95">SWITCH</button>
                    <button @click="deleteProfile(p.id, $event)" class="w-7 h-7 rounded-lg text-[#444] hover:text-red-500 hover:bg-red-500/10 transition-colors flex items-center justify-center">
                      <i class="fas fa-trash text-[10px]"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Footer: Update Row -->
          <div class="px-4 pb-4 pt-0">
            <div class="flex justify-between items-center h-10 border-t border-[#222] pt-3 mt-1">
              <span class="text-xs font-bold text-gray-400">Subscription</span>
              <div class="flex items-center gap-3">
                <span class="text-[10px] text-[#555] font-mono">{{ activeProfile && activeProfile.updated ? activeProfile.updated : "Never" }}</span>
                <button @click="updateActive" :disabled="!activeProfile || isUpdatingProfile" class="h-7 px-3 rounded-lg text-[11px] font-bold bg-[#1a1a1a] border border-[#333] text-gray-300 hover:bg-[#222] transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed">
                  <i v-if="isUpdatingProfile" class="fas fa-circle-notch fa-spin"></i>
                  <i v-else class="fas fa-sync-alt"></i>
                  {{ isUpdatingProfile ? "UPDATING" : "UPDATE" }}
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Add Profile Row -->
        <div class="bg-[#131313] p-4 rounded-2xl border border-[#222] shadow-lg flex justify-between items-center">
          <span class="text-xs font-bold text-gray-400">Add New Profile</span>
          <button @click="showAddProfileModal = true" class="h-7 px-3 rounded-lg text-[11px] font-bold bg-blue-600 text-white hover:bg-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.4)] border border-blue-500 transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95">
            <i class="fas fa-plus"></i>ADD
          </button>
        </div>
      </div>
    </div>

    <!-- ADD PROFILE MODAL -->
    <div :class="['absolute inset-0 z-80 bg-black/60 backdrop-blur-sm flex items-center justify-center transition-opacity duration-300', showAddProfileModal ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none']">
      <div :class="['w-[85%] bg-[#111] border border-[#333] rounded-2xl shadow-2xl overflow-hidden transform transition-all duration-300', showAddProfileModal ? 'scale-100' : 'scale-95']">
        <div class="h-10 flex justify-between items-center px-4 border-b border-[#222] bg-[#090909]">
          <h2 class="text-xs font-bold text-[#666] uppercase tracking-widest">NEW CONFIG</h2>
          <button @click="showAddProfileModal = false" class="text-[#666] hover:text-white transition-colors"><i class="fas fa-times"></i></button>
        </div>
        <div class="p-5 space-y-4">
          <input v-model="newName" placeholder="Profile Name" class="w-full bg-[#050505] border border-[#222] rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-blue-500/50 transition-all" />
          <input v-model="newUrl" placeholder="Subscription URL" class="w-full bg-[#050505] border border-[#222] rounded-xl px-4 py-3 text-xs text-[#666] focus:outline-none focus:border-blue-500/50 font-mono transition-all" />
          <button @click="addProfile" :disabled="isAddingProfile" class="w-full h-9 rounded-lg text-[11px] font-bold bg-blue-600 text-white hover:bg-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.4)] border border-blue-500 transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed">
            <i v-if="isAddingProfile" class="fas fa-circle-notch fa-spin"></i>
            {{ isAddingProfile ? "DOWNLOADING..." : "ADD PROFILE" }}
          </button>
        </div>
      </div>
    </div>

    <!-- EDITOR MODAL -->
    <div :class="['absolute inset-0 z-80 bg-black/60 backdrop-blur-sm flex items-center justify-center transition-opacity duration-300', showEditor ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none']">
      <div :class="['w-[90%] h-[70%] bg-[#111] border border-[#333] rounded-2xl shadow-2xl flex flex-col overflow-hidden transform transition-all duration-300', showEditor ? 'scale-100' : 'scale-95']">
        <div class="h-10 shrink-0 flex justify-between items-center px-4 border-b border-[#222] bg-[#090909]">
          <h2 class="text-xs font-bold text-[#666] uppercase tracking-widest">EDIT {{ editingType.toUpperCase() }}</h2>
          <div class="flex gap-2">
            <button @click="resetEditor" class="h-7 px-3 rounded-lg text-[11px] font-bold text-yellow-500 border border-yellow-900/30 hover:bg-yellow-900/10 bg-[#1a1a1a] transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95">RESET</button>
            <button @click="showEditor = false" class="h-7 px-3 rounded-lg text-[11px] font-bold bg-[#1a1a1a] border border-[#333] text-gray-300 hover:bg-[#222] transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95">CANCEL</button>
            <button @click="saveEditor" :class="['h-7 px-3 rounded-lg text-[11px] font-bold transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95', saveBtnText === 'SAVED' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-blue-600 text-white hover:bg-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.4)] border border-blue-500']">{{ saveBtnText }}</button>
          </div>
        </div>
        <div class="flex-1 p-4 bg-[#050505] relative">
          <textarea v-model="editorContent" class="w-full h-full bg-transparent text-xs font-mono text-gray-300 focus:outline-none resize-none custom-scrollbar" spellcheck="false"></textarea>
        </div>
      </div>
    </div>

    <!-- LOGS DRAWER -->
    <div :class="['absolute inset-x-0 bottom-0 top-10 z-60 bg-[#090909]/95 backdrop-blur-3xl flex flex-col transition-transform duration-500', activeDrawer === 'logs' ? 'translate-y-0' : 'translate-y-full']">
      <div class="h-12 border-b border-[#222] flex items-center justify-between px-6">
        <h2 class="text-xs font-bold text-[#666] uppercase tracking-widest">LOGS</h2>
        <button @click="activeDrawer = 'none'" class="h-7 px-3 rounded-lg text-[11px] font-bold bg-[#1a1a1a] border border-[#333] text-gray-300 hover:bg-[#222] transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95">CLOSE</button>
      </div>
      <div class="flex-1 overflow-y-auto p-6 bg-[#050505] custom-scrollbar [&::-webkit-scrollbar]:hidden">
        <pre class="text-[10px] text-gray-400 font-mono whitespace-pre-wrap break-all">{{ errorLog || "No logs." }}</pre>
      </div>
      <div class="p-4 border-t border-[#222] flex justify-end">
        <button @click="copyLog" :class="['h-7 px-3 rounded-lg text-[11px] font-bold transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95', copyState === 'COPIED!' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-[#1a1a1a] border border-[#333] text-gray-300 hover:bg-[#222]']">{{ copyState }}</button>
      </div>
    </div>
  </div>
</template>
