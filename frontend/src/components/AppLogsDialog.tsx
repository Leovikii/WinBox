import { useEffect, useRef } from 'react'
import { Button } from '@fluentui/react-components'
import { useLogs } from '../state/AppContext'
import { ProductDialog } from './ProductDialog'
import { ScrollArea, type ScrollAreaRef } from './ScrollArea'

export function AppLogsDialog() {
  const live = useLogs()
  const scrollRef = useRef<ScrollAreaRef>(null)

  useEffect(() => {
    if (!live.showLogModal || !scrollRef.current) return
    if (scrollRef.current.isAtBottom()) scrollRef.current.scrollToBottom()
  }, [live.appLogContent, live.showLogModal])

  return (
    <ProductDialog
      open={live.showLogModal}
      title="App logs"
      onOpenChange={live.setShowLogModal}
      footer={(
        <div className="dialog-actions-right">
          <Button appearance="secondary" className="winbox-secondary-button winbox-dialog-button" onClick={() => void live.clearAppLog()}>Clear</Button>
          <Button appearance="primary" className="winbox-primary-button winbox-dialog-button" onClick={() => void live.copyAppLog()}>{live.copyState === 'COPIED!' ? 'Copied!' : 'Copy'}</Button>
        </div>
      )}
    >
      <div className="full-log-frame">
        <ScrollArea ref={scrollRef} height="100%">
          <div className="full-log-content">{live.appLogContent || 'No logs available.'}</div>
        </ScrollArea>
      </div>
    </ProductDialog>
  )
}
