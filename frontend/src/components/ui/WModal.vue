<script setup lang="ts">
import { computed, watch, onMounted, onUnmounted } from 'vue'
import WScrollArea from './WScrollArea.vue'
import type { ModalWidth, ModalHeight } from './types'

interface Props {
  modelValue: boolean
  title?: string
  width?: ModalWidth
  height?: ModalHeight
  closeOnBackdrop?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  width: 'md',
  height: 'auto',
  closeOnBackdrop: true
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'close': []
}>()

const handleBackdropClick = () => {
  if (props.closeOnBackdrop) {
    emit('update:modelValue', false)
    emit('close')
  }
}

const handleClose = () => {
  emit('update:modelValue', false)
  emit('close')
}

const modalClasses = computed(() => {
  const classes = [
    'mica-card border border-[#333] rounded-xl',
    'shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden w-modal-container'
  ]

  if (props.width === 'sm') classes.push('w-[70%]')
  else if (props.width === 'md') classes.push('w-[85%]')
  else if (props.width === 'lg') classes.push('w-[90%]')
  else if (props.width === 'xl') classes.push('w-[95%]')

  if (props.height === 'sm') classes.push('h-[40%]')
  else if (props.height === 'md') classes.push('h-[60%]')
  else if (props.height === 'lg') classes.push('h-[70%]')

  return classes.join(' ')
})
</script>

<template>
  <Transition name="w-modal">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      @click="handleBackdropClick"
    >
      <div :class="modalClasses" @click.stop class="flex flex-col max-h-[90vh]">
      <div class="h-10 shrink-0 flex justify-between items-center px-4 border-b border-[#2a2a2a] bg-linear-to-b from-[#1a1a1a]/40 to-transparent">
        <slot name="header">
          <h2 v-if="title" class="text-xs font-bold text-[#888] uppercase tracking-widest">{{ title }}</h2>
        </slot>
        <button @click="handleClose" class="text-[#888] hover:text-white transition-colors shrink-0 ml-4">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <WScrollArea class="flex-1 min-h-0 p-5 space-y-4">
        <slot />
      </WScrollArea>
      <div v-if="$slots.footer" class="shrink-0 p-4 border-t border-[#2a2a2a]">
        <slot name="footer" />
      </div>
    </div>
    </div>
  </Transition>
</template>
