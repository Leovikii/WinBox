import { Dialog, DialogActions, DialogBody, DialogContent, DialogSurface, DialogTitle, DialogTrigger, Button } from '@fluentui/react-components'
import { Dismiss16Regular } from '@fluentui/react-icons'
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

  useLayoutEffect(() => {
    if (open) {
      if (!wasOpenRef.current) {
        const activeElement = document.activeElement
        restoreFocusRef.current = activeElement instanceof HTMLElement && activeElement !== document.body ? activeElement : null
      }
      wasOpenRef.current = true
      return
    }

    wasOpenRef.current = false
  }, [open])

  return (
    <Dialog surfaceMotion={{
      duration: 250, exitDuration: 167, outScale: .95,
      easing: 'cubic-bezier(0,0,0,1)', exitEasing: 'cubic-bezier(1,0,1,1)',
      onMotionFinish: (_, data) => {
        if (data.direction === 'exit' && !open) {
          const target = restoreFocusRef.current
          restoreFocusRef.current = null
          if (target?.isConnected && !target.closest('[inert]')) target.focus({ preventScroll: true })
        }
      },
    }} open={open} onOpenChange={(_, data) => onOpenChange(data.open)} modalType="modal">
      <DialogSurface backdropMotion={{ duration: 83, exitDuration: 83 }} className={`product-dialog product-dialog-${width} ${className}`}>
        <DialogBody className="product-dialog-body">
          <DialogTitle
            className="product-dialog-title"
            action={{ className: 'product-dialog-title-action', children: (
              <DialogTrigger action="close">
                <Button appearance="subtle" className="winbox-subtle-button winbox-dialog-close" icon={<Dismiss16Regular />} aria-label="Close" />
              </DialogTrigger>
            ) }}
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
