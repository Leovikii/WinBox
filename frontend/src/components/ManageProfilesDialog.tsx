import { useEffect, useRef } from 'react'
import { Button, Field, Input, MessageBar, MessageBarBody, Spinner, PresenceGroup } from '@fluentui/react-components'
import { Add16Regular, Delete16Regular } from '@fluentui/react-icons'
import { useApp } from '../state/AppContext'
import { ProductDialog } from './ProductDialog'
import { ScrollArea } from './ScrollArea'
import { ExpandMotion } from './motion'

export function ManageProfilesDialog() {
  const app = useApp()
  const lastInputRef = useRef<HTMLInputElement>(null)
  const previousCount = useRef(0)
  const addButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (app.showManageProfilesModal && app.manageProfilesList.length > previousCount.current) lastInputRef.current?.focus()
    previousCount.current = app.showManageProfilesModal ? app.manageProfilesList.length : 0
  }, [app.manageProfilesList.length, app.showManageProfilesModal])

  return (
    <ProductDialog
      open={app.showManageProfilesModal}
      title="Manage profiles"
      onOpenChange={app.setShowManageProfilesModal}
      footer={(
        <div className="manage-dialog-footer">
          <Button ref={addButtonRef} appearance="subtle" className="winbox-subtle-button" icon={<Add16Regular />} onClick={app.addNewDraftProfile}>Add profile</Button>
          <div className="dialog-actions-right">
            <Button appearance="secondary" className="winbox-secondary-button winbox-dialog-button" onClick={() => app.setShowManageProfilesModal(false)} disabled={app.isSavingProfiles}>Cancel</Button>
            <Button appearance="primary" className="winbox-primary-button winbox-dialog-button" onClick={() => void app.saveManageProfiles()} disabled={!app.isManageProfilesChanged || app.isSavingProfiles} icon={app.isSavingProfiles ? <Spinner size="tiny" /> : undefined}>Save</Button>
          </div>
        </div>
      )}
    >
      <ExpandMotion visible={!!app.manageProfilesError} unmountOnExit>
        <div className="expand-content"><MessageBar intent="error" layout="multiline" className="product-message-bar">
          <MessageBarBody>{app.manageProfilesError}</MessageBarBody>
        </MessageBar></div>
      </ExpandMotion>
      <ScrollArea maxHeight="40vh" className="profile-list-scroll">
        <div className="profile-edit-list">
          {app.manageProfilesList.length === 0 ? <p className="empty-copy">No profiles found</p> : null}
          <PresenceGroup>{app.manageProfilesList.map((profile, index) => (
            <ExpandMotion key={profile.id}
              onMotionStart={(_, data) => {
                const row = document.getElementById(`profile-draft-${profile.id}`)
                if (row) row.inert = data.direction === 'exit'
              }}>
            <div id={`profile-draft-${profile.id}`} className="profile-presence"><div className="profile-edit-row">
              <div className="profile-edit-fields">
                <Field label="Name" required>
                  <Input
                    ref={index === app.manageProfilesList.length - 1 ? lastInputRef : undefined}
                    value={profile.name}
                    placeholder="Profile name"
                    onChange={(_, data) => {
                      const next = [...app.manageProfilesList]
                      next[index] = { ...next[index], name: data.value }
                      app.setManageProfilesList(next)
                      app.setManageProfilesError('')
                    }}
                  />
                </Field>
                <Field label="Subscription URL" required>
                  <Input
                    value={profile.url}
                    placeholder="https://..."
                    type="url"
                    onChange={(_, data) => {
                      const next = [...app.manageProfilesList]
                      next[index] = { ...next[index], url: data.value }
                      app.setManageProfilesList(next)
                    }}
                  />
                </Field>
              </div>
              <Button appearance="subtle" className="winbox-subtle-button winbox-icon-button danger-icon-button" icon={<Delete16Regular />} aria-label={`Delete ${profile.name || 'profile'}`} onClick={(event) => {
                const row = event.currentTarget.closest('.profile-presence')
                const neighbor = row?.nextElementSibling || row?.previousElementSibling
                const target = neighbor?.querySelector('input') || addButtonRef.current
                target?.focus({ preventScroll: true })
                app.removeProfileFromManageList(profile.id)
              }} />
            </div></div>
            </ExpandMotion>
          ))}</PresenceGroup>
        </div>
      </ScrollArea>
    </ProductDialog>
  )
}
