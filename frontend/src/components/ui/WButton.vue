<script setup lang="ts">
import { computed } from 'vue'
import type { ButtonVariant, ButtonSize } from './types'

interface Props {
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  loading?: boolean
  icon?: string
  fullWidth?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'secondary',
  size: 'md',
  disabled: false,
  loading: false,
  fullWidth: false
})

const buttonClasses = computed(() => {
  const classes = [
    'rounded font-bold tracking-wide transition-all duration-200 active:scale-95',
    'flex items-center justify-center gap-1.5'
  ]

  if (props.size === 'sm') classes.push('h-7 px-3 text-[11px]')
  else if (props.size === 'md') classes.push('h-9 px-4 text-xs')
  else if (props.size === 'lg') classes.push('h-12 px-6 text-xs')

  if (props.variant === 'primary') {
    classes.push('bg-[var(--accent-color)]/90 text-white/95 hover:brightness-110')
  } else if (props.variant === 'secondary') {
    classes.push('bg-[#242424] border border-[#3a3a3a] text-gray-300 hover:bg-[#333]')
  } else if (props.variant === 'danger') {
    classes.push('bg-red-600 text-white hover:bg-red-500')
  } else if (props.variant === 'success') {
    classes.push('bg-emerald-500/10 text-emerald-500 border border-emerald-500/20')
  } else if (props.variant === 'warning') {
    classes.push('bg-yellow-500/10 text-yellow-500 border border-yellow-900/30 hover:bg-yellow-900/10')
  } else if (props.variant === 'ghost') {
    classes.push('bg-transparent border border-transparent text-gray-300 hover:bg-[#222]')
  } else if (props.variant === 'link') {
    classes.push('bg-[var(--accent-color)]/10 text-[var(--accent-color)] border-none hover:bg-[var(--accent-color)]/20')
  }

  if (props.disabled || props.loading) classes.push('opacity-60 cursor-not-allowed')
  if (props.fullWidth) classes.push('w-full')

  return classes.join(' ')
})
</script>

<template>
  <button :class="buttonClasses" :disabled="disabled || loading">
    <i v-if="loading" class="fas fa-circle-notch fa-spin"></i>
    <i v-else-if="icon" :class="icon"></i>
    <slot />
  </button>
</template>
