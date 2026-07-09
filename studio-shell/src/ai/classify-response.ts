interface ClassifyInput {
  textContent: string
  toolNames: string[]
  hasPlan: boolean
  wantsAssistant: boolean
}

/**
 * Classify an AI response as either a simple 'task' (stays in drawer)
 * or a 'conversation' (opens full chat panel).
 */
export function classifyResponse({
  textContent,
  toolNames,
  hasPlan,
  wantsAssistant,
}: ClassifyInput): 'task' | 'conversation' {
  // Plan or explicit assistant open → conversation
  if (hasPlan || wantsAssistant) return 'conversation'

  const trimmed = textContent.trim()
  const hasTools = toolNames.length > 0

  // Text contains a question and is non-trivial → conversation
  if (trimmed.includes('?') && trimmed.length > 50) return 'conversation'

  // Long text → conversation
  if (trimmed.length > 200) return 'conversation'

  // Tool calls with short text → task
  if (hasTools && trimmed.length < 100) return 'task'

  // Short text with no tools → task
  if (trimmed.length < 100 && !hasTools) return 'task'

  // Default: with tools → task, without → conversation
  return hasTools ? 'task' : 'conversation'
}

/**
 * Extract a short summary for drawer display.
 * Returns the first sentence (up to 80 chars), or a "Executed <tool>" fallback.
 */
export function extractTaskSummary(
  textContent: string,
  toolNames: string[],
): string {
  const trimmed = textContent.trim()
  if (trimmed) {
    // Take first sentence or first 80 chars
    const sentenceEnd = trimmed.search(/[.!]\s|[.!]$/)
    const firstSentence =
      sentenceEnd > 0 ? trimmed.slice(0, sentenceEnd + 1) : trimmed
    if (firstSentence.length <= 80) return firstSentence
    return firstSentence.slice(0, 77) + '...'
  }
  if (toolNames.length > 0) {
    return `Executed ${toolNames[0]}${toolNames.length > 1 ? ` +${toolNames.length - 1} more` : ''}`
  }
  return 'Task completed'
}
