const ACTION_VERBS = new Set([
  'create', 'make', 'add', 'move', 'delete', 'remove', 'change', 'set',
  'turn', 'rotate', 'scale', 'color', 'paint', 'place', 'put', 'build',
  'spawn', 'generate', 'duplicate', 'copy', 'rename', 'hide', 'show',
])

const KNOWN_TYPES = new Set([
  'cube', 'sphere', 'box', 'cylinder', 'cone', 'torus', 'plane', 'light', 'camera',
])

export function isAIIntent(query: string): boolean {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return false

  // Starts with an action verb
  const firstWord = trimmed.split(/\s+/)[0]
  if (ACTION_VERBS.has(firstWord)) return true

  // 3+ words → likely natural language
  const words = trimmed.split(/\s+/)
  if (words.length >= 3) return true

  // Single known 3D type
  if (words.length === 1 && KNOWN_TYPES.has(firstWord)) return true

  return false
}
