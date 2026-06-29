<template>
  <div 
    class="bg-black/30 rounded p-1 border border-white/5 shadow-[inset_0_1px_3px_rgba(0,0,0,0.3)] select-none h-9"
    :class="[disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : '']"
  >
    <div class="relative w-full h-full flex">
      <!-- Sliding Indicator -->
      <div 
        class="absolute top-0 bottom-0 rounded-sm bg-white/10 border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_1px_3px_rgba(0,0,0,0.5)] transition-all duration-300 ease-out"
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
            ? 'text-white font-bold text-shadow-sm' 
            : 'text-gray-500 hover:text-gray-300 font-medium'
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
