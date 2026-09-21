# WinBox UI components

Vue 3 components used by the current Tauri frontend. Public exports are maintained in [index.ts](index.ts); shared variants and sizes are in [types.ts](types.ts). Component props, emitted events and slots are defined in each `.vue` file.

```typescript
import { WButton, WSwitch, WCard, WInput } from '@/components/ui'
```

Current exports:

- Actions and input: `WButton`, `WInput`, `WSelect`, `WSwitch`, `WTextarea`, `WSegmentedControl`.
- Containers and feedback: `WCard`, `WModal`, `WInfoBar`, `WExpandable`, `WScrollArea`.
- Traffic display: `WSpeedChart`.

```vue
<WButton variant="primary" :loading="saving">SAVE</WButton>
<WSwitch v-model="enabled" />
<WInput v-model="name" placeholder="Profile Name" />
<WCard variant="mica" padding="lg">Content</WCard>
```

The former `WIconButton` and `WListItem` examples have been removed because those components are not exported. Do not add replacements merely to match old documentation. Colors, radii and transitions follow the existing component implementations and styles; they are not uniformly one fixed value.

Before refactoring, follow the [frontend preparation guide](../../../../docs/frontend-refactor/README.md) and preserve the released application's appearance and interactions.
