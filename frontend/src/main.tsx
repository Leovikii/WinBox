import { StrictMode, useEffect, useLayoutEffect, useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import { FluentProvider } from '@fluentui/react-components'
import { createWinBoxTheme } from './theme'
import App from './App'
import { AppProvider, useTheme } from './state/AppContext'
import './index.css'
import { FrontendReady } from './api/backend'

function WinBoxRoot() {
  const { isDark, accentColor } = useTheme()
  const theme = useMemo(() => createWinBoxTheme(accentColor, isDark), [accentColor, isDark])
  useLayoutEffect(() => {
    // The themed UI now owns the surface; reveal native Mica without a timer.
    document.documentElement.dataset.uiReady = 'true'
  }, [])
  useEffect(() => {
    // Hidden WebViews may suspend animation frames. Commit readiness must not wait for rAF.
    void FrontendReady().catch(error => console.error('Could not signal frontend readiness', error))
  }, [])

  return (
    <FluentProvider theme={theme} className="winbox-provider" style={{ background: 'transparent' }}>
      <App />
    </FluentProvider>
  )
}

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <AppProvider>
      <WinBoxRoot />
    </AppProvider>
  </StrictMode>,
)
