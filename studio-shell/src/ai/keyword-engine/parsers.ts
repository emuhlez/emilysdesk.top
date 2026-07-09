import {
  PRIMITIVE_MAP,
  SIZE_MAP,
  DIRECTION_MAP,
  BIOME_MAP,
  resolveColor,
  parseCoordinates,
  parseDegrees,
} from './mappings'
import { resolveObjectFromCommand, type SceneContext } from './object-resolver'

export interface ToolCall {
  toolName: string
  args: Record<string, unknown>
}

export interface ParseResult {
  toolCalls: ToolCall[]
  summary: string
}

// ---------------------------------------------------------------------------
// ADD / CREATE
// ---------------------------------------------------------------------------
export function parseAdd(text: string, _ctx: SceneContext): ParseResult | null {
  if (!/\b(add|create|make|place|put|spawn|insert|generate|build)\b/i.test(text)) return null

  // Find a shape keyword
  let primitive: string | null = null
  let primitiveKeyword = ''
  for (const [keyword, prim] of Object.entries(PRIMITIVE_MAP)) {
    if (new RegExp(`\\b${keyword}\\b`, 'i').test(text)) {
      primitive = prim
      primitiveKeyword = keyword
      break
    }
  }

  // If "terrain" or "landscape" is mentioned, route to terrain parser
  if (/\b(terrain|landscape|ground|island)\b/i.test(text) && !primitive) {
    return parseTerrain(text, _ctx)
  }

  if (!primitive) return null

  // Find color
  let color: string | null = null
  const words = text.split(/\s+/)
  for (const word of words) {
    const c = resolveColor(word)
    if (c) { color = c; break }
  }

  // Find size modifier
  let scale: [number, number, number] = [1, 1, 1]
  for (const [keyword, factor] of Object.entries(SIZE_MAP)) {
    if (new RegExp(`\\b${keyword}\\b`, 'i').test(text)) {
      // Directional size modifiers
      if (keyword === 'tall' || keyword === 'short') {
        scale = [1, factor, 1]
      } else if (keyword === 'wide' || keyword === 'narrow') {
        scale = [factor, 1, factor]
      } else if (keyword === 'flat') {
        scale = [2, factor, 2]
      } else {
        scale = [factor, factor, factor]
      }
      break
    }
  }

  // Find position
  let position: [number, number, number] | null = parseCoordinates(text)

  // Check for direction if no explicit coordinates
  if (!position) {
    for (const [keyword, offset] of Object.entries(DIRECTION_MAP)) {
      if (new RegExp(`\\b${keyword}\\b`, 'i').test(text)) {
        position = offset
        break
      }
    }
  }

  // Default position: on the ground (y = half the scale for box-like objects)
  if (!position) {
    const groundY = primitive === 'plane' ? 0 : scale[1] * 0.5
    position = [0, groundY, 0]
  }

  // Generate a name
  const colorName = color ? words.find((w) => resolveColor(w) !== null) ?? '' : ''
  const name = [colorName, primitiveKeyword].filter(Boolean).join(' ')
    .replace(/^\w/, (c) => c.toUpperCase())
    || `New ${primitive}`

  const args: Record<string, unknown> = {
    name,
    primitive,
    position,
    scale,
  }
  if (color) args.color = color

  return {
    toolCalls: [{ toolName: 'addObject', args }],
    summary: `Created ${name}`,
  }
}

// ---------------------------------------------------------------------------
// REMOVE / DELETE
// ---------------------------------------------------------------------------
export function parseRemove(text: string, ctx: SceneContext): ParseResult | null {
  if (!/\b(remove|delete|destroy|erase|clear|kill|get rid of)\b/i.test(text)) return null

  // Strip the verb to find the object reference
  const objRef = text
    .replace(/\b(remove|delete|destroy|erase|clear|kill|get rid of|please|can you)\b/gi, '')
    .trim()

  const id = resolveObjectFromCommand(objRef, ctx)
  if (!id) return null

  const obj = ctx.gameObjects[id]
  const name = obj?.name ?? id

  return {
    toolCalls: [{ toolName: 'removeObject', args: { id } }],
    summary: `Removed ${name}`,
  }
}

// ---------------------------------------------------------------------------
// MOVE
// ---------------------------------------------------------------------------
export function parseMove(text: string, ctx: SceneContext): ParseResult | null {
  if (!/\b(move|shift|slide|push|pull|drag|nudge|translate|reposition)\b/i.test(text)) return null

  // Try to find the object reference
  const objRef = text
    .replace(/\b(move|shift|slide|push|pull|drag|nudge|translate|reposition|please|can you)\b/gi, '')
    .trim()

  const id = resolveObjectFromCommand(objRef, ctx)
  if (!id) return null

  const obj = ctx.gameObjects[id]
  if (!obj) return null

  // Try explicit coordinates first
  let targetPos = parseCoordinates(text)

  if (!targetPos) {
    // Try direction-based offset
    const currentPos = obj.transform.position
    for (const [keyword, offset] of Object.entries(DIRECTION_MAP)) {
      if (new RegExp(`\\b${keyword}\\b`, 'i').test(text)) {
        // Check for a multiplier ("move left 5", "move 3 units left")
        const multiplierMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:units?\s+)?/i)
        const multiplier = multiplierMatch ? parseFloat(multiplierMatch[1]) : 1
        targetPos = [
          currentPos.x + offset[0] * multiplier,
          currentPos.y + offset[1] * multiplier,
          currentPos.z + offset[2] * multiplier,
        ]
        break
      }
    }
  }

  if (!targetPos) return null

  return {
    toolCalls: [{ toolName: 'transformObject', args: { id, position: targetPos } }],
    summary: `Moved ${obj.name}`,
  }
}

// ---------------------------------------------------------------------------
// ROTATE
// ---------------------------------------------------------------------------
export function parseRotate(text: string, ctx: SceneContext): ParseResult | null {
  if (!/\b(rotate|spin|turn|twist|flip|tilt)\b/i.test(text)) return null

  const objRef = text
    .replace(/\b(rotate|spin|turn|twist|flip|tilt|please|can you)\b/gi, '')
    .trim()

  const id = resolveObjectFromCommand(objRef, ctx)
  if (!id) return null

  const obj = ctx.gameObjects[id]
  if (!obj) return null

  const degrees = parseDegrees(text)
  const angle = degrees ?? 90 // default 90 degrees

  const current = obj.transform.rotation

  // Determine axis
  let rotation: [number, number, number]
  if (/\b(x[-\s]?axis|pitch|forward|backward|tilt)\b/i.test(text)) {
    rotation = [current.x + angle, current.y, current.z]
  } else if (/\b(z[-\s]?axis|roll|sideways)\b/i.test(text)) {
    rotation = [current.x, current.y, current.z + angle]
  } else {
    // Default: Y-axis rotation
    rotation = [current.x, current.y + angle, current.z]
  }

  return {
    toolCalls: [{ toolName: 'transformObject', args: { id, rotation } }],
    summary: `Rotated ${obj.name} by ${angle}°`,
  }
}

// ---------------------------------------------------------------------------
// SCALE / RESIZE
// ---------------------------------------------------------------------------
export function parseScale(text: string, ctx: SceneContext): ParseResult | null {
  if (!/\b(scale|resize|grow|shrink|enlarge|stretch|squish|squash|make\s+(?:it\s+)?(?:bigger|smaller|larger|tiny|huge))\b/i.test(text)) return null

  const objRef = text
    .replace(/\b(scale|resize|grow|shrink|enlarge|stretch|squish|squash|please|can you)\b/gi, '')
    .trim()

  const id = resolveObjectFromCommand(objRef, ctx)
  if (!id) return null

  const obj = ctx.gameObjects[id]
  if (!obj) return null

  const current = obj.transform.scale

  // Check for a size modifier keyword
  for (const [keyword, factor] of Object.entries(SIZE_MAP)) {
    if (new RegExp(`\\b${keyword}\\b`, 'i').test(text)) {
      return {
        toolCalls: [{
          toolName: 'transformObject',
          args: { id, scale: [factor, factor, factor] },
        }],
        summary: `Scaled ${obj.name} to ${keyword}`,
      }
    }
  }

  // Check for numeric factor ("scale by 2", "scale 0.5x")
  const factorMatch = text.match(/(?:by|to|x)\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:x|times)/i)
  if (factorMatch) {
    const factor = parseFloat(factorMatch[1] || factorMatch[2])
    return {
      toolCalls: [{
        toolName: 'transformObject',
        args: { id, scale: [current.x * factor, current.y * factor, current.z * factor] },
      }],
      summary: `Scaled ${obj.name} by ${factor}x`,
    }
  }

  // "make it bigger/smaller" fallback
  if (/\b(bigger|larger|grow|enlarge)\b/i.test(text)) {
    return {
      toolCalls: [{
        toolName: 'transformObject',
        args: { id, scale: [current.x * 1.5, current.y * 1.5, current.z * 1.5] },
      }],
      summary: `Made ${obj.name} bigger`,
    }
  }
  if (/\b(smaller|shrink|tiny)\b/i.test(text)) {
    return {
      toolCalls: [{
        toolName: 'transformObject',
        args: { id, scale: [current.x * 0.5, current.y * 0.5, current.z * 0.5] },
      }],
      summary: `Made ${obj.name} smaller`,
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// COLOR / PAINT
// ---------------------------------------------------------------------------
export function parseColor(text: string, ctx: SceneContext): ParseResult | null {
  if (!/\b(color|colour|paint|tint|dye|recolor|recolour|make\s+(?:it\s+)?(?:\w+)\s+colored?)\b/i.test(text)) return null

  // Find the color
  let color: string | null = null
  for (const word of text.split(/\s+/)) {
    const c = resolveColor(word)
    if (c) { color = c; break }
  }
  if (!color) return null

  // Find the object
  const objRef = text
    .replace(/\b(color|colour|paint|tint|dye|recolor|recolour|please|can you)\b/gi, '')
    .replace(new RegExp(`\\b${text.split(/\s+/).find((w) => resolveColor(w) !== null) ?? ''}\\b`, 'gi'), '')
    .trim()

  const id = resolveObjectFromCommand(objRef, ctx)
  if (!id) return null

  const obj = ctx.gameObjects[id]
  const name = obj?.name ?? id

  return {
    toolCalls: [{ toolName: 'setMaterial', args: { id, color } }],
    summary: `Painted ${name} ${color}`,
  }
}

// ---------------------------------------------------------------------------
// TERRAIN
// ---------------------------------------------------------------------------
export function parseTerrain(text: string, _ctx: SceneContext): ParseResult | null {
  if (!/\b(terrain|landscape|ground|island|land|world)\b/i.test(text)) return null

  // Find biome
  let biome: string = 'grass'
  for (const [keyword, b] of Object.entries(BIOME_MAP)) {
    if (new RegExp(`\\b${keyword}\\b`, 'i').test(text)) {
      biome = b
      break
    }
  }

  const position = parseCoordinates(text) ?? [0, 0, 0]

  // Check for size
  let width = 20
  let depth = 20
  for (const [keyword, factor] of Object.entries(SIZE_MAP)) {
    if (new RegExp(`\\b${keyword}\\b`, 'i').test(text)) {
      width = Math.round(20 * factor)
      depth = Math.round(20 * factor)
      break
    }
  }

  const name = `${biome.charAt(0).toUpperCase() + biome.slice(1)} Terrain`

  return {
    toolCalls: [{
      toolName: 'createTerrain',
      args: {
        name,
        biome,
        position,
        width,
        depth,
        seed: Math.floor(Math.random() * 100000),
      },
    }],
    summary: `Created ${name}`,
  }
}

/** All parsers in priority order. */
export const ALL_PARSERS = [
  parseAdd,
  parseRemove,
  parseMove,
  parseRotate,
  parseScale,
  parseColor,
  parseTerrain,
] as const
