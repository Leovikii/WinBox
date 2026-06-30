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
  <div class="w-scroll-area relative" :style="computedStyle" ref="scrollContainer">
    <slot />
  </div>
</template>

<style scoped>
/* Inherit global scrollbar styles from index.css */
</style>
