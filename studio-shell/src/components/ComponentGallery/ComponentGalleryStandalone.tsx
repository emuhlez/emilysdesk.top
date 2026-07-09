import { useState, ReactNode } from 'react'
import { IconButton } from '../shared/IconButton'
import { PropertiesLabel } from '../shared/PropertiesLabel'
import { MenuDropdown } from '../shared/MenuDropdown'
import { TabbedPanel } from '../shared/TabbedPanel'
import { TabHeader } from '../shared/TabHeader'
import { 
  Package, 
  Search, 
  ChevronRight,
  ChevronDown,
  Play,
  Pause,
  Settings,
  Download,
  Upload,
  Trash,
  Copy,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Star,
  Heart
} from 'lucide-react'
import styles from './ComponentGallery.module.css'

interface ComponentExample {
  name: string
  description: string
  category: string
  preview: ReactNode
  variants?: { name: string; preview: ReactNode }[]
  location: string
}

const componentExamples: ComponentExample[] = [
  // IconButton Examples
  {
    name: 'IconButton',
    description: 'Versatile icon button with multiple sizes and variants',
    category: 'Buttons',
    location: 'src/components/shared/IconButton.tsx',
    preview: (
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <IconButton icon={<Play size={16} />} tooltip="Play" />
        <IconButton icon={<Pause size={16} />} active tooltip="Pause (Active)" />
        <IconButton icon={<Settings size={16} />} variant="ghost" tooltip="Settings (Ghost)" />
      </div>
    ),
    variants: [
      {
        name: 'Sizes',
        preview: (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <IconButton icon={<Star size={12} />} size="xs" tooltip="Extra Small" />
            <IconButton icon={<Star size={14} />} size="sm" tooltip="Small" />
            <IconButton icon={<Star size={16} />} size="md" tooltip="Medium" />
            <IconButton icon={<Star size={18} />} size="lg" tooltip="Large" />
          </div>
        )
      },
      {
        name: 'Variants',
        preview: (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <IconButton icon={<Heart size={16} />} variant="default" tooltip="Default" />
            <IconButton icon={<Heart size={16} />} variant="ghost" tooltip="Ghost" />
            <IconButton icon={<Heart size={16} />} variant="accent" tooltip="Accent" />
          </div>
        )
      },
      {
        name: 'States',
        preview: (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <IconButton icon={<Eye size={16} />} tooltip="Normal" />
            <IconButton icon={<Eye size={16} />} active tooltip="Active" />
            <IconButton icon={<EyeOff size={16} />} disabled tooltip="Disabled" />
          </div>
        )
      },
    ]
  },
  
  // PropertiesLabel Examples
  {
    name: 'PropertiesLabel',
    description: 'Read-only display field for property values',
    category: 'Forms',
    location: 'src/components/shared/PropertiesLabel.tsx',
    preview: (
      <div style={{ width: '250px' }}>
        <PropertiesLabel value="Position: (0, 0, 0)" />
      </div>
    ),
  },

  // MenuDropdown Examples
  {
    name: 'MenuDropdown',
    description: 'Dropdown menu with items and shortcuts',
    category: 'Menus',
    location: 'src/components/shared/MenuDropdown.tsx',
    preview: (
      <div style={{ position: 'relative', height: '200px' }}>
        <MenuDropdown
          items={[
            { label: 'New File', onClick: () => {}, shortcut: '⌘N' },
            { label: 'Open', onClick: () => {}, shortcut: '⌘O' },
            { divider: true },
            { label: 'Save', onClick: () => {}, shortcut: '⌘S' },
            { label: 'Save As...', onClick: () => {}, shortcut: '⇧⌘S' },
            { divider: true },
            { label: 'Exit', onClick: () => {} },
          ]}
          isOpen={true}
          onClose={() => {}}
        />
      </div>
    ),
  },

  // TabHeader Examples
  {
    name: 'TabHeader',
    description: 'Tab navigation with icons',
    category: 'Navigation',
    location: 'src/components/shared/TabHeader.tsx',
    preview: (
      <div style={{ width: '300px' }}>
        <TabHeader
          tabs={[
            { id: 'home', title: 'Home' },
            { id: 'settings', title: 'Settings' },
            { id: 'profile', title: 'Profile' },
          ]}
          activeTabId="home"
          onTabSelect={() => {}}
        />
      </div>
    ),
  },

  // TabbedPanel Examples
  {
    name: 'TabbedPanel',
    description: 'Panel with multiple tabs',
    category: 'Layout',
    location: 'src/components/shared/TabbedPanel.tsx',
    preview: (
      <div style={{ width: '320px', background: 'var(--bg-dark)', borderRadius: '4px', border: '1px solid var(--bg-panel)' }}>
        <TabbedPanel
          tabs={[
            { id: 'files', title: 'Files' },
            { id: 'properties', title: 'Properties' },
          ]}
          tabContents={{
            files: <div style={{ padding: '12px', fontSize: '13px' }}>Files content</div>,
            properties: <div style={{ padding: '12px', fontSize: '13px' }}>Properties content</div>,
          }}
          zone="center-top"
        />
      </div>
    ),
  },

  // Action Buttons Group
  {
    name: 'Action Buttons',
    description: 'Common action button patterns',
    category: 'Buttons',
    location: 'src/components/shared/IconButton.tsx',
    preview: (
      <div style={{ display: 'flex', gap: '4px' }}>
        <IconButton icon={<Upload size={16} />} tooltip="Upload" />
        <IconButton icon={<Download size={16} />} tooltip="Download" />
        <IconButton icon={<Copy size={16} />} tooltip="Copy" />
        <IconButton icon={<Trash size={16} />} tooltip="Delete" />
      </div>
    ),
  },

  // Toggle Buttons Group
  {
    name: 'Toggle Buttons',
    description: 'Visibility and lock controls',
    category: 'Buttons',
    location: 'src/components/shared/IconButton.tsx',
    preview: (
      <div style={{ display: 'flex', gap: '4px' }}>
        <IconButton icon={<Eye size={16} />} active tooltip="Visible" />
        <IconButton icon={<EyeOff size={16} />} tooltip="Hidden" />
        <IconButton icon={<Lock size={16} />} active tooltip="Locked" />
        <IconButton icon={<Unlock size={16} />} tooltip="Unlocked" />
      </div>
    ),
  },
]

const categories = [
  { name: 'Buttons', icon: '🔘' },
  { name: 'Layout', icon: '📐' },
  { name: 'Forms', icon: '📝' },
  { name: 'Menus', icon: '📋' },
  { name: 'Navigation', icon: '🧭' },
]

export function ComponentGalleryStandalone() {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(categories.map(c => c.name))
  )
  const [selectedComponent, setSelectedComponent] = useState<ComponentExample | null>(null)
  const [selectedVariant, setSelectedVariant] = useState<number>(0)

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(categoryName)) {
        newSet.delete(categoryName)
      } else {
        newSet.add(categoryName)
      }
      return newSet
    })
  }

  const filteredComponents = componentExamples.filter(comp =>
    comp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    comp.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const componentsByCategory = categories.map(category => ({
    ...category,
    components: filteredComponents.filter(c => c.category === category.name)
  }))

  const totalComponents = componentExamples.length

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-darkest)' }}>
      {/* Header */}
      <div style={{ 
        padding: '16px 20px', 
        borderBottom: '2px solid var(--bg-panel)', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '12px',
        background: 'var(--bg-dark)'
      }}>
        <Package size={24} color="var(--accent-primary)" />
        <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>
          Studio Shell Component Library
        </h1>
      </div>

      <div className={styles.gallery}>
        {/* Search Bar */}
        <div className={styles.searchBar}>
          <Search size={14} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search components..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        {/* Stats */}
        <div className={styles.statsSimple}>
          <span className={styles.statText}>{totalComponents} Components</span>
          <span className={styles.statText}>{categories.length} Categories</span>
        </div>

        {/* Component List */}
        <div className={styles.componentList}>
          {componentsByCategory.map(category => (
            category.components.length > 0 && (
              <div key={category.name} className={styles.category}>
                <div
                  className={styles.categoryHeader}
                  onClick={() => toggleCategory(category.name)}
                >
                  <div className={styles.categoryTitle}>
                    {expandedCategories.has(category.name) ? (
                      <ChevronDown size={14} />
                    ) : (
                      <ChevronRight size={14} />
                    )}
                    <span>{category.icon}</span>
                    <span className={styles.categoryName}>{category.name}</span>
                    <span className={styles.categoryCount}>({category.components.length})</span>
                  </div>
                </div>

                {expandedCategories.has(category.name) && (
                  <div className={styles.componentGrid}>
                    {category.components.map(comp => (
                      <div
                        key={comp.name}
                        className={styles.componentCard}
                        onClick={() => {
                          setSelectedComponent(comp)
                          setSelectedVariant(0)
                        }}
                      >
                        <div className={styles.previewContainer}>
                          {comp.preview}
                        </div>
                        <div className={styles.componentInfo}>
                          <span className={styles.componentName}>{comp.name}</span>
                          <p className={styles.componentDescription}>{comp.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          ))}
        </div>

        {/* Detail Modal */}
        {selectedComponent && (
          <>
            <div className={styles.overlay} onClick={() => setSelectedComponent(null)} />
            <div className={styles.detailModal}>
              <div className={styles.detailHeader}>
                <div>
                  <h3>{selectedComponent.name}</h3>
                  <p className={styles.detailDescription}>{selectedComponent.description}</p>
                </div>
                <button
                  className={styles.closeButton}
                  onClick={() => setSelectedComponent(null)}
                >
                  ×
                </button>
              </div>
              
              <div className={styles.detailBody}>
                {/* Main Preview */}
                <div className={styles.previewSection}>
                  <label className={styles.sectionLabel}>Preview</label>
                  <div className={styles.previewBox}>
                    {selectedComponent.preview}
                  </div>
                </div>

                {/* Variants */}
                {selectedComponent.variants && selectedComponent.variants.length > 0 && (
                  <div className={styles.variantsSection}>
                    <label className={styles.sectionLabel}>Variants</label>
                    <div className={styles.variantTabs}>
                      {selectedComponent.variants.map((variant, index) => (
                        <button
                          key={index}
                          className={`${styles.variantTab} ${selectedVariant === index ? styles.active : ''}`}
                          onClick={() => setSelectedVariant(index)}
                        >
                          {variant.name}
                        </button>
                      ))}
                    </div>
                    <div className={styles.variantPreviewBox}>
                      {selectedComponent.variants[selectedVariant].preview}
                    </div>
                  </div>
                )}

                {/* Info */}
                <div className={styles.infoSection}>
                  <label className={styles.sectionLabel}>Location</label>
                  <code className={styles.locationCode}>{selectedComponent.location}</code>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
