import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TrafficLights } from '../../components/TrafficLights'
import { useAppStore } from '../../stores/app-store'
import { useMinimizeAnimation } from '../../hooks/useMinimizeAnimation'
import { useFitWindowToViewport } from '../../hooks/useFitWindowToViewport'
import { WINDOW_DROP_SHADOW } from '../../styles/window-shadow'
import { FONT_STACK } from '../../styles/typography'
import {
  MENU_BAR_H,
  DOCK_H,
  HANDLE,
  MOBILE_BREAKPOINT,
} from '../../constants/window-chrome'
import plusMediumSvg from '../../../assets/sf-symbols/plus--monochrome--medium.svg?raw'
import trashMediumSvg from '../../../assets/sf-symbols/trash--monochrome--medium.svg?raw'

/**
 * Arc accent — indigo, used as the SearchDialog selected-row background.
 * Intentionally distinct from Notes (gold) and Photos (macOS blue) per
 * design audit Slice 3 — each app carries its own accent identity.
 * The bookmark color palette in `SAVED_LINKS` below is a separate,
 * data-driven brand-color list (LinkedIn, GitHub, etc.) — those aren't
 * the Arc app accent and shouldn't be unified with this value.
 */
const ARC_ACCENT = '#5046E5'

/* ─── helpers ─── */

function useFaviconColor(url: string, fallback = '#1f1f1f'): string {
  const [color, setColor] = useState(fallback)

  useEffect(() => {
    if (!url) {
      setColor(fallback)
      return
    }

    let hostname: string
    try {
      hostname = new URL(url).hostname
    } catch {
      setColor(fallback)
      return
    }

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const w = img.naturalWidth
      const h = img.naturalHeight
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(img, 0, 0)
      const data = ctx.getImageData(0, 0, w, h).data

      // Find the most "colorful" dominant color by ignoring near-white/near-black pixels
      let rSum = 0, gSum = 0, bSum = 0, count = 0
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
        if (a < 128) continue // skip transparent
        const brightness = (r + g + b) / 3
        if (brightness > 240 || brightness < 15) continue // skip near-white/black
        rSum += r
        gSum += g
        bSum += b
        count++
      }

      if (count === 0) {
        setColor(fallback)
        return
      }

      const rAvg = Math.round(rSum / count)
      const gAvg = Math.round(gSum / count)
      const bAvg = Math.round(bSum / count)

      // Darken the color so text stays readable (mix with dark)
      const mix = 0.35
      const rDark = Math.round(rAvg * mix)
      const gDark = Math.round(gAvg * mix)
      const bDark = Math.round(bAvg * mix)

      setColor(`rgb(${rDark}, ${gDark}, ${bDark})`)
    }
  }, [url, fallback])

  return color
}

/* ─── resize types ─── */

type Dir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

// Per-app floors stay local — Arc keeps the viewport usable at 300x300.
const MIN_W = 300
const MIN_H = 300
const SIDEBAR_DEFAULT = 232
const SIDEBAR_MIN = 160
const SIDEBAR_MAX = 400

const CURSORS: Record<Dir, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
  sw: 'nesw-resize',
}

function handleStyle(dir: Dir): React.CSSProperties {
  const h = HANDLE
  const base: React.CSSProperties = { position: 'absolute', cursor: CURSORS[dir] }

  switch (dir) {
    case 'n':
      return { ...base, top: -h / 2, left: h, right: h, height: h }
    case 's':
      return { ...base, bottom: -h / 2, left: h, right: h, height: h }
    case 'e':
      return { ...base, right: -h / 2, top: h, bottom: h, width: h }
    case 'w':
      return { ...base, left: -h / 2, top: h, bottom: h, width: h }
    case 'nw':
      return { ...base, top: -h / 2, left: -h / 2, width: h * 2, height: h * 2 }
    case 'ne':
      return { ...base, top: -h / 2, right: -h / 2, width: h * 2, height: h * 2 }
    case 'sw':
      return { ...base, bottom: -h / 2, left: -h / 2, width: h * 2, height: h * 2 }
    case 'se':
      return { ...base, bottom: -h / 2, right: -h / 2, width: h * 2, height: h * 2 }
  }
}

function clampMove(r: Rect): Rect {
  const vw = window.innerWidth

  let { x, y } = r
  const { w, h } = r

  if (y < MENU_BAR_H) y = MENU_BAR_H
  if (x < 0) x = 0
  if (x + w > vw) x = vw - w

  return { x, y, w, h }
}

function clampResize(r: Rect): Rect {
  const vw = window.innerWidth

  let { x, y, w, h } = r

  if (y < MENU_BAR_H) {
    const overflow = MENU_BAR_H - y
    y = MENU_BAR_H
    h = Math.max(MIN_H, h - overflow)
  }

  if (x < 0) x = 0

  if (x + w > vw) {
    w = Math.max(MIN_W, vw - x)
  }

  return { x, y, w, h }
}

function applyResize(start: Rect, dir: Dir, dx: number, dy: number): Rect {
  const next = { ...start }

  if (dir.includes('e')) {
    next.w = Math.max(MIN_W, start.w + dx)
  }
  if (dir.includes('w')) {
    const newW = Math.max(MIN_W, start.w - dx)
    next.x = start.x + (start.w - newW)
    next.w = newW
  }
  if (dir.includes('s')) {
    next.h = Math.max(MIN_H, start.h + dy)
  }
  if (dir === 'n' || dir === 'ne' || dir === 'nw') {
    const newH = Math.max(MIN_H, start.h - dy)
    next.y = start.y + (start.h - newH)
    next.h = newH
  }

  return clampResize(next)
}

const ALL_DIRS: Dir[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']

/* ─── sidebar tree types ─── */

interface TabNode {
  type: 'tab'
  id: number
  url: string
  title?: string
}

interface FolderNode {
  type: 'folder'
  id: number
  label: string
  expanded: boolean
  children: SidebarNode[]
}

type SidebarNode = TabNode | FolderNode

function findAllTabs(nodes: SidebarNode[]): TabNode[] {
  const result: TabNode[] = []
  for (const node of nodes) {
    if (node.type === 'tab') result.push(node)
    else result.push(...findAllTabs(node.children))
  }
  return result
}

function removeNode(nodes: SidebarNode[], id: number): SidebarNode[] {
  return nodes
    .filter(n => n.id !== id)
    .map(n => n.type === 'folder' ? { ...n, children: removeNode(n.children, id) } : n)
}

function toggleFolder(nodes: SidebarNode[], id: number): SidebarNode[] {
  return nodes.map(n => {
    if (n.type === 'folder' && n.id === id) return { ...n, expanded: !n.expanded }
    if (n.type === 'folder') return { ...n, children: toggleFolder(n.children, id) }
    return n
  })
}

/**
 * Stable id for the dedicated "Other Tabs" section that the sidebar's
 * footer plus button writes into. Lives outside the year folders so
 * newly-added tabs don't get buried inside an existing year/topic
 * tree. -100 is far below any id seed value used by the initial state
 * (current floor is -8) so it can't collide.
 */
const NEW_LINKS_FOLDER_ID = -100

/**
 * Append a tab to the dedicated "Other Tabs" section, creating that
 * section at the end of the root sidebar tree on first call. Lazy
 * creation means the folder doesn't show up in the sidebar until the
 * user has actually added at least one tab via the footer plus button,
 * which avoids an empty "Other Tabs" header sitting under the year
 * folders before the feature has been used. The label follows Arc's
 * own vernacular for the un-categorized bucket rather than a generic
 * "Links".
 */
function appendToNewLinksFolder(nodes: SidebarNode[], tab: TabNode): SidebarNode[] {
  const idx = nodes.findIndex(n => n.type === 'folder' && n.id === NEW_LINKS_FOLDER_ID)
  if (idx >= 0) {
    const folder = nodes[idx] as FolderNode
    const next = [...nodes]
    next[idx] = { ...folder, children: [...folder.children, tab], expanded: true }
    return next
  }
  const newFolder: FolderNode = {
    type: 'folder',
    id: NEW_LINKS_FOLDER_ID,
    label: 'Other Tabs',
    expanded: true,
    children: [tab],
  }
  return [...nodes, newFolder]
}

function updateTabUrl(nodes: SidebarNode[], tabId: number, url: string): SidebarNode[] {
  return nodes.map(n => {
    if (n.type === 'tab' && n.id === tabId) return { ...n, url }
    if (n.type === 'folder') return { ...n, children: updateTabUrl(n.children, tabId, url) }
    return n
  })
}

function findTab(nodes: SidebarNode[], id: number): TabNode | undefined {
  for (const n of nodes) {
    if (n.type === 'tab' && n.id === id) return n
    if (n.type === 'folder') {
      const found = findTab(n.children, id)
      if (found) return found
    }
  }
}


/* ─── sidebar sub-components ─── */


function SidebarIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex size-6 items-center justify-center rounded text-white/40">
      {children}
    </div>
  )
}

function SidebarToggle({ onClick }: { onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{ cursor: 'default' }}>
      <SidebarIcon>
        <svg width="14" height="14" viewBox="0 0 18 14" fill="none">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M2 0C0.895 0 0 0.895 0 2V12C0 13.105 0.895 14 2 14H16C17.105 14 18 13.105 18 12V2C18 0.895 17.105 0 16 0H2ZM16 1.5H7.75V12.5H16C16.276 12.5 16.5 12.276 16.5 12V2C16.5 1.724 16.276 1.5 16 1.5ZM2 1.5H6.25V12.5H2C1.724 12.5 1.5 12.276 1.5 12V2C1.5 1.724 1.724 1.5 2 1.5Z"
            fill="currentColor"
          />
          <line x1="3" y1="3.5" x2="5" y2="3.5" stroke="currentColor" strokeWidth="1" />
          <line x1="3" y1="5.5" x2="5" y2="5.5" stroke="currentColor" strokeWidth="1" />
          <line x1="3" y1="7.5" x2="5" y2="7.5" stroke="currentColor" strokeWidth="1" />
        </svg>
      </SidebarIcon>
    </div>
  )
}

function NavControls({
  loading,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  onRefresh,
  onStop,
}: {
  loading?: boolean
  canGoBack?: boolean
  canGoForward?: boolean
  onBack?: () => void
  onForward?: () => void
  onRefresh?: () => void
  onStop?: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <div onClick={canGoBack ? onBack : undefined} style={{ cursor: canGoBack ? 'default' : undefined }}>
        <SidebarIcon>
          <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
            <path
              d="M6.5 1.5L1.5 6M1.5 6L6.5 10.5M1.5 6H15"
              stroke="white"
              strokeOpacity={canGoBack ? 0.4 : 0.2}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </SidebarIcon>
      </div>
      <div onClick={canGoForward ? onForward : undefined} style={{ cursor: canGoForward ? 'default' : undefined }}>
        <SidebarIcon>
          <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
            <path
              d="M9.5 1L14.5 5.5M14.5 5.5L9.5 10M14.5 5.5H1"
              stroke="white"
              strokeOpacity={canGoForward ? 0.4 : 0.2}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </SidebarIcon>
      </div>
      <div
        onClick={loading ? onStop : onRefresh}
        style={{ cursor: 'default' }}
      >
        <SidebarIcon>
          {loading ? (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path
                d="M1 1L11 11M11 1L1 11"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <svg width="16" height="12" viewBox="0 0 16 14" fill="none">
              <path
                d="M13.5 3L11 0.5M13.5 3L11 5.5M13.5 3H9C5.69 3 3 5.69 3 9C3 12.31 5.69 15 9 15C12.31 15 15 12.31 15 9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                transform="translate(0, -1)"
              />
            </svg>
          )}
        </SidebarIcon>
      </div>
    </div>
  )
}


function PinnedTab({ children, label, active, gradient, onClick }: { children: React.ReactNode; label: string; active?: boolean; gradient?: string; onClick?: () => void }) {
  const [hovered, setHovered] = useState(false)

  const colors = gradient?.split(',').map(c => c.trim()) ?? []
  const activeBg = colors.length
    ? `linear-gradient(135deg, ${colors.map(c => c + '30').join(', ')}), linear-gradient(rgba(255,255,255,0.22), rgba(255,255,255,0.22))`
    : 'rgba(255, 255, 255, 0.22)'
  const activeShadow = colors.length
    ? `inset 0 0 0 1.5px ${colors[0]}88`
    : 'inset 0 0 0 1.5px rgba(255, 255, 255, 0.2)'

  let bg = 'rgba(255, 255, 255, 0.08)'
  if (active) bg = activeBg
  else if (hovered) bg = 'rgba(255, 255, 255, 0.14)'

  return (
    <div
      className="flex min-w-0 flex-1 items-center justify-center rounded-xl"
      style={{
        minWidth: 50,
        height: 46,
        background: bg,
        boxShadow: active ? activeShadow : undefined,
        cursor: onClick ? 'pointer' : undefined,
        transition: 'background 0.2s, box-shadow 0.2s',
      }}
      title={label}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {children}
    </div>
  )
}

function PinnedTabs({ activeUrl, onNavigate }: { activeUrl?: string; onNavigate?: (url: string) => void }) {
  const isActive = (tabUrl: string) => !!activeUrl && activeUrl.includes(new URL(tabUrl).hostname)

  return (
    <div className="flex flex-wrap gap-2">
      <PinnedTab label="LinkedIn" gradient="#0A66C2, #0077B5" active={isActive('https://www.linkedin.com/in/emilyhlouie/')} onClick={() => !isActive('https://www.linkedin.com/in/emilyhlouie/') && onNavigate?.('https://www.linkedin.com/in/emilyhlouie/')}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M13.633 13.635h-2.37V9.922c0-.886-.016-2.025-1.234-2.025-1.235 0-1.424.964-1.424 1.96v3.778H6.234V5.998h2.275v1.044h.032c.317-.6 1.09-1.233 2.246-1.233 2.401 0 2.845 1.58 2.845 3.637v4.189zM3.558 4.955a1.376 1.376 0 1 1 0-2.752 1.376 1.376 0 0 1 0 2.752zm1.187 8.68H2.37V5.998h2.376v7.637z" fill="white" />
        </svg>
      </PinnedTab>
      <PinnedTab label="Letterboxd" gradient="#FF8000, #00E054, #40BCF4" active={isActive('https://letterboxd.com/emuhlez/')} onClick={() => !isActive('https://letterboxd.com/emuhlez/') && onNavigate?.('https://letterboxd.com/emuhlez/')}>
        <svg width="16" height="16" viewBox="0 0 262 97" fill="none">
          <ellipse fill="#FF8000" cx="48.573" cy="48.5" rx="48.573" ry="48.5" />
          <ellipse fill="#00E054" cx="131" cy="48.5" rx="48.573" ry="48.5" />
          <ellipse fill="#40BCF4" cx="213.427" cy="48.5" rx="48.573" ry="48.5" />
          <path fill="#556677" d="M89.787,74.179 C85.123,66.732 82.427,57.93 82.427,48.499 C82.427,39.069 85.123,30.267 89.787,22.82 C94.45,30.267 97.146,39.069 97.146,48.499 C97.146,57.93 94.45,66.732 89.787,74.179Z" />
          <path fill="#556677" d="M172.213,22.82 C176.877,30.267 179.573,39.069 179.573,48.499 C179.573,57.93 176.877,66.732 172.213,74.179 C167.55,66.732 164.854,57.93 164.854,48.499 C164.854,39.069 167.55,30.267 172.213,22.82Z" />
        </svg>
      </PinnedTab>
      <PinnedTab label="Strava" gradient="#FC4C02, #F9B797" active={isActive('https://www.strava.com/athletes/63689786')} onClick={() => !isActive('https://www.strava.com/athletes/63689786') && onNavigate?.('https://www.strava.com/athletes/63689786')}>
        <svg width="16" height="16" viewBox="0 0 64 64" fill="none">
          <path d="M41.03 47.852l-5.572-10.976h-8.172L41.03 64l13.736-27.124h-8.18" fill="#F9B797" />
          <path d="M27.898 21.944l7.564 14.928h11.124L27.898 0 9.234 36.876H20.35" fill="#F05222" />
        </svg>
      </PinnedTab>
    </div>
  )
}

function TabItem({ icon, label, active = false, bold = false, onClick, onClose }: { icon: React.ReactNode; label: string; active?: boolean; bold?: boolean; onClick?: () => void; onClose?: () => void }) {
  const [hovered, setHovered] = useState(false)

  let bg: string | undefined
  if (active) bg = 'rgba(255, 255, 255, 0.28)'
  else if (hovered) bg = 'rgba(255, 255, 255, 0.1)'

  return (
    <div
      className="group/tab flex items-center gap-2 rounded-xl px-4"
      style={{ height: 40, background: bg, transition: 'background 0.15s', cursor: 'default' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      <span className="shrink-0">{icon}</span>
      <span
        className={`truncate text-[12px] ${bold ? 'font-semibold' : ''}`}
        style={{ color: active || hovered ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)' }}
      >
        {label}
      </span>
      {onClose && (
        <TabCloseButton onClick={(e) => { e.stopPropagation(); onClose() }} />
      )}
    </div>
  )
}

function SidebarNodeItem({
  node,
  depth,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onToggleFolder,
}: {
  node: SidebarNode
  depth: number
  activeTabId: number | null
  onSelectTab: (id: number) => void
  onCloseTab: (id: number) => void
  onToggleFolder: (id: number) => void
}) {
  if (node.type === 'tab') {
    let hostname: string
    try { hostname = new URL(node.url).hostname.replace(/^www\./, '') } catch { hostname = node.url }
    const label = node.title || hostname
    return (
      <div style={{ paddingLeft: depth * 16 }}>
        <TabItem
          icon={
            <img
              src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=32`}
              width={16}
              height={16}
              alt=""
              className="shrink-0 rounded-sm"
            />
          }
          label={label}
          active={node.id === activeTabId}
          onClick={() => onSelectTab(node.id)}
          onClose={() => onCloseTab(node.id)}
        />
      </div>
    )
  }

  const hasKids = node.children.length > 0

  return (
    <div>
      <div style={{ paddingLeft: depth * 16 }}>
        <TabItem
          icon={
            <div className="relative" style={{ width: 18, height: 18 }}>
              <AnimatePresence initial={false}>
                {hasKids && node.expanded ? (
                  <motion.div
                    key="open"
                    className="absolute inset-0"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <FolderOpenIcon />
                  </motion.div>
                ) : (
                  <motion.div
                    key="closed"
                    className="absolute inset-0"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <FolderIcon />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          }
          label={node.label}
          bold
          onClick={() => onToggleFolder(node.id)}
        />
      </div>
      <AnimatePresence initial={false}>
        {node.expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            {node.children.map(child => (
              <SidebarNodeItem
                key={child.id}
                node={child}
                depth={depth + 1}
                activeTabId={activeTabId}
                onSelectTab={onSelectTab}
                onCloseTab={onCloseTab}
                onToggleFolder={onToggleFolder}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function FolderIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      {/* Back panel */}
      <path d="M0 3C0 1.343 1.343 0 3 0H6.948C7.629 0 8.29 0.232 8.822 0.657L9.678 1.343C10.21 1.768 10.871 2 11.552 2H15C16.657 2 18 3.343 18 5V13C18 14.657 16.657 16 15 16H3C1.343 16 0 14.657 0 13V3Z" fill="white" fillOpacity="0.15" />
      <path d="M3 0.75H6.947C7.458 0.75 7.955 0.924 8.354 1.243L9.21 1.929C9.875 2.46 10.701 2.75 11.553 2.75H15C16.243 2.75 17.25 3.757 17.25 5V13C17.25 14.243 16.243 15.25 15 15.25H3C1.757 15.25 0.75 14.243 0.75 13V3C0.75 1.757 1.757 0.75 3 0.75Z" stroke="white" strokeOpacity="0.7" strokeWidth="1.5" />
      {/* Front panel */}
      <rect x="0" y="5" width="18" height="11" rx="3" fill="black" />
      <rect x="0.75" y="5.75" width="16.5" height="9.5" rx="2.25" stroke="white" strokeOpacity="0.7" strokeWidth="1.5" />
    </svg>
  )
}

function FolderOpenIcon() {
  return (
    <svg width="18" height="16" viewBox="0 0 18 16" fill="none">
      {/* Back panel with tab */}
      <path d="M0 3C0 1.343 1.343 0 3 0H6.948C7.629 0 8.29 0.232 8.822 0.657L9.678 1.343C10.21 1.768 10.871 2 11.552 2H15C16.657 2 18 3.343 18 5V5H0V3Z" fill="white" fillOpacity="0.15" />
      <path d="M3 0.75H6.947C7.458 0.75 7.955 0.924 8.354 1.243L9.21 1.929C9.875 2.46 10.701 2.75 11.553 2.75H15C16.243 2.75 17.25 3.757 17.25 5V5H0.75V3C0.75 1.757 1.757 0.75 3 0.75Z" stroke="white" strokeOpacity="0.7" strokeWidth="1.5" />
      {/* Open front flap */}
      <path d="M0 7C0 5.895 0.895 5 2 5H16C17.105 5 18 5.895 18 7L16.5 13C16.5 14.105 15.605 15 14.5 15H3.5C2.395 15 1.5 14.105 1.5 13L0 7Z" fill="black" />
      <path d="M0.75 7C0.75 6.31 1.31 5.75 2 5.75H16C16.69 5.75 17.25 6.31 17.25 7L15.82 12.87C15.72 13.56 15.16 14.25 14.5 14.25H3.5C2.84 14.25 2.28 13.56 2.18 12.87L0.75 7Z" stroke="white" strokeOpacity="0.7" strokeWidth="1.5" />
    </svg>
  )
}

function GlobeIcon({ opacity = 0.4 }: { opacity?: number }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0" style={{ minWidth: 16, minHeight: 16 }}>
      <circle cx="8" cy="8" r="6" stroke="white" strokeOpacity={opacity} strokeWidth="1.2" />
      <ellipse cx="8" cy="8" rx="3" ry="6" stroke="white" strokeOpacity={opacity} strokeWidth="1.2" />
      <line x1="2" y1="8" x2="14" y2="8" stroke="white" strokeOpacity={opacity} strokeWidth="1.2" />
    </svg>
  )
}

/* Sidebar-footer glyphs render the canonical SF Symbols (plus / trash,
 *  monochrome medium) from assets/sf-symbols/ to comply with the
 *  use-sf-symbols-only project rule, replacing the previous hand-drawn
 *  SVGs. The symbols paint with `currentColor`, so the wrapper's
 *  `color` reproduces the prior `rgba(255,255,255,0.4)` tint, and the
 *  14×14 box keeps the original footer sizing. */
function PlusIcon() {
  return (
    <span
      aria-label="New tab"
      className="inline-flex shrink-0 [&>svg]:block"
      style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.4)' }}
      dangerouslySetInnerHTML={{ __html: plusMediumSvg }}
    />
  )
}

function TrashIcon() {
  return (
    <span
      aria-label="Trash"
      className="inline-flex shrink-0 [&>svg]:block"
      style={{ width: 14, height: 14, color: 'rgba(255,255,255,0.4)' }}
      dangerouslySetInnerHTML={{ __html: trashMediumSvg }}
    />
  )
}

function ArcTopbar({
  color,
  url,
  sidebarCollapsed,
  canGoBack,
  canGoForward,
  onToggleSidebar,
  onBack,
  onForward,
  onRefresh,
  onStop,
  onOpenSearch,
  loading,
}: {
  color: string
  url: string
  sidebarCollapsed?: boolean
  canGoBack?: boolean
  canGoForward?: boolean
  onToggleSidebar?: () => void
  onBack?: () => void
  onForward?: () => void
  onRefresh?: () => void
  onStop?: () => void
  onOpenSearch?: () => void
  loading?: boolean
}) {
  const displayUrl = url ? url.replace(/^https?:\/\//, '').replace(/\/$/, '') : ''

  return (
    <div className="sticky top-0 z-10" style={{ background: color, transition: 'background 0.4s ease' }}>
      <div className="relative flex items-center px-3" style={{ height: 36 }}>
        {/* Left controls */}
        <div className="relative z-10 flex items-center gap-2">
          {sidebarCollapsed && <SidebarToggle onClick={onToggleSidebar} />}
          <NavControls
            loading={loading}
            canGoBack={canGoBack}
            canGoForward={canGoForward}
            onBack={onBack}
            onForward={onForward}
            onRefresh={onRefresh}
            onStop={onStop}
          />
        </div>

        {/* URL display – click to open search dialog */}
        <div className="absolute inset-0 flex items-center justify-center px-28">
          <div
            className="flex min-w-0 max-w-full cursor-text items-center gap-1.5 truncate rounded-md px-2.5 py-1 text-[12px] font-medium text-white transition-colors hover:bg-white/[0.08]"
            onClick={onOpenSearch}
          >
            <GlobeIcon />
            <span className="truncate">{displayUrl}</span>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: 0.5, background: 'rgba(0, 0, 0, 0.08)' }} />
    </div>
  )
}

const SAVED_LINKS = [
  { label: 'LinkedIn – Emily Louie', url: 'https://www.linkedin.com/in/emilyhlouie/', icon: 'linkedin', color: '#0A66C2' },
  { label: 'Letterboxd – emuhlez', url: 'https://letterboxd.com/emuhlez/', icon: 'letterboxd', color: '#00E054' },
  { label: 'Strava – Emily Louie', url: 'https://www.strava.com/athletes/63689786', icon: 'strava', color: '#FC4C02' },
  { label: 'GitHub – emilyhlouie', url: 'https://github.com/emilyhlouie', icon: 'github', color: '#8B5CF6' },
  { label: 'Spotify – Emily', url: 'https://open.spotify.com/', icon: 'spotify', color: '#1DB954' },
] as const

/**
 * Open a URL in the user's real browser, bypassing our iframe / nav
 * interception entirely. Sites with `frame-ancestors 'none'` CSP or
 * fully-client-rendered SPAs (Next.js with empty SSR, etc.) won't
 * render meaningfully inside ProxiedIframe; this is the escape hatch.
 *
 * In dev / web build: `window.open(_, '_blank')` opens a new browser
 * tab. In Electron we'd want shell.openExternal — that path is wired
 * up in the preload script's window.open shim if present; if not, the
 * Electron build silently uses the same window.open fallback.
 */
function openInRealBrowser(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

function SitePreview({ url }: { url: string }) {
  const link = SAVED_LINKS.find(l => url.includes(new URL(l.url).hostname))
  const hostname = (() => { try { return new URL(url).hostname } catch { return url } })()

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-6" style={{ background: '#1a1a2e' }}>
      <img
        src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=128`}
        width={64}
        height={64}
        alt=""
        className="rounded-2xl"
        style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}
      />
      <div className="flex flex-col items-center gap-1.5">
        <span className="text-[15px] font-medium text-white/90">
          {link?.label ?? hostname}
        </span>
        <span className="text-[12px] text-white/30">
          {hostname}
        </span>
      </div>
      {/* Escape hatch for sites that don't iframe well. Stops the user
       *  from staring at a blank rectangle with no path forward.
       *
       *  This is Arc's CTA pill recipe: `rounded-full` capsule (the
       *  macOS prominent-button shape, deliberately distinct from the
       *  `rounded-xl` tab rows and `rounded-md` URL chip), with the
       *  full hover/pressed/focus-visible state set so it reads as a
       *  real button. Reuse this recipe for any future Arc CTA. */}
      <button
        type="button"
        onClick={() => openInRealBrowser(url)}
        className="rounded-full px-4 py-2 text-[12px] font-medium text-white/85 outline-none transition-colors hover:bg-white/[0.08] active:bg-white/[0.04] focus-visible:ring-1 focus-visible:ring-white/30"
        style={{ border: '1px solid rgba(255,255,255,0.18)', cursor: 'default' }}
      >
        Open in browser
      </button>
    </div>
  )
}

/**
 * Parse a YouTube timestamp query value into seconds.
 *
 * YouTube accepts several formats in the `t=` / `start=` param:
 *   - `12915`        bare integer seconds
 *   - `12915s`       integer with trailing `s`
 *   - `2m15s`        minutes + seconds
 *   - `1h2m3s`       hours + minutes + seconds
 *   - `30m` / `1h`   partial composites
 *
 * Returns null for empty / malformed input or zero (so we don't bother
 * appending `?start=0` to embed URLs that have no real offset).
 */
function parseYouTubeTimestamp(raw: string | null | undefined): number | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (/^\d+$/.test(trimmed)) {
    const n = parseInt(trimmed, 10)
    return n > 0 ? n : null
  }
  const m = trimmed.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/i)
  if (!m || (!m[1] && !m[2] && !m[3])) return null
  const h = m[1] ? parseInt(m[1], 10) : 0
  const min = m[2] ? parseInt(m[2], 10) : 0
  const s = m[3] ? parseInt(m[3], 10) : 0
  const total = h * 3600 + min * 60 + s
  return total > 0 ? total : null
}

/**
 * Build a YouTube `/embed/` URL for the given share URL, preserving the
 * timestamp (`t=` or `start=`) and any playlist context (`list`, `index`)
 * that the user pasted in. Returns null for non-YouTube URLs.
 *
 * Previously this function pulled the video ID out and threw away the
 * rest of the URL — meaning `https://youtu.be/X?t=12915` and
 * `https://youtube.com/watch?v=X&t=12915` both loaded the video from
 * 0:00 because `start=` never made it onto the embed URL. The pasted
 * timestamp now survives the watch -> embed transformation.
 *
 * Supported source URL shapes:
 *   - `youtube.com/watch?v=<id>`        canonical share URL
 *   - `youtu.be/<id>`                   short share URL
 *   - `youtube.com/shorts/<id>`         vertical short
 *   - `youtube.com/live/<id>`           live broadcast
 *   - `youtube.com/embed/<id>`          already-embed URL (idempotent)
 */
function getYouTubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url)
    let videoId: string | null = null
    const slug = (prefix: string) => {
      if (!u.pathname.startsWith(prefix)) return null
      const rest = u.pathname.slice(prefix.length).split('/')[0]
      return rest || null
    }
    if (u.hostname.includes('youtube.com')) {
      if (u.searchParams.has('v')) videoId = u.searchParams.get('v')
      else videoId = slug('/shorts/') ?? slug('/live/') ?? slug('/embed/')
    } else if (u.hostname === 'youtu.be') {
      videoId = u.pathname.slice(1).split('/')[0] || null
    }
    if (!videoId) return null

    const params = new URLSearchParams()
    const startSec = parseYouTubeTimestamp(
      u.searchParams.get('t') ?? u.searchParams.get('start'),
    )
    if (startSec) params.set('start', String(startSec))
    const list = u.searchParams.get('list')
    if (list) params.set('list', list)
    const index = u.searchParams.get('index')
    if (index) params.set('index', index)

    const qs = params.toString()
    return qs
      ? `https://www.youtube.com/embed/${videoId}?${qs}`
      : `https://www.youtube.com/embed/${videoId}`
  } catch {
    return null
  }
}

// Proxy cache to avoid re-fetching pages we've already loaded
// Uses an LRU approach: evict oldest entries when cache exceeds MAX size
const MAX_PROXY_CACHE = 20
const proxyCache = new Map<string, string>()

function proxyCacheSet(url: string, blobUrl: string) {
  // If already cached, delete first so re-insertion moves it to the end (most recent)
  if (proxyCache.has(url)) {
    proxyCache.delete(url)
  }
  proxyCache.set(url, blobUrl)
  // Evict oldest entries
  while (proxyCache.size > MAX_PROXY_CACHE) {
    const oldest = proxyCache.keys().next().value!
    const oldBlobUrl = proxyCache.get(oldest)!
    proxyCache.delete(oldest)
    URL.revokeObjectURL(oldBlobUrl)
  }
}

// URLs that should be prefetched on first load (sidebar bookmarks + saved links)
const BOOKMARK_URLS = [
  'https://about.roblox.com/newsroom/2026/04/roblox-studio-going-agentic',
  'https://devforum.roblox.com/t/announcing-planning-mode-for-roblox-assistant/4580715',
  'https://www.youtube.com/watch?v=PVlCHE9pc50&t=12915',
  ...SAVED_LINKS.map(l => l.url),
]

// Prefetch bookmarked & saved links on first load
let prefetchStarted = false
function prefetchSavedLinks() {
  if (prefetchStarted) return
  prefetchStarted = true
  BOOKMARK_URLS.forEach(url => {
    if (getYouTubeEmbedUrl(url)) return
    fetch(`/api/iframe-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, mode: 'proxy' }),
    })
      .then(r => r.ok ? r.blob() : null)
      .then(blob => {
        if (blob) proxyCacheSet(url, URL.createObjectURL(blob))
      })
      .catch(() => {})
  })
}

function ProxiedIframe({ url, dragging }: { url: string; dragging: boolean }) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading')
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  // Double-buffer: keep the previous iframe visible while new one loads
  const [prevBlobUrl, setPrevBlobUrl] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const embedUrl = getYouTubeEmbedUrl(url)
  const prevUrlRef = useRef<string | null>(null)

  // Trigger prefetch on mount
  useEffect(() => { prefetchSavedLinks() }, [])

  useEffect(() => {
    if (embedUrl) {
      setBlobUrl(null)
      setPrevBlobUrl(null)
      setShowNew(true)
      setStatus('loading')
      return
    }

    // Check cache first
    const cached = proxyCache.get(url)
    if (cached) {
      setPrevBlobUrl(blobUrl)
      setBlobUrl(cached)
      setStatus('loaded')
      setShowNew(false)
      // Small delay then reveal
      requestAnimationFrame(() => setShowNew(true))
      return
    }

    setStatus('loading')
    setShowNew(false)
    // Keep previous blob visible during load
    if (blobUrl) setPrevBlobUrl(blobUrl)
    let cancelled = false

    fetch(`/api/iframe-check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, mode: 'proxy' }),
    })
      .then(r => {
        if (!r.ok) throw new Error('Proxy failed')
        return r.blob()
      })
      .then(blob => {
        if (cancelled) return
        const objectUrl = URL.createObjectURL(blob)
        proxyCacheSet(url, objectUrl)
        setBlobUrl(objectUrl)
        setStatus('loaded')
      })
      .catch(() => { if (!cancelled) setStatus('error') })

    prevUrlRef.current = url

    return () => {
      cancelled = true
      // Don't revoke - it's in the cache now
    }
  }, [url, embedUrl])

  // Crossfade: once new iframe loads, reveal it
  const handleNewLoad = () => {
    setShowNew(true)
    setStatus('loaded')
    // Clean up prev after transition
    setTimeout(() => setPrevBlobUrl(null), 300)
  }

  if (status === 'error') {
    return <SitePreview url={url} />
  }

  const iframeSrc = embedUrl ?? blobUrl

  return (
    <>
      {/* Progress bar at top during loading */}
      {status === 'loading' && (
        <div className="absolute top-0 left-0 right-0 z-10" style={{ height: 2 }}>
          <div
            className="h-full rounded-full"
            style={{
              background: 'rgba(255,255,255,0.6)',
              animation: 'arcProgress 1.5s ease-in-out infinite',
            }}
          />
          <style>{`
            @keyframes arcProgress {
              0% { width: 0%; margin-left: 0; }
              50% { width: 60%; margin-left: 10%; }
              100% { width: 0%; margin-left: 100%; }
            }
          `}</style>
        </div>
      )}
      {/* Previous iframe stays visible during transition */}
      {prevBlobUrl && !showNew && (
        <iframe
          src={prevBlobUrl}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            border: 'none',
            pointerEvents: 'none',
            opacity: 0.5,
            transition: 'opacity 0.2s ease-out',
          }}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
          allow="autoplay; encrypted-media; picture-in-picture"
        />
      )}
      {/* New iframe fades in */}
      {iframeSrc && (
        <iframe
          src={iframeSrc}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            border: 'none',
            pointerEvents: dragging ? 'none' : 'auto',
            opacity: showNew ? 1 : 0,
            transition: 'opacity 0.2s ease-in',
          }}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
          allow="autoplay; encrypted-media; picture-in-picture"
          onLoad={handleNewLoad}
          onError={() => setStatus('error')}
        />
      )}
      {/* Initial full-screen loader only if nothing to show yet */}
      {status === 'loading' && !prevBlobUrl && !blobUrl && (
        <div className="absolute inset-0" style={{ background: '#ffffff' }} />
      )}
    </>
  )
}

function SearchDialog({ url, onNavigate, onClose }: { url: string; onNavigate: (url: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState(url)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.select(), 0)
  }, [])

  // Unified, typed list of dropdown rows. Order mirrors the design and
  // matches Arc/Chrome omniboxes: direct "go to <url>" first when the query
  // is URL-shaped, then "search the web for <query>", then bookmark matches.
  // selectedIdx indexes into this single list so the keyboard handler can
  // dispatch by item.kind without ever re-classifying the raw query.
  type Item =
    | { kind: 'goto'; url: string }
    | { kind: 'search'; query: string }
    | { kind: 'bookmark'; link: typeof SAVED_LINKS[number] }

  const trimmedQuery = query.trim()
  const lowerQuery = trimmedQuery.toLowerCase()
  const isUrlShape =
    trimmedQuery.length > 0 &&
    (/^https?:\/\//i.test(trimmedQuery) || /^[^\s]+\.[^\s]+$/.test(trimmedQuery))

  const matchedBookmarks = trimmedQuery
    ? SAVED_LINKS.filter(
        l => l.label.toLowerCase().includes(lowerQuery) || l.url.toLowerCase().includes(lowerQuery),
      )
    : SAVED_LINKS

  const items: Item[] = []
  if (isUrlShape) items.push({ kind: 'goto', url: trimmedQuery })
  if (trimmedQuery.length > 0) items.push({ kind: 'search', query: trimmedQuery })
  for (const link of matchedBookmarks) items.push({ kind: 'bookmark', link })

  const commit = useCallback((targetUrl?: string) => {
    const finalTarget = targetUrl || query.trim()
    if (!finalTarget) { onClose(); return }
    const u = finalTarget
    if (/^https?:\/\//i.test(u)) {
      onNavigate(u)
    } else if (/^[^\s]+\.[^\s]+$/.test(u)) {
      // Bare domain — assume https. Mirrors the regex used to populate the
      // 'goto' row above, so the row's behavior matches what you see.
      onNavigate('https://' + u)
    } else {
      onNavigate(`https://www.google.com/search?q=${encodeURIComponent(u)}`)
    }
  }, [query, onNavigate, onClose])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(i => Math.min(i + 1, items.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      const item = items[selectedIdx]
      if (!item) { commit(); return }
      switch (item.kind) {
        case 'goto':
          commit(item.url)
          return
        case 'search':
          commit(`https://www.google.com/search?q=${encodeURIComponent(item.query)}`)
          return
        case 'bookmark':
          commit(item.link.url)
          return
      }
    } else if (e.key === 'Escape') {
      onClose()
    }
  }, [items, selectedIdx, commit, onClose])

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center"
      style={{ borderRadius: 18 }}
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="flex w-[min(500px,85%)] flex-col overflow-hidden rounded-xl"
        style={{
          background: 'rgba(28, 28, 30, 0.72)',
          fontFamily: FONT_STACK,
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          boxShadow:
            '0 12px 40px rgba(0,0,0,0.5), inset 0 0 0 0.5px rgba(255, 255, 255, 0.15)',
        }}
      >
        {/* Search input */}
        <div className="flex items-center gap-2.5 px-4" style={{ height: 42 }}>
          <GlobeIcon />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-[18px] font-semibold text-white/90 placeholder-white/30 outline-none"
            style={{
              fontFamily: FONT_STACK,
            }}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIdx(0) }}
            onKeyDown={handleKeyDown}
            placeholder="Search or enter URL..."
            autoFocus
          />
        </div>

        <div style={{ height: 0.5, margin: '0 12px', background: 'rgba(255,255,255,0.08)' }} />

        {/* Results */}
        <div className="flex max-h-[260px] flex-col gap-1 overflow-y-auto px-3 py-2.5">
          {items.map((item, i) => {
            const selected = i === selectedIdx
            const rowStyle: React.CSSProperties = {
              height: 40,
              background: selected ? ARC_ACCENT : undefined,
              cursor: 'default',
            }
            const labelClass = 'truncate text-[13px] font-semibold'
            const labelStyle: React.CSSProperties = {
              color: selected ? '#fff' : 'rgba(255,255,255,0.85)',
              fontFamily: FONT_STACK,
            }

            if (item.kind === 'goto') {
              return (
                <div
                  key={`goto-${i}`}
                  className="flex items-center gap-2.5 rounded-lg px-3"
                  style={rowStyle}
                  onMouseEnter={() => setSelectedIdx(i)}
                  onClick={() => commit(item.url)}
                >
                  <GlobeIcon opacity={selected ? 1 : 0.55} />
                  <span className={labelClass} style={labelStyle}>{item.url}</span>
                </div>
              )
            }

            if (item.kind === 'search') {
              const iconStroke = selected ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.45)'
              return (
                <div
                  key={`search-${i}`}
                  className="flex items-center gap-2.5 rounded-lg px-3"
                  style={rowStyle}
                  onMouseEnter={() => setSelectedIdx(i)}
                  onClick={() => commit(`https://www.google.com/search?q=${encodeURIComponent(item.query)}`)}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
                    <circle cx="7" cy="7" r="5.5" stroke={iconStroke} strokeWidth="1.4" />
                    <path d="M11 11L14.5 14.5" stroke={iconStroke} strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                  <span className={labelClass} style={labelStyle}>{item.query}</span>
                </div>
              )
            }

            const link = item.link
            const subColor = selected ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.25)'
            return (
              <div
                key={`bookmark-${link.url}`}
                className="flex items-center gap-2.5 rounded-lg px-3"
                style={rowStyle}
                onMouseEnter={() => setSelectedIdx(i)}
                onClick={() => commit(link.url)}
              >
                <img
                  src={`https://www.google.com/s2/favicons?domain=${new URL(link.url).hostname}&sz=32`}
                  width={16}
                  height={16}
                  className="shrink-0 rounded-sm"
                  alt=""
                />
                <span className={labelClass} style={labelStyle}>{link.label}</span>
                <span className="text-[13px]" style={{ color: subColor }}>—</span>
                <span
                  className="truncate text-[13px]"
                  style={{
                    color: subColor,
                    fontFamily: FONT_STACK,
                  }}
                >
                  {link.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function TabCloseButton({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <div
      className="ml-auto flex shrink-0 items-center justify-center rounded-md opacity-0 transition-opacity group-hover/tab:opacity-100 hover:bg-white/[0.08]"
      style={{ width: 20, height: 20 }}
      onClick={onClick}
    >
      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
        <path d="M1 1L7 7M7 1L1 7" stroke="white" strokeOpacity="0.5" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </div>
  )
}

function Sidebar({
  width,
  activeUrl,
  items,
  activeTabId,
  onDragStart,
  onToggleSidebar,
  onResizeStart,
  onNavigate,
  onNewTab,
  onSelectTab,
  onCloseTab,
  onToggleFolder,
  onClose,
  onMinimize,
  onFullscreen,
}: {
  width: number
  activeUrl: string
  items: SidebarNode[]
  activeTabId: number | null
  onDragStart: (e: React.PointerEvent) => void
  onToggleSidebar: () => void
  onResizeStart: (e: React.PointerEvent) => void
  onNavigate: (url: string) => void
  onNewTab: () => void
  onSelectTab: (id: number) => void
  onCloseTab: (id: number) => void
  onToggleFolder: (id: number) => void
  onClose?: () => void
  onMinimize?: () => void
  onFullscreen?: () => void
}) {
  return (
    <div className="relative flex h-full shrink-0 flex-col gap-3 pb-5 pl-2.5 pr-0 pt-2.5" style={{ width }}>
      {/* Title bar – traffic lights + sidebar toggle, aligned with first tile.
       *  Title bar's `pl-2.5` (10px) plus the column's `pl-2.5` (10px) puts
       *  the traffic lights at 20px from the window's outer edge, matching
       *  Photos `TRAFFIC_LEFT_INSET` and macOS canonical positioning. The
       *  rest of the sidebar (pinned tabs, tab list, footer) keeps the
       *  column-level 10px so it doesn't shift along with the title bar. */}
      <div
        className="flex shrink-0 items-center gap-3 pl-2.5 pr-1"
        style={{ height: 36, cursor: 'default', touchAction: 'none' }}
        onPointerDown={onDragStart}
      >
        <TrafficLights onClose={onClose} onMinimize={onMinimize} onFullscreen={onFullscreen} />
        <SidebarToggle onClick={onToggleSidebar} />
      </div>
      <PinnedTabs activeUrl={activeUrl} onNavigate={onNavigate} />
      <div className="arc-sidebar-scroll flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden pr-1">
        {items.map(node => (
          <SidebarNodeItem
            key={node.id}
            node={node}
            depth={0}
            activeTabId={activeTabId}
            onSelectTab={onSelectTab}
            onCloseTab={onCloseTab}
            onToggleFolder={onToggleFolder}
          />
        ))}
      </div>
      {/* Sidebar footer: trash + new-tab. The column is `pl-2.5 pr-0`
       *  (10px left, flush right), so this row's `pl-2.5 pr-5` lands both
       *  glyphs at 20px from their respective window/sidebar edges: trash
       *  at 10+10 from the window left (matching the traffic-light inset)
       *  and the plus at 0+20 from the sidebar's right edge — symmetric
       *  instead of the plus hugging the edge. */}
      <div className="flex items-center justify-between pl-2.5 pr-5">
        <TrashIcon />
        <div style={{ cursor: 'default' }} onClick={onNewTab}>
          <PlusIcon />
        </div>
      </div>
      {/* Resize handle */}
      <div
        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize"
        style={{ touchAction: 'none' }}
        onPointerDown={onResizeStart}
      />
    </div>
  )
}

// Detect Electron via the preload-exposed flag. Falls back to UA sniffing for
// older/legacy bundles, but the preload flag is authoritative — UA strings
// alone are unreliable (some browsers' embeds carry "Electron" in their UA).
const isElectron =
  typeof window !== 'undefined' &&
  ((window as unknown as { isElectronApp?: boolean }).isElectronApp === true ||
    (typeof (window as unknown as { process?: { versions?: { electron?: string } } }).process?.versions?.electron === 'string'))

/* ─── window ─── */

export function ArcWindow({
  onFocus,
  zIndex,
}: {
  onFocus: () => void
  zIndex: number
}) {
  const [rect, setRect] = useState<Rect>(() => {
    const vw = window.innerWidth
    const vh = window.innerHeight
    const availH = vh - MENU_BAR_H - DOCK_H
    const isMobile = vw < MOBILE_BREAKPOINT
    const margin = isMobile ? 0 : 8
    const w = isMobile ? vw : Math.min(1200, vw - margin * 2)
    const h = isMobile ? availH : Math.min(800, availH - margin * 2)
    const x = isMobile ? 0 : Math.round((vw - w) / 2)
    const y = MENU_BAR_H + (isMobile ? 0 : margin + Math.round((availH - margin * 2 - h) / 2))
    return { x, y, w, h }
  })

  const rectRef = useRef(rect)

  /* ── navigation state (works for both webview & iframe) ── */
  const INITIAL_URL = 'https://www.youtube.com/watch?v=8IcYpOl4Sdk'
  const [history, setHistory] = useState<string[]>([INITIAL_URL])
  const [historyIndex, setHistoryIndex] = useState(0)
  const currentUrl = historyIndex >= 0 ? history[historyIndex] : ''
  const canGoBack = historyIndex > 0
  const canGoForward = historyIndex < history.length - 1

  const [webviewLoading, setWebviewLoading] = useState(false)
  const webviewRef = useRef<HTMLElement>(null)
  const listenersAttached = useRef(false)

  const historyRef = useRef(history)
  const historyIndexRef = useRef(historyIndex)

  const navigate = useCallback((newUrl: string) => {
    const idx = historyIndexRef.current
    setHistory(prev => [...prev.slice(0, idx + 1), newUrl])
    setHistoryIndex(idx + 1)

    if (isElectron) {
      const wv = webviewRef.current as any
      if (wv?.loadURL) wv.loadURL(newUrl)
    }
  }, [])

  const goBack = useCallback(() => {
    if (isElectron) {
      const wv = webviewRef.current as any
      if (wv?.canGoBack?.()) wv.goBack()
    }
    const idx = historyIndexRef.current
    if (idx > 0) setHistoryIndex(idx - 1)
  }, [])

  const goForward = useCallback(() => {
    if (isElectron) {
      const wv = webviewRef.current as any
      if (wv?.canGoForward?.()) wv.goForward()
    }
    const idx = historyIndexRef.current
    if (idx < historyRef.current.length - 1) setHistoryIndex(idx + 1)
  }, [])

  // Listen for navigation events from proxied iframes
  const navigateRef = useRef(navigate)

  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      if (e.data?.type === 'iframeNavigation' && e.data.url) {
        navigateRef.current(e.data.url)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // Attach webview event listeners (Electron only)
  useEffect(() => {
    if (!isElectron) return
    const wv = webviewRef.current as any
    if (!wv || listenersAttached.current) return

    const onStart = () => setWebviewLoading(true)
    const onFinish = () => {
      setWebviewLoading(false)
      wv.insertCSS('html, body { max-width: 100vw !important; overflow-x: hidden !important; }').catch(() => {})
    }

    const onDidNavigate = (e: any) => {
      if (e.url && e.url !== 'about:blank') {
        const idx = historyIndexRef.current
        const prev = historyRef.current
        if (prev[idx] !== e.url) {
          setHistory([...prev.slice(0, idx + 1), e.url])
          setHistoryIndex(idx + 1)
        }
      }
    }

    wv.addEventListener('did-start-loading', onStart)
    wv.addEventListener('did-finish-load', onFinish)
    wv.addEventListener('did-fail-load', onFinish)
    wv.addEventListener('did-navigate', onDidNavigate)
    wv.addEventListener('did-navigate-in-page', onDidNavigate)
    listenersAttached.current = true
  })

  const refreshWebview = useCallback(() => {
    setWebviewLoading(true)
    const wv = webviewRef.current as any
    if (wv?.reload) wv.reload()
  }, [])

  const stopWebview = useCallback(() => {
    setWebviewLoading(false)
    if (isElectron) {
      const wv = webviewRef.current as any
      if (wv?.stop) wv.stop()
    }
  }, [])
  const closeApp = useAppStore((s) => s.closeApp)
  const setFullscreenApp = useAppStore((s) => s.setFullscreenApp)

  const [searchOpen, setSearchOpen] = useState(false)
  const [sidebarItems, setSidebarItems] = useState<SidebarNode[]>([
    { type: 'folder', id: -1, label: '2026', expanded: true, children: [
      { type: 'folder', id: -2, label: 'Agentic Studio', expanded: true, children: [
        { type: 'tab', id: 0, url: 'https://www.youtube.com/watch?v=8IcYpOl4Sdk', title: 'Tech Talks EP33 | The Future of Agentic Game Creation' },
        { type: 'tab', id: -3, url: 'https://about.roblox.com/newsroom/2026/04/roblox-studio-going-agentic', title: 'Roblox Studio is Going Agentic' },
        { type: 'tab', id: -5, url: 'https://devforum.roblox.com/t/announcing-planning-mode-for-roblox-assistant/4580715', title: 'Announcing Planning Mode for Roblox Assistant' },
      ] },
    ] },
    { type: 'folder', id: -4, label: '2025', expanded: true, children: [
      { type: 'folder', id: -6, label: 'Reimport', expanded: false, children: [
        { type: 'tab', id: -7, url: 'https://www.youtube.com/watch?v=PVlCHE9pc50&t=12915', title: 'Opening Keynote | RDC 2025' },
        { type: 'tab', id: -8, url: 'https://create.roblox.com/docs/art/modeling/reimport', title: 'Reimport' },
      ] },
    ] },
  ])
  const nextNodeId = useRef(1)
  const [activeTabId, setActiveTabId] = useState<number | null>(0)
  const pendingNewTab = useRef(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth < MOBILE_BREAKPOINT)
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT)
  const [fullscreen, setFullscreen] = useState(false)
  const [preFullscreenRect, setPreFullscreenRect] = useState<Rect | null>(null)
  const toggleSidebar = useCallback(() => setSidebarCollapsed((v) => !v), [])

  /* Proportionally fit the window to the browser viewport: as the browser
     grows/shrinks, the window scales by the same ratio so its share of the
     viewport stays roughly constant (instead of just clamping downward). */
  useFitWindowToViewport(
    setRect,
    {
      menuBarH: MENU_BAR_H,
      dockH: DOCK_H,
      minW: MIN_W,
      minH: MIN_H,
      isFullscreen: () => fullscreen,
    },
    setPreFullscreenRect,
  )

  const handleClose = useCallback(() => {
    closeApp('arc')
    setFullscreenApp(null)
  }, [closeApp, setFullscreenApp])
  const windowRef = useRef<HTMLDivElement>(null)

  const { outerRef, handleMinimize } = useMinimizeAnimation(
    'arc',
    rectRef,
    windowRef,
    () => {
      if (fullscreen) {
        setFullscreen(false)
        setFullscreenApp(null)
      }
    },
  )

  const handleFullscreen = useCallback(() => {
    if (fullscreen) {
      if (preFullscreenRect) setRect(preFullscreenRect)
      setFullscreen(false)
      setFullscreenApp(null)
    } else {
      setPreFullscreenRect(rect)
      setRect({
        x: 0,
        y: 0,
        w: window.innerWidth,
        h: window.innerHeight,
      })
      setFullscreen(true)
      setFullscreenApp('arc')
    }
  }, [fullscreen, rect, preFullscreenRect, setFullscreenApp])

  const topbarColor = useFaviconColor(currentUrl)

  const sidebarWidthRef = useRef(sidebarWidth)

  // Mirror the latest reactive values into refs so post-commit readers
  // (drag handlers, the postMessage navigation listener, sidebar resize)
  // don't capture stale closures. Written in a layout effect rather than
  // during render: that satisfies react-hooks/refs while keeping each
  // useRef directly visible to the React Compiler, so the refs stay
  // recognized as stable (non-reactive) deps in the useCallbacks below.
  useLayoutEffect(() => {
    rectRef.current = rect
    historyRef.current = history
    historyIndexRef.current = historyIndex
    navigateRef.current = navigate
    sidebarWidthRef.current = sidebarWidth
  })

  const dragRef = useRef<{
    startX: number
    startY: number
    startRect: Rect
    mode: Dir | 'move'
  } | null>(null)

  const sidebarDragRef = useRef<{ startX: number; startWidth: number } | null>(null)

  const [dragging, setDragging] = useState(false)
  const [sidebarDragging, setSidebarDragging] = useState(false)

  const startSidebarResize = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    sidebarDragRef.current = { startX: e.clientX, startWidth: sidebarWidthRef.current }
    setSidebarDragging(true)
  }, [])

  useEffect(() => {
    if (!sidebarDragging) return

    const onMove = (e: PointerEvent) => {
      if (!sidebarDragRef.current) return
      const dx = e.clientX - sidebarDragRef.current.startX
      setSidebarWidth(Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, sidebarDragRef.current.startWidth + dx)))
    }

    const onUp = () => {
      sidebarDragRef.current = null
      setSidebarDragging(false)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [sidebarDragging])

  const startDrag = useCallback(
    (mode: Dir | 'move', e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      onFocus()
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startRect: { ...rectRef.current },
        mode,
      }
      setDragging(true)
    },
    [onFocus],
  )

  useEffect(() => {
    if (!dragging) return

    const onMove = (e: PointerEvent) => {
      if (!dragRef.current) return
      const { startX, startY, startRect, mode } = dragRef.current
      const dx = e.clientX - startX
      const dy = e.clientY - startY

      if (mode === 'move') {
        setRect(clampMove({ ...startRect, x: startRect.x + dx, y: startRect.y + dy }))
      } else {
        setRect(applyResize(startRect, mode, dx, dy))
      }
    }

    const onUp = () => {
      dragRef.current = null
      setDragging(false)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [dragging])

  return (
    <div
      ref={outerRef}
      className="absolute"
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        zIndex,
        userSelect: dragging || sidebarDragging ? 'none' : undefined,
        transition: fullscreen || preFullscreenRect ? 'left 0.3s ease, top 0.3s ease, width 0.3s ease, height 0.3s ease' : undefined,
      }}
      onPointerDown={onFocus}
    >
      {/* Window chrome — Arc intentionally diverges from Notes/Photos'
       *  unified opaque surface. The translucent/tinted glass recipe
       *  (rgba(4,6,24,0.5) + 32.5px backdrop-blur, 18px radius, 0.5px
       *  @ 0.12 inline rim on top of WINDOW_DROP_SHADOW) is core to
       *  Arc's identity as a browser window — the wallpaper bleed
       *  through the chrome reads as "this app is its own surface
       *  tier" in a way that opaque #1E1E1E does not. The first pass
       *  of design audit Slice 3 unified Arc into the Notes/Photos
       *  system; that change was reverted here. Notes and Photos keep
       *  the opaque #1E1E1E + WINDOW_SHADOW + 1px@0.22 rim recipe. */}
      <div
        ref={windowRef}
        className="flex h-full w-full overflow-hidden"
        style={{
          borderRadius: fullscreen ? 0 : 18,
          background: 'rgba(4, 6, 24, 0.5)',
          backdropFilter: 'blur(32.5px)',
          WebkitBackdropFilter: 'blur(32.5px)',
          boxShadow: fullscreen
            ? 'inset 0 0 0 0.5px rgba(255, 255, 255, 0.12)'
            : `${WINDOW_DROP_SHADOW}, inset 0 0 0 0.5px rgba(255, 255, 255, 0.12)`,
        }}
      >
        <div
          className="shrink-0 overflow-hidden transition-[margin] duration-300 ease-in-out"
          style={{ marginLeft: sidebarCollapsed ? -sidebarWidth : 0 }}
        >
          <Sidebar
            width={sidebarWidth}
            activeUrl={currentUrl}
            items={sidebarItems}
            activeTabId={activeTabId}
            onDragStart={(e) => startDrag('move', e)}
            onToggleSidebar={toggleSidebar}
            onResizeStart={startSidebarResize}
            onNavigate={navigate}
            onNewTab={() => { pendingNewTab.current = true; setSearchOpen(true) }}
            onSelectTab={(id) => {
              const tab = findTab(sidebarItems, id)
              if (tab) { navigate(tab.url); setActiveTabId(id) }
            }}
            onCloseTab={(id) => {
              setSidebarItems(prev => removeNode(prev, id))
              if (activeTabId === id) {
                const allTabs = findAllTabs(sidebarItems).filter(t => t.id !== id)
                if (allTabs.length > 0) {
                  const last = allTabs[allTabs.length - 1]
                  setActiveTabId(last.id)
                  navigate(last.url)
                } else {
                  setActiveTabId(null)
                }
              }
            }}
            onToggleFolder={(id) => setSidebarItems(prev => toggleFolder(prev, id))}
            onClose={handleClose}
            onMinimize={handleMinimize}
            onFullscreen={handleFullscreen}
          />
        </div>

        {/* Content area with frame border (draggable) */}
        <div
          className="relative min-w-0 flex-1 p-2.5"
          style={{ cursor: 'default', touchAction: 'none' }}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) startDrag('move', e)
          }}
        >
          {/* Sidebar resize handle on left edge of content area */}
          {!sidebarCollapsed && (
            <div
              className="group absolute left-0 top-0 z-10 h-full w-2.5 cursor-col-resize"
              style={{ touchAction: 'none' }}
              onPointerDown={startSidebarResize}
            >
              <div className="absolute left-1/2 top-2 bottom-2 w-[3px] -translate-x-1/2 rounded-full bg-white/0 transition-colors duration-150 group-hover:bg-white/25" />
            </div>
          )}
          <div
            className="relative flex h-full flex-col overflow-hidden"
            style={{
              borderRadius: 10,
              boxShadow: 'inset 0 0 0 0.5px rgba(255, 255, 255, 0.12)',
              background: 'rgba(255, 255, 255, 0.03)',
            }}
          >
            <ArcTopbar
              color={topbarColor}
              url={currentUrl}
              sidebarCollapsed={sidebarCollapsed}
              canGoBack={canGoBack}
              canGoForward={canGoForward}
              onToggleSidebar={toggleSidebar}
              onBack={goBack}
              onForward={goForward}
              onRefresh={refreshWebview}
              onStop={stopWebview}
              onOpenSearch={() => setSearchOpen(true)}
              loading={webviewLoading}
            />
            <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
              {currentUrl ? (
                isElectron ? (
                  <webview
                    ref={webviewRef as any}
                    src={currentUrl}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      pointerEvents: dragging || sidebarDragging ? 'none' : 'auto',
                    }}
                  />
                ) : (
                  <ProxiedIframe url={currentUrl} dragging={dragging || sidebarDragging} />
                )
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Search dialog */}
      {searchOpen && (
        <SearchDialog
          url={currentUrl}
          onNavigate={(u) => {
            navigate(u)
            if (pendingNewTab.current) {
              const id = nextNodeId.current++
              const newTab: TabNode = { type: 'tab', id, url: u }
              // Route plus-button additions into the dedicated
              // "Other Tabs" section at the bottom of the sidebar rather
              // than burying them inside an existing year folder. The
              // section is lazy-created on first use, then reused for
              // subsequent tabs.
              setSidebarItems(prev => appendToNewLinksFolder(prev, newTab))
              setActiveTabId(id)
              pendingNewTab.current = false
            } else if (activeTabId != null) {
              setSidebarItems(prev => updateTabUrl(prev, activeTabId, u))
            }
            setSearchOpen(false)
          }}
          onClose={() => { setSearchOpen(false); pendingNewTab.current = false }}
        />
      )}

      {/* Resize handles — gated by !fullscreen to match Notes/Photos.
       *  In fullscreen the window is locked at viewport bounds; live
       *  resize handles would let the user drag the edges and resize
       *  out of fullscreen invisibly, leaving the window in a stale
       *  rect on the next frame. */}
      {!fullscreen &&
        ALL_DIRS.map((dir) => (
          <div
            key={dir}
            style={{ ...handleStyle(dir), touchAction: 'none' }}
            onPointerDown={(e) => startDrag(dir, e)}
          />
        ))}
    </div>
  )
}
