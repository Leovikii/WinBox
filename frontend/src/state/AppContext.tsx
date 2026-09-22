import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import * as Backend from '../api/backend'
import { EventsOn } from '../api/backend'
import type { InitDataDto, ProfileDto, StateSyncDto, TrafficUpdateDto, UWPAppDto } from '../api/backend'
import { appendTraffic, emptyTrafficHistory, type SpeedPoint } from '../utils/trafficHistory'
import { cleanLog } from '../utils/logUtils'
import { getModeColor } from '../utils/modeColors'
import { isNewerVersion, isVersion } from '../utils/versionCompare'

export type UpdateState = 'idle' | 'checking' | 'available' | 'updating' | 'success' | 'latest' | 'error'
export type EditingType = 'tun' | 'mixed' | 'mirror'

export interface ProfileDraft extends ProfileDto {
  id: string
  name: string
  url: string
}

interface AppContextValue {
  initialized: boolean
  running: boolean
  coreExists: boolean
  msg: string
  tunMode: boolean
  sysProxy: boolean
  isProcessing: boolean
  errorLog: string
  showErrorAlert: boolean
  errorAlertMessage: string
  startOnBoot: boolean
  autoConnectState: string
  mirrorUrl: string
  mirrorEnabled: boolean
  ipv6Enabled: boolean
  preRelease: boolean
  logLevel: string
  logToFile: boolean
  closeBehavior: string
  windowCloseRequested: boolean
  setWindowCloseRequested: (requested: boolean) => void
  statusText: string
  statusColor: string
  controlColor: string
  refreshData: () => Promise<InitDataDto>
  handleServiceToggle: () => Promise<{ error: string } | undefined>
  handleToggle: (target: 'tun' | 'proxy') => Promise<{ error: string } | undefined>
  handleSwitchMode: (target: { tunMode: boolean; sysProxy: boolean }) => Promise<{ error: string } | undefined>
  handleRestartCore: () => Promise<void>
  handleMirrorToggle: () => Promise<void>
  handleStartOnBootToggle: () => Promise<void>
  handleAutoConnectChange: (state: string) => Promise<void>
  handleIPv6Toggle: () => Promise<void>
  handlePreReleaseToggle: () => Promise<void>
  handleLogLevelChange: (level: string) => Promise<void>
  handleLogToFileToggle: () => Promise<void>
  handleCloseBehaviorChange: (behavior: string) => Promise<void>
  setErrorAlert: (message: string) => void

  profiles: ProfileDto[]
  activeProfile: ProfileDto | null
  switchProfile: (id: string) => Promise<void>
  updateActiveProfile: () => Promise<void>
  isUpdatingProfile: boolean
  showManageProfilesModal: boolean
  setShowManageProfilesModal: (open: boolean) => void
  manageProfilesList: ProfileDraft[]
  setManageProfilesList: (profiles: ProfileDraft[]) => void
  removeProfileFromManageList: (id: string) => void
  addNewDraftProfile: () => void
  saveManageProfiles: () => Promise<void>
  isSavingProfiles: boolean
  isManageProfilesChanged: boolean
  manageProfilesError: string
  setManageProfilesError: (message: string) => void
  openManageProfiles: () => void

  localVer: string
  remoteVer: string
  updateState: UpdateState
  downloadProgress: number
  checkUpdate: () => Promise<void>
  performUpdate: () => Promise<void>
  showEditor: boolean
  setShowEditor: (open: boolean) => void
  editingType: EditingType
  editorContent: string
  setEditorContent: (content: string) => void
  editorDefaultContent: string
  isEditorChanged: boolean
  saveBtnText: string
  showResetConfirm: boolean
  setShowResetConfirm: (open: boolean) => void
  editorError: string
  switchEditorTab: (type: 'tun' | 'mixed') => Promise<void>
  openEditor: (type: EditingType) => Promise<void>
  saveEditor: () => Promise<void>
  confirmReset: () => Promise<void>

  programLocalVer: string
  programRemoteVer: string
  programUpdateState: UpdateState
  programDownloadProgress: number
  programChangelog: string
  checkProgramUpdate: () => Promise<void>
  performProgramUpdate: () => Promise<void>
  resetUpdateStates: () => void

  accentColor: string
  themeMode: string
  isDark: boolean
  setThemeColor: (color: string) => Promise<void>
  setThemeMode: (mode: string) => Promise<void>

  uwpApps: UWPAppDto[]
  uwpSelectedSIDs: string[]
  uwpLoading: boolean
  uwpSaving: boolean
  uwpHasChanges: boolean
  loadUwpApps: () => Promise<void>
  toggleUwpApp: (sid: string) => void
  selectAllUwp: () => void
  deselectAllUwp: () => void
  saveExemptions: () => Promise<boolean>
}

const AppContext = createContext<AppContextValue | null>(null)

interface LiveContextValue {
  trafficHistory: SpeedPoint[]
  uploadSpeed: number
  downloadSpeed: number
  appLogContent: string
  showLogModal: boolean
  setShowLogModal: (open: boolean) => void
  copyState: string
  clearAppLog: () => Promise<void>
  copyAppLog: () => Promise<void>
}

const LiveContext = createContext<LiveContextValue | null>(null)

const initialTheme = typeof window === 'undefined' ? 'system' : localStorage.getItem('themeMode') || 'system'

export function AppProvider({ children }: { children: ReactNode }) {
  const [initialized, setInitialized] = useState(false)
  const lifecycleRevision = useRef(0)
  const [running, setRunning] = useState(false)
  const [coreExists, setCoreExists] = useState(true)
  const [msg, setMsg] = useState('READY')
  const [tunMode, setTunMode] = useState(false)
  const [sysProxy, setSysProxy] = useState(false)
  const [localProcessing, setIsProcessing] = useState(false)
  const [coreBusy, setCoreBusy] = useState(false)
  const [coreLocked, setCoreLocked] = useState(false)
  const isProcessing = localProcessing || coreBusy || coreLocked
  const [errorLog, setErrorLog] = useState('')
  const [showErrorAlert, setShowErrorAlert] = useState(false)
  const [errorAlertMessage, setErrorAlertMessage] = useState('')
  const [startOnBoot, setStartOnBoot] = useState(false)
  const [autoConnectState, setAutoConnectState] = useState('smart')
  const [mirrorUrl, setMirrorUrl] = useState('')
  const [mirrorEnabled, setMirrorEnabled] = useState(false)
  const [ipv6Enabled, setIpv6Enabled] = useState(true)
  const [preRelease, setPreRelease] = useState(false)
  const [logLevel, setLogLevel] = useState('')
  const [logToFile, setLogToFile] = useState(true)
  const [closeBehavior, setCloseBehavior] = useState('ask')
  const [trafficHistory, setTrafficHistory] = useState(emptyTrafficHistory)
  const { up: uploadSpeed, down: downloadSpeed } = trafficHistory[trafficHistory.length - 1]
  const [windowCloseRequested, setWindowCloseRequested] = useState(false)

  const [profiles, setProfiles] = useState<ProfileDto[]>([])
  const [activeProfile, setActiveProfile] = useState<ProfileDto | null>(null)
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false)
  const [showManageProfilesModal, setShowManageProfilesModal] = useState(false)
  const [manageProfilesList, setManageProfilesList] = useState<ProfileDraft[]>([])
  const [isSavingProfiles, setIsSavingProfiles] = useState(false)
  const [manageProfilesError, setManageProfilesError] = useState('')

  const [appLogContent, setAppLogContent] = useState('')
  const [showLogModal, setShowLogModal] = useState(false)
  const [copyState, setCopyState] = useState('Copy')

  const [localVer, setLocalVer] = useState('Unknown')
  const [remoteVer, setRemoteVer] = useState('Unknown')
  const [updateState, setUpdateState] = useState<UpdateState>('idle')
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [showEditor, setShowEditor] = useState(false)
  const [editingType, setEditingType] = useState<EditingType>('tun')
  const [editorContent, setEditorContent] = useState('')
  const [editorOriginalContent, setEditorOriginalContent] = useState('')
  const [editorDefaultContent, setEditorDefaultContent] = useState('')
  const [saveBtnText, setSaveBtnText] = useState('Save')
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [editorError, setEditorError] = useState('')

  const [programLocalVer, setProgramLocalVer] = useState('Unknown')
  const [programRemoteVer, setProgramRemoteVer] = useState('Unknown')
  const [programUpdateState, setProgramUpdateState] = useState<UpdateState>('idle')
  const [programDownloadProgress, setProgramDownloadProgress] = useState(0)
  const [programChangelog, setProgramChangelog] = useState('')

  const [accentColor, setAccentColor] = useState('#0090FF')
  const [themeMode, setThemeModeState] = useState(initialTheme)
  const [isDark, setIsDark] = useState(false)

  const [uwpApps, setUwpApps] = useState<UWPAppDto[]>([])
  const [uwpSelectedSIDs, setUwpSelectedSIDs] = useState<string[]>([])
  const [uwpLoading, setUwpLoading] = useState(false)
  const [uwpSaving, setUwpSaving] = useState(false)

  const defaultModePersisted = useRef(false)
  const updateStateRef = useRef(updateState)
  const programUpdateStateRef = useRef(programUpdateState)
  const programUpdateCheckInFlight = useRef(false)
  const timeoutRefs = useRef<number[]>([])

  useEffect(() => {
    updateStateRef.current = updateState
    programUpdateStateRef.current = programUpdateState
  }, [programUpdateState, updateState])

  const setErrorAlert = useCallback((message: string) => {
    const cleaned = cleanLog(message)
    setErrorAlertMessage(cleaned)
    setShowErrorAlert(Boolean(cleaned))
  }, [])

  const persistMode = useCallback(async (tun: boolean, proxy: boolean) => {
    const result = await Backend.SaveMode(tun, proxy)
    if (result !== 'Success') {
      setMsg('Error')
      setErrorLog(result)
      setErrorAlert(result)
      return false
    }
    return true
  }, [setErrorAlert])

  const applyInitData = useCallback(async (data: InitDataDto, revision: number) => {
    let nextTun = data.tunMode
    let nextProxy = data.sysProxy
    if (revision === lifecycleRevision.current && !nextTun && !nextProxy) {
      nextProxy = true
      if (!defaultModePersisted.current) {
        defaultModePersisted.current = true
        void persistMode(false, true)
      }
    }

    // A delayed snapshot must not overwrite newer lifecycle events.
    if (revision === lifecycleRevision.current) {
      setCoreBusy(data.coreBusy)
      setRunning(data.running)
      setMsg(data.coreExists ? (data.coreBusy ? 'Working...' : data.running ? 'Running' : 'Offline') : 'Kernel Missing')
      setTunMode(nextTun)
      setSysProxy(nextProxy)
    }
    setCoreExists(data.coreExists)
    setLocalVer(data.localVersion || 'Unknown')
    setProfiles(data.profiles || [])
    setActiveProfile(data.activeProfile || null)
    setStartOnBoot(data.startOnBoot)
    setAutoConnectState(data.autoConnectState)
    setMirrorUrl(data.mirror)
    setMirrorEnabled(data.mirrorEnabled)
    setIpv6Enabled(data.ipv6Enabled)
    setPreRelease(data.preRelease)
    setLogLevel(data.logLevel)
    setLogToFile(data.logToFile)
    setCloseBehavior(data.closeBehavior || 'ask')
    setAccentColor(data.accentColor || '#0090FF')
    setThemeModeState(data.themeMode || 'system')
  }, [persistMode])

  const refreshData = useCallback(async () => {
    const revision = lifecycleRevision.current
    const data = await Backend.getInitData()
    await applyInitData(data, revision)
    return data
  }, [applyInitData])

  useEffect(() => {
    let cancelled = false
    const unlisten = [
      EventsOn<TrafficUpdateDto>('traffic-update', (data) => {
        setTrafficHistory(history => appendTraffic(history, data.upload, data.download))
      }),
      EventsOn('window-close-requested', () => setWindowCloseRequested(true)),
      EventsOn('core-starting', () => {
        lifecycleRevision.current++
        setMsg('Starting...')
      }),
      EventsOn('core-stopping', () => {
        lifecycleRevision.current++
        setMsg('Stopping...')
      }),
      EventsOn('core-restarting', () => {
        lifecycleRevision.current++
        setMsg('Restarting...')
      }),
      EventsOn<boolean>('core-lock', setCoreLocked),
      EventsOn<boolean>('core-busy', busy => {
        lifecycleRevision.current++
        setCoreBusy(busy)
        if (!busy) setMsg(previous => ['Starting...', 'Stopping...', 'Restarting...', 'Working...'].includes(previous) ? 'Stopped' : previous)
      }),
      EventsOn<boolean>('status', (isRunning) => {
        lifecycleRevision.current++
        setRunning(isRunning)
        if (!isRunning) setTrafficHistory(emptyTrafficHistory())
        setMsg((previous) => {
          if (!isRunning && ['Starting...', 'Restarting...', 'Working...', 'Error'].includes(previous)) return previous
          if (!isRunning && previous !== 'Standby' && previous !== 'Net Timeout') return 'Stopped'
          return isRunning ? 'Running' : previous
        })
      }),
      EventsOn<StateSyncDto>('state-sync', (state) => {
        lifecycleRevision.current++
        setTunMode(state.tunMode)
        setSysProxy(state.sysProxy)
        if (!state.tunMode && !state.sysProxy && !defaultModePersisted.current) {
          defaultModePersisted.current = true
          setSysProxy(true)
          void persistMode(false, true)
        }
      }),
      EventsOn<string>('log', (logMessage) => {
        const cleaned = cleanLog(logMessage)
        if (cleaned.startsWith('Error:') || cleaned.includes('failed')) {
          setMsg('Error')
          setErrorLog(cleaned)
        } else {
          setMsg(cleaned)
        }
      }),
      EventsOn<number>('download-progress', (progress) => {
        if (updateStateRef.current === 'updating') setDownloadProgress(progress)
        if (programUpdateStateRef.current === 'updating') setProgramDownloadProgress(progress)
      }),
      EventsOn<string>('onAppLog', (line) => {
        setAppLogContent((previous) => {
          const next = previous + line
          if (next.length <= 600000) return next
          const sliceIndex = next.indexOf('\n', 100000)
          return sliceIndex === -1 ? next.slice(-500000) : next.slice(sliceIndex + 1)
        })
      }),
    ]

    void (async () => {
      await Backend.waitForEventsReady()
      if (cancelled) return
      try {
        const revision = lifecycleRevision.current
        const data = await Backend.getInitData()
        if (!cancelled) {
          await applyInitData(data, revision)
          setInitialized(true)
        }
        const log = await Backend.GetAppLog()
        if (!cancelled) setAppLogContent(log)
      } catch (error) {
        if (!cancelled) {
          setMsg('Error')
          setErrorLog(error instanceof Error ? error.message : String(error))
        }
      }
    })()

    return () => {
      cancelled = true
      unlisten.forEach((remove) => remove())
      timeoutRefs.current.splice(0).forEach((timeout) => window.clearTimeout(timeout))
    }
  }, [applyInitData, persistMode])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = themeMode === 'dark' || (themeMode === 'system' && media.matches)
      setIsDark(dark)
      document.documentElement.classList.toggle('dark', dark)
      document.documentElement.style.setProperty('--accent-color', accentColor)
      document.documentElement.style.setProperty('--accent-color-rgb', hexToRgb(accentColor))
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [accentColor, themeMode])

  useEffect(() => {
    if (!initialized) return
    void Backend.SetWindowTheme(themeMode).catch(() => undefined)
  }, [initialized, themeMode])

  const handleServiceToggle = useCallback(async () => {
    if (isProcessing) return undefined
    if (!coreExists) {
      setMsg('KERNEL MISSING!')
      return { error: 'kernel-missing' }
    }

    setIsProcessing(true)
    const willStart = !running
    setMsg(willStart ? 'Starting...' : 'Stopping...')
    try {
      const result = await Backend.ApplyState(willStart ? tunMode : false, willStart ? sysProxy : false)
      if (!['Success', 'Stopped', 'Already stopped'].includes(result)) {
        setMsg('Error')
        setErrorLog(cleanLog(result))
        return result === 'config-missing' ? { error: 'config-missing' } : undefined
      }
      return undefined
    } catch (error) {
      const message = cleanLog(error instanceof Error ? error.message : String(error))
      setMsg('Error')
      setErrorLog(message)
      setErrorAlert(message)
      return undefined
    } finally {
      setIsProcessing(false)
    }
  }, [coreExists, isProcessing, running, setErrorAlert, sysProxy, tunMode])

  const handleToggle = useCallback(async (target: 'tun' | 'proxy') => {
    if (isProcessing) return undefined
    if (!coreExists) {
      setMsg('KERNEL MISSING!')
      return { error: 'kernel-missing' }
    }
    const nextTun = target === 'tun' ? !tunMode : tunMode
    const nextProxy = target === 'proxy' ? !sysProxy : sysProxy
    const previous = { tun: tunMode, proxy: sysProxy }
    setIsProcessing(true)
    setMsg(nextTun || nextProxy ? 'Starting...' : 'Stopping...')
    try {
      const result = await Backend.ApplyState(nextTun, nextProxy)
      if (!['Success', 'Stopped', 'Already stopped'].includes(result)) {
        setTunMode(previous.tun)
        setSysProxy(previous.proxy)
        setMsg('Error')
        setErrorLog(cleanLog(result))
      }
      return result === 'config-missing' ? { error: 'config-missing' } : undefined
    } catch (error) {
      const message = cleanLog(error instanceof Error ? error.message : String(error))
      setTunMode(previous.tun)
      setSysProxy(previous.proxy)
      setMsg('Error')
      setErrorLog(message)
      setErrorAlert(message)
      return undefined
    } finally {
      setIsProcessing(false)
    }
  }, [coreExists, isProcessing, setErrorAlert, sysProxy, tunMode])

  const handleSwitchMode = useCallback(async (target: { tunMode: boolean; sysProxy: boolean }) => {
    if (isProcessing) return undefined
    if (!coreExists) {
      setMsg('KERNEL MISSING!')
      return { error: 'kernel-missing' }
    }
    const previous = { tun: tunMode, proxy: sysProxy }
    setIsProcessing(true)
    try {
      if (!running) {
        const saved = await persistMode(target.tunMode, target.sysProxy)
        if (saved) {
          setTunMode(target.tunMode)
          setSysProxy(target.sysProxy)
        }
        return undefined
      }
      setMsg('Restarting...')
      const result = await Backend.ApplyState(target.tunMode, target.sysProxy)
      if (!['Success', 'Stopped', 'Already stopped'].includes(result)) {
        setTunMode(previous.tun)
        setSysProxy(previous.proxy)
        setMsg('Error')
        setErrorLog(cleanLog(result))
      }
      return result === 'config-missing' ? { error: 'config-missing' } : undefined
    } catch (error) {
      const message = cleanLog(error instanceof Error ? error.message : String(error))
      setTunMode(previous.tun)
      setSysProxy(previous.proxy)
      setMsg('Error')
      setErrorLog(message)
      setErrorAlert(message)
      return undefined
    } finally {
      setIsProcessing(false)
    }
  }, [coreExists, isProcessing, persistMode, running, setErrorAlert, sysProxy, tunMode])

  const handleRestartCore = useCallback(async () => {
    if (isProcessing) return
    setIsProcessing(true)
    setMsg('Restarting...')
    try {
      const result = await Backend.RestartCore()
      if (result !== 'Success') {
        setMsg('Error')
        setErrorLog(cleanLog(result))
        setErrorAlert(result)
      }
    } catch (error) {
      const message = cleanLog(error instanceof Error ? error.message : String(error))
      setMsg('Error')
      setErrorLog(message)
      setErrorAlert(message)
    } finally {
      setIsProcessing(false)
    }
  }, [isProcessing, setErrorAlert])

  const handleMirrorToggle = useCallback(async () => {
    const next = !mirrorEnabled
    const result = await Backend.SaveSettings(mirrorUrl, next)
    if (result === 'Success') setMirrorEnabled(next)
    else setErrorAlert(result)
  }, [mirrorEnabled, mirrorUrl, setErrorAlert])

  const handleStartOnBootToggle = useCallback(async () => {
    const next = !startOnBoot
    const result = await Backend.SetStartOnBoot(next)
    if (result !== 'Success') {
      setErrorAlert(result)
      return
    }
    setStartOnBoot(next)
    if (next && autoConnectState === 'off') {
      const autoResult = await Backend.SetAutoConnect('smart')
      if (autoResult === 'Success') setAutoConnectState('smart')
      else setErrorAlert(autoResult)
    }
  }, [autoConnectState, setErrorAlert, startOnBoot])

  const handleAutoConnectChange = useCallback(async (state: string) => {
    const result = await Backend.SetAutoConnect(state)
    if (result === 'Success') setAutoConnectState(state)
    else setErrorAlert(result)
  }, [setErrorAlert])

  const handleIPv6Toggle = useCallback(async () => {
    const next = !ipv6Enabled
    const result = await Backend.ToggleIPv6(next)
    if (result === 'Success') setIpv6Enabled(next)
    else setErrorAlert(result)
  }, [ipv6Enabled, setErrorAlert])

  const handlePreReleaseToggle = useCallback(async () => {
    const next = !preRelease
    const result = await Backend.SetPreRelease(next)
    if (result === 'Success') setPreRelease(next)
    else setErrorAlert(result)
  }, [preRelease, setErrorAlert])

  const handleLogLevelChange = useCallback(async (level: string) => {
    const result = await Backend.SetLogConfig(level, logToFile)
    if (result === 'Success') setLogLevel(level)
    else setErrorAlert(result)
  }, [logToFile, setErrorAlert])

  const handleLogToFileToggle = useCallback(async () => {
    const next = !logToFile
    const result = await Backend.SetLogConfig(logLevel, next)
    if (result === 'Success') setLogToFile(next)
    else setErrorAlert(result)
  }, [logLevel, logToFile, setErrorAlert])

  const handleCloseBehaviorChange = useCallback(async (behavior: string) => {
    const result = await Backend.SetCloseBehavior(behavior)
    if (result === 'Success') setCloseBehavior(behavior)
    else setErrorAlert(result)
  }, [setErrorAlert])

  const switchProfile = useCallback(async (id: string) => {
    if (activeProfile?.id === id || isProcessing) return
    setIsProcessing(true)
    try {
      const result = await Backend.SelectProfile(id)
      if (result === 'Success') {
        setMsg('Switched')
        await refreshData()
      } else {
        setMsg('Error')
        setErrorLog(cleanLog(result))
      }
    } catch (error) {
      const message = cleanLog(error instanceof Error ? error.message : String(error))
      setMsg('Error')
      setErrorLog(message)
      setErrorAlert(message)
    } finally {
      setIsProcessing(false)
    }
  }, [activeProfile?.id, isProcessing, refreshData, setErrorAlert])

  const updateActiveProfile = useCallback(async () => {
    if (isUpdatingProfile || isProcessing) return
    setIsUpdatingProfile(true)
    setIsProcessing(true)
    setMsg('Updating...')
    try {
      const result = await Backend.UpdateActiveProfile()
      if (result === 'Success') {
        setMsg('Updated')
        await refreshData()
      } else {
        setMsg('Error')
        setErrorLog(cleanLog(result))
      }
    } catch (error) {
      const message = cleanLog(error instanceof Error ? error.message : String(error))
      setMsg('Error')
      setErrorLog(message)
      setErrorAlert(message)
    } finally {
      setIsUpdatingProfile(false)
      setIsProcessing(false)
    }
  }, [isProcessing, isUpdatingProfile, refreshData, setErrorAlert])

  const openManageProfiles = useCallback(() => {
    setManageProfilesError('')
    setManageProfilesList(profiles.map((profile) => ({ ...profile, name: profile.name || '', url: profile.url || '' })))
    setManageProfilesList((current) => current.length ? current : [{ id: `new_${crypto.randomUUID()}`, name: '', url: '' }])
    setShowManageProfilesModal(true)
  }, [profiles])

  const removeProfileFromManageList = useCallback((id: string) => {
    setManageProfilesList((current) => current.filter((profile) => profile.id !== id))
  }, [])

  const addNewDraftProfile = useCallback(() => {
    setManageProfilesList((current) => [...current, { id: `new_${crypto.randomUUID()}`, name: '', url: '' }])
  }, [])

  const saveManageProfiles = useCallback(async () => {
    setIsSavingProfiles(true)
    let lastError = ''
    const draftIds = new Set(manageProfilesList.map((profile) => profile.id))
    for (const original of profiles) {
      if (!draftIds.has(original.id)) {
        try {
          const result = await Backend.DeleteProfile(original.id)
          if (result !== undefined) lastError = result
        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error)
        }
      }
    }

    for (const draft of manageProfilesList) {
      if (!draft.name || !draft.url) {
        lastError = 'Name and URL cannot be empty'
        continue
      }
      try {
        new URL(draft.url)
      } catch {
        lastError = `Invalid URL: ${draft.name}`
        continue
      }
      const original = profiles.find((profile) => profile.id === draft.id)
      let result = 'Success'
      if (original && (original.name !== draft.name || original.url !== draft.url)) {
        result = await Backend.EditProfile(draft.id, draft.name, draft.url)
      } else if (!original && draft.id.startsWith('new_')) {
        setMsg('Downloading Config...')
        result = await Backend.AddProfile(draft.name, draft.url)
      }
      if (result !== 'Success') lastError = result
    }

    setIsSavingProfiles(false)
    if (lastError) {
      setMsg('Error saving some changes')
      setManageProfilesError(cleanLog(lastError))
    } else {
      setMsg('Changes saved')
      setManageProfilesError('')
      setShowManageProfilesModal(false)
    }
    try {
      await refreshData()
    } catch (error) {
      setManageProfilesError(cleanLog(error instanceof Error ? error.message : String(error)))
      setMsg('Error refreshing profiles')
    }
  }, [manageProfilesList, profiles, refreshData])

  const loadAppLog = useCallback(async () => {
    try {
      setAppLogContent(await Backend.GetAppLog())
    } catch {
      setAppLogContent('> Failed to load app log')
    }
  }, [])

  const clearAppLog = useCallback(async () => {
    const result = await Backend.ClearAppLog()
    if (result === 'Success') {
      setAppLogContent('')
      await loadAppLog()
    } else setErrorAlert(result)
  }, [loadAppLog, setErrorAlert])

  const copyAppLog = useCallback(async () => {
    if (!appLogContent) return
    try {
      await navigator.clipboard.writeText(appLogContent)
      setCopyState('COPIED!')
      window.setTimeout(() => setCopyState('Copy'), 2000)
    } catch {
      setErrorAlert('Failed to copy app log')
    }
  }, [appLogContent, setErrorAlert])

  const checkUpdate = useCallback(async () => {
    setUpdateState('checking')
    const version = await Backend.CheckUpdate()
    if (version.includes('Error') || version.includes('Failed') || version.includes('No tag')) {
      setMsg('Check Failed')
      setErrorLog(version)
      setUpdateState('error')
      return
    }
    setRemoteVer(version)
    setUpdateState(isVersion(version) && (!coreExists || isNewerVersion(version, localVer)) ? 'available' : 'latest')
  }, [coreExists, localVer])

  const performUpdate = useCallback(async () => {
    setUpdateState('updating')
    setDownloadProgress(0)
    setMsg('Init Download...')
    const result = await Backend.UpdateKernel(mirrorEnabled ? mirrorUrl : '')
    if (result === 'Success') {
      setCoreExists(true)
      setMsg('Updated!')
      setLocalVer(remoteVer.replace(/^v/, ''))
      setUpdateState('success')
      timeoutRefs.current.push(window.setTimeout(() => setUpdateState('idle'), 2000))
    } else {
      setMsg('Failed')
      setErrorLog(cleanLog(result))
      setUpdateState('error')
    }
  }, [mirrorEnabled, mirrorUrl, remoteVer])

  const loadOverrideEditor = useCallback(async (type: 'tun' | 'mixed') => {
    try {
      const [content, defaultRaw] = await Promise.all([Backend.getOverride(type), Backend.getDefaultOverride(type)])
      const format = (value: string) => {
        try { return JSON.stringify(JSON.parse(value), null, 2) } catch { return value }
      }
      setEditorContent(format(content))
      setEditorOriginalContent(format(content))
      setEditorDefaultContent(format(defaultRaw))
      setEditorError('')
      return true
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : 'Failed to load override configuration')
      return false
    }
  }, [])

  const openEditor = useCallback(async (type: EditingType) => {
    setEditingType(type)
    setSaveBtnText('Save')
    setEditorError('')
    setShowEditor(true)
    if (type === 'mirror') {
      setEditorContent(mirrorUrl)
      setEditorOriginalContent(mirrorUrl)
      setEditorDefaultContent('https://gh-proxy.com/')
    } else {
      await loadOverrideEditor(type)
    }
  }, [loadOverrideEditor, mirrorUrl])

  const saveEditor = useCallback(async () => {
    let savedContent = editorContent
    if (editingType === 'mirror') {
      try { new URL(editorContent) } catch { setEditorError('Invalid Mirror URL format'); return }
      const result = await Backend.SaveSettings(editorContent, mirrorEnabled)
      if (result !== 'Success') { setEditorError(result); return }
      setMirrorUrl(editorContent)
    } else {
      try {
        savedContent = JSON.stringify(JSON.parse(editorContent), null, 2)
      } catch {
        setEditorError('Invalid JSON format')
        return
      }
      setEditorContent(savedContent)
      try { await Backend.saveOverride(editingType, savedContent) } catch (error) { setEditorError(error instanceof Error ? error.message : String(error)); return }
    }
    setEditorOriginalContent(savedContent)
    setSaveBtnText('Saved')
    if (running && editingType !== 'mirror') setMsg('RESTART TO APPLY')
    timeoutRefs.current.push(window.setTimeout(() => setShowEditor(false), 800))
  }, [editorContent, editingType, mirrorEnabled, running])

  const confirmReset = useCallback(async () => {
    setShowResetConfirm(false)
    if (editingType === 'mirror') {
      setEditorContent('https://gh-proxy.com/')
      return
    }
    try {
      await Backend.resetOverride(editingType)
      await loadOverrideEditor(editingType)
    } catch (error) {
      setEditorError(error instanceof Error ? error.message : String(error))
    }
  }, [editingType, loadOverrideEditor])

  const switchEditorTab = useCallback(async (type: 'tun' | 'mixed') => {
    if (await loadOverrideEditor(type)) {
      setEditingType(type)
      setSaveBtnText('Save')
    }
  }, [loadOverrideEditor])

  const checkProgramUpdate = useCallback(async () => {
    if (programUpdateCheckInFlight.current || programUpdateStateRef.current === 'updating') return
    programUpdateCheckInFlight.current = true
    setProgramUpdateState('checking')
    try {
      let localVersion = programLocalVer
      if (localVersion === 'Unknown') {
        try {
          localVersion = await Backend.getProductVersion()
          setProgramLocalVer(localVersion)
        } catch {
          // Keep the safe Unknown state and never claim an update without a local version.
        }
      }

      const result = await Backend.CheckProgramUpdate()
      if ('error' in result) {
        setMsg('Update Check Failed')
        setErrorLog(result.error)
        setProgramUpdateState('error')
        timeoutRefs.current.push(window.setTimeout(() => setProgramUpdateState('idle'), 3000))
        return
      }
      setProgramRemoteVer(result.version)
      setProgramChangelog(result.changelog || 'No changelog provided.')
      setProgramUpdateState(localVersion !== 'Unknown' && isNewerVersion(result.version, localVersion) ? 'available' : 'latest')
    } finally {
      programUpdateCheckInFlight.current = false
    }
  }, [programLocalVer])

  const performProgramUpdate = useCallback(async () => {
    setProgramUpdateState('updating')
    setProgramDownloadProgress(0)
    const result = await Backend.UpdateProgram(mirrorEnabled ? mirrorUrl : '')
    if (result === 'Success') setProgramUpdateState('success')
    else {
      setMsg('Update Failed')
      setErrorLog(result)
      setProgramUpdateState('error')
      timeoutRefs.current.push(window.setTimeout(() => setProgramUpdateState('idle'), 3000))
    }
  }, [mirrorEnabled, mirrorUrl])

  const resetUpdateStates = useCallback(() => {
    setUpdateState('idle')
    setProgramUpdateState('idle')
  }, [])

  const setThemeColor = useCallback(async (color: string) => {
    setAccentColor(color)
    const result = await Backend.SaveTheme(themeMode, color)
    if (result !== 'Success') setErrorAlert(result)
  }, [setErrorAlert, themeMode])

  const setThemeMode = useCallback(async (mode: string) => {
    if (!['light', 'dark', 'system'].includes(mode)) return
    setThemeModeState(mode)
    localStorage.setItem('themeMode', mode)
    const result = await Backend.SaveTheme(mode, accentColor)
    if (result !== 'Success') setErrorAlert(result)
  }, [accentColor, setErrorAlert])

  const loadUwpApps = useCallback(async () => {
    setUwpLoading(true)
    try {
      const apps = await Backend.GetUWPApps()
      setUwpApps(apps || [])
      setUwpSelectedSIDs((apps || []).filter((app) => app.isExempt).map((app) => app.sid))
    } catch (error) {
      setUwpApps([])
      setErrorAlert(error instanceof Error ? error.message : 'Failed to load UWP applications')
    } finally {
      setUwpLoading(false)
    }
  }, [setErrorAlert])

  const toggleUwpApp = useCallback((sid: string) => {
    setUwpSelectedSIDs((current) => current.includes(sid) ? current.filter((value) => value !== sid) : [...current, sid])
  }, [])

  const selectAllUwp = useCallback(() => setUwpSelectedSIDs(uwpApps.map((app) => app.sid)), [uwpApps])
  const deselectAllUwp = useCallback(() => setUwpSelectedSIDs([]), [])
  const uwpHasChanges = useMemo(() => {
    const current = uwpApps.filter((app) => app.isExempt).map((app) => app.sid).sort()
    const selected = [...uwpSelectedSIDs].sort()
    return current.length !== selected.length || current.some((sid, index) => sid !== selected[index])
  }, [uwpApps, uwpSelectedSIDs])

  const saveExemptions = useCallback(async () => {
    setUwpSaving(true)
    try {
      const result = await Backend.SetUWPLoopbackExemptions(uwpSelectedSIDs)
      if (result !== 'Success') { setErrorAlert(result); return false }
      setUwpApps((current) => current.map((app) => ({ ...app, isExempt: uwpSelectedSIDs.includes(app.sid) })))
      return true
    } catch (error) {
      setErrorAlert(error instanceof Error ? error.message : String(error))
      return false
    } finally {
      setUwpSaving(false)
    }
  }, [setErrorAlert, uwpSelectedSIDs])

  const statusText = useMemo(() => {
    if (!coreExists) return 'Warning'
    if (msg === 'Error') return 'Error'
    if (isProcessing && ['Starting...', 'Stopping...', 'Restarting...', 'Updating...', 'Working...'].includes(msg)) return msg
    if (['Detecting', 'Standby', 'Net Timeout'].includes(msg)) return msg
    if (!running) return 'Offline'
    if (tunMode && sysProxy) return 'Mixed Routing'
    if (tunMode) return 'TUN adapter'
    if (sysProxy) return 'System Proxy'
    return 'Online'
  }, [coreExists, isProcessing, msg, running, sysProxy, tunMode])

  const statusColor = useMemo(() => {
    if (!coreExists) return 'var(--status-warning)'
    if (msg === 'Error' || msg === 'Net Timeout') return 'var(--status-error)'
    if (msg === 'Detecting' || (isProcessing && ['Starting...', 'Stopping...', 'Restarting...', 'Updating...', 'Working...'].includes(msg))) return 'var(--status-warning)'
    if (msg === 'Standby') return 'var(--status-standby)'
    if (!running) return 'var(--status-offline)'
    if (tunMode && sysProxy) return 'var(--status-mixed)'
    if (tunMode) return 'var(--status-tun)'
    if (sysProxy) return 'var(--status-proxy)'
    return 'var(--status-default)'
  }, [coreExists, isProcessing, msg, running, sysProxy, tunMode])

  const controlColor = useMemo(() => getModeColor(tunMode, sysProxy, msg === 'Error' || !coreExists || msg === 'Net Timeout', running).hex, [coreExists, msg, running, sysProxy, tunMode])
  const isEditorChanged = editorContent !== editorOriginalContent
  const isManageProfilesChanged = JSON.stringify(profiles) !== JSON.stringify(manageProfilesList)

  const value = useMemo<AppContextValue>(() => ({
    initialized, running, coreExists, msg, tunMode, sysProxy, isProcessing, errorLog, showErrorAlert, errorAlertMessage,
    startOnBoot, autoConnectState, mirrorUrl, mirrorEnabled, ipv6Enabled, preRelease, logLevel, logToFile, closeBehavior,
    windowCloseRequested, setWindowCloseRequested, statusText, statusColor, controlColor,
    refreshData, handleServiceToggle, handleToggle, handleSwitchMode, handleRestartCore, handleMirrorToggle, handleStartOnBootToggle,
    handleAutoConnectChange, handleIPv6Toggle, handlePreReleaseToggle, handleLogLevelChange, handleLogToFileToggle,
    handleCloseBehaviorChange, setErrorAlert,
    profiles, activeProfile, switchProfile, updateActiveProfile, isUpdatingProfile, showManageProfilesModal,
    setShowManageProfilesModal, manageProfilesList, setManageProfilesList, removeProfileFromManageList, addNewDraftProfile, saveManageProfiles,
    isSavingProfiles, isManageProfilesChanged, manageProfilesError, setManageProfilesError, openManageProfiles,
    localVer, remoteVer, updateState, downloadProgress, checkUpdate, performUpdate, showEditor, setShowEditor,
    editingType, editorContent, setEditorContent, editorDefaultContent, isEditorChanged, saveBtnText, showResetConfirm,
    setShowResetConfirm, editorError, switchEditorTab, openEditor, saveEditor, confirmReset,
    programLocalVer, programRemoteVer, programUpdateState, programDownloadProgress, programChangelog, checkProgramUpdate,
    performProgramUpdate, resetUpdateStates, accentColor, themeMode, isDark, setThemeColor, setThemeMode,
    uwpApps, uwpSelectedSIDs, uwpLoading, uwpSaving, uwpHasChanges, loadUwpApps, toggleUwpApp, selectAllUwp,
    deselectAllUwp, saveExemptions,
  }), [
    accentColor, activeProfile, autoConnectState, closeBehavior, controlColor,
    coreExists, downloadProgress, editorContent, editorDefaultContent, editorError,
    handleAutoConnectChange, handleCloseBehaviorChange, handleIPv6Toggle, handleLogLevelChange, handleLogToFileToggle,
    handleMirrorToggle, handlePreReleaseToggle, handleServiceToggle, handleStartOnBootToggle, handleSwitchMode, handleRestartCore,
    handleToggle, initialized, isDark, isEditorChanged, isManageProfilesChanged, isProcessing, isSavingProfiles,
    isUpdatingProfile, loadUwpApps, localVer, manageProfilesError, manageProfilesList, mirrorEnabled,
    mirrorUrl, msg, openEditor, openManageProfiles, performProgramUpdate, performUpdate, preRelease, profiles,
    programChangelog, programDownloadProgress, programLocalVer, programRemoteVer, programUpdateState, refreshData,
    remoteVer, removeProfileFromManageList, resetUpdateStates, saveBtnText, saveEditor, saveExemptions, setEditorContent,
    setErrorAlert, showEditor, showErrorAlert, showManageProfilesModal, showResetConfirm, startOnBoot,
    statusColor, statusText, switchEditorTab, switchProfile, sysProxy, themeMode, tunMode, updateActiveProfile,
    updateState, uwpApps, uwpHasChanges, uwpLoading, uwpSaving, uwpSelectedSIDs, windowCloseRequested,
    ipv6Enabled, logLevel, logToFile, errorAlertMessage, errorLog, setShowManageProfilesModal,
    setShowResetConfirm, setWindowCloseRequested, setThemeColor, setThemeMode,
    deselectAllUwp, selectAllUwp, toggleUwpApp, confirmReset,
  ])

  const liveValue = useMemo<LiveContextValue>(() => ({
    trafficHistory,
    uploadSpeed,
    downloadSpeed,
    appLogContent,
    showLogModal,
    setShowLogModal,
    copyState,
    clearAppLog,
    copyAppLog,
  }), [appLogContent, clearAppLog, copyAppLog, copyState, downloadSpeed, showLogModal, uploadSpeed, trafficHistory])

  return (
    <AppContext.Provider value={value}>
      <LiveContext.Provider value={liveValue}>{children}</LiveContext.Provider>
    </AppContext.Provider>
  )
}

export function useApp() {
  const value = useContext(AppContext)
  if (!value) throw new Error('useApp must be used inside AppProvider')
  return value
}

export function useLive() {
  const value = useContext(LiveContext)
  if (!value) throw new Error('useLive must be used inside AppProvider')
  return value
}

function hexToRgb(hex: string) {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return match ? `${parseInt(match[1], 16)}, ${parseInt(match[2], 16)}, ${parseInt(match[3], 16)}` : '0, 144, 255'
}
