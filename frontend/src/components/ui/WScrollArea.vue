<script setup lang="ts">
import { computed, ref } from 'vue'

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
  return {
    height: props.height,
    maxHeight: props.maxHeight,
    width: props.width,
    maxWidth: props.maxWidth,
    overflowY: 'auto' as const,
    overflowX: (props.horizontal ? 'auto' : 'hidden') as 'auto' | 'hidden'
  }
})

const scrollContainer = ref<HTMLElement | null>(null)

const scrollToBottom = () => {
  if (scrollContainer.value) {
    scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight
  }
}

defineExpose({
  $el: scrollContainer,
  scrollToBottom
})
</script>

<template>
  <div class="w-scroll-area" :style="computedStyle" ref="scrollContainer">
    <slot />
  </div>
</template>

<style>
.w-scroll-area {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
}

.w-scroll-area::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.w-scroll-area::-webkit-scrollbar-track {
  background: transparent;
  border-radius: 4px;
}

.w-scroll-area::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  transition: background 0.2s ease;
}

.w-scroll-area::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

.w-scroll-area::-webkit-scrollbar-corner {
  background: transparent;
}
</style>
