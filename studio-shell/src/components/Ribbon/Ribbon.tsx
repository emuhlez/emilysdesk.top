import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  Bell,
  ChevronDown,
  MessageSquare,
  MoreVertical,
  Plus,
  Square,
} from 'lucide-react'
import type { DockZone, EditorState } from '../../types'
import { publicUrl } from '../../utils/assetUrl'
import { useDockingStore } from '../../store/dockingStore'
import { useEditorStore } from '../../store/editorStore'
import nebulaIcon from '../../../icons/nebula.svg'
import styles from './Ribbon.module.css'

const ICON_RIBBON_SIZE = 24
const ICON_MEZZANINE = 16
const ICON_CHEVRON = 12

/** Resolve a ribbon icon filename to its public URL */
const ri = (name: string) => publicUrl(`ribbon-icons/${name}.svg`)

export type RibbonTab =
  | 'Home'
  | 'Model'
  | 'Avatar'
  | 'UI'
  | 'Script'

export type ManipulatorTool =
  | 'select'
  | 'move'
  | 'scale'
  | 'rotate'
  | 'transform'
  | 'geometric'

export type WorkflowPanelToggle =
  | 'toolbox'
  | 'explorer'
  | 'properties'
  | 'asset-manager'

/** Tools that map to {@link EditorState.activeTool} in studio-shell (no transform / geometric). */
function isEditorBackedManipulator(id: ManipulatorTool): id is EditorState['activeTool'] {
  return id === 'select' || id === 'move' || id === 'rotate' || id === 'scale'
}

/** Icon component that renders a local SVG from the ribbon-icons public folder */
function RibbonIcon({ src, size = ICON_RIBBON_SIZE }: { src: string; size?: number }) {
  return <img src={src} alt="" width={size} height={size} aria-hidden />
}

const MENU_LABELS = [
  'File',
  'Edit',
  'Object',
  'View',
  'Plugins',
  'Test',
  'Window',
  'Help',
] as const

const RIBBON_TABS: { id: RibbonTab; label: string }[] = [
  { id: 'Home', label: 'Home' },
  { id: 'Model', label: 'Model' },
  { id: 'Avatar', label: 'Avatar' },
  { id: 'UI', label: 'UI' },
  { id: 'Script', label: 'Script' },
]

const MANIPULATOR_CONFIG: Array<{
  id: ManipulatorTool
  label: string
  iconSrc: string
}> = [
  { id: 'select', label: 'Select', iconSrc: ri('select') },
  { id: 'move', label: 'Move', iconSrc: ri('move') },
  { id: 'scale', label: 'Scale', iconSrc: ri('scale') },
  { id: 'rotate', label: 'Rotate', iconSrc: ri('rotate') },
  { id: 'transform', label: 'Transform', iconSrc: ri('transform') },
  { id: 'geometric', label: 'Geometric', iconSrc: ri('geometric') },
]

function ToggleButton({
  label,
  pressed,
  onClick,
  iconSrc,
  disabled = false,
}: {
  label: string
  pressed: boolean
  onClick?: () => void
  iconSrc: string
  disabled?: boolean
}) {
  return (
    <div className={styles.toggleWrap}>
      <button
        type="button"
        className={styles.iconBtnRibbon}
        data-active={pressed ? 'true' : 'false'}
        aria-pressed={disabled ? undefined : pressed}
        disabled={disabled}
        onClick={disabled ? undefined : onClick}
      >
        <RibbonIcon src={iconSrc} />
      </button>
      <span className={styles.toggleLabel}>{label}</span>
    </div>
  )
}

function SplitButton({
  label,
  iconSrc,
}: {
  label: string
  iconSrc: string
}) {
  return (
    <div className={styles.splitWrap}>
      <div className={styles.splitTop}>
        <button type="button" className={styles.splitMainBtn} aria-label={label}>
          <RibbonIcon src={iconSrc} />
        </button>
        <button
          type="button"
          className={styles.splitDropBtn}
          aria-label={`${label} menu`}
          aria-haspopup="menu"
        >
          <ChevronDown size={ICON_CHEVRON} aria-hidden strokeWidth={2} />
        </button>
      </div>
      <span className={styles.splitLabel}>{label}</span>
    </div>
  )
}

/** Two stacked spinbox inputs with a paired checkbox on the left of each row. */
function SpinboxPair() {
  return (
    <div className={styles.spinboxPairWrap}>
      <div className={styles.spinboxRow}>
        <input type="checkbox" className={styles.ribbonCheckbox} defaultChecked aria-label="Enable spinbox 1" />
        <img src={ri('base spinbox')} alt="" height={20} className={styles.spinboxImg} />
      </div>
      <div className={styles.spinboxRow}>
        <input type="checkbox" className={styles.ribbonCheckbox} aria-label="Enable spinbox 2" />
        <img src={ri('base spinbox2')} alt="" height={20} className={styles.spinboxImg} />
      </div>
    </div>
  )
}

/** Top-of-editor ribbon with menu bar, mezzanine, and contextual tool strips. */
export function Ribbon() {
  const tabsId = useId()
  const [activeTab, setActiveTab] = useState<RibbonTab>('Home')
  const studioMode = useDockingStore((s) => s.studioMode)
  const inspectorWidget = useDockingStore((s) => s.widgets.inspector)
  const assetsWidget = useDockingStore((s) => s.widgets.assets)
  const aiAssistantWidget = useDockingStore((s) => s.widgets['ai-assistant'])
  const centerBottomCollapsed = useDockingStore((s) => s.centerBottomCollapsed)
  const toggleCenterBottomCollapsed = useDockingStore((s) => s.toggleCenterBottomCollapsed)
  const dockWidget = useDockingStore((s) => s.dockWidget)
  const undockWidget = useDockingStore((s) => s.undockWidget)
  const setRibbonInspectorExitAnimating = useDockingStore((s) => s.setRibbonInspectorExitAnimating)
  const ribbonInspectorExitAnimating = useDockingStore((s) => s.ribbonInspectorExitAnimating)
  const ribbonInspectorDismissTimerRef = useRef<number | null>(null)

  // Remember the zone the AI Assistant was last docked in so toggling it
  // closed → open re-opens to the same spot the user had it. Falls back to
  // 'right-bottom' (ribbon mode's default per dockingStore.setStudioMode).
  const lastAIZoneRef = useRef<DockZone>('right-bottom')
  const aiPanelVisible = !!aiAssistantWidget

  const toggleAIAssistant = useCallback(() => {
    if (aiPanelVisible) {
      lastAIZoneRef.current = aiAssistantWidget?.zone ?? 'right-bottom'
      undockWidget('ai-assistant')
    } else {
      dockWidget('ai-assistant', lastAIZoneRef.current)
    }
  }, [aiPanelVisible, aiAssistantWidget, dockWidget, undockWidget])

  useEffect(() => {
    return () => {
      if (ribbonInspectorDismissTimerRef.current !== null) {
        window.clearTimeout(ribbonInspectorDismissTimerRef.current)
      }
    }
  }, [])
  const activeTool = useEditorStore((s) => s.activeTool)
  const setActiveTool = useEditorStore((s) => s.setActiveTool)
  const [workflowOn, setWorkflowOn] = useState<Partial<Record<WorkflowPanelToggle, boolean>>>({})

  const splitProps = useMemo(
    () => [
      { label: 'Part', iconSrc: ri('part') },
      { label: 'Terrain', iconSrc: ri('terrain') },
      { label: 'Character', iconSrc: ri('character') },
      { label: 'GUI', iconSrc: ri('gui') },
      { label: 'Script', iconSrc: ri('script') },
      { label: 'Import 3D', iconSrc: ri('import 3d') },
    ],
    [],
  )

  const effectsSplit = useMemo(
    () => [
      { label: 'Material', iconSrc: ri('material') },
      { label: 'Color', iconSrc: ri('color') },
    ],
    [],
  )

  const modifySplit = useMemo(
    () => [
      { label: 'Group', iconSrc: ri('group') },
      { label: 'Lock', iconSrc: ri('lock') },
      { label: 'Anchor', iconSrc: ri('anchor') },
    ],
    [],
  )

  const workflowToggles = useMemo(
    () => [
      { id: 'toolbox' as const, label: 'Toolbox', iconSrc: ri('toolbox') },
      { id: 'explorer' as const, label: 'Explorer', iconSrc: ri('explorer') },
      { id: 'properties' as const, label: 'Properties', iconSrc: ri('properties') },
      { id: 'asset-manager' as const, label: 'Asset Manager', iconSrc: ri('asset manager') },
    ],
    [],
  )

  const handleTabChange = useCallback((tab: RibbonTab) => {
    setActiveTab(tab)
  }, [])

  const toggleWorkflow = useCallback((id: WorkflowPanelToggle) => {
    setWorkflowOn((prev) => ({ ...prev, [id]: !prev[id] }))
  }, [])

  const toggleRibbonProperties = useCallback(() => {
    if (ribbonInspectorDismissTimerRef.current !== null) {
      window.clearTimeout(ribbonInspectorDismissTimerRef.current)
      ribbonInspectorDismissTimerRef.current = null
    }
    setRibbonInspectorExitAnimating(false)

    const isOpen = inspectorWidget?.zone === 'right-bottom'

    if (!isOpen) {
      dockWidget('inspector', 'right-bottom')
      return
    }

    const reduceMotion =
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reduceMotion) {
      undockWidget('inspector')
      setRibbonInspectorExitAnimating(false)
      return
    }

    setRibbonInspectorExitAnimating(true)
    ribbonInspectorDismissTimerRef.current = window.setTimeout(() => {
      undockWidget('inspector')
      setRibbonInspectorExitAnimating(false)
      ribbonInspectorDismissTimerRef.current = null
    }, 200)
  }, [inspectorWidget?.zone, dockWidget, undockWidget, setRibbonInspectorExitAnimating])

  const toggleRibbonAssetManager = useCallback(() => {
    // Ensure the assets widget is docked in the bottom zone so there's something to show.
    if (!assetsWidget) {
      dockWidget('assets', 'center-bottom')
    }
    // Expand if collapsed; collapse if currently expanded.
    toggleCenterBottomCollapsed()
  }, [assetsWidget, dockWidget, toggleCenterBottomCollapsed])

  return (
    <div className={styles.root}>
      {/* Row 1 — Menu bar */}
      <nav className={styles.menuBar} aria-label="Application menu">
        {MENU_LABELS.map((label) => (
          <button key={label} type="button" className={styles.menuItem}>
            {label}
          </button>
        ))}
      </nav>

      {/* Row 2 — Mezzanine */}
      <div className={styles.mezzanine}>
        <div className={styles.mezzanineLeft}>
          <div className={styles.testSelectWrapper}>
            <label htmlFor={`${tabsId}-test-run`} className={styles.visuallyHidden}>
              Test run preset
            </label>
            <select id={`${tabsId}-test-run`} className={styles.testSelect} defaultValue="Test">
              <option value="Test">Test</option>
              <option value="Other">Other</option>
            </select>
            <ChevronDown
              className={styles.testSelectChevronIcon}
              size={ICON_CHEVRON}
              aria-hidden
              strokeWidth={2}
            />
          </div>
          <div className={styles.playbackButtons}>
            <button type="button" className={styles.iconBtn24} aria-label="Play">
              <img src={publicUrl('icons/play.svg')} width={ICON_MEZZANINE} height={ICON_MEZZANINE} aria-hidden alt="" />
            </button>
            <button type="button" className={styles.iconBtn24} aria-label="Pause">
              <img src={publicUrl('icons/pause.svg')} width={ICON_MEZZANINE} height={ICON_MEZZANINE} aria-hidden alt="" />
            </button>
            <button type="button" className={styles.iconBtn24} aria-label="Stop">
              <Square size={ICON_MEZZANINE} aria-hidden strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className={styles.tabsRail} aria-hidden={false}>
          <div className={styles.tabsRailInner} role="tablist" aria-label="Ribbon tabs">
            {RIBBON_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={activeTab === t.id}
                className={styles.tab}
                data-selected={activeTab === t.id ? 'true' : 'false'}
                onClick={() => handleTabChange(t.id)}
              >
                {t.label}
              </button>
            ))}
            <button type="button" className={`${styles.tab} ${styles.tabPlus}`} aria-label="Add tab">
              <Plus size={ICON_MEZZANINE} aria-hidden strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className={styles.userRail}>
          {/* Static Nebula toggle for the AI Assistant. Intentionally
           *  uses no .nebulaAnimating / pillIconSpin classes — the icon
           *  is the launcher affordance, not a status indicator, so it
           *  must sit still. Animated variants live elsewhere (the
           *  MessageList "Thinking..." status row + BackgroundTaskDrawer
           *  task pill) and are scoped to that meaning. */}
          <button
            type="button"
            className={`${styles.iconBtn24} ${aiPanelVisible ? styles.nebulaToggleActive : ''}`}
            aria-label="AI Assistant"
            aria-pressed={aiPanelVisible}
            title="AI Assistant"
            onClick={toggleAIAssistant}
          >
            <img
              src={nebulaIcon}
              alt=""
              aria-hidden="true"
              width={ICON_MEZZANINE}
              height={ICON_MEZZANINE}
              className={styles.nebulaToggleIcon}
            />
          </button>
          <button type="button" className={styles.iconBtn24} aria-label="Notifications">
            <Bell size={ICON_MEZZANINE} aria-hidden strokeWidth={2} />
          </button>
          <div className={styles.userDivider} aria-hidden />
          <button type="button" className={styles.iconBtn24} aria-label="Messages">
            <MessageSquare size={ICON_MEZZANINE} aria-hidden strokeWidth={2} />
          </button>
          <button type="button" className={styles.iconBtn24} aria-label="More">
            <MoreVertical size={ICON_MEZZANINE} aria-hidden strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className={styles.rowDivider} aria-hidden />

      {/* Row 3 — Ribbon content */}
      <div className={styles.ribbonContent} role="toolbar" aria-label="Home ribbon">
        <div className={styles.toolGroup}>
          {MANIPULATOR_CONFIG.filter(({ id }) => id !== 'geometric').map(({ id, label, iconSrc }) => {
            const bound = isEditorBackedManipulator(id)
            const pressed = bound && activeTool === id
            return (
              <ToggleButton
                key={id}
                label={label}
                iconSrc={iconSrc}
                pressed={!!pressed}
                disabled={!bound}
                onClick={
                  !bound
                    ? undefined
                    : id === 'select'
                      ? () => setActiveTool('select')
                      : () => setActiveTool(activeTool === id ? 'select' : id)
                }
              />
            )
          })}
        </div>

        <div className={styles.groupDivider} aria-hidden />

        <div className={styles.toolGroup}>
          {MANIPULATOR_CONFIG.filter(({ id }) => id === 'geometric').map(({ id, label, iconSrc }) => (
            <ToggleButton key={id} label={label} iconSrc={iconSrc} pressed={false} disabled onClick={undefined} />
          ))}
          <SpinboxPair />
        </div>

        <div className={styles.groupDivider} aria-hidden />

        <div className={styles.toolGroup}>
          {splitProps.map(({ label, iconSrc }) => (
            <SplitButton key={label} label={label} iconSrc={iconSrc} />
          ))}
        </div>

        <div className={styles.groupDivider} aria-hidden />

        <div className={styles.toolGroup}>
          {effectsSplit.map(({ label, iconSrc }) => (
            <SplitButton key={label} label={label} iconSrc={iconSrc} />
          ))}
        </div>

        <div className={styles.groupDivider} aria-hidden />

        <div className={styles.toolGroup}>
          {modifySplit.map(({ label, iconSrc }) => (
            <SplitButton key={label} label={label} iconSrc={iconSrc} />
          ))}
        </div>

        <div className={styles.groupDivider} aria-hidden />

        <div className={styles.toolGroup}>
          {workflowToggles.map(({ id, label, iconSrc }) => {
            if (studioMode === 'ribbon' && id === 'properties') {
              return (
                <ToggleButton
                  key={id}
                  label={label}
                  iconSrc={iconSrc}
                  pressed={inspectorWidget?.zone === 'right-bottom' && !ribbonInspectorExitAnimating}
                  onClick={toggleRibbonProperties}
                />
              )
            }
            if (id === 'asset-manager') {
              return (
                <ToggleButton
                  key={id}
                  label={label}
                  iconSrc={iconSrc}
                  pressed={!!assetsWidget && !centerBottomCollapsed}
                  onClick={toggleRibbonAssetManager}
                />
              )
            }
            return (
              <ToggleButton
                key={id}
                label={label}
                iconSrc={iconSrc}
                pressed={!!workflowOn[id]}
                onClick={() => toggleWorkflow(id)}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
