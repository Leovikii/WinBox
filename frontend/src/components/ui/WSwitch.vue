<script setup lang="ts">
import { computed } from 'vue'
import type { SwitchColor } from './types'

interface Props {
  modelValue: boolean
  disabled?: boolean
  color?: SwitchColor
  size?: 'sm' | 'md'
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  color: 'blue',
  size: 'md'
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const handleClick = () => {
  if (!props.disabled) {
    emit('update:modelValue', !props.modelValue)
  }
}

const containerClasses = computed(() => {
  const classes = [
    'group rounded-full cursor-pointer transition-all duration-200 relative shrink-0 box-border block'
  ]

  if (props.size === 'sm') classes.push('w-[32px] h-[16px]')
  else classes.push('w-[40px] h-[20px]')

  if (props.modelValue) {
    // ON State Track
    if (props.color === 'blue') classes.push('bg-[var(--accent-color)]')
    else if (props.color === 'purple') classes.push('bg-purple-600')
    else if (props.color === 'green') classes.push('bg-emerald-600')
    classes.push('hover:brightness-110 ring-1 ring-inset ring-transparent')
  } else {
    // OFF State Track (WinUI 3: Transparent, solid ring, subtle fill on hover)
    classes.push(
      'bg-transparent group-hover:bg-black/[0.04] dark:group-hover:bg-white/[0.04]',
      'ring-1 ring-inset ring-[#8b8b8b] dark:ring-[#9e9e9e]',
      'group-hover:ring-[#5d5d5d] dark:group-hover:ring-[#8b8b8b]'
    )
  }

  if (props.disabled) classes.push('opacity-50 cursor-not-allowed')

  return classes.join(' ')
})

const knobClasses = computed(() => {
  const classes = [
    'rounded-full transition-all duration-200 absolute pointer-events-none'
  ]

  // Color and Shadow
  if (props.modelValue) {
    // ON State Thumb: High contrast (White in Light Mode, Black in Dark Mode)
    classes.push('bg-white dark:bg-[#1a1a1a] shadow-sm')
  } else {
    // OFF State Thumb: Gray
    classes.push('bg-[#5d5d5d] dark:bg-[#c8c8c8] group-hover:bg-[#333333] dark:group-hover:bg-[#ffffff]')
  }

  // Size and Position (Micro-animations on hover)
  if (props.size === 'sm') {
    // Track: 32x16
    if (props.modelValue) {
      classes.push('top-[3px] left-[19px] w-[10px] h-[10px]')
      classes.push('group-hover:top-[2px] group-hover:left-[18px] group-hover:w-[12px] group-hover:h-[12px]')
    } else {
      classes.push('top-[3px] left-[3px] w-[10px] h-[10px]')
      classes.push('group-hover:top-[2px] group-hover:left-[2px] group-hover:w-[12px] group-hover:h-[12px]')
    }
  } else {
    // Track: 40x20
    if (props.modelValue) {
      classes.push('top-[4px] left-[24px] w-[12px] h-[12px]')
      classes.push('group-hover:top-[3px] group-hover:left-[23px] group-hover:w-[14px] group-hover:h-[14px]')
    } else {
      classes.push('top-[4px] left-[4px] w-[12px] h-[12px]')
      classes.push('group-hover:top-[3px] group-hover:left-[3px] group-hover:w-[14px] group-hover:h-[14px]')
    }
  }

  return classes.join(' ')
})
</script>

<template>
  <div :class="containerClasses" @click="handleClick">
    <div :class="knobClasses"></div>
  </div>
</template>
