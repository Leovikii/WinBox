import { useEffect, useRef, useState } from 'react'
import {
  Button,
  Checkbox,
  Dropdown,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  Option,
  ProgressBar,
  Spinner,
  SwatchPicker,
  Tab,
  TabList,
  Text,
  Textarea,
  ColorSwatch,
  Switch,
} from '@fluentui/react-components'
import {
  ArrowDownload16Regular,
  ArrowSync16Regular,
  CheckmarkCircle16Regular,
  Code16Regular,
  Dismiss16Regular,
  Edit16Regular,
  Info16Regular,
  Info24Regular,
  Settings16Regular,
  Warning16Regular,
} from '@fluentui/react-icons'
import * as Backend from '../api/backend'
import { useApp, type UpdateState } from '../state/AppContext'
import { ProductDialog } from './ProductDialog'
import { ScrollArea } from './ScrollArea'
import { ExpandMotion } from './motion'
import { luminance } from '../theme'

interface SettingsPageProps {
  showUwpModal: boolean
  onOpenUwp: () => void
  onCloseUwp: () => void
  onOpenChangelog: (kind: 'program' | 'kernel') => void
}

const themeModes = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

const autoConnectModes = [
  { value: 'smart', label: 'Smart' },
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
]

const closeModes = [
  { value: 'ask', label: 'Ask' },
  { value: 'tray', label: 'Minimize' },
  { value: 'quit', label: 'Quit' },
]

const logLevels = [
  { value: '', label: 'Default' },
  { value: 'trace', label: 'Trace' },
  { value: 'debug', label: 'Debug' },
  { value: 'info', label: 'Info' },
  { value: 'warn', label: 'Warn' },
  { value: 'error', label: 'Error' },
  { value: 'fatal', label: 'Fatal' },
  { value: 'panic', label: 'Panic' },
]

const accentColors = [
  { name: 'Blue', value: '#0090FF' },
  { name: 'Green', value: '#30A46C' },
  { name: 'Pink', value: '#D6409F' },
  { name: 'Purple', value: '#8E4EC6' },
  { name: 'Red', value: '#E54D2E' },
]

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="setting-row"><Text className="setting-label">{label}</Text><div className="setting-control">{children}</div></div>
}

function SelectSetting({ label, value, options, onChange, disabled = false }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void; disabled?: boolean }) {
  return (
                <Dropdown
                  appearance="outline"
      className="winbox-dropdown setting-select"
      size="small"
                  button={{ className: 'winbox-dropdown-button' }}
      listbox={{ className: 'winbox-dropdown-listbox' }}
      value={options.find((option) => option.value === value)?.label || value}
      selectedOptions={[value]}
      onOptionSelect={(_, data) => { if (data.optionValue !== undefined) onChange(data.optionValue) }}
      disabled={disabled}
      aria-label={label}
    >
      {options.map((option) => <Option className="winbox-option" key={option.value} value={option.value} checkIcon={{ className: 'winbox-option-marker', children: <span className="winbox-selection-bar" /> }}>{option.label}</Option>)}
    </Dropdown>
  )
}

function StartupSetting() {
  const app = useApp()
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const revision = useRef(0)

  useEffect(() => {
    if (inFlight.current) return
    const current = ++revision.current
    void Backend.GetStartOnBoot().then(value => {
      if (current === revision.current) setEnabled(value)
    }).catch(error => {
      if (current === revision.current) { setEnabled(null); app.setErrorAlert(error.message) }
    })
    return () => { revision.current++ }
  }, [app.setErrorAlert])

  const toggle = async () => {
    if (inFlight.current || enabled === null) return
    inFlight.current = true
    revision.current++
    setBusy(true)
    try {
      const actual = await Backend.SetStartOnBoot(!enabled)
      setEnabled(actual)
      if (actual && app.autoConnectState === 'off') await app.handleAutoConnectChange('smart')
    } catch (error) {
      app.setErrorAlert(error instanceof Error ? error.message : String(error))
      // A failed verification may follow a successful registration. Read reality.
      try { setEnabled(await Backend.GetStartOnBoot()) } catch { setEnabled(null) }
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  return <SettingRow label="Run at startup"><Switch aria-label="Run at startup" checked={enabled === true} disabled={busy || enabled === null} aria-busy={busy} onChange={() => void toggle()} /></SettingRow>
}

function UpdateAction({ kind, state, progress, onCheck, onUpdate, coreExists, disabled = false }: {
  kind: 'program' | 'kernel'
  state: UpdateState
  progress: number
  onCheck: () => void
  onUpdate: () => void
  coreExists?: boolean
  disabled?: boolean
}) {
  const installMissingKernel = kind === 'kernel' && !coreExists
  if (state === 'checking') return <Button appearance="secondary" size="small" className="winbox-secondary-button winbox-small-button update-action-button" disabled icon={<Spinner size="tiny" />}>Checking</Button>
  if (state === 'available') return <Button appearance="secondary" size="small" className="winbox-secondary-button winbox-small-button update-action-button update-available" icon={<ArrowDownload16Regular />} disabled={disabled} onClick={onUpdate}>Update</Button>
  if (state === 'updating') return <div className="progress-action"><span>{progress}%</span><ProgressBar thickness="medium" aria-label={`${kind === 'program' ? 'Application' : 'Kernel'} download`} className="progress-action-bar" value={progress / 100} /></div>
  if (state === 'success') return <Button appearance="secondary" size="small" className="winbox-secondary-button winbox-small-button update-action-button" icon={<CheckmarkCircle16Regular />} disabled>{kind === 'program' ? 'Restarting' : 'Updated'}</Button>
  if (state === 'latest' && !installMissingKernel) return <Button appearance="secondary" size="small" className="winbox-secondary-button winbox-small-button update-action-button" icon={<CheckmarkCircle16Regular />} disabled>Latest</Button>
  if (state === 'error') return <Button appearance="secondary" size="small" className="winbox-secondary-button winbox-small-button update-action-button" icon={<Warning16Regular />} disabled={disabled} onClick={installMissingKernel ? onUpdate : onCheck}>Failed</Button>
  return <Button appearance="secondary" size="small" icon={installMissingKernel ? <ArrowDownload16Regular /> : <ArrowSync16Regular />} disabled={disabled} onClick={installMissingKernel ? onUpdate : onCheck} className={`winbox-secondary-button winbox-small-button update-action-button ${installMissingKernel ? 'warning-button' : ''}`}>{installMissingKernel ? 'Download' : 'Check'}</Button>
}

function UwpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const app = useApp()
  const sortedApps = [...app.uwpApps].sort((a, b) => a.displayName.localeCompare(b.displayName))
  return (
    <ProductDialog
      open={open}
      title="UWP loopback exemption"
      onOpenChange={onOpenChange}
      footer={(
        <div className="dialog-actions-right">
          <Button appearance="secondary" className="winbox-secondary-button winbox-dialog-button" onClick={() => onOpenChange(false)} disabled={app.uwpSaving}>Cancel</Button>
          <Button appearance="primary" className="winbox-primary-button winbox-dialog-button" onClick={() => { void app.saveExemptions().then((saved) => { if (saved) onOpenChange(false) }) }} disabled={app.uwpLoading || app.uwpSaving || !app.uwpHasChanges} icon={app.uwpSaving ? <Spinner size="tiny" /> : undefined}>{app.uwpSaving ? 'Saving…' : 'Save'}</Button>
        </div>
      )}
    >
      <div className="uwp-header">
        <Text>Selected: <strong>{app.uwpSelectedSIDs.length}</strong> / {app.uwpApps.length}</Text>
        <div className="dialog-actions-right">
          <Button size="small" appearance="secondary" className="winbox-secondary-button winbox-small-button" onClick={app.selectAllUwp} disabled={app.uwpLoading || app.uwpSaving}>All</Button>
          <Button size="small" appearance="secondary" className="winbox-secondary-button winbox-small-button" onClick={app.deselectAllUwp} disabled={app.uwpLoading || app.uwpSaving}>None</Button>
        </div>
      </div>
      {app.uwpLoading ? <div className="loading-panel"><Spinner label="Loading UWP applications…" /></div> : app.uwpApps.length === 0 ? <div className="empty-panel"><Info24Regular /><Text>No UWP applications found</Text></div> : (
        <ScrollArea maxHeight="16rem" className="uwp-list">
          {sortedApps.map((uwp) => <div className="uwp-row" key={uwp.sid}>
            <Checkbox
              className="uwp-checkbox"
              checked={app.uwpSelectedSIDs.includes(uwp.sid)}
              onChange={() => app.toggleUwpApp(uwp.sid)}
              label={{ className: 'uwp-checkbox-label', children: <span className="uwp-copy"><strong>{uwp.displayName}</strong>{uwp.packageName ? <small>{uwp.packageName}</small> : null}</span> }}
              aria-label={`${uwp.displayName}${uwp.packageName ? `, ${uwp.packageName}` : ''}`}
            />
          </div>)}
        </ScrollArea>
      )}
    </ProductDialog>
  )
}

function EditorDialogs() {
  const app = useApp()
  const isMirror = app.editingType === 'mirror'
  const title = isMirror ? 'Edit mirror' : 'Edit inbound'
  return <>
    <ProductDialog
      open={app.showEditor}
      title={title}
      onOpenChange={app.setShowEditor}
      width="xl"
      className="editor-dialog"
      footer={(
        <div className="dialog-actions-right">
          {app.editorContent !== app.editorDefaultContent ? <Button appearance="secondary" className="winbox-secondary-button winbox-dialog-button" onClick={() => app.setShowResetConfirm(true)}>Reset</Button> : null}
          <Button appearance="secondary" className="winbox-secondary-button winbox-dialog-button" onClick={() => app.setShowEditor(false)}>Cancel</Button>
          <Button appearance={app.saveBtnText === 'Saved' ? 'secondary' : 'primary'} className={`${app.saveBtnText === 'Saved' ? 'winbox-secondary-button' : 'winbox-primary-button'} winbox-dialog-button`} onClick={() => void app.saveEditor()} disabled={!app.isEditorChanged}>{app.saveBtnText === 'Saved' ? 'Saved!' : 'Save'}</Button>
        </div>
      )}
    >
      <ExpandMotion visible={!!app.editorError} unmountOnExit><div className="expand-content"><MessageBar intent="error" layout="multiline"><MessageBarBody>{app.editorError}</MessageBarBody></MessageBar></div></ExpandMotion>
      {!isMirror ? <TabList selectedValue={app.editingType} onTabSelect={(_, data) => void app.switchEditorTab(data.value as 'tun' | 'mixed')} className="editor-tabs"><Tab value="tun">TUN</Tab><Tab value="mixed">Mixed</Tab></TabList> : null}
      <Textarea textarea={{ className: 'editor-input' }} aria-label="Configuration JSON" className="editor-textarea" value={app.editorContent} onChange={(_, data) => app.setEditorContent(data.value)} resize="none" spellCheck={false} />
    </ProductDialog>
    <ProductDialog open={app.showResetConfirm} title="Confirm reset" onOpenChange={app.setShowResetConfirm} width="md" footer={<div className="dialog-actions-right"><Button appearance="secondary" className="winbox-secondary-button winbox-dialog-button" onClick={() => app.setShowResetConfirm(false)}>Cancel</Button><Button appearance="primary" className="winbox-primary-button winbox-dialog-button" onClick={() => void app.confirmReset()}>Reset</Button></div>}>
      <p>Reset to default configuration?</p>
    </ProductDialog>
  </>
}

function ThemeColorDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const app = useApp()
  const [draft, setDraft] = useState(app.accentColor)
  useEffect(() => {
    if (open) setDraft(app.accentColor)
  }, [app.accentColor, open])
  return <ProductDialog open={open} title="Theme color" onOpenChange={onOpenChange} width="md" footer={<div className="dialog-actions-right"><Button appearance="secondary" className="winbox-secondary-button winbox-dialog-button" onClick={() => onOpenChange(false)}>Cancel</Button><Button appearance="primary" className="winbox-primary-button winbox-dialog-button" onClick={() => { void app.setThemeColor(draft); onOpenChange(false) }} disabled={draft === app.accentColor}>Apply</Button></div>}>
    <Text weight="semibold">Preset colors</Text>
    <SwatchPicker layout="row" shape="circular" size="medium" selectedValue={draft} onSelectionChange={(_, data) => setDraft(data.selectedValue)}>
      {accentColors.map((color) => <ColorSwatch key={color.value} value={color.value} color={color.value} aria-label={color.name} />)}
    </SwatchPicker>
      <Text weight="semibold">Custom color</Text>
      <div className="custom-color-row">
        <label className="custom-color-picker">
          <input aria-label="Choose custom theme color" type="color" value={draft} onChange={(event) => setDraft(event.target.value)} />
          <span className="custom-color-preview" style={{ backgroundColor: draft, color: /^#[a-f\d]{6}$/i.test(draft) && luminance(draft) > .179 ? '#000000' : '#ffffff' }}><Edit16Regular /></span>
        </label>
        <div className="custom-color-copy">
          <span>Click the circle to pick a custom color</span>
          <code>{draft}</code>
        </div>
      </div>
  </ProductDialog>
}

export default function SettingsPage({ showUwpModal, onOpenUwp, onCloseUwp, onOpenChangelog }: SettingsPageProps) {
  const app = useApp()
  const [showThemeModal, setShowThemeModal] = useState(false)

  const channelLocked = app.isChangingUpdateChannel || ['checking', 'updating'].includes(app.updateState) || ['checking', 'updating'].includes(app.programUpdateState)

  return (
    <div className="settings-page">
      <ScrollArea className="settings-scroll">
        <div className="settings-content">
          <ExpandMotion visible={app.showErrorAlert} unmountOnExit><div className="message-presence" inert={!app.showErrorAlert}><MessageBar intent="error" layout="multiline" className="product-message-bar"><MessageBarBody>{app.errorAlertMessage}</MessageBarBody><MessageBarActions><Button appearance="transparent" className="winbox-transparent-button" icon={<Dismiss16Regular />} onClick={() => app.setErrorAlert('')} aria-label="Dismiss error" /></MessageBarActions></MessageBar></div></ExpandMotion>

          <section className="settings-card">
            <div className="settings-section-heading"><span><Info16Regular /><Text weight="semibold">About</Text></span><Button appearance="secondary" size="small" className="winbox-secondary-button winbox-small-button setting-action-button" onClick={() => void Backend.BrowserOpenURL('https://github.com/Leovikii/WinBox').catch((error) => app.setErrorAlert(error instanceof Error ? error.message : String(error)))} icon={<span className="github-icon" aria-hidden="true" />} aria-label="GitHub repository">GitHub</Button></div>
            <SettingRow label="App version"><div className="version-row"><span>{app.programLocalVer}</span><UpdateAction kind="program" state={app.programUpdateState} progress={app.programDownloadProgress} onCheck={() => void app.checkProgramUpdate()} onUpdate={() => onOpenChangelog('program')} disabled={app.isChangingUpdateChannel || app.updateState === 'updating'} /></div></SettingRow>
            <SettingRow label="Kernel version"><div className="version-row"><span>{app.localVer}</span><UpdateAction kind="kernel" state={app.updateState} progress={app.downloadProgress} onCheck={() => void app.checkUpdate()} onUpdate={() => app.coreExists ? onOpenChangelog('kernel') : void app.performUpdate()} coreExists={app.coreExists} disabled={app.isChangingUpdateChannel || app.programUpdateState === 'updating'} /></div></SettingRow>
            <SettingRow label="Pre-release updates"><Switch aria-label="Pre-release updates" checked={app.preRelease} disabled={channelLocked} onChange={() => void app.handlePreReleaseToggle()} /></SettingRow>
            <SettingRow label="Download proxy"><div className="setting-inline mirror-controls"><div className={`mirror-edit ${app.mirrorEnabled ? 'mirror-edit-open' : ''}`} inert={!app.mirrorEnabled} aria-hidden={!app.mirrorEnabled}><Button appearance="secondary" size="small" className="winbox-secondary-button winbox-small-button winbox-icon-button" icon={<Edit16Regular />} onClick={() => void app.openEditor('mirror')} aria-label="Edit proxy URL" /></div><Switch aria-label="Download proxy" checked={app.mirrorEnabled} onChange={() => void app.handleMirrorToggle()} /></div></SettingRow>
          </section>

          <section className="settings-card">
            <div className="settings-section-heading"><span><Settings16Regular /><Text weight="semibold">General</Text></span></div>
            <SettingRow label="UWP loopback"><Button appearance="secondary" size="small" className="winbox-secondary-button winbox-small-button setting-action-button" icon={<Edit16Regular />} onClick={onOpenUwp}>Edit</Button></SettingRow>
            <StartupSetting />
            <SettingRow label="Auto connect"><SelectSetting label="Auto connect" value={app.autoConnectState} options={autoConnectModes} onChange={(value) => void app.handleAutoConnectChange(value)} /></SettingRow>
            <SettingRow label="On close action"><SelectSetting label="On close action" value={app.closeBehavior} options={closeModes} onChange={(value) => void app.handleCloseBehaviorChange(value)} /></SettingRow>
            <SettingRow label="Theme"><div className="setting-inline"><Button appearance="subtle" shape="circular" size="small" className="color-button" onClick={() => setShowThemeModal(true)} aria-label="Theme color"><span className="theme-color-preview" style={{ backgroundColor: app.accentColor }} /></Button><SelectSetting label="Theme" value={app.themeMode} options={themeModes} onChange={(value) => void app.setThemeMode(value)} /></div></SettingRow>
          </section>

          <section className="settings-card">
            <div className="settings-section-heading"><span><Code16Regular /><Text weight="semibold">Config override</Text></span></div>
            <SettingRow label="Log level"><SelectSetting label="Log level" value={app.logLevel} options={logLevels} onChange={(value) => void app.handleLogLevelChange(value)} /></SettingRow>
            <SettingRow label="Log output"><Switch aria-label="Log output" checked={app.logToFile} onChange={() => void app.handleLogToFileToggle()} /></SettingRow>
            <SettingRow label="IPv6"><Switch aria-label="IPv6" checked={app.ipv6Enabled} onChange={() => void app.handleIPv6Toggle()} /></SettingRow>
            <SettingRow label="Inbound config"><Button appearance="secondary" size="small" className="winbox-secondary-button winbox-small-button setting-action-button" icon={<Edit16Regular />} onClick={() => void app.openEditor('tun')}>Edit</Button></SettingRow>
          </section>
        </div>
      </ScrollArea>
      <UwpDialog open={showUwpModal} onOpenChange={(open) => open ? onOpenUwp() : onCloseUwp()} />
      <EditorDialogs />
      <ThemeColorDialog open={showThemeModal} onOpenChange={setShowThemeModal} />
    </div>
  )
}
