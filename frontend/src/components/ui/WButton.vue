<script setup lang="ts">
import { computed } from 'vue'
import type { ButtonVariant, ButtonSize } from './types'

interface Props {
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  loading?: boolean
  icon?: string
  iconPosition?: 'left' | 'right'
  fullWidth?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'secondary',
  size: 'md',
  disabled: false,
  loading: false,
  iconPosition: 'left',
  fullWidth: false
})

const buttonClasses = computed(() => {
  const classes = [
    'rounded-md font-bold tracking-wide transition-all duration-200 active:scale-95',
    'flex items-center justify-center gap-1.5'
  ]

  if (props.size === 'sm') classes.push('h-7 px-3 text-[11px]')
  else if (props.size === 'md') classes.push('h-9 px-4 text-xs')
  else if (props.size === 'lg') classes.push('h-12 px-6 text-xs')

  if (props.variant === 'primary') {
    classes.push('bg-blue-600 text-white hover:bg-blue-500 shadow-[0_4px_12px_rgba(37,99,235,0.4)] border border-blue-500')
  } else if (props.variant === 'secondary') {
    classes.push('bg-[#1a1a1a] border border-[#333] text-gray-300 hover:bg-[#222]')
  } else if (props.variant === 'danger') {
    classes.push('bg-red-600 text-white hover:bg-red-500 shadow-[0_4px_12px_rgba(220,38,38,0.4)] border border-red-500')
  } else if (props.variant === 'success') {
    classes.push('bg-emerald-500/10 text-emerald-500 border border-emerald-500/20')
  } else if (props.variant === 'warning') {
    classes.push('bg-yellow-500/10 text-yellow-500 border border-yellow-900/30 hover:bg-yellow-900/10')
  } else if (props.variant === 'ghost') {
    classes.push('bg-transparent border border-[#333] text-gray-300 hover:bg-[#222]')
  } else if (props.variant === 'link') {
    classes.push('bg-blue-500/10 text-blue-500 border-none hover:bg-blue-500/20')
  }

  if (props.disabled || props.loading) classes.push('opacity-60 cursor-not-allowed')
  if (props.fullWidth) classes.push('w-full')

  return classes.join(' ')
})
</script>

<template>
  <button :class="buttonClasses" :disabled="disabled || loading">
    <i v-if="loading" class="fas fa-circle-notch fa-spin"></i>
    <i v-else-if="icon && iconPosition === 'left'" :class="icon"></i>
    <slot />
    <i v-if="icon && iconPosition === 'right' && !loading" :class="icon"></i>
  </button>
</template>
