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
    'rounded-full p-0.5 cursor-pointer transition-colors duration-300 relative'
  ]

  if (props.size === 'sm') classes.push('w-9 h-5')
  else classes.push('w-11 h-6')

  if (props.modelValue) {
    if (props.color === 'blue') classes.push('bg-blue-600')
    else if (props.color === 'purple') classes.push('bg-purple-600')
    else if (props.color === 'green') classes.push('bg-emerald-600')
  } else {
    classes.push('bg-[#2a2a2a]')
  }

  if (props.disabled) classes.push('opacity-50 cursor-not-allowed')

  return classes.join(' ')
})

const knobClasses = computed(() => {
  const classes = [
    'bg-white rounded-full transition-transform duration-300 shadow-lg absolute top-1 left-1'
  ]

  if (props.size === 'sm') {
    classes.push('w-3 h-3')
    if (props.modelValue) classes.push('translate-x-4')
  } else {
    classes.push('w-4 h-4')
    if (props.modelValue) classes.push('translate-x-5')
  }

  if (!props.modelValue) classes.push('translate-x-0')

  return classes.join(' ')
})
</script>

<template>
  <div :class="containerClasses" @click="handleClick">
    <div :class="knobClasses"></div>
  </div>
</template>
