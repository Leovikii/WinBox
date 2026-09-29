// Development-only fixture. Not imported by the production entry point.
import { mockIPC } from '@tauri-apps/api/mocks'
import { emit } from '@tauri-apps/api/event'

const profiles = [
  { id: 'one', name: 'Home profile', url: 'https://example.invalid/home', updated: '2026-09-22 10:00' },
  { id: 'two', name: '办公室 · Long profile name for overflow verification', url: 'https://example.invalid/work', updated: '2026-09-22 09:00' },
]
const state = {
  elevated: true, permissionPending: false, proxyError: null as string | null, autostart: false, handoffAction: null as any,
  running: false, coreBusy: false, startupStatus: null as 'Detecting' | 'Standby' | 'Net Timeout' | null, coreExists: true, localVersion: '1.12.0', tunMode: false, sysProxy: true,
  profiles, activeProfile: profiles[0], mirror: '', mirrorEnabled: false, startOnBoot: false,
  autoConnectState: 'smart', themeMode: localStorage.getItem('themeMode') || 'light',
  accentColor: localStorage.getItem('accentColor') || '#0090ff', ipv6Enabled: true,
  preRelease: false, logLevel: '', logToFile: true, closeBehavior: 'ask',
}
const scenario = new URLSearchParams(location.search).get('scenario')
if (scenario === 'startup-detecting') state.startupStatus = 'Detecting'
if (scenario === 'startup-standby') state.startupStatus = 'Standby'
if (scenario === 'startup-timeout') state.startupStatus = 'Net Timeout'
const savedMode = new URLSearchParams(location.search).get('savedMode')
if (savedMode === 'tun' || savedMode === 'mixed') {
  state.tunMode = true; state.sysProxy = savedMode === 'mixed'
}
if (scenario === 'proxy-recovery-failed') state.proxyError = 'System proxy recovery failed. Auto-connect paused. Retry Start or check Windows proxy settings.'
if (scenario === 'empty' || scenario === 'missing') { state.profiles = []; state.activeProfile = null as any }
if (scenario === 'missing') { state.coreExists = false; state.localVersion = 'Not Installed' }
if (scenario === 'unknown-kernel') state.localVersion = 'Unknown'
if (scenario === 'permission' || scenario === 'permission-autostart') {
  state.elevated = false; state.tunMode = true
  state.autostart = scenario === 'permission-autostart'
  state.permissionPending = state.autostart
}
if (scenario === 'uwp-resume') state.handoffAction = { kind: 'uwp', selected: ['test-1'] }
const calls: string[] = []
let failure = ''
let failureMessage = 'Fixture: requested operation failed'
let kernelRelease = '1.13.0'
let kernelChangelog = '## :memo: sing-box release notes\n\nKernel improvements.'
let programRelease = '3.0.0-alpha.4'
let programVersion = scenario === 'unknown-program' ? 'Unknown' : '3.0.0-alpha.3'
let programChangelog = '## Updates\nVisual regression fixture.'
let heldCommand = scenario === 'slow-init' ? 'get_init_data' : scenario === 'slow-log' ? 'get_app_log' : ''
let release: (() => void) | undefined
let lifecyclePhase = ''
let heldPhase = ''
let phaseRelease: (() => void) | undefined
let failStop = false
let failStartup = false
let failProfileName = ''
let failListener = scenario === 'listener-failure'
const overrides: Record<string, string> = { tun: '{"type":"tun"}', mixed: '{"type":"mixed"}' }
let exitBeforeReturn = false
async function phase(name: string) {
  lifecyclePhase = name
  if (heldPhase === name) {
    heldPhase = ''
    await new Promise<void>(resolve => { phaseRelease = resolve })
  }
}
async function applyLifecycle(targetTun: boolean, targetProxy: boolean, restart = false) {
  if (targetTun && !state.elevated) {
    state.permissionPending = true
    await emit('permission-required', { pending: true, prompt: !state.autostart })
    throw { code: 'permission_required', message: 'Administrator authorization is required' }
  }
  state.coreBusy = true
  await emit('core-busy', true)
  const starting = targetTun || targetProxy
  await emit(restart || state.running && starting ? 'core-restarting' : starting ? 'core-starting' : 'core-stopping')
  try {
    if (state.running) {
      await phase('stop')
      if (failStop) { failStop = false; throw new Error('Fixture: core stop failed') }
      state.running = false
      await emit('status', false)
    }
    if (starting) {
      await phase('ready')
      await new Promise(resolve => setTimeout(resolve, 450))
      if (failStartup) {
        failStartup = false
        await emit('status', false)
        throw new Error('Fixture: core exited before readiness')
      }
      state.running = true
      state.tunMode = targetTun
      state.sysProxy = targetProxy
      await emit('status', true)
      await emit('state-sync', { tunMode: targetTun, sysProxy: targetProxy })
    }
    await phase('return')
    if (exitBeforeReturn) {
      exitBeforeReturn = false
      state.running = false
      await emit('status', false)
    }
    return starting ? 'Success' : 'Stopped'
  } finally {
    state.coreBusy = false
    await emit('core-busy', false)
    lifecyclePhase = 'done'
  }
}
mockIPC(async (command, args: any) => {
  const initSnapshot = command === 'get_init_data' ? structuredClone(state) : undefined
  const overrideSnapshot = command === 'get_override' ? overrides[args.name] : undefined
  calls.push(command)
  if (heldCommand === command) {
    heldCommand = ''
    await new Promise<void>(resolve => { release = resolve })
  }
  if (failure === command) { failure = ''; throw { code: 'fixture_failure', message: failureMessage } }
  switch (command) {
    case 'frontend_ready':
      if (!document.querySelector('.winbox-provider') || !document.documentElement.hasAttribute('data-ui-ready')) throw new Error('Frontend signaled readiness before commit')
      return null
    case 'get_init_data': return initSnapshot
    case 'authorize': throw { message: 'Authorization cancelled' }
    case 'continue_handoff': state.handoffAction = null; return null
    case 'get_start_on_boot': return state.startOnBoot
    case 'set_start_on_boot': state.startOnBoot = args.enabled; return state.startOnBoot
    case 'set_auto_connect':
      if (!['off', 'smart', 'always'].includes(args.state)) throw { message: 'Auto-connect state must be off, smart, or always' }
      state.autoConnectState = args.state; return 'Success'
    case 'set_close_behavior':
      if (!['ask', 'tray', 'quit'].includes(args.behavior)) throw { message: 'Close behavior is invalid' }
      state.closeBehavior = args.behavior; return 'Success'
    case 'set_log_config':
      if (!['', 'trace', 'debug', 'info', 'warn', 'error', 'fatal', 'panic'].includes(args.level)) throw { message: 'Log level is invalid' }
      state.logLevel = args.level; state.logToFile = args.toFile; return 'Success'
    case 'get_product_version': return programVersion
    case 'get_app_log': return '[10:00:00] Ready\n[10:00:01] Profile loaded\n'
    case 'get_kernel_log': case 'get_log_file': return 'Kernel log fixture\n'
    case 'check_program_update': return { version: programRelease, changelog: programChangelog }
    case 'check_update': return { version: kernelRelease, changelog: kernelChangelog }
    case 'update_kernel': if (args.expectedVersion && args.expectedVersion !== kernelRelease) throw { message: 'The available release changed. Check for updates and confirm again.' }; state.coreExists = true; state.localVersion = kernelRelease; return 'Success'
    case 'set_pre_release': state.preRelease = args.enabled; return 'Success'
    case 'apply_state': return applyLifecycle(args.targetTun, args.targetProxy)
    case 'restart_core': return applyLifecycle(state.tunMode, state.sysProxy, true)
    case 'select_profile': state.activeProfile = profiles.find(profile => profile.id === args.id) || state.activeProfile; return 'Success'
    case 'save_mode': state.tunMode = args.tunMode; state.sysProxy = args.sysProxy; return 'Success'
    case 'save_theme':
      if (!['light', 'dark', 'system'].includes(args.mode)) throw { message: 'Theme mode is invalid' }
      state.themeMode = args.mode; state.accentColor = args.accentColor; return 'Success'
    case 'add_profile': {
      if (args.name === failProfileName) { failProfileName = ''; throw { message: 'Fixture: subscription download failed' } }
      const existing = state.profiles.find(profile => profile.id === args.id)
      if (existing) return existing
      const profile = { id: args.id, name: args.name, url: args.url, updated: '2026-09-29 12:00' }
      state.profiles.push(profile)
      if (!state.activeProfile) state.activeProfile = profile
      return profile
    }
    case 'edit_profile': {
      const profile = state.profiles.find(profile => profile.id === args.id)
      if (!profile) throw { message: 'Profile not found' }
      profile.name = args.name; profile.url = args.url; return 'Success'
    }
    case 'delete_profile':
      state.profiles = state.profiles.filter(profile => profile.id !== args.id)
      if (state.activeProfile?.id === args.id) state.activeProfile = null as any
      return undefined
    case 'get_override': return overrideSnapshot
    case 'get_default_override': return '{\n  "inbounds": []\n}'
    case 'save_override': overrides[args.name] = args.content; return undefined
    case 'reset_override': overrides[args.name] = '{\n  "inbounds": []\n}'; return undefined
    case 'get_uwp_apps': return [
      { sid: 'test-1', displayName: 'Windows application', packageName: 'Microsoft.Example_1.0_x64', isExempt: false },
      { sid: 'test-2', displayName: '长名称应用程序与缩放检查', packageName: 'Microsoft.LongPackageName_1.0.0_x64', isExempt: true },
    ]
    default: return 'Success'
  }
}, { shouldMockEvents: true })
const mockInvoke = (window as any).__TAURI_INTERNALS__.invoke
;(window as any).__TAURI_INTERNALS__.invoke = (command: string, args: any) => {
  if (command === 'plugin:event|listen' && args.event === 'status' && failListener) return Promise.reject({ message: 'Fixture: event registration failed' })
  return mockInvoke(command, args)
}
Object.assign(window, { visualTest: { state, calls, emit,
  allowListeners: () => { failListener = false },
  failProfile: (name: string) => { failProfileName = name },
  get phase() { return lifecyclePhase },
  holdPhase: (name: string) => { heldPhase = name },
  releasePhase: () => { phaseRelease?.(); phaseRelease = undefined },
  failStop: () => { failStop = true },
  failStartup: () => { failStartup = true },
  exitBeforeReturn: () => { exitBeforeReturn = true },
  setKernelRelease: (version: string, changelog = kernelChangelog) => { kernelRelease = version; kernelChangelog = changelog },
  setProgramRelease: (version: string, changelog = programChangelog) => { programRelease = version; programChangelog = changelog },
  setProgramVersion: (version: string) => { programVersion = version },
  failNext: (command: string, message = 'Fixture: requested operation failed') => { failure = command; failureMessage = message }, holdNext: (command: string) => { heldCommand = command }, release: () => { release?.(); release = undefined } } })
