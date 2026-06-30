<template>
  <div 
    class="bg-black/5 dark:bg-black/30 rounded p-1 border border-black/10 dark:border-white/5 shadow-inner select-none h-9"
    :class="[disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : '']"
  >
    <div class="relative w-full h-full flex">
      <!-- Sliding Indicator -->
      <div 
        class="absolute top-0 bottom-0 rounded-sm bg-white dark:bg-white/10 border border-black/5 dark:border-white/10 shadow-sm transition-all duration-300 ease-out"
        :style="indicatorStyle"
      ></div>

      <!-- Options -->
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        @click="selectOption(option.value)"
        class="relative flex-1 flex items-center justify-center z-10 transition-colors duration-200 rounded-sm"
        :class="[
          modelValue === option.value 
            ? 'text-gray-800 dark:text-white font-bold text-shadow-sm' 
            : 'text-gray-500 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300 font-medium'
        ]"
      >
        <span class="text-[10px] tracking-widest uppercase">{{ option.label }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  modelValue: string | number
  options: { label: string; value: string | number }[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number): void
}>()

const selectedIndex = computed(() => {
  const index = props.options.findIndex(opt => opt.value === props.modelValue)
  return index >= 0 ? index : 0
})

const indicatorStyle = computed(() => {
  const count = props.options.length || 1
  const widthPercentage = 100 / count
  return {
    width: `${widthPercentage}%`,
    transform: `translateX(${selectedIndex.value * 100}%)`
  }
})

const selectOption = (val: string | number) => {
  if (props.disabled) return
  if (val !== props.modelValue) {
    emit('update:modelValue', val)
  }
}
</script>
