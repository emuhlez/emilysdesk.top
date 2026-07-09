import { useState } from 'react'
import type { UIMessage } from '@ai-sdk/react'
import { ChevronDown, ChevronRight, FileText, RefreshCw } from 'lucide-react'

function ThumbUpIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={filled ? 'none' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {/* Sleeve/cuff */}
      <rect x="2" y="12" width="5" height="10" rx="1" fill={filled ? 'currentColor' : 'none'} />
      {/* Thumb/hand */}
      <path
        d="M7 12V22H17.5a2 2 0 0 0 1.92-1.44l2.33-8A2 2 0 0 0 19.83 10H14l1-4.12A3.13 3.13 0 0 0 12 2l-3.55 7.11A2 2 0 0 1 6.76 10H7Z"
        fill={filled ? 'currentColor' : 'none'}
      />
    </svg>
  )
}

function ThumbDownIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={filled ? 'none' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {/* Sleeve/cuff */}
      <rect x="2" y="2" width="5" height="10" rx="1" fill={filled ? 'currentColor' : 'none'} />
      {/* Thumb/hand */}
      <path
        d="M7 12V2H17.5a2 2 0 0 1 1.92 1.44l2.33 8A2 2 0 0 1 19.83 14H14l1 4.12A3.13 3.13 0 0 1 12 22l-3.55-7.11A2 2 0 0 0 6.76 14H7Z"
        fill={filled ? 'currentColor' : 'none'}
      />
    </svg>
  )
}
import { ToolCallPart } from './ToolCallPart'
import { PlanCard } from './PlanCard'
import { stripLeadingBrackets } from '../../ai/strip-brackets'
import styles from './AIAssistant.module.css'

const TOOL_CALLS_COLLAPSE_THRESHOLD = 1

interface MessageBubbleProps {
  message: UIMessage
  isGenerating?: boolean
  isError?: boolean
  onFeedback?: (messageId: string, type: 'up' | 'down') => void
  /** When true, show feedback form inline in the bubble instead of triggering composer takeover */
  inlineFeedback?: boolean
}

/** AI SDK v6 tool parts have type `tool-${toolName}` */
function isToolPart(part: { type: string }): boolean {
  return part.type.startsWith('tool-')
}

function getToolName(part: { type: string }): string {
  return part.type.slice(5) // remove 'tool-' prefix
}

interface ToolPartData {
  toolCallId: string
  toolName: string
  state: string
  input: unknown
  output?: unknown
}

function extractToolData(part: unknown): ToolPartData {
  const p = part as Record<string, unknown>
  const toolName = getToolName(p as { type: string })
  return {
    toolCallId: (p.toolCallId as string) ?? '',
    toolName,
    state: (p.state as string) ?? '',
    input: p.input,
    output: p.output,
  }
}

/** Summary format: "Add (4) Objects", "Transform (1) Object" */
const TOOL_SUMMARY: Record<string, { verb: string; noun: string }> = {
  addObject: { verb: 'Add', noun: 'Object' },
  removeObject: { verb: 'Remove', noun: 'Object' },
  transformObject: { verb: 'Transform', noun: 'Object' },
  setMaterial: { verb: 'Set', noun: 'Material' },
}

function getToolSummaryLabel(toolName: string, count: number): string {
  const entry = TOOL_SUMMARY[toolName]
  if (!entry) return `${toolName} (${count})`
  const noun = count === 1 ? entry.noun : `${entry.noun}s`
  return `${entry.verb} (${count}) ${noun}`
}

/** Detect plan-follow-up user messages (auto-sent by the plan executor).
 *  Returns true if the text is a plan follow-up that should be hidden. */
function isPlanFollowUp(text: string): boolean {
  return /^\[PLAN_FOLLOWUP:/i.test(text)
}

/** Render message text: bolds **markdown** tokens and leading /slashCommands. */
function renderTextWithBold(text: string) {
  const nodes: Array<string | JSX.Element> = []

  // Bold a leading slash command (e.g. "/plan build an obby" → <strong>/plan</strong> build an obby)
  let remaining = text
  const slashMatch = remaining.match(/^(\/\S+)(.*)$/s)
  if (slashMatch) {
    nodes.push(<strong key="slash">{slashMatch[1]}</strong>)
    remaining = slashMatch[2]
  }

  // Bold **markdown** tokens in the rest of the text
  const regex = /\*\*(.+?)\*\*/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(remaining)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(remaining.slice(lastIndex, match.index))
    }
    nodes.push(<strong key={`b-${nodes.length}`}>{match[1]}</strong>)
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < remaining.length) {
    nodes.push(remaining.slice(lastIndex))
  }

  return nodes
}

export function MessageBubble({ message, isGenerating = false, isError = false, onFeedback, inlineFeedback = false }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const [toolCallsExpanded, setToolCallsExpanded] = useState(false)
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null)
  const [inlineFeedbackText, setInlineFeedbackText] = useState('')
  const [inlineFeedbackIssueType, setInlineFeedbackIssueType] = useState('')
  const [showInlineForm, setShowInlineForm] = useState(false)
  const [issueDropdownOpen, setIssueDropdownOpen] = useState(false)

  const textParts = message.parts
    ?.filter((p) => p.type === 'text')
    .map((p) => (p as { type: 'text'; text: string }).text)
    .join('') || ''

  // Hide automated plan follow-up user messages entirely (e.g. "Build it.", "Continue building...")
  // The assistant's responses to these still render normally.
  if (isUser && isPlanFollowUp(textParts.trim())) {
    return null
  }

  const displayText = stripLeadingBrackets(textParts).trim()
  const textToShow = displayText
  const hasQuestionPlan =
    !isUser &&
    message.parts?.some((p) => {
      const part = p as { type: string; input?: { questions?: unknown[]; answers?: unknown[] } }
      return part.type === 'tool-createPlan' && (part.input?.questions?.length ?? 0) > 0 && !(part.input?.answers?.length)
    })
  const toolParts = message.parts
    ?.filter(isToolPart)
    || []

  const planParts = toolParts.filter((p) => getToolName(p) === 'createPlan')
  const otherToolParts = toolParts.filter((p) => getToolName(p) !== 'createPlan')
  const otherCount = otherToolParts.length
  const collapseToolCalls = otherCount > TOOL_CALLS_COLLAPSE_THRESHOLD

  const summaryByTool = otherToolParts.reduce<Record<string, number>>((acc, part) => {
    const name = getToolName(part)
    acc[name] = (acc[name] ?? 0) + 1
    return acc
  }, {})
  const summaryEntries = Object.entries(summaryByTool).sort((a, b) => b[1] - a[1])

  const fileParts = message.parts
    ?.filter((p) => p.type === 'file')
    || []

  return (
    <div className={`${styles.bubble} ${isUser ? styles.userBubble : styles.assistantBubble} ${isError ? styles.errorBubble : ''}`}>
      {fileParts.length > 0 && (
        <div className={styles.attachments}>
          {fileParts.map((part, i) => {
            const filePart = part as unknown as { type: 'file'; mediaType: string; url: string; name?: string }
            if (filePart.mediaType?.startsWith('image/')) {
              return (
                <img
                  key={i}
                  src={filePart.url}
                  alt="Sketch attachment"
                  className={styles.attachmentImage}
                />
              )
            }
            // Non-image files: render as icon + filename + download link (Gap 7)
            const fileName = filePart.name || `file-${i + 1}`
            return (
              <a
                key={i}
                href={filePart.url}
                download={fileName}
                className={styles.attachmentFile}
                title={`Download ${fileName}`}
              >
                <FileText size={12} className={styles.attachmentFileIcon} />
                <span>{fileName}</span>
              </a>
            )
          })}
        </div>
      )}

      {textToShow && !hasQuestionPlan ? (
        <div className={`${styles.bubbleText}${isGenerating ? ` ${styles.generatingText}` : ''}`}>
          {renderTextWithBold(textToShow)}
        </div>
      ) : null}

      {(planParts.length > 0 || otherToolParts.length > 0) && (
        <div className={styles.toolCalls}>
          {planParts.map((part, i) => {
            const td = extractToolData(part)
            return <PlanCard key={td.toolCallId || i} toolData={td} />
          })}
          {otherToolParts.length > 0 && (
            <>
              {collapseToolCalls && (
                <button
                  type="button"
                  className={styles.toolCallsSummary}
                  onClick={() => setToolCallsExpanded(!toolCallsExpanded)}
                >
                  <span className={styles.toolCallsSummaryChevron}>
                    {toolCallsExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </span>
                  <span className={styles.toolCallsSummaryText}>
                    {summaryEntries.map(([name, count]) => getToolSummaryLabel(name, count)).join(', ')}
                  </span>
                </button>
              )}
              {(!collapseToolCalls || toolCallsExpanded) &&
                otherToolParts.map((part, i) => {
                  const td = extractToolData(part)
                  return <ToolCallPart key={td.toolCallId || i} toolData={td} />
                })}
            </>
          )}
        </div>
      )}

      {!isUser && !isGenerating && (textToShow || toolParts.length > 0) && (
        <>
          <div className={`${styles.feedbackRow} ${feedback ? styles.feedbackRowActive : ''}`}>
            <button
              type="button"
              className={`${styles.feedbackButton} ${feedback === 'up' ? styles.feedbackButtonActive : ''}`}
              onClick={() => {
                const next = feedback === 'up' ? null : 'up' as const
                setFeedback(next)
                if (inlineFeedback) {
                  setShowInlineForm(!!next)
                  setInlineFeedbackText('')
                  setInlineFeedbackIssueType('')
                } else if (next) {
                  onFeedback?.(message.id, next)
                }
              }}
              aria-label="Thumbs up"
            >
              <ThumbUpIcon filled={feedback === 'up'} />
            </button>
            <button
              type="button"
              className={`${styles.feedbackButton} ${feedback === 'down' ? styles.feedbackButtonActive : ''}`}
              onClick={() => {
                const next = feedback === 'down' ? null : 'down' as const
                setFeedback(next)
                if (inlineFeedback) {
                  setShowInlineForm(!!next)
                  setInlineFeedbackText('')
                  setInlineFeedbackIssueType('')
                } else if (next) {
                  onFeedback?.(message.id, next)
                }
              }}
              aria-label="Thumbs down"
            >
              <ThumbDownIcon filled={feedback === 'down'} />
            </button>
            <button
              type="button"
              className={styles.feedbackButton}
              onClick={() => {/* TODO: regenerate response */}}
              aria-label="Regenerate response"
            >
              <RefreshCw size={12} />
            </button>
          </div>

          {inlineFeedback && showInlineForm && feedback && (
            <>
              <div className={styles.inlineFeedbackCard}>
                <div className={styles.inlineFeedbackTitle}>
                  {feedback === 'up' ? 'Give positive feedback' : 'Give negative feedback'}
                </div>
                {feedback === 'down' && (
                  <>
                    <div className={styles.inlineFeedbackLabel}>What type of issue did you encounter? (optional)</div>
                    <div className={styles.feedbackSelectWrap}>
                      <button
                        type="button"
                        className={styles.feedbackSelectTrigger}
                        onClick={() => setIssueDropdownOpen(!issueDropdownOpen)}
                      >
                        <span className={inlineFeedbackIssueType ? styles.feedbackSelectValue : styles.feedbackSelectPlaceholder}>
                          {inlineFeedbackIssueType || 'Select an Option'}
                        </span>
                        <ChevronDown size={12} className={styles.feedbackSelectChevron} />
                      </button>
                      {issueDropdownOpen && (
                        <div className={styles.feedbackSelectMenu}>
                          {['Incorrect information', 'Not helpful', 'Incomplete response', 'Other'].map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              className={`${styles.feedbackSelectOption} ${inlineFeedbackIssueType === opt ? styles.feedbackSelectOptionSelected : ''}`}
                              onClick={() => { setInlineFeedbackIssueType(opt); setIssueDropdownOpen(false) }}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
                <div className={styles.inlineFeedbackLabel}>Please provide details (optional)</div>
                <textarea
                  className={styles.inlineFeedbackTextarea}
                  placeholder={feedback === 'up'
                    ? 'What was satisfying about this response?'
                    : 'What was unsatisfying about this response?'}
                  value={inlineFeedbackText}
                  onChange={(e) => setInlineFeedbackText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      setShowInlineForm(false)
                      setInlineFeedbackText('')
                      setInlineFeedbackIssueType('')
                    }
                    if (e.key === 'Escape') {
                      setShowInlineForm(false)
                      setFeedback(null)
                      setInlineFeedbackText('')
                      setInlineFeedbackIssueType('')
                    }
                  }}
                />
                <div className={styles.inlineFeedbackActions}>
                  <button
                    type="button"
                    className={styles.inlineFeedbackDismiss}
                    onClick={() => { setShowInlineForm(false); setFeedback(null); setInlineFeedbackText(''); setInlineFeedbackIssueType('') }}
                  >
                    Dismiss
                  </button>
                  <button
                    type="button"
                    className={styles.inlineFeedbackSubmit}
                    onClick={() => { setShowInlineForm(false); setInlineFeedbackText(''); setInlineFeedbackIssueType('') }}
                  >
                    Submit <span style={{ opacity: 0.6, fontSize: 10 }}>(&#x23CE;)</span>
                  </button>
                </div>
              </div>
              <div className={styles.inlineFeedbackFooter}>
                This report will include the entire conversation for context and future improvements.
                <br />
                <a href="#" onClick={(e) => e.preventDefault()}>Learn more</a>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
