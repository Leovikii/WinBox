import assert from 'node:assert/strict'
import { brandRamp, createWinBoxTheme, luminance } from '../src/theme.ts'
import { appendTraffic, emptyTrafficHistory } from '../src/utils/trafficHistory.ts'

const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + .05) / (Math.min(luminance(a), luminance(b)) + .05)
const colors = ['#0090ff', '#30a46c', '#d6409f', '#8e4ec6', '#e54d2e', '#ffffff', '#000000', '#ffff00', '#808080']
for (const color of colors) {
  const steps = Object.values(brandRamp(color)).map(luminance)
  assert.equal(steps.length, 16)
  assert(steps.every((step, i) => i === 0 || step > steps[i - 1]), `monotonic ramp: ${color}`)
  for (const dark of [false, true]) {
    const theme = createWinBoxTheme(color, dark)
    for (const state of ['', 'Hover', 'Pressed', 'Selected']) {
      assert(contrast(theme.colorNeutralForegroundOnBrand, theme[`colorBrandBackground${state}`]) >= 4.5, `button contrast ${color}/${dark}/${state}`)
      assert(contrast(theme.colorNeutralForeground1, theme[`colorNeutralBackground1${state}`]) >= 4.5, `neutral text contrast ${dark}/${state}`)
      assert(contrast(theme.colorBrandForeground1, theme[`colorNeutralBackground1${state}`]) >= 4.5, `brand marker/text contrast ${color}/${dark}/${state}`)
    }
    assert(contrast(theme.colorBrandForeground1, theme.colorNeutralBackground1) >= 4.5, `brand text contrast ${color}/${dark}`)
    assert.notEqual(theme.colorBrandBackground, theme.colorBrandBackgroundHover)
  }
  assert(contrast(color, luminance(color) > .179 ? '#000000' : '#ffffff') >= 4.5, `custom swatch edit glyph ${color}`)
}
assert.deepEqual(brandRamp('invalid'), brandRamp('#0090ff'))
let history = emptyTrafficHistory()
for (let i = 0; i < 40; i++) history = appendTraffic(history, 1234, 5678)
assert.equal(history.length, 30)
assert(history.every(point => point.up === 1234 && point.down === 5678), 'identical events still advance samples')
const previous = history
history = appendTraffic(history, -1, Number.NaN)
assert.deepEqual(history.at(-1), { up: 0, down: 0 })
assert.equal(previous.at(-1).up, 1234, 'history is immutable')
console.log('PASS: 9 accent colors × 2 themes × 4 button states, brand text, ramp bounds; traffic sampling and invalid values')
