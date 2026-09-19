import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'

export interface ProfileDto {
  id: string
  name: string
  url: string
  path?: string
  updated?: string
  [key: string]: unknown
}

export interface InitDataDto {
  running: boolean
  coreExists: boolean
  localVersion: string
  tunMode: boolean
  sysProxy: boolean
  profiles: ProfileDto[]
  activeProfile: ProfileDto | null
  mirror: string
  mirrorEnabled: boolean
  startOnBoot: boolean
  autoConnectState: string
  themeMode: string
  accentColor: string
  ipv6Enabled: boolean
  preRelease: boolean
  logLevel: string
  logToFile: boolean
  closeBehavior: string
}

export interface TrafficUpdateDto {
  upload: number
  download: number
}

export interface StateSyncDto {
  tunMode: boolean
  sysProxy: boolean
}

export interface UWPAppDto {
  sid: string
  displayName: string
  packageName: string
  isExempt: boolean
}

export interface ProgramUpdateDto {
  version: string
  changelog: string
}

export type OverrideName = 'tun' | 'mixed'

type BackendError = {
  code?: string
  message?: string
}

const errorText = (error: unknown): string => {
  if (typeof error === 'string') return error
  if (error && typeof error === 'object') {
    const typed = error as BackendError
    if (typed.code === 'config_missing') return 'config-missing'
    if (typed.message) return typed.message
    if (typed.code) return typed.code
  }
  return 'The requested operation failed'
}

const invokeOrThrow = <T>(command: string, args?: Record<string, unknown>) =>
  invoke<T>(command, args).catch((error: unknown) => {
    throw new Error(errorText(error))
  })

const invokeText = async (command: string, args?: Record<string, unknown>): Promise<string> => {
  try {
    return await invoke<string>(command, args)
  } catch (error) {
    return errorText(error)
  }
}

export const getInitData = () => invokeOrThrow<InitDataDto>('get_init_data')

export const getOverride = (name: OverrideName) =>
  invokeOrThrow<string>('get_override', { name })

export const getDefaultOverride = (name: OverrideName) =>
  invokeOrThrow<string>('get_default_override', { name })

export const saveOverride = (name: OverrideName, content: string) =>
  invokeOrThrow<void>('save_override', { name, content })

export const resetOverride = (name: OverrideName) =>
  invokeOrThrow<void>('reset_override', { name })

export const SaveSettings = (mirror: string, enabled: boolean) =>
  invokeText('save_settings', { mirror, enabled })

export const SetStartOnBoot = (enabled: boolean) =>
  invokeText('set_start_on_boot', { enabled })

export const SetAutoConnect = (state: string) =>
  invokeText('set_auto_connect', { state })

export const SaveTheme = (mode: string, accentColor: string) =>
  invokeText('save_theme', { mode, accentColor })

export const SaveMode = (tunMode: boolean, sysProxy: boolean) =>
  invokeText('save_mode', { tunMode, sysProxy })

export const ApplyState = (targetTun: boolean, targetProxy: boolean) =>
  invokeText('apply_state', { targetTun, targetProxy })

export const ToggleService = () => invokeText('toggle_service')

export const RestartCore = () => invokeText('restart_core')

export const AddProfile = (name: string, url: string) =>
  invokeText('add_profile', { name, url })

export const DeleteProfile = (id: string) =>
  invokeOrThrow<void>('delete_profile', { id })

export const EditProfile = (id: string, name: string, url: string) =>
  invokeText('edit_profile', { id, name, url })

export const SelectProfile = (id: string) =>
  invokeText('select_profile', { id })

export const UpdateActiveProfile = () =>
  invokeText('update_active_profile')

export const ToggleIPv6 = (enabled: boolean) =>
  invokeText('toggle_ipv6', { enabled })

export const SetPreRelease = (enabled: boolean) =>
  invokeText('set_pre_release', { enabled })

export const SetLogConfig = (level: string, toFile: boolean) =>
  invokeText('set_log_config', { level, toFile })

export const SetCloseBehavior = (behavior: string) =>
  invokeText('set_close_behavior', { behavior })

export const GetAppLog = () => invokeOrThrow<string>('get_app_log')
export const ClearAppLog = () => invokeText('clear_app_log')
export const GetKernelLog = () => invokeOrThrow<string>('get_kernel_log')
export const ClearKernelLog = () => invokeText('clear_kernel_log')
export const GetLogFile = () => invokeOrThrow<string>('get_log_file')

export const GetUWPApps = () => invokeOrThrow<UWPAppDto[]>('get_uwp_apps')

export const SetUWPLoopbackExemptions = (selectedSIDs: string[]) =>
  invokeText('set_uwp_loopback_exemptions', { selectedSids: selectedSIDs })

export const CheckUpdate = () => invokeText('check_update')

export const UpdateKernel = (mirror: string) =>
  invokeText('update_kernel', { mirror })

export const CheckProgramUpdate = async (): Promise<ProgramUpdateDto | { error: string }> => {
  try {
    return await invoke<ProgramUpdateDto>('check_program_update')
  } catch (error) {
    return { error: errorText(error) }
  }
}

export const UpdateProgram = (mirror: string) =>
  invokeText('update_program', { mirror })

export const getProductVersion = () =>
  invokeOrThrow<string>('get_product_version')

export const OpenDashboard = () =>
  invokeOrThrow<void>('open_dashboard')

export const BrowserOpenURL = (url: string) =>
  invokeOrThrow<void>('open_url', { url })

export const Minimize = () =>
  getCurrentWindow().minimize()

export const MinimizeToTray = () =>
  getCurrentWindow().hide()

export const Show = () =>
  getCurrentWindow().show().then(() => getCurrentWindow().setFocus())

export const Quit = () => invoke<void>('quit')
export const Restart = () => invoke<void>('restart')
export const StartTray = () => invoke<void>('start_tray')
export const UpdateTrayIcon = () => invoke<void>('update_tray_icon')
export const UpdateTrayMenu = () => invoke<void>('update_tray_menu')

export const WindowSetDarkTheme = () =>
  getCurrentWindow().setTheme('dark')

export const WindowSetLightTheme = () =>
  getCurrentWindow().setTheme('light')

export const WindowSetSystemDefaultTheme = () =>
  getCurrentWindow().setTheme(null)

const listenersByName = new Map<string, Set<() => void>>()
const pendingListenerRegistrations = new Set<Promise<void>>()

export function EventsOn<T>(
  eventName: string,
  callback: (payload: T) => void,
): () => void {
  let active = true
  let unlisten: UnlistenFn | undefined
  const remove = () => {
    active = false
    unlisten?.()
    unlisten = undefined
    const listeners = listenersByName.get(eventName)
    listeners?.delete(remove)
    if (listeners?.size === 0) listenersByName.delete(eventName)
  }

  const listeners = listenersByName.get(eventName) ?? new Set<() => void>()
  listeners.add(remove)
  listenersByName.set(eventName, listeners)

  const registration = listen<T>(eventName, (event) => callback(event.payload)).then((listener) => {
    if (!active) {
      listener()
      return
    }
    unlisten = listener
  }).catch(() => {
    remove()
  })
  pendingListenerRegistrations.add(registration)
  void registration.then(() => pendingListenerRegistrations.delete(registration))

  return remove
}

export async function waitForEventsReady(): Promise<void> {
  while (pendingListenerRegistrations.size > 0) {
    await Promise.all([...pendingListenerRegistrations])
  }
}
