import { appendLog } from '../src/utils/logUtils.ts'
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

assert.equal(appendLog('a\n', 'b\n'), 'a\nb\n')
assert.equal(appendLog('', 'x'.repeat(700000)).length, 500000)
const bounded = appendLog('old\n'.repeat(150000), 'new\n'.repeat(50000))
assert(bounded.length <= 500000)
assert(bounded.endsWith('new\n'))
assert(!bounded.startsWith('ld\n'), 'truncate on a line boundary')
console.log('PASS: log batches are ordered and bounded, including oversized single lines')

const { renderChangelog } = await import('../src/utils/changelog.ts')
assert.equal(renderChangelog('[unsafe](javascript:alert%281%29)').includes('<a'), false)
assert.equal(renderChangelog('[unsafe](data:text/html,test)').includes('<a'), false)
assert.match(renderChangelog('[release](https://example.com/?a=1&b=2)'), /href="https:\/\/example.com\/\?a=1&amp;b=2"/)
assert.match(renderChangelog('<script>alert(1)</script>'), /&lt;script&gt;/)
assert.equal(renderChangelog('![image](https://example.com/image.png)').includes('<img'), false)

assert.match(renderChangelog('## :memo: Release Notes'), /📝 Release Notes/)
assert.match(renderChangelog('`:memo:`\n\n```\n:memo:\n```'), /<code>:memo:<\/code>/)
assert.match(renderChangelog('```\n:memo:\n```'), /<pre><code>:memo:/)
assert.match(renderChangelog('[:memo:](https://example.com/:memo:)'), /href="https:\/\/example.com\/:memo:">📝<\/a>/)
assert.match(renderChangelog(':unknown_emoji:'), /:unknown_emoji:/)
assert.match(renderChangelog(':constructor:'), /:constructor:/)
