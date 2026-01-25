<script setup lang="ts">
defineProps<{
  isOpen: boolean
  profiles: any[]
  activeProfile: any
  otherProfiles: any[]
  isUpdatingProfile: boolean
  isProfileListExpanded: boolean
  showAddProfileModal: boolean
  newName: string
  newUrl: string
  isAddingProfile: boolean
}>()

const emit = defineEmits<{
  'close': []
  'switch-profile': [id: string, e: any]
  'delete-profile': [id: string, e: any]
  'update-active': [e: any]
  'toggle-list': []
  'open-add-modal': []
  'update:newName': [value: string]
  'update:newUrl': [value: string]
  'update:showAddProfileModal': [value: boolean]
  'add-profile': []
}>()
</script>

<template>
  <div :class="['absolute inset-x-0 top-10 bottom-0 z-40 bg-[#090909]/95 backdrop-blur-3xl flex flex-col transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]', isOpen ? 'translate-y-0' : '-translate-y-full']">
    <div class="h-10 shrink-0 flex justify-between items-center px-6 border-b border-[#222]">
      <h2 class="text-xs font-bold text-[#666] uppercase tracking-widest">Profiles Manager</h2>
      <button @click="emit('close')" class="h-7 px-3 rounded-lg text-[11px] font-bold bg-blue-500/10 text-blue-500 border-none hover:bg-blue-500/20 transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95">DONE</button>
    </div>

    <div class="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar [&::-webkit-scrollbar]:hidden">
      <!-- Collapsible Profile Card -->
      <div class="bg-[#131313] rounded-2xl border border-[#222] shadow-[0_0_30px_rgba(0,0,0,0.3)] overflow-hidden transition-all duration-300">
        <!-- Header: Current Profile Name -->
        <div :class="['p-4 flex justify-between items-center cursor-pointer transition-colors', otherProfiles.length > 0 ? 'hover:bg-[#1a1a1a]' : '']" @click="otherProfiles.length > 0 && emit('toggle-list')">
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
                  <button @click="emit('switch-profile', p.id, $event)" class="h-7 px-3 rounded-lg text-[11px] font-bold bg-[#1a1a1a] border border-[#333] text-gray-300 hover:bg-[#222] transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95">SWITCH</button>
                  <button @click="emit('delete-profile', p.id, $event)" class="w-7 h-7 rounded-lg text-[#444] hover:text-red-500 hover:bg-red-500/10 transition-colors flex items-center justify-center">
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
              <button @click="emit('update-active', $event)" :disabled="!activeProfile || isUpdatingProfile" class="h-7 px-3 rounded-lg text-[11px] font-bold bg-[#1a1a1a] border border-[#333] text-gray-300 hover:bg-[#222] transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed">
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
        <button @click="emit('open-add-modal')" class="h-7 px-3 rounded-lg text-[11px] font-bold bg-blue-600 text-white hover:bg-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.4)] border border-blue-500 transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95">
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
        <button @click="emit('update:showAddProfileModal', false)" class="text-[#666] hover:text-white transition-colors"><i class="fas fa-times"></i></button>
      </div>
      <div class="p-5 space-y-4">
        <input :value="newName" @input="emit('update:newName', ($event.target as HTMLInputElement).value)" placeholder="Profile Name" class="w-full bg-[#050505] border border-[#222] rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-blue-500/50 transition-all" />
        <input :value="newUrl" @input="emit('update:newUrl', ($event.target as HTMLInputElement).value)" placeholder="Subscription URL" class="w-full bg-[#050505] border border-[#222] rounded-xl px-4 py-3 text-xs text-[#666] focus:outline-none focus:border-blue-500/50 font-mono transition-all" />
        <button @click="emit('add-profile')" :disabled="isAddingProfile" class="w-full h-9 rounded-lg text-[11px] font-bold bg-blue-600 text-white hover:bg-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.4)] border border-blue-500 transition-all duration-200 flex items-center justify-center gap-1.5 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed">
          <i v-if="isAddingProfile" class="fas fa-circle-notch fa-spin"></i>
          {{ isAddingProfile ? "DOWNLOADING..." : "ADD PROFILE" }}
        </button>
      </div>
    </div>
  </div>
</template>
