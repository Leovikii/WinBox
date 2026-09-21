import { useEffect, useRef } from 'react'
import { Button, Field, Input, MessageBar, MessageBarBody, Spinner } from '@fluentui/react-components'
import { Add24Regular, Delete24Regular } from '@fluentui/react-icons'
import { useApp } from '../state/AppContext'
import { ProductDialog } from './ProductDialog'
import { ScrollArea } from './ScrollArea'

export function ManageProfilesDialog() {
  const app = useApp()
  const lastInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (app.showManageProfilesModal) lastInputRef.current?.focus()
  }, [app.manageProfilesList.length, app.showManageProfilesModal])

  return (
    <ProductDialog
      open={app.showManageProfilesModal}
      title="Manage Profiles"
      onOpenChange={app.setShowManageProfilesModal}
      footer={(
        <div className="manage-dialog-footer">
          <Button appearance="subtle" className="winbox-subtle-button" icon={<Add24Regular />} onClick={app.addNewDraftProfile}>Add Profile</Button>
          <div className="dialog-actions-right">
            <Button appearance="secondary" className="winbox-secondary-button winbox-dialog-button" onClick={() => app.setShowManageProfilesModal(false)} disabled={app.isSavingProfiles}>Cancel</Button>
            <Button appearance="primary" className="winbox-primary-button winbox-dialog-button" onClick={() => void app.saveManageProfiles()} disabled={!app.isManageProfilesChanged || app.isSavingProfiles} icon={app.isSavingProfiles ? <Spinner size="tiny" /> : undefined}>Save</Button>
          </div>
        </div>
      )}
    >
      {app.manageProfilesError ? (
        <MessageBar intent="error" layout="multiline" className="product-message-bar">
          <MessageBarBody>{app.manageProfilesError}</MessageBarBody>
        </MessageBar>
      ) : null}
      <ScrollArea maxHeight="40vh" className="profile-list-scroll">
        <div className="profile-edit-list">
          {app.manageProfilesList.length === 0 ? <p className="empty-copy">No profiles found</p> : null}
          {app.manageProfilesList.map((profile, index) => (
            <div key={profile.id} className="profile-edit-row">
              <div className="profile-edit-fields">
                <Field label="Name" required>
                  <Input
                    ref={index === app.manageProfilesList.length - 1 ? lastInputRef : undefined}
                    value={profile.name}
                    placeholder="Profile Name"
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
              <Button appearance="subtle" className="winbox-subtle-button winbox-icon-button danger-icon-button" icon={<Delete24Regular />} aria-label={`Delete ${profile.name || 'profile'}`} onClick={() => app.removeProfileFromManageList(profile.id)} />
            </div>
          ))}
        </div>
      </ScrollArea>
    </ProductDialog>
  )
}
