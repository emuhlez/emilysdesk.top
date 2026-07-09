import { create } from 'zustand'
import type { PlanData, PlanTodo, PlanStatus, ExecutionMode, StepStatus } from '../types'

interface ActivePlan {
  id: string
  data: PlanData
  status: PlanStatus
  checkedItems: Set<number>
  executionMode: ExecutionMode
  currentStepIndex: number
  stepStatuses: StepStatus[]
  /** When true, plan was injected by simulatePlanMode — executor skips real API calls */
  simulated?: boolean
}

interface QuestionDraftState {
  draftAnswers: string[]
  activeQuestionIndex: number
}

interface PlanStore {
  activePlan: ActivePlan | null
  pendingFollowUp: 'todos' | 'execute' | null
  todoDrawerExpanded: boolean
  // Shared question-answering state (lifted from PlanCard)
  questionDraft: QuestionDraftState
  initDraftAnswers: (questions: Array<unknown>) => void
  updateDraftAnswer: (index: number, value: string) => void
  setActiveQuestionIndex: (index: number) => void
  setPlan: (id: string, data: PlanData, simulated?: boolean) => void
  approvePlan: () => void
  rejectPlan: () => void
  answerQuestions: (answers: string[]) => void
  startReview: () => void
  editQuestions: () => void
  startExecuting: () => void
  resumeExecution: () => void
  completePlan: () => void
  toggleTodo: (index: number) => void
  clearPlan: () => void
  setPendingFollowUp: (type: 'todos' | 'execute' | null) => void
  // Inline plan editing (Gap 5)
  updateTodo: (index: number, label: string) => void
  addTodo: (label: string, category?: string) => void
  removeTodo: (index: number) => void
  reorderTodos: (from: number, to: number) => void
  // Transition from Q&A to todos
  transitionToTodos: (todos: PlanTodo[]) => void
  askAgain: () => void
  // Execution mode + step-by-step
  setExecutionMode: (mode: ExecutionMode) => void
  setTodoDrawerExpanded: (expanded: boolean) => void
  startStepExecution: (index: number) => void
  completeStep: (index: number) => void
  continueStep: () => void
  redoStep: () => void
}

export const usePlanStore = create<PlanStore>((set, get) => ({
  activePlan: null,
  pendingFollowUp: null,
  todoDrawerExpanded: true,
  questionDraft: { draftAnswers: [], activeQuestionIndex: 0 },

  initDraftAnswers: (questions) => {
    set({
      questionDraft: {
        draftAnswers: questions.map(() => ''),
        activeQuestionIndex: 0,
      },
    })
  },

  updateDraftAnswer: (index, value) => {
    const { draftAnswers, activeQuestionIndex } = get().questionDraft
    const next = [...draftAnswers]
    next[index] = value
    set({ questionDraft: { draftAnswers: next, activeQuestionIndex } })
  },

  setActiveQuestionIndex: (index) => {
    const { draftAnswers } = get().questionDraft
    set({ questionDraft: { draftAnswers, activeQuestionIndex: index } })
  },

  setPlan: (id, data, simulated) => {
    const hasQuestions = (data.questions?.length ?? 0) > 0
    const status: PlanStatus = hasQuestions ? 'clarifying' : 'pending'
    const todoCount = data.todos?.length ?? 0
    const questions = data.questions ?? []
    set({
      activePlan: {
        id,
        data,
        status,
        checkedItems: new Set(),
        executionMode: 'one-shot',
        currentStepIndex: 0,
        stepStatuses: Array(todoCount).fill('pending') as StepStatus[],
        simulated,
      },
      questionDraft: {
        draftAnswers: questions.map(() => ''),
        activeQuestionIndex: 0,
      },
    })
  },

  approvePlan: () => {
    const plan = get().activePlan
    if (plan?.status !== 'pending') return
    set({ activePlan: { ...plan, status: 'approved' } })
  },

  rejectPlan: () => {
    const plan = get().activePlan
    if (plan?.status !== 'pending' && plan?.status !== 'clarifying' && plan?.status !== 'reviewing') return
    set({ activePlan: { ...plan, status: 'rejected' } })
  },

  answerQuestions: (answers: string[]) => {
    const plan = get().activePlan
    if (plan?.status !== 'clarifying' && plan?.status !== 'reviewing') return
    set({
      activePlan: {
        ...plan,
        data: { ...plan.data, answers },
        status: 'answered',
      },
    })
  },

  startReview: () => {
    const plan = get().activePlan
    if (plan?.status !== 'clarifying') return
    set({ activePlan: { ...plan, status: 'reviewing' } })
  },

  editQuestions: () => {
    const plan = get().activePlan
    if (plan?.status !== 'reviewing') return
    set({ activePlan: { ...plan, status: 'clarifying' } })
  },

  startExecuting: () => {
    const plan = get().activePlan
    if (plan?.status !== 'approved') return
    set({ activePlan: { ...plan, status: 'executing' } })
  },

  resumeExecution: () => {
    const plan = get().activePlan
    if (!plan || plan.status !== 'done') return
    set({ activePlan: { ...plan, status: 'executing' } })
  },

  completePlan: () => {
    const plan = get().activePlan
    if (!plan || (plan.status !== 'executing' && plan.status !== 'step-paused')) return

    const todos = plan.data.todos ?? []
    const allChecked = new Set<number>()
    todos.forEach((_, index) => {
      allChecked.add(index)
    })

    set({
      activePlan: {
        ...plan,
        status: 'done',
        checkedItems: allChecked,
        stepStatuses: plan.stepStatuses.map(() => 'done' as StepStatus),
      },
    })
  },

  toggleTodo: (index) => {
    const plan = get().activePlan
    if (!plan) return
    const next = new Set(plan.checkedItems)
    if (next.has(index)) {
      next.delete(index)
    } else {
      next.add(index)
    }
    set({ activePlan: { ...plan, checkedItems: next } })
  },

  clearPlan: () => set({ activePlan: null }),

  setPendingFollowUp: (type) => set({ pendingFollowUp: type }),

  // Inline plan editing (Gap 5)
  updateTodo: (index, label) => {
    const plan = get().activePlan
    if (!plan) return
    const todos = [...(plan.data.todos ?? [])]
    if (index < 0 || index >= todos.length) return
    todos[index] = { ...todos[index], label }
    set({ activePlan: { ...plan, data: { ...plan.data, todos } } })
  },

  addTodo: (label, category) => {
    const plan = get().activePlan
    if (!plan) return
    const todos = [...(plan.data.todos ?? []), { label, category }]
    set({
      activePlan: {
        ...plan,
        data: { ...plan.data, todos },
        stepStatuses: [...plan.stepStatuses, 'pending' as StepStatus],
      },
    })
  },

  removeTodo: (index) => {
    const plan = get().activePlan
    if (!plan) return
    const todos = [...(plan.data.todos ?? [])]
    if (index < 0 || index >= todos.length) return
    todos.splice(index, 1)
    // Adjust checkedItems indices
    const oldChecked = plan.checkedItems
    const newChecked = new Set<number>()
    for (const i of oldChecked) {
      if (i < index) newChecked.add(i)
      else if (i > index) newChecked.add(i - 1)
      // skip i === index (removed)
    }
    const stepStatuses = [...plan.stepStatuses]
    stepStatuses.splice(index, 1)
    set({ activePlan: { ...plan, data: { ...plan.data, todos }, checkedItems: newChecked, stepStatuses } })
  },

  reorderTodos: (from, to) => {
    const plan = get().activePlan
    if (!plan) return
    const todos = [...(plan.data.todos ?? [])]
    if (from < 0 || from >= todos.length || to < 0 || to >= todos.length) return
    const [item] = todos.splice(from, 1)
    todos.splice(to, 0, item)
    const stepStatuses = [...plan.stepStatuses]
    const [stepItem] = stepStatuses.splice(from, 1)
    stepStatuses.splice(to, 0, stepItem)
    set({ activePlan: { ...plan, data: { ...plan.data, todos }, stepStatuses } })
  },

  // Transition from Q&A to todos (preserves Q&A data in the same plan)
  transitionToTodos: (todos) => {
    const plan = get().activePlan
    if (!plan || plan.status !== 'answered') return
    set({
      activePlan: {
        ...plan,
        data: { ...plan.data, todos },
        status: 'pending',
        stepStatuses: Array(todos.length).fill('pending') as StepStatus[],
      },
    })
  },

  askAgain: () => {
    const plan = get().activePlan
    if (!plan || plan.status !== 'pending') return
    set({ activePlan: { ...plan, status: 'clarifying' } })
  },

  // Execution mode + step-by-step
  setExecutionMode: (mode) => {
    const plan = get().activePlan
    if (!plan) return
    set({ activePlan: { ...plan, executionMode: mode } })
  },

  setTodoDrawerExpanded: (expanded) => {
    set({ todoDrawerExpanded: expanded })
  },

  startStepExecution: (index) => {
    const plan = get().activePlan
    if (!plan) return
    const stepStatuses = [...plan.stepStatuses]
    if (index < 0 || index >= stepStatuses.length) return
    stepStatuses[index] = 'executing'
    const checkedItems = new Set(plan.checkedItems)
    set({
      activePlan: {
        ...plan,
        status: 'executing',
        currentStepIndex: index,
        stepStatuses,
        checkedItems,
      },
    })
  },

  completeStep: (index) => {
    const plan = get().activePlan
    if (!plan) return
    const stepStatuses = [...plan.stepStatuses]
    if (index < 0 || index >= stepStatuses.length) return
    stepStatuses[index] = 'done'
    const checkedItems = new Set(plan.checkedItems)
    checkedItems.add(index)

    // Check if all steps are done
    const allDone = stepStatuses.every((s) => s === 'done')
    set({
      activePlan: {
        ...plan,
        status: allDone ? 'done' : 'step-paused',
        currentStepIndex: index,
        stepStatuses,
        checkedItems,
      },
    })
  },

  continueStep: () => {
    const plan = get().activePlan
    if (!plan || plan.status !== 'step-paused') return
    // Find the next pending step
    const nextIndex = plan.stepStatuses.findIndex((s) => s === 'pending')
    if (nextIndex === -1) {
      // All steps done
      get().completePlan()
      return
    }
    const stepStatuses = [...plan.stepStatuses]
    stepStatuses[nextIndex] = 'executing'
    set({
      activePlan: {
        ...plan,
        status: 'executing',
        currentStepIndex: nextIndex,
        stepStatuses,
      },
    })
  },

  redoStep: () => {
    const plan = get().activePlan
    if (!plan || plan.status !== 'step-paused') return
    const index = plan.currentStepIndex
    const stepStatuses = [...plan.stepStatuses]
    stepStatuses[index] = 'executing'
    const checkedItems = new Set(plan.checkedItems)
    checkedItems.delete(index)
    set({
      activePlan: {
        ...plan,
        status: 'executing',
        currentStepIndex: index,
        stepStatuses,
        checkedItems,
      },
    })
  },
}))
