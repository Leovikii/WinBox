import { Activity, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Checkbox, Spinner, Toast, ToastBody, Toaster, ToastTitle, Tooltip, useToastController } from '@fluentui/react-components'
import { ArrowLeft16Regular, Dismiss16Regular, Settings16Regular, Shield16Regular, Subtract16Regular } from '@fluentui/react-icons'
import { renderChangelog } from './utils/changelog'
import * as Backend from './api/backend'
import { useApp } from './state/AppContext'
import Dashboard from './components/Dashboard'
import { PageMotion } from './components/motion'
import { ScrollArea } from './components/ScrollArea'
import { ProductDialog } from './components/ProductDialog'
import TrayIconUrl from './assets/icon-builder/src/tray.svg'
import { brandButtonStyle } from './theme'

const SettingsPage = lazy(() => import('./components/SettingsPage'))

export default function App() {
  const app = useApp()
  const dangerStyle = useMemo(() => brandButtonStyle('#d13438', app.isDark), [app.isDark])
  const [showSettings, setShowSettings] = useState(false)
  const [settingsVisited, setSettingsVisited] = useState(false)
  const openSettings = () => { setSettingsVisited(true); setShowSettings(true) }
  const [showQuitConfirm, setShowQuitConfirm] = useState(false)
  const [showUwpModal, setShowUwpModal] = useState(false)
  const [updateDialog, setUpdateDialog] = useState<'program' | 'kernel'>('program')
  const [showUpdateDialog, setShowUpdateDialog] = useState(false)
  const [rememberCloseChoice, setRememberCloseChoice] = useState(false)
  const updateCheckStarted = useRef(false)
  const handoffStarted = useRef(false)
  const errorToastId = useRef<string | null>(null)
  const toastSequence = useRef(0)
  const { dispatchToast, updateToast, dismissToast } = useToastController('app-notifications')

  useEffect(() => {
    if (!app.showErrorAlert) {
      if (errorToastId.current) dismissToast(errorToastId.current)
      errorToastId.current = null
      return
    }
    const content = <Toast>
      <ToastTitle action={<Button appearance="transparent" size="small" icon={<Dismiss16Regular />} onClick={() => app.setErrorAlert('')} aria-label="Dismiss error" />}>Error</ToastTitle>
      <ToastBody className="app-toast-body" tabIndex={0} aria-label="Error details">{app.errorAlertMessage}</ToastBody>
    </Toast>
    if (errorToastId.current) updateToast({ toastId: errorToastId.current, content })
    else {
      errorToastId.current = `app-error-${++toastSequence.current}`
      dispatchToast(content, { toastId: errorToastId.current, intent: 'error', timeout: -1 })
    }
  }, [app.showErrorAlert, app.errorAlertMessage, app.setErrorAlert, dispatchToast, updateToast, dismissToast])

  const reportBackendError = (error: unknown) => {
    app.setErrorAlert(error instanceof Error ? error.message : String(error))
  }

  useEffect(() => {
    if (app.initialized && !app.showErrorAlert && !app.initialHandoff && !updateCheckStarted.current) {
      updateCheckStarted.current = true
      void app.checkProgramUpdate()
    }
  }, [app.checkProgramUpdate, app.initialized, app.initialHandoff, app.showErrorAlert])

  useEffect(() => {
    if (!app.initialized || !app.initialHandoff || handoffStarted.current) return
    handoffStarted.current = true
    if (app.initialHandoff.kind === 'uwp') {
      openSettings()
      setShowUwpModal(true)
      void app.loadUwpApps(app.initialHandoff.selected).then(() => app.continueHandoff()).catch(reportBackendError)
    } else {
      if (app.initialHandoff.kind === 'update') openSettings()
      void app.continueHandoff()
    }
  }, [app.initialized, app.initialHandoff])

  const requestQuit = () => {
    if (app.closeBehavior === 'tray') {
      void Backend.MinimizeToTray().catch(reportBackendError)
    } else if (app.closeBehavior === 'quit') {
      void Backend.Quit().catch(reportBackendError)
    } else {
      setShowQuitConfirm(true)
    }
  }

  useEffect(() => {
    if (!app.windowCloseRequested) return
    app.setWindowCloseRequested(false)
    requestQuit()
  }, [app.windowCloseRequested])

  const confirmMinimize = async () => {
    try {
      if (rememberCloseChoice) await app.handleCloseBehaviorChange('tray')
      await Backend.MinimizeToTray()
      setShowQuitConfirm(false)
    } catch (error) {
      reportBackendError(error)
    }
  }

  const confirmQuit = async () => {
    try {
      if (rememberCloseChoice) await app.handleCloseBehaviorChange('quit')
      await Backend.Quit()
      setShowQuitConfirm(false)
    } catch (error) {
      reportBackendError(error)
    }
  }

  const kernelDialog = updateDialog === 'kernel'
  const changelog = useMemo(() => renderChangelog(kernelDialog ? app.kernelChangelog : app.programChangelog), [kernelDialog, app.kernelChangelog, app.programChangelog])

  const switchMode = async (target: { tunMode: boolean; sysProxy: boolean }) => {
    const result = await app.handleSwitchMode(target)
    if (result?.error === 'kernel-missing' || result?.error === 'config-missing') openSettings()
  }

  return (
    <div className="winbox-shell">
      <header className="winbox-titlebar">
        <div data-tauri-drag-region className="winbox-drag-region">
          <img src={TrayIconUrl} className="winbox-logo" alt="WinBox" />
          <span>WinBox</span>
          {app.elevated ? <Tooltip content="Running as administrator" relationship="label"><span className="winbox-admin-status" role="img" tabIndex={0} aria-label="Running as administrator"><Shield16Regular /></span></Tooltip> : null}
        </div>
        <div className="winbox-window-actions">
          <Button
            appearance="subtle"
            icon={showSettings ? <ArrowLeft16Regular /> : <Settings16Regular />}
            aria-label={showSettings ? 'Back to Home' : 'Settings'}
            title={showSettings ? 'Back to Home' : 'Settings'}
            onClick={() => showSettings ? setShowSettings(false) : openSettings()}
            className="winbox-window-button winbox-caption-button"
          >
            {app.programUpdateState === 'available' ? <span className="update-dot" aria-label="Update available" /> : null}
          </Button>
          <Button appearance="subtle" icon={<Subtract16Regular />} aria-label="Minimize" title="Minimize" onClick={() => void Backend.Minimize().catch(reportBackendError)} className="winbox-window-button winbox-caption-button" />
          <Button appearance="subtle" icon={<Dismiss16Regular />} aria-label="Close" title="Close" onClick={requestQuit} className="winbox-window-button winbox-caption-button winbox-close-button" />
        </div>
      </header>

      <Toaster toasterId="app-notifications" position="top" limit={1} offset={{ vertical: 48 }} style={{ width: 'min(360px, calc(100vw - 32px))' }} />

      <main className="winbox-page-frame">
        <Activity mode={showSettings ? 'hidden' : 'visible'}>
          <PageMotion visible appear>
            <div className="winbox-page winbox-page-dashboard">
              <Dashboard onSwitchMode={switchMode} onRestartCore={() => void app.handleRestartCore()} onOpenSettings={openSettings} />
            </div>
          </PageMotion>
        </Activity>
        {settingsVisited ? <Activity mode={showSettings ? 'visible' : 'hidden'}>
          <PageMotion visible appear>
            <div className="winbox-page winbox-page-settings">
              <Suspense fallback={<div className="page-loading"><Spinner size="tiny" label="Loading settings…" /></div>}>
                <SettingsPage showUwpModal={showUwpModal && app.permissionDialog !== 'uwp'}
                  onOpenUwp={() => { setShowUwpModal(true); void app.loadUwpApps() }}
                  onCloseUwp={() => setShowUwpModal(false)} onOpenChangelog={kind => { setUpdateDialog(kind); setShowUpdateDialog(true) }} />
              </Suspense>
            </div>
          </PageMotion>
        </Activity> : null}
      </main>

      <ProductDialog
        open={app.permissionDialog !== null}
        title="Administrator permission"
        onOpenChange={open => { if (!open && !app.authorizing) app.setPermissionDialog(null) }}
        footer={<div className="dialog-actions-stretch">
          <Button appearance="secondary" disabled={app.authorizing} onClick={() => app.setPermissionDialog(null)}>Cancel</Button>
          <Button appearance="primary" disabled={app.authorizing} icon={app.authorizing ? <Spinner size="tiny" /> : undefined} onClick={() => void app.authorize()}>
            {app.authorizing ? 'Authorizing' : 'Continue'}
          </Button>
        </div>}
      >
        <span>{app.permissionDialog === 'uwp' ? 'Restart WinBox as administrator to edit UWP exemptions. Your selection will be kept.' : 'Restart WinBox as administrator to connect in TUN / Mixed mode.'}</span>
      </ProductDialog>

      <ProductDialog
        open={showQuitConfirm}
        title="Exit options"
        onOpenChange={setShowQuitConfirm}
        width="md"
        footer={(
          <div className="dialog-actions-stretch">
            <Button appearance="secondary" className="winbox-secondary-button winbox-dialog-button" onClick={() => void confirmMinimize()}>Minimize</Button>
            <Button appearance="primary" style={dangerStyle} className="winbox-danger-button winbox-dialog-button" onClick={() => void confirmQuit()}>Quit</Button>
          </div>
        )}
      >
        <p>Minimize or quit?</p>
        <Checkbox
          checked={rememberCloseChoice}
          onChange={(_, data) => setRememberCloseChoice(Boolean(data.checked))}
          label="Remember my choice"
        />
      </ProductDialog>

      <ProductDialog
        open={showUpdateDialog}
        title={kernelDialog ? 'Update sing-box' : 'Update WinBox'}
        onOpenChange={setShowUpdateDialog}
        width="md"
        footer={(
          <div className="dialog-actions-stretch">
            <Button appearance="secondary" className="winbox-secondary-button winbox-dialog-button" onClick={() => setShowUpdateDialog(false)}>Later</Button>
            <Button appearance="primary" className="winbox-primary-button winbox-dialog-button" disabled={app.isChangingUpdateChannel || ['checking', 'updating'].includes(app.updateState) || ['checking', 'updating'].includes(app.programUpdateState)} onClick={() => { setShowUpdateDialog(false); openSettings(); void (kernelDialog ? app.performUpdate() : app.performProgramUpdate()) }}>
              Update now
            </Button>
          </div>
        )}
      >
        <p>{kernelDialog ? app.localVer : app.programLocalVer} → {kernelDialog ? app.remoteVer : app.programRemoteVer}</p>
        <ScrollArea key={updateDialog} maxHeight="45vh" style={{ minHeight: 0 }}><div className="markdown-body" onClick={(event) => {
          const link = (event.target as Element).closest('a')
          if (!link) return
          event.preventDefault()
          void Backend.BrowserOpenURL(link.href).catch(reportBackendError)
        }} dangerouslySetInnerHTML={{ __html: changelog }} /></ScrollArea>
      </ProductDialog>
    </div>
  )
}
