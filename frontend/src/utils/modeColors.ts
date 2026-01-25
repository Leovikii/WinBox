// Mode-based fixed color scheme for WinBox v2.4
// These colors are independent of the user's accent color theme

export interface ModeColor {
  hex: string
  rgb: string
}

export const MODE_COLORS = {
  error: { hex: '#ef4444', rgb: '239, 68, 68' },
  warning: { hex: '#eab308', rgb: '234, 179, 8' },
  tun: { hex: '#3b82f6', rgb: '59, 130, 246' },
  proxy: { hex: '#10b981', rgb: '16, 185, 129' },
  full: { hex: '#a855f7', rgb: '168, 85, 247' },
  offline: { hex: '#333333', rgb: '51, 51, 51' },
  online: { hex: '#ffffff', rgb: '255, 255, 255' }
} as const

export type ModeColorKey = keyof typeof MODE_COLORS

/**
 * Get the appropriate mode color based on current state
 */
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

/**
 * Get color for TUN mode icon and switch
 */
export function getTunModeColor(): ModeColor {
  return MODE_COLORS.tun
}

/**
 * Get color for Proxy mode icon and switch
 */
export function getProxyModeColor(): ModeColor {
  return MODE_COLORS.proxy
}
