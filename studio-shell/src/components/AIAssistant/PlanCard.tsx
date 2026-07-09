import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Check, Loader2, X } from 'lucide-react'
import { usePlanStore } from '../../store/planStore'
import { PillInput, getTextFromSegments } from '../shared/PillInput'
import { MentionDropdown, type MentionItem } from '../shared/MentionDropdown'
import type { InputSegment, PillInputHandle, MentionQuery } from '../../types'
import aiAssistantStyles from './AIAssistant.module.css'
import styles from './PlanCard.module.css'
import listNumberedIcon from '../../../icons/List Numbered.svg'

interface ToolPartData {
  toolCallId: string
  toolName: string
  state: string
  input: unknown
  output?: unknown
}

interface PlanCardProps {
  toolData: ToolPartData
  mentionItems?: MentionItem[]
}

export function PlanCard({ toolData, mentionItems }: PlanCardProps) {
  const [expanded, setExpanded] = useState(true)
  const [qaExpanded, setQaExpanded] = useState(false)
  const [generatedExpanded, setGeneratedExpanded] = useState(false)
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(true)
  const activePlan = usePlanStore((s) => s.activePlan)
  const approvePlan = usePlanStore((s) => s.approvePlan)
  const rejectPlan = usePlanStore((s) => s.rejectPlan)
  const askAgain = usePlanStore((s) => s.askAgain)
  const updateTodo = usePlanStore((s) => s.updateTodo)
  const removeTodo = usePlanStore((s) => s.removeTodo)
  // Inline editing state (Gap 5)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingSegments, setEditingSegments] = useState<InputSegment[]>([])
  const editingSegmentsRef = useRef<InputSegment[]>([])
  const editPillRef = useRef<PillInputHandle>(null)
  const [editMentionQuery, setEditMentionQuery] = useState<MentionQuery | null>(null)

  // During streaming, input may be partial/malformed — guard defensively
  const rawInput = (typeof toolData.input === 'object' && toolData.input !== null)
    ? toolData.input as Record<string, unknown>
    : {}
  const todos = (Array.isArray(rawInput.todos) ? rawInput.todos : []) as Array<{ label: string; category?: string }>
  const questions = (Array.isArray(rawInput.questions) ? rawInput.questions : [])
    .filter((q): q is { text: string; placeholder?: string; category?: string; options?: Array<{ label: string; description: string }> } =>
      typeof q === 'object' && q !== null && typeof (q as Record<string, unknown>).text === 'string'
    )
  const answers = (Array.isArray(rawInput.answers) ? rawInput.answers : []) as string[]
  const expectedQuestionCount =
    typeof (toolData.output as { questionCount?: unknown } | undefined)?.questionCount === 'number'
      ? (toolData.output as { questionCount?: number }).questionCount
      : undefined

  // Post-Q&A flow: plan has both answered questions and todos
  const hasAnsweredQuestions = questions.length > 0 && answers.length > 0 && todos.length > 0

  // Category ordering for progressive disclosure (used by question composer)
  // const DEFAULT_CATEGORY = 'Summary'
  // const categoryOrder = ['Scope', 'Gameplay', 'World', 'Layout', 'Style', 'Summary']
  // const byCategory = new Map<string, number[]>()
  // questions.forEach((q, i) => {
  //   const cat = q.category?.trim() || DEFAULT_CATEGORY
  //   if (!byCategory.has(cat)) byCategory.set(cat, [])
  //   byCategory.get(cat)!.push(i)
  // })
  // const orderedCategories = categoryOrder.filter((c) => byCategory.has(c))
  // const otherCategories = [...byCategory.keys()].filter((c) => !categoryOrder.includes(c))
  // const categories = [...orderedCategories, ...otherCategories]
  // const orderedQuestionIndices = categories.flatMap((cat) => byCategory.get(cat) ?? [])

  // Sync store draft answers when questions arrive (e.g. after streaming)
  const prevQuestionCountRef = useRef(questions.length)
  useEffect(() => {
    if (questions.length > 0 && prevQuestionCountRef.current === 0) {
      usePlanStore.getState().initDraftAnswers(questions)
    }
    prevQuestionCountRef.current = questions.length
  }, [questions.length])

  // Brief "Generating" shimmer before showing "Generated" in post-Q&A flow
  useEffect(() => {
    if (!hasAnsweredQuestions) return
    setIsGeneratingPlan(true)
    const timer = setTimeout(() => setIsGeneratingPlan(false), 1800)
    return () => clearTimeout(timer)
  }, [hasAnsweredQuestions])

  const isThisPlan = activePlan?.id === toolData.toolCallId
  const isPending = isThisPlan && activePlan?.status === 'pending'
  const isExecuting = isThisPlan && activePlan?.status === 'executing'
  const isRejected = isThisPlan && activePlan?.status === 'rejected'
  const checkedItems = isThisPlan ? activePlan.checkedItems : new Set<number>()

  const hasReadyQuestions =
    questions.length > 0 &&
    (expectedQuestionCount === undefined || questions.length >= expectedQuestionCount)

  // Don't render the card if there are no to-do items and no fully-formed questions
  if (todos.length === 0 && !hasReadyQuestions && !hasAnsweredQuestions) return null

  // Question mode: don't render anything — questions are handled in the composer
  if (hasReadyQuestions && !hasAnsweredQuestions) return null

  // Shared handlers
  const handleBuild = () => {
    approvePlan()
  }

  const handleReject = () => {
    rejectPlan()
  }

  const handleAskAgain = () => {
    askAgain()
  }

  const handleViewPlan = () => {
    setExpanded(true)
  }

  // Shared todo list renderer (used by both post-Q&A flow and todos-only mode)
  const renderTodoList = () => (
    <div className={styles.todoListWrap}>
      <ul className={styles.todoList}>
        {todos.map((todo, i) => {
          const checked = checkedItems.has(i)
          const isEditing = editingIndex === i
          return (
            <li key={i} className={styles.todoItem}>
              <span className={`${styles.checkbox} ${checked ? styles.checkboxChecked : ''}`}>
                {checked && <Check size={10} className={styles.checkIcon} />}
              </span>
              {isEditing ? (
                <div
                  className={styles.todoEditPillWrap}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape' && !editMentionQuery) setEditingIndex(null)
                  }}
                >
                  <PillInput
                    ref={editPillRef}
                    segments={editingSegments}
                    onSegmentsChange={(segs) => {
                      setEditingSegments(segs)
                      editingSegmentsRef.current = segs
                    }}
                    onSubmit={() => {
                      const text = getTextFromSegments(editingSegmentsRef.current)
                      if (text.trim()) updateTodo(i, text.trim())
                      setEditingIndex(null)
                    }}
                    onBlur={() => {
                      const text = getTextFromSegments(editingSegmentsRef.current)
                      if (text.trim()) updateTodo(i, text.trim())
                      setEditingIndex(null)
                    }}
                    autoFocus
                    className={styles.todoEditPillInput}
                    onMentionQuery={setEditMentionQuery}
                  />
                  {mentionItems && (
                    <MentionDropdown
                      mention={editMentionQuery}
                      items={mentionItems}
                      pillInputRef={editPillRef}
                      onClose={() => setEditMentionQuery(null)}
                    />
                  )}
                </div>
              ) : (
                <span
                  className={`${styles.todoLabel} ${isPending ? styles.todoLabelEditable : ''} ${checked ? styles.todoLabelChecked : ''}`}
                  onClick={(e) => {
                    if (!isPending) return
                    e.stopPropagation()
                    const segs: InputSegment[] = [{ type: 'text', text: todo.label }]
                    setEditingIndex(i)
                    setEditingSegments(segs)
                    editingSegmentsRef.current = segs
                  }}
                  title={isPending ? 'Click to edit' : undefined}
                >
                  {todo.category && (
                    <span className={styles.category}>{todo.category}: </span>
                  )}
                  {todo.label}
                </span>
              )}
              {isPending && !isEditing && (
                <button
                  type="button"
                  className={styles.todoRemoveButton}
                  onClick={(e) => { e.stopPropagation(); removeTodo(i) }}
                  title="Remove"
                  aria-label="Remove to-do"
                >
                  <X size={10} />
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )

  // Shared status badges
  const renderStatusBadges = () => (
    <>
      {isExecuting && (
        <div className={`${styles.statusBadge} ${styles.statusExecuting}`}>
          <Loader2 size={12} /> Executing plan...
        </div>
      )}
      {isRejected && (
        <div className={`${styles.statusBadge} ${styles.statusRejected}`}>
          Plan rejected
        </div>
      )}
    </>
  )

  // Post-Q&A flow: Q&A summary and Generated are inline chat elements,
  // task list is in its own card below them
  if (hasAnsweredQuestions) {
    return (
      <div className={styles.postQaFlow}>
        {/* Collapsible Q&A summary — outside card, part of chat scroll */}
        <div className={styles.qaSection}>
          <button
            type="button"
            className={styles.qaSectionHeader}
            onClick={() => setQaExpanded(!qaExpanded)}
          >
            <span className={`${styles.qaSectionChevron} ${qaExpanded ? styles.qaSectionChevronOpen : ''}`}>
              <ChevronDown size={12} />
            </span>
            <span className={styles.qaSectionLabel}>
              {questions.length} question{questions.length !== 1 ? 's' : ''} answered
            </span>
          </button>
          {qaExpanded && (
            <div className={styles.qaSectionList}>
              {questions.map((q, i) => (
                <div key={i} className={styles.qaItem}>
                  <span className={styles.qaItemQuestion}>{q.text}</span>
                  <span className={styles.qaItemAnswer}>{answers[i] || 'No answer'}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Collapsible Generated section — outside card, part of chat scroll */}
        <div className={styles.generatedSection}>
          <button
            type="button"
            className={styles.qaSectionHeader}
            onClick={() => setGeneratedExpanded(!generatedExpanded)}
          >
            <span className={`${styles.qaSectionChevron} ${generatedExpanded ? styles.qaSectionChevronOpen : ''}`}>
              <ChevronDown size={12} />
            </span>
            <span className={styles.generatedHeaderContent}>
              <span className={`${styles.qaSectionLabel} ${isGeneratingPlan ? styles.generatingShimmer : ''}`}>
                {isGeneratingPlan ? 'Generating' : 'Generated'}
              </span>
              <span className={styles.generatedBadge}>Game Plan</span>
            </span>
          </button>
        </div>

        {/* Task list — in its own card */}
        <div className={`${styles.planCard} ${styles.postQaPlanCard}`}>
          <div className={styles.taskListHeader}>
            <span className={styles.headerIcon} aria-hidden>
              <img src={listNumberedIcon} alt="" width={16} height={16} />
            </span>
            <span className={styles.taskListLabel}>Task list</span>
          </div>

          {renderTodoList()}

          {/* Action buttons: Build, Reject, Ask again */}
          {isPending && (
            <div className={`${styles.actions} ${aiAssistantStyles.questionComposerActions}`}>
              <button
                type="button"
                className={aiAssistantStyles.questionComposerActionButton}
                onClick={handleAskAgain}
              >
                Ask again
              </button>
              <button className={aiAssistantStyles.questionComposerActionButton} onClick={handleReject}>
                Reject <span className={aiAssistantStyles.questionComposerKbd}>&#8984;&#9003;</span>
              </button>
              <button
                className={`${aiAssistantStyles.questionComposerActionButton} ${aiAssistantStyles.questionComposerActionButtonPrimary}`}
                onClick={handleBuild}
              >
                Build <span className={aiAssistantStyles.questionComposerKbd}>&#8984;&#8629;</span>
              </button>
            </div>
          )}
        </div>

        {renderStatusBadges()}
      </div>
    )
  }

  // Todo-only mode: original plan card UI (no Q&A context)
  return (
    <div>
      <div className={styles.planCard}>
        <button className={styles.header} onClick={() => setExpanded(!expanded)}>
          <span className={styles.headerIcon} aria-hidden>
            <img src={listNumberedIcon} alt="" width={16} height={16} />
          </span>
          <span className={styles.headerLabel}>
            {todos.length} To-do{todos.length !== 1 ? 's' : ''}
          </span>
          <span className={`${styles.chevron} ${expanded ? styles.chevronOpen : ''}`}>
            <ChevronDown size={14} />
          </span>
        </button>

        {expanded && todos.length > 0 && (
          <>
            {renderTodoList()}

            {isPending && (
              <div className={`${styles.actions} ${aiAssistantStyles.questionComposerActions}`}>
                <button
                  type="button"
                  className={aiAssistantStyles.questionComposerActionButton}
                  onClick={handleViewPlan}
                >
                  View plan
                </button>
                <button className={aiAssistantStyles.questionComposerActionButton} onClick={handleReject}>
                  Reject <span className={aiAssistantStyles.questionComposerKbd}>&#8984;&#9003;</span>
                </button>
                <button
                  className={`${aiAssistantStyles.questionComposerActionButton} ${aiAssistantStyles.questionComposerActionButtonPrimary}`}
                  onClick={handleBuild}
                >
                  Build <span className={aiAssistantStyles.questionComposerKbd}>&#8984;&#8629;</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {renderStatusBadges()}
    </div>
  )
}
