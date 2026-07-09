import { useState, useEffect } from 'react'
import { Search, ChevronRight, ChevronDown, Package, Zap, MousePointer } from 'lucide-react'
import { onActiveComponentChange, getActiveComponent, type ActiveComponentInfo } from '../../utils/componentTracker'
import styles from './ComponentGallery.module.css'

interface ComponentInfo {
  name: string
  description: string
  category: string
  location: string
}

const components: ComponentInfo[] = [
  { name: 'IconButton', description: 'Icon button with variants', category: 'Buttons', location: 'src/components/shared/IconButton.tsx' },
  { name: 'Panel', description: 'Base panel container', category: 'Layout', location: 'src/components/shared/Panel.tsx' },
  { name: 'PanelHeader', description: 'Panel header component', category: 'Layout', location: 'src/components/shared/Panel.tsx' },
  { name: 'TabbedPanel', description: 'Panel with tabs', category: 'Layout', location: 'src/components/shared/TabbedPanel.tsx' },
  { name: 'TabHeader', description: 'Tab navigation', category: 'Navigation', location: 'src/components/shared/TabHeader.tsx' },
  { name: 'MenuDropdown', description: 'Dropdown menu', category: 'Menus', location: 'src/components/shared/MenuDropdown.tsx' },
  { name: 'ContextMenu', description: 'Right-click menu', category: 'Menus', location: 'src/components/shared/ContextMenu.tsx' },
  { name: 'PropertiesLabel', description: 'Property field label', category: 'Forms', location: 'src/components/shared/PropertiesLabel.tsx' },
  { name: 'DockablePanel', description: 'Panel with docking', category: 'Layout', location: 'src/components/shared/DockablePanel.tsx' },
  { name: 'Assets', description: 'Asset browser panel', category: 'Features', location: 'src/components/Assets/Assets.tsx' },
  { name: 'Console', description: 'Console panel', category: 'Features', location: 'src/components/Console/Console.tsx' },
  { name: 'Hierarchy', description: 'Scene hierarchy', category: 'Features', location: 'src/components/Hierarchy/Hierarchy.tsx' },
  { name: 'Inspector', description: 'Properties inspector', category: 'Features', location: 'src/components/Inspector/Inspector.tsx' },
  { name: 'Toolbar', description: 'Main toolbar', category: 'Features', location: 'src/components/Toolbar/Toolbar.tsx' },
  { name: 'Viewport', description: 'Scene viewport', category: 'Features', location: 'src/components/Viewport/Viewport.tsx' },
]

const categories = [
  { name: 'Buttons', icon: '🔘' },
  { name: 'Layout', icon: '📐' },
  { name: 'Navigation', icon: '🧭' },
  { name: 'Menus', icon: '📋' },
  { name: 'Forms', icon: '📝' },
  { name: 'Features', icon: '⚡' },
]

export function SimpleGallery() {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeComponent, setActiveComponent] = useState<ActiveComponentInfo | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(categories.map(c => c.name))
  )

  useEffect(() => {
    // Get initial active component
    setActiveComponent(getActiveComponent())
    
    // Listen for changes
    const cleanup = onActiveComponentChange((info) => {
      setActiveComponent(info)
      console.log('Active component changed:', info)
    })
    
    return cleanup
  }, [])

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

  const filteredComponents = components.filter(comp =>
    comp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    comp.description.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const componentsByCategory = categories.map(category => ({
    ...category,
    components: filteredComponents.filter(c => c.category === category.name)
  }))

  const totalComponents = components.length

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
          {activeComponent && (
            <span style={{ 
              color: 'var(--accent-primary)', 
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Zap size={14} />
              Active: {activeComponent.name}
            </span>
          )}
        </div>

        {/* Tip Banner */}
        {!activeComponent && (
          <div style={{ 
            padding: '12px 16px',
            background: 'var(--bg-surface)',
            border: '1px solid var(--bg-panel)',
            borderRadius: '6px',
            color: 'var(--text-secondary)',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <MousePointer size={16} color="var(--accent-primary)" />
            <span>💡 Click any component in the main editor to see it highlighted here!</span>
          </div>
        )}

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
                  <div style={{ 
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    paddingLeft: '8px'
                  }}>
                    {category.components.map(comp => {
                      const isActive = activeComponent?.name === comp.name
                      return (
                        <div
                          key={comp.name}
                          style={{
                            padding: '12px 16px',
                            background: isActive ? 'var(--bg-panel)' : 'var(--bg-surface)',
                            border: isActive ? '2px solid var(--accent-primary)' : '1px solid var(--bg-panel)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            position: 'relative',
                            boxShadow: isActive ? '0 0 20px rgba(230, 126, 34, 0.3)' : 'none'
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.borderColor = 'var(--accent-primary)'
                              e.currentTarget.style.background = 'var(--bg-panel)'
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive) {
                              e.currentTarget.style.borderColor = 'var(--bg-panel)'
                              e.currentTarget.style.background = 'var(--bg-surface)'
                            }
                          }}
                        >
                          {isActive && (
                            <div style={{
                              position: 'absolute',
                              top: '8px',
                              right: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px',
                              color: 'var(--accent-primary)',
                              fontWeight: 600
                            }}>
                              <Zap size={14} />
                              ACTIVE
                            </div>
                          )}
                          <div style={{ 
                            fontSize: '14px', 
                            fontWeight: 600, 
                            color: isActive ? 'var(--accent-primary)' : 'var(--text-primary)',
                            marginBottom: '4px'
                          }}>
                            {comp.name}
                          </div>
                          <div style={{ 
                            fontSize: '12px', 
                            color: 'var(--text-muted)',
                            marginBottom: '8px'
                          }}>
                            {comp.description}
                          </div>
                          <code style={{ 
                            fontSize: '11px', 
                            color: 'var(--text-muted)',
                            fontFamily: 'monospace',
                            background: 'var(--bg-darkest)',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            display: 'block'
                          }}>
                            {comp.location}
                          </code>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  )
}
