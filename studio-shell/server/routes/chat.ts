import { Router } from 'express'
import { streamText, generateText, convertToModelMessages } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { buildSystemPrompt } from '../../src/ai/system-prompt'
import { toolRegistry } from '../tools'
import { createPlanQuestionsTool } from '../tools/create-plan'
import type { ConversationMode } from '../../src/types'

export const chatRouter = Router()

/**
 * Extract the text content from the last user message.
 * AI SDK v6 UIMessages use `parts` arrays, not a `content` string.
 */
function extractUserText(msg: Record<string, unknown>): string {
  if (Array.isArray(msg.parts)) {
    return msg.parts
      .filter((p: Record<string, unknown>) => p.type === 'text')
      .map((p: Record<string, unknown>) => p.text as string)
      .join(' ')
  }
  if (typeof msg.content === 'string') {
    return msg.content
  }
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter((p: Record<string, unknown>) => p.type === 'text')
      .map((p: Record<string, unknown>) => p.text as string)
      .join(' ')
  }
  return ''
}

/**
 * Detect if the latest user message is a complex/creative request that
 * should trigger a plan before any scene tools are called.
 */
function shouldForcePlan(messages: Array<Record<string, unknown>>): boolean {
  const hasAssistantReply = messages.some((m) => m.role === 'assistant')
  if (hasAssistantReply) return false

  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
  if (!lastUserMsg) return false

  let text = extractUserText(lastUserMsg).toLowerCase()
  console.log('[chat] shouldForcePlan check, text:', JSON.stringify(text))

  if (!text) return false

  text = text.replace(/^\[context:.*\]\s*/i, '').trim()
  if (!text) return false

  const creativeVerbs = /\b(build|create|design|make|help me build|help me create|help me make|help me design)\b/
  const simpleObjects = /^(a |an |the )?(red |blue |green |big |small )?(cube|box|sphere|ball|cylinder|cone|torus|plane)\s*$/
  const terrainRequest = /\b(terrain|landscape|hills?|mountain|dunes?|ground|heightmap|grassy|snowy|volcanic|desert|rocky)\b/
  const cleaned = text.replace(creativeVerbs, '').trim()

  if (!creativeVerbs.test(text) || simpleObjects.test(cleaned) || terrainRequest.test(cleaned)) return false

  console.log('[chat] shouldForcePlan result: true')
  return true
}

/**
 * Classify whether a creative request should produce questions or todos.
 */
function classifyPlanMode(messages: Array<Record<string, unknown>>): 'questions' | 'todos' | null {
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')
  if (!lastUserMsg) return null

  let text = extractUserText(lastUserMsg).toLowerCase()
  text = text.replace(/^\[context:.*\]\s*/i, '').trim()
  if (!text) return null

  const words = text.split(/\s+/).filter(Boolean)
  let score = 0

  if (words.length <= 4) score += 2
  else if (words.length <= 6) score += 1

  if (words.length >= 10) score -= 1
  if (words.length >= 15) score -= 1

  if (/^help me\b/.test(text)) score += 1

  const genericNouns = /\b(something|stuff|things?|game|world|level|obby|obstacle course|place|environment)\b/
  if (genericNouns.test(text)) score += 1

  if (/\b\d+\b/.test(text)) score -= 2

  const specificObjects = /\b(tree|pine|oak|lake|river|moat|drawbridge|bridge|tower|wall|fence|door|window|roof|stairs|ladder|platform|lava|water|mountain|hill|path|road)\b/g
  const specificMatches = text.match(specificObjects)
  if (specificMatches && specificMatches.length >= 2) score -= 2
  else if (specificMatches && specificMatches.length === 1) score -= 1

  if (/\b(\d+\s*x\s*\d+|\d+\s*(blocks?|studs?|units?|meters?|tiles?|wide|tall|long))\b/.test(text)) score -= 2

  if (/\b(and|with)\b/.test(text) && specificMatches && specificMatches.length >= 1) score -= 1

  const styleAdjectives = /\b(medieval|futuristic|modern|spooky|haunted|Japanese|sci-fi|fantasy|pirate|neon|retro|cartoon|low-poly|wooden|stone|brick)\b/i
  if (styleAdjectives.test(text)) score -= 1

  const commaCount = (text.match(/,/g) || []).length
  if (commaCount >= 2) score -= 1

  console.log('[chat] classifyPlanMode score:', score, 'words:', words.length, 'text:', JSON.stringify(text))

  if (score >= 2) return 'questions'
  if (score <= -1) return 'todos'
  return 'todos'
}

chatRouter.post('/chat', async (req, res) => {
  const msgCount = req.body?.messages?.length ?? 0
  const mode = req.body?.mode
  const bodySize = JSON.stringify(req.body).length
  console.log(`[chat] Received request: ${msgCount} messages, mode=${mode}, body=${Math.round(bodySize / 1024)}KB`)

  try {
    const { messages, sceneContext, selectionContext, cameraContext, background, forcePlanTodos, executingPlan } = req.body

    const lastUserMsg = [...messages].reverse().find((m: Record<string, unknown>) => m.role === 'user')
    const lastUserText = lastUserMsg ? extractUserText(lastUserMsg) : ''
    const followUpTag = lastUserText.match(/^\[PLAN_FOLLOWUP:(todos|execute|execute_step)\]/)
    const taggedTodos = forcePlanTodos || followUpTag?.[1] === 'todos'
    const isResumeIntent = /\b(resume|continue|keep)\b.*\b(build|going|executing|task)\b/i.test(lastUserText)
    const taggedExecute = executingPlan || followUpTag?.[1] === 'execute' || isResumeIntent
    const taggedExecuteStep = followUpTag?.[1] === 'execute_step'

    const modelMessages = await convertToModelMessages(messages, {
      ignoreIncompleteToolCalls: true,
    })
    console.log('[chat] Converted', modelMessages.length, 'model messages, mode:', mode,
      'forcePlanTodos:', taggedTodos, 'executingPlan:', taggedExecute,
      'bodyFlag:', !!forcePlanTodos, 'textTag:', followUpTag?.[1] ?? 'none')

    const forcePlan = shouldForcePlan(messages)
    const shouldForceCreatePlan = forcePlan || taggedTodos
    if (shouldForceCreatePlan) {
      console.log('[chat] Forcing createPlan tool', forcePlan ? '(initial request)' : '(Q&A follow-up)')
    }

    const planModeHint = shouldForceCreatePlan
      ? (taggedTodos ? 'todos' : (classifyPlanMode(messages) ?? 'todos'))
      : null
    if (planModeHint) {
      console.log('[chat] Plan mode hint:', planModeHint)
    }
    if (taggedExecuteStep) {
      console.log('[chat] Executing single plan step — moderate token/step budget')
    } else if (taggedExecute) {
      console.log('[chat] Executing plan — higher token/step budget')
    }

    const systemPrompt = buildSystemPrompt({
      sceneContext: sceneContext ?? 'The scene is currently empty.',
      selectionContext: selectionContext ?? undefined,
      mode: (mode as ConversationMode) ?? undefined,
      cameraContext: cameraContext ?? undefined,
      planModeHint,
    })

    const model = background && !shouldForceCreatePlan
      ? anthropic('claude-haiku-4-5-20251001')
      : anthropic('claude-sonnet-4-20250514')

    const maxTokens = shouldForceCreatePlan ? 4096 : background ? 512 : taggedExecuteStep ? 4096 : taggedExecute ? 8192 : 2048
    const maxSteps = shouldForceCreatePlan ? 1 : taggedExecuteStep ? 10 : taggedExecute ? 25 : 5
    const toolChoice = shouldForceCreatePlan ? { type: 'tool' as const, toolName: 'createPlan' } : undefined

    let tools = toolRegistry.getTools()
    if (planModeHint === 'questions') {
      tools = { ...tools, createPlan: createPlanQuestionsTool }
    }

    const result = streamText({
      model,
      system: systemPrompt,
      messages: modelMessages,
      tools,
      maxSteps,
      maxTokens,
      toolChoice,
    })

    result.pipeUIMessageStreamToResponse(res)
  } catch (error) {
    console.error('[chat] Error:', error)
    if (!res.headersSent) {
      res.status(500).json({ error: String(error) })
    }
  }
})

chatRouter.post('/summarize', async (req, res) => {
  try {
    const { messages } = req.body
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages required' })
    }

    const transcript = messages
      .filter((m: { role: string; textContent?: string }) => m.role === 'user' || m.role === 'assistant')
      .map((m: { role: string; textContent?: string }) => `${m.role}: ${m.textContent || ''}`)
      .join('\n')
      .slice(0, 2000)

    const result = await generateText({
      model: anthropic('claude-haiku-4-5-20251001'),
      system: 'Summarize the following conversation in one sentence, max 80 characters. Be concise and specific. Return ONLY the summary, no quotes or punctuation wrapping.',
      prompt: transcript,
      maxTokens: 60,
    })

    res.json({ summary: result.text.trim().slice(0, 80) })
  } catch (error) {
    console.error('[summarize] Error:', error)
    res.status(500).json({ error: String(error) })
  }
})
