import { ref, onMounted, onUnmounted } from 'vue'
import * as Backend from '../api/backend'

export const ACCENT_COLORS = [
  { name: 'Blue', value: '#0090FF' },
  { name: 'Green', value: '#30A46C' },
  { name: 'Pink', value: '#D6409F' },
  { name: 'Purple', value: '#8E4EC6' },
  { name: 'Red', value: '#E54D2E' }
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

const accentColor = ref('#0090FF')
const themeMode = ref('system') // 'light' | 'dark' | 'system'
const isDark = ref(false)
let mountedUsers = 0

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
      Backend.WindowSetDarkTheme()
    } else if (themeMode.value === 'light') {
      isDarkValue = false
      Backend.WindowSetLightTheme()
    } else {
      isDarkValue = mediaQuery.matches
      Backend.WindowSetSystemDefaultTheme()
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
      const meta = await Backend.getInitData()
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
    mountedUsers += 1
    if (mountedUsers === 1) {
      void loadTheme()
      mediaQuery.addEventListener('change', applyTheme)
    }
  })

  onUnmounted(() => {
    mountedUsers = Math.max(0, mountedUsers - 1)
    if (mountedUsers === 0) mediaQuery.removeEventListener('change', applyTheme)
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
