import { useState } from 'react'
import { X, Square, ChevronDown } from 'lucide-react'
import { useBackgroundTaskStore } from '../../store/backgroundTaskStore'
import { stripLeadingBrackets, truncateTitle } from '../../ai/strip-brackets'
import type { BackgroundTask } from '../../types'
import nebulaIcon from '../../../icons/nebula-viewport.svg'
import styles from './BackgroundTaskDrawer.module.css'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Queued',
  running: 'Working...',
  done: 'Done',
  error: 'Failed',
}

function TaskItem({ task }: { task: BackgroundTask }) {
  const dismissTask = useBackgroundTaskStore((s) => s.dismissTask)
  const cancelTask = useBackgroundTaskStore((s) => s.cancelTask)

  const isDone = task.status === 'done'
  const isError = task.status === 'error'
  const isRunning = task.status === 'running'
  const isPending = task.status === 'pending'
  const isClassified = isDone && task.classification != null
  const rawText = isClassified ? (task.summary ?? task.command) : task.command
  const displayText = truncateTitle(stripLeadingBrackets(rawText))

  const statusClass =
    isRunning ? styles.pillStatusRunning
    : isPending ? styles.pillStatusPending
    : isDone ? styles.pillStatusDone
    : styles.pillStatusError

  return (
    <div className={`${styles.pill} ${isRunning ? styles.pillShimmer : ''}`}>
      <img
        src={nebulaIcon}
        alt=""
        className={`${styles.pillIcon} ${isRunning || isPending ? styles.pillIconSpin : ''}`}
      />
      <span className={styles.pillTitle}>{displayText}</span>
      <span className={`${styles.pillStatus} ${statusClass}`}>
        {isRunning && task.progress != null && task.progress > 0
          ? `${task.progress}%`
          : STATUS_LABEL[task.status] ?? task.status}
      </span>
      {isRunning && task.progress != null && task.progress > 0 && (
        <div className={styles.progressBar}>
          <div className={styles.progressBarFill} style={{ width: `${task.progress}%` }} />
        </div>
      )}
      {isRunning && (
        <button
          type="button"
          className={styles.cancelButton}
          onClick={() => cancelTask(task.id)}
          title="Cancel task"
          aria-label="Cancel task"
        >
          <Square size={8} />
        </button>
      )}
      {(isDone || isError) && (
        <button
          type="button"
          className={styles.dismissButton}
          onClick={() => dismissTask(task.id)}
          title="Dismiss"
          aria-label="Dismiss task"
        >
          <X size={10} />
        </button>
      )}
    </div>
  )
}

function HistorySection() {
  const [expanded, setExpanded] = useState(false)
  const history = useBackgroundTaskStore((s) => s.taskHistory)
  const clearHistory = useBackgroundTaskStore((s) => s.clearHistory)

  if (history.length === 0) return null

  return (
    <div className={styles.historySection}>
      <button
        type="button"
        className={styles.historyToggle}
        onClick={() => setExpanded(!expanded)}
      >
        <ChevronDown size={10} className={expanded ? styles.historyChevronOpen : ''} />
        <span>History ({history.length})</span>
        {expanded && (
          <button
            type="button"
            className={styles.historyClear}
            onClick={(e) => { e.stopPropagation(); clearHistory() }}
            title="Clear history"
          >
            Clear
          </button>
        )}
      </button>
      {expanded && (
        <div className={styles.historyList}>
          {history.map((task) => {
            const rawText = task.summary || task.command
            const displayText = truncateTitle(stripLeadingBrackets(rawText))
            return (
              <div key={task.id} className={styles.historyItem}>
                <img src={nebulaIcon} alt="" className={styles.pillIcon} />
                <span className={styles.pillTitle}>{displayText}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function BackgroundTaskDrawer() {
  const tasks = useBackgroundTaskStore((s) => s.tasks)
  const hasHistory = useBackgroundTaskStore((s) => s.taskHistory.length > 0)

  if (tasks.length === 0 && !hasHistory) return null

  return (
    <div className={styles.wrapper}>
      <div className={styles.drawer}>
        {tasks.map((task) => (
          <TaskItem key={task.id} task={task} />
        ))}
        <HistorySection />
      </div>
    </div>
  )
}
