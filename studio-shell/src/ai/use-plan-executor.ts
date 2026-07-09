import { useEffect, useRef } from 'react'
import { usePlanStore } from '../store/planStore'
import { useConversationStore } from '../store/conversationStore'
import { useEditorStore } from '../store/editorStore'
import { executeTool } from './tool-executor'
import { getRecipeSteps, clearRecipeSteps } from './keyword-engine/recipes'
import { runSimulatedExecution, MOCK_TODOS } from './simulate-plan-mode'
import type { PlanTodo, PlanQuestion } from '../types'

const STEP_DELAY_MS = 300

/**
 * Generate a concrete todo list from the user's /plan prompt and their Q&A answers.
 * Answers are matched to question categories (Style, Scope, Features).
 */
function generateTodosFromAnswers(prompt: string, questions: PlanQuestion[], answers: string[]): PlanTodo[] {
  const todos: PlanTodo[] = []

  const answerMap = new Map<string, string>()
  questions.forEach((q, i) => {
    const category = (q.category ?? '').toLowerCase()
    answerMap.set(category, answers[i] ?? '')
  })

  const scopeAnswer = (answerMap.get('scope') ?? '').toLowerCase()
  const featuresAnswer = (answerMap.get('features') ?? '').toLowerCase()
  const styleAnswer = answerMap.get('style') ?? ''

  todos.push({ label: `Plan layout for: ${prompt}`, category: 'Planning' })

  if (styleAnswer) {
    todos.push({ label: `Set up ${styleAnswer.toLowerCase()} visual style and materials`, category: 'Style' })
  }

  if (featuresAnswer.includes('terrain')) {
    todos.push({ label: 'Create terrain and landscape', category: 'Environment' })
    if (scopeAnswer.includes('elaborate')) {
      todos.push({ label: 'Add terrain details (hills, valleys, paths)', category: 'Environment' })
    }
  }

  if (featuresAnswer.includes('structure')) {
    todos.push({ label: 'Build main structures', category: 'Structure' })
    if (scopeAnswer.includes('medium') || scopeAnswer.includes('elaborate')) {
      todos.push({ label: 'Add secondary structures and walls', category: 'Structure' })
    }
    if (scopeAnswer.includes('elaborate')) {
      todos.push({ label: 'Add interior details to structures', category: 'Structure' })
    }
  }

  if (featuresAnswer.includes('prop')) {
    todos.push({ label: 'Place decorative props and objects', category: 'Detail' })
    if (scopeAnswer.includes('elaborate')) {
      todos.push({ label: 'Add small details and finishing touches', category: 'Detail' })
    }
  }

  if (featuresAnswer.includes('light')) {
    todos.push({ label: 'Set up lighting and atmosphere', category: 'Lighting' })
    if (scopeAnswer.includes('elaborate')) {
      todos.push({ label: 'Fine-tune mood lighting and shadows', category: 'Lighting' })
    }
  }

  if (!featuresAnswer) {
    todos.push({ label: `Build core elements for ${prompt}`, category: 'Structure' })
    if (scopeAnswer.includes('medium') || scopeAnswer.includes('elaborate')) {
      todos.push({ label: 'Add supporting structures', category: 'Structure' })
      todos.push({ label: 'Add decorative details', category: 'Detail' })
    }
    if (scopeAnswer.includes('elaborate')) {
      todos.push({ label: 'Polish and refine details', category: 'Detail' })
      todos.push({ label: 'Set up lighting and atmosphere', category: 'Lighting' })
    }
  }

  todos.push({ label: 'Review and adjust final result', category: 'Review' })

  return todos
}

/**
 * Self-contained plan executor hook.
 * Watches plan status transitions and executes recipe steps directly
 * via executeTool — no AI streaming or sendMessage needed.
 */
export function usePlanExecutor() {
  const activePlan = usePlanStore((s) => s.activePlan)
  const startExecuting = usePlanStore((s) => s.startExecuting)
  const clearPlan = usePlanStore((s) => s.clearPlan)
  const transitionToTodos = usePlanStore((s) => s.transitionToTodos)

  const executingRef = useRef(false)

  useEffect(() => {
    if (!activePlan) {
      executingRef.current = false
    }
  }, [activePlan])

  useEffect(() => {
    if (activePlan?.status !== 'answered') return

    if (activePlan.simulated) {
      console.log('[PlanExecutor] Simulated Q&A answered — transitioning to todos')
      transitionToTodos(MOCK_TODOS.todos)

      const convStore = useConversationStore.getState()
      const convId = convStore.activeConversationId
      if (convId) {
        const plan = usePlanStore.getState().activePlan
        convStore.addMessage(convId, {
          id: `assistant-plan-${Date.now()}`,
          role: 'assistant',
          textContent: "I've reviewed your answers and created a plan. Here's the task list — feel free to make any updates before building.",
          toolCalls: plan ? [{
            toolName: 'createPlan',
            toolCallId: plan.id,
            args: { todos: plan.data.todos, questions: plan.data.questions, answers: plan.data.answers },
          }] : undefined,
          timestamp: Date.now(),
        })
      }
      return
    }

    const storedTodos = activePlan.data.todos ?? []
    if (storedTodos.length > 0) {
      console.log('[PlanExecutor] Q&A answered — transitioning to stored todos', storedTodos.length, 'items')
      transitionToTodos(storedTodos)

      const convStore = useConversationStore.getState()
      const convId = convStore.activeConversationId
      if (convId) {
        const plan = usePlanStore.getState().activePlan
        convStore.addMessage(convId, {
          id: `assistant-plan-${Date.now()}`,
          role: 'assistant',
          textContent: "I've reviewed your answers and created a plan. Here's the task list — feel free to make any updates before building.",
          toolCalls: plan ? [{
            toolName: 'createPlan',
            toolCallId: plan.id,
            args: { todos: plan.data.todos, questions: plan.data.questions, answers: plan.data.answers },
          }] : undefined,
          timestamp: Date.now(),
        })
      }
      return
    }

    const prompt = activePlan.data.prompt ?? 'New project'
    const questions = activePlan.data.questions ?? []
    const answers = activePlan.data.answers ?? []

    console.log('[PlanExecutor] Q&A answered — generating todos from prompt + answers', prompt, answers)

    const generatedTodos = generateTodosFromAnswers(prompt, questions, answers)
    transitionToTodos(generatedTodos)

    const convStore2 = useConversationStore.getState()
    const convId2 = convStore2.activeConversationId
    if (convId2) {
      const plan2 = usePlanStore.getState().activePlan
      convStore2.addMessage(convId2, {
        id: `assistant-plan-${Date.now()}`,
        role: 'assistant',
        textContent: "I've reviewed your answers and created a plan. Here's the task list — feel free to make any updates before building.",
        toolCalls: plan2 ? [{
          toolName: 'createPlan',
          toolCallId: plan2.id,
          args: { todos: plan2.data.todos, questions: plan2.data.questions, answers: plan2.data.answers },
        }] : undefined,
        timestamp: Date.now(),
      })
    }
  }, [activePlan?.status, activePlan?.data, clearPlan, transitionToTodos])

  useEffect(() => {
    if (activePlan?.status !== 'approved') return
    if (executingRef.current) return

    if (activePlan.simulated) {
      executingRef.current = true
      console.log('[PlanExecutor] Simulated plan approved — running fake execution')
      runSimulatedExecution()
      return
    }

    const mode = activePlan.executionMode
    executingRef.current = true
    console.log('[PlanExecutor] Plan approved — mode:', mode)

    startExecuting()

    if (mode === 'step-by-step') {
      usePlanStore.getState().startStepExecution(0)
      executeStep(activePlan.id, 0)
    } else {
      executeAllSteps(activePlan.id)
    }
  }, [activePlan?.status, startExecuting, activePlan?.executionMode, activePlan?.id])

  useEffect(() => {
    if (!activePlan || activePlan.executionMode !== 'step-by-step') return
    if (activePlan.status !== 'executing') return

    const currentIndex = activePlan.currentStepIndex
    const stepStatus = activePlan.stepStatuses[currentIndex]

    if (stepStatus !== 'executing') return
    if (!executingRef.current) return

    executeStep(activePlan.id, currentIndex)
  }, [activePlan?.status, activePlan?.currentStepIndex, activePlan?.stepStatuses, activePlan?.executionMode, activePlan?.id])

  useEffect(() => {
    if (!activePlan) {
      executingRef.current = false
      return
    }
    if (activePlan.status === 'done' || activePlan.status === 'rejected') {
      executingRef.current = false
      clearRecipeSteps(activePlan.id)
    }
  }, [activePlan?.status, activePlan?.id])
}

function executeStep(planId: string, stepIndex: number): void {
  const steps = getRecipeSteps(planId)
  if (!steps || stepIndex >= steps.length) {
    console.log('[PlanExecutor] No recipe steps found for plan', planId)
    usePlanStore.getState().completeStep(stepIndex)
    return
  }

  const step = steps[stepIndex]
  console.log('[PlanExecutor] Executing step', stepIndex, '—', step.toolCalls.length, 'tool calls')

  for (const tc of step.toolCalls) {
    try {
      executeTool(tc.toolName, tc.args)
    } catch (err) {
      console.error('[PlanExecutor] Step', stepIndex, 'tool error:', tc.toolName, err)
    }
  }

  usePlanStore.getState().completeStep(stepIndex)
}

function executeAllSteps(planId: string): void {
  const steps = getRecipeSteps(planId)
  if (!steps || steps.length === 0) {
    console.log('[PlanExecutor] No recipe steps found for plan', planId)
    usePlanStore.getState().completePlan()
    return
  }

  useEditorStore.getState().setAiGenerating(true)

  let stepIndex = 0

  function runNext() {
    if (stepIndex >= steps!.length) {
      usePlanStore.getState().completePlan()
      useEditorStore.getState().setAiGenerating(false)
      useEditorStore.getState().setAiWorkingObjectIds(new Set())
      return
    }

    const step = steps![stepIndex]
    console.log('[PlanExecutor] One-shot step', stepIndex, '—', step.toolCalls.length, 'tool calls')

    usePlanStore.getState().startStepExecution(stepIndex)

    for (const tc of step.toolCalls) {
      try {
        executeTool(tc.toolName, tc.args)
      } catch (err) {
        console.error('[PlanExecutor] One-shot step', stepIndex, 'tool error:', tc.toolName, err)
      }
    }

    usePlanStore.getState().completeStep(stepIndex)
    stepIndex++

    if (stepIndex < steps!.length) {
      setTimeout(runNext, STEP_DELAY_MS)
    } else {
      runNext()
    }
  }

  runNext()
}
