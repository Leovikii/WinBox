// Development-only fixture. Not imported by the production entry point.
import { mockIPC } from '@tauri-apps/api/mocks'
import { emit } from '@tauri-apps/api/event'

const profiles = [
  { id: 'one', name: 'Home profile', url: 'https://example.invalid/home', updated: '2026-09-22 10:00' },
  { id: 'two', name: '办公室 · Long profile name for overflow verification', url: 'https://example.invalid/work', updated: '2026-09-22 09:00' },
]
const state = {
  running: false, coreBusy: false, coreExists: true, localVersion: '1.12.0', tunMode: false, sysProxy: true,
  profiles, activeProfile: profiles[0], mirror: '', mirrorEnabled: false, startOnBoot: false,
  autoConnectState: 'smart', themeMode: localStorage.getItem('themeMode') || 'light',
  accentColor: localStorage.getItem('accentColor') || '#0090ff', ipv6Enabled: true,
  preRelease: false, logLevel: '', logToFile: true, closeBehavior: 'ask',
}
const scenario = new URLSearchParams(location.search).get('scenario')
if (scenario === 'empty' || scenario === 'missing') { state.profiles = []; state.activeProfile = null as any }
if (scenario === 'missing') { state.coreExists = false; state.localVersion = 'Not Installed' }
if (scenario === 'unknown-kernel') state.localVersion = 'Unknown'
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
let exitBeforeReturn = false
async function phase(name: string) {
  lifecyclePhase = name
  if (heldPhase === name) {
    heldPhase = ''
    await new Promise<void>(resolve => { phaseRelease = resolve })
  }
}
async function applyLifecycle(targetTun: boolean, targetProxy: boolean, restart = false) {
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
  calls.push(command)
  if (heldCommand === command) {
    heldCommand = ''
    await new Promise<void>(resolve => { release = resolve })
  }
  if (failure === command) { failure = ''; throw { code: 'fixture_failure', message: failureMessage } }
  switch (command) {
    case 'get_init_data': return initSnapshot
    case 'get_start_on_boot': return state.startOnBoot
    case 'set_start_on_boot': state.startOnBoot = args.enabled; return state.startOnBoot
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
    case 'save_theme': state.themeMode = args.mode; state.accentColor = args.accentColor; return 'Success'
    case 'get_override': case 'get_default_override': return '{\n  "inbounds": []\n}'
    case 'get_uwp_apps': return [
      { sid: 'test-1', displayName: 'Windows application', packageName: 'Microsoft.Example_1.0_x64', isExempt: false },
      { sid: 'test-2', displayName: '长名称应用程序与缩放检查', packageName: 'Microsoft.LongPackageName_1.0.0_x64', isExempt: true },
    ]
    default: return 'Success'
  }
}, { shouldMockEvents: true })
Object.assign(window, { visualTest: { state, calls, emit,
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
