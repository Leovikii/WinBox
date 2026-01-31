<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  tabs: { id: string; label: string; icon: string }[]
  currentTab: string
  accentColor: string
}>()

const emit = defineEmits<{
  change: [id: string]
}>()

const ACTIVE_WIDTH = 120
const INACTIVE_WIDTH = 48
const GAP = 4
const PADDING = 6

const indicatorStyle = computed(() => {
  const currentIndex = props.tabs.findIndex(t => t.id === props.currentTab)

  let left = PADDING
  for (let i = 0; i < currentIndex; i++) {
    left += INACTIVE_WIDTH + GAP
  }

  return {
    left: `${left}px`,
    width: `${ACTIVE_WIDTH}px`,
    opacity: 1
  }
})

const activeTextColor = computed(() => '#ffffff')
</script>

<template>
  <div class="absolute bottom-8 left-1/2 -translate-x-1/2 z-50">
    <div class="relative flex items-center p-1.5 bg-[#111]/85 backdrop-blur-2xl border border-white/10 rounded-full shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)]" style="gap: 4px;">

      
      <div
        class="absolute rounded-full shadow-[0_2px_15px_rgba(0,0,0,0.3)] transition-all duration-300 ease-out"
        :style="{
          left: indicatorStyle.left,
          top: '6px',
          bottom: '6px',
          width: indicatorStyle.width,
          backgroundColor: accentColor,
          opacity: indicatorStyle.opacity
        }"
      ></div>

      
      <button
        v-for="(tab, index) in tabs"
        :key="tab.id"
        @click="emit('change', tab.id)"
        class="relative flex items-center justify-center h-9 rounded-full overflow-hidden outline-none select-none transition-all duration-300 ease-out shrink-0 group"
        :class="currentTab === tab.id ? 'px-4' : 'px-3'"
        :style="{
          width: currentTab === tab.id ? '120px' : '48px'
        }"
      >
        <div
          v-if="currentTab !== tab.id"
          class="absolute inset-0 rounded-full bg-white/0 group-hover:bg-white/8 transition-all duration-300 group-hover:shadow-[0_0_0_1px_rgba(255,255,255,0.1)]"
        ></div>

        <i
          :class="[
            tab.icon,
            'shrink-0 transition-all duration-300 ease-out',
            currentTab === tab.id ? 'text-base' : 'text-sm text-[#888] group-hover:text-[#aaa]'
          ]"
          :style="{
            color: currentTab === tab.id ? activeTextColor : '',
            position: 'relative',
            zIndex: 10
          }"
        ></i>

        <span
          class="whitespace-nowrap font-bold text-xs uppercase tracking-wider overflow-hidden transition-all duration-300 ease-out"
          :style="{
            color: currentTab === tab.id ? activeTextColor : '',
            opacity: currentTab === tab.id ? 1 : 0,
            maxWidth: currentTab === tab.id ? '70px' : '0px',
            marginLeft: currentTab === tab.id ? '8px' : '0px',
            position: 'relative',
            zIndex: 10
          }"
        >
          {{ tab.label }}
        </span>
      </button>
    </div>
  </div>
</template>