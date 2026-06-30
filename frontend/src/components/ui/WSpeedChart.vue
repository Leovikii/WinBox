<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'

const props = defineProps<{
  uploadSpeed: number
  downloadSpeed: number
}>()

// Configure the chart
const MAX_DATAPOINTS = 30
const MIN_SCALE_SPEED = 100 * 1024 // 100 KB/s minimum scale so the chart doesn't jump randomly on small background noise

// Store the history of speeds
const history = ref<{ up: number; down: number }[]>([])

// Initialize with zeros
onMounted(() => {
  const initial = Array(MAX_DATAPOINTS).fill({ up: 0, down: 0 })
  history.value = initial
})

// Update history when props change
watch(() => [props.uploadSpeed, props.downloadSpeed], ([newUp, newDown]) => {
  if (history.value.length === 0) return
  
  // Push new data and shift old data
  history.value.push({ up: newUp as number, down: newDown as number })
  if (history.value.length > MAX_DATAPOINTS) {
    history.value.shift()
  }
})

// Calculate the maximum speed in the current history to scale the Y-axis
const maxSpeed = computed(() => {
  let max = MIN_SCALE_SPEED
  for (const point of history.value) {
    if (point.up > max) max = point.up
    if (point.down > max) max = point.down
  }
  return max
})

// SVG ViewBox settings
const width = 300 // Abstract SVG width
const height = 100 // Abstract SVG height

// Helper function to generate an SVG path string from data points
const generatePath = (data: number[]) => {
  if (data.length === 0) return ''

  const max = maxSpeed.value
  const stepX = width / (MAX_DATAPOINTS - 1)
  
  // Create coordinates for the line
  const points = data.map((value, index) => {
    const x = index * stepX
    // Calculate y, ensuring it doesn't go below 0 or above height
    // We leave a small 5% padding at the top so lines don't hit the ceiling
    const normalizedY = (value / max) * (height * 0.95) 
    const y = height - normalizedY
    return { x, y }
  })

  // Start building the path string
  let d = `M ${points[0].x},${points[0].y} `
  
  for (let i = 1; i < points.length; i++) {
    d += `L ${points[i].x},${points[i].y} `
  }
  
  return d
}

// Helper to generate the filled polygon/path under the line
const generateFillPath = (data: number[]) => {
  const linePath = generatePath(data)
  if (!linePath) return ''
  
  // To fill, we draw the line, then draw down to the bottom right corner, 
  // then to the bottom left corner, then close back to start.
  return `${linePath} L ${width},${height} L 0,${height} Z`
}

// Computed paths
const uploadData = computed(() => history.value.map(p => p.up))
const downloadData = computed(() => history.value.map(p => p.down))

const uploadLinePath = computed(() => generatePath(uploadData.value))
const uploadFillPath = computed(() => generateFillPath(uploadData.value))

const downloadLinePath = computed(() => generatePath(downloadData.value))
const downloadFillPath = computed(() => generateFillPath(downloadData.value))

</script>

<template>
  <div class="w-full h-full relative overflow-hidden pointer-events-none opacity-80">
    <svg 
      class="w-full h-full absolute bottom-0 left-0" 
      preserveAspectRatio="none" 
      :viewBox="`0 0 ${width} ${height}`"
    >
      <defs>
        <!-- Upload Gradient (Emerald) -->
        <linearGradient id="uploadGradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#10b981" stop-opacity="0.6" />
          <stop offset="100%" stop-color="#10b981" stop-opacity="0.05" />
        </linearGradient>
        
        <!-- Download Gradient (Blue) -->
        <linearGradient id="downloadGradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.6" />
          <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.05" />
        </linearGradient>
      </defs>

      <!-- DOWNLOAD AREA & LINE -->
      <path 
        :d="downloadFillPath" 
        fill="url(#downloadGradient)" 
        class="transition-all duration-300 ease-linear"
      />
      <path 
        :d="downloadLinePath" 
        fill="none" 
        stroke="#3b82f6" 
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="transition-all duration-300 ease-linear opacity-80"
      />

      <!-- UPLOAD AREA & LINE (Drawn over download as it's usually smaller) -->
      <path 
        :d="uploadFillPath" 
        fill="url(#uploadGradient)" 
        class="transition-all duration-300 ease-linear"
      />
      <path 
        :d="uploadLinePath" 
        fill="none" 
        stroke="#10b981" 
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
        class="transition-all duration-300 ease-linear opacity-80"
      />
    </svg>
  </div>
</template>

<style scoped>
</style>
