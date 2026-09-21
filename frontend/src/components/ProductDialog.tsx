import { Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, DialogTrigger, Button } from '@fluentui/react-components'
import { Dismiss24Regular } from '@fluentui/react-icons'
import { useLayoutEffect, useRef, type ReactNode } from 'react'

interface ProductDialogProps {
  open: boolean
  title?: string
  onOpenChange: (open: boolean) => void
  children: ReactNode
  footer?: ReactNode
  width?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

export function ProductDialog({ open, title, onOpenChange, children, footer, width = 'md', className = '' }: ProductDialogProps) {
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const wasOpenRef = useRef(false)
  const restoreTimerRef = useRef<number | null>(null)

  useLayoutEffect(() => {
    if (open) {
      if (restoreTimerRef.current !== null) {
        window.clearTimeout(restoreTimerRef.current)
        restoreTimerRef.current = null
      }
      if (!wasOpenRef.current) {
        const activeElement = document.activeElement
        restoreFocusRef.current = activeElement instanceof HTMLElement && activeElement !== document.body ? activeElement : null
      }
      wasOpenRef.current = true
      return
    }

    if (!wasOpenRef.current) return
    const restoreTarget = restoreFocusRef.current
    restoreFocusRef.current = null
    wasOpenRef.current = false
    if (restoreTarget?.isConnected) {
      restoreTimerRef.current = window.setTimeout(() => {
        restoreTimerRef.current = null
        if (restoreTarget.isConnected && document.activeElement !== restoreTarget) restoreTarget.focus({ preventScroll: true })
      }, 300)
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={(_, data) => onOpenChange(data.open)} modalType="modal">
      <DialogSurface className={`product-dialog product-dialog-${width} ${className}`}>
        <DialogBody className="product-dialog-body">
          <DialogTitle
            className="product-dialog-title"
            action={(
              <DialogTrigger action="close">
                <Button appearance="subtle" className="winbox-subtle-button winbox-dialog-close" icon={<Dismiss24Regular />} aria-label="Close" />
              </DialogTrigger>
            )}
          >
            {title || ''}
          </DialogTitle>
          <DialogContent className="product-dialog-content">{children}</DialogContent>
          {footer ? <DialogActions className="product-dialog-footer">{footer}</DialogActions> : null}
        </DialogBody>
      </DialogSurface>
    </Dialog>
  )
}
