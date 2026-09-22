// Uses an already provisioned Playwright installation; no production dependency.
// node tests/visual-checks.mjs /absolute/path/to/playwright-core
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdir, writeFile, rename, readFile, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
const { chromium } = createRequire(import.meta.url)(process.argv[2] || 'playwright-core')
const baseURL = process.env.WINBOX_TEST_URL || 'http://127.0.0.1:4173'
let initScript
{
  // Run the exact production bundle. Only the test browser receives the official
  // mock and fixture data before application scripts execute.
  const require = createRequire(import.meta.url)
  const ts = require('typescript')
  const mocks = (await readFile(resolve('frontend/node_modules/@tauri-apps/api/mocks.js'), 'utf8')).replace(/export \{[^}]*\};?/, '')
  const fixture = (await readFile(resolve('frontend/tests/visual.ts'), 'utf8'))
    .replace(/^import .*$/gm, '').replace(/await import\('..\/src\/main'\)/, '')
  const compiled = ts.transpileModule(fixture, { compilerOptions: { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext } }).outputText.replace(/export \{\};?/, '')
  initScript = `${mocks}\nconst emit = (event, payload) => window.__TAURI_INTERNALS__.invoke('plugin:event|emit', {event, payload});\n${compiled}`
}
const evidence = resolve(process.env.WINBOX_EVIDENCE_DIR || 'frontend/test-results')
await mkdir(evidence, { recursive: true })
const browser = await chromium.launch({ headless: true, channel: process.env.WINBOX_BROWSER_CHANNEL || 'msedge' })
const context = await browser.newContext({ viewport: { width: 400, height: 720 }, reducedMotion: 'no-preference', recordVideo: { dir: evidence, size: { width: 400, height: 720 } } })
if (initScript) await context.addInitScript(initScript)
// Test-only React commit observer: no instrumentation enters the production bundle.
await context.addInitScript(() => {
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    inject: () => 1,
    onCommitFiberRoot: (_id, root) => {
      window.reactRoot = root;
      if (!window.renderTargets) return;
      const visit = fiber => {
        for (const target of window.renderTargets) {
          if (fiber.type === target.type && fiber !== target.last) {
            if (fiber.flags & 1) target.count++;
            target.last = fiber;
          }
        }
        if (fiber.child) visit(fiber.child);
        if (fiber.sibling) visit(fiber.sibling);
      };
      visit(root.current);
    },
    onCommitFiberUnmount: () => {},
  };
});

const page = await context.newPage()
const failures = []
page.on('pageerror', error => failures.push(error.message))
const results = []
const metrics = {}
const sourceHash = createHash('sha256')
for (const file of (await readdir(resolve('frontend/src'), { recursive: true })).filter(file => /\.(tsx?|css)$/.test(file)).sort()) {
  sourceHash.update(file).update(await readFile(resolve('frontend/src', file)))
}
const sourceSha256 = sourceHash.digest('hex')
const check = (name, value) => { assert(value, name); results.push(name) }
const settle = () => page.waitForTimeout(350)
const capture = async name => {
  const badSurfaces = await page.locator('[role="dialog"], [role="listbox"]').evaluateAll(nodes => nodes.filter(e => e.checkVisibility()).filter(e => {
    const r = e.getBoundingClientRect();
    return r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || e.scrollWidth > e.clientWidth + 2;
  }).map(e => ({ role: e.getAttribute('role'), text: e.textContent?.slice(0, 60) })));
  assert.deepEqual(badSurfaces, [], `${name}: popup stays within viewport without horizontal overflow`);
  await page.screenshot({ path: resolve(evidence, `${name}.png`) });
}
const button = name => page.getByRole('button', { name, exact: true })
const visibleOverflow = () => page.evaluate(() => [...document.querySelectorAll('button,[role=combobox],.setting-label')]
  .filter(e => e.checkVisibility() && !e.closest('[inert]') && e.getBoundingClientRect().width > 0 && e.scrollWidth > e.clientWidth + 2)
  .map(e => e.textContent))
try {
  await page.goto(baseURL)
  await button('Start').waitFor()
  await settle()
  check('normal motion media active', !await page.evaluate(() => matchMedia('(prefers-reduced-motion:reduce)').matches))
  await capture('dashboard-light')
  // Offline mode persistence must not trigger the whole-dashboard busy treatment.
  await page.evaluate(() => window.visualTest.holdNext('save_mode'));
  await page.getByRole('radio', { name: 'TUN', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[aria-label="Proxy mode"]').getAttribute('aria-busy') === 'true');
  check('offline mode save preserves status icon', await page.locator('.status-led-spin').count() === 0);
  check('offline mode save preserves profile availability', await page.getByRole('combobox', { name: 'Select profile', exact: true }).isEnabled());
  check('offline mode waits for successful save', await page.getByRole('radio', { name: 'Proxy', exact: true }).isChecked());
  await page.getByRole('radio', { name: 'Mixed', exact: true }).dispatchEvent('click');
  check('pending mode save rejects duplicate requests', await page.evaluate(() => window.visualTest.calls.filter(x => x === 'save_mode').length) === 1);
  await page.evaluate(() => {
    window.modeFrames = [];
    const end = performance.now() + 500;
    const sample = () => {
      const page = document.querySelector('.winbox-page-dashboard');
      const slider = document.querySelector('.mode-selector');
      window.modeFrames.push({ opacity: Number(getComputedStyle(page).opacity), transform: getComputedStyle(page).transform, slider: getComputedStyle(slider, '::before').transform, spinning: !!document.querySelector('.status-led-spin') });
      if (performance.now() < end) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    window.visualTest.release();
  });
  await page.waitForTimeout(550);
  metrics.offlineModeFrames = await page.evaluate(() => window.modeFrames);
  check('mode slider moves through intermediate frames', new Set(metrics.offlineModeFrames.map(f => f.slider)).size > 2);
  check('mode animation keeps the page opaque and stationary', metrics.offlineModeFrames.every(f => f.opacity === 1 && f.transform === 'matrix(1, 0, 0, 1, 0, 0)' && !f.spinning));
  check('mode save commits selected mode', await page.getByRole('radio', { name: 'TUN', exact: true }).isChecked());
  await page.evaluate(() => window.visualTest.failNext('save_mode'));
  await page.getByRole('radio', { name: 'Mixed', exact: true }).click(); await settle();
  check('offline mode save failure retains selection and unlocks retry', await page.getByRole('radio', { name: 'TUN', exact: true }).isChecked() && await page.getByRole('radio', { name: 'Mixed', exact: true }).isEnabled());
  await page.goto(baseURL); await button('Start').waitFor(); await settle();
  await button('Settings').click(); await settle();
  const startupSwitch = page.getByRole('switch', { name: 'Run at startup', exact: true });
  await page.evaluate(() => window.visualTest.holdNext('set_start_on_boot'));
  await startupSwitch.click();
  await page.waitForFunction(() => document.querySelector('[aria-label="Run at startup"]').disabled);
  check('startup request disables repeated clicks', await startupSwitch.isDisabled() && !await startupSwitch.isChecked());
  await page.evaluate(() => window.visualTest.release()); await settle();
  check('startup reflects verified backend state', await startupSwitch.isChecked() && await startupSwitch.isEnabled());
  await startupSwitch.click(); await settle();
  check('startup can be disabled', !await startupSwitch.isChecked());
  await button('Back to Home').click(); await settle();
  await page.evaluate(() => { window.visualTest.state.startOnBoot = true });
  await button('Settings').click(); await settle();
  check('settings reveal refreshes external startup changes', await startupSwitch.isChecked());
  await button('Back to Home').click(); await settle();
  await page.evaluate(() => window.visualTest.failNext('get_start_on_boot'));
  await button('Settings').click(); await settle();
  check('startup query failure is visible and not reported as off', await startupSwitch.isDisabled() && await page.getByText('Fixture: requested operation failed', { exact: true }).isVisible());
  await page.goto(baseURL); await button('Start').waitFor(); await settle();

  await page.evaluate(() => window.visualTest.holdNext('save_mode'));
  await page.getByRole('radio', { name: 'TUN', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[aria-label="Proxy mode"]').getAttribute('aria-busy') === 'true');
  await page.evaluate(async () => {
    await window.visualTest.emit('state-sync', { tunMode: true, sysProxy: true });
    window.visualTest.release();
  });
  await settle();
  check('late offline save cannot overwrite newer mode event', await page.getByRole('radio', { name: 'Mixed', exact: true }).isChecked());
  await page.goto(`${baseURL}?scenario=slow-log`);
  await page.waitForFunction(() => window.visualTest.calls.includes('get_app_log'));
  await page.evaluate(async () => {
    await window.visualTest.emit('onAppLog', 'newer-than-snapshot\n');
    window.visualTest.release();
  });
  await settle();
  check('late log snapshot cannot overwrite queued events', (await page.locator('.inline-log-content').textContent()).includes('newer-than-snapshot'));
  await page.goto(`${baseURL}?scenario=slow-init`);
  await page.waitForFunction(() => window.visualTest.calls.includes('get_init_data'));
  await page.evaluate(async () => {
    await window.visualTest.emit('core-busy', true);
    await window.visualTest.emit('status', true);
    await window.visualTest.emit('state-sync', { tunMode: true, sysProxy: false });
    window.visualTest.release();
  });
  await button('Stop').waitFor(); await settle();
  check('late initialization cannot overwrite newer running event', await page.locator('.dashboard-running').isVisible());
  check('late initialization cannot unlock ongoing operation', await button('Stop').isDisabled());
  check('late initialization cannot overwrite newer mode event', await page.getByRole('radio', { name: 'TUN', exact: true }).isChecked());
  await page.goto(baseURL); await button('Start').waitFor(); await settle();
  // Hold the backend at actual lifecycle boundaries, beyond the CSS transition time.
  const waitPhase = name => page.waitForFunction(name => window.visualTest.phase === name, name);
  const holdPhase = name => page.evaluate(name => window.visualTest.holdPhase(name), name);
  const releasePhase = () => page.evaluate(() => window.visualTest.releasePhase());
  const primaryAction = page.locator('.control-actions > button');
  const runningLayout = () => page.locator('.dashboard-page').evaluate(e => e.classList.contains('dashboard-running'));
  await holdPhase('ready');
  await button('Start').click(); await waitPhase('ready'); await page.waitForTimeout(700);
  check('slow startup keeps idle geometry until backend ready', !await runningLayout());
  check('slow startup keeps Start disabled', await primaryAction.isDisabled());
  await capture('startup-waiting');
  await releasePhase(); await waitPhase('done'); await settle();
  check('ready event enables running geometry', await runningLayout());

  await page.evaluate(() => window.visualTest.failStop());
  await button('Stop').click(); await waitPhase('done'); await settle();
  check('failed stop preserves running geometry and permits retry', await runningLayout() && await button('Stop').isEnabled());
  if (await button('Dismiss error').isVisible()) await button('Dismiss error').click();
  await holdPhase('stop'); await button('Stop').click(); await waitPhase('stop'); await settle();
  check('stop waits for actual process exit', await runningLayout() && await primaryAction.isDisabled());
  await holdPhase('return'); await releasePhase(); await waitPhase('return'); await settle();
  check('stopped event collapses cards but keeps operation locked', !await runningLayout() && await primaryAction.isDisabled());
  await releasePhase(); await waitPhase('done');
  check('stop completion unlocks controls', await button('Start').isEnabled());

  await button('Start').click(); await waitPhase('done'); await button('Restart').waitFor(); await settle();
  await holdPhase('ready'); await button('Restart').click(); await waitPhase('ready'); await settle();
  check('restart reflects stopped old process and remains busy', !await runningLayout() && await primaryAction.isDisabled());
  await capture('restart-waiting');
  await releasePhase(); await waitPhase('done'); await settle();
  check('restart only expands after new process ready', await runningLayout());

  await holdPhase('ready'); await page.getByRole('radio', { name: 'TUN', exact: true }).click();
  await waitPhase('ready'); await settle();
  check('mode switch holds old selection until backend confirms', await page.getByRole('radio', { name: 'Proxy', exact: true }).isChecked());
  check('mode switch stays locked between processes', !await runningLayout() && await primaryAction.isDisabled());
  await releasePhase(); await waitPhase('done'); await settle();
  check('mode selection and running state commit on backend confirmation', await runningLayout() && await page.getByRole('radio', { name: 'TUN', exact: true }).isChecked());

  await page.evaluate(() => window.visualTest.failStartup());
  await page.getByRole('radio', { name: 'Mixed', exact: true }).click(); await waitPhase('done'); await settle();
  check('failed mode switch restores selection and stays offline', !await runningLayout() && await page.getByRole('radio', { name: 'TUN', exact: true }).isChecked());
  if (await button('Dismiss error').isVisible()) await button('Dismiss error').click();
  await button('Start').click(); await waitPhase('done'); await settle();
  await page.evaluate(() => window.visualTest.failStartup());
  await button('Restart').click(); await waitPhase('done'); await settle();
  check('failed restart stays offline and unlocks retry', !await runningLayout() && await button('Start').isEnabled());
  await capture('startup-failed');
  if (await button('Dismiss error').isVisible()) await button('Dismiss error').click();
  await page.evaluate(() => window.visualTest.exitBeforeReturn());
  await button('Start').click(); await waitPhase('done'); await settle();
  check('late success response cannot overwrite process exit event', !await runningLayout());
  await page.getByRole('radio', { name: 'Proxy', exact: true }).click(); await settle();
  // Sample the actual rendered boxes, including interrupted transitions.
  const measureHomepage = () => page.evaluate(async () => {
    const box = selector => {
      const r = document.querySelector(selector).getBoundingClientRect();
      return { top: r.top, height: r.height, width: r.width };
    };
    const sample = () => ({ status: box('.status-card'), profile: box('.profile-card'), controls: box('.controls-card'), logs: box('.logs-card'), button: box('.control-actions > button') });
    const idle = sample(), frames = [];
    const record = ms => new Promise(resolve => {
      const start = performance.now();
      function frame(now) { frames.push(sample()); if (now - start < ms) requestAnimationFrame(frame); else resolve(); }
      requestAnimationFrame(frame);
    });
    await window.visualTest.emit('status', true); await record(450);
    const running = sample();
    await window.visualTest.emit('status', false); await record(450);
    await window.visualTest.emit('status', true); await record(100);
    await window.visualTest.emit('status', false); await record(450);
    return { idle, running, frames };
  });
  metrics.homepage = await measureHomepage();
  const geometry = metrics.homepage;
  check('upper cards exchange heights', Math.abs(geometry.idle.status.height - geometry.running.profile.height) < 1 && Math.abs(geometry.idle.profile.height - geometry.running.status.height) < 1);
  check('upper pair total height stays constant every frame', geometry.frames.every(f => Math.abs(f.status.height + f.profile.height - geometry.idle.status.height - geometry.idle.profile.height) < 1));
  check('lower cards position and dimensions stay fixed every frame', geometry.frames.every(f => ['controls', 'logs'].every(key => ['top', 'height', 'width'].every(prop => Math.abs(f[key][prop] - geometry.idle[key][prop]) < 1))));
  check('height exchange has intermediate frames', geometry.frames.some(f => f.status.height > geometry.idle.status.height + 5 && f.status.height < geometry.running.status.height - 5));
  check('Start fills the action row and contracts to one third', geometry.idle.button.width > geometry.running.button.width * 2.9);
  for (const [width, height] of [[320, 640], [480, 800]]) {
    await page.setViewportSize({ width, height });
    await settle();
    const g = await measureHomepage();
    metrics[`homepage${width}`] = g;
    check(`homepage ${width} upper sum and lower geometry stable`, g.frames.every(f => Math.abs(f.status.height + f.profile.height - g.idle.status.height - g.idle.profile.height) < 1 && ['controls', 'logs'].every(k => ['top', 'height', 'width'].every(p => Math.abs(f[k][p] - g.idle[k][p]) < 1))));
    await capture(`homepage-${width}`);
  }
  await page.setViewportSize({ width: 400, height: 720 });
  await settle();
  const start = button('Start')
  const rest = await start.evaluate(e => getComputedStyle(e).backgroundColor)
  await start.hover()
  await settle()
  check('primary hover has a distinct official state', await start.evaluate(e => getComputedStyle(e).backgroundColor) !== rest)
  await page.mouse.down()
  await page.waitForTimeout(100)
  await capture('button-pressed-light')
  check('primary pressed has a distinct official state', await start.evaluate(e => getComputedStyle(e).backgroundColor) !== rest)
  await page.mouse.move(5, 5)
  await page.mouse.up()
  const openDropdown = async (name, keyboard = false) => {
    const trigger = page.getByRole('combobox', { name, exact: true });
    await trigger.focus();
    await page.evaluate(() => {
      window.dropdownFrames = [];
      window.dropdownRecording = true;
      const sample = () => {
        const menu = document.querySelector('[role="listbox"]');
        const control = document.querySelector('[role="combobox"][aria-expanded="true"]');
        if (menu && control && getComputedStyle(menu).display !== 'none') {
          const m = menu.getBoundingClientRect(), t = control.getBoundingClientRect();
          window.dropdownFrames.push({ left: m.left, top: m.top, width: m.width, height: m.height, targetLeft: t.left, targetTop: t.top, targetBottom: t.bottom, targetWidth: t.width, opacity: Number(getComputedStyle(menu).opacity) });
        }
        if (window.dropdownRecording) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    });
    if (keyboard) await page.keyboard.press('Space'); else await trigger.click();
    await page.waitForTimeout(250);
    const frames = await page.evaluate(() => { window.dropdownRecording = false; return window.dropdownFrames; });
    metrics.dropdownFrames ||= [];
    metrics.dropdownFrames.push({ name, keyboard, frames });
    check(`${name} menu matches trigger width on every opening frame`, frames.length > 4 && frames.every(f => Math.abs(f.width - f.targetWidth) <= 3));
    check(`${name} menu stays anchored on every opening frame`, frames.every(f => Math.abs(f.left - f.targetLeft) <= 3 && (Math.abs(f.top - f.targetBottom) <= 6 || Math.abs(f.top + f.height - f.targetTop) <= 6)));
    check(`${name} menu fades in without changing its positioning transform`, frames.some(f => f.opacity > 0 && f.opacity < 1) && frames.at(-1).opacity === 1);
  };
  await openDropdown('Select profile');
  await settle()
  check('only selected profile displays the official slot marker', await page.getByRole('option').evaluateAll(options => options.every(e => (getComputedStyle(e.querySelector('.winbox-option-marker')).visibility === 'visible') === (e.getAttribute('aria-selected') === 'true'))))
  await capture('profile-dropdown-light')
  await page.keyboard.press('Escape')
  await openDropdown('Select profile', true);
  await page.keyboard.press('Escape');
  await button('Manage profiles').click()
  await page.getByRole('dialog', { name: 'Manage profiles' }).waitFor()
  await settle()
  await capture('profiles-light')
  check('unchanged profile Save remains disabled', await button('Save').isDisabled())
  const count = await page.locator('.profile-presence').count()
  await button('Add profile').click()
  await settle()
  check('profile enters with official presence', await page.locator('.profile-presence').count() === count + 1)
  await button('Save').click()
  await settle()
  check('empty profile validation keeps the editor and error visible', await page.getByText('Name and URL cannot be empty', { exact: true }).isVisible())
  await capture('profile-validation-light')
  await button('Delete profile').click()
  check('deleted row retained during exit', await page.locator('.profile-presence').count() === count + 1)
  await settle()
  check('deleted row removed after exit', await page.locator('.profile-presence').count() === count)
  await page.keyboard.press('Escape')
  await settle()
  check('dialog restores trigger focus', await button('Manage profiles').evaluate(e => e === document.activeElement))

  await page.getByRole('radio', { name: 'TUN', exact: true }).check()
  await settle()
  check('mode slider selects TUN', await page.locator('.mode-selector').getAttribute('data-selected') === 'tun')
  await page.getByRole('radio', { name: 'TUN', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  await settle()
  check('mode keyboard selects Mixed', await page.getByRole('radio', { name: 'Mixed', exact: true }).isChecked())
  await capture('mode-keyboard-light')
  await page.keyboard.press('ArrowLeft')
  await settle()
  check('mode restores keyboard focus after async save', await page.getByRole('radio', { name: 'TUN', exact: true }).evaluate(e => e.checked && e === document.activeElement))
  await button('Expand logs').click()
  await settle()
  await capture('logs-light')
  await page.keyboard.press('Escape')
  await settle()
  await button('Start').click()
  check('busy mode group disables all radios', await page.getByRole('radio').evaluateAll(nodes => nodes.length === 3 && nodes.every(e => e.disabled)))
  await capture('dashboard-busy')
  await page.getByRole('button', { name: 'Stop', exact: true }).waitFor()
  await settle()
  await page.evaluate(async () => { for (let i = 0; i < 35; i++) await window.visualTest.emit('traffic-update', { upload: 40960, download: 102400 + i * 1024 }) })
  await settle()
  await capture('dashboard-running')
  const trackRenders = () => page.evaluate(() => {
    window.renderTargets = ['.dashboard-page', '.speed-chart', '.logs-card'].map(selector => {
      const element = document.querySelector(selector);
      let fiber = element[Object.keys(element).find(key => key.startsWith('__reactFiber$'))];
      while (fiber && typeof fiber.type !== 'function') fiber = fiber.return;
      const type = fiber.type;
      const findCurrent = node => !node ? null : node.type === type ? node : findCurrent(node.child) || findCurrent(node.sibling);
      return { selector, type, last: findCurrent(window.reactRoot.current), count: 0 };
    });
  });
  await trackRenders();
  await page.evaluate(async () => {
    for (let i = 0; i < 20; i++) {
      await window.visualTest.emit('onAppLog', `batch-log-${i}\n`);
      await new Promise(resolve => setTimeout(resolve, 2));
    }
  });
  await settle();
  metrics.logRenders = await page.evaluate(() => window.renderTargets.map(({ selector, count }) => ({ selector, count })));
  check('batched logs do not rerender dashboard or chart', metrics.logRenders[0].count === 0 && metrics.logRenders[1].count === 0 && metrics.logRenders[2].count > 0 && metrics.logRenders[2].count < 20);
  check('log batching retains all ordered entries', await page.locator('.inline-log-content').evaluate(e => Array.from({length:20}, (_,i) => `batch-log-${i}\n`).every((line,i,lines) => e.textContent.includes(line) && (!i || e.textContent.indexOf(lines[i-1]) < e.textContent.indexOf(line)))));
  await trackRenders();
  await page.evaluate(() => window.visualTest.emit('traffic-update', { upload: 42, download: 84 }));
  await settle();
  metrics.trafficRenders = await page.evaluate(() => window.renderTargets.map(({ selector, count }) => ({ selector, count })));
  check('traffic redraws chart without rerendering dashboard or logs', metrics.trafficRenders[0].count === 0 && metrics.trafficRenders[1].count > 0 && metrics.trafficRenders[2].count === 0);
  await page.evaluate(() => { window.renderTargets = null });

  await openDropdown('Active profile');
  await page.keyboard.press('Escape');
  check('traffic series have a non-color distinction', await page.locator('.speed-chart path').evaluateAll(nodes => nodes.some(e => e.getAttribute('stroke-dasharray') || getComputedStyle(e).strokeDasharray !== 'none')))
  metrics.trafficFrames = await page.evaluate(async () => {
    const frames = []
    let previous = performance.now(), running = true
    function tick(now) { frames.push(now - previous); previous = now; if (running) requestAnimationFrame(tick) }
    requestAnimationFrame(tick)
    for (let i = 0; i < 25; i++) {
      await window.visualTest.emit('traffic-update', { upload: 40960, download: 137216 })
      await window.visualTest.emit('onAppLog', `[fixture ${i}] traffic sample\n`)
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    running = false
    const sorted = frames.sort((a,b) => a-b)
    return { samples: frames.length, p95ms: sorted[Math.floor(sorted.length * .95)], maxMs: Math.max(...frames), over50ms: frames.filter(x => x > 50).length }
  })
  check('running control labels fit', (await visibleOverflow()).length === 0)
  const chartPath = await page.locator('.speed-chart path').evaluateAll(nodes => nodes.map(e => e.getAttribute('d')).filter(Boolean))
  await button('Settings').click()
  await settle()
  check('hidden dashboard removed from keyboard/AX', !await button('Stop').isVisible())
  await button('Back to Home').click()
  await settle()
  await capture('chart-after-navigation')
  check('chart survives page navigation', JSON.stringify(await page.locator('.speed-chart path').evaluateAll(nodes => nodes.map(e => e.getAttribute('d')).filter(Boolean))) === JSON.stringify(chartPath))
  await button('Stop').click()
  await button('Start').waitFor()
  await settle()

  await button('Settings').click()
  await settle()
  await capture('settings-light')
  await page.getByRole('switch', { name: 'Download proxy' }).click()
  await settle()
  check('mirror edit expands', await button('Edit proxy URL').isVisible())
  await page.getByRole('switch', { name: 'Download proxy' }).click()
  await settle()
  check('collapsed mirror edit is inert', await page.locator('.mirror-edit').evaluate(e => e.inert))
  await button('Update').click()
  await settle()
  await capture('changelog-light')
  await button('Later').click()
  await settle()
  for (const name of ['Auto connect', 'On close action', 'Log level', 'Theme']) {
    await openDropdown(name);
    await page.keyboard.press('Escape');
  }
  const dropdown = page.getByRole('combobox', { name: 'Theme', exact: true })
  await dropdown.focus()
  await page.keyboard.press('Space')
  await page.keyboard.press('ArrowDown')
  await settle()
  await capture('dropdown-keyboard')
  check('selection mark remains on Light while keyboard focus moves', await page.getByRole('option', { name: 'Light', exact: true }).getAttribute('aria-selected') === 'true')
  check('portal does not cover the app', await page.locator('header').evaluate(e => document.elementFromPoint(30, 24)?.closest('header') === e))
  await page.getByRole('option', { name: 'Dark', exact: true }).click()
  await settle()
  await capture('settings-dark')
  check('dark theme applied', await page.locator('html').getAttribute('class') === 'dark')
  for (const name of ['Auto connect', 'On close action', 'Log level', 'Theme']) {
    await openDropdown(name, true);
    await page.keyboard.press('Escape');
  }
  await dropdown.click()
  await settle()
  await capture('dropdown-selected-dark')
  check('reopened menu retains selected Dark marker', await page.getByRole('option', { name: 'Dark', exact: true }).locator('.winbox-option-marker').isVisible())
  await page.keyboard.press('Escape')
  await button('Theme color').click()
  await settle()
  await page.getByRole('radio', { name: 'Green', exact: true }).click()
  await button('Cancel').click()
  await settle()
  check('theme Cancel keeps persisted color', await page.evaluate(() => window.visualTest.state.accentColor.toLowerCase()) === '#0090ff')
  await button('Theme color').click()
  await settle()
  await capture('theme-dark')
  await page.keyboard.press('Escape')
  await settle()

  const scroll = page.locator('.settings-scroll').locator('[data-overlayscrollbars-viewport]')
  await scroll.evaluate(e => { e.scrollTop = e.scrollHeight })
  const offset = await scroll.evaluate(e => e.scrollTop)
  await button('Back to Home').click()
  await button('Settings').click()
  await settle()
  check('settings scroll preserved', await scroll.evaluate(e => e.scrollTop) === offset)
  await page.locator('.setting-row').filter({ hasText: 'Inbound config' }).getByRole('button', { name: 'Edit' }).click()
  await settle()
  await capture('editor-dark')
  await page.getByRole('tab', { name: 'Mixed', exact: true }).click()
  check('editor tabs retain official selected semantics', await page.getByRole('tab', { name: 'Mixed', exact: true }).getAttribute('aria-selected') === 'true')
  await page.getByRole('textbox', { name: 'Configuration JSON' }).fill('{"inbounds":[{}]}')
  await button('Reset').click()
  await settle()
  check('nested confirmation available', await page.getByRole('dialog', { name: 'Confirm reset' }).isVisible())
  await page.keyboard.press('Escape')
  await settle()
  check('nested close keeps editor open', await page.locator('.editor-dialog').isVisible())
  await page.keyboard.press('Escape')
  await settle()
  await scroll.evaluate(e => { e.scrollTop = 0 })
  await page.locator('.setting-row').filter({ hasText: 'UWP loopback' }).getByRole('button', { name: 'Edit' }).click()
  await settle()
  await capture('uwp-dark')
  await button('All').click()
  check('UWP All checks every official Checkbox', await page.getByRole('dialog').getByRole('checkbox').evaluateAll(nodes => nodes.length > 0 && nodes.every(e => e.checked)))
  await button('None').click()
  check('UWP None clears all checkboxes', await page.getByRole('dialog').getByRole('checkbox').evaluateAll(nodes => nodes.every(e => !e.checked)))
  await page.keyboard.press('Escape')
  await settle()

  await page.evaluate(() => window.visualTest.failNext('set_start_on_boot'))
  await page.getByRole('switch', { name: 'Run at startup' }).click()
  await settle()
  check('failure rolls switch back', !await page.getByRole('switch', { name: 'Run at startup' }).isChecked())
  check('error message shown', await page.getByRole('button', { name: 'Dismiss error' }).isVisible())
  await button('Dismiss error').click()
  await settle()

  for (const [name, option] of [['Auto connect', 'On'], ['On close action', 'Ask'], ['Log level', 'Debug']]) {
    const control = page.getByRole('combobox', { name, exact: true })
    await control.click()
    await page.getByRole('option', { name: option, exact: true }).click()
    await control.click()
    check(`${name} selection persists on reopen`, await page.getByRole('option', { name: option, exact: true }).getAttribute('aria-selected') === 'true')
    await page.keyboard.press('Escape')
  }
  await scroll.evaluate(e => { e.scrollTop = 0 })
  await page.evaluate(() => window.visualTest.holdNext('update_program'))
  await button('Update').click()
  await button('Update now').click()
  const progress = page.getByRole('progressbar', { name: 'Application download' })
  await progress.waitFor()
  for (const value of [0, 50, 100]) {
    await page.evaluate(value => window.visualTest.emit('download-progress', value), value)
    await settle()
    check(`official progress exposes ${value}%`, Number(await progress.getAttribute('aria-valuenow')) === value / 100)
  }
  await capture('progress-dark')
  await page.evaluate(() => window.visualTest.release())
  await settle()

  await page.setViewportSize({ width: 320, height: 640 })
  await settle()
  check('narrow controls fit', (await visibleOverflow()).length === 0)
  await capture('settings-narrow')
  await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' })
  await button('Theme color').click()
  await settle()
  await capture('theme-high-contrast')
  check('reduced motion animation duration bounded', await page.evaluate(() => document.getAnimations().filter(a => a.effect?.target?.closest?.('.product-dialog')).every(a => Number(a.effect.getTiming().duration) <= 1)))
  await page.keyboard.press('Escape')
  await settle()
  check('reduced motion restores focus', await button('Theme color').evaluate(e => e === document.activeElement))
  await dropdown.click()
  await settle()
  await capture('dropdown-high-contrast')
  check('selected marker survives forced colors', await page.getByRole('option', { name: 'Dark', exact: true }).locator('.winbox-option-marker').isVisible())
  await page.keyboard.press('Escape')
  await button('Back to Home').click()
  await settle()
  await capture('dashboard-high-contrast')
  check('high contrast selected mode has opaque system background', await page.locator('.mode-selector').evaluate(e => {
    const fill = getComputedStyle(e, '::before').backgroundColor
    return fill.startsWith('rgb(')
  }))
  await button('Settings').click()
  await page.emulateMedia({ reducedMotion: 'no-preference', forcedColors: 'none' })
  await page.setViewportSize({ width: 400, height: 720 })
  await button('Back to Home').click()
  await button('Close').click()
  await settle()
  await capture('exit-dark')
  await page.keyboard.press('Escape')
  await settle()
  check('quit dialog restores caption focus', await button('Close').evaluate(e => e === document.activeElement))
  check('caption Close hover keeps its icon legible on red', await button('Close').locator('svg').evaluate(e => getComputedStyle(e).color === 'rgb(255, 255, 255)'))
  await page.mouse.move(10, 690)
  await page.evaluate(() => document.activeElement?.blur())
  await settle()
  await capture('dashboard-dark')
  await page.keyboard.press('Tab')
  await button('Manage profiles').focus()
  check('button official keyboard focus remains visible', await button('Manage profiles').evaluate(e => {
    const style = getComputedStyle(e)
    return e.matches(':focus-visible') && (style.boxShadow !== 'none' || style.outlineStyle !== 'none')
  }))
  await capture('button-focus-dark')
  await button('Settings').hover()
  check('caption hover does not open a tooltip portal', await page.getByRole('tooltip').count() === 0)
  await button('Settings').click()
  await dropdown.click()
  await page.getByRole('option', { name: 'System', exact: true }).click()
  await page.emulateMedia({ colorScheme: 'light' })
  await settle()
  check('System theme responds to light media', !await page.locator('html').evaluate(e => e.classList.contains('dark')))
  await page.emulateMedia({ colorScheme: 'dark' })
  await settle()
  check('System theme responds to dark media', await page.locator('html').evaluate(e => e.classList.contains('dark')))
  await button('Theme color').click()
  await page.getByLabel('Choose custom theme color', { exact: true }).fill('#ffff00')
  await button('Apply').click()
  await settle()
  check('custom accent Apply persists through official controls', await page.evaluate(() => window.visualTest.state.accentColor) === '#ffff00')
  await dropdown.click()
  await settle()
  await capture('dropdown-extreme-accent')
  await page.keyboard.press('Escape')
  await button('Theme color').click()
  await page.getByRole('radio', { name: 'Blue', exact: true }).click()
  await button('Apply').click()
  await settle()
  await button('Back to Home').click()
  // Rapid open/close must leave no orphan surface or focus trap.
  for (let i = 0; i < 3; i++) {
    await button('Manage profiles').click()
    await page.waitForTimeout(35)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(35)
  }
  await settle()
  check('rapid dialogs leave no orphan', await page.getByRole('dialog').count() === 0)
  for (const scenario of ['empty', 'missing']) {
    await page.goto(`${baseURL}?scenario=${scenario}`)
    await settle()
    await capture(`dashboard-${scenario}`)
    check(`${scenario} state has a recovery action`, await button(scenario === 'empty' ? 'Add profile' : 'Install kernel').isVisible())
  }
  // Kernel installation and both updater failure paths use the exact production IPC adapters.
  await page.emulateMedia({ reducedMotion: 'no-preference', forcedColors: 'none', colorScheme: 'light' });
  await page.setViewportSize({ width: 400, height: 720 });
  const kernelRow = page.locator('.setting-row').filter({ hasText: 'Kernel version' });
  const programRow = page.locator('.setting-row').filter({ hasText: 'App version' });
  const preReleaseSwitch = page.getByRole('switch', { name: 'Pre-release updates', exact: true });
  const openUpdateSettings = async (scenario = '') => {
    await page.goto(`${baseURL}?scenario=${scenario}`);
    await button('Settings').click(); await settle();
  };
  for (const message of ['Network request failed', 'The release service returned HTTP 403', 'Release data is invalid']) {
    await openUpdateSettings();
    await page.evaluate(message => window.visualTest.failNext('check_update', message), message);
    await kernelRow.getByRole('button', { name: 'Check', exact: true }).click(); await settle();
    check(`kernel check reports ${message} instead of Latest`, await kernelRow.getByRole('button', { name: 'Failed' }).isVisible() && await page.getByText(message, { exact: true }).isVisible());
  }
  await openUpdateSettings();
  await page.evaluate(() => window.visualTest.setKernelRelease('not-a-version'));
  await kernelRow.getByRole('button', { name: 'Check', exact: true }).click(); await settle();
  check('invalid kernel metadata is never Latest', await kernelRow.getByRole('button', { name: 'Failed' }).isVisible());
  await page.evaluate(() => window.visualTest.setKernelRelease('1.12.0'));
  await kernelRow.getByRole('button', { name: 'Failed' }).click(); await settle();
  check('matching installed kernel is Latest', await kernelRow.getByRole('button', { name: 'Latest' }).isDisabled());
  await openUpdateSettings('unknown-kernel');
  await kernelRow.getByRole('button', { name: 'Check', exact: true }).click(); await settle();
  check('unknown installed kernel version offers repair instead of Latest', await kernelRow.getByRole('button', { name: 'Update' }).isVisible());

  await openUpdateSettings('missing');
  await page.evaluate(() => { window.visualTest.failNext('update_kernel', 'Network request failed'); window.visualTest.holdNext('update_kernel') });
  const downloadButtonBounds = await kernelRow.getByRole('button', { name: 'Download', exact: true }).boundingBox();
  await kernelRow.getByRole('button', { name: 'Download', exact: true }).click();
  await page.getByRole('progressbar', { name: 'Kernel download' }).waitFor();
  check('missing kernel Download directly installs without a separate check', await page.evaluate(() => window.visualTest.calls.includes('update_kernel') && !window.visualTest.calls.includes('check_update')));
  check('kernel install locks the update channel and program install', await preReleaseSwitch.isDisabled() && await programRow.getByRole('button').isDisabled());
  await page.evaluate(() => window.visualTest.emit('download-progress', 50)); await settle();
  const progressBounds = await kernelRow.locator('.progress-action').boundingBox();
  check('download progress preserves button geometry', ['x','y','width','height'].every(key => Math.abs(downloadButtonBounds[key] - progressBounds[key]) < 1));
  check('download status includes operation and percentage', await kernelRow.getByText('50%', { exact: true }).isVisible());
  await capture('kernel-progress-light');
  check('kernel progress belongs to kernel download', Number(await page.getByRole('progressbar', { name: 'Kernel download' }).getAttribute('aria-valuenow')) === .5);
  await page.evaluate(() => window.visualTest.release()); await settle();
  check('missing kernel failure retains Not Installed and exposes retry', (await kernelRow.innerText()).includes('Not Installed') && await kernelRow.getByRole('button', { name: 'Failed' }).isEnabled() && await page.getByText('Network request failed', {exact:true}).isVisible());
  await page.evaluate(() => { window.visualTest.setKernelRelease('1.14.1'); window.visualTest.holdNext('update_kernel') });
  await kernelRow.getByRole('button', { name: 'Failed' }).click();
  await page.getByRole('progressbar', { name: 'Kernel download' }).waitFor();
  await page.evaluate(() => window.visualTest.release()); await settle();
  check('kernel retry installs and displays actual backend version', (await kernelRow.innerText()).includes('1.14.1') && await kernelRow.getByRole('button', { name: 'Updated' }).isVisible());
  check('kernel installation is not duplicated', await page.evaluate(() => window.visualTest.calls.filter(x => x === 'update_kernel').length) === 2);

  await openUpdateSettings();
  await kernelRow.getByRole('button', { name: 'Check', exact: true }).click(); await settle();
  await page.evaluate(() => window.visualTest.setKernelRelease('1.14.1'));
  await kernelRow.getByRole('button', { name: 'Update' }).click(); await settle();
  check('kernel uses shared confirmation dialog with versions and release notes', await page.getByRole('dialog', { name: 'Update sing-box' }).isVisible() && await page.getByText('1.12.0 → 1.13.0', {exact:true}).isVisible() && await page.getByText('Kernel improvements.', {exact:true}).isVisible());
  check('release emoji shortcode renders as Unicode', await page.getByRole('heading', {name:'📝 sing-box release notes'}).isVisible());
  await capture('kernel-update-dialog');
  await button('Later').click();
  check('kernel dialog retains its title during exit', await page.getByRole('dialog', {name:'Update sing-box'}).count() === 1);
  await settle();
  check('kernel Later restores focus without installing', await page.evaluate(() => !window.visualTest.calls.includes('update_kernel')) && await kernelRow.getByRole('button').evaluate(e => e === document.activeElement));
  await kernelRow.getByRole('button', {name:'Update',exact:true}).click(); await settle();
  await button('Update now').click(); await settle();
  check('changed release is not silently installed', await kernelRow.getByRole('button', {name:'Failed'}).isVisible() && await page.getByText('The available release changed. Check for updates and confirm again.', {exact:true}).isVisible());
  await kernelRow.getByRole('button', {name:'Failed'}).click(); await settle();
  await kernelRow.getByRole('button', {name:'Update',exact:true}).click(); await settle();
  await button('Update now').click(); await settle();
  check('confirmed kernel update installs and refreshes actual version', (await kernelRow.innerText()).includes('1.14.1') && await kernelRow.getByRole('button', {name:'Updated'}).isVisible());

  await openUpdateSettings('unknown-program');
  check('unknown application version is a visible failure rather than Latest', await programRow.getByRole('button', { name: 'Failed' }).isVisible() && await page.getByText('Could not read the application version', { exact: true }).isVisible());
  await page.evaluate(() => { window.visualTest.setProgramVersion('3.0.0-alpha.3'); window.visualTest.setProgramRelease('invalid') });
  await programRow.getByRole('button', { name: 'Failed' }).click(); await settle();
  check('invalid application release is not Latest', await programRow.getByRole('button', { name: 'Failed' }).isVisible() && await page.getByText('The release service returned an invalid application version', { exact: true }).isVisible());
  await page.evaluate(() => { window.visualTest.setProgramRelease('3.0.0-alpha.4', 'Visual regression fixture.\n\n[Release details](https://example.com/release) [unsafe](javascript:alert%281%29)'); window.visualTest.failNext('check_program_update', 'The release service returned HTTP 429') });
  await programRow.getByRole('button', { name: 'Failed' }).click(); await settle();
  check('application check shows server failure', await page.getByText('The release service returned HTTP 429', { exact: true }).isVisible());
  await page.evaluate(() => window.visualTest.holdNext('check_program_update'));
  await programRow.getByRole('button', { name: 'Failed' }).click();
  await page.waitForTimeout(3200);
  check('old failure timer cannot reset a pending retry', await programRow.getByRole('button', { name: 'Checking' }).isDisabled() && await preReleaseSwitch.isDisabled());
  await page.evaluate(() => window.visualTest.release()); await settle();
  await programRow.getByRole('button', { name: 'Update' }).click(); await settle();
  check('update dialog shows version and changelog', await page.getByRole('dialog', { name: "Update WinBox" }).isVisible() && await page.getByText('Visual regression fixture.', { exact: true }).isVisible());
  await page.getByRole('link', { name: 'Release details' }).click();
  check('changelog links open externally without navigating the app', await page.evaluate(() => window.visualTest.calls.includes('open_url')) && await page.getByRole('dialog').isVisible());
  check('unsafe changelog link is plain text', await page.getByRole('link', { name: 'unsafe' }).count() === 0);
  await button('Later').click(); await settle();
  check('Later does not start installation and restores focus', await page.evaluate(() => !window.visualTest.calls.includes('update_program')) && await programRow.getByRole('button').evaluate(e => e === document.activeElement));
  await programRow.getByRole('button').click(); await settle();
  await page.keyboard.press('Escape'); await settle();
  check('Escape closes update dialog without installation', await page.getByRole('dialog').count() === 0 && await page.evaluate(() => !window.visualTest.calls.includes('update_program')));
  await programRow.getByRole('button').click(); await settle();
  await page.evaluate(() => { window.visualTest.holdNext('update_program'); window.visualTest.failNext('update_program', 'Signature verification failed') });
  await button('Update now').click();
  await page.getByRole('progressbar', { name: 'Application download' }).waitFor();
  check('program install locks channel and kernel download', await preReleaseSwitch.isDisabled() && await kernelRow.getByRole('button').isDisabled());
  await page.evaluate(() => window.visualTest.release()); await settle();
  check('program signature failure is visible and retryable', await programRow.getByRole('button', {name:'Failed'}).isEnabled() && await page.getByText('Signature verification failed', {exact:true}).isVisible());
  await programRow.getByRole('button', {name:'Failed'}).click(); await settle();
  await programRow.getByRole('button', {name:'Update'}).click(); await settle();
  await button('Update now').click(); await settle();
  check('program update retry reaches restart state', await programRow.getByRole('button', {name:'Restarting'}).isDisabled());
  check('one program install per confirmation', await page.evaluate(() => window.visualTest.calls.filter(x=>x==='update_program').length) === 2);

  await openUpdateSettings();
  await page.evaluate(() => window.visualTest.setKernelRelease('v1.15.0-alpha.7', '## Changes\n\n' + Array.from({length:40}, (_,i) => `- Improvement ${i}`).join('\n')));
  await kernelRow.getByRole('button', {name:'Check',exact:true}).click(); await settle();
  check('long target version stays out of the compact button', await kernelRow.getByRole('button', {name:'Update',exact:true}).isVisible() && !(await kernelRow.innerText()).includes('alpha.7'));
  check('available update uses theme accent without animation', await kernelRow.getByRole('button', {name:'Update',exact:true}).evaluate(e => { const style=getComputedStyle(e); return style.color !== getComputedStyle(e.parentElement).color && style.animationName === 'none' }));
  await capture('compact-update-actions');
  await kernelRow.getByRole('button', {name:'Update',exact:true}).click(); await settle();
  for (const width of [320,400]) {
    await page.setViewportSize({width,height:720}); await settle();
    const viewport = page.getByRole('dialog').locator('[data-overlayscrollbars-viewport]');
    check(`long release notes scroll at ${width}`, await viewport.evaluate(e => { e.scrollTop=e.scrollHeight; return e.scrollTop > 0 }));
    check(`update footer remains visible at ${width}`, await button('Update now').evaluate(e => {const r=e.getBoundingClientRect();return r.top>=0 && r.bottom<=innerHeight}));
    await capture(`kernel-long-notes-${width}`);
  }
  await page.keyboard.press('Escape'); await settle();
  check('kernel Escape does not install', await page.evaluate(() => !window.visualTest.calls.includes('update_kernel')));

  // Browser device scale is evidence for CSS/raster scaling, not Windows OS DPI.
  for (const deviceScaleFactor of [1, 1.25, 1.5, 2]) {
    const scaled = await browser.newContext({ viewport: { width: 400, height: 720 }, deviceScaleFactor, reducedMotion: 'reduce' })
    if (initScript) await scaled.addInitScript(initScript)
    const scaledPage = await scaled.newPage()
    await scaledPage.goto(baseURL)
    await scaledPage.getByRole('button', { name: 'Start', exact: true }).waitFor()
    await scaledPage.screenshot({ path: resolve(evidence, `scale-${deviceScaleFactor}.png`) })
    check(`browser scale ${deviceScaleFactor} fits`, await scaledPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await scaled.close()
  }
  check('no uncaught browser errors', failures.length === 0)
} catch (error) {
  failures.push(error.message)
  throw error
} finally {
  await writeFile(resolve(evidence, 'visual-results.json'), JSON.stringify({ generatedAt: new Date().toISOString(), sourceSha256, browser: browser.version(), build: initScript ? 'production' : 'development', results, failures, metrics, viewport: '400x720 / 320x640', evidence: 'Browser fixture with Tauri mock; not a Windows WebView2/IPC pass' }, null, 2))
  await context.close()
  if (!failures.length) await rename(await page.video().path(), resolve(evidence, 'visual-regression.webm'))
  await browser.close()
  console.log(JSON.stringify({ passed: results.length, results, failures }, null, 2))
}
