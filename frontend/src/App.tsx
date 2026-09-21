import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Checkbox, Spinner } from '@fluentui/react-components'
import { ArrowLeft24Regular, Dismiss24Regular, Settings24Regular, Subtract16Regular } from '@fluentui/react-icons'
import { marked } from 'marked'
import * as Backend from './api/backend'
import { useApp } from './state/AppContext'
import Dashboard from './components/Dashboard'
import { ProductDialog } from './components/ProductDialog'
import TrayIconUrl from './assets/icon-builder/src/tray.svg'

const SettingsPage = lazy(() => import('./components/SettingsPage'))

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character)
}

function renderChangelog(value: string) {
  const renderer = new marked.Renderer()
  renderer.html = ({ text }) => escapeHtml(text)
  return marked.parse(value, { renderer }) as string
}

export default function App() {
  const app = useApp()
  const [showSettings, setShowSettings] = useState(false)
  const [showQuitConfirm, setShowQuitConfirm] = useState(false)
  const [showUwpModal, setShowUwpModal] = useState(false)
  const [showChangelogModal, setShowChangelogModal] = useState(false)
  const [rememberCloseChoice, setRememberCloseChoice] = useState(false)
  const updateCheckStarted = useRef(false)

  const reportBackendError = (error: unknown) => {
    app.setErrorAlert(error instanceof Error ? error.message : String(error))
  }

  useEffect(() => {
    if (app.initialized && !updateCheckStarted.current) {
      updateCheckStarted.current = true
      void app.checkProgramUpdate()
    }
  }, [app.checkProgramUpdate, app.initialized])

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

  const changelog = useMemo(() => renderChangelog(app.programChangelog), [app.programChangelog])

  const switchMode = async (target: { tunMode: boolean; sysProxy: boolean }) => {
    const result = await app.handleSwitchMode(target)
    if (result?.error === 'kernel-missing' || result?.error === 'config-missing') setShowSettings(true)
  }

  return (
    <div className="winbox-shell">
      <header className="winbox-titlebar">
        <div data-tauri-drag-region className="winbox-drag-region">
          <img src={TrayIconUrl} className="winbox-logo" alt="WinBox" />
          <span>WinBox</span>
        </div>
        <div className="winbox-window-actions">
          <Button
            appearance="subtle"
            icon={showSettings ? <ArrowLeft24Regular /> : <Settings24Regular />}
            aria-label={showSettings ? 'Back to Home' : 'Settings'}
            title={showSettings ? 'Back to Home' : 'Settings'}
            onClick={() => setShowSettings((open) => !open)}
            className="winbox-window-button winbox-caption-button"
          >
            {app.programUpdateState === 'available' ? <span className="update-dot" aria-label="Update available" /> : null}
          </Button>
          <Button appearance="subtle" icon={<Subtract16Regular />} aria-label="Minimize" title="Minimize" onClick={() => void Backend.Minimize().catch(reportBackendError)} className="winbox-window-button winbox-caption-button" />
          <Button appearance="subtle" icon={<Dismiss24Regular />} aria-label="Close" title="Close" onClick={requestQuit} className="winbox-window-button winbox-caption-button winbox-close-button" />
        </div>
      </header>

      <main className="winbox-page-frame">
        <div className={`winbox-page ${showSettings ? 'winbox-page-settings' : 'winbox-page-dashboard'}`}>
          {showSettings ? (
            <Suspense fallback={<div className="page-loading"><Spinner size="tiny" label="Loading settings…" /></div>}>
              <SettingsPage
                onClose={() => setShowSettings(false)}
                showUwpModal={showUwpModal}
                onOpenUwp={() => { setShowUwpModal(true); void app.loadUwpApps() }}
                onCloseUwp={() => setShowUwpModal(false)}
                onOpenChangelog={() => setShowChangelogModal(true)}
              />
            </Suspense>
          ) : (
            <Dashboard onSwitchMode={switchMode} onRestartCore={() => void app.handleRestartCore()} onOpenSettings={() => setShowSettings(true)} />
          )}
        </div>
      </main>

      <ProductDialog
        open={showQuitConfirm}
        title="Exit options"
        onOpenChange={setShowQuitConfirm}
        width="md"
        footer={(
          <div className="dialog-actions-stretch">
            <Button appearance="secondary" className="winbox-secondary-button winbox-dialog-button" onClick={() => void confirmMinimize()}>Minimize</Button>
            <Button appearance="primary" className="winbox-danger-button winbox-dialog-button" onClick={() => void confirmQuit()}>Quit</Button>
          </div>
        )}
      >
        <p>Do you want to minimize to the system tray or quit the application?</p>
        <Checkbox
          checked={rememberCloseChoice}
          onChange={(_, data) => setRememberCloseChoice(Boolean(data.checked))}
          label="Remember my choice and don't ask again"
        />
      </ProductDialog>

      <ProductDialog
        open={showChangelogModal}
        title={`What's new in ${app.programRemoteVer}`}
        onOpenChange={setShowChangelogModal}
        width="md"
        footer={(
          <div className="dialog-actions-stretch">
            <Button appearance="secondary" className="winbox-secondary-button winbox-dialog-button" onClick={() => setShowChangelogModal(false)}>Later</Button>
            <Button appearance="primary" className="winbox-primary-button winbox-dialog-button" onClick={() => { setShowChangelogModal(false); setShowSettings(true); void app.performProgramUpdate() }}>
              Update now
            </Button>
          </div>
        )}
      >
        {app.programUpdateState === 'updating' ? <Spinner label="Updating…" /> : <div className="markdown-body" dangerouslySetInnerHTML={{ __html: changelog }} />}
      </ProductDialog>
    </div>
  )
}
