import { usePlanStore } from '../store/planStore'
import type { PlanData } from '../types'

const MOCK_QUESTIONS: PlanData = {
  todos: [],
  questions: [
    {
      text: 'What visual style should the obby have?',
      category: 'Style',
      options: [
        { label: 'Neon', description: 'Glowing platforms, dark background, bright trails' },
        { label: 'Natural', description: 'Grass, rocks, waterfalls, and sky islands' },
        { label: 'Cartoon', description: 'Bright colors, rounded shapes, playful props' },
      ],
    },
    {
      text: 'How difficult should the course be?',
      category: 'Scope',
      multiSelect: false,
      options: [
        { label: 'Easy', description: 'Wide platforms, short gaps, no moving parts' },
        { label: 'Medium', description: 'Smaller platforms, some moving obstacles' },
        { label: 'Hard', description: 'Tight jumps, kill bricks, spinners and timing walls' },
      ],
    },
    {
      text: 'What obstacle types do you want?',
      category: 'Obstacles',
      options: [
        { label: 'Platforms', description: 'Static and moving jump platforms' },
        { label: 'Kill bricks', description: 'Red parts that reset the player on touch' },
        { label: 'Spinners', description: 'Rotating bars the player must dodge' },
        { label: 'Wall jumps', description: 'Narrow walls requiring wall-jump technique' },
      ],
    },
    {
      text: 'How many stages should the obby have?',
      category: 'Layout',
      multiSelect: false,
      options: [
        { label: '5 stages', description: 'Quick course, good for a demo' },
        { label: '10 stages', description: 'Standard length with checkpoints' },
        { label: '20 stages', description: 'Full experience with progressive difficulty' },
      ],
    },
  ],
}

export const MOCK_TODOS: PlanData = {
  todos: [
    { label: 'Create the lobby spawn area with a start pad', category: 'Layout' },
    { label: 'Build Stage 1 with basic platform jumps', category: 'Obstacles' },
    { label: 'Build Stage 2 with moving platforms', category: 'Obstacles' },
    { label: 'Build Stage 3 with kill brick corridors', category: 'Obstacles' },
    { label: 'Build Stage 4 with spinner bars to dodge', category: 'Obstacles' },
    { label: 'Build Stage 5 with wall-jump section', category: 'Obstacles' },
    { label: 'Add checkpoints at each stage transition', category: 'Gameplay' },
    { label: 'Place a finish podium with victory effects', category: 'Layout' },
    { label: 'Apply neon materials and lighting to all stages', category: 'Style' },
  ],
}

let simulatedExecutionTimer: ReturnType<typeof setTimeout> | null = null

function clearSimulatedExecution() {
  if (simulatedExecutionTimer) {
    clearTimeout(simulatedExecutionTimer)
    simulatedExecutionTimer = null
  }
}

/**
 * Simulate plan execution by checking off todos with delays.
 * Called when a simulated plan is approved.
 */
export function runSimulatedExecution() {
  clearSimulatedExecution()

  const plan = usePlanStore.getState().activePlan
  if (!plan || !plan.simulated) return

  const todos = plan.data.todos ?? []
  if (todos.length === 0) return

  usePlanStore.getState().startExecuting()

  let stepIndex = 0

  function executeNextStep() {
    const currentPlan = usePlanStore.getState().activePlan
    if (!currentPlan || currentPlan.status !== 'executing') return

    if (stepIndex >= todos.length) {
      usePlanStore.getState().completePlan()
      return
    }

    // Mark step as executing
    usePlanStore.getState().startStepExecution(stepIndex)

    // Complete the step after a delay
    const delay = 600 + Math.random() * 800
    simulatedExecutionTimer = setTimeout(() => {
      const p = usePlanStore.getState().activePlan
      if (!p || p.status !== 'executing') return

      usePlanStore.getState().completeStep(stepIndex)
      stepIndex++

      // Small pause before next step
      simulatedExecutionTimer = setTimeout(() => {
        executeNextStep()
      }, 200)
    }, delay)
  }

  // Brief initial delay before starting
  simulatedExecutionTimer = setTimeout(executeNextStep, 400)
}

/**
 * Inject a simulated plan into the store.
 * @param variant - 'questions' shows the question composer, 'todos' shows the todo list
 */
export function simulatePlanMode(variant: 'questions' | 'todos' = 'questions') {
  clearSimulatedExecution()

  // Clear any existing plan first, then inject on next tick so React
  // processes the null → new plan transition cleanly
  usePlanStore.getState().clearPlan()

  const id = `sim-plan-${Date.now()}`
  const data = variant === 'questions' ? MOCK_QUESTIONS : MOCK_TODOS

  requestAnimationFrame(() => {
    usePlanStore.getState().setPlan(id, data, true)
    console.log(`[simulatePlanMode] Injected ${variant} plan: ${id}`)
  })
}

// Expose on window for quick dev console access
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(window as any).__simulatePlanMode = simulatePlanMode
}
