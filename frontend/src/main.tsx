import { StrictMode, useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import { FluentProvider } from '@fluentui/react-components'
import { createWinBoxTheme } from './theme'
import App from './App'
import { AppProvider, useTheme } from './state/AppContext'
import './index.css'

function WinBoxRoot() {
  const { isDark, accentColor } = useTheme()
  const theme = useMemo(() => createWinBoxTheme(accentColor, isDark), [accentColor, isDark])

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
