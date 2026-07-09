# Studio Shell - UI Components List

## 📊 Component Inventory

### Main Feature Components

| Component | Location | Description | CSS Module |
|-----------|----------|-------------|------------|
| **Assets** | `src/components/Assets/Assets.tsx` | Asset browser panel with grid/list view of project assets | ✅ |
| **Console** | `src/components/Console/Console.tsx` | Console panel for logs, warnings, and errors | ✅ |
| **Hierarchy** | `src/components/Hierarchy/Hierarchy.tsx` | Scene hierarchy tree view for game objects | ✅ |
| **Inspector** | `src/components/Inspector/Inspector.tsx` | Properties inspector for selected objects | ✅ |
| **Toolbar** | `src/components/Toolbar/Toolbar.tsx` | Main toolbar with editor actions | ✅ |
| **Viewport** | `src/components/Viewport/Viewport.tsx` | 2D/3D scene viewport | ✅ |
| **Viewport3D** | `src/components/Viewport/Viewport3D.tsx` | 3D rendering viewport using Three.js | ✅ |

---

### Shared/Reusable UI Components

| Component | Location | Description | Props/Features | CSS Module |
|-----------|----------|-------------|----------------|------------|
| **Panel** | `src/components/shared/Panel.tsx` | Base panel container with title and actions | `title`, `icon`, `children`, `actions`, `className` | ✅ |
| **PanelHeader** | `src/components/shared/Panel.tsx` | Panel header component (exported from Panel) | `title`, `icon`, `actions` | ✅ |
| **IconButton** | `src/components/shared/IconButton.tsx` | Icon-based button with variants | `icon`, `active`, `size`, `variant`, `tooltip` | ✅ |
| **ContextMenu** | `src/components/shared/ContextMenu.tsx` | Right-click context menu | `items`, `isOpen`, `position`, `onClose` | ✅ |
| **MenuDropdown** | `src/components/shared/MenuDropdown.tsx` | Dropdown menu with items | `items`, `isOpen`, `onClose` | ✅ |
| **DockablePanel** | `src/components/shared/DockablePanel.tsx` | Panel with docking capabilities | Drag & drop docking support | ✅ |
| **DockLayout** | `src/components/shared/DockLayout.tsx` | Layout system for dockable panels | Manages panel arrangements | ✅ |
| **DockingIndicator** | `src/components/shared/DockingIndicator.tsx` | Visual indicator for docking zones | Shows where panels can dock | ✅ |
| **DockZoneRenderer** | `src/components/shared/DockZoneRenderer.tsx` | Renders docking drop zones | Visual feedback for docking | ❌ |
| **TabbedPanel** | `src/components/shared/TabbedPanel.tsx` | Panel with tab support | Multi-tab interface | ✅ |
| **TabHeader** | `src/components/shared/TabHeader.tsx` | Tab header for tabbed panels | Tab navigation | ✅ |
| **PropertiesLabel** | `src/components/shared/PropertiesLabel.tsx` | Label for property fields | Consistent property styling | ✅ |
| **ExpandIcons** | `src/components/shared/ExpandIcons.tsx` | Expand/collapse icon components | Tree view indicators | ❌ |

---

### Assets Sub-Components

| Component | Location | Description | Purpose | CSS Module |
|-----------|----------|-------------|---------|------------|
| **AssetSidebar** | `src/components/Assets/AssetSidebar.tsx` | Sidebar for asset navigation | Folder tree navigation | ❌ |
| **AssetTile** | `src/components/Assets/AssetTile.tsx` | Individual asset tile | Display single asset | ❌ |
| **AssetToolbar** | `src/components/Assets/AssetToolbar.tsx` | Toolbar for asset operations | Search, filter, view controls | ❌ |
| **ModelPreview** | `src/components/Assets/ModelPreview.tsx` | 3D model preview | Preview 3D models | ❌ |
| **MoveDialog** | `src/components/Assets/MoveDialog.tsx` | Dialog for moving assets | Asset organization | ✅ |

---

### Inspector Sub-Components

| Component | Location | Description | Purpose | CSS Module |
|-----------|----------|-------------|---------|------------|
| **ModelPreview** | `src/components/Inspector/ModelPreview.tsx` | 3D model preview in inspector | Preview selected model | ❌ |
| **TexturePreview** | `src/components/Inspector/TexturePreview.tsx` | Texture preview in inspector | Preview selected texture | ❌ |

---

## 🎨 Component Categories

### Layout & Structure (7 components)
- Panel
- PanelHeader
- DockablePanel
- DockLayout
- DockingIndicator
- DockZoneRenderer
- TabbedPanel

### Interactive Controls (4 components)
- IconButton
- ContextMenu
- MenuDropdown
- TabHeader

### Feature Panels (7 components)
- Assets
- Console
- Hierarchy
- Inspector
- Toolbar
- Viewport
- Viewport3D

### Supporting Components (8 components)
- AssetSidebar
- AssetTile
- AssetToolbar
- MoveDialog
- ModelPreview (Assets)
- ModelPreview (Inspector)
- TexturePreview
- PropertiesLabel
- ExpandIcons

---

## 📈 Statistics

| Category | Count |
|----------|-------|
| **Total Components** | 26 |
| **Main Feature Components** | 7 |
| **Shared/Reusable Components** | 12 |
| **Sub-Components** | 7 |
| **Components with CSS Modules** | 19 |
| **Components without CSS Modules** | 7 |

---

## 🔧 Component Patterns

### IconButton Variants
- **Sizes**: `xs`, `sm`, `md`, `lg`
- **Variants**: `default`, `ghost`, `accent`
- **States**: `active`, `disabled`

### Panel Types
- **Base Panel**: Standard panel with title and content
- **Dockable Panel**: Panel that can be docked/undocked
- **Tabbed Panel**: Panel with multiple tabs

### Menu Components
- **MenuDropdown**: General purpose dropdown menu
- **ContextMenu**: Right-click/Ctrl+click context menu with `useContextMenu` hook

---

## 🎯 Design System

### Color Palette (CSS Variables)
- Background: `--bg-darkest`, `--bg-dark`, `--bg-panel`, `--bg-surface`
- Accent Primary: `--accent-primary` (#e67e22 - Amber/Copper)
- Accent Secondary: `--accent-secondary` (#00d4aa - Teal)
- Text: `--text-primary`, `--text-secondary`, `--text-muted`
- Semantic: `--color-success`, `--color-warning`, `--color-error`, `--color-info`

### Icon System
- **Library**: Lucide React
- **Typical Sizes**: 12px, 16px, 20px, 24px
- **Colored using CSS variables**

---

## 📁 File Structure

```
src/components/
├── Assets/           # Asset browser and related components
├── Console/          # Console panel
├── Hierarchy/        # Scene hierarchy tree
├── Inspector/        # Properties inspector
├── Toolbar/          # Main toolbar
├── Viewport/         # Scene viewport (2D/3D)
└── shared/           # Reusable UI components
    ├── Layout components (Panel, DockLayout, etc.)
    ├── Interactive components (IconButton, ContextMenu, etc.)
    └── Utility components (PropertiesLabel, ExpandIcons, etc.)
```

---

## 🔄 State Management

### Zustand Stores
- `editorStore.ts` - Main editor state
- `assetStore.ts` - Asset management
- `dockingStore.ts` - Panel docking state
- `selectionStore.ts` - Object selection
- `widgetMetadataStore.ts` - Widget metadata

### Custom Hooks
- `useDragAndDrop.ts` - Drag and drop functionality
- `useContextMenu` - Context menu state (exported from ContextMenu.tsx)

---

## 🚀 Usage Examples

### Creating a New Panel
```typescript
import { Panel } from '../shared/Panel'
import { IconButton } from '../shared/IconButton'
import { Icon } from 'lucide-react'

export function MyPanel() {
  return (
    <Panel
      title="My Panel"
      icon={<Icon size={16} />}
      actions={<IconButton icon={<Icon />} />}
    >
      {/* Content */}
    </Panel>
  )
}
```

### Using IconButton
```typescript
import { IconButton } from '../shared/IconButton'
import { Play, Pause } from 'lucide-react'

<IconButton 
  icon={<Play size={16} />}
  variant="accent"
  size="md"
  active={isPlaying}
  tooltip="Play"
  onClick={handlePlay}
/>
```

### Using ContextMenu
```typescript
import { ContextMenu, useContextMenu } from '../shared/ContextMenu'

function MyComponent() {
  const contextMenu = useContextMenu()
  
  const menuItems = [
    { label: 'Copy', onClick: () => {}, shortcut: '⌘C' },
    { label: 'Paste', onClick: () => {}, shortcut: '⌘V' },
    { divider: true },
    { label: 'Delete', onClick: () => {}, shortcut: 'Del' },
  ]

  return (
    <>
      <div onContextMenu={contextMenu.openContextMenu}>
        Right-click me!
      </div>
      <ContextMenu
        items={menuItems}
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        onClose={contextMenu.closeContextMenu}
      />
    </>
  )
}
```

---

## 📝 Notes

- All components follow CSS Modules convention for styling
- Components use TypeScript with strict typing
- Lucide React is the standard icon library
- The design follows a forge-inspired aesthetic with amber/copper accents
- Most components are functional components using React hooks
- State management primarily uses Zustand
- File naming: PascalCase for components, camelCase for utilities
