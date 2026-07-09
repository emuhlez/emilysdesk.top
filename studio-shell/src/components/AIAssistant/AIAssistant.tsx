import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { ArrowUp, Check, ChevronDown, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import { DockablePanel } from '../shared/DockablePanel'
import { useDockingStore } from '../../store/dockingStore'
import { useEditorStore } from '../../store/editorStore'
import { usePlanExecutor } from '../../ai/use-plan-executor'
import { usePlanStore } from '../../store/planStore'
import { useConversationStore } from '../../store/conversationStore'
import { TasksDropdown } from './TasksDropdown'
import { MessageList } from './MessageList'
import { BackgroundTaskDrawer } from './BackgroundTaskDrawer'
import { AssistantSidebar } from './AssistantSidebar'
import { useBackgroundTaskStore } from '../../store/backgroundTaskStore'
import { useCommentStore } from '../../store/commentStore'
import { PlanCard } from './PlanCard'
import { PillInput, getTextFromSegments } from '../shared/PillInput'
import { usePredictiveText } from '../shared/usePredictiveText'
import { MentionDropdown, type MentionItem } from '../shared/MentionDropdown'
import { MENTION_SCRIPTS, MENTION_READMES, MENTION_PLANS } from '../Viewport/mentionItems'
import type { InputSegment, PillInputHandle, MentionQuery, SlashCommandQuery } from '../../types'
import { publicUrl } from '../../utils/assetUrl'
import { SLASH_COMMANDS } from '../shared/slashCommands'
import { SlashCommandDropdown } from '../shared/SlashCommandDropdown'
import filterIcon from '../../../icons/three-slider.svg'
import styles from './AIAssistant.module.css'

const FILTER_TOOLS = [
  { id: 'edit_script', label: 'Edit Script' },
  { id: 'execute_luau', label: 'Execute Luau' },
  { id: 'screen_capture', label: 'Screen Capture' },
  { id: 'primitive_gen', label: 'Primitive Gen' },
  { id: 'generate_material', label: 'Generate Material' },
  { id: 'generate_mesh', label: 'Generate Mesh' },
]

export function AIAssistant() {
  const aiAssistantBodyCollapsed = useDockingStore((state) => state.aiAssistantBodyCollapsed)
  const setAiAssistantBodyCollapsed = useDockingStore((state) => state.setAiAssistantBodyCollapsed)
  const chatbotUIMode = useDockingStore((state) => state.chatbotUIMode)
  const taskDrawerMode = useDockingStore((state) => state.taskDrawerMode)
  const taskDrawerMenuSide = useDockingStore((state) => state.taskDrawerMenuSide)
  const assistantPanelMode = useDockingStore((state) => state.assistantPanelMode)
  const gameObjects = useEditorStore((s) => s.gameObjects)
  const rootObjectIds = useEditorStore((s) => s.rootObjectIds)
  const dockedWidgets = useDockingStore((s) => s.widgets)
  const [mentionQuery, setMentionQuery] = useState<MentionQuery | null>(null)
  const [slashQuery, setSlashQuery] = useState<SlashCommandQuery | null>(null)

  const mentionItems: MentionItem[] = useMemo(() => {
    const items: MentionItem[] = []
    const workspaceId = rootObjectIds[0]
    const workspace = workspaceId ? gameObjects[workspaceId] : null
    let hasScripts = false

    // Recursively walk the hierarchy.
    // type:'empty' objects surface as folders; type:'script' objects surface as scripts.
    // All other types (mesh, camera, light, etc.) are skipped from the mention list.
    const walk = (ids: string[], parentPath: string) => {
      for (const id of ids) {
        const obj = gameObjects[id]
        if (!obj || obj.name === 'Drops') continue
        if (obj.type === 'script') {
          hasScripts = true
          items.push({ id, label: obj.name, kind: 'script', category: 'script' })
        } else if (obj.type === 'empty') {
          const fullPath = parentPath ? `${parentPath} / ${obj.name}` : obj.name
          items.push({ id, label: fullPath, kind: 'folder', category: 'folder' })
          if (obj.children?.length) walk(obj.children, fullPath)
        } else {
          if (obj.children?.length) walk(obj.children, parentPath)
        }
      }
    }
    if (workspace?.children) walk(workspace.children, '')

    // Always include at least one script entry so the category is visible
    if (!hasScripts) items.push(...MENTION_SCRIPTS)
    // Active Tabs — derive from currently docked widgets
    const WIDGET_LABELS: Record<string, string> = {
      viewport: 'Viewport',
      scripting: 'Scripting',
      inspector: 'Inspector',
      'ai-assistant': 'AI Assistant',
    }
    for (const widget of Object.values(dockedWidgets)) {
      const label = WIDGET_LABELS[widget.id] ?? widget.id
      items.push({ id: `tab-${widget.id}`, label, kind: 'active-tab', category: 'active-tab' })
    }
    // Docs — README & guides and planning
    items.push(...MENTION_READMES)
    items.push(...MENTION_PLANS)
    return items
  }, [dockedWidgets, gameObjects, rootObjectIds])
  const isBackgroundTaskRunning = useBackgroundTaskStore((s) => s.tasks.some((t) => t.status === 'running'))
  const activeConversationId = useConversationStore((s) => s.activeConversationId)

  const activeConversation = useConversationStore((s) =>
    s.activeConversationId ? s.conversations[s.activeConversationId] : null
  )
  // Messages from persisted conversations for display
  const conversationMessages = activeConversation?.messages ?? []
  usePlanExecutor()
  const pendingViewportMessage = useConversationStore((s) => s.pendingViewportMessage)
  const enqueueTask = useBackgroundTaskStore((s) => s.enqueueTask)
  const activePlan = usePlanStore((s) => s.activePlan)
  const isClarifying = activePlan?.status === 'clarifying' || activePlan?.status === 'reviewing'
  const isClarifyingRef = useRef(false)
  isClarifyingRef.current = isClarifying ?? false

  // Thinking beat: brief Nebula "Thinking..." state before showing question composer
  const [questionThinking, setQuestionThinking] = useState(false)
  useEffect(() => {
    if (isClarifying) {
      setQuestionThinking(true)
      const timer = window.setTimeout(() => setQuestionThinking(false), 1500)
      return () => clearTimeout(timer)
    }
    setQuestionThinking(false)
  }, [isClarifying])

  // Consume pending messages queued from the mini composer (ViewportAIInput).
  // Route through background task system (keyword engine) instead of AI API.
  useEffect(() => {
    const pending = useConversationStore.getState().pendingViewportMessage
    if (!pending) return
    if (isBackgroundTaskRunning) return
    useConversationStore.getState().setPendingViewportMessage(null)
    enqueueTask(pending)
  }, [pendingViewportMessage, isBackgroundTaskRunning, enqueueTask])
  const [segments, setSegments] = useState<InputSegment[]>([])
  const currentText = getTextFromSegments(segments)
  const { suggestion, acceptSuggestion } = usePredictiveText(currentText)
  const handleAcceptSuggestion = useCallback(() => {
    const fullText = acceptSuggestion()
    if (fullText) {
      setSegments([{ type: 'text', text: fullText }])
    }
  }, [acceptSuggestion])
  const pillInputRef = useRef<PillInputHandle>(null)
  const questionPillInputRef = useRef<PillInputHandle>(null)
  const [questionMentionQuery, setQuestionMentionQuery] = useState<MentionQuery | null>(null)
  const [questionInputFocused, setQuestionInputFocused] = useState(false)
  const [questionSegments, setQuestionSegments] = useState<InputSegment[]>([])
  const questionSegmentsRef = useRef<InputSegment[]>([])

  // Demo simulation state
  const [isDemoLoading, setIsDemoLoading] = useState(false)
  const [demoStreamingText, setDemoStreamingText] = useState('')
  const demoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const demoThinkingRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const demoSettleRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stopDemo = useCallback(() => {
    if (demoThinkingRef.current) { clearTimeout(demoThinkingRef.current); demoThinkingRef.current = null }
    if (demoTimerRef.current) { clearInterval(demoTimerRef.current); demoTimerRef.current = null }
    if (demoSettleRef.current) { clearTimeout(demoSettleRef.current); demoSettleRef.current = null }
    setIsDemoLoading(false)
    setDemoStreamingText('')
  }, [])

  // Clear any pending demo timers on unmount so callbacks don't fire after teardown
  useEffect(() => {
    return () => {
      if (demoThinkingRef.current) clearTimeout(demoThinkingRef.current)
      if (demoTimerRef.current) clearInterval(demoTimerRef.current)
      if (demoSettleRef.current) clearTimeout(demoSettleRef.current)
    }
  }, [])

  const DEMO_RESPONSE = `I'll help you build a fun obby course! **Setting up the base layout** now.\n\nI've added a spawn platform, 3 floating jump pads at staggered heights, and a checkpoint midway through. Each BasePart uses a bright color so players can easily track their path. The course should take about 60–90 seconds to complete on a first run.`

  const DEMO_TOOL_CALLS = [
    { toolName: 'addObject', args: { type: 'BasePart', name: 'Platform_1', color: '#FF6B6B' }, result: { success: true, objectId: 'obj-p1' } },
    { toolName: 'addObject', args: { type: 'BasePart', name: 'Platform_2', color: '#4ECDC4' }, result: { success: true, objectId: 'obj-p2' } },
    { toolName: 'addObject', args: { type: 'BasePart', name: 'Platform_3', color: '#FFE66D' }, result: { success: true, objectId: 'obj-p3' } },
  ]

  const runDemo = useCallback(() => {
    if (isDemoLoading) return
    const convStore = useConversationStore.getState()
    const convId = convStore.activeConversationId
    if (!convId) return

    // Add user message
    convStore.addMessage(convId, {
      id: `user-demo-${Date.now()}`,
      role: 'user',
      textContent: 'Build a fun obby course with platforms',
      timestamp: Date.now(),
    })

    setIsDemoLoading(true)
    setDemoStreamingText('')

    const words = DEMO_RESPONSE.split(' ')
    let wordIndex = 0
    const WORD_DELAY_MS = 60

    // Start streaming after a brief thinking pause
    demoThinkingRef.current = setTimeout(() => {
      demoThinkingRef.current = null
      demoTimerRef.current = setInterval(() => {
        wordIndex++
        setDemoStreamingText(words.slice(0, wordIndex).join(' '))
        if (wordIndex >= words.length) {
          if (demoTimerRef.current) { clearInterval(demoTimerRef.current); demoTimerRef.current = null }
          // Commit the final assistant message + spawn real objects in viewport
          demoSettleRef.current = setTimeout(() => {
            demoSettleRef.current = null

            // Spawn actual objects in the viewport so the new (no-explosion) behavior is visible
            const editorStore = useEditorStore.getState()
            const workspaceId = editorStore.rootObjectIds[0]
            if (workspaceId) {
              const colors = ['#FF6B6B', '#4ECDC4', '#FFE66D']
              const positions: [number, number, number][] = [[-3, 0.5, 0], [0, 0.5, 0], [3, 0.5, 0]]
              positions.forEach(([px, py, pz], i) => {
                editorStore.createAndConfigureObject(
                  'mesh',
                  `Platform_${i + 1}`,
                  workspaceId,
                  {
                    primitiveType: 'box',
                    color: colors[i],
                    transform: {
                      position: { x: px, y: py, z: pz },
                      rotation: { x: 0, y: 0, z: 0 },
                      scale: { x: 2, y: 0.4, z: 2 },
                    },
                  },
                )
              })
            }

            convStore.addMessage(convId, {
              id: `assistant-demo-${Date.now()}`,
              role: 'assistant',
              textContent: DEMO_RESPONSE,
              toolCalls: DEMO_TOOL_CALLS.map((tc, i) => ({
                toolCallId: `tc-demo-${Date.now()}-${i}`,
                toolName: tc.toolName,
                args: tc.args,
                result: tc.result,
              })),
              timestamp: Date.now(),
            })
            setIsDemoLoading(false)
            setDemoStreamingText('')
          }, 400)
        }
      }, WORD_DELAY_MS)
    }, 1500)
  }, [isDemoLoading, DEMO_RESPONSE, DEMO_TOOL_CALLS])

  // Feedback takeover state
  const [feedbackTarget, setFeedbackTarget] = useState<{ messageId: string; type: 'up' | 'down' } | null>(null)
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackIssueType, setFeedbackIssueType] = useState('')
  const [feedbackIssueDropdownOpen, setFeedbackIssueDropdownOpen] = useState(false)

  // File upload state (Gap 1)
  const [pendingFiles, setPendingFiles] = useState<{ file: File; dataUrl: string }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [plusMenuOpen, setPlusMenuOpen] = useState(false)
  const plusButtonRef = useRef<HTMLButtonElement>(null)
  const plusMenuRef = useRef<HTMLDivElement>(null)
  const [plusMenuPos, setPlusMenuPos] = useState<{ left: number; bottom: number } | null>(null)
  const [filterMenuOpen, setFilterMenuOpen] = useState(false)
  const filterButtonRef = useRef<HTMLButtonElement>(null)
  const filterMenuRef = useRef<HTMLDivElement>(null)
  const [filterMenuPos, setFilterMenuPos] = useState<{ left: number; bottom: number } | null>(null)
  const [enabledTools, setEnabledTools] = useState<Set<string>>(() => new Set(FILTER_TOOLS.map(t => t.id)))

  // Close plus menu on outside click
  useEffect(() => {
    if (!plusMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (
        plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node) &&
        plusButtonRef.current && !plusButtonRef.current.contains(e.target as Node)
      ) {
        setPlusMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [plusMenuOpen])

  // Close filter menu on outside click
  useEffect(() => {
    if (!filterMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (
        filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node) &&
        filterButtonRef.current && !filterButtonRef.current.contains(e.target as Node)
      ) {
        setFilterMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [filterMenuOpen])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    Array.from(files).forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => {
        setPendingFiles((prev) => [...prev, { file, dataUrl: reader.result as string }])
      }
      reader.readAsDataURL(file)
    })
    // Reset so the same file can be re-selected
    e.target.value = ''
  }, [])

  const removePendingFile = useCallback((index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const [isDragging, setIsDragging] = useState(false)
  const dragCounterRef = useRef(0)

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setIsDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    dragCounterRef.current = 0
    const files = e.dataTransfer.files
    if (!files.length) return
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = () => {
        setPendingFiles((prev) => [...prev, { file, dataUrl: reader.result as string }])
      }
      reader.readAsDataURL(file)
    })
  }, [])

  // Per-conversation input drafts — save/restore when switching tabs
  const draftsRef = useRef<Map<string, InputSegment[]>>(new Map())
  const segmentsRef = useRef(segments)
  segmentsRef.current = segments
  const prevConversationIdRef = useRef<string | null>(activeConversationId)

  useEffect(() => {
    const prevId = prevConversationIdRef.current
    if (prevId && prevId !== activeConversationId) {
      // Save current input as draft for the conversation we're leaving
      draftsRef.current.set(prevId, segmentsRef.current)
      // Restore draft for the conversation we're entering (or start empty)
      const draft = activeConversationId ? draftsRef.current.get(activeConversationId) ?? [] : []
      setSegments(draft)
    }
    prevConversationIdRef.current = activeConversationId
  }, [activeConversationId])

  // Keyboard shortcuts for plan actions
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return
      const plan = usePlanStore.getState().activePlan
      if (!plan || plan.status !== 'pending') return

      if (e.key === 'Enter') {
        e.preventDefault()
        usePlanStore.getState().approvePlan()
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        usePlanStore.getState().rejectPlan()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Loading state — background tasks + demo simulation
  const isLoading = isBackgroundTaskRunning || isDemoLoading

  // Classification in use-background-task-runner now handles expand/collapse decisions

  // No pending tool count in local mode — all execution is synchronous
  const pendingToolCount = 0

  // Submit helper: routes through background task system (keyword engine)
  const doSubmit = () => {
    const text = pillInputRef.current?.getTextContent()?.trim() ?? ''
    if ((!text && pendingFiles.length === 0) || isLoading) return

    // Demo simulation
    if (text === '/demo') {
      setSegments([])
      runDemo()
      return
    }

    // Check if any collaborator pills are present → route to comments thread
    const collabPills = segments.filter(
      (s) => s.type === 'pill' && s.kind === 'collaborator',
    )
    if (collabPills.length > 0 && pendingFiles.length === 0) {
      const commentText = segments
        .map((s) => (s.type === 'text' ? s.text : s.kind === 'collaborator' ? '' : s.label))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
      useCommentStore.getState().addComment({
        author: 'You',
        text: commentText,
        taggedCollaboratorIds: collabPills.map((s) => s.type === 'pill' ? s.id : ''),
        taggedCollaboratorNames: collabPills.map((s) => s.type === 'pill' ? s.label : ''),
      })
      const dock = useDockingStore.getState()
      if (!dock.widgets['comments']) {
        dock.dockWidget('comments', 'right-top')
      }
      setSegments([])
      if (activeConversationId) {
        draftsRef.current.delete(activeConversationId)
      }
      return
    }

    useEditorStore.getState().selectObject(null)
    useEditorStore.getState().selectAsset(null)

    // Save user message to the active conversation
    const convStore = useConversationStore.getState()
    const targetConvId = convStore.activeConversationId
    if (targetConvId) {
      convStore.addMessage(targetConvId, {
        id: `user-${Date.now()}`,
        role: 'user',
        textContent: text,
        timestamp: Date.now(),
      })
    }

    // If /generate command with pending images, prepend image data URL marker
    let commandText = text
    if (/^\/?generate/i.test(text) && pendingFiles.length > 0) {
      const imageFile = pendingFiles.find((pf) => pf.file.type.startsWith('image/'))
      if (imageFile) {
        commandText = `[IMAGE:${imageFile.dataUrl}] ${text}`
      }
    }

    // Route through background task store → keyword engine (pass conversationId so response is saved)
    enqueueTask(commandText, targetConvId ?? undefined)
    setPendingFiles([])

    setSegments([])
    if (activeConversationId) {
      draftsRef.current.delete(activeConversationId)
    }
  }

  const hasText = segments.some(s => (s.type === 'text' && s.text.trim()) || s.type === 'pill') || pendingFiles.length > 0

  const compactInputBar = (inExpandedView: boolean) => {
    const handleSubmit = () => doSubmit()
    const hasCurrentTask =
      chatbotUIMode === 'dropdown' &&
      activePlan &&
      activePlan.status !== 'rejected'
    const placeholderText = hasCurrentTask ? 'Add a follow-up' : 'Build anything'
    return (
      <div
        className={`${styles.collapsedInputOnly} ${inExpandedView ? styles.compactInputBarInExpanded : ''} ${isDragging ? styles.collapsedInputDragging : ''}`}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {!inExpandedView && (
          <button
            type="button"
            className={styles.collapsedExpandButton}
            onClick={() => setAiAssistantBodyCollapsed(false)}
            title="Expand AI Assistant"
            aria-label="Expand AI Assistant"
          >
            <img src={publicUrl('icons/Expand.svg')} alt="" width={16} height={16} />
          </button>
        )}
        <div className={styles.collapsedInputContent}>
          {/* Pending file previews — shown above the input */}
          {pendingFiles.length > 0 && (
            <div className={styles.pendingFiles}>
              {pendingFiles.map((pf, i) => (
                <div key={i} className={styles.pendingFile}>
                  {pf.file.type.startsWith('image/') ? (
                    <img src={pf.dataUrl} alt={pf.file.name} className={styles.pendingFileThumb} />
                  ) : (
                    <span className={styles.pendingFileName}>{pf.file.name}</span>
                  )}
                  <button
                    type="button"
                    className={styles.pendingFileRemove}
                    onClick={() => removePendingFile(i)}
                    aria-label={`Remove ${pf.file.name}`}
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {/* Row 1: input + expand */}
          <div className={styles.collapsedInputRow1}>
            <div className={styles.collapsedInputTextWrap}>
              <PillInput
                ref={pillInputRef}
                segments={segments}
                onSegmentsChange={setSegments}
                onSubmit={handleSubmit}
                placeholder={placeholderText}
                disabled={isLoading}
                className={`${styles.input} ${styles.inputCollapsedTextarea}`}
                ariaLabel="Build anything"
                onMentionQuery={setMentionQuery}
                onSlashQuery={setSlashQuery}
                suggestion={suggestion}
                onAcceptSuggestion={handleAcceptSuggestion}
              />
              <MentionDropdown
                mention={mentionQuery}
                items={mentionItems}
                pillInputRef={pillInputRef}
                onClose={() => setMentionQuery(null)}
              />
              <SlashCommandDropdown
                query={slashQuery}
                commands={SLASH_COMMANDS}
                pillInputRef={pillInputRef}
                onClose={() => setSlashQuery(null)}
              />
            </div>
          </div>
          {/* Row 2: Plus left, Send right (Figma utility row) */}
          <div className={styles.collapsedInputRow2}>
            <div className={styles.plusMenuWrap}>
              <button
                ref={plusButtonRef}
                type="button"
                className={`${styles.collapsedInputPlusButton} ${plusMenuOpen ? styles.collapsedInputPlusButtonOpen : ''}`}
                onClick={() => {
                  if (!plusMenuOpen && plusButtonRef.current) {
                    const rect = plusButtonRef.current.getBoundingClientRect()
                    setPlusMenuPos({ left: rect.left, bottom: window.innerHeight - rect.top + 6 })
                  }
                  setPlusMenuOpen(!plusMenuOpen)
                }}
                title={plusMenuOpen ? 'Close' : 'Attach'}
                aria-label={plusMenuOpen ? 'Close' : 'Attach'}
              >
                <Plus size={16} />
              </button>
              {plusMenuOpen && plusMenuPos && (
                <div
                  ref={plusMenuRef}
                  className={styles.plusMenu}
                  style={{ position: 'fixed', left: plusMenuPos.left, bottom: plusMenuPos.bottom }}
                >
                  <button
                    type="button"
                    className={styles.plusMenuOption}
                    onClick={() => { setPlusMenuOpen(false); fileInputRef.current?.click() }}
                  >
                    Add files or photos
                  </button>
                </div>
              )}
            </div>
            <button
              ref={filterButtonRef}
              type="button"
              className={`${styles.collapsedInputFilterButton} ${filterMenuOpen ? styles.collapsedInputFilterButtonOpen : ''}`}
              onClick={() => {
                if (!filterMenuOpen && filterButtonRef.current) {
                  const rect = filterButtonRef.current.getBoundingClientRect()
                  setFilterMenuPos({ left: rect.left, bottom: window.innerHeight - rect.top + 6 })
                }
                setFilterMenuOpen(!filterMenuOpen)
              }}
              title="Filter tools"
              aria-label="Filter tools"
            >
              <img src={filterIcon} alt="" width={16} height={16} />
            </button>
            {filterMenuOpen && filterMenuPos && (
              <div
                ref={filterMenuRef}
                className={styles.filterMenu}
                style={{ position: 'fixed', left: filterMenuPos.left, bottom: filterMenuPos.bottom }}
              >
                <div className={styles.filterMenuSection}>First party tools</div>
                {FILTER_TOOLS.map(tool => (
                  <button
                    key={tool.id}
                    type="button"
                    className={styles.filterMenuOption}
                    onClick={() => {
                      setEnabledTools(prev => {
                        const next = new Set(prev)
                        if (next.has(tool.id)) next.delete(tool.id)
                        else next.add(tool.id)
                        return next
                      })
                    }}
                  >
                    <div className={`${styles.filterCheckbox} ${enabledTools.has(tool.id) ? styles.filterCheckboxChecked : ''}`}>
                      {enabledTools.has(tool.id) && <Check size={9} strokeWidth={3} />}
                    </div>
                    <span>{tool.label}</span>
                  </button>
                ))}
              </div>
            )}
            <div className={styles.collapsedInputRow2Spacer} aria-hidden />
            <div className={styles.sendGroup}>
              <button
                type="button"
                className={styles.collapsedInputTrailingButton}
                onClick={isDemoLoading ? stopDemo : handleSubmit}
                disabled={isDemoLoading ? false : (!hasText || isLoading)}
                title={isDemoLoading ? 'Stop simulation' : 'Send message'}
                aria-label={isDemoLoading ? 'Stop simulation' : 'Send message'}
              >
                {isDemoLoading ? <X size={16} /> : <ArrowUp size={16} />}
              </button>
            </div>
          </div>
        </div>
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx,.txt,.csv,.json"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
      </div>
    )
  }

  // --- Question Composer (replaces input bar during clarifying mode) ---
  const questionDraft = usePlanStore((s) => s.questionDraft)
  const updateDraftAnswer = usePlanStore((s) => s.updateDraftAnswer)
  const setActiveQuestionIndex = usePlanStore((s) => s.setActiveQuestionIndex)
  const answerQuestions = usePlanStore((s) => s.answerQuestions)
  const editQuestions = usePlanStore((s) => s.editQuestions)
  const rejectPlan = usePlanStore((s) => s.rejectPlan)

  // Compute ordered question indices (same logic as PlanCard)
  const planQuestions = activePlan?.data.questions ?? []
  const DEFAULT_CATEGORY = 'Summary'
  const CATEGORY_ORDER = ['Scope', 'Gameplay', 'World', 'Layout', 'Style', 'Summary']
  const qByCategory = useMemo(() => {
    const map = new Map<string, number[]>()
    planQuestions.forEach((q, i) => {
      const cat = q.category?.trim() || DEFAULT_CATEGORY
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(i)
    })
    return map
  }, [planQuestions])
  const orderedQuestionIndices = useMemo(() => {
    const ordered = CATEGORY_ORDER.filter((c) => qByCategory.has(c))
    const other = [...qByCategory.keys()].filter((c) => !CATEGORY_ORDER.includes(c))
    return [...ordered, ...other].flatMap((cat) => qByCategory.get(cat) ?? [])
  }, [qByCategory])

  // Sync question PillInput segments when active question changes
  const prevActiveQIdxRef = useRef<number>(-1)
  useEffect(() => {
    if (!isClarifying) {
      prevActiveQIdxRef.current = -1
      return
    }
    if (prevActiveQIdxRef.current === questionDraft.activeQuestionIndex) return
    prevActiveQIdxRef.current = questionDraft.activeQuestionIndex
    const qIdx = orderedQuestionIndices[questionDraft.activeQuestionIndex]
    if (qIdx === undefined) return
    const { draftAnswers } = usePlanStore.getState().questionDraft
    const draftVal = draftAnswers[qIdx] ?? ''
    const q = planQuestions[qIdx]
    const opts = q?.options ?? []
    const optionLabels = new Set(opts.map((o) => o.label))
    // Strip out preset card labels — only show custom text the user typed in "Other"
    const customParts = draftVal.split('\n').filter((l) => l && !optionLabels.has(l))
    const inputVal = customParts.join('\n')
    const segs: InputSegment[] = inputVal ? [{ type: 'text', text: inputVal }] : []
    setQuestionSegments(segs)
    questionSegmentsRef.current = segs
  }, [isClarifying, questionDraft.activeQuestionIndex, orderedQuestionIndices, planQuestions])

  // Keyboard interactions for question composer
  useEffect(() => {
    if (!isClarifying || orderedQuestionIndices.length === 0) return
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      const isEditable = (e.target as HTMLElement)?.isContentEditable
      // Arrow left/right to navigate questions (when not in an input or contentEditable)
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !isEditable) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault()
          const { activeQuestionIndex } = usePlanStore.getState().questionDraft
          usePlanStore.getState().setActiveQuestionIndex(Math.max(0, activeQuestionIndex - 1))
          return
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          const { activeQuestionIndex } = usePlanStore.getState().questionDraft
          if (activeQuestionIndex < orderedQuestionIndices.length - 1) {
            usePlanStore.getState().setActiveQuestionIndex(activeQuestionIndex + 1)
          } else {
            usePlanStore.getState().startReview()
          }
          return
        }
        // Number keys 1-4 select option card
        let optIndex = -1
        if (e.key >= '1' && e.key <= '4') {
          optIndex = parseInt(e.key) - 1
        }
        if (optIndex >= 0) {
          const { activeQuestionIndex } = usePlanStore.getState().questionDraft
          const questionIndex = orderedQuestionIndices[activeQuestionIndex]
          if (questionIndex === undefined) return
          const q = planQuestions[questionIndex]
          const opts = q?.options ?? []
          if (optIndex < opts.length) {
            e.preventDefault()
            usePlanStore.getState().updateDraftAnswer(questionIndex, opts[optIndex].label)
            // Advance to next question, or review on last
            if (activeQuestionIndex < orderedQuestionIndices.length - 1) {
              usePlanStore.getState().setActiveQuestionIndex(activeQuestionIndex + 1)
            } else {
              usePlanStore.getState().startReview()
            }
          }
          return
        }
      }
      // Cmd+Enter: on last question → review; on review screen → submit; otherwise → next question
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        const plan = usePlanStore.getState().activePlan
        const { draftAnswers, activeQuestionIndex } = usePlanStore.getState().questionDraft
        if (plan?.status === 'reviewing') {
          e.preventDefault()
          usePlanStore.getState().answerQuestions(draftAnswers)
        } else if (activeQuestionIndex >= orderedQuestionIndices.length - 1) {
          // On last question — go to review if there's at least one answer
          if (draftAnswers.some((a) => a.trim().length > 0)) {
            e.preventDefault()
            usePlanStore.getState().startReview()
          }
        } else {
          // Not on last question — advance to next
          e.preventDefault()
          usePlanStore.getState().setActiveQuestionIndex(activeQuestionIndex + 1)
        }
      }
      // Enter (no modifier) on multi-select: advance to next question / review
      if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        const plan = usePlanStore.getState().activePlan
        if (plan?.status !== 'clarifying') return
        const { activeQuestionIndex } = usePlanStore.getState().questionDraft
        const questionIndex = orderedQuestionIndices[activeQuestionIndex]
        if (questionIndex === undefined) return
        const q = planQuestions[questionIndex]
        if (q?.multiSelect === false) return
        // Only handle when not in an editable field
        if (tag === 'INPUT' || tag === 'TEXTAREA' || isEditable) return
        e.preventDefault()
        if (activeQuestionIndex < orderedQuestionIndices.length - 1) {
          usePlanStore.getState().setActiveQuestionIndex(activeQuestionIndex + 1)
        } else {
          const { draftAnswers } = usePlanStore.getState().questionDraft
          if (draftAnswers.some((a) => a.trim().length > 0)) {
            usePlanStore.getState().startReview()
          }
        }
      }
      // Escape to dismiss plan
      if (e.key === 'Escape') {
        e.preventDefault()
        usePlanStore.getState().rejectPlan()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isClarifying, orderedQuestionIndices, planQuestions])

  const questionComposer = () => {
    if (!activePlan || !isClarifying) return null
    const { draftAnswers, activeQuestionIndex } = questionDraft
    const isReviewing = activePlan.status === 'reviewing'

    // --- Review view ---
    if (isReviewing) {
      return (
        <div className={styles.reviewComposer}>
          <div className={styles.reviewBody}>
            <div className={styles.reviewHeader}>
              <div className={styles.reviewHeaderLabel}>Review</div>
              <button
                type="button"
                className={styles.reviewCloseButton}
                onClick={() => rejectPlan()}
                aria-label="Dismiss review"
              >
                <X size={14} />
              </button>
            </div>
            <div className={styles.reviewList}>
              {orderedQuestionIndices.map((qIdx) => {
                const question = planQuestions[qIdx]
                if (!question) return null
                const answer = draftAnswers[qIdx]?.trim()
                return (
                  <div key={qIdx} className={styles.reviewItem}>
                    <div className={styles.reviewItemQuestion}>{question.text}</div>
                    <div className={styles.reviewItemAnswer}>
                      {answer || 'Skipped'}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className={styles.reviewActions}>
              <button
                type="button"
                className={styles.reviewContinueButton}
                onClick={() => answerQuestions(draftAnswers)}
              >
                Continue <span className={styles.reviewKbd}>(⌘↵)</span>
              </button>
              <button
                type="button"
                className={styles.reviewEditButton}
                onClick={() => editQuestions()}
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      )
    }

    // --- Per-question view ---
    const questionIndex = orderedQuestionIndices[activeQuestionIndex]
    if (questionIndex === undefined) return null
    const q = planQuestions[questionIndex]
    if (!q) return null
    const opts = q.options ?? []

    return (
      <div className={styles.feedbackComposer}>
        <div className={`${styles.feedbackComposerBody} ${styles.feedbackComposerBodyClarifying}`}>
          <div className={styles.questionHeader}>
            <div className={styles.questionHeaderLabel}>{q.text}</div>
            {orderedQuestionIndices.length > 1 && (
              <div className={styles.questionHeaderNav}>
                <button
                  type="button"
                  className={styles.questionHeaderNavButton}
                  onClick={() => setActiveQuestionIndex(Math.max(0, activeQuestionIndex - 1))}
                  disabled={activeQuestionIndex === 0}
                  aria-label="Previous question"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className={styles.questionComposerNavLabel} aria-live="polite">
                  {activeQuestionIndex + 1}/{orderedQuestionIndices.length}
                </span>
                <button
                  type="button"
                  className={styles.questionHeaderNavButton}
                  onClick={() => setActiveQuestionIndex(Math.min(orderedQuestionIndices.length - 1, activeQuestionIndex + 1))}
                  disabled={activeQuestionIndex === orderedQuestionIndices.length - 1}
                  aria-label="Next question"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
            <button
              type="button"
              className={styles.questionHeaderCloseButton}
              onClick={() => rejectPlan()}
              aria-label="Dismiss questions"
            >
              <X size={14} />
            </button>
          </div>
          <div className={styles.feedbackComposerBodyContent}>
            {segments.some(s => s.type === 'pill') && (
              <div className={styles.contextChipsStrip}>
                {segments.map((s) => (
                  s.type === 'pill' && (
                    <span key={s.id} className={styles.contextChip}>
                      {s.label}
                    </span>
                  )
                ))}
              </div>
            )}

            {(() => {
              // multiSelect defaults to true (bias toward multi-select)
              const isMulti = q.multiSelect !== false
              const currentAnswer = draftAnswers[questionIndex] ?? ''
              const selectedLabels = isMulti
                ? currentAnswer.split('\n').filter(Boolean)
                : [currentAnswer]
              const optionLabels = new Set(opts.map(o => o.label))
              const isPresetAnswer = selectedLabels.length > 0 && selectedLabels.every(l => optionLabels.has(l))
              const isCustomSelected = currentAnswer.trim().length > 0 && !isPresetAnswer
              const isCustomActive = isCustomSelected || questionInputFocused

              function toggleOption(label: string) {
                setQuestionSegments([])
                questionSegmentsRef.current = []
                setQuestionInputFocused(false)
                if (questionPillInputRef.current) {
                  ;(questionPillInputRef.current as unknown as HTMLElement).blur?.()
                }

                if (isMulti) {
                  const current = (draftAnswers[questionIndex] ?? '').split('\n').filter(Boolean)
                  const next = current.includes(label)
                    ? current.filter(l => l !== label)
                    : [...current, label]
                  updateDraftAnswer(questionIndex, next.join('\n'))
                } else {
                  updateDraftAnswer(questionIndex, label)
                  if (activeQuestionIndex < orderedQuestionIndices.length - 1) {
                    setActiveQuestionIndex(activeQuestionIndex + 1)
                  } else {
                    usePlanStore.getState().startReview()
                  }
                }
              }

              return (
                <div className={styles.questionComposerChoices}>
                  <div className={styles.questionComposerChoicesInner}>
                    {opts.map((opt, optIdx) => {
                      const isSelected = selectedLabels.includes(opt.label)
                      const shortcutKey = optIdx < 4 ? String(optIdx + 1) : undefined
                      return (
                        <button
                          key={`${questionIndex}-${optIdx}-${opt.label}`}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          className={`${styles.planningComposerOptionCard} ${isSelected ? styles.planningComposerOptionCardSelected : ''}`}
                          onClick={() => toggleOption(opt.label)}
                        >
                          {isMulti ? (
                            <span className={`${styles.questionComposerCheckbox} ${isSelected ? styles.questionComposerCheckboxChecked : ''}`}>
                              {isSelected && (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </span>
                          ) : (
                            shortcutKey && <span className={`${styles.planningComposerOptionCardShortcut} ${isSelected ? styles.planningComposerOptionCardShortcutSelected : ''}`}>{shortcutKey}</span>
                          )}
                          <div className={styles.planningComposerOptionCardContent}>
                            <span className={styles.planningComposerOptionCardLabel}>{opt.label}</span>
                            {opt.description && (
                              <span className={styles.planningComposerOptionCardCaption}>{opt.description}</span>
                            )}
                          </div>
                        </button>
                      )
                    })}
                    <div className={`${styles.questionComposerInputRow} ${isCustomActive ? styles.questionComposerInputRowSelected : ''}`}>
                      {isMulti ? (
                        <span className={`${styles.questionComposerCheckbox} ${isCustomActive ? styles.questionComposerCheckboxChecked : ''}`}>
                          {isCustomActive && (
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </span>
                      ) : (
                        <span className={`${styles.planningComposerOptionCardShortcut} ${isCustomActive ? styles.planningComposerOptionCardShortcutSelected : ''}`}>{opts.length + 1}</span>
                      )}
                      <div style={{ flex: 1, position: 'relative' }}>
                        <PillInput
                          ref={questionPillInputRef}
                          segments={questionSegments}
                          onSegmentsChange={(segs) => {
                            setQuestionSegments(segs)
                            questionSegmentsRef.current = segs
                            const text = getTextFromSegments(segs)
                            if (isMulti) {
                              // Preserve selected card labels, replace only the custom text portion
                              const current = (draftAnswers[questionIndex] ?? '').split('\n').filter(Boolean)
                              const presetLabels = current.filter(l => optionLabels.has(l))
                              const combined = text.trim()
                                ? [...presetLabels, text.trim()]
                                : presetLabels
                              updateDraftAnswer(questionIndex, combined.join('\n'))
                            } else {
                              updateDraftAnswer(questionIndex, text)
                            }
                          }}
                          placeholder={q.placeholder ?? 'Other...'}
                          className={styles.questionComposerInput}
                          ariaLabel="Other..."
                          onFocus={() => {
                            setQuestionInputFocused(true)
                            // In single-select, clear preset selection
                            if (!isMulti && isPresetAnswer) {
                              updateDraftAnswer(questionIndex, '')
                            }
                          }}
                          onBlur={() => setQuestionInputFocused(false)}
                          onMentionQuery={setQuestionMentionQuery}
                        />
                        <MentionDropdown
                          mention={questionMentionQuery}
                          items={mentionItems}
                          pillInputRef={questionPillInputRef}
                          onClose={() => setQuestionMentionQuery(null)}
                        />
                      </div>
                      {isCustomActive && (
                        <button
                          type="button"
                          className={styles.questionComposerCheckButton}
                          onClick={() => {
                            if (activeQuestionIndex < orderedQuestionIndices.length - 1) {
                              setActiveQuestionIndex(activeQuestionIndex + 1)
                            } else {
                              usePlanStore.getState().startReview()
                            }
                          }}
                          aria-label="Confirm answer"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                    <div className={styles.questionComposerSkipRow}>
                      {isMulti && (
                        <button
                          type="button"
                          className={`${styles.questionComposerActionButton} ${styles.questionComposerActionButtonPrimary}`}
                          onClick={() => {
                            if (activeQuestionIndex < orderedQuestionIndices.length - 1) {
                              setActiveQuestionIndex(activeQuestionIndex + 1)
                            } else {
                              usePlanStore.getState().startReview()
                            }
                          }}
                          aria-label="Next question"
                        >
                          Next <span className={styles.questionComposerKbd}>(↵)</span>
                        </button>
                      )}
                      <button
                        type="button"
                        className={styles.questionComposerSkipButton}
                        onClick={() => {
                          if (activeQuestionIndex < orderedQuestionIndices.length - 1) {
                            setActiveQuestionIndex(activeQuestionIndex + 1)
                          } else {
                            usePlanStore.getState().startReview()
                          }
                        }}
                        aria-label="Skip question"
                      >
                        Skip
                      </button>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
        <div className={styles.feedbackComposerFooter}>
          Use arrow keys to navigate questions. Press number keys to select options.
        </div>
      </div>
    )
  }

  const isAboveComposer = taskDrawerMode === 'above-composer'
  // Always show the Tasks dropdown in the header
  const showTasksDropdown = true

  const aiSidebarOpen = useDockingStore((s) => s.aiSidebarOpen)
  const rightPanelWidth = useDockingStore((s) => s.panelSizes.rightWidth)

  // Auto-show/hide sidebar when docked panel width crosses 350px
  useEffect(() => {
    if (assistantPanelMode !== 'right') return
    const shouldBeOpen = rightPanelWidth >= 300
    useDockingStore.getState().setAiSidebarOpen(shouldBeOpen)
  }, [rightPanelWidth, assistantPanelMode])

  const sidenavSidebarToggleEl =
    chatbotUIMode === 'sidenav' ? (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          useDockingStore.getState().toggleAiSidebar()
        }}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        title="Toggle sidebar"
        aria-label="Toggle sidebar"
      >
        <img src={publicUrl('icons/sidebar.svg')} alt="" width={16} height={16} aria-hidden />
      </button>
    ) : undefined

  const tasksDropdownEl = showTasksDropdown && chatbotUIMode !== 'tabs' && chatbotUIMode !== 'sidenav' ? <TasksDropdown hideTriggerIcon={isAboveComposer} /> : undefined

  const rightActionsEl = taskDrawerMenuSide === 'right' ? tasksDropdownEl : undefined

  return (
    <DockablePanel
      widgetId="ai-assistant"
      title="Assistant"
      titleLeading={sidenavSidebarToggleEl ?? (taskDrawerMenuSide === 'left' ? tasksDropdownEl : undefined)}
      titleTrailing={taskDrawerMenuSide === 'center' ? tasksDropdownEl : undefined}
      headerCenterTitle={!isAboveComposer && taskDrawerMenuSide === 'center' && chatbotUIMode !== 'tabs'}
      headerTitleFirst={isAboveComposer || taskDrawerMenuSide === 'left' || taskDrawerMenuSide === 'right' || chatbotUIMode === 'tabs'}
      actions={rightActionsEl}
      bodyCollapsed={aiAssistantBodyCollapsed}
      collapsedShowsMinimalContent
      hideHeaderWhenCollapsed
      hideCloseButton
      contentFills
    >
      <div className={`${styles.content} ${aiAssistantBodyCollapsed ? styles.contentCollapsed : ''}`}>
        {aiAssistantBodyCollapsed ? (
          <div className={styles.collapsedDrawerStack}>
            {chatbotUIMode !== 'queue' && chatbotUIMode !== 'sidenav' && <BackgroundTaskDrawer />}
            {compactInputBar(false)}
          </div>
        ) : (
          <div className={`${styles.contentBody} ${aiSidebarOpen ? styles.contentBodyWithSidebar : ''}`.trim()}>
            {aiSidebarOpen && <AssistantSidebar />}
            <div className={styles.mainContentColumn}>
              <div className={styles.mainContent}>
                <MessageList
                  messages={[
                    ...conversationMessages.map((m) => ({
                      id: m.id,
                      role: m.role,
                      parts: [
                        ...(m.textContent ? [{ type: 'text' as const, text: m.textContent }] : []),
                        ...(m.toolCalls ?? []).map((tc) => ({
                          type: `tool-${tc.toolName}` as const,
                          toolCallId: tc.toolCallId ?? `tc-${m.id}-${tc.toolName}`,
                          toolName: tc.toolName,
                          state: 'output-available' as const,
                          input: tc.args ?? {},
                          output: tc.result,
                        })),
                      ],
                    })),
                    // Inject streaming demo message while simulation is running
                    ...(isDemoLoading && demoStreamingText ? [{
                      id: 'demo-streaming',
                      role: 'assistant' as const,
                      parts: [{ type: 'text' as const, text: demoStreamingText }],
                    }] : []),
                  ]}
                  isLoading={isLoading || questionThinking}
                  pendingToolCount={questionThinking ? 0 : pendingToolCount}
                  onFeedback={(messageId, type) => {
                    setFeedbackTarget({ messageId, type })
                    setFeedbackText('')
                    setFeedbackIssueType('')
                    setFeedbackIssueDropdownOpen(false)
                  }}
                  inlineFeedback={false}
                />
                {/* When not clarifying: plan card in main flow; when clarifying: moved to lower half */}
                {/* Skip standalone card when a conversation message already renders this plan */}
                {activePlan && activePlan.status !== 'rejected' && !isClarifying && !conversationMessages.some((m) => m.toolCalls?.some((tc) => tc.toolCallId === activePlan.id)) && (
                  <div style={{ padding: '0 12px 8px' }}>
                    <PlanCard toolData={{
                      toolCallId: activePlan.id,
                      toolName: 'createPlan',
                      state: 'result',
                      input: activePlan.data,
                    }} mentionItems={mentionItems} />
                  </div>
                )}
                {chatbotUIMode !== 'queue' && chatbotUIMode !== 'sidenav' && <BackgroundTaskDrawer />}
              </div>
              {feedbackTarget ? (
                <div className={styles.feedbackComposerLower}>
                  <div className={styles.feedbackComposer}>
                    <div className={styles.feedbackComposerBody}>
                      <div className={styles.questionHeader}>
                        <div className={styles.questionHeaderLabel}>
                          {feedbackTarget.type === 'up' ? 'Give positive feedback' : 'Give negative feedback'}
                        </div>
                        <button
                          type="button"
                          className={styles.questionHeaderCloseButton}
                          onClick={() => { setFeedbackTarget(null); setFeedbackText(''); setFeedbackIssueType('') }}
                          aria-label="Dismiss feedback"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <div className={styles.feedbackComposerBodyContent}>
                        {feedbackTarget.type === 'down' && (
                          <>
                            <div className={styles.feedbackComposerLabel}>What type of issue did you encounter? (optional)</div>
                            <div className={styles.feedbackSelectWrap}>
                              <button
                                type="button"
                                className={styles.feedbackSelectTrigger}
                                onClick={() => setFeedbackIssueDropdownOpen(!feedbackIssueDropdownOpen)}
                              >
                                <span className={feedbackIssueType ? styles.feedbackSelectValue : styles.feedbackSelectPlaceholder}>
                                  {feedbackIssueType || 'Select an Option'}
                                </span>
                                <ChevronDown size={12} className={styles.feedbackSelectChevron} />
                              </button>
                              {feedbackIssueDropdownOpen && (
                                <div className={styles.feedbackSelectMenu}>
                                  {['Incorrect information', 'Not helpful', 'Incomplete response', 'Other'].map((opt) => (
                                    <button
                                      key={opt}
                                      type="button"
                                      className={`${styles.feedbackSelectOption} ${feedbackIssueType === opt ? styles.feedbackSelectOptionSelected : ''}`}
                                      onClick={() => { setFeedbackIssueType(opt); setFeedbackIssueDropdownOpen(false) }}
                                    >
                                      {opt}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </>
                        )}
                        <div className={styles.feedbackComposerLabel}>Please provide details (optional)</div>
                        <textarea
                          className={styles.feedbackComposerTextarea}
                          placeholder={feedbackTarget.type === 'up'
                            ? 'What was satisfying about this response?'
                            : 'What was unsatisfying about this response?'}
                          value={feedbackText}
                          onChange={(e) => setFeedbackText(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault()
                              setFeedbackTarget(null)
                              setFeedbackText('')
                              setFeedbackIssueType('')
                            }
                            if (e.key === 'Escape') {
                              setFeedbackTarget(null)
                              setFeedbackText('')
                              setFeedbackIssueType('')
                            }
                          }}
                        />
                        <div className={styles.feedbackComposerActions}>
                          <button
                            type="button"
                            className={styles.feedbackComposerDismiss}
                            onClick={() => { setFeedbackTarget(null); setFeedbackText(''); setFeedbackIssueType('') }}
                          >
                            Dismiss
                          </button>
                          <button
                            type="button"
                            className={styles.feedbackComposerSubmit}
                            onClick={() => { setFeedbackTarget(null); setFeedbackText(''); setFeedbackIssueType('') }}
                          >
                            Submit <span className={styles.feedbackSubmitKbd}>(&#x23CE;)</span>
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className={styles.feedbackComposerFooter}>
                      This report will include the entire conversation for context and future improvements.
                    </div>
                  </div>
                </div>
              ) : isClarifying && !questionThinking ? (
                <div className={styles.questionComposerLower}>
                  {questionComposer()}
                </div>
              ) : (
                <div className={`${styles.compactInputBarInExpandedWrapper} ${assistantPanelMode === 'right' ? styles.compactInputBarPanelMode : ''}`}>
                  <div className={styles.compactInputBarComposerPad}>
                    {compactInputBar(true)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DockablePanel>
  )
}
