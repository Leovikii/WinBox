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
        theme: themeState.isDark.value ? 'os-theme-dark' : 'os-theme-light' 
      },
      overflow: { x: props.horizontal ? 'scroll' : 'hidden', y: 'scroll' }
    }"
    defer
  >
    <slot />
  </OverlayScrollbarsComponent>
</template>

<style scoped>
/* Custom WinUI 3 Theme Overrides */
:deep(.os-theme-dark) {
  --os-handle-bg: rgba(255, 255, 255, 0.3);
  --os-handle-bg-hover: rgba(255, 255, 255, 0.4);
  --os-handle-bg-active: rgba(255, 255, 255, 0.5);
}
:deep(.os-theme-light) {
  --os-handle-bg: rgba(0, 0, 0, 0.3);
  --os-handle-bg-hover: rgba(0, 0, 0, 0.4);
  --os-handle-bg-active: rgba(0, 0, 0, 0.5);
}

:deep(.os-scrollbar) {
  --os-size: 14px;
  --os-padding-perpendicular: 3px;
  --os-padding-axis: 3px;
  --os-track-bg: transparent;
  --os-track-bg-hover: transparent;
  --os-track-bg-active: transparent;
  --os-handle-border-radius: 10px;
  transition: opacity 0.3s ease, visibility 0.3s ease !important;
}

/* WinUI 3 Default State: Extremely thin (3px) floating line */
:deep(.os-scrollbar-vertical .os-scrollbar-handle) {
  width: 3px !important;
  min-width: 3px;
  margin-left: auto;
  transition: width 0.15s cubic-bezier(0, 0, 0, 1), background-color 0.2s ease !important;
}
:deep(.os-scrollbar-horizontal .os-scrollbar-handle) {
  height: 3px !important;
  min-height: 3px;
  margin-top: auto;
  transition: height 0.15s cubic-bezier(0, 0, 0, 1), background-color 0.2s ease !important;
}

/* WinUI 3 Hover State: Expands to full width (8px) */
:deep(.os-scrollbar-vertical:hover .os-scrollbar-handle),
:deep(.os-scrollbar-vertical.os-scrollbar-interacting .os-scrollbar-handle) {
  width: 8px !important;
}
:deep(.os-scrollbar-horizontal:hover .os-scrollbar-handle),
:deep(.os-scrollbar-horizontal.os-scrollbar-interacting .os-scrollbar-handle) {
  height: 8px !important;
}
</style>
