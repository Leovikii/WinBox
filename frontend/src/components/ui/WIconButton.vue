<script setup lang="ts">
import { computed } from 'vue'
import type { IconButtonVariant } from './types'

interface Props {
  icon: string
  variant?: IconButtonVariant
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  size: 'md',
  disabled: false
})

const buttonClasses = computed(() => {
  const classes = [
    'rounded-md flex items-center justify-center transition-all duration-200 active:scale-95'
  ]

  if (props.size === 'sm') classes.push('w-7 h-7 text-[10px]')
  else if (props.size === 'md') classes.push('w-10 h-10 text-sm')
  else if (props.size === 'lg') classes.push('w-12 h-12')

  if (props.variant === 'default') {
    classes.push('border border-[#222] bg-[#1a1a1a] text-[#666] hover:bg-[#222] hover:text-white')
  } else if (props.variant === 'danger') {
    classes.push('border border-[#222] bg-[#1a1a1a] text-[#666] hover:border-red-900/50 hover:text-red-500 hover:bg-red-900/10')
  } else if (props.variant === 'primary') {
    classes.push('bg-blue-600 text-white hover:bg-blue-500 border border-blue-500')
  } else if (props.variant === 'warning') {
    classes.push('border border-yellow-900/30 bg-[#1a1a1a] text-yellow-500 hover:bg-yellow-900/10')
  }

  if (props.disabled) classes.push('opacity-60 cursor-not-allowed')

  return classes.join(' ')
})
</script>

<template>
  <button :class="buttonClasses" :disabled="disabled">
    <i :class="icon"></i>
  </button>
</template>
