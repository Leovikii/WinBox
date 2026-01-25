<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  modelValue: string
  placeholder?: string
  disabled?: boolean
  rows?: number
  mono?: boolean
  resize?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  rows: 4,
  mono: false,
  resize: true
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const textareaClasses = computed(() => {
  const classes = [
    'w-full bg-transparent text-xs focus:outline-none custom-scrollbar [&::-webkit-scrollbar]:hidden'
  ]

  if (props.mono) {
    classes.push('font-mono text-gray-300')
  } else {
    classes.push('text-white')
  }

  if (!props.resize) {
    classes.push('resize-none')
  }

  if (props.disabled) {
    classes.push('opacity-60 cursor-not-allowed')
  }

  return classes.join(' ')
})
</script>

<template>
  <textarea
    :value="modelValue"
    @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
    :placeholder="placeholder"
    :disabled="disabled"
    :rows="rows"
    :class="textareaClasses"
    spellcheck="false"
  />
</template>
