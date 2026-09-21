import { useEffect, useState } from 'react'
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
  ArrowDownload24Regular,
  ArrowSync24Regular,
  CheckmarkCircle24Regular,
  Code24Regular,
  Dismiss24Regular,
  Edit24Regular,
  Info24Regular,
  Settings24Regular,
  Warning24Regular,
} from '@fluentui/react-icons'
import * as Backend from '../api/backend'
import { useApp, type EditingType, type UpdateState } from '../state/AppContext'
import { ProductDialog } from './ProductDialog'
import { ScrollArea } from './ScrollArea'

interface SettingsPageProps {
  onClose: () => void
  showUwpModal: boolean
  onOpenUwp: () => void
  onCloseUwp: () => void
  onOpenChangelog: () => void
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
  return <div className="setting-row"><Text className="setting-label" weight="semibold">{label}</Text><div className="setting-control">{children}</div></div>
}

function SelectSetting({ label, value, options, onChange, disabled = false }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void; disabled?: boolean }) {
  return (
    <Dropdown
      className="winbox-dropdown setting-select"
      inlinePopup
      listbox={{ className: 'winbox-dropdown-listbox' }}
      value={options.find((option) => option.value === value)?.label || value}
      selectedOptions={[value]}
      onOptionSelect={(_, data) => { if (data.optionValue !== undefined) onChange(data.optionValue) }}
      disabled={disabled}
      aria-label={label}
    >
      {options.map((option) => <Option key={option.value} value={option.value} checkIcon={null}>{option.label}</Option>)}
    </Dropdown>
  )
}

function UpdateAction({ kind, state, version, progress, onCheck, onUpdate, coreExists }: {
  kind: 'program' | 'kernel'
  state: UpdateState
  version: string
  progress: number
  onCheck: () => void
  onUpdate: () => void
  coreExists?: boolean
}) {
  if (state === 'checking') return <Button appearance="secondary" size="small" className="winbox-secondary-button winbox-small-button update-action-button" disabled icon={<Spinner size="tiny" />}>Checking</Button>
  if (state === 'available') return <Button appearance="primary" size="small" className="winbox-primary-button winbox-small-button update-action-button" icon={<ArrowDownload24Regular />} onClick={onUpdate}>UP TO {version}</Button>
  if (state === 'updating') return <div className="progress-action"><ProgressBar className="progress-action-bar" value={progress / 100} /><span>{progress}%</span></div>
  if (state === 'success') return <Button appearance="secondary" size="small" className="winbox-secondary-button winbox-small-button update-action-button" icon={<CheckmarkCircle24Regular />} disabled>{kind === 'program' ? 'RESTARTING' : 'UPDATED'}</Button>
  if (state === 'latest') return <Button appearance="secondary" size="small" className="winbox-secondary-button winbox-small-button update-action-button" icon={<CheckmarkCircle24Regular />} disabled>Latest</Button>
  if (state === 'error') return <Button appearance="secondary" size="small" className="winbox-secondary-button winbox-small-button update-action-button" icon={<Warning24Regular />} onClick={onCheck}>FAILED</Button>
  return <Button appearance="secondary" size="small" icon={<ArrowSync24Regular />} onClick={onCheck} className={`winbox-secondary-button winbox-small-button update-action-button ${!coreExists && kind === 'kernel' ? 'warning-button' : ''}`}>{coreExists || kind === 'program' ? 'Check' : 'Download'}</Button>
}

function UwpDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const app = useApp()
  const sortedApps = [...app.uwpApps].sort((a, b) => a.displayName.localeCompare(b.displayName))
  return (
    <ProductDialog
      open={open}
      title="UWP Loopback Exemption"
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
              label={<span className="uwp-copy"><strong>{uwp.displayName}</strong>{uwp.packageName ? <small>{uwp.packageName}</small> : null}</span>}
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
  const title = isMirror ? 'Edit Mirror' : 'Edit Inbound'
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
      {app.editorError ? <MessageBar intent="error" layout="multiline"><MessageBarBody>{app.editorError}</MessageBarBody></MessageBar> : null}
      {!isMirror ? <TabList selectedValue={app.editingType} onTabSelect={(_, data) => void app.switchEditorTab(data.value as 'tun' | 'mixed')} className="editor-tabs"><Tab value="tun">Tun</Tab><Tab value="mixed">Mixed</Tab></TabList> : null}
      <Textarea className="editor-textarea" value={app.editorContent} onChange={(_, data) => app.setEditorContent(data.value)} resize="none" spellCheck={false} />
    </ProductDialog>
    <ProductDialog open={app.showResetConfirm} title="Confirm Reset" onOpenChange={app.setShowResetConfirm} width="md" footer={<div className="dialog-actions-right"><Button appearance="secondary" className="winbox-secondary-button winbox-dialog-button" onClick={() => app.setShowResetConfirm(false)}>Cancel</Button><Button appearance="primary" className="winbox-primary-button winbox-dialog-button" onClick={() => void app.confirmReset()}>Reset</Button></div>}>
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
  return <ProductDialog open={open} title="Theme Color" onOpenChange={onOpenChange} width="md" footer={<div className="dialog-actions-right"><Button appearance="secondary" className="winbox-secondary-button winbox-dialog-button" onClick={() => onOpenChange(false)}>Cancel</Button><Button appearance="primary" className="winbox-primary-button winbox-dialog-button" onClick={() => { void app.setThemeColor(draft); onOpenChange(false) }} disabled={draft === app.accentColor}>Apply</Button></div>}>
    <Text weight="semibold">Preset Colors</Text>
    <SwatchPicker layout="row" shape="circular" size="medium" selectedValue={draft} onSelectionChange={(_, data) => setDraft(data.selectedValue)}>
      {accentColors.map((color) => <ColorSwatch key={color.value} value={color.value} color={color.value} aria-label={color.name} />)}
    </SwatchPicker>
      <Text weight="semibold">Custom Color</Text>
      <div className="custom-color-row">
        <label className="custom-color-picker">
          <input aria-label="Choose custom theme color" type="color" value={draft} onChange={(event) => setDraft(event.target.value)} />
          <span className="custom-color-preview" style={{ backgroundColor: draft }}><Edit24Regular /></span>
        </label>
        <div className="custom-color-copy">
          <span>Click the circle to pick a custom color</span>
          <code>{draft}</code>
        </div>
      </div>
  </ProductDialog>
}

export default function SettingsPage({ onClose, showUwpModal, onOpenUwp, onCloseUwp, onOpenChangelog }: SettingsPageProps) {
  const app = useApp()
  const [showThemeModal, setShowThemeModal] = useState(false)

  const togglePreRelease = async () => {
    await app.handlePreReleaseToggle()
    app.resetUpdateStates()
  }

  return (
    <div className="settings-page">
      <ScrollArea className="settings-scroll">
        <div className="settings-content">
          {app.showErrorAlert ? <MessageBar intent="error" layout="multiline" className="product-message-bar"><MessageBarBody>{app.errorAlertMessage}</MessageBarBody><MessageBarActions><Button appearance="transparent" className="winbox-transparent-button" icon={<Dismiss24Regular />} onClick={() => app.setErrorAlert('')} aria-label="Dismiss error" /></MessageBarActions></MessageBar> : null}

          <section className="settings-card">
            <div className="settings-section-heading"><span><Info24Regular /><Text weight="semibold">About</Text></span><Button appearance="secondary" size="small" className="winbox-secondary-button winbox-small-button setting-action-button" onClick={() => void Backend.BrowserOpenURL('https://github.com/Leovikii/WinBox').catch((error) => app.setErrorAlert(error instanceof Error ? error.message : String(error)))} aria-label="GitHub repository">GitHub</Button></div>
            <SettingRow label="App Version"><div className="version-row"><span>{app.programLocalVer}</span><UpdateAction kind="program" state={app.programUpdateState} version={app.programRemoteVer} progress={app.programDownloadProgress} onCheck={() => void app.checkProgramUpdate()} onUpdate={onOpenChangelog} /></div></SettingRow>
            <SettingRow label="Kernel Version"><div className="version-row"><span>{app.localVer}</span><UpdateAction kind="kernel" state={app.updateState} version={app.remoteVer} progress={app.downloadProgress} onCheck={() => void app.checkUpdate()} onUpdate={() => void app.performUpdate()} coreExists={app.coreExists} /></div></SettingRow>
            <SettingRow label="Pre-release Updates"><Switch aria-label="Pre-release Updates" checked={app.preRelease} onChange={() => void togglePreRelease()} /></SettingRow>
            <SettingRow label="Download Proxy"><div className="setting-inline">{app.mirrorEnabled ? <Button appearance="secondary" size="small" className="winbox-secondary-button winbox-small-button winbox-icon-button" icon={<Edit24Regular />} onClick={() => void app.openEditor('mirror')} aria-label="Edit proxy URL" /> : null}<Switch aria-label="Download Proxy" checked={app.mirrorEnabled} onChange={() => void app.handleMirrorToggle()} /></div></SettingRow>
          </section>

          <section className="settings-card">
            <div className="settings-section-heading"><span><Settings24Regular /><Text weight="semibold">General</Text></span></div>
            <SettingRow label="UWP Loopback"><Button appearance="secondary" size="small" className="winbox-secondary-button winbox-small-button setting-action-button" icon={<Edit24Regular />} onClick={onOpenUwp}>Edit</Button></SettingRow>
            <SettingRow label="Run at Startup"><Switch aria-label="Run at Startup" checked={app.startOnBoot} onChange={() => void app.handleStartOnBootToggle()} /></SettingRow>
            <SettingRow label="Auto Connect"><SelectSetting label="Auto Connect" value={app.autoConnectState} options={autoConnectModes} onChange={(value) => void app.handleAutoConnectChange(value)} /></SettingRow>
            <SettingRow label="On Close Action"><SelectSetting label="On Close Action" value={app.closeBehavior} options={closeModes} onChange={(value) => void app.handleCloseBehaviorChange(value)} /></SettingRow>
            <SettingRow label="Theme"><div className="setting-inline"><Button appearance="secondary" size="small" className="winbox-secondary-button winbox-small-button color-button" onClick={() => setShowThemeModal(true)} aria-label="Theme color"><span style={{ backgroundColor: app.accentColor }} /></Button><SelectSetting label="Theme" value={app.themeMode} options={themeModes} onChange={(value) => void app.setThemeMode(value)} /></div></SettingRow>
          </section>

          <section className="settings-card">
            <div className="settings-section-heading"><span><Code24Regular /><Text weight="semibold">Config Override</Text></span></div>
            <SettingRow label="Log Level"><SelectSetting label="Log Level" value={app.logLevel} options={logLevels} onChange={(value) => void app.handleLogLevelChange(value)} /></SettingRow>
            <SettingRow label="Log Output"><Switch aria-label="Log Output" checked={app.logToFile} onChange={() => void app.handleLogToFileToggle()} /></SettingRow>
            <SettingRow label="IPv6"><Switch aria-label="IPv6" checked={app.ipv6Enabled} onChange={() => void app.handleIPv6Toggle()} /></SettingRow>
            <SettingRow label="Inbound Config"><Button appearance="secondary" size="small" className="winbox-secondary-button winbox-small-button setting-action-button" icon={<Edit24Regular />} onClick={() => void app.openEditor('tun')}>Edit</Button></SettingRow>
          </section>
        </div>
      </ScrollArea>
      <UwpDialog open={showUwpModal} onOpenChange={(open) => open ? onOpenUwp() : onCloseUwp()} />
      <EditorDialogs />
      <ThemeColorDialog open={showThemeModal} onOpenChange={setShowThemeModal} />
    </div>
  )
}
