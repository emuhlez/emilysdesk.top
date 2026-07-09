import { create } from 'zustand'
import type { DockZone, DockedWidget } from '../types'

export const DEFAULT_LEFT_WIDTH = 280
export const DEFAULT_RIGHT_WIDTH = 320
export const DEFAULT_CENTER_BOTTOM_HEIGHT = 470
export const DEFAULT_RIGHT_BOTTOM_HEIGHT = 470

export type PanelSizeKey = 'leftWidth' | 'rightWidth' | 'centerBottomHeight' | 'rightBottomHeight'

interface PanelSizes {
  leftWidth: number
  rightWidth: number
  centerBottomHeight: number
  rightBottomHeight: number
}

export interface ViewportBounds {
  left: number
  top: number
  width: number
  height: number
}

interface DockingStore {
  widgets: Record<string, DockedWidget>
  panelSizes: PanelSizes
  centerBottomCollapsed: boolean
  /** Bounds of the center viewport wrapper — drives proximity dock targeting (studio-ai parity). */
  viewportBounds: ViewportBounds | null

  // Actions
  toggleCenterBottomCollapsed: () => void
  setViewportBounds: (bounds: ViewportBounds | null) => void
  dockWidget: (widgetId: string, zone: DockZone, order?: number) => void
  undockWidget: (widgetId: string) => void
  moveWidget: (widgetId: string, newZone: DockZone, newOrder: number) => void
  getWidgetsInZone: (zone: DockZone) => DockedWidget[]
  setPanelSize: (key: PanelSizeKey, value: number) => void

  // --- Assistant-related state (ported from studio-ai) ---
  /** When true, AI Assistant panel shows only header / minimal composer */
  aiAssistantBodyCollapsed: boolean
  setAiAssistantBodyCollapsed: (collapsed: boolean) => void
  /** Chatbot UI mode: 'tabs' = conversation tabs, 'dropdown' = Tasks header, 'queue' = queue view, 'sidenav' = side navigation */
  chatbotUIMode: 'tabs' | 'dropdown' | 'queue' | 'sidenav'
  setChatbotUIMode: (mode: 'tabs' | 'dropdown' | 'queue' | 'sidenav') => void
  /** Task drawer placement: 'mezzanine' = toolbar icon, 'above-composer' = drawer above composer, 'menu' = menu style */
  taskDrawerMode: 'mezzanine' | 'above-composer' | 'menu'
  setTaskDrawerMode: (mode: 'mezzanine' | 'above-composer' | 'menu') => void
  /** Tasks dropdown placement when in menu mode */
  taskDrawerMenuSide: 'left' | 'center' | 'right'
  setTaskDrawerMenuSide: (side: 'left' | 'center' | 'right') => void
  /** Dropdown task list status display style */
  dropdownTaskListStatusOption: 'color' | 'status' | 'none'
  setDropdownTaskListStatusOption: (option: 'color' | 'status' | 'none') => void
  /** Tabs status display style */
  tabsStatusOption: 'color' | 'status' | 'none'
  setTabsStatusOption: (option: 'color' | 'status' | 'none') => void
  /** Assistant panel placement mode */
  assistantPanelMode: 'menu' | 'right'
  setAssistantPanelMode: (mode: 'menu' | 'right') => void
  /** Studio layout mode */
  studioMode: 'ribbon' | 'shell'
  setStudioMode: (mode: 'ribbon' | 'shell') => void
  /** Whether the AI Assistant internal sidebar is open */
  aiSidebarOpen: boolean
  toggleAiSidebar: () => void
  setAiSidebarOpen: (open: boolean) => void
  /** Width of the AI Assistant internal sidebar (clamped 180–320) */
  aiSidebarWidth: number
  setAiSidebarWidth: (width: number) => void
  /** Global Nebula visual mode (affects icon/animation flourishes) */
  nebulaMode: 'on' | 'off'
  setNebulaMode: (mode: 'on' | 'off') => void
  /** When true, Properties panel shows only header (no selection). Stub for AI hook compatibility. */
  inspectorBodyCollapsed: boolean
  setInspectorBodyCollapsed: (collapsed: boolean) => void

  /** Ribbon: inspector slide-out exit animation runs before {@link undockWidget}. */
  ribbonInspectorExitAnimating: boolean
  setRibbonInspectorExitAnimating: (value: boolean) => void

  /** Widget currently dragged — drives TabHeader tab-strip insertion cues + aria-dropeffect. */
  draggingWidgetId: string | null
  setDraggingWidgetId: (id: string | null) => void
}

export const useDockingStore = create<DockingStore>((set, get) => ({
  widgets: {
    inspector: { id: 'inspector', zone: 'right-bottom', order: 0 },
    viewport: { id: 'viewport', zone: 'center-top', order: 0 },
    explorer: { id: 'explorer', zone: 'right-top', order: 0 },
    assets: { id: 'assets', zone: 'center-bottom', order: 0 },
    'ai-assistant': { id: 'ai-assistant', zone: 'left', order: 0 },
  },
  panelSizes: {
    leftWidth: DEFAULT_LEFT_WIDTH,
    rightWidth: DEFAULT_RIGHT_WIDTH,
    centerBottomHeight: DEFAULT_CENTER_BOTTOM_HEIGHT,
    rightBottomHeight: DEFAULT_RIGHT_BOTTOM_HEIGHT,
  },
  centerBottomCollapsed: true,
  viewportBounds: null,

  toggleCenterBottomCollapsed: () => {
    set((state) => ({ centerBottomCollapsed: !state.centerBottomCollapsed }))
  },

  setViewportBounds: (bounds) => set({ viewportBounds: bounds }),

  dockWidget: (widgetId, zone, order) => {
    set((state) => {
      const widgets = { ...state.widgets }

      if (state.studioMode === 'ribbon' && zone === 'right-top') {
        zone = 'right-bottom'
      }

      // If order not specified, add to end of zone
      if (order === undefined) {
        const zoneWidgets = get().getWidgetsInZone(zone)
        order = zoneWidgets.length
      }

      widgets[widgetId] = { id: widgetId, zone, order }

      // Reorder widgets in the new zone
      const newZoneWidgets = Object.values(widgets)
        .filter((w) => w.zone === zone)
        .sort((a, b) => a.order - b.order)

      newZoneWidgets.forEach((w, index) => {
        widgets[w.id] = { ...w, order: index }
      })

      const patch: Partial<DockingStore> = { widgets }
      if (widgetId === 'ai-assistant') {
        patch.assistantPanelMode = zone === 'right-top' ? 'menu' : 'right'
      }

      return patch
    })
  },
  
  undockWidget: (widgetId) => {
    set((state) => {
      const widgets = { ...state.widgets }
      delete widgets[widgetId]
      return { widgets }
    })
  },
  
  moveWidget: (widgetId, newZone, newOrder) => {
    set((state) => {
      const widgets = { ...state.widgets }
      const widget = widgets[widgetId]
      if (!widget) return state
      
      // Remove from old zone
      const oldZoneWidgets = Object.values(widgets)
        .filter((w) => w.zone === widget.zone && w.id !== widgetId)
        .sort((a, b) => a.order - b.order)
      
      // Reorder old zone
      oldZoneWidgets.forEach((w, index) => {
        widgets[w.id] = { ...w, order: index }
      })
      
      // Add to new zone
      const newZoneWidgets = Object.values(widgets)
        .filter((w) => w.zone === newZone && w.id !== widgetId)
        .sort((a, b) => a.order - b.order)
      
      // Insert at newOrder position
      newZoneWidgets.splice(newOrder, 0, { ...widget, zone: newZone, order: newOrder })
      
      // Reorder new zone
      newZoneWidgets.forEach((w, index) => {
        widgets[w.id] = { ...w, order: index }
      })
      
      return { widgets }
    })
  },
  
  getWidgetsInZone: (zone) => {
    return Object.values(get().widgets)
      .filter((w) => w.zone === zone)
      .sort((a, b) => a.order - b.order)
  },

  setPanelSize: (key, value) => {
    const min = key === 'leftWidth' ? 220 : key === 'rightWidth' ? 260 : 120
    const clamped = Math.max(min, value)
    set((state) => ({
      panelSizes: { ...state.panelSizes, [key]: clamped },
    }))
  },

  // --- Assistant-related state ---
  aiAssistantBodyCollapsed: false,
  setAiAssistantBodyCollapsed: (collapsed) => set({ aiAssistantBodyCollapsed: collapsed }),
  chatbotUIMode: 'tabs',
  setChatbotUIMode: (mode) => set({ chatbotUIMode: mode }),
  taskDrawerMode: 'menu',
  setTaskDrawerMode: (mode) => set({ taskDrawerMode: mode }),
  taskDrawerMenuSide: 'right',
  setTaskDrawerMenuSide: (side) => set({ taskDrawerMenuSide: side }),
  dropdownTaskListStatusOption: 'status',
  setDropdownTaskListStatusOption: (option) => set({ dropdownTaskListStatusOption: option }),
  tabsStatusOption: 'status',
  setTabsStatusOption: (option) => set({ tabsStatusOption: option }),
  assistantPanelMode: 'right',
  setAssistantPanelMode: (mode) => {
    set({ assistantPanelMode: mode })
    // Studio Shell only has docked layouts; redock to left when entering 'right' mode
    // and to left as a fallback when in 'menu' mode (since we don't have a sticky/floating layer yet).
    const state = get()
    state.dockWidget('ai-assistant', mode === 'right' ? 'left' : 'left')
  },
  // Roblox Studio inside this desktop is locked to ribbon mode — the shell
  // layout is intentionally unreachable so the embedded studio always reads
  // as the same surface. The setter ignores 'shell' so any stray caller
  // (legacy code, future ports) can't flip the mode back; the settings cog
  // and its dropdown panel that previously hosted the toggle have also
  // been removed.
  studioMode: 'ribbon',
  setStudioMode: (mode) => {
    if (mode !== 'ribbon') return
    set({ studioMode: 'ribbon', ribbonInspectorExitAnimating: false })
    const state = get()
    state.dockWidget('inspector', 'right-bottom')
    state.dockWidget('ai-assistant', 'right-bottom')
    set({ assistantPanelMode: 'right', aiAssistantBodyCollapsed: false })
  },
  ribbonInspectorExitAnimating: false,
  setRibbonInspectorExitAnimating: (value) => set({ ribbonInspectorExitAnimating: value }),
  aiSidebarOpen: false,
  toggleAiSidebar: () => set((state) => ({ aiSidebarOpen: !state.aiSidebarOpen })),
  setAiSidebarOpen: (open) => set({ aiSidebarOpen: open }),
  aiSidebarWidth: 220,
  setAiSidebarWidth: (width) => set({ aiSidebarWidth: Math.max(180, Math.min(320, width)) }),
  nebulaMode: 'on',
  setNebulaMode: (mode) => set({ nebulaMode: mode }),
  inspectorBodyCollapsed: false,
  setInspectorBodyCollapsed: (collapsed) => set({ inspectorBodyCollapsed: collapsed }),

  draggingWidgetId: null,
  setDraggingWidgetId: (id) => set({ draggingWidgetId: id }),
}))

