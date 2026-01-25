<script setup lang="ts">
import { ref } from 'vue'

interface ColorOption {
  name: string
  value: string
}

interface Props {
  modelValue: string
  colors: ColorOption[]
}

interface Emits {
  (e: 'update:modelValue', value: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const selectColor = (color: string) => {
  emit('update:modelValue', color)
}
</script>

<template>
  <div class="flex gap-2 flex-wrap">
    <button
      v-for="color in colors"
      :key="color.value"
      @click="selectColor(color.value)"
      :class="[
        'w-8 h-8 rounded-full transition-all duration-200',
        'hover:scale-110 hover:shadow-lg',
        modelValue === color.value
          ? 'ring-2 ring-offset-2 ring-offset-[#0a0a0a] scale-110'
          : 'opacity-70 hover:opacity-100'
      ]"
      :style="{
        backgroundColor: color.value
      }"
      :title="color.name"
    />
  </div>
</template>
