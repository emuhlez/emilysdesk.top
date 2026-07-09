import { useRef, useEffect, useState } from 'react'
import type { UIMessage } from '@ai-sdk/react'
import { MessageBubble } from './MessageBubble'
import nebulaIcon from '../../../icons/nebula-viewport.svg'
import styles from './AIAssistant.module.css'

interface MessageListProps {
  messages: UIMessage[]
  isLoading: boolean
  pendingToolCount: number
  onFeedback?: (messageId: string, type: 'up' | 'down') => void
  inlineFeedback?: boolean
}

export function MessageList({ messages, isLoading, pendingToolCount, onFeedback, inlineFeedback }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const idleStatusPhrases = ['Thinking...', 'Building...', 'Generating...', 'Creating worlds...']
  const [statusIndex, setStatusIndex] = useState(0)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  // Idle status: advance once when entering, then rotate every 2.5s while thinking (no tools)
  useEffect(() => {
    if (!isLoading || pendingToolCount > 0) return undefined
    setStatusIndex((prev) => (prev + 1) % idleStatusPhrases.length)
    const id = window.setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % idleStatusPhrases.length)
    }, 2500)
    return () => window.clearInterval(id)
  }, [isLoading, pendingToolCount, idleStatusPhrases.length])

  // Group messages into "turns" so each user bubble can act as a sticky
  // header for its trailing assistant messages. A turn is: one user message
  // followed by zero-or-more assistant messages, until the next user message.
  // Messages preceding the first user message form a leading orphan turn
  // with `user: null` and render normally (no sticky header).
  type Turn = { user: UIMessage | null; followers: UIMessage[]; userIdx: number }
  const turns: Turn[] = []
  let current: Turn | null = null
  messages.forEach((m, idx) => {
    if (m.role === 'user') {
      if (current) turns.push(current)
      current = { user: m, followers: [], userIdx: idx }
    } else {
      if (!current) current = { user: null, followers: [], userIdx: -1 }
      current.followers.push(m)
    }
  })
  if (current) turns.push(current)

  const lastIdx = messages.length - 1

  return (
    <div className={styles.messages}>
      {turns.map((turn, ti) => (
        <div key={turn.user ? `${turn.user.id}-${ti}` : `orphan-${ti}`} className={styles.turn}>
          {turn.user && (
            <div className={styles.stickyUserSlot}>
              <MessageBubble
                message={turn.user}
                isError={turn.user.id.startsWith('error-')}
                onFeedback={onFeedback}
                inlineFeedback={inlineFeedback}
              />
            </div>
          )}
          {turn.followers.map((message, fi) => {
            const absoluteIdx = turn.userIdx + 1 + fi
            const isLast = absoluteIdx === lastIdx
            const isGenerating = isLast && message.role === 'assistant' && isLoading
            return (
              <MessageBubble
                key={`${message.id}-${absoluteIdx}`}
                message={message}
                isGenerating={isGenerating}
                isError={message.id.startsWith('error-')}
                onFeedback={onFeedback}
                inlineFeedback={inlineFeedback}
              />
            )
          })}
        </div>
      ))}

      {isLoading && pendingToolCount === 0 && (
        <div className={`${styles.status} ${styles.nebulaAnimating}`}>
          <img
            src={nebulaIcon}
            alt=""
            aria-hidden="true"
            className={styles.statusNebulaIcon}
          />
          <span className={styles.statusText}>
            {idleStatusPhrases[statusIndex]}
          </span>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  )
}
