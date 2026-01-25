<script setup lang="ts">
interface Props {
  expanded: boolean
}

defineProps<Props>()
</script>

<template>
  <div :class="['expand-wrapper', expanded ? 'open' : '']">
    <div class="expand-inner">
      <slot />
    </div>
  </div>
</template>
