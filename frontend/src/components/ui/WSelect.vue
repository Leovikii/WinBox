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
const openUpward = ref(false)
const dropdownStyle = ref<Record<string, string>>({
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
    const gap = 4
    const maxHeight = 240

    const spaceBelow = window.innerHeight - rect.bottom - gap
    const spaceAbove = rect.top - gap

    // Prefer downward; open upward only when below is insufficient and above has more space
    openUpward.value = spaceBelow < maxHeight && spaceAbove > spaceBelow

    const availableHeight = Math.min(maxHeight, openUpward.value ? spaceAbove : spaceBelow)

    if (openUpward.value) {
      dropdownStyle.value = {
        bottom: `${window.innerHeight - rect.top + gap}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        maxHeight: `${availableHeight}px`
      }
    } else {
      dropdownStyle.value = {
        top: `${rect.bottom + gap}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        maxHeight: `${availableHeight}px`
      }
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
    'w-full relative bg-black/5 dark:bg-white/[0.07] text-[11px] text-gray-700 dark:text-gray-300 border border-black/10 dark:border-white/10 shadow-sm dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]',
    'rounded px-3 h-7 outline-none text-center font-bold cursor-pointer',
    'transition-colors duration-300 flex items-center justify-between gap-2',
    'hover:bg-black/10 dark:hover:bg-white/[0.12]'
  ]

  if (isOpen.value) {
    classes.push('border-[var(--accent-color)] bg-black/10 dark:bg-white/10')
  }

  if (props.disabled) {
    classes.push('opacity-60 cursor-not-allowed hover:bg-black/5 dark:hover:bg-white/[0.07] hover:border-black/10 dark:hover:border-white/10')
  }

  return classes.join(' ')
})

const dropdownClasses = computed(() => {
  const classes = [
    'w-select-dropdown fixed z-[9999] bg-white dark:bg-[#242424] border border-black/10 dark:border-white/10 rounded-md overflow-x-hidden overflow-y-auto',
    'shadow-[0_8px_32px_rgba(0,0,0,0.4)]',
    'transition-all duration-300',
    openUpward.value ? 'origin-bottom' : 'origin-top'
  ]

  if (isOpen.value) {
    classes.push('opacity-100 scale-y-100 translate-y-0')
  } else {
    classes.push(`opacity-0 scale-y-95 ${openUpward.value ? 'translate-y-2' : '-translate-y-2'} pointer-events-none`)
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
          isOpen ? 'rotate-180 text-[var(--accent-color)]' : 'text-gray-400 dark:text-[#666]'
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
            'px-3 py-2 text-[11px] font-bold cursor-pointer transition-colors duration-200 whitespace-nowrap',
            'hover:bg-black/5 dark:hover:bg-white/[0.12] hover:text-[var(--accent-color)]',
            modelValue === option.value
              ? 'bg-[var(--accent-color)]/10 text-[var(--accent-color)]'
              : 'text-gray-700 dark:text-gray-300'
          ]"
        >
          {{ option.label }}
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* Fluent Design adaptive thin scrollbar */
.w-select-dropdown::-webkit-scrollbar {
  width: 4px;
}
.w-select-dropdown::-webkit-scrollbar-track {
  background: transparent;
  margin: 4px 0;
}
.w-select-dropdown::-webkit-scrollbar-thumb {
  background: rgba(128, 128, 128, 0.3);
  border-radius: 4px;
}
.w-select-dropdown::-webkit-scrollbar-thumb:hover {
  background: rgba(128, 128, 128, 0.5);
}
</style>
