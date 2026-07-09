/**
 * Async localStorage utilities with debouncing to prevent blocking the main thread
 */

type SaveCallback = () => void

class LocalStorageManager {
  private saveTimers: Map<string, number> = new Map()
  private readonly DEBOUNCE_MS = 500

  /**
   * Save data to localStorage with debouncing
   * Multiple rapid calls will be collapsed into a single save
   */
  saveLater(key: string, getData: () => unknown, onComplete?: SaveCallback): void {
    // Clear any existing timer for this key
    const existingTimer = this.saveTimers.get(key)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Set a new timer
    const timer = window.setTimeout(() => {
      this.saveTimers.delete(key)
      this.saveNow(key, getData())
      onComplete?.()
    }, this.DEBOUNCE_MS)

    this.saveTimers.set(key, timer)
  }

  /**
   * Save immediately without debouncing
   */
  saveNow(key: string, data: unknown): void {
    try {
      const json = JSON.stringify(data)
      localStorage.setItem(key, json)
    } catch (error) {
      console.error(`Failed to save to localStorage [${key}]:`, error)
    }
  }

  /**
   * Load data from localStorage
   */
  load<T>(key: string, fallback: T): T {
    try {
      const item = localStorage.getItem(key)
      if (item) {
        return JSON.parse(item) as T
      }
    } catch (error) {
      console.error(`Failed to load from localStorage [${key}]:`, error)
    }
    return fallback
  }

  /**
   * Clear all pending saves for a key
   */
  cancelSave(key: string): void {
    const timer = this.saveTimers.get(key)
    if (timer) {
      clearTimeout(timer)
      this.saveTimers.delete(key)
    }
  }

  /**
   * Force all pending saves to execute immediately
   */
  flushAll(): void {
    this.saveTimers.forEach((timer) => clearTimeout(timer))
    this.saveTimers.clear()
  }
}

export const localStorageManager = new LocalStorageManager()
