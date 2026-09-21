import { forwardRef, useImperativeHandle, useRef, type CSSProperties, type ReactNode } from 'react'
import { OverlayScrollbarsComponent, type OverlayScrollbarsComponentRef } from 'overlayscrollbars-react'
import { useApp } from '../state/AppContext'

export interface ScrollAreaRef {
  scrollToBottom: () => void
  isAtBottom: () => boolean
}

interface ScrollAreaProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  height?: string
  maxHeight?: string
  horizontal?: boolean
}

export const ScrollArea = forwardRef<ScrollAreaRef, ScrollAreaProps>(function ScrollArea({
  children,
  className = '',
  style,
  height,
  maxHeight,
  horizontal = false,
}, ref) {
  const { isDark } = useApp()
  const scrollRef = useRef<OverlayScrollbarsComponentRef | null>(null)

  useImperativeHandle(ref, () => ({
    scrollToBottom() {
      requestAnimationFrame(() => {
        const instance = scrollRef.current?.osInstance()
        const viewport = instance?.elements().viewport
        if (viewport) viewport.scrollTop = viewport.scrollHeight
      })
    },
    isAtBottom() {
      const instance = scrollRef.current?.osInstance()
      const viewport = instance?.elements().viewport
      return viewport ? viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= 50 : true
    },
  }), [])

  const sizeStyle: CSSProperties = {
    ...style,
    ...(height && { height }),
    ...(maxHeight && { maxHeight }),
  }

  return (
    <OverlayScrollbarsComponent
      ref={scrollRef}
      className={`winbox-scroll-area ${className}`}
      style={sizeStyle}
      options={{
        scrollbars: { autoHide: 'scroll', autoHideDelay: 800, theme: isDark ? 'os-theme-dark' : 'os-theme-light' },
        overflow: { x: horizontal ? 'scroll' : 'hidden', y: 'scroll' },
      }}
      defer
    >
      {children}
    </OverlayScrollbarsComponent>
  )
})
