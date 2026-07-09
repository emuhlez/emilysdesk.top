# Performance Improvements & Modularization Guide

This document outlines the performance improvements and modularization applied to the Studio Shell codebase.

## Overview

The refactoring focused on three main areas:
1. **Store Separation** - Split monolithic `editorStore` into focused stores
2. **Component Modularization** - Broke down large components into smaller, reusable pieces
3. **Performance Optimizations** - Added memoization, throttling, and async operations

## Performance Issues Identified

### 1. Assets Component (779 lines)
**Problems:**
- ❌ Monolithic component doing too much
- ❌ No virtualization for large asset lists
- ❌ Drag & drop handlers recreated on every render
- ❌ localStorage operations blocking main thread
- ❌ All state mixed together causing unnecessary re-renders

**Solutions:**
- ✅ Split into focused sub-components (AssetSidebar, AssetToolbar)
- ✅ Extracted drag & drop logic into reusable hook
- ✅ Used memoization to prevent unnecessary recalculations
- ✅ Moved to selective Zustand subscriptions
- ✅ Added async localStorage with debouncing

### 2. editorStore (863 lines)
**Problems:**
- ❌ All state mixed together (scene, assets, console, tools)
- ❌ localStorage save on EVERY asset mutation (blocking)
- ❌ Assets array searched repeatedly (O(n) operations)
- ❌ Large initial demo assets created on every load

**Solutions:**
- ✅ Split into separate stores (assetStore, selectionStore)
- ✅ Async localStorage with 500ms debouncing
- ✅ Cached initial assets (created once, reused)
- ✅ Selective subscriptions to prevent unnecessary updates

### 3. Viewport3D
**Problems:**
- ⚠️ Sequential model loading with artificial delays
- ⚠️ Transform sync checking on every idle frame

**Solutions:**
- ✅ Concurrent model loading (4 at a time vs 3 sequentially)
- ✅ Removed artificial setTimeout delays
- ✅ Throttled transform checks (every 10 frames vs every frame)
- ✅ Error handling to continue loading on failure

## New Architecture

### Store Structure

```
store/
├── utils/
│   └── localStorage.ts       # Async localStorage with debouncing
├── assetStore.ts             # Asset management
├── selectionStore.ts         # Selection state
└── editorStore.ts            # Scene, console, playmode, tools
```

#### Benefits:
- **Selective Subscriptions**: Components only re-render when relevant state changes
- **Better Organization**: Related logic grouped together
- **Improved Performance**: Smaller state slices = faster updates

### Component Structure

```
components/Assets/
├── Assets.refactored.tsx     # Main component (uses new stores)
├── AssetSidebar.tsx          # Sidebar navigation (memoized)
├── AssetToolbar.tsx          # Toolbar actions (memoized)
├── AssetTile.tsx             # Individual asset (already memoized)
├── ModelPreview.tsx          # 3D model preview (already optimized)
└── MoveDialog.tsx            # Move assets dialog
```

#### Benefits:
- **Smaller Components**: Easier to understand and maintain
- **Better Reusability**: Components can be used independently
- **Improved Performance**: Memoization prevents unnecessary re-renders
- **Better Testing**: Smaller units are easier to test

### Custom Hooks

```
hooks/
└── useDragAndDrop.ts         # Reusable drag & drop logic
```

#### Benefits:
- **Reusability**: Can be used in any component
- **Testability**: Logic isolated from UI
- **Cleaner Components**: Business logic extracted

## Performance Improvements Summary

### 1. Async localStorage Operations
**Before:**
```typescript
localStorage.setItem('key', JSON.stringify(data)) // Blocks main thread
```

**After:**
```typescript
localStorageManager.saveLater('key', () => data) // Debounced, non-blocking
```

**Impact:** Eliminates blocking on every asset mutation. Multiple rapid changes collapsed into single save.

### 2. Store Separation with Selective Subscriptions
**Before:**
```typescript
const { assets, selectedAssetIds, gameObjects, isPlaying, ... } = useEditorStore()
// Component re-renders on ANY state change
```

**After:**
```typescript
const assets = useAssetStore((state) => state.assets)
const selectedAssetIds = useSelectionStore((state) => state.selectedAssetIds)
// Component only re-renders when assets or selection changes
```

**Impact:** 
- Assets component doesn't re-render when game objects change
- Selection changes don't trigger asset list re-calculations
- Viewport doesn't re-render when assets change

### 3. Memoization
**Added memoization for:**
- Top-level folder list
- Displayed assets based on navigation
- Assets for grid/list view
- Context menu items
- Type label calculations

**Impact:** Prevents expensive recalculations on every render.

### 4. Component Extraction
**Before:** 779-line component with everything mixed together

**After:** 
- AssetSidebar: ~180 lines
- AssetToolbar: ~70 lines
- Assets.refactored: ~480 lines

**Impact:**
- Sidebar can re-render independently
- Toolbar is memoized and rarely re-renders
- Main component is cleaner and easier to maintain

### 5. Optimized Model Loading
**Before:**
- Load 3 models
- Wait 100ms
- Load 3 more models
- Wait 100ms
- etc.

**After:**
- Load 4 models concurrently
- When one completes, immediately start next
- No artificial delays

**Impact:** Models load faster with better resource utilization.

### 6. Throttled Transform Sync
**Before:** Check for transform changes every frame when idle

**After:** Check every 10 frames (still ~6 times per second at 60 FPS)

**Impact:** Reduced CPU usage when viewport is idle.

## Migration Guide

### Step 1: Add New Files

Copy the following new files to your project:
- `src/store/utils/localStorage.ts`
- `src/store/assetStore.ts`
- `src/store/selectionStore.ts`
- `src/hooks/useDragAndDrop.ts`
- `src/components/Assets/AssetSidebar.tsx`
- `src/components/Assets/AssetToolbar.tsx`
- `src/components/Assets/Assets.refactored.tsx`

### Step 2: Update Viewport3D

Apply the optimizations to `src/components/Viewport/Viewport3D.tsx`:
- Replace model loading logic with concurrent loading
- Add throttled transform checking

### Step 3: Test the Refactored Assets Component

1. Temporarily rename current Assets component:
   ```
   mv src/components/Assets/Assets.tsx src/components/Assets/Assets.old.tsx
   ```

2. Rename refactored component:
   ```
   mv src/components/Assets/Assets.refactored.tsx src/components/Assets/Assets.tsx
   ```

3. Test thoroughly:
   - Asset navigation
   - Asset selection (single, multi, range)
   - Drag & drop to folders
   - Asset renaming
   - Asset import
   - Context menu operations
   - Grid vs list view switching

### Step 4: Update Viewport Component (if needed)

The Viewport component should use `useSelectionStore` for selection state:

```typescript
// Before
import { useEditorStore } from '../../store/editorStore'
const { selectedObjectIds, gameObjects, viewportSelectedAssetNames } = useEditorStore()

// After
import { useSelectionStore } from '../../store/selectionStore'
import { useEditorStore } from '../../store/editorStore'
const { selectedObjectIds, viewportSelectedAssetNames } = useSelectionStore()
const { gameObjects } = useEditorStore()
```

### Step 5: Gradually Update Other Components

For components using `useEditorStore`, gradually migrate to use the new stores:
- Asset operations → `useAssetStore`
- Selection operations → `useSelectionStore`
- Scene/game object operations → `useEditorStore` (unchanged)

## Performance Metrics

### Expected Improvements:

1. **Asset List Rendering:**
   - 50-70% fewer re-renders on unrelated state changes
   - Faster list updates with memoization

2. **Asset Operations:**
   - 90% reduction in main thread blocking (async localStorage)
   - Smoother drag & drop (no blocking saves)

3. **Model Loading:**
   - 25-30% faster initial load time
   - Better perceived performance (concurrent loading)

4. **Viewport Idle Performance:**
   - 90% reduction in transform check overhead
   - Lower CPU usage when idle

5. **Memory Usage:**
   - More efficient with smaller state slices
   - Better garbage collection with memoization

## Best Practices Moving Forward

### 1. Store Organization
- Keep stores focused on single concerns
- Use selective subscriptions (`(state) => state.specificValue`)
- Avoid large objects in state (prefer normalized data)

### 2. Component Design
- Extract large components into smaller pieces
- Use `memo()` for components that receive stable props
- Memoize expensive calculations with `useMemo()`
- Memoize callbacks with `useCallback()`

### 3. Performance Monitoring
- Use React DevTools Profiler to identify slow components
- Monitor re-render frequency
- Check for unnecessary calculations in renders

### 4. Async Operations
- Use `localStorageManager` for all localStorage operations
- Debounce expensive operations (saves, API calls, etc.)
- Use IntersectionObserver for lazy loading (see ModelPreview)

## Troubleshooting

### Issue: Assets not saving
**Solution:** Check console for localStorage errors. Ensure `localStorageManager.saveLater()` is being called.

### Issue: Selection not syncing between components
**Solution:** Ensure all components use `useSelectionStore` instead of local state.

### Issue: Drag & drop not working
**Solution:** Check that `useDragAndDrop` hook is properly configured with callbacks.

### Issue: Performance not improved
**Solution:** 
1. Check that components are using selective subscriptions
2. Verify memoization is working (use React DevTools)
3. Ensure localStorage debouncing is enabled

## Future Improvements

### Potential Enhancements:
1. **Virtualization**: Add `react-window` for large asset lists (100+ items)
2. **Web Workers**: Move heavy computations off main thread
3. **IndexedDB**: For larger datasets, use IndexedDB instead of localStorage
4. **Code Splitting**: Lazy load heavy components like ModelPreview
5. **Asset Caching**: Cache loaded 3D models to avoid re-loading
6. **Thumbnail Caching**: Persist generated thumbnails to avoid regeneration

## Questions?

For questions or issues with the refactoring, please refer to:
- The inline comments in each new file
- The original .cursorrules for project conventions
- This document for architectural decisions
