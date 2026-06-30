import { ref, onMounted } from 'vue'
import * as Backend from '../../wailsjs/go/internal/App'
import { WindowSetSystemDefaultTheme, WindowSetLightTheme, WindowSetDarkTheme } from '../../wailsjs/runtime/runtime'

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

const accentColor = ref('#2563eb')
const themeMode = ref('system') // 'light' | 'dark' | 'system'
const isDark = ref(false)
let isInitialized = false

// Set up media query listener
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

export function useTheme() {

  const applyTheme = () => {
    const root = document.documentElement
    root.style.setProperty('--accent-color', accentColor.value)
    root.style.setProperty('--accent-color-rgb', hexToRgb(accentColor.value))

    // Handle Light/Dark Class
    let isDarkValue = false
    if (themeMode.value === 'dark') {
      isDarkValue = true
      WindowSetDarkTheme()
    } else if (themeMode.value === 'light') {
      isDarkValue = false
      WindowSetLightTheme()
    } else {
      isDarkValue = mediaQuery.matches
      WindowSetSystemDefaultTheme()
    }
    
    isDark.value = isDarkValue

    if (isDarkValue) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }

  const setThemeColor = async (color: string) => {
    accentColor.value = color
    applyTheme()
    saveThemeConfig()
  }

  const setThemeMode = async (mode: string) => {
    themeMode.value = mode
    applyTheme()
    saveThemeConfig()
  }

  const saveThemeConfig = async () => {
    try {
      localStorage.setItem('themeMode', themeMode.value)
      await Backend.SaveTheme(themeMode.value, accentColor.value)
    } catch (error) {
      // Silent fail
    }
  }

  const loadTheme = async () => {
    try {
      const meta = await Backend.GetInitData()
      if (meta.accentColor) {
        accentColor.value = meta.accentColor
      }
      if (meta.themeMode) {
        themeMode.value = meta.themeMode
        localStorage.setItem('themeMode', meta.themeMode)
      }
      applyTheme()
    } catch (error) {
      // Silent fail
    }
  }

  onMounted(() => {
    if (!isInitialized) {
      isInitialized = true
      loadTheme()
      mediaQuery.addEventListener('change', applyTheme)
    }
  })

  return {
    accentColor,
    themeMode,
    isDark,
    setThemeColor,
    setThemeMode,
    loadTheme,
  }
}
