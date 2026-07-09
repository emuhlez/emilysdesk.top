import { create } from 'zustand'
import type { BackgroundTask } from '../types'

interface ClassifyAndCompleteData {
  classification: 'task' | 'conversation'
  summary: string
  fullResponseText: string
  toolCalls: { toolName: string; args: Record<string, unknown> }[]
  messageIds: string[]
}

interface BackgroundTaskStore {
  tasks: BackgroundTask[]
  /** Completed/dismissed tasks for history (capped at 50) */
  taskHistory: BackgroundTask[]
  /** Message IDs from background tasks that should be hidden from the main chat */
  hiddenMessageIds: Set<string>
  enqueueTask: (command: string, conversationId?: string) => string
  /** Add a task already in 'running' state (display-only — the background task runner won't pick it up). */
  addRunningTask: (command: string) => string
  startTask: (id: string) => void
  completeTask: (id: string) => void
  /** Classify and complete a task with response data. Auto-dismisses 'task' classification after 4s. */
  classifyAndComplete: (id: string, data: ClassifyAndCompleteData) => void
  failTask: (id: string, error: string) => void
  removeTask: (id: string) => void
  getNextPending: () => BackgroundTask | undefined
  addHiddenMessageIds: (ids: string[]) => void
  /** Move task to history and remove from active list */
  dismissTask: (id: string) => void
  /** Remove task from drawer, un-hide its messages so they appear in chat */
  promoteToConversation: (id: string) => void
  /** Cancel a running task (Gap 2) */
  cancelTask: (id: string) => void
  /** Clear all task history */
  clearHistory: () => void
  /** Update generation progress (0–100) */
  updateTaskProgress: (id: string, progress: number) => void
  /** Merge additional metadata fields onto a task */
  updateTaskMeta: (id: string, meta: Partial<BackgroundTask>) => void
}

let taskCounter = 0

/** Active auto-dismiss timers keyed by task ID */
const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>()

const HISTORY_CAP = 50

export const useBackgroundTaskStore = create<BackgroundTaskStore>((set, get) => ({
  tasks: [],
  taskHistory: [],
  hiddenMessageIds: new Set<string>(),

  enqueueTask: (command: string, conversationId?: string) => {
    const id = `bg-task-${++taskCounter}-${Date.now()}`
    const task: BackgroundTask = {
      id,
      command,
      status: 'pending',
      createdAt: Date.now(),
      conversationId,
    }
    set((state) => ({ tasks: [...state.tasks, task] }))
    return id
  },

  addRunningTask: (command: string) => {
    const id = `bg-task-${++taskCounter}-${Date.now()}`
    const task: BackgroundTask = {
      id,
      command,
      status: 'running',
      createdAt: Date.now(),
    }
    set((state) => ({ tasks: [...state.tasks, task] }))
    return id
  },

  startTask: (id: string) => {
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, status: 'running' as const } : t
      ),
    }))
  },

  completeTask: (id: string) => {
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id
          ? { ...t, status: 'done' as const, completedAt: Date.now() }
          : t
      ),
    }))
  },

  classifyAndComplete: (id: string, data: ClassifyAndCompleteData) => {
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id
          ? {
              ...t,
              status: 'done' as const,
              completedAt: Date.now(),
              classification: data.classification,
              summary: data.summary,
              fullResponseText: data.fullResponseText,
              toolCalls: data.toolCalls,
              messageIds: data.messageIds,
            }
          : t
      ),
    }))

    // Auto-dismiss completed tasks (not errors, not conversations)
    if (data.classification === 'task') {
      const timer = setTimeout(() => {
        dismissTimers.delete(id)
        get().dismissTask(id)
      }, 4000)
      dismissTimers.set(id, timer)
    }
  },

  failTask: (id: string, error: string) => {
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, status: 'error' as const, error } : t
      ),
    }))
  },

  removeTask: (id: string) => {
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
    }))
  },

  getNextPending: () => {
    return get().tasks.find((t) => t.status === 'pending')
  },

  addHiddenMessageIds: (ids: string[]) => {
    set((state) => {
      const next = new Set(state.hiddenMessageIds)
      ids.forEach((id) => next.add(id))
      return { hiddenMessageIds: next }
    })
  },

  dismissTask: (id: string) => {
    // Clear any pending auto-dismiss timer
    const timer = dismissTimers.get(id)
    if (timer) {
      clearTimeout(timer)
      dismissTimers.delete(id)
    }

    const task = get().tasks.find((t) => t.id === id)
    if (!task) return
    set((state) => {
      const history = [{ ...task, completedAt: task.completedAt ?? Date.now() }, ...state.taskHistory].slice(0, HISTORY_CAP)
      return {
        tasks: state.tasks.filter((t) => t.id !== id),
        taskHistory: history,
      }
    })
  },

  promoteToConversation: (id: string) => {
    const task = get().tasks.find((t) => t.id === id)
    if (!task) return
    // Un-hide the message IDs so they appear in the chat panel
    if (task.messageIds && task.messageIds.length > 0) {
      set((state) => {
        const next = new Set(state.hiddenMessageIds)
        task.messageIds!.forEach((mid) => next.delete(mid))
        return {
          hiddenMessageIds: next,
          tasks: state.tasks.filter((t) => t.id !== id),
        }
      })
    } else {
      set((state) => ({
        tasks: state.tasks.filter((t) => t.id !== id),
      }))
    }
  },

  cancelTask: (id: string) => {
    // Clear any pending auto-dismiss timer
    const timer = dismissTimers.get(id)
    if (timer) {
      clearTimeout(timer)
      dismissTimers.delete(id)
    }

    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id
          ? { ...t, status: 'error' as const, error: 'Cancelled by user', completedAt: Date.now() }
          : t
      ),
    }))
  },

  clearHistory: () => {
    set({ taskHistory: [] })
  },

  updateTaskProgress: (id: string, progress: number) => {
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, progress } : t
      ),
    }))
  },

  updateTaskMeta: (id: string, meta: Partial<BackgroundTask>) => {
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, ...meta } : t
      ),
    }))
  },
}))
