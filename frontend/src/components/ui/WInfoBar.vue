<template>
  <Transition name="infobar">
    <div v-if="show" class="infobar-wrapper w-full shrink-0">
      <div class="infobar-inner">
        <div class="flex items-start gap-3 p-3 mb-3 rounded-md border text-sm shadow-sm relative overflow-hidden" :class="variantClasses">
          <div class="shrink-0 mt-0.5">
            <i :class="iconClass"></i>
          </div>
          <div class="flex-1 min-w-0 pr-6 text-xs leading-relaxed break-all">
            <span class="font-semibold block mb-0.5" v-if="title">{{ title }}</span>
            <span>{{ message }}</span>
          </div>
          <button @click="close" class="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-md opacity-60 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 transition-colors">
            <i class="fas fa-times text-[10px]"></i>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  show: boolean
  title?: string
  message: string
  severity?: 'error' | 'warning' | 'success' | 'info'
}>(), {
  severity: 'info'
})

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'close'): void
}>()

const close = () => {
  emit('update:show', false)
  emit('close')
}

const variantClasses = computed(() => {
  switch (props.severity) {
    case 'error':
      return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
    case 'warning':
      return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200'
    case 'success':
      return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
    default:
      return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200'
  }
})

const iconClass = computed(() => {
  switch (props.severity) {
    case 'error': return 'fas fa-circle-xmark'
    case 'warning': return 'fas fa-triangle-exclamation'
    case 'success': return 'fas fa-circle-check'
    default: return 'fas fa-circle-info'
  }
})
</script>

<style scoped>
/* Smooth CSS Grid trick for auto-height transition */
.infobar-enter-active,
.infobar-leave-active {
  transition: grid-template-rows 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
}

.infobar-wrapper {
  display: grid;
  grid-template-rows: 1fr;
}

.infobar-enter-from,
.infobar-leave-to {
  grid-template-rows: 0fr;
  opacity: 0;
}

.infobar-inner {
  overflow: hidden;
}
</style>
