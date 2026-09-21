import { StrictMode, useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import { FluentProvider, webDarkTheme, webLightTheme, type Theme } from '@fluentui/react-components'
import App from './App'
import { AppProvider, useApp } from './state/AppContext'
import './index.css'

function WinBoxRoot() {
  const { isDark, accentColor } = useApp()
  const theme = useMemo<Theme>(() => ({
    ...(isDark ? webDarkTheme : webLightTheme),
    colorBrandBackground: accentColor,
    colorBrandBackgroundHover: accentColor,
    colorBrandBackgroundPressed: accentColor,
    colorBrandBackgroundSelected: accentColor,
    colorBrandForeground1: accentColor,
    colorCompoundBrandBackground: accentColor,
    colorCompoundBrandBackgroundHover: accentColor,
    colorCompoundBrandBackgroundPressed: accentColor,
    colorBrandStroke1: accentColor,
    colorCompoundBrandStroke: accentColor,
    colorStrokeFocus2: accentColor,
  }), [accentColor, isDark])

  return (
    <FluentProvider theme={theme} className="winbox-provider">
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
