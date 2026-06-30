<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  modelValue: string
  type?: 'text' | 'url' | 'email' | 'password'
  placeholder?: string
  disabled?: boolean
  error?: boolean
  mono?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  disabled: false,
  error: false,
  mono: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const inputClasses = computed(() => {
  const classes = [
    'w-full bg-black/5 dark:bg-white/[0.04] border border-black/10 dark:border-white/10 shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] rounded px-4 py-3 text-xs',
    'focus:outline-none transition-all'
  ]

  if (props.error) {
    classes.push('border-red-500/50')
  } else {
    classes.push('border-[#2a2a2a] focus:border-[var(--accent-color)]')
  }

  if (props.mono) {
    classes.push('font-mono text-gray-500 dark:text-[#888]')
  } else {
    classes.push('text-gray-900 dark:text-white')
  }

  if (props.disabled) {
    classes.push('opacity-60 cursor-not-allowed')
  }

  return classes.join(' ')
})
</script>

<template>
  <input
    :type="type"
    :value="modelValue"
    @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
    :placeholder="placeholder"
    :disabled="disabled"
    :class="inputClasses"
  />
</template>
