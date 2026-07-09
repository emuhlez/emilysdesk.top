import type { PlanTodo, PlanQuestion } from '../../types'
import { ALL_PARSERS, type ToolCall } from './parsers'
import { matchRecipe, registerRecipeSteps } from './recipes'
import { PRIMITIVE_MAP, resolveColor } from './mappings'
import type { SceneContext } from './object-resolver'

export interface CommandResult {
  toolCalls: ToolCall[]
  responseText: string
  plan?: { id: string; todos: PlanTodo[]; questions?: PlanQuestion[] }
  isPlan: boolean
  isQuestions?: boolean
}

/** Normalize input: lowercase, strip politeness prefixes, trim whitespace. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/\b(please|can you|could you|would you|i want you to|i'd like you to|go ahead and|just|hey|hi|okay|ok)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Detect whether the user is explicitly asking for a plan / todo list.
 *
 * If the prompt contains no plan-indication keywords we skip the
 * clarifying-questions + todo-list flow even for recipes that normally
 * trigger it, and instead just execute all the recipe's steps directly.
 */
function hasPlanIntent(text: string): boolean {
  return /\b(plan|planning|plan out|plan this|plan it|break (it|this) down|step[- ]by[- ]step|roadmap|outline|to[- ]?do( list)?|checklist)\b/i.test(text)
}

/** Split on "and", "then", commas, or semicolons for multi-command support. */
function splitCommands(text: string): string[] {
  // Don't split inside quoted strings or coordinates like "at 1, 2, 3"
  // Only split on standalone conjunctions
  const parts = text
    .split(/\s*(?:\band\s+then\b|\bthen\b|;\s*)\s*/i)
    .flatMap((part) => {
      // Split on "and" only if the part after "and" starts with a verb
      const andSplit = part.split(/\s*\band\b\s*/i)
      if (andSplit.length <= 1) return [part]
      // Only split if each piece looks like a separate command
      const verbPattern = /^(add|create|make|remove|delete|move|rotate|scale|color|paint|build|place|put|spawn)/i
      const result: string[] = [andSplit[0]]
      for (let i = 1; i < andSplit.length; i++) {
        if (verbPattern.test(andSplit[i].trim())) {
          result.push(andSplit[i])
        } else {
          // Not a new command, rejoin with previous
          result[result.length - 1] += ' and ' + andSplit[i]
        }
      }
      return result
    })
    .map((s) => s.trim())
    .filter(Boolean)

  return parts.length > 0 ? parts : [text]
}

/**
 * Main orchestrator: process a user command string into tool calls.
 */
export function processCommand(text: string, sceneContext: SceneContext): CommandResult {
  const normalized = normalize(text)
  const wantsPlan = hasPlanIntent(text)

  // 1. Check for recipe matches (complex builds).
  //    - If the user explicitly asked for a plan/todo list, route through the
  //      clarifying-questions + todo flow.
  //    - Otherwise, just execute all the recipe's steps inline — no plan, no
  //      todos, no clarifying questions.
  const recipe = matchRecipe(normalized)
  if (recipe) {
    if (wantsPlan) {
      const planId = `plan-${Date.now()}`
      registerRecipeSteps(planId, recipe.steps)
      return {
        toolCalls: [],
        responseText: '',
        plan: { id: planId, todos: recipe.todos, questions: recipe.questions },
        isPlan: true,
        isQuestions: !!(recipe.questions && recipe.questions.length > 0),
      }
    }

    const flattenedToolCalls = recipe.steps.flatMap((step) => step.toolCalls)
    const summary = recipe.todos.map((t) => t.label).join(', ')
    return {
      toolCalls: flattenedToolCalls,
      responseText: summary ? `Built: ${summary}.` : `Built requested scene.`,
      isPlan: false,
    }
  }

  // 2. Split into sub-commands
  const subCommands = splitCommands(normalized)

  // 3. Try each parser for each sub-command
  const allToolCalls: ToolCall[] = []
  const summaries: string[] = []

  for (const cmd of subCommands) {
    let matched = false
    for (const parser of ALL_PARSERS) {
      const result = parser(cmd, sceneContext)
      if (result) {
        allToolCalls.push(...result.toolCalls)
        summaries.push(result.summary)
        matched = true
        break
      }
    }

    if (!matched) {
      // 4. Best-effort fallback: try to extract any shape/color and guess intent
      const fallback = bestEffortFallback(cmd, sceneContext)
      if (fallback) {
        allToolCalls.push(...fallback.toolCalls)
        summaries.push(fallback.summary)
      }
    }
  }

  if (allToolCalls.length === 0) {
    return {
      toolCalls: [],
      responseText: `I didn't understand that command. Try something like "add a red cube" or "build a castle".`,
      isPlan: false,
    }
  }

  return {
    toolCalls: allToolCalls,
    responseText: summaries.join('. ') + '.',
    isPlan: false,
  }
}

/**
 * Best-effort fallback: if no parser matched, try to extract a shape and/or color
 * from the text and create an object.
 */
function bestEffortFallback(text: string, _ctx: SceneContext): { toolCalls: ToolCall[]; summary: string } | null {
  // Try to find a shape keyword
  let primitive: string | null = null
  let primitiveWord = ''
  for (const [keyword, prim] of Object.entries(PRIMITIVE_MAP)) {
    if (new RegExp(`\\b${keyword}\\b`, 'i').test(text)) {
      primitive = prim
      primitiveWord = keyword
      break
    }
  }

  if (!primitive) return null

  // Try to find a color
  let color: string | null = null
  let colorWord = ''
  for (const word of text.split(/\s+/)) {
    const c = resolveColor(word)
    if (c) {
      color = c
      colorWord = word
      break
    }
  }

  const name = [colorWord, primitiveWord].filter(Boolean).join(' ')
    .replace(/^\w/, (c) => c.toUpperCase())
    || `New ${primitive}`

  const args: Record<string, unknown> = {
    name,
    primitive,
    position: [0, primitive === 'plane' ? 0 : 0.5, 0],
  }
  if (color) args.color = color

  return {
    toolCalls: [{ toolName: 'addObject', args }],
    summary: `Created ${name}`,
  }
}
