<script setup lang="ts">
import { computed } from 'vue'
import type { CardVariant, Spacing } from './types'

interface Props {
  variant?: CardVariant
  padding?: Spacing
  clickable?: boolean
  active?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  padding: 'md',
  clickable: false,
  active: false
})

const cardClasses = computed(() => {
  const classes = ['rounded-xl border transition-all duration-300']

  if (props.variant === 'default') {
    classes.push('bg-[#111] border-[#222]')
  } else if (props.variant === 'mica') {
    classes.push('mica-card border-[#2a2a2a] shadow-[0_4px_16px_rgba(0,0,0,0.2)]')
  } else if (props.variant === 'list-item') {
    if (props.active) {
      classes.push('bg-blue-600/10 border-blue-500/50 shadow-[0_0_20px_rgba(37,99,235,0.4)]')
    } else {
      classes.push('bg-[#0f0f0f] border-[#2a2a2a] hover:bg-[#161616] hover:border-[#333]')
    }
  }

  if (props.clickable) {
    classes.push('cursor-pointer')
    if (props.variant === 'list-item' && !props.active) {
      classes.push('hover:shadow-[0_0_20px_rgba(255,255,255,0.03)]')
    }
  }

  if (props.padding === 'none') classes.push('p-0')
  else if (props.padding === 'sm') classes.push('p-3')
  else if (props.padding === 'md') classes.push('p-4')
  else if (props.padding === 'lg') classes.push('p-5')

  return classes.join(' ')
})
</script>

<template>
  <div :class="cardClasses">
    <slot />
  </div>
</template>
