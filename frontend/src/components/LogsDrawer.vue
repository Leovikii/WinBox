<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { WButton } from '@/components/ui'
import * as Backend from '../../wailsjs/go/internal/App'

const props = defineProps<{
  isOpen: boolean
  errorLog: string
}>()

const emit = defineEmits<{
  close: []
}>()

type LogTab = 'app' | 'kernel'

const activeTab = ref<LogTab>('app')
const copyState = ref("COPY")
const appLogContent = ref("")
const kernelLogContent = ref("")
const isLoading = ref(false)
const autoRefreshEnabled = ref(true)
let refreshInterval: number | null = null

const loadAppLog = async () => {
  try {
    const content = await Backend.GetAppLog()
    appLogContent.value = content
  } catch (error) {
    appLogContent.value = "> Failed to load app log"
  }
}

const loadKernelLog = async () => {
  try {
    const content = await Backend.GetKernelLog()
    kernelLogContent.value = content
  } catch (error) {
    kernelLogContent.value = "> Failed to load kernel log"
  }
}

const loadLogs = async () => {
  if (isLoading.value) return // Prevent concurrent loads

  // Only update loading state if manually triggered, not during auto-refresh
  const wasLoading = isLoading.value
  if (!wasLoading) {
    isLoading.value = true
  }

  if (activeTab.value === 'app') {
    await loadAppLog()
  } else {
    await loadKernelLog()
  }

  if (!wasLoading) {
    isLoading.value = false
  }
}

const switchTab = async (tab: LogTab) => {
  activeTab.value = tab
  await loadLogs()
}

const clearLog = async () => {
  if (activeTab.value === 'app') {
    const res = await Backend.ClearAppLog()
    if (res === "Success") {
      appLogContent.value = ""
      await loadAppLog()
    }
  } else {
    const res = await Backend.ClearKernelLog()
    if (res === "Success") {
      kernelLogContent.value = ""
      await loadKernelLog()
    }
  }
}

const copyLog = () => {
  const textToCopy = activeTab.value === 'app' ? appLogContent.value : kernelLogContent.value
  navigator.clipboard.writeText(textToCopy)
  copyState.value = "COPIED!"
  setTimeout(() => copyState.value = "COPY", 2000)
}

// Use computed property to avoid unnecessary re-renders
const currentLogContent = computed(() => {
  return activeTab.value === 'app' ? appLogContent.value : kernelLogContent.value
})

const toggleAutoRefresh = () => {
  autoRefreshEnabled.value = !autoRefreshEnabled.value
  if (autoRefreshEnabled.value) {
    startAutoRefresh()
  } else {
    stopAutoRefresh()
  }
}

const startAutoRefresh = () => {
  stopAutoRefresh() // Clear any existing interval

  // Refresh every 3 seconds when auto-refresh is enabled
  refreshInterval = window.setInterval(() => {
    if (props.isOpen && autoRefreshEnabled.value) {
      loadLogs()
    }
  }, 3000)
}

const stopAutoRefresh = () => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
    refreshInterval = null
  }
}

onMounted(() => {
  loadLogs()
  if (autoRefreshEnabled.value) {
    startAutoRefresh()
  }
})

onUnmounted(() => {
  stopAutoRefresh()
})

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    loadLogs()
    if (autoRefreshEnabled.value) {
      startAutoRefresh()
    }
  } else {
    stopAutoRefresh()
  }
})

watch(() => activeTab.value, () => {
  // Reload when switching tabs
  loadLogs()
})
</script>

<template>
  <div class="w-full h-full flex flex-col bg-[#090909]">
    <div class="h-16 shrink-0 flex items-center justify-between px-6 border-b border-[#222]/50">
      <h2 class="text-xs font-bold text-[#555] uppercase tracking-[0.2em]">Runtime Logs</h2>
      <div class="flex gap-2">
        <WButton
          :variant="autoRefreshEnabled ? 'primary' : 'secondary'"
          size="sm"
          @click="toggleAutoRefresh"
        >
          {{ autoRefreshEnabled ? 'AUTO: ON' : 'AUTO: OFF' }}
        </WButton>
        <WButton
          variant="secondary"
          size="sm"
          @click="loadLogs"
          :disabled="isLoading"
        >
          {{ isLoading ? 'LOADING...' : 'REFRESH' }}
        </WButton>
      </div>
    </div>

    <div class="flex gap-2 px-6 py-3 border-b border-[#222]/50">
      <WButton
        :variant="activeTab === 'app' ? 'primary' : 'secondary'"
        size="sm"
        @click="switchTab('app')"
      >
        APP LOGS
      </WButton>
      <WButton
        :variant="activeTab === 'kernel' ? 'primary' : 'secondary'"
        size="sm"
        @click="switchTab('kernel')"
      >
        KERNEL LOGS
      </WButton>
    </div>

    <div class="flex-1 overflow-y-auto p-4 pb-28 custom-scrollbar [&::-webkit-scrollbar]:hidden">
      <pre class="text-[10px] text-gray-400 font-mono whitespace-pre-wrap break-all leading-relaxed">{{ currentLogContent || "> No log file available." }}</pre>
    </div>

    <div class="absolute bottom-24 right-4 z-10 flex gap-2">
      <WButton
        variant="warning"
        size="sm"
        class="shadow-lg backdrop-blur-md bg-[#222]/80"
        @click="clearLog"
      >
        CLEAR
      </WButton>
      <WButton
        :variant="copyState === 'COPIED!' ? 'success' : 'secondary'"
        size="sm"
        class="shadow-lg backdrop-blur-md bg-[#222]/80"
        @click="copyLog"
      >
        {{ copyState }}
      </WButton>
    </div>
  </div>
</template>