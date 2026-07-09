import { useState, useRef, useLayoutEffect, useEffect } from 'react'
import { ChevronDown, Plus, Loader2 } from 'lucide-react'
import { stripLeadingBrackets, truncateTitle } from '../../ai/strip-brackets'
import { useConversationStore } from '../../store/conversationStore'
import { usePlanStore } from '../../store/planStore'
import { publicUrl } from '../../utils/assetUrl'
import styles from './AIAssistant.module.css'

interface TasksDropdownProps {
  /** When true, hide the task icon in the trigger (e.g. for "Above composer" layout) */
  hideTriggerIcon?: boolean
}

export function TasksDropdown({ hideTriggerIcon = false }: TasksDropdownProps) {
  const activePlan = usePlanStore((s) => s.activePlan)
  const needsApproval = activePlan?.status === 'pending' || activePlan?.status === 'clarifying'
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const [conversations, setConversations] = useState(() =>
    useConversationStore.getState().listConversations()
  )
  const [activeId, setActiveId] = useState(() =>
    useConversationStore.getState().activeConversationId
  )
  const [streamingIds, setStreamingIds] = useState<Set<string>>(
    () => useConversationStore.getState().streamingIds
  )

  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

  // Subscribe to conversation store changes without using the React hook API
  useEffect(() => {
    const unsubscribe = useConversationStore.subscribe((state) => {
      setConversations(state.listConversations())
      setActiveId(state.activeConversationId)
      setStreamingIds(state.streamingIds)
    })
    return unsubscribe
  }, [])

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !menuRef.current) {
      setPosition(null)
      return
    }
    const triggerRect = triggerRef.current.getBoundingClientRect()
    const menuEl = menuRef.current
    const pad = 8
    const vw = window.innerWidth
    const vh = window.innerHeight

    // Align dropdown underneath the trigger so it follows the icon in Left vs Center layout
    let left = triggerRect.left
    let top = triggerRect.bottom + 2

    // Clamp to viewport
    if (left + (menuEl.offsetWidth || 200) > vw - pad) left = vw - pad - (menuEl.offsetWidth || 200)
    if (left < pad) left = pad
    if (top + (menuEl.offsetHeight || 200) > vh - pad) top = triggerRect.top - (menuEl.offsetHeight || 0) - 2
    if (top < pad) top = pad

    setPosition({ top, left })
  }, [open, conversations.length])

  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const handleSelect = (id: string) => {
    useConversationStore.getState().switchConversation(id)
    setOpen(false)
  }

  const handleNewChat = () => {
    useConversationStore.getState().createConversation()
    setOpen(false)
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles.tasksDropdownTrigger}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Tasks dropdown"
        title="Switch task"
      >
        {!hideTriggerIcon && (
          <img src={publicUrl('icons/task-white.svg')} alt="" width={14} height={14} className={styles.tasksDropdownTriggerIcon} aria-hidden />
        )}
        <ChevronDown size={14} />
      </button>
      {open && (
        <div
          ref={menuRef}
          className={styles.tasksDropdownMenu}
          role="listbox"
          style={{
            position: 'fixed',
            ...(position
              ? { top: position.top, left: position.left }
              : { left: -9999, top: 0, visibility: 'hidden' as const }),
          }}
        >
          <button
            type="button"
            className={styles.tasksDropdownNewChat}
            onClick={handleNewChat}
          >
            <Plus size={14} />
            New Chat
          </button>
          <div className={styles.tasksDropdownList}>
            {conversations.length === 0 ? (
              <div className={styles.tasksDropdownEmpty}>No conversations yet</div>
            ) : (
              conversations.map((conv) => {
                const isActive = conv.id === activeId
                const isStreaming = streamingIds.has(conv.id)
                const isAwaitingApproval =
                  isActive && needsApproval && !isStreaming
                const isFailed = conv.messages.some((m) => m.isError)
                const isDone =
                  conv.messages.length > 0 && !isStreaming && !isFailed

                const hasStatus = isStreaming || isFailed || isDone
                const statusEl = hasStatus ? (
                  <span
                    className={styles.tasksDropdownItemStatus}
                    title={
                      isFailed
                        ? 'Error'
                        : isStreaming
                          ? 'Running'
                          : isDone
                            ? 'Done'
                            : undefined
                    }
                  >
                    {isStreaming && (
                      <Loader2 size={12} className={styles.tasksDropdownItemSpinner} />
                    )}
                    {isFailed && (
                      <img
                        src={publicUrl('icons/stop.svg')}
                        alt=""
                        className={styles.tasksDropdownErrorIcon}
                        width={14}
                        height={14}
                        aria-hidden
                      />
                    )}
                    {isDone && !isAwaitingApproval && !isFailed && (
                      <img
                        src={publicUrl('prompts/completed.svg')}
                        alt="Done"
                        className={styles.tasksDropdownItemDoneIcon}
                        width={14}
                        height={14}
                      />
                    )}
                  </span>
                ) : null

                return (
                  <button
                    key={conv.id}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    className={styles.tasksDropdownItem}
                    onClick={() => handleSelect(conv.id)}
                  >
                    <div className={styles.tasksDropdownItemContent}>
                      <span className={styles.tasksDropdownItemLabel}>
                        {truncateTitle(conv.summary || stripLeadingBrackets(conv.title))}
                      </span>
                    </div>
                    {statusEl}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </>
  )
}
