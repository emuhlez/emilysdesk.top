import { create } from 'zustand'
import type { ViewportSelectedAsset } from '../types'

interface SelectionStore {
  // Selection state
  selectedObjectIds: string[]
  selectedAssetIds: string[]
  viewportSelectedAssetNames: string[]
  
  // Actions
  selectObject: (id: string | null, options?: { additive?: boolean; range?: boolean }) => void
  selectAsset: (id: string | null, options?: { additive?: boolean; range?: boolean }) => void
  setViewportSelectedAsset: (asset: ViewportSelectedAsset | null, options?: { additive?: boolean }) => void
  clearSelection: () => void
}

/**
 * Selection store - isolated from other concerns for better performance
 * Components can subscribe only to selection state without triggering on unrelated changes
 */
export const useSelectionStore = create<SelectionStore>((set, get) => ({
  selectedObjectIds: [],
  selectedAssetIds: [],
  viewportSelectedAssetNames: [],
  
  selectObject: (id, options) => {
    if (id == null) {
      set({ selectedObjectIds: [], viewportSelectedAssetNames: [] })
      return
    }
    
    const state = get()
    
    // Range selection handled by caller with flat tree order
    if (options?.range) {
      // Range logic delegated to caller since it needs gameObjects context
      return
    }

    if (options?.additive) {
      const has = state.selectedObjectIds.includes(id)
      const newIds = has
        ? state.selectedObjectIds.filter((x) => x !== id)
        : [...state.selectedObjectIds, id]
      set({ selectedObjectIds: newIds })
      return
    }

    set({ selectedObjectIds: [id] })
  },
  
  selectAsset: (id, options) => {
    if (id == null) {
      set({ selectedAssetIds: [] })
      return
    }
    
    const state = get()
    
    // Range selection handled by caller with flat asset order
    if (options?.range) {
      // Range logic delegated to caller since it needs assets context
      return
    }

    if (options?.additive) {
      const has = state.selectedAssetIds.includes(id)
      const newIds = has
        ? state.selectedAssetIds.filter((x) => x !== id)
        : [...state.selectedAssetIds, id]
      set({ selectedAssetIds: newIds })
      return
    }

    set({ selectedAssetIds: [id] })
  },
  
  setViewportSelectedAsset: (asset, options) => {
    if (!asset) {
      set({ viewportSelectedAssetNames: [], selectedObjectIds: [] })
      return
    }
    
    const state = get()

    if (options?.additive) {
      const has = state.viewportSelectedAssetNames.includes(asset.name)
      const newNames = has
        ? state.viewportSelectedAssetNames.filter((n) => n !== asset.name)
        : [...state.viewportSelectedAssetNames, asset.name]
      set({ viewportSelectedAssetNames: newNames })
      return
    }

    set({ viewportSelectedAssetNames: [asset.name] })
  },
  
  clearSelection: () => {
    set({ selectedObjectIds: [], selectedAssetIds: [], viewportSelectedAssetNames: [] })
  },
}))
