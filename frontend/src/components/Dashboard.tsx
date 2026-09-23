import { memo, useEffect, useMemo, useRef } from 'react'
import { Button, Dropdown, Option, Radio, RadioGroup, Spinner, Text } from '@fluentui/react-components'
import {
  ArrowDown16Regular,
  ArrowMaximize16Regular,
  ArrowSync16Regular,
  ArrowUp16Regular,
  DocumentText16Regular,
  Edit16Regular,
  PlugConnected16Regular,
  Globe16Regular,
  PlugDisconnected16Regular,
  Shield16Regular,
  Play16Regular,
  Options16Regular,
  DocumentSettings16Regular,
  Server24Regular,
  LockClosed24Regular,
  ArrowDownload24Regular,
  Stop16Regular,
  Warning16Regular,
} from '@fluentui/react-icons'
import * as Backend from '../api/backend'
import { useApp, useLogs, useTraffic, useTheme } from '../state/AppContext'
import { ScrollArea, type ScrollAreaRef } from './ScrollArea'
import { SpeedChart } from './SpeedChart'
import { brandButtonStyle } from '../theme'
import { ManageProfilesDialog } from './ManageProfilesDialog'
import { AppLogsDialog } from './AppLogsDialog'

interface DashboardProps {
  onSwitchMode: (target: { tunMode: boolean; sysProxy: boolean }) => void
  onRestartCore: () => void
  onOpenSettings: () => void
}

const modeOptions = [
  { label: 'Proxy', value: 'proxy', color: '#10b981' },
  { label: 'TUN', value: 'tun', color: '#3b82f6' },
  { label: 'Mixed', value: 'mixed', color: '#d946ef' },
]

function formatSpeed(bytesPerSecond: number) {
  if (bytesPerSecond < 1024) return `${bytesPerSecond} B/s`
  const kbps = bytesPerSecond / 1024
  if (kbps < 1024) return `${kbps.toFixed(1)} KB/s`
  return `${(kbps / 1024).toFixed(2)} MB/s`
}

function parseUpdatedDate(value: string) {
  const trimmed = value.trim()
  if (/^\d{10}$/.test(trimmed)) return new Date(Number(trimmed) * 1000)
  if (/^\d{13}$/.test(trimmed)) return new Date(Number(trimmed))
  const normalized = trimmed.replace(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}(?::\d{2})?)$/, '$1T$2')
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatUpdated(value?: string) {
  if (!value) return 'Never'
  const date = parseUpdatedDate(value)
  if (!date) return value
  const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)
  if (diffSeconds < 60) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes} min${diffMinutes > 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? 's' : ''} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function selectedMode(tunMode: boolean, sysProxy: boolean) {
  if (tunMode && sysProxy) return 'mixed'
  if (tunMode) return 'tun'
  return 'proxy'
}

const SpeedReadout = memo(function SpeedReadout() {
  const { uploadSpeed, downloadSpeed } = useTraffic()
  return <div className="speed-readout" aria-label={`Upload ${formatSpeed(uploadSpeed)}, download ${formatSpeed(downloadSpeed)}`}>
    <span><ArrowUp16Regular />{formatSpeed(uploadSpeed)}</span>
    <span><ArrowDown16Regular />{formatSpeed(downloadSpeed)}</span>
  </div>
})

const TrafficChart = memo(function TrafficChart() {
  const { trafficHistory } = useTraffic()
  const { isDark } = useTheme()
  return <SpeedChart history={trafficHistory} dark={isDark} />
})

const InlineLogs = memo(function InlineLogs() {
  const live = useLogs()
  const inlineLogRef = useRef<ScrollAreaRef>(null)
  useEffect(() => {
    if (inlineLogRef.current?.isAtBottom()) inlineLogRef.current.scrollToBottom()
  }, [live.appLogContent])
  return <section className="dashboard-card logs-card">
    <div className="card-heading logs-heading">
      <div className="section-title"><DocumentText16Regular /><Text weight="semibold">Logs</Text></div>
      <Button appearance="secondary" className="winbox-secondary-button winbox-small-button winbox-icon-button" icon={<ArrowMaximize16Regular />} onClick={() => live.setShowLogModal(true)} aria-label="Expand logs" />
    </div>
    <ScrollArea ref={inlineLogRef} height="100%" className="logs-scroll-area">
      <div className="inline-log-content">{live.appLogContent || 'No logs available.'}</div>
    </ScrollArea>
  </section>
})

export default function Dashboard({ onSwitchMode, onRestartCore, onOpenSettings }: DashboardProps) {
  const app = useApp()
  const modeInputs = useRef<Record<string, HTMLInputElement | null>>({})
  const restoreModeFocus = useRef(false)
  const mode = selectedMode(app.tunMode, app.sysProxy)
  const activeColor = modeOptions.find((option) => option.value === mode)?.color || '#3b82f6'
  const actionStyle = useMemo(() => brandButtonStyle(app.running ? '#d13438' : activeColor, app.isDark), [activeColor, app.isDark, app.running])
  const showSpeed = app.running && (app.tunMode || app.sysProxy) && !app.isProcessing

  useEffect(() => {
    if (app.isProcessing || !restoreModeFocus.current) return
    restoreModeFocus.current = false
    // A temporary native disabled state blurs the selected radio. Restore only
    // when the user has not moved to another control during the async operation.
    if (document.activeElement === document.body) modeInputs.current[mode]?.focus({ preventScroll: true })
  }, [app.isProcessing, mode])

  const profileOptions = useMemo(() => app.profiles.map((profile) => ({ value: profile.id, label: profile.name })), [app.profiles])
  const activeProfileName = app.activeProfile?.name || ''

  const handleModeChange = (value: string) => {
    restoreModeFocus.current = Object.values(modeInputs.current).some(input => input === document.activeElement)
    const target = value === 'mixed' ? { tunMode: true, sysProxy: true } : value === 'tun' ? { tunMode: true, sysProxy: false } : { tunMode: false, sysProxy: true }
    onSwitchMode(target)
  }

  const handleProfileChange = (id?: string) => {
    if (id && !app.isProcessing) void app.switchProfile(id)
  }

  return (
    <div className={`dashboard-page ${app.running ? 'dashboard-running' : 'dashboard-idle'}`}>
      <section className={`dashboard-card status-card ${app.running ? 'status-card-running' : 'status-card-idle'}`}>
        <div className="card-heading status-heading">
          <div className="status-label" style={{ color: app.statusColor }}>
            <span className={`status-led ${app.running || app.isProcessing ? 'status-led-active' : ''}`} style={{ color: app.statusColor }}>
              {app.isProcessing ? <ArrowSync16Regular className="status-led-icon status-led-spin" /> : app.msg === 'Error' || !app.coreExists ? <Warning16Regular className="status-led-icon" /> : app.running ? <PlugConnected16Regular className="status-led-icon" /> : <PlugDisconnected16Regular className="status-led-icon" />}
            </span>
            <Text weight="semibold">{app.statusText}</Text>
          </div>
          {showSpeed ? (
            <SpeedReadout />
          ) : null}
        </div>
        {app.running ? (
          <div className="status-chart-wrap">
            <TrafficChart />
          </div>
        ) : null}
      </section>

      <section className={`dashboard-card profile-card ${app.running ? 'profile-card-collapsed' : ''}`}>
        {app.profiles.length > 0 ? (
          <>
            <div className="card-heading">
              <div className="section-title"><DocumentSettings16Regular /><Text weight="semibold">Profile</Text></div>
              {app.running ? (
                <Dropdown
                  className="winbox-dropdown profile-compact-select"
                  appearance="outline"
                  size="small"
                  button={{ className: 'winbox-dropdown-button' }}
                  listbox={{ className: 'winbox-dropdown-listbox' }}
                  value={activeProfileName}
                  selectedOptions={app.activeProfile ? [app.activeProfile.id] : []}
                  onOptionSelect={(_, data) => handleProfileChange(data.optionValue)}
                  disabled={app.isProcessing}
                  aria-label="Active profile"
                >
                  {profileOptions.map((option) => <Option className="winbox-option" key={option.value} value={option.value} checkIcon={{ className: 'winbox-option-marker', children: <span className="winbox-selection-bar" /> }}>{option.label}</Option>)}
                </Dropdown>
              ) : (
                  <Button appearance="secondary" size="small" className="winbox-secondary-button winbox-small-button winbox-icon-button" icon={<Edit16Regular />} onClick={app.openManageProfiles} disabled={app.isProcessing} aria-label="Manage profiles" />
              )}
            </div>
            <div className="profile-controls" inert={app.running} aria-hidden={app.running}>
              <Dropdown
                className="winbox-dropdown"
                appearance="outline"
                size="small"
                  button={{ className: 'winbox-dropdown-button' }}
                listbox={{ className: 'winbox-dropdown-listbox' }}
                value={activeProfileName}
                selectedOptions={app.activeProfile ? [app.activeProfile.id] : []}
                onOptionSelect={(_, data) => handleProfileChange(data.optionValue)}
                disabled={app.isProcessing}
                aria-label="Select profile"
              >
                {profileOptions.map((option) => <Option className="winbox-option" key={option.value} value={option.value} checkIcon={{ className: 'winbox-option-marker', children: <span className="winbox-selection-bar" /> }}>{option.label}</Option>)}
              </Dropdown>
                <Button
                className="winbox-secondary-button winbox-small-button"
                appearance="secondary"
                size="small"
                icon={app.isUpdatingProfile ? <Spinner size="tiny" /> : <ArrowSync16Regular />}
                onClick={() => void app.updateActiveProfile()}
                disabled={app.isProcessing || !app.activeProfile || app.isUpdatingProfile}
              >
                {formatUpdated(app.activeProfile?.updated)}
              </Button>
            </div>
          </>
        ) : (
          <div className={`empty-card ${!app.coreExists ? 'empty-card-muted' : ''}`}>
            <Server24Regular />
            <Text weight="semibold">No profile found</Text>
            {app.coreExists ? <Button appearance="secondary" size="small" className="winbox-secondary-button winbox-small-button" onClick={app.openManageProfiles}>Add profile</Button> : null}
          </div>
        )}
      </section>

      <section className="dashboard-card controls-card">
        {app.profiles.length > 0 ? (
          <>
            <div className="mode-row">
              <div className="section-title"><Options16Regular /><Text weight="semibold">Mode</Text></div>
              <RadioGroup
                className="mode-selector"
                data-selected={mode}
                layout="horizontal"
                value={mode}
                onChange={(_, data) => handleModeChange(data.value)}
                disabled={app.isProcessing}
                aria-label="Proxy mode"
                aria-busy={app.isModeSaving}
                aria-disabled={app.isProcessing || app.isModeSaving}
              >
                {modeOptions.map((option) => <Radio key={option.value} value={option.value} input={{ ref: node => { modeInputs.current[option.value] = node } }} className="mode-option" label={{ children: option.label, className: 'mode-label' }} indicator={{ className: 'mode-radio-indicator' }} />)}
              </RadioGroup>
            </div>
            <div className={`control-actions ${app.running ? 'control-actions-running' : ''}`}>
              <div className="control-side" inert={!app.running} aria-hidden={!app.running}><Button appearance="secondary" className="winbox-secondary-button winbox-control-button" icon={<Globe16Regular />} onClick={() => void Backend.OpenDashboard().catch((error) => app.setErrorAlert(error instanceof Error ? error.message : String(error)))} disabled={app.isProcessing}>Web UI</Button></div>
              <Button
                className={`${app.running ? 'winbox-danger-button' : 'winbox-primary-button'} winbox-control-button`}
                appearance="primary"
                icon={app.isProcessing ? <Spinner size="tiny" /> : app.running ? <Stop16Regular /> : (app.permissionPending || (app.tunMode && !app.elevated)) ? <Shield16Regular /> : <Play16Regular />}
                disabled={!app.coreExists || !app.activeProfile || app.isProcessing}
                aria-disabled={app.isModeSaving || undefined}
                onClick={() => void app.handleServiceToggle()}
                style={actionStyle}
              >
                {app.running ? (app.statusText === 'Stopping...' ? 'Stopping' : 'Stop') : (app.statusText === 'Starting...' ? 'Starting' : 'Start')}
              </Button>
              <div className="control-side" inert={!app.running} aria-hidden={!app.running}><Button appearance="secondary" className="winbox-secondary-button winbox-control-button" icon={app.statusText === 'Restarting...' ? <Spinner size="tiny" /> : <ArrowSync16Regular />} onClick={onRestartCore} disabled={app.isProcessing}>Restart</Button></div>
            </div>
          </>
        ) : (
          <div className="empty-card">
          {!app.coreExists ? <><ArrowDownload24Regular /><Text weight="semibold">Kernel missing</Text><Button appearance="secondary" size="small" className="winbox-secondary-button winbox-small-button" onClick={onOpenSettings}>Install kernel</Button></> : <><LockClosed24Regular /><Text weight="semibold">Profile required</Text></>}
          </div>
        )}
      </section>

      <InlineLogs />

      <ManageProfilesDialog />
      <AppLogsDialog />
    </div>
  )
}
