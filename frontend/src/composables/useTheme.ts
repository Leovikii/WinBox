import { ref, onMounted } from 'vue'
import * as Backend from '../../wailsjs/go/internal/App'

export const ACCENT_COLORS = [
  { name: 'Blue', value: '#2563eb' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Green', value: '#10b981' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Cyan', value: '#06b6d4' },
]

// Cache for hexToRgb conversions to avoid repeated regex operations
const rgbCache = new Map<string, string>()

function hexToRgb(hex: string): string {
  if (rgbCache.has(hex)) {
    return rgbCache.get(hex)!
  }

  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return '37, 99, 235'

  const rgb = `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
  rgbCache.set(hex, rgb)
  return rgb
}

export function useTheme() {
  const accentColor = ref('#2563eb')

  const applyTheme = () => {
    const root = document.documentElement
    root.style.setProperty('--accent-color', accentColor.value)
    root.style.setProperty('--accent-color-rgb', hexToRgb(accentColor.value))
  }

  const setTheme = async (color: string) => {
    accentColor.value = color
    applyTheme()

    try {
      await Backend.SaveTheme('dark', color)
    } catch (error) {
      console.error('Failed to save theme:', error)
    }
  }

  const loadTheme = async () => {
    try {
      const meta = await Backend.GetInitData()
      if (meta.accent_color) {
        accentColor.value = meta.accent_color
      }
      applyTheme()
    } catch (error) {
      console.error('Failed to load theme:', error)
    }
  }

  onMounted(() => {
    loadTheme()
  })

  return {
    accentColor,
    setTheme,
    loadTheme,
  }
}
