<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount, nextTick } from 'vue'

const props = withDefaults(defineProps<{
  height?: string
  maxHeight?: string
  width?: string
  maxWidth?: string
  horizontal?: boolean
}>(), {
  height: 'auto',
  maxHeight: 'none',
  width: 'auto',
  maxWidth: 'none',
  horizontal: false
})

const computedStyle = computed(() => {
  const style: Record<string, any> = {
    overflowY: 'auto',
    overflowX: props.horizontal ? 'auto' : 'hidden'
  }
  if (props.height && props.height !== 'auto') style.height = props.height
  if (props.maxHeight && props.maxHeight !== 'none') style.maxHeight = props.maxHeight
  if (props.width && props.width !== 'auto') style.width = props.width
  if (props.maxWidth && props.maxWidth !== 'none') style.maxWidth = props.maxWidth
  return style
})

const scrollContainer = ref<HTMLElement | null>(null)
const thumbHeight = ref(0)
const thumbTop = ref(0)
const isScrolling = ref(false)
let hideTimeout: number | null = null

const calculateThumb = () => {
  if (!scrollContainer.value) return
  const el = scrollContainer.value
  const { scrollTop, scrollHeight, clientHeight } = el
  if (scrollHeight <= clientHeight) {
    thumbHeight.value = 0
    return
  }
  
  // Height ratio
  const heightRatio = clientHeight / scrollHeight
  thumbHeight.value = Math.max(heightRatio * clientHeight, 20)
  
  // Scroll ratio
  const scrollRatio = scrollTop / (scrollHeight - clientHeight)
  const visualTop = scrollRatio * (clientHeight - thumbHeight.value)
  
  // Prevent floating point rounding from extending the scrollHeight, causing infinite loops
  thumbTop.value = Math.min(scrollTop + visualTop, scrollHeight - thumbHeight.value - 1)
}

const onScroll = () => {
  calculateThumb()
  isScrolling.value = true
  if (hideTimeout) clearTimeout(hideTimeout)
  hideTimeout = window.setTimeout(() => {
    isScrolling.value = false
  }, 800)
}

const scrollToBottom = () => {
  if (scrollContainer.value) {
    scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight
  }
}

let resizeObserver: ResizeObserver | null = null
let mutationObserver: MutationObserver | null = null

onMounted(() => {
  if (scrollContainer.value) {
    // Initial calc
    nextTick(() => {
      calculateThumb()
    })
    
    resizeObserver = new ResizeObserver(() => {
      calculateThumb()
    })
    resizeObserver.observe(scrollContainer.value)
    
    mutationObserver = new MutationObserver(() => {
      calculateThumb()
    })
    mutationObserver.observe(scrollContainer.value, { childList: true, subtree: true, characterData: true })
  }
})

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
  if (mutationObserver) {
    mutationObserver.disconnect()
  }
  if (hideTimeout) {
    clearTimeout(hideTimeout)
  }
})

defineExpose({
  $el: scrollContainer,
  scrollToBottom
})
</script>

<template>
  <div class="w-scroll-area relative" :style="computedStyle" ref="scrollContainer" @scroll="onScroll">
    <Transition name="fade">
      <div 
        v-show="thumbHeight > 0 && isScrolling && !horizontal"
        class="absolute right-1 w-1 rounded-full bg-white/20 pointer-events-none z-[99]"
        :style="{ height: `${thumbHeight}px`, top: `${thumbTop}px` }"
      ></div>
    </Transition>
    
    <slot />
  </div>
</template>

<style scoped>
/* Hide native scrollbar */
.w-scroll-area {
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE/Edge */
}
.w-scroll-area::-webkit-scrollbar {
  display: none; /* Chrome/Safari */
}

/* Transition for fade */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.4s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
