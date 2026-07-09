import { useState, useCallback, useEffect, useRef, memo } from 'react'
import { Plus, CheckCircle2, CircleSlash, Loader2, ChevronRight } from 'lucide-react'
import { useConversationStore } from '../../store/conversationStore'
import { useBackgroundTaskStore } from '../../store/backgroundTaskStore'
import { usePlanStore } from '../../store/planStore'
import { useDockingStore } from '../../store/dockingStore'
import { stripLeadingBrackets, truncateTitle } from '../../ai/strip-brackets'
import type { BackgroundTask, BackgroundTaskStatus } from '../../types'
import styles from './AssistantSidebar.module.css'

const AI_SIDEBAR_MIN = 180
const AI_SIDEBAR_MAX = 320

/* Must mirror the container query breakpoint in AIAssistant.module.css /
   AssistantSidebar.module.css. When the content body is this narrow or
   smaller, the sidenav is in "takeover" mode (fills the entire assistant
   panel, conversation column is hidden). */
const TAKEOVER_MAX_WIDTH = 420

type StatusBucketId = 'needs-input' | 'completed' | 'stopped' | 'active'

function bucketForTask(task: BackgroundTask): StatusBucketId {
  const status: BackgroundTaskStatus = task.status
  if (status === 'running') return 'active'
  if (status === 'pending') return 'needs-input'
  if (status === 'done') return 'completed'
  return 'stopped'
}

export const AssistantSidebar = memo(function AssistantSidebar() {
  const aiSidebarWidth = useDockingStore((s) => s.aiSidebarWidth)
  const setAiSidebarWidth = useDockingStore((s) => s.setAiSidebarWidth)
  const setAiSidebarOpen = useDockingStore((s) => s.setAiSidebarOpen)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Conversations
  const [conversations, setConversations] = useState(() =>
    useConversationStore.getState().listConversations()
  )
  const [activeId, setActiveId] = useState(() =>
    useConversationStore.getState().activeConversationId
  )

  useEffect(() => {
    const unsubscribe = useConversationStore.subscribe((state) => {
      setConversations(state.listConversations())
      setActiveId(state.activeConversationId)
    })
    return unsubscribe
  }, [])

  // Background tasks
  const tasks = useBackgroundTaskStore((s) => s.tasks)
  const taskHistory = useBackgroundTaskStore((s) => s.taskHistory)

  // Plan
  const activePlan = usePlanStore((s) => s.activePlan)

  // Expanded status buckets — all collapsed by default (matches mockup).
  const [expandedBuckets, setExpandedBuckets] = useState<Record<StatusBucketId, boolean>>({
    'needs-input': false,
    completed: false,
    stopped: false,
    active: false,
  })
  const toggleBucket = (id: StatusBucketId) =>
    setExpandedBuckets((prev) => ({ ...prev, [id]: !prev[id] }))

  const [planOpen, setPlanOpen] = useState(true)

  // Resize handle — uses document-level listeners so the drag keeps
  // tracking even when the pointer leaves the 4px handle strip.
  const onResizePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const startX = e.clientX
    const startW = aiSidebarWidth
    const prevUserSelect = document.body.style.userSelect
    const prevCursor = document.body.style.cursor
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'ew-resize'

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX
      const next = Math.max(AI_SIDEBAR_MIN, Math.min(AI_SIDEBAR_MAX, startW + dx))
      setAiSidebarWidth(next)
    }
    const onUp = () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointercancel', onUp)
      document.body.style.userSelect = prevUserSelect
      document.body.style.cursor = prevCursor
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onUp)
  }, [aiSidebarWidth, setAiSidebarWidth])

  const handleNewChat = () => {
    useConversationStore.getState().createConversation()
    setAiSidebarOpen(false)
  }

  const handleSwitchConversation = (id: string) => {
    useConversationStore.getState().switchConversation(id)
    // If the sidenav is currently taking over the entire assistant panel
    // (narrow-panel mode), selecting a chat should "open" the chat — close
    // the sidenav so the conversation column becomes visible again.
    const parentWidth = wrapRef.current?.parentElement?.clientWidth ?? Infinity
    if (parentWidth <= TAKEOVER_MAX_WIDTH) {
      setAiSidebarOpen(false)
    }
  }

  // Group all tasks (active + recent history) into status buckets.
  const allTasks = [...tasks, ...taskHistory.slice(0, 10)]
  const buckets: Record<StatusBucketId, BackgroundTask[]> = {
    'needs-input': [],
    completed: [],
    stopped: [],
    active: [],
  }
  for (const t of allTasks) {
    buckets[bucketForTask(t)].push(t)
  }
  const hasAnyBucketItems =
    buckets['needs-input'].length > 0 ||
    buckets.completed.length > 0 ||
    buckets.stopped.length > 0 ||
    buckets.active.length > 0

  const planTodos = activePlan?.data.todos ?? []
  const planStepStatuses = activePlan?.stepStatuses ?? []

  const renderBucket = (
    id: StatusBucketId,
    label: string,
    trailing: React.ReactNode,
  ) => {
    const items = buckets[id]
    const hasItems = items.length > 0
    if (!hasItems) return null
    const open = expandedBuckets[id]
    return (
      <>
        <div
          className={styles.statusRow}
          onClick={() => toggleBucket(id)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              toggleBucket(id)
            }
          }}
          aria-expanded={open}
        >
          <span className={styles.statusRowLabel}>{label}</span>
          <span className={styles.statusRowTrailing}>{trailing}</span>
        </div>
        {open && (
          <div className={styles.statusBucketItems}>
            {items.map((task) => (
              <div
                key={task.id}
                className={styles.bucketTaskRow}
                title={task.summary || task.command}
              >
                <span className={styles.bucketTaskName}>
                  {truncateTitle(task.summary || task.command)}
                </span>
              </div>
            ))}
          </div>
        )}
      </>
    )
  }

  return (
    <div ref={wrapRef} className={styles.sideNavWrap} style={{ width: aiSidebarWidth, minWidth: aiSidebarWidth }}>
      <div className={styles.newChatArea}>
        <button
          type="button"
          className={styles.newChatButton}
          onClick={handleNewChat}
        >
          <Plus size={16} />
          <span>New Chat</span>
        </button>
      </div>

      <nav className={styles.sideNav} aria-label="Assistant navigation">
        {/* Status buckets — only render buckets that have items (progressive disclosure). */}
        {hasAnyBucketItems && (
          <>
            <div className={styles.statusGroup}>
              {renderBucket(
                'needs-input',
                'Needs input',
                <span className={styles.awaitingPill}>Awaiting Approval</span>,
              )}
              {renderBucket(
                'completed',
                'Completed',
                <CheckCircle2 size={16} className={styles.statusIcon} aria-hidden="true" />,
              )}
              {renderBucket(
                'stopped',
                'Stopped',
                <CircleSlash size={16} className={styles.statusIcon} aria-hidden="true" />,
              )}
              {renderBucket(
                'active',
                'Active',
                <Loader2
                  size={16}
                  className={`${styles.statusIcon} ${buckets.active.length > 0 ? styles.statusIconSpin : ''}`}
                  aria-hidden="true"
                />,
              )}
            </div>

            <div className={styles.sectionDivider} role="separator" />
          </>
        )}

        {/* Recents (conversations) */}
        <div className={styles.recentsHeader}>RECENTS</div>
        {conversations.map((conv) => (
          <div
            key={conv.id}
            className={`${styles.recentRow} ${conv.id === activeId ? styles.recentRowActive : ''}`}
            onClick={() => handleSwitchConversation(conv.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && handleSwitchConversation(conv.id)}
            title={conv.summary || stripLeadingBrackets(conv.title)}
          >
            <span className={styles.recentName}>
              {truncateTitle(conv.summary || stripLeadingBrackets(conv.title))}
            </span>
          </div>
        ))}
        {conversations.length === 0 && (
          <div className={styles.recentRowEmpty}>No recent chats</div>
        )}

        {/* Plan (only shown when there's an active plan) */}
        {activePlan && (
          <>
            <div className={styles.sectionDivider} role="separator" />
            <div
              className={styles.recentsHeader}
              onClick={() => setPlanOpen(!planOpen)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setPlanOpen((v) => !v)}
              style={{ cursor: 'pointer' }}
            >
              <span
                className={`${styles.planChevron} ${planOpen ? styles.planChevronOpen : ''}`}
              >
                <ChevronRight size={12} />
              </span>
              PLAN
            </div>
            {planOpen && planTodos.map((todo, i) => {
              const stepStatus = planStepStatuses[i]
              return (
                <div key={i} className={styles.planStepRow}>
                  <span className={`${styles.planStepDot} ${
                    stepStatus === 'done' ? styles.statusCompleted :
                    stepStatus === 'executing' ? styles.statusRunning :
                    styles.statusPending
                  }`} />
                  <span className={`${styles.planStepLabel} ${
                    stepStatus === 'done' ? styles.planStepDone :
                    stepStatus === 'executing' ? styles.planStepExecuting : ''
                  }`}>
                    {todo.label}
                  </span>
                </div>
              )
            })}
          </>
        )}
      </nav>

      <div
        role="separator"
        aria-orientation="vertical"
        className={styles.sideNavResizeHandle}
        onPointerDown={onResizePointerDown}
      />
    </div>
  )
})
