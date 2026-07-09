import { useRef, useCallback, useEffect, useImperativeHandle, forwardRef } from 'react'
import type { InputSegment, PillInputHandle, PillKind, MentionQuery, SlashCommandQuery } from '../../types'
import { publicUrl } from '../../utils/assetUrl'
import styles from './PillInput.module.css'

interface PillInputProps {
  segments: InputSegment[]
  onSegmentsChange: (segments: InputSegment[]) => void
  onSubmit?: () => void
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
  className?: string
  ariaLabel?: string
  onFocus?: () => void
  onBlur?: () => void
  onMentionQuery?: (mention: MentionQuery | null) => void
  onSlashQuery?: (query: SlashCommandQuery | null) => void
  /** Ghost suggestion text shown after the cursor. Accepted with Tab. */
  suggestion?: string
  /** Called when the user accepts the suggestion (Tab key). */
  onAcceptSuggestion?: () => void
}

/** Box icon SVG string for pill elements (matches lucide-react Box at size 12) */
const BOX_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`

/** User icon SVG for collaborator pills (matches lucide-react User at size 12) */
const USER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`

/** Wrench icon SVG for tool pills (matches lucide-react Wrench at size 12) */
const WRENCH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>`

/** FileCode icon SVG for scripting pills (matches lucide-react FileCode at size 12) */
const FILECODE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 12.5 8 15l2 2.5"/><path d="m14 12.5 2 2.5-2 2.5"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/></svg>`

const PILL_ICONS: Record<string, string> = {
  object: BOX_SVG,
  asset: BOX_SVG,
  assetType: BOX_SVG,
  collaborator: USER_SVG,
  tool: WRENCH_SVG,
  script: FILECODE_SVG,
  scripting: FILECODE_SVG,
}

/** Pill kinds that use a public image file instead of an inline SVG icon */
const PILL_KIND_ICON_PATH: Record<string, string> = {
  doc: 'ribbon-icons/file.svg',
  readme: 'ribbon-icons/file.svg',
  plan: 'ribbon-icons/file.svg',
}

/** Map objectType to public icon path for scene-object pills */
const OBJECT_TYPE_ICON_PATH: Record<string, string> = {
  model: 'icons/model.svg',
  mesh: 'icons/meshpart.svg',
  meshpart: 'icons/meshpart.svg',
  camera: 'icons/camera.svg',
  terrain: 'icons/terrain.svg',
  light: 'icons/terrain.svg',
}

/** Object types that use an inline SVG instead of an image file */
const OBJECT_TYPE_INLINE_SVG: Record<string, string> = {
  script: FILECODE_SVG,
}

/** Mention kinds (inserted via @) that show no leading icon — keeps the pill compact */
const NO_ICON_KINDS = new Set<PillKind>(['folder', 'active-tab'])

function parseDOM(el: HTMLDivElement): InputSegment[] {
  const segments: InputSegment[] = []
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? ''
      if (text) segments.push({ type: 'text', text })
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const elem = node as HTMLElement
      // Skip ghost suggestion element
      if (elem.dataset.ghost) continue
      if (elem.tagName === 'BR') {
        segments.push({ type: 'text', text: '\n' })
      } else if (elem.dataset.pillId) {
        const kind = (elem.dataset.pillKind as PillKind) ?? 'object'
        segments.push({
          type: 'pill',
          kind,
          id: elem.dataset.pillId,
          label: elem.dataset.pillLabel ?? '',
          ...(elem.dataset.pillObjectType ? { objectType: elem.dataset.pillObjectType } : {}),
        })
      } else {
        // Capture text content from non-pill elements (e.g. slash command spans)
        const text = elem.textContent ?? ''
        if (text) segments.push({ type: 'text', text })
      }
    }
  }
  return segments
}

function createPillElement(id: string, label: string, kind: PillKind = 'object', objectType?: string): HTMLSpanElement {
  const span = document.createElement('span')
  span.contentEditable = 'false'
  span.className = styles.pill
  span.dataset.pillId = id
  span.dataset.pillLabel = label
  span.dataset.pillKind = kind
  if (objectType) span.dataset.pillObjectType = objectType

  if (kind !== 'command' && !NO_ICON_KINDS.has(kind)) {
    const iconSpan = document.createElement('span')
    iconSpan.style.display = 'inline-flex'
    iconSpan.style.alignItems = 'center'

    // For scene-object pills, use explorer-style icons from public/icons/
    const iconPath = kind === 'object' ? OBJECT_TYPE_ICON_PATH[objectType ?? ''] : undefined
    const inlineSvg = kind === 'object' ? OBJECT_TYPE_INLINE_SVG[objectType ?? ''] : undefined
    if (iconPath) {
      const img = document.createElement('img')
      img.src = publicUrl(iconPath)
      img.alt = ''
      img.width = 12
      img.height = 12
      iconSpan.appendChild(img)
    } else if (inlineSvg) {
      iconSpan.innerHTML = inlineSvg
    } else if (kind === 'object') {
      // Default: use model.svg for scene objects without a specific icon
      const img = document.createElement('img')
      img.src = publicUrl('icons/model.svg')
      img.alt = ''
      img.width = 12
      img.height = 12
      iconSpan.appendChild(img)
    } else if (PILL_KIND_ICON_PATH[kind]) {
      const img = document.createElement('img')
      img.src = publicUrl(PILL_KIND_ICON_PATH[kind])
      img.alt = ''
      img.width = 12
      img.height = 12
      iconSpan.appendChild(img)
    } else {
      iconSpan.innerHTML = PILL_ICONS[kind] ?? BOX_SVG
    }
    span.appendChild(iconSpan)
  }

  const labelSpan = document.createElement('span')
  labelSpan.className = styles.pillLabel
  labelSpan.textContent = label
  span.appendChild(labelSpan)

  return span
}

function renderSegments(el: HTMLDivElement, segments: InputSegment[]) {
  el.innerHTML = ''
  for (const seg of segments) {
    if (seg.type === 'text') {
      if (seg.text === '\n') {
        el.appendChild(document.createElement('br'))
      } else {
        el.appendChild(document.createTextNode(seg.text))
      }
    } else {
      el.appendChild(createPillElement(seg.id, seg.label, seg.kind, seg.objectType))
    }
  }
}

/** Return the pill element that should be highlighted when the caret is adjacent to or inside it. */
function getPillAtCaret(editor: HTMLElement): HTMLElement | null {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  const range = sel.getRangeAt(0)
  if (!editor.contains(range.startContainer)) return null

  const start = range.startContainer
  const offset = range.startOffset

  // Cursor inside a pill (pill or its descendant)
  let node: Node | null = start
  while (node && node !== editor) {
    if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).dataset?.pillId)
      return node as HTMLElement
    node = node.parentNode
  }

  if (!range.collapsed) return null

  // Cursor in editor: caret between direct children
  if (start === editor) {
    const next = editor.childNodes[offset]
    if (next && next.nodeType === Node.ELEMENT_NODE && (next as HTMLElement).dataset?.pillId)
      return next as HTMLElement
    const prev = editor.childNodes[offset - 1]
    if (prev && prev.nodeType === Node.ELEMENT_NODE && (prev as HTMLElement).dataset?.pillId)
      return prev as HTMLElement
    return null
  }

  // Cursor in a text node: pill is previous or next sibling
  if (start.nodeType === Node.TEXT_NODE) {
    const textLen = (start.textContent ?? '').length
    if (offset === 0) {
      const prev = start.previousSibling
      if (prev && prev.nodeType === Node.ELEMENT_NODE && (prev as HTMLElement).dataset?.pillId)
        return prev as HTMLElement
    }
    if (offset === textLen) {
      const next = start.nextSibling
      if (next && next.nodeType === Node.ELEMENT_NODE && (next as HTMLElement).dataset?.pillId)
        return next as HTMLElement
    }
  }

  return null
}

/** Return all pills that intersect the current selection (e.g. after Cmd+A). */
function getPillsInSelection(editor: HTMLElement): HTMLElement[] {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return []
  const range = sel.getRangeAt(0)
  if (range.collapsed || !editor.contains(range.startContainer)) return []
  const pills = editor.querySelectorAll<HTMLElement>('[data-pill-id]')
  return Array.from(pills).filter((p) => range.intersectsNode(p))
}

function updatePillKeyedState(editor: HTMLElement) {
  const sel = window.getSelection()
  const collapsed = sel && sel.rangeCount > 0 && sel.getRangeAt(0).collapsed
  const keyedPills = collapsed
    ? (() => { const p = getPillAtCaret(editor); return p ? [p] : [] })()
    : getPillsInSelection(editor)
  const pills = editor.querySelectorAll<HTMLElement>('[data-pill-id]')
  pills.forEach((p) => {
    if (keyedPills.includes(p)) p.setAttribute('data-keyed', 'true')
    else p.removeAttribute('data-keyed')
  })
}

function clearPillKeyedState(editor: HTMLElement) {
  editor.querySelectorAll<HTMLElement>('[data-pill-id]').forEach((p) => p.removeAttribute('data-keyed'))
}

/**
 * Place the cursor just after `node` inside a text node so typing works immediately.
 *
 * Positioning the cursor with `setStartAfter(pillEl)` leaves it at an element-level
 * offset in the parent. WebKit won't accept keystrokes there when the adjacent node
 * is `contentEditable="false"`. Placing the cursor inside a real text node fixes this.
 */
function placeCursorAfterNode(node: Node, sel: Selection) {
  const parent = node.parentNode
  if (!parent) return
  const next = node.nextSibling
  const range = document.createRange()
  if (next && next.nodeType === Node.TEXT_NODE) {
    // Existing text node — land at its start
    range.setStart(next, 0)
  } else {
    // No text node follows — insert a non-breaking space so there's a landing spot
    const spaceNode = document.createTextNode('\u00A0')
    if (next) {
      parent.insertBefore(spaceNode, next)
    } else {
      parent.appendChild(spaceNode)
    }
    range.setStart(spaceNode, 1)
  }
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
}

export function getTextFromSegments(segments: InputSegment[]): string {
  return segments
    .map((s) => (s.type === 'text' ? s.text : s.label))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export const PillInput = forwardRef<PillInputHandle, PillInputProps>(function PillInput(
  { segments, onSegmentsChange, onSubmit, placeholder, disabled = false, autoFocus = false, className, ariaLabel, onFocus, onBlur, onMentionQuery, onSlashQuery, suggestion, onAcceptSuggestion },
  ref,
) {
  const editorRef = useRef<HTMLDivElement>(null)
  const isInternalChange = useRef(false)
  const segmentsRef = useRef(segments)
  segmentsRef.current = segments
  const mentionQueryRef = useRef<MentionQuery | null>(null)
  /** Caret span over the active @mention in the text node (start = '@', end = query end). Used when selection is lost after clicking a portaled mention menu. */
  const mentionReplaceRangeRef = useRef<Range | null>(null)
  /** True only after Arrow/Backspace/Delete — highlight pill at caret only then */
  const keyNavigationRef = useRef(false)

  // Expose imperative handle
  useImperativeHandle(ref, () => ({
    insertPillsAtCursor(pills) {
      const el = editorRef.current
      if (!el || pills.length === 0) return

      const sel = window.getSelection()
      let insertAtEnd = true
      let lastPillEl: HTMLSpanElement | null = null

      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0)
        // Check if cursor is inside the editor
        if (el.contains(range.commonAncestorContainer)) {
          range.collapse(false) // collapse to end of selection
          for (const pill of pills) {
            lastPillEl = createPillElement(pill.id, pill.label, pill.kind ?? 'object', pill.objectType)
            range.insertNode(lastPillEl)
            // Advance range past the pill so the next pill inserts after it
            range.setStartAfter(lastPillEl)
            range.collapse(true)
          }
          // Land cursor inside a text node so typing works immediately
          if (lastPillEl) placeCursorAfterNode(lastPillEl, sel)
          insertAtEnd = false
        }
      }

      if (insertAtEnd) {
        for (const pill of pills) {
          lastPillEl = createPillElement(pill.id, pill.label, pill.kind ?? 'object', pill.objectType)
          el.appendChild(lastPillEl)
        }
        // Land cursor inside a text node so typing works immediately
        const sel2 = window.getSelection()
        if (sel2 && lastPillEl) placeCursorAfterNode(lastPillEl, sel2)
      }

      // Parse DOM back to segments
      const newSegments = parseDOM(el)
      isInternalChange.current = true
      onSegmentsChange(newSegments)
    },
    replaceMentionWithPill(pill) {
      const el = editorRef.current
      if (!el) return

      interface ResolvedMention {
        textNode: Text
        atIdx: number
        cursorPos: number
      }

      let resolved: ResolvedMention | null = null
      const saved = mentionReplaceRangeRef.current
      if (
        saved &&
        saved.startContainer.nodeType === Node.TEXT_NODE &&
        saved.startContainer === saved.endContainer &&
        el.contains(saved.startContainer)
      ) {
        const tn = saved.startContainer as Text
        const t = tn.textContent ?? ''
        const s = saved.startOffset
        const e = saved.endOffset
        if (s >= 0 && e >= s && e <= t.length && t.charAt(s) === '@') {
          resolved = { textNode: tn, atIdx: s, cursorPos: e }
        }
      }

      if (!resolved) {
        const sel = window.getSelection()
        if (!sel || sel.rangeCount === 0) return
        const range = sel.getRangeAt(0)
        let textNode: Node = range.startContainer
        let cursorPos = range.startOffset
        if (textNode.nodeType !== Node.TEXT_NODE) {
          const children = textNode.childNodes
          if (cursorPos > 0 && children[cursorPos - 1]?.nodeType === Node.TEXT_NODE) {
            textNode = children[cursorPos - 1]
            cursorPos = textNode.textContent?.length ?? 0
          } else if (children[cursorPos]?.nodeType === Node.TEXT_NODE) {
            textNode = children[cursorPos]
            cursorPos = 0
          } else {
            return
          }
        }
        if (!el.contains(textNode)) return
        const text = (textNode as Text).textContent ?? ''
        const before = text.slice(0, cursorPos)
        const atIdx = before.lastIndexOf('@')
        if (atIdx === -1) return
        resolved = { textNode: textNode as Text, atIdx, cursorPos }
      }

      const { textNode, atIdx, cursorPos } = resolved
      const text = textNode.textContent ?? ''
      const beforeAt = text.slice(0, atIdx)
      const afterQuery = text.slice(cursorPos)
      const parent = textNode.parentNode!
      const pillEl = createPillElement(pill.id, pill.label, pill.kind ?? 'collaborator', pill.objectType)
      if (afterQuery) parent.insertBefore(document.createTextNode(afterQuery), textNode.nextSibling)
      parent.insertBefore(pillEl, textNode.nextSibling)
      if (beforeAt) parent.insertBefore(document.createTextNode(beforeAt), pillEl)
      parent.removeChild(textNode)
      el.focus()
      const sel = window.getSelection()
      if (sel) placeCursorAfterNode(pillEl, sel)
      const newSegments = parseDOM(el)
      isInternalChange.current = true
      onSegmentsChange(newSegments)
      mentionReplaceRangeRef.current = null
      mentionQueryRef.current = null
      onMentionQueryRef.current?.(null)
    },
    replaceSlashCommand(commandText: string) {
      const el = editorRef.current
      if (!el) return
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) return
      const range = sel.getRangeAt(0)
      let textNode: Node = range.startContainer
      let cursorPos = range.startOffset
      if (textNode.nodeType !== Node.TEXT_NODE) {
        const children = textNode.childNodes
        if (cursorPos > 0 && children[cursorPos - 1]?.nodeType === Node.TEXT_NODE) {
          textNode = children[cursorPos - 1]
          cursorPos = textNode.textContent?.length ?? 0
        } else if (children[cursorPos]?.nodeType === Node.TEXT_NODE) {
          textNode = children[cursorPos]
          cursorPos = 0
        } else {
          return
        }
      }
      if (!el.contains(textNode)) return
      const text = textNode.textContent ?? ''
      const before = text.slice(0, cursorPos)
      const slashIdx = before.lastIndexOf('/')
      if (slashIdx === -1) return
      const beforeSlash = text.slice(0, slashIdx)
      const afterQuery = text.slice(cursorPos)
      const parent = textNode.parentNode!
      // Create a styled span for the command text
      const cmdSpan = document.createElement('span')
      cmdSpan.className = styles.slashCommand
      cmdSpan.textContent = commandText
      // Add a trailing space after the command
      const spaceNode = document.createTextNode('\u00A0')
      if (afterQuery) parent.insertBefore(document.createTextNode(afterQuery), textNode.nextSibling)
      parent.insertBefore(spaceNode, textNode.nextSibling)
      parent.insertBefore(cmdSpan, spaceNode)
      if (beforeSlash) parent.insertBefore(document.createTextNode(beforeSlash), cmdSpan)
      parent.removeChild(textNode)
      const newRange = document.createRange()
      newRange.setStartAfter(spaceNode)
      newRange.collapse(true)
      sel.removeAllRanges()
      sel.addRange(newRange)
      const newSegments = parseDOM(el)
      isInternalChange.current = true
      onSegmentsChange(newSegments)
      slashQueryRef.current = null
      onSlashQueryRef.current?.(null)
    },
    focus() {
      editorRef.current?.focus()
    },
    getTextContent() {
      return getTextFromSegments(segmentsRef.current)
    },
  }), [onSegmentsChange])

  // Place cursor after the first node if it's a pill (so cursor is after first pill, not before)
  const placeCursorAfterFirstPillIfNeeded = useCallback((el: HTMLDivElement) => {
    const first = el.firstChild
    if (!first || first.nodeType !== Node.ELEMENT_NODE) return
    const firstEl = first as HTMLElement
    if (!firstEl.dataset?.pillId) return
    const sel = window.getSelection()
    if (!sel) return
    const range = document.createRange()
    range.setStartAfter(firstEl)
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)
  }, [])

  // Sync segments → DOM when segments change externally
  useEffect(() => {
    if (isInternalChange.current) {
      isInternalChange.current = false
      return
    }
    const el = editorRef.current
    if (!el) return
    renderSegments(el, segments)
    if (segments.length > 0 && segments[0].type === 'pill') {
      const t = setTimeout(() => placeCursorAfterFirstPillIfNeeded(el), 0)
      return () => clearTimeout(t)
    }
  }, [segments, placeCursorAfterFirstPillIfNeeded])

  // Whenever segments change, verify that the active @ / slash query (if any)
  // still corresponds to real trigger text in the input. The `detect` listener
  // only runs on DOM keyup/input/mouseup, so programmatic segment changes
  // (e.g. setSegments([]) on close, pill insertion, etc.) can otherwise leave a
  // stale dropdown open even though no `@` or `/` is present.
  useEffect(() => {
    const hasTriggerChar = (trigger: '@' | '/') => {
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i]
        if (seg.type !== 'text') continue
        if (trigger === '@') {
          if (/(^|\s)@[^\s]*$/.test(seg.text)) return true
        } else {
          // Slash commands only valid when / is at the very start of the composer
          // (no pills or non-empty text segments before this one)
          const nothingBefore = segments.slice(0, i).every(
            (s) => s.type === 'text' && s.text.trim() === ''
          )
          if (nothingBefore && /^\/[^\s]*$/.test(seg.text.trimStart())) return true
        }
      }
      return false
    }
    if (mentionQueryRef.current && !hasTriggerChar('@')) {
      mentionQueryRef.current = null
      mentionReplaceRangeRef.current = null
      onMentionQueryRef.current?.(null)
    }
    if (slashQueryRef.current && !hasTriggerChar('/')) {
      slashQueryRef.current = null
      onSlashQueryRef.current?.(null)
    }
  }, [segments])

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => editorRef.current?.focus(), 0)
      return () => clearTimeout(t)
    }
  }, [autoFocus])

  // Highlight the pill at caret only when user moved with arrows or Delete/Backspace
  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    const onSelectionChange = () => {
      if (keyNavigationRef.current) {
        updatePillKeyedState(el)
        keyNavigationRef.current = false
      } else {
        clearPillKeyedState(el)
      }
    }
    const onMouseDown = () => {
      keyNavigationRef.current = false
      clearPillKeyedState(el)
    }
    document.addEventListener('selectionchange', onSelectionChange)
    el.addEventListener('mousedown', onMouseDown)
    el.addEventListener('blur', () => clearPillKeyedState(el))
    return () => {
      document.removeEventListener('selectionchange', onSelectionChange)
      el.removeEventListener('mousedown', onMouseDown)
    }
  }, [])

  const onMentionQueryRef = useRef(onMentionQuery)
  onMentionQueryRef.current = onMentionQuery
  const slashQueryRef = useRef<SlashCommandQuery | null>(null)
  const onSlashQueryRef = useRef(onSlashQuery)
  onSlashQueryRef.current = onSlashQuery

  const handleInput = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    const newSegments = parseDOM(el)
    isInternalChange.current = true
    onSegmentsChange(newSegments)
  }, [onSegmentsChange])

  // Detect @ mentions on every keyup / input / mouseup
  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    const detect = () => {
      const cb = onMentionQueryRef.current
      if (!cb) return
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) {
        if (mentionQueryRef.current) { mentionQueryRef.current = null; cb(null) }
        mentionReplaceRangeRef.current = null
        return
      }

      // Resolve the text node at the cursor. In contentEditable divs the
      // anchorNode can be the element itself (not a text node) — e.g. when the
      // editor was empty and the user just started typing.
      let textNode: Node | null = sel.anchorNode
      let cursorPos = sel.anchorOffset
      if (textNode && textNode.nodeType !== Node.TEXT_NODE) {
        const children = textNode.childNodes
        // anchorOffset on an element = child-index the cursor sits before
        if (cursorPos > 0 && children[cursorPos - 1]?.nodeType === Node.TEXT_NODE) {
          textNode = children[cursorPos - 1]
          cursorPos = textNode.textContent?.length ?? 0
        } else if (children[cursorPos]?.nodeType === Node.TEXT_NODE) {
          textNode = children[cursorPos]
          cursorPos = 0
        } else {
          if (mentionQueryRef.current) { mentionQueryRef.current = null; cb(null) }
          mentionReplaceRangeRef.current = null
          return
        }
      }

      if (!textNode) {
        if (mentionQueryRef.current) { mentionQueryRef.current = null; cb(null) }
        mentionReplaceRangeRef.current = null
        return
      }

      const text = textNode.textContent ?? ''
      const before = text.slice(0, cursorPos)
      const match = before.match(/(^|[\s])@([^\s]*)$/)
      if (!match) {
        if (mentionQueryRef.current) { mentionQueryRef.current = null; cb(null) }
        mentionReplaceRangeRef.current = null
        return
      }
      const query = match[2]
      const atOffset = before.lastIndexOf('@')
      const mentionRange = document.createRange()
      mentionRange.setStart(textNode, atOffset)
      mentionRange.setEnd(textNode, cursorPos)
      mentionReplaceRangeRef.current = mentionRange.cloneRange()
      const rect = mentionRange.getBoundingClientRect()
      const finalRect = (rect.width === 0 && rect.height === 0)
        ? new DOMRect(el.getBoundingClientRect().left, el.getBoundingClientRect().top, 1, 20)
        : rect
      mentionQueryRef.current = { query, rect: finalRect }
      cb({ query, rect: finalRect })
    }

    // For input events the selection may not be settled yet; defer one frame.
    const detectDeferred = () => { requestAnimationFrame(detect) }

    el.addEventListener('keyup', detect)
    el.addEventListener('input', detectDeferred)
    el.addEventListener('mouseup', detect)
    return () => {
      el.removeEventListener('keyup', detect)
      el.removeEventListener('input', detectDeferred)
      el.removeEventListener('mouseup', detect)
    }
  }, [])

  // Detect / slash commands on every keyup / input / mouseup
  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    const detect = () => {
      const cb = onSlashQueryRef.current
      if (!cb) return
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0 || !el.contains(sel.anchorNode)) {
        if (slashQueryRef.current) { slashQueryRef.current = null; cb(null) }
        return
      }
      let textNode: Node | null = sel.anchorNode
      let cursorPos = sel.anchorOffset
      if (textNode && textNode.nodeType !== Node.TEXT_NODE) {
        const children = textNode.childNodes
        if (cursorPos > 0 && children[cursorPos - 1]?.nodeType === Node.TEXT_NODE) {
          textNode = children[cursorPos - 1]
          cursorPos = textNode.textContent?.length ?? 0
        } else if (children[cursorPos]?.nodeType === Node.TEXT_NODE) {
          textNode = children[cursorPos]
          cursorPos = 0
        } else {
          if (slashQueryRef.current) { slashQueryRef.current = null; cb(null) }
          return
        }
      }
      if (!textNode) {
        if (slashQueryRef.current) { slashQueryRef.current = null; cb(null) }
        return
      }
      const text = textNode.textContent ?? ''
      const before = text.slice(0, cursorPos)
      const match = before.match(/(^|[\s])\/([^\s]*)$/)
      if (!match) {
        if (slashQueryRef.current) { slashQueryRef.current = null; cb(null) }
        return
      }
      const query = match[2]
      const slashOffset = before.lastIndexOf('/')

      // Slash commands only trigger when / is the very first thing in the composer.
      // Reject if there is non-whitespace text before the slash in this text node,
      // or if any preceding sibling (pill, element, or non-empty text) exists.
      const textBeforeSlash = text.slice(0, slashOffset)
      if (textBeforeSlash.trim()) {
        if (slashQueryRef.current) { slashQueryRef.current = null; cb(null) }
        return
      }
      let prevSibling = textNode.previousSibling
      while (prevSibling) {
        const isElement = prevSibling.nodeType === Node.ELEMENT_NODE
        const isNonEmptyText = prevSibling.nodeType === Node.TEXT_NODE && (prevSibling.textContent ?? '').trim() !== ''
        if (isElement || isNonEmptyText) {
          if (slashQueryRef.current) { slashQueryRef.current = null; cb(null) }
          return
        }
        prevSibling = prevSibling.previousSibling
      }
      const range = document.createRange()
      range.setStart(textNode, slashOffset)
      range.setEnd(textNode, cursorPos)
      const rect = range.getBoundingClientRect()
      const finalRect = (rect.width === 0 && rect.height === 0)
        ? new DOMRect(el.getBoundingClientRect().left, el.getBoundingClientRect().top, 1, 20)
        : rect
      slashQueryRef.current = { query, rect: finalRect }
      cb({ query, rect: finalRect })
    }
    const detectDeferred = () => { requestAnimationFrame(detect) }
    el.addEventListener('keyup', detect)
    el.addEventListener('input', detectDeferred)
    el.addEventListener('mouseup', detect)
    return () => {
      el.removeEventListener('keyup', detect)
      el.removeEventListener('input', detectDeferred)
      el.removeEventListener('mouseup', detect)
    }
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const navKeys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Backspace', 'Delete']
    const selectAll = e.key === 'a' && (e.metaKey || e.ctrlKey)
    if (navKeys.includes(e.key) || selectAll) {
      keyNavigationRef.current = true
    } else {
      keyNavigationRef.current = false
      const el = editorRef.current
      if (el) clearPillKeyedState(el)
    }
    if (e.key === 'Tab' && suggestion && onAcceptSuggestion) {
      e.preventDefault()
      onAcceptSuggestion()
      return
    }
    if (e.key === 'Escape' && (mentionQueryRef.current || slashQueryRef.current)) {
      mentionQueryRef.current = null
      mentionReplaceRangeRef.current = null
      onMentionQueryRef.current?.(null)
      slashQueryRef.current = null
      onSlashQueryRef.current?.(null)
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      mentionQueryRef.current = null
      mentionReplaceRangeRef.current = null
      onMentionQueryRef.current?.(null)
      slashQueryRef.current = null
      onSlashQueryRef.current?.(null)
      onSubmit?.()
    }
  }, [onSubmit])

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    if (!text) return
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const range = sel.getRangeAt(0)
    range.deleteContents()
    range.insertNode(document.createTextNode(text))
    range.collapse(false)
    sel.removeAllRanges()
    sel.addRange(range)
    handleInput()
  }, [handleInput])

  const handleFocus = useCallback(
    (_e: React.FocusEvent<HTMLDivElement>) => {
      const el = editorRef.current
      if (el && el.firstChild?.nodeType === Node.ELEMENT_NODE && (el.firstChild as HTMLElement).dataset?.pillId) {
        const sel = window.getSelection()
        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0)
          if (!range.collapsed || !el.contains(range.startContainer)) {
            onFocus?.()
            return
          }
          const atStart = document.createRange()
          atStart.setStart(el, 0)
          atStart.setEnd(el, 0)
          const isAtStart = range.compareBoundaryPoints(Range.START_TO_START, atStart) === 0
          if (isAtStart) {
            placeCursorAfterFirstPillIfNeeded(el)
          }
        }
      }
      onFocus?.()
    },
    [onFocus, placeCursorAfterFirstPillIfNeeded],
  )

  // Manage ghost suggestion text inside the contentEditable
  const ghostRef = useRef<HTMLSpanElement | null>(null)
  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    // Remove old ghost if present
    if (ghostRef.current && el.contains(ghostRef.current)) {
      el.removeChild(ghostRef.current)
      ghostRef.current = null
    }
    const hasContent = segments.length > 0 && segments.some(s => s.type === 'pill' || (s.type === 'text' && s.text.trim()))
    if (suggestion && hasContent) {
      const ghost = document.createElement('span')
      ghost.className = styles.ghost
      ghost.contentEditable = 'false'
      ghost.setAttribute('data-ghost', 'true')
      // Suggestion text
      ghost.appendChild(document.createTextNode(suggestion))
      // Tab badge
      const tab = document.createElement('span')
      tab.className = styles.ghostTab
      tab.textContent = 'Tab'
      ghost.appendChild(tab)
      el.appendChild(ghost)
      ghostRef.current = ghost
    }
  }, [suggestion, segments])

  // Logically empty when no pills exist and all text segments are blank.
  // Drives the placeholder visibility — `:empty` alone is unreliable because
  // contenteditable retains stray <br> nodes after the user deletes content.
  const isEmpty = segments.every(
    (s) => s.type === 'text' && s.text.trim().length === 0,
  )

  return (
    <div className={styles.editorWrap}>
      <div
        ref={editorRef}
        className={`${styles.editor} ${className ?? ''}`}
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-label={ariaLabel}
        aria-multiline="true"
        data-placeholder={placeholder}
        data-empty={isEmpty ? 'true' : undefined}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onFocus={handleFocus}
        onBlur={onBlur}
      />
    </div>
  )
})
