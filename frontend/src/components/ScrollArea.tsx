import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, type CSSProperties, type ReactNode } from 'react'
import { OverlayScrollbarsComponent, type OverlayScrollbarsComponentRef } from 'overlayscrollbars-react'
import { useTheme } from '../state/AppContext'

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
  const { isDark } = useTheme()
  const scrollRef = useRef<OverlayScrollbarsComponentRef | null>(null)
  const position = useRef({ top: 0, left: 0 })
  const active = useRef(true)

  useLayoutEffect(() => {
    active.current = true
    const viewport = scrollRef.current?.osInstance()?.elements().viewport
    if (viewport) { viewport.scrollTop = position.current.top; viewport.scrollLeft = position.current.left }
    return () => { active.current = false }
  }, [])

  useImperativeHandle(ref, () => ({
    scrollToBottom() {
      requestAnimationFrame(() => {
        if (!active.current) return
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
      events={{
        initialized(instance) {
          const viewport = instance.elements().viewport
          viewport.scrollTop = position.current.top
          viewport.scrollLeft = position.current.left
        },
        scroll(instance) {
          if (!active.current) return
          const viewport = instance.elements().viewport
          position.current = { top: viewport.scrollTop, left: viewport.scrollLeft }
        },
      }}
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
