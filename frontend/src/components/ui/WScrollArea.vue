<script setup lang="ts">
import { computed, ref } from 'vue'
import { OverlayScrollbarsComponent } from 'overlayscrollbars-vue'

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
  const style: Record<string, any> = {}
  if (props.height && props.height !== 'auto') style.height = props.height
  if (props.maxHeight && props.maxHeight !== 'none') style.maxHeight = props.maxHeight
  if (props.width && props.width !== 'auto') style.width = props.width
  if (props.maxWidth && props.maxWidth !== 'none') style.maxWidth = props.maxWidth
  return style
})

import { useTheme } from '@/composables/useTheme'
const themeState = useTheme()

const scrollContainer = ref<InstanceType<typeof OverlayScrollbarsComponent> | null>(null)

const scrollToBottom = () => {
  if (scrollContainer.value) {
    const osInstance = scrollContainer.value.osInstance()
    if (osInstance) {
      const { viewport } = osInstance.elements()
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight
      }
    }
  }
}

defineExpose({
  $el: scrollContainer,
  scrollToBottom
})
</script>

<template>
  <OverlayScrollbarsComponent
    ref="scrollContainer"
    class="w-scroll-area relative"
    :style="computedStyle"
    :options="{
      scrollbars: { 
        autoHide: 'scroll', 
        autoHideDelay: 800, 
        theme: themeState.isDark.value ? 'os-theme-light' : 'os-theme-dark' 
      },
      overflow: { x: props.horizontal ? 'scroll' : 'hidden', y: 'scroll' }
    }"
    defer
  >
    <slot />
  </OverlayScrollbarsComponent>
</template>

<style scoped>

:deep(.os-scrollbar) {
  transition: opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1), visibility 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important;
}
:deep(.os-scrollbar-handle) {
  transition: background-color 0.2s ease-in-out !important;
}
</style>
