import { createDarkTheme, createLightTheme, type BrandVariants, type Theme } from '@fluentui/react-components'
import type { CSSProperties } from 'react'

export function luminance(hex: string) {
  const channels = hex.match(/[a-f\d]{2}/gi)!.map(value => parseInt(value, 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722
}

// The locked Fluent package maps a ramp to semantic tokens, but does not export a
// custom-color ramp generator. Keep the chosen hue and bound each step's luminance.
export function brandRamp(accent: string): BrandVariants {
  const color = /^#[a-f\d]{6}$/i.test(accent) ? accent : '#0090ff'
  const channels = color.match(/[a-f\d]{2}/gi)!.map(value => parseInt(value, 16))
  const source = luminance(color)
  const levels = [.005, .01, .02, .035, .05, .075, .10, .14, .20, .28, .38, .48, .60, .72, .84, .94]
  return Object.fromEntries(levels.map((target, index) => {
    const end = target < source ? 0 : 255
    const mix = (amount: number) => '#' + channels.map(value => Math.round(value + (end - value) * amount).toString(16).padStart(2, '0')).join('')
    let low = 0, high = 1
    for (let step = 0; step < 12; step++) {
      const middle = (low + high) / 2
      if ((luminance(mix(middle)) < target) === (end === 255)) low = middle
      else high = middle
    }
    return [(index + 1) * 10, mix((low + high) / 2)]
  })) as BrandVariants
}

export function createWinBoxTheme(accent: string, dark: boolean): Theme {
  const ramp = brandRamp(accent)
  const theme = (dark ? createDarkTheme : createLightTheme)(ramp)
  return {
    ...theme,
    // Windows content and control surfaces: retain Fluent's state mapping while
    // separating controls from cards. Opaque popup surfaces never blur text below.
    colorNeutralBackground1: dark ? '#353535' : '#ffffff',
    colorNeutralBackground1Hover: dark ? '#3d3d3d' : '#f9f9f9',
    colorNeutralBackground1Pressed: dark ? '#303030' : '#f0f0f0',
    colorNeutralBackground1Selected: dark ? '#404040' : '#ededed',
    colorNeutralBackground2: dark ? '#292929' : '#f9f9f9',
    colorNeutralBackground3: dark ? '#202020' : '#f3f3f3',
    colorNeutralBackgroundAlpha2: dark ? 'rgba(43, 43, 43, .96)' : 'rgba(255, 255, 255, .78)',
    colorNeutralStroke1: dark ? '#494949' : '#dedede',
    colorNeutralStroke1Hover: dark ? '#555555' : '#c8c8c8',
    colorNeutralStroke1Pressed: dark ? '#404040' : '#d6d6d6',
    colorNeutralStroke1Selected: dark ? '#555555' : '#c8c8c8',
    colorNeutralStroke2: dark ? '#3d3d3d' : '#e5e5e5',
    colorNeutralStroke3: dark ? '#353535' : '#eeeeee',
    // Raised dark surfaces need a lighter brand foreground than the Web default.
    colorBrandForeground1: dark ? ramp[120] : theme.colorBrandForeground1,
    fontFamilyBase: '"Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif',
    fontFamilyMonospace: '"Cascadia Mono", Consolas, monospace',
  }
}

// Local semantic actions share Fluent's primary-button states and focus behavior.
export function brandButtonStyle(accent: string, dark: boolean): CSSProperties {
  const theme = createWinBoxTheme(accent, dark)
  return Object.fromEntries([
    'colorBrandBackground', 'colorBrandBackgroundHover', 'colorBrandBackgroundPressed',
    'colorBrandBackgroundSelected', 'colorNeutralForegroundOnBrand',
  ].map(key => [`--${key}`, theme[key as keyof Theme]])) as CSSProperties
}
