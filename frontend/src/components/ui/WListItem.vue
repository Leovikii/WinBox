<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  title: string
  subtitle?: string
  active?: boolean
  clickable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  active: false,
  clickable: true
})

const itemClasses = computed(() => {
  const classes = [
    'p-3 rounded-xl border flex items-center transition-all duration-300 mb-2 last:mb-0'
  ]

  if (props.clickable) classes.push('cursor-pointer')

  if (props.active) {
    classes.push('bg-[var(--accent-color)]/10 border-[var(--accent-color)]/50 shadow-[0_0_20px_rgba(var(--accent-color-rgb),0.4)]')
  } else {
    classes.push('bg-[#0f0f0f] border-[#2a2a2a] hover:bg-[#161616] hover:border-[#333]')
  }

  return classes.join(' ')
})

const titleClasses = computed(() => {
  const classes = ['text-xs font-bold truncate mb-0.5']
  if (props.active) classes.push('text-[var(--accent-color)]')
  else classes.push('text-gray-300')
  return classes.join(' ')
})
</script>

<template>
  <div :class="itemClasses">
    <div class="flex-1 overflow-hidden pr-3 min-w-0">
      <slot>
        <div :class="titleClasses">{{ title }}</div>
        <div v-if="subtitle" class="text-[9px] text-[#666] truncate font-mono">{{ subtitle }}</div>
      </slot>
    </div>
    <div v-if="$slots.actions" class="flex gap-2 shrink-0">
      <slot name="actions" />
    </div>
  </div>
</template>
