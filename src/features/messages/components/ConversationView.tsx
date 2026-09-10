import { useEffect, useRef } from 'react'
import { useMessagesStore } from '../../../stores/messages-store'
import { FONT_STACK } from '../../../styles/typography'
import { MessageBubble } from './MessageBubble'
import plusSvg from '../../../../assets/sf-symbols/plus--monochrome--medium.svg?raw'

function formatBubbleTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function ConversationView({
  topInset = 0,
  contentPadLeft = 0,
}: {
  topInset?: number
  /** WWDC background-extension: thread fills under sidebar; pad only content. */
  contentPadLeft?: number
}) {
  const conversations = useMessagesStore((s) => s.conversations)
  const selectedId = useMessagesStore((s) => s.selectedId)
  const draft = useMessagesStore((s) => s.draft)
  const setDraft = useMessagesStore((s) => s.setDraft)
  const sendDraft = useMessagesStore((s) => s.sendDraft)

  const conversation = conversations.find((c) => c.id === selectedId)
  const scrollerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [selectedId, conversation?.messages.length])

  if (!conversation) {
    return (
      <div
        className="flex flex-1 items-center justify-center"
        style={{
          color: 'rgba(255,255,255,0.45)',
          fontSize: 13,
          fontWeight: 500,
          paddingTop: topInset,
          paddingLeft: contentPadLeft,
        }}
      >
        Select a conversation
      </div>
    )
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col" style={{ background: 'transparent' }}>
      <div
        ref={scrollerRef}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto"
        style={{
          paddingTop: topInset + 8,
          paddingBottom: 12,
          paddingLeft: contentPadLeft + 16,
          paddingRight: 16,
          gap: 2,
        }}
      >
        {conversation.messages.map((m, i) => {
          const prev = conversation.messages[i - 1]
          const next = conversation.messages[i + 1]
          const showTime =
            !prev || m.sentAt - prev.sentAt > 15 * 60_000 || prev.fromMe !== m.fromMe
          /* Tail only on the last bubble of a consecutive same-sender run. */
          const hasTail = !next || next.fromMe !== m.fromMe
          /* “Delivered” under the last outgoing bubble in the thread. */
          const showDelivered =
            m.fromMe && i === conversation.messages.length - 1
          const tightToPrev = prev && prev.fromMe === m.fromMe && !showTime

          return (
            <div
              key={m.id}
              className="flex flex-col"
              style={{
                alignItems: m.fromMe ? 'flex-end' : 'flex-start',
                marginTop: tightToPrev ? 3 : showTime ? 12 : 8,
              }}
            >
              {showTime && (
                <div
                  className="mb-2 self-center text-[11px]"
                  style={{ color: 'rgba(255,255,255,0.40)', fontWeight: 500 }}
                >
                  {formatBubbleTime(m.sentAt)}
                </div>
              )}
              <MessageBubble
                text={m.text}
                fromMe={m.fromMe}
                hasTail={hasTail}
                status={showDelivered ? 'Delivered' : undefined}
              />
            </div>
          )
        })}
      </div>

      {/* Composer — Liquid Glass on the control (WWDC: material on control, not children). */}
      <div
        className="shrink-0 pt-1"
        style={{ paddingLeft: contentPadLeft + 12, paddingRight: 12, paddingBottom: 12 }}
      >
        <div
          className="flex items-center gap-1.5 rounded-[18px] px-1.5 py-1"
          style={{
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.05) 60%, rgba(255,255,255,0.07) 100%)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            boxShadow:
              'inset 0 0.5px 0 rgba(255,255,255,0.45), inset 0 0 0 0.5px rgba(255,255,255,0.10), 0 1px 1px rgba(0,0,0,0.18)',
          }}
        >
          <button
            type="button"
            aria-label="Add attachments"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
            style={{
              color: 'rgba(255,255,255,0.85)',
              background: 'transparent',
              border: 'none',
              cursor: 'default',
            }}
          >
            <span
              className="inline-flex [&>svg]:block"
              style={{ width: 16, height: 16 }}
              dangerouslySetInnerHTML={{ __html: plusSvg }}
            />
          </button>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendDraft()
              }
            }}
            rows={1}
            placeholder="iMessage"
            className="max-h-28 min-h-[28px] flex-1 resize-none bg-transparent py-1 outline-none"
            style={{
              fontFamily: FONT_STACK,
              fontSize: 14,
              color: 'rgba(255,255,255,0.92)',
              lineHeight: 1.3,
            }}
          />
        </div>
      </div>
    </div>
  )
}
