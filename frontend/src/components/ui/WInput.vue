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
    'w-full bg-[#050505] border rounded-xl px-4 py-3 text-xs',
    'focus:outline-none transition-all'
  ]

  if (props.error) {
    classes.push('border-red-500/50')
  } else {
    classes.push('border-[#2a2a2a] focus:border-blue-500/50')
  }

  if (props.mono) {
    classes.push('font-mono text-[#888]')
  } else {
    classes.push('text-white')
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
