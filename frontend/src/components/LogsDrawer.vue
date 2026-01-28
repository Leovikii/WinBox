<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { WButton } from '@/components/ui'
import * as Backend from '../../wailsjs/go/internal/App'

const props = defineProps<{
  isOpen: boolean
  errorLog: string
  logAutoRefresh: boolean
}>()

const emit = defineEmits<{
  close: []
  'update:logAutoRefresh': [value: boolean]
}>()

type LogTab = 'app' | 'kernel'

const activeTab = ref<LogTab>('app')
const copyState = ref("COPY")
const appLogContent = ref("")
const kernelLogContent = ref("")
const isLoading = ref(false)
const isFetching = ref(false)
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

const loadLogs = async (silent = false) => {
  if (isFetching.value) return

  isFetching.value = true
  if (!silent) {
    isLoading.value = true
  }

  if (activeTab.value === 'app') {
    await loadAppLog()
  } else {
    await loadKernelLog()
  }

  if (!silent) {
    isLoading.value = false
  }
  isFetching.value = false
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

const currentLogContent = computed(() => {
  return activeTab.value === 'app' ? appLogContent.value : kernelLogContent.value
})

const processedLogContent = computed(() => {
  const content = currentLogContent.value
  if (!content) return []

  if (activeTab.value === 'kernel') {
    return parseAnsiToHtml(content)
  }
  return [{ text: content, color: '#9ca3af' }]
})

const parseAnsiToHtml = (text: string): Array<{ text: string; color: string }> => {
  const result: Array<{ text: string; color: string }> = []
  const ansiRegex = /\x1b\[([0-9;]*)m/g

  const colorMap: Record<string, string> = {
    '30': '#000000', '31': '#ef4444', '32': '#10b981', '33': '#f59e0b',
    '34': '#3b82f6', '35': '#a855f7', '36': '#06b6d4', '37': '#d1d5db',
    '90': '#6b7280', '91': '#f87171', '92': '#34d399', '93': '#fbbf24',
    '94': '#60a5fa', '95': '#c084fc', '96': '#22d3ee', '97': '#f3f4f6'
  }

  let currentColor = '#9ca3af'
  let lastIndex = 0
  let match

  while ((match = ansiRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const textSegment = text.substring(lastIndex, match.index)
      if (textSegment) {
        result.push({ text: textSegment, color: currentColor })
      }
    }

    const codes = match[1].split(';')
    for (const code of codes) {
      if (code === '0' || code === '') {
        currentColor = '#9ca3af'
      } else if (colorMap[code]) {
        currentColor = colorMap[code]
      }
    }

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    result.push({ text: text.substring(lastIndex), color: currentColor })
  }

  return result
}

const toggleAutoRefresh = async () => {
  const newValue = !props.logAutoRefresh
  emit('update:logAutoRefresh', newValue)
  await Backend.SetLogAutoRefresh(newValue)

  if (newValue) {
    startAutoRefresh()
  } else {
    stopAutoRefresh()
  }
}

const startAutoRefresh = () => {
  stopAutoRefresh()

  refreshInterval = window.setInterval(() => {
    if (props.isOpen && props.logAutoRefresh) {
      loadLogs(true)
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
  if (props.logAutoRefresh) {
    startAutoRefresh()
  }
})

onUnmounted(() => {
  stopAutoRefresh()
})

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    loadLogs()
    if (props.logAutoRefresh) {
      startAutoRefresh()
    }
  } else {
    stopAutoRefresh()
  }
})

watch(() => activeTab.value, () => {
  loadLogs()
})
</script>

<template>
  <div class="w-full h-full flex flex-col bg-[#090909]">
    <div class="h-16 shrink-0 flex items-center justify-between px-6 border-b border-[#222]/50">
      <h2 class="text-xs font-bold text-[#555] uppercase tracking-[0.2em]">Runtime Logs</h2>
      <div class="flex gap-2">
        <WButton
          :variant="logAutoRefresh ? 'primary' : 'secondary'"
          size="sm"
          @click="toggleAutoRefresh"
        >
          {{ logAutoRefresh ? 'AUTO: ON' : 'AUTO: OFF' }}
        </WButton>
        <WButton
          variant="secondary"
          size="sm"
          @click="loadLogs()"
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

    <div class="flex-1 p-6 pb-24 overflow-hidden relative">
      <div class="h-full border border-white/10 rounded-lg bg-black/30 overflow-y-auto custom-scrollbar">
        <div class="p-4 pb-20">
          <pre class="text-[10px] font-mono whitespace-pre-wrap break-all leading-relaxed" v-if="processedLogContent.length > 0"><template v-for="(segment, idx) in processedLogContent" :key="idx"><span :style="{ color: segment.color }">{{ segment.text }}</span></template></pre>
          <pre class="text-[10px] text-gray-400 font-mono whitespace-pre-wrap break-all leading-relaxed" v-else>> No log file available.</pre>
        </div>
      </div>

      <div class="absolute bottom-28 right-10 flex gap-2">
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
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}
</style>