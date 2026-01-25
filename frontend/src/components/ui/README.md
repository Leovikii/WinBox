# WinBox UI Component Library

## Overview

WinBox UI is a Vue 3 component library designed for WinBox v2.1, featuring Windows 11 design language with Mica material effects and a unified design system.

## Installation

Import components in any Vue component:

```typescript
import { WButton, WIconButton, WSwitch, WCard, WInput } from '@/components/ui'
```

## Components

### 1. WButton - Button Component

**Variants:**
- `primary` - Blue primary action button (with glow)
- `secondary` - Gray secondary button (default)
- `danger` - Red danger action button (with glow)
- `success` - Green success state button
- `warning` - Yellow warning button
- `ghost` - Transparent border button
- `link` - Blue text button

**Sizes:**
- `sm` - Small (h-7)
- `md` - Medium (h-9, default)
- `lg` - Large (h-12)

**Usage:**
```vue
<WButton variant="primary" size="lg">DASHBOARD</WButton>
<WButton variant="danger" icon="fas fa-trash">DELETE</WButton>
<WButton variant="secondary" :loading="true">LOADING</WButton>
```

### 2. WIconButton - Icon Button

**Variants:**
- `default` - Default gray
- `danger` - Danger red
- `primary` - Primary blue
- `warning` - Warning yellow

**Usage:**
```vue
<WIconButton icon="fas fa-cog" @click="openSettings" />
<WIconButton icon="fas fa-trash" variant="danger" size="sm" />
```

### 3. WSwitch - Toggle Switch

**Colors:**
- `blue` - Blue (default)
- `purple` - Purple
- `green` - Green

**Usage:**
```vue
<WSwitch v-model="tunMode" color="blue" />
<WSwitch v-model="sysProxy" color="purple" />
```

### 4. WCard - Card Container

**Variants:**
- `default` - Default dark card
- `mica` - Mica material card (with blur effect)
- `list-item` - List item card (supports active state)

**Usage:**
```vue
<WCard variant="mica" padding="lg">
  <div>Content</div>
</WCard>
```

### 5. WInput - Input Field

**Usage:**
```vue
<WInput v-model="name" placeholder="Profile Name" />
<WInput v-model="url" type="url" mono placeholder="URL" />
```

### 6. WTextarea - Text Area

**Usage:**
```vue
<WTextarea v-model="content" mono :resize="false" />
```

### 7. WSelect - Dropdown Select

**Usage:**
```vue
<WSelect 
  v-model="mode"
  :options="[
    { value: 'full', label: 'FULL' },
    { value: 'tun', label: 'TUN' }
  ]"
/>
```

### 8. WModal - Modal Dialog

**Usage:**
```vue
<WModal v-model="showModal" title="NEW CONFIG" width="md">
  <WInput v-model="name" placeholder="Name" />
  <template #footer>
    <WButton variant="primary">SAVE</WButton>
  </template>
</WModal>
```

### 9. WListItem - List Item

**Usage:**
```vue
<WListItem :title="profile.name" :subtitle="profile.url" :active="isActive">
  <template #actions>
    <WIconButton icon="fas fa-pen" size="sm" />
  </template>
</WListItem>
```

## Design System

All components follow a unified design system:
- Border radius: `rounded-xl` (12px)
- Transition duration: 200ms (fast), 300ms (medium), 500ms (slow)
- Glow effects: Unified rgba values for blue, purple, and red
- Consistent styling and animations across all elements
