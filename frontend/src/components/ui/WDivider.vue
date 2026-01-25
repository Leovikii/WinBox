<script setup lang="ts">
import { computed } from 'vue'
import type { DividerVariant, Spacing } from './types'

interface Props {
  variant?: DividerVariant
  spacing?: Spacing
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  spacing: 'none'
})

const dividerClasses = computed(() => {
  const classes = ['h-px']

  if (props.variant === 'default') classes.push('bg-[#222]/80')
  else if (props.variant === 'light') classes.push('bg-[#2a2a2a]/50')
  else if (props.variant === 'strong') classes.push('bg-[#2a2a2a]')

  if (props.spacing === 'sm') classes.push('my-1')
  else if (props.spacing === 'md') classes.push('my-2')
  else if (props.spacing === 'lg') classes.push('my-4')

  return classes.join(' ')
})
</script>

<template>
  <div :class="dividerClasses"></div>
</template>
