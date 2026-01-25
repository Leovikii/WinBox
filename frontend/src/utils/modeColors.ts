export interface ModeColor {
  hex: string
  rgb: string
  light: string
  lightRgb: string
  dark: string
  darkRgb: string
}

export const MODE_COLORS = {
  error: {
    hex: '#ef4444',
    rgb: '239, 68, 68',
    light: '#fca5a5',
    lightRgb: '252, 165, 165',
    dark: '#dc2626',
    darkRgb: '220, 38, 38'
  },
  warning: {
    hex: '#f59e0b',
    rgb: '245, 158, 11',
    light: '#fcd34d',
    lightRgb: '252, 211, 77',
    dark: '#d97706',
    darkRgb: '217, 119, 6'
  },
  tun: {
    hex: '#3b82f6',
    rgb: '59, 130, 246',
    light: '#93c5fd',
    lightRgb: '147, 197, 253',
    dark: '#2563eb',
    darkRgb: '37, 99, 235'
  },
  proxy: {
    hex: '#10b981',
    rgb: '16, 185, 129',
    light: '#6ee7b7',
    lightRgb: '110, 231, 183',
    dark: '#059669',
    darkRgb: '5, 150, 105'
  },
  full: {
    hex: '#a855f7',
    rgb: '168, 85, 247',
    light: '#c4b5fd',
    lightRgb: '196, 181, 253',
    dark: '#9333ea',
    darkRgb: '147, 51, 234'
  },
  offline: {
    hex: '#6b7280',
    rgb: '107, 116, 128',
    light: '#9ca3af',
    lightRgb: '156, 163, 175',
    dark: '#4b5563',
    darkRgb: '75, 85, 99'
  },
  online: {
    hex: '#ffffff',
    rgb: '255, 255, 255',
    light: '#ffffff',
    lightRgb: '255, 255, 255',
    dark: '#e5e7eb',
    darkRgb: '229, 231, 235'
  }
} as const

export type ModeColorKey = keyof typeof MODE_COLORS

export function getModeColor(
  tunMode: boolean,
  sysProxy: boolean,
  hasError: boolean,
  isRunning: boolean
): ModeColor {
  if (hasError) return MODE_COLORS.error
  if (!isRunning) return MODE_COLORS.offline
  if (tunMode && sysProxy) return MODE_COLORS.full
  if (tunMode) return MODE_COLORS.tun
  if (sysProxy) return MODE_COLORS.proxy
  return MODE_COLORS.online
}

export function getTunModeColor(): ModeColor {
  return MODE_COLORS.tun
}

export function getProxyModeColor(): ModeColor {
  return MODE_COLORS.proxy
}
