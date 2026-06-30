<script setup lang="ts">
import { computed, watch, onMounted, onUnmounted, ref } from 'vue'
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
    'bg-[#fdfdfd] dark:bg-[#1c1c1c] border border-black/10 dark:border-white/5 rounded-lg',
    'shadow-[0_16px_64px_rgba(0,0,0,0.1)] dark:shadow-[0_16px_64px_rgba(0,0,0,0.5)] overflow-hidden w-modal-container'
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

const scrollAreaRef = ref<InstanceType<typeof WScrollArea> | null>(null)

const scrollToBottom = () => {
  if (scrollAreaRef.value) {
    scrollAreaRef.value.scrollToBottom()
  }
}

defineExpose({
  scrollToBottom
})
</script>


<template>
  <Transition name="w-modal">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-white/20 dark:bg-black/50 backdrop-blur-sm"
      @click="handleBackdropClick"
    >
      <div :class="modalClasses" @click.stop class="flex flex-col max-h-[80vh]">
      <div class="h-14 shrink-0 flex justify-between items-center px-5 mt-2">
        <slot name="header">
          <div class="flex-1 flex justify-start items-center">
            <h2 v-if="title" class="text-lg font-semibold text-gray-900 dark:text-gray-100">{{ title }}</h2>
          </div>
        </slot>
        <button @click="handleClose" class="w-8 h-8 flex items-center justify-center text-gray-500 dark:text-[#888] hover:text-gray-900 dark:hover:text-white transition-colors shrink-0 ml-4 rounded-md hover:bg-black/5 dark:hover:bg-white/5">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <WScrollArea class="flex-1 min-h-0" ref="scrollAreaRef">
        <div class="p-5 space-y-4">
          <slot />
        </div>
      </WScrollArea>
      <div v-if="$slots.footer" class="shrink-0 px-5 py-4 bg-[#f3f3f3] dark:bg-black/20 border-t border-black/[0.05] dark:border-white/[0.05]">
        <slot name="footer" />
      </div>
    </div>
    </div>
  </Transition>
</template>
