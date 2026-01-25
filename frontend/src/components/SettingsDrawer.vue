<script setup lang="ts">
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
}>()

const emit = defineEmits<{
  'close': []
  'check-update': []
  'perform-update': []
  'toggle-mirror': []
  'toggle-start-on-boot': []
  'toggle-auto-connect': []
  'change-auto-connect-mode': [e: Event]
  'open-editor': [type: 'tun' | 'mixed' | 'mirror']
  'save-editor': []
  'reset-editor': []
  'close-editor': []
  'update:editorContent': [value: string]
}>()
</script>

<template>
  <div :class="['absolute inset-x-0 top-10 bottom-0 z-40 bg-[#090909]/95 backdrop-blur-3xl flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]', isOpen ? 'translate-y-0' : 'translate-y-full']">
    <div class="h-10 shrink-0 flex justify-between items-center px-6 border-b border-[#222]">
      <h2 class="text-xs font-bold text-[#666] uppercase tracking-widest">System Settings</h2>
      <button @click="emit('close')" class="h-7 px-3 rounded-lg text-[11px] font-bold bg-blue-500/10 text-blue-500 border-none hover:bg-blue-500/20 transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95">DONE</button>
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
            <button v-else-if="updateState === 'available'" @click="emit('perform-update')" class="h-7 px-3 rounded-lg text-[11px] font-bold bg-blue-600 text-white hover:bg-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.4)] border border-blue-500 transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95 animate-pulse">UP TO {{ remoteVer }}</button>
            <button v-else-if="updateState === 'updating'" disabled class="h-7 px-3 rounded-lg text-[11px] font-bold bg-[#1a1a1a] border border-[#333] text-gray-300 transition-all duration-200 flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed relative overflow-hidden w-24">
              <div class="absolute inset-0 bg-blue-600/30 transition-all duration-300" :style="{ width: `${downloadProgress}%` }"></div>
              <span class="relative z-10">{{ downloadProgress }}%</span>
            </button>
            <button v-else-if="updateState === 'success'" disabled class="h-7 px-3 rounded-lg text-[11px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 transition-all duration-200 flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed">UPDATED</button>
            <button v-else-if="updateState === 'latest'" disabled class="h-7 px-3 rounded-lg text-[11px] font-bold bg-[#1a1a1a] border border-[#333] text-gray-300 transition-all duration-200 flex items-center justify-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed opacity-50">LATEST</button>
            <button v-else @click="emit('check-update')" :class="['h-7 px-3 rounded-lg text-[11px] font-bold bg-[#1a1a1a] border border-[#333] text-gray-300 hover:bg-[#222] transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95', !coreExists ? 'border-yellow-600 text-yellow-500' : '']">{{ coreExists ? "CHECK" : "DOWNLOAD" }}</button>
          </div>
        </div>

        <!-- GitHub Mirror -->
        <div class="flex justify-between items-center py-2 min-h-10 border-b border-[#222]/50 last:border-0">
          <span class="text-xs font-bold text-gray-400">GitHub Mirror</span>
          <div class="flex items-center gap-2">
            <div @click="emit('toggle-mirror')" :class="['w-8 h-4 rounded-full p-0.5 cursor-pointer transition-colors duration-300', mirrorEnabled ? 'bg-blue-600' : 'bg-[#333]']">
              <div :class="['w-3 h-3 bg-white rounded-full transition-transform duration-300', mirrorEnabled ? 'translate-x-4' : 'translate-x-0']"></div>
            </div>
          </div>
        </div>

        <div :class="['expand-wrapper', mirrorEnabled ? 'open' : '']">
          <div class="expand-inner">
            <div class="flex justify-between items-center py-2 pl-4 border-l-2 border-[#222]">
              <span class="text-xs font-bold text-gray-400">Mirror Config</span>
              <button @click="emit('open-editor', 'mirror')" class="h-7 px-3 rounded-lg text-[11px] font-bold bg-[#1a1a1a] border border-[#333] text-gray-300 hover:bg-[#222] transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95">EDIT</button>
            </div>
          </div>
        </div>

        <!-- Start With Windows -->
        <div class="flex justify-between items-center py-2 min-h-10 border-b border-[#222]/50 last:border-0">
          <span class="text-xs font-bold text-gray-400">Start With Windows</span>
          <div @click="emit('toggle-start-on-boot')" :class="['w-8 h-4 rounded-full p-0.5 cursor-pointer transition-colors duration-300', startOnBoot ? 'bg-blue-600' : 'bg-[#333]']">
            <div :class="['w-3 h-3 bg-white rounded-full transition-transform duration-300', startOnBoot ? 'translate-x-4' : 'translate-x-0']"></div>
          </div>
        </div>

        <!-- Auto Connect -->
        <div class="flex justify-between items-center py-2 min-h-10 border-b border-[#222]/50 last:border-0">
          <span class="text-xs font-bold text-gray-400">Auto Connect</span>
          <div @click="emit('toggle-auto-connect')" :class="['w-8 h-4 rounded-full p-0.5 cursor-pointer transition-colors duration-300', autoConnect ? 'bg-blue-600' : 'bg-[#333]']">
            <div :class="['w-3 h-3 bg-white rounded-full transition-transform duration-300', autoConnect ? 'translate-x-4' : 'translate-x-0']"></div>
          </div>
        </div>

        <div :class="['expand-wrapper', autoConnect ? 'open' : '']">
          <div class="expand-inner">
            <div class="flex justify-between items-center py-2 pl-4 border-l-2 border-[#222]">
              <span class="text-xs font-bold text-gray-400">Startup Mode</span>
              <select :value="autoConnectMode" @change="emit('change-auto-connect-mode', $event)" class="bg-[#1a1a1a] text-[11px] text-gray-300 border border-[#333] rounded-lg px-2 outline-none focus:border-blue-500/50 appearance-none text-center font-bold w-20 cursor-pointer h-7">
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
          <button @click="emit('open-editor', 'tun')" class="h-7 px-3 rounded-lg text-[11px] font-bold bg-[#1a1a1a] border border-[#333] text-gray-300 hover:bg-[#222] transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95">EDIT</button>
        </div>
        <!-- Mixed Config -->
        <div class="flex justify-between items-center py-2 min-h-10">
          <span class="text-xs font-bold text-gray-400">Mixed Config</span>
          <button @click="emit('open-editor', 'mixed')" class="h-7 px-3 rounded-lg text-[11px] font-bold bg-[#1a1a1a] border border-[#333] text-gray-300 hover:bg-[#222] transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95">EDIT</button>
        </div>
      </div>
    </div>
  </div>

  <!-- EDITOR MODAL -->
  <div :class="['absolute inset-0 z-80 bg-black/60 backdrop-blur-sm flex items-center justify-center transition-opacity duration-300', showEditor ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none']">
    <div :class="['w-[90%] h-[70%] bg-[#111] border border-[#333] rounded-2xl shadow-2xl flex flex-col overflow-hidden transform transition-all duration-300', showEditor ? 'scale-100' : 'scale-95']">
      <div class="h-10 shrink-0 flex justify-between items-center px-4 border-b border-[#222] bg-[#090909]">
        <h2 class="text-xs font-bold text-[#666] uppercase tracking-widest">EDIT {{ editingType.toUpperCase() }}</h2>
        <div class="flex gap-2">
          <button @click="emit('reset-editor')" class="h-7 px-3 rounded-lg text-[11px] font-bold text-yellow-500 border border-yellow-900/30 hover:bg-yellow-900/10 bg-[#1a1a1a] transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95">RESET</button>
          <button @click="emit('close-editor')" class="h-7 px-3 rounded-lg text-[11px] font-bold bg-[#1a1a1a] border border-[#333] text-gray-300 hover:bg-[#222] transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95">CANCEL</button>
          <button @click="emit('save-editor')" :class="['h-7 px-3 rounded-lg text-[11px] font-bold transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95', saveBtnText === 'SAVED' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-blue-600 text-white hover:bg-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.4)] border border-blue-500']">{{ saveBtnText }}</button>
        </div>
      </div>
      <div class="flex-1 p-4 bg-[#050505] relative">
        <textarea :value="editorContent" @input="emit('update:editorContent', ($event.target as HTMLTextAreaElement).value)" class="w-full h-full bg-transparent text-xs font-mono text-gray-300 focus:outline-none resize-none custom-scrollbar" spellcheck="false"></textarea>
      </div>
    </div>
  </div>
</template>
