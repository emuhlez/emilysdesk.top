import type { GameObject } from '../../types'
import { COLOR_MAP, PRIMITIVE_MAP } from './mappings'

export interface SceneContext {
  gameObjects: Record<string, GameObject>
  selectedObjectIds: string[]
  rootObjectIds: string[]
}

/**
 * Resolve an object reference from user text to a scene object ID.
 * Tries in order: pronoun → exact name → partial name → color+type match.
 */
export function resolveObject(text: string, ctx: SceneContext): string | null {
  const lower = text.toLowerCase().trim()

  // 1. Pronouns → first selected object
  if (/^(it|that|this|selected|the selected|selection)$/.test(lower)) {
    return ctx.selectedObjectIds[0] ?? null
  }

  // Get visible objects (exclude workspace root)
  const visibleObjects = getVisibleObjects(ctx)

  // 2. Exact name match (case-insensitive)
  for (const obj of visibleObjects) {
    if (obj.name.toLowerCase() === lower) return obj.id
  }

  // 3. Partial name match — check if text is contained in or contains the name
  for (const obj of visibleObjects) {
    const objName = obj.name.toLowerCase()
    if (objName.includes(lower) || lower.includes(objName)) return obj.id
  }

  // 4. Color + type match: "the red cube" → find a red box
  const colorMatch = findColorTypeMatch(lower, visibleObjects)
  if (colorMatch) return colorMatch

  // 5. Type-only match: "the cube" → find first box
  const typeMatch = findTypeMatch(lower, visibleObjects)
  if (typeMatch) return typeMatch

  return null
}

/**
 * Try to resolve an object reference from a longer command string.
 * Strips common verb prefixes and tries to find the object reference.
 */
export function resolveObjectFromCommand(text: string, ctx: SceneContext): string | null {
  // First try direct resolution
  const direct = resolveObject(text, ctx)
  if (direct) return direct

  // Try stripping articles
  const withoutArticles = text.replace(/\b(the|a|an|that|this)\b/gi, '').trim()
  if (withoutArticles !== text) {
    const result = resolveObject(withoutArticles, ctx)
    if (result) return result
  }

  // Try individual words as object names
  const words = text.split(/\s+/)
  for (const word of words) {
    if (word.length < 2) continue
    const result = resolveObject(word, ctx)
    if (result) return result
  }

  // Fall back to selected object
  return ctx.selectedObjectIds[0] ?? null
}

function getVisibleObjects(ctx: SceneContext): GameObject[] {
  const workspaceId = ctx.rootObjectIds[0]
  return Object.values(ctx.gameObjects).filter(
    (obj) => obj.visible !== false && obj.id !== workspaceId && obj.parentId !== null
  )
}

function findColorTypeMatch(text: string, objects: GameObject[]): string | null {
  // Find color keyword in text
  let matchedColor: string | null = null
  for (const [name, hex] of Object.entries(COLOR_MAP)) {
    if (text.includes(name)) {
      matchedColor = hex
      break
    }
  }

  // Find primitive type keyword in text
  let matchedPrimitive: string | null = null
  for (const [name, prim] of Object.entries(PRIMITIVE_MAP)) {
    if (text.includes(name)) {
      matchedPrimitive = prim
      break
    }
  }

  if (!matchedColor && !matchedPrimitive) return null

  for (const obj of objects) {
    const colorOk = !matchedColor || obj.color === matchedColor
    const typeOk = !matchedPrimitive || obj.primitiveType === matchedPrimitive
    if (colorOk && typeOk) return obj.id
  }

  return null
}

function findTypeMatch(text: string, objects: GameObject[]): string | null {
  for (const [name, prim] of Object.entries(PRIMITIVE_MAP)) {
    if (text.includes(name)) {
      for (const obj of objects) {
        if (obj.primitiveType === prim) return obj.id
      }
    }
  }
  return null
}
