/**
 * Component Tracker Utility
 * Syncs active component state between the main editor and component gallery
 * using localStorage and storage events
 */

const STORAGE_KEY = 'studio-shell-active-component'

export interface ActiveComponentInfo {
  name: string
  location: string
  timestamp: number
}

/**
 * Set the currently active component
 */
export function setActiveComponent(name: string, location: string) {
  const info: ActiveComponentInfo = {
    name,
    location,
    timestamp: Date.now()
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(info))
  
  // Dispatch a custom event for same-page updates
  window.dispatchEvent(new CustomEvent('component-activated', { detail: info }))
}

/**
 * Get the currently active component
 */
export function getActiveComponent(): ActiveComponentInfo | null {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return null
  
  try {
    return JSON.parse(stored)
  } catch {
    return null
  }
}

/**
 * Clear the active component
 */
export function clearActiveComponent() {
  localStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new CustomEvent('component-activated', { detail: null }))
}

/**
 * Listen for active component changes
 */
export function onActiveComponentChange(callback: (info: ActiveComponentInfo | null) => void) {
  // Listen for storage events (cross-tab)
  const storageHandler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      if (e.newValue) {
        try {
          callback(JSON.parse(e.newValue))
        } catch {
          callback(null)
        }
      } else {
        callback(null)
      }
    }
  }
  
  // Listen for custom events (same-page)
  const customHandler = (e: Event) => {
    const customEvent = e as CustomEvent<ActiveComponentInfo | null>
    callback(customEvent.detail)
  }
  
  window.addEventListener('storage', storageHandler)
  window.addEventListener('component-activated', customHandler)
  
  // Return cleanup function
  return () => {
    window.removeEventListener('storage', storageHandler)
    window.removeEventListener('component-activated', customHandler)
  }
}

/**
 * Map component instances to gallery component names
 */
export function getComponentName(element: HTMLElement | null): string | null {
  if (!element) return null
  
  // Check for data-component attribute
  const componentAttr = element.getAttribute('data-component')
  if (componentAttr) return componentAttr
  
  // Check class names for component patterns
  const classList = Array.from(element.classList)
  
  // Look for CSS module class patterns
  for (const className of classList) {
    if (className.includes('iconButton')) return 'IconButton'
    if (className.includes('panel')) return 'Panel'
    if (className.includes('tabHeader')) return 'TabHeader'
    if (className.includes('menuDropdown')) return 'MenuDropdown'
    if (className.includes('contextMenu')) return 'ContextMenu'
    if (className.includes('tabbedPanel')) return 'TabbedPanel'
    if (className.includes('propertiesLabel')) return 'PropertiesLabel'
  }
  
  // Check parent elements
  if (element.parentElement) {
    return getComponentName(element.parentElement)
  }
  
  return null
}
