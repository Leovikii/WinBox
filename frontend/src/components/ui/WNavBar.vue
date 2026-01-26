<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount, computed } from 'vue'

const props = defineProps<{
  tabs: { id: string; label: string; icon: string }[]
  currentTab: string
  accentColor: string
}>()

const emit = defineEmits<{
  change: [id: string]
}>()

const tabRefs = ref<HTMLElement[]>([])
const navRef = ref<HTMLElement | null>(null)

const indicatorStyle = ref({
  left: '4px',
  width: '40px',
  opacity: 0
})

const updateIndicator = () => {
  const currentIndex = props.tabs.findIndex(t => t.id === props.currentTab)
  const el = tabRefs.value[currentIndex]
  
  if (el) {
    indicatorStyle.value = {
      left: `${el.offsetLeft}px`,
      width: `${el.offsetWidth}px`,
      opacity: 1
    }
  }
}

let resizeObserver: ResizeObserver

onMounted(() => {
  resizeObserver = new ResizeObserver(() => {
    requestAnimationFrame(updateIndicator)
  })

  tabRefs.value.forEach(el => {
    resizeObserver.observe(el)
  })
  
  updateIndicator()
})

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
})

watch(() => props.currentTab, () => {
  nextTick(updateIndicator)
})

const activeTextColor = computed(() => '#ffffff')
</script>

<template>
  <div class="absolute bottom-8 left-1/2 -translate-x-1/2 z-50">
    <div ref="navRef" class="relative flex items-center justify-center gap-3 p-1.5 bg-[#111]/85 backdrop-blur-2xl border border-white/10 rounded-full shadow-[0_10px_40px_-10px_rgba(0,0,0,0.8)] min-w-75 transition-all duration-300">
      
      <div 
        class="absolute top-1.5 bottom-1.5 rounded-full shadow-[0_2px_15px_rgba(0,0,0,0.3)] z-0 transition-colors duration-300 ease-out"
        :style="{
          left: indicatorStyle.left,
          width: indicatorStyle.width,
          backgroundColor: accentColor,
          opacity: indicatorStyle.opacity,
          transitionProperty: 'background-color, opacity'
        }"
      ></div>

      <button
        v-for="(tab, index) in tabs"
        :key="tab.id"
        ref="tabRefs"
        @click="emit('change', tab.id)"
        class="relative flex items-center justify-center h-9 rounded-full transition-all duration-300 z-10 overflow-hidden outline-none select-none"
        :class="[
          currentTab === tab.id ? 'px-6 grow-0' : 'w-12 grow-0 hover:bg-white/5'
        ]"
      >
        <i 
          :class="[
            tab.icon, 
            'transition-all duration-300 relative z-20',
            currentTab === tab.id ? 'text-base scale-105' : 'text-sm text-[#888] group-hover:text-[#bbb]'
          ]"
          :style="{ color: currentTab === tab.id ? activeTextColor : '' }"
        ></i>
        
        <span 
          class="whitespace-nowrap font-bold text-xs uppercase tracking-wider ml-2.5 transition-all duration-300 overflow-hidden relative z-20"
          :class="currentTab === tab.id ? 'opacity-100 max-w-30' : 'opacity-0 max-w-0'"
          :style="{ color: currentTab === tab.id ? activeTextColor : '' }"
        >
          {{ tab.label }}
        </span>
      </button>
    </div>
  </div>
</template>