import { useState, useRef, useCallback, useEffect } from 'react'
import { Plus, X, Loader2 } from 'lucide-react'
import { stripLeadingBrackets, truncateTitle } from '../../ai/strip-brackets'
import { useConversationStore } from '../../store/conversationStore'
import { usePlanStore } from '../../store/planStore'
import { useBackgroundTaskStore } from '../../store/backgroundTaskStore'
import { useDockingStore } from '../../store/dockingStore'
import { publicUrl } from '../../utils/assetUrl'
import styles from './AIAssistant.module.css'

interface ConversationSwitcherProps {
  onSwitch?: () => void
}

export function ConversationSwitcher({ onSwitch }: ConversationSwitcherProps) {
  const [conversations, setConversations] = useState(() =>
    useConversationStore.getState().listConversations()
  )
  const [activeId, setActiveId] = useState(() =>
    useConversationStore.getState().activeConversationId
  )
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const isTaskRunning = useBackgroundTaskStore((s) => s.tasks.some((t) => t.status === 'running'))
  const activePlan = usePlanStore((s) => s.activePlan)
  const [streamingIds, setStreamingIds] = useState(
    () => useConversationStore.getState().streamingIds
  )
  const tabsStatusOption = useDockingStore((s) => s.tabsStatusOption)

  const isChatLoading = isTaskRunning
  const isPlanPendingApproval = activePlan?.status === 'pending' || activePlan?.status === 'clarifying'

  // Custom 0.5px scroll indicator
  const tabListRef = useRef<HTMLDivElement>(null)
  const [scrollThumb, setScrollThumb] = useState<{ left: string; width: string } | null>(null)

  const updateScrollThumb = useCallback(() => {
    const el = tabListRef.current
    if (!el) return
    const { scrollWidth, clientWidth, scrollLeft } = el
    if (scrollWidth <= clientWidth) {
      setScrollThumb(null)
      return
    }
    const ratio = clientWidth / scrollWidth
    const thumbWidth = ratio * 100
    const thumbLeft = (scrollLeft / scrollWidth) * 100
    setScrollThumb({ left: `${thumbLeft}%`, width: `${thumbWidth}%` })
  }, [])

  // Subscribe to conversation store changes without using the React hook API to avoid
  // useSyncExternalStore crashes.
  useEffect(() => {
    const unsubscribe = useConversationStore.subscribe((state) => {
      setConversations(state.listConversations())
      setActiveId(state.activeConversationId)
      setStreamingIds(state.streamingIds)
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    const el = tabListRef.current
    if (!el) return
    updateScrollThumb()
    el.addEventListener('scroll', updateScrollThumb, { passive: true })
    const ro = new ResizeObserver(updateScrollThumb)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', updateScrollThumb)
      ro.disconnect()
    }
  }, [updateScrollThumb, conversations.length])

  const handleNew = () => {
    useConversationStore.getState().createConversation()
    onSwitch?.()
  }

  const handleSwitch = (id: string) => {
    useConversationStore.getState().switchConversation(id)
    onSwitch?.()
  }

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    useConversationStore.getState().deleteConversation(id)
  }

  const handleStartRename = (e: React.MouseEvent, id: string, currentTitle: string) => {
    e.stopPropagation()
    setEditingId(id)
    setEditTitle(currentTitle)
  }

  const handleFinishRename = () => {
    if (editingId && editTitle.trim()) {
      useConversationStore.getState().renameConversation(editingId, editTitle.trim())
    }
    setEditingId(null)
    setEditTitle('')
  }

  return (
    <div className={styles.conversationSwitcher}>
      <div className={styles.tabListWrap}>
      <div className={styles.tabList} role="tablist" ref={tabListRef}>
        {conversations.map((conv) => (
          <div
            key={conv.id}
            role="tab"
            aria-selected={conv.id === activeId}
            className={`${styles.tab} ${conv.id === activeId ? styles.tabActive : ''}`}
          >
            <button
              type="button"
              className={styles.tabButton}
              onClick={() => handleSwitch(conv.id)}
              title={conv.summary || stripLeadingBrackets(conv.title)}
            >
              {(() => {
                const isActive = conv.id === activeId
                const showSpinner = isActive && isChatLoading
                const isStreamingInBackground = !isActive && streamingIds.has(conv.id)
                const showYellowDot =
                  (isActive && isPlanPendingApproval && !showSpinner) || isStreamingInBackground
                const showBlueDot = !showSpinner && !showYellowDot
                const showStatusArea =
                  tabsStatusOption === 'color' ||
                  tabsStatusOption === 'status' ||
                  (tabsStatusOption === 'none' && showYellowDot)
                return (
                  <>
                    {editingId === conv.id ? (
                <input
                  className={styles.tabRenameInput}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={handleFinishRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleFinishRename()
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                />
              ) : (
                <span
                  className={styles.tabLabel}
                  onDoubleClick={(e) => handleStartRename(e, conv.id, conv.title)}
                >
                  {truncateTitle(conv.summary || stripLeadingBrackets(conv.title))}
                </span>
              )}
                    {showStatusArea && (
                      <span className={styles.tabStatusIndicator} aria-hidden>
                        {tabsStatusOption !== 'none' && showSpinner && (
                          <Loader2 size={10} className={styles.tabStatusSpinner} />
                        )}
                        {showYellowDot && (
                          <span className={styles.tabStatusDotPending} />
                        )}
                        {tabsStatusOption === 'color' && showBlueDot && (
                          <span className={styles.tabStatusDotDone} />
                        )}
                        {tabsStatusOption === 'status' && !showSpinner && !showYellowDot && (
                          <img
                            src={publicUrl('prompts/completed.svg')}
                            alt="Done"
                            className={styles.tasksDropdownItemDoneIcon}
                            width={14}
                            height={14}
                          />
                        )}
                      </span>
                    )}
                  </>
                )
              })()}
            </button>
            {conv.id !== activeId && (
              <button
                type="button"
                className={styles.tabClose}
                onClick={(e) => handleDelete(e, conv.id)}
                title="Close"
                aria-label={`Close ${conv.summary || stripLeadingBrackets(conv.title)}`}
              >
                <X size={12} />
              </button>
            )}
          </div>
        ))}
      </div>
      {scrollThumb && (
        <div className={styles.tabScrollTrack}>
          <div
            className={styles.tabScrollThumb}
            style={{ left: scrollThumb.left, width: scrollThumb.width }}
          />
        </div>
      )}
      </div>
      <div className={styles.tabActions}>
        <div className={styles.tabNewWrap}>
          <button
            type="button"
            className={styles.tabNew}
            onClick={handleNew}
            title="New chat"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
