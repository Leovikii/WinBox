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
    hex: '#E95464',
    rgb: '233, 84, 100',
    light: '#F4A7B0',
    lightRgb: '244, 167, 176',
    dark: '#D93A4A',
    darkRgb: '217, 58, 74'
  },
  warning: {
    hex: '#F8B500',
    rgb: '248, 181, 0',
    light: '#FCD575',
    lightRgb: '252, 213, 117',
    dark: '#E8A500',
    darkRgb: '232, 165, 0'
  },
  tun: {
    hex: '#5383C3',
    rgb: '83, 131, 195',
    light: '#89C3EB',
    lightRgb: '137, 195, 235',
    dark: '#165E83',
    darkRgb: '22, 94, 131'
  },
  proxy: {
    hex: '#38B48B',
    rgb: '56, 180, 139',
    light: '#7EBEAB',
    lightRgb: '126, 190, 171',
    dark: '#00896C',
    darkRgb: '0, 137, 108'
  },
  full: {
    hex: '#8B7FA8',
    rgb: '139, 127, 168',
    light: '#C5A3BF',
    lightRgb: '197, 163, 191',
    dark: '#674598',
    darkRgb: '103, 69, 152'
  },
  offline: {
    hex: '#8A8A8A',
    rgb: '138, 138, 138',
    light: '#B0B0B0',
    lightRgb: '176, 176, 176',
    dark: '#6A6A6A',
    darkRgb: '106, 106, 106'
  },
  online: {
    hex: '#D0D0D0',
    rgb: '208, 208, 208',
    light: '#E8E8E8',
    lightRgb: '232, 232, 232',
    dark: '#B0B0B0',
    darkRgb: '176, 176, 176'
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
