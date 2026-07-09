import { useEffect } from 'react'
import { ChevronDown, Check, Loader2 } from 'lucide-react'
import { usePlanStore } from '../../store/planStore'
import toDoIcon from '../../../prompts/to-do.svg'
import styles from './TodoDrawer.module.css'

export function TodoDrawer() {
  const activePlan = usePlanStore((s) => s.activePlan)
  const todoDrawerExpanded = usePlanStore((s) => s.todoDrawerExpanded)
  const setTodoDrawerExpanded = usePlanStore((s) => s.setTodoDrawerExpanded)
  const continueStep = usePlanStore((s) => s.continueStep)
  const redoStep = usePlanStore((s) => s.redoStep)

  // Keyboard shortcuts: Cmd+Enter = Continue, Cmd+Backspace = Redo (during step-paused)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return
      const plan = usePlanStore.getState().activePlan
      if (!plan || plan.status !== 'step-paused') return

      if (e.key === 'Enter') {
        e.preventDefault()
        usePlanStore.getState().continueStep()
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        usePlanStore.getState().redoStep()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Don't render if no plan or plan is pending/rejected
  if (!activePlan) return null
  if (activePlan.status === 'pending' || activePlan.status === 'rejected' || activePlan.status === 'clarifying' || activePlan.status === 'answered') return null

  const todos = activePlan.data.todos ?? []
  if (todos.length === 0) return null

  const doneCount = activePlan.stepStatuses.filter((s) => s === 'done').length
  const isExecuting = activePlan.status === 'executing'
  const isDone = activePlan.status === 'done'
  const isStepPaused = activePlan.status === 'step-paused'
  const isStepByStep = activePlan.executionMode === 'step-by-step'

  return (
    <div className={styles.wrapper}>
      <div className={styles.drawer}>
        <button className={styles.header} onClick={() => setTodoDrawerExpanded(!todoDrawerExpanded)}>
          <span className={styles.headerIcon}>
            <img src={toDoIcon} alt="" width={14} height={14} aria-hidden />
          </span>
          <span className={styles.headerLabel}>
            {doneCount}/{todos.length} done
          </span>
          <span className={styles.headerStatus}>
            {isExecuting && <Loader2 size={12} className={styles.spinner} />}
            {isDone && <Check size={12} className={styles.checkmarkDone} />}
          </span>
          <span className={`${styles.chevron} ${todoDrawerExpanded ? styles.chevronOpen : ''}`}>
            <ChevronDown size={12} />
          </span>
        </button>

        {todoDrawerExpanded && (
          <>
            <ul className={styles.todoList}>
              {todos.map((todo, i) => {
                const stepStatus = activePlan.stepStatuses[i]
                const isCurrent = isStepByStep && (
                  (isExecuting && activePlan.currentStepIndex === i) ||
                  (isStepPaused && activePlan.currentStepIndex === i)
                )
                const isDoneStep = stepStatus === 'done'

                return (
                  <li
                    key={i}
                    className={`${styles.todoItem} ${isCurrent ? styles.todoItemCurrent : ''}`}
                  >
                    <span className={`${styles.checkbox} ${isDoneStep ? styles.checkboxChecked : ''}`}>
                      {isDoneStep && <Check size={8} className={styles.checkIcon} />}
                      {stepStatus === 'executing' && <Loader2 size={8} className={styles.spinner} />}
                    </span>
                    <span className={`${styles.todoLabel} ${isDoneStep ? styles.todoLabelDone : ''}`}>
                      {todo.category && (
                        <span className={styles.category}>{todo.category}: </span>
                      )}
                      {todo.label}
                    </span>
                  </li>
                )
              })}
            </ul>

            {isStepByStep && isStepPaused && (
              <div className={styles.stepActions}>
                <button
                  type="button"
                  className={styles.stepActionButton}
                  onClick={() => redoStep()}
                >
                  Redo <span className={styles.kbd}>&#8984;&#9003;</span>
                </button>
                <button
                  type="button"
                  className={`${styles.stepActionButton} ${styles.stepActionButtonPrimary}`}
                  onClick={() => continueStep()}
                >
                  Continue <span className={styles.kbd}>&#8984;&#8629;</span>
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
