<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'

interface SelectOption {
  value: string | number
  label: string
}

interface Props {
  modelValue: string | number
  options: SelectOption[]
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

const isOpen = ref(false)
const selectRef = ref<HTMLDivElement | null>(null)
const buttonRef = ref<HTMLButtonElement | null>(null)
const dropdownStyle = ref({
  top: '0px',
  left: '0px',
  width: '0px'
})

const selectedOption = computed(() => {
  return props.options.find(opt => opt.value === props.modelValue)
})

const updateDropdownPosition = () => {
  if (buttonRef.value) {
    const rect = buttonRef.value.getBoundingClientRect()
    dropdownStyle.value = {
      top: `${rect.bottom + 4}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`
    }
  }
}

const toggleDropdown = () => {
  if (!props.disabled) {
    isOpen.value = !isOpen.value
    if (isOpen.value) {
      nextTick(() => {
        updateDropdownPosition()
      })
    }
  }
}

const selectOption = (value: string | number) => {
  emit('update:modelValue', value)
  isOpen.value = false
}

const handleClickOutside = (event: MouseEvent) => {
  if (selectRef.value && !selectRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  window.addEventListener('scroll', updateDropdownPosition, true)
  window.addEventListener('resize', updateDropdownPosition)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('scroll', updateDropdownPosition, true)
  window.removeEventListener('resize', updateDropdownPosition)
})

watch(isOpen, (newVal) => {
  if (newVal) {
    updateDropdownPosition()
  }
})

const buttonClasses = computed(() => {
  const classes = [
    'relative bg-[#1a1a1a] text-[11px] text-gray-300 border border-[#333]',
    'rounded-lg px-3 h-7 outline-none text-center font-bold cursor-pointer',
    'transition-all duration-300 flex items-center justify-between gap-2',
    'hover:bg-[#222] hover:border-[#444]'
  ]

  if (isOpen.value) {
    classes.push('border-(--accent-color)/50 bg-[#222]')
  }

  if (props.disabled) {
    classes.push('opacity-60 cursor-not-allowed hover:bg-[#1a1a1a] hover:border-[#333]')
  }

  return classes.join(' ')
})

const dropdownClasses = computed(() => {
  const classes = [
    'fixed z-[9999] bg-[#1a1a1a] border border-[#333] rounded-lg overflow-hidden',
    'shadow-[0_8px_24px_rgba(0,0,0,0.5)]',
    'transition-all duration-300 origin-top'
  ]

  if (isOpen.value) {
    classes.push('opacity-100 scale-y-100 translate-y-0')
  } else {
    classes.push('opacity-0 scale-y-95 -translate-y-2 pointer-events-none')
  }

  return classes.join(' ')
})
</script>

<template>
  <div ref="selectRef" class="relative inline-block">
    <button
      ref="buttonRef"
      type="button"
      :class="buttonClasses"
      @click="toggleDropdown"
      :disabled="disabled"
    >
      <span class="flex-1 text-left truncate">{{ selectedOption?.label }}</span>
      <i
        :class="[
          'fas fa-chevron-down text-[9px] transition-transform duration-300',
          isOpen ? 'rotate-180 text-(--accent-color)' : 'text-[#666]'
        ]"
      ></i>
    </button>

    <Teleport to="body">
      <div
        v-if="isOpen"
        :class="dropdownClasses"
        :style="dropdownStyle"
      >
        <div
          v-for="option in options"
          :key="option.value"
          @click="selectOption(option.value)"
          :class="[
            'px-3 py-2 text-[11px] font-bold cursor-pointer transition-all duration-200',
            'hover:bg-[#222] hover:text-(--accent-color)',
            modelValue === option.value
              ? 'bg-(--accent-color)/10 text-(--accent-color)'
              : 'text-gray-300'
          ]"
        >
          {{ option.label }}
        </div>
      </div>
    </Teleport>
  </div>
</template>
