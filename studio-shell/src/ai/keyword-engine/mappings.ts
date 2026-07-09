import type { TerrainBiome } from '../../types'

// --- Primitive shape mappings ---
export const PRIMITIVE_MAP: Record<string, string> = {
  cube: 'box',
  box: 'box',
  block: 'box',
  sphere: 'sphere',
  ball: 'sphere',
  orb: 'sphere',
  cylinder: 'cylinder',
  pillar: 'box',
  column: 'box',
  tube: 'cylinder',
  cone: 'cone',
  pyramid: 'cone',
  torus: 'torus',
  ring: 'torus',
  donut: 'torus',
  doughnut: 'torus',
  plane: 'plane',
  floor: 'plane',
  platform: 'plane',
  ground: 'plane',
  slab: 'box',
  wall: 'box',
  beam: 'box',
  post: 'box',
  pole: 'box',
  disc: 'cylinder',
  disk: 'cylinder',
}

// --- Color name → hex ---
export const COLOR_MAP: Record<string, string> = {
  red: '#ff0000',
  green: '#00ff00',
  blue: '#0000ff',
  yellow: '#ffff00',
  orange: '#ff8800',
  purple: '#8800ff',
  violet: '#8800ff',
  pink: '#ff69b4',
  cyan: '#00ffff',
  aqua: '#00ffff',
  teal: '#008080',
  magenta: '#ff00ff',
  white: '#ffffff',
  black: '#000000',
  gray: '#808080',
  grey: '#808080',
  brown: '#8b4513',
  tan: '#d2b48c',
  beige: '#f5f5dc',
  maroon: '#800000',
  navy: '#000080',
  olive: '#808000',
  lime: '#00ff00',
  coral: '#ff7f50',
  salmon: '#fa8072',
  gold: '#ffd700',
  silver: '#c0c0c0',
  crimson: '#dc143c',
  indigo: '#4b0082',
  turquoise: '#40e0d0',
  lavender: '#e6e6fa',
  ivory: '#fffff0',
  charcoal: '#333333',
  slate: '#708090',
  khaki: '#f0e68c',
  sand: '#c2b280',
  wood: '#8b6914',
  wooden: '#8b6914',
  stone: '#808080',
  brick: '#cb4154',
  metal: '#aaaaaa',
  steel: '#71797e',
  rust: '#b7410e',
  sky: '#87ceeb',
  grass: '#228b22',
  forest: '#228b22',
  ocean: '#006994',
  ice: '#a5f2f3',
  lava: '#cf1020',
  fire: '#ff4500',
  copper: '#b87333',
  bronze: '#cd7f32',
  amber: '#ffbf00',
  peach: '#ffcba4',
  mint: '#98ff98',
  rose: '#ff007f',
  scarlet: '#ff2400',
}

/** Resolve a color string — named color, hex passthrough, or null. */
export function resolveColor(input: string): string | null {
  const lower = input.toLowerCase().trim()
  if (COLOR_MAP[lower]) return COLOR_MAP[lower]
  // Hex passthrough (#abc, #aabbcc)
  if (/^#[0-9a-f]{3,8}$/i.test(lower)) return lower
  return null
}

// --- Size modifiers ---
export const SIZE_MAP: Record<string, number> = {
  tiny: 0.3,
  small: 0.5,
  little: 0.5,
  medium: 1,
  normal: 1,
  big: 2,
  large: 2,
  huge: 3,
  giant: 4,
  massive: 5,
  enormous: 5,
  tall: 2,    // applies to Y scale
  short: 0.5, // applies to Y scale
  wide: 2,    // applies to X scale
  narrow: 0.5, // applies to X scale
  thin: 0.3,
  thick: 2,
  flat: 0.2,
}

// --- Direction / position offsets ---
export const DIRECTION_MAP: Record<string, [number, number, number]> = {
  left: [-2, 0, 0],
  right: [2, 0, 0],
  up: [0, 2, 0],
  down: [0, -2, 0],
  forward: [0, 0, -2],
  forwards: [0, 0, -2],
  front: [0, 0, -2],
  backward: [0, 0, 2],
  backwards: [0, 0, 2],
  back: [0, 0, 2],
  behind: [0, 0, 2],
  above: [0, 2, 0],
  below: [0, -2, 0],
  north: [0, 0, -2],
  south: [0, 0, 2],
  east: [2, 0, 0],
  west: [-2, 0, 0],
  center: [0, 0, 0],
  origin: [0, 0, 0],
  here: [0, 0, 0],
  nearby: [1, 0, 1],
  'far left': [-5, 0, 0],
  'far right': [5, 0, 0],
  'far away': [0, 0, -10],
  high: [0, 5, 0],
  'way up': [0, 8, 0],
}

// --- Biome keywords ---
export const BIOME_MAP: Record<string, TerrainBiome> = {
  grass: 'grass',
  grassy: 'grass',
  grassland: 'grass',
  meadow: 'grass',
  field: 'grass',
  green: 'grass',
  plains: 'grass',
  desert: 'desert',
  sandy: 'desert',
  sand: 'desert',
  dune: 'desert',
  dunes: 'desert',
  arid: 'desert',
  dry: 'desert',
  snow: 'snow',
  snowy: 'snow',
  winter: 'snow',
  ice: 'snow',
  icy: 'snow',
  frozen: 'snow',
  arctic: 'snow',
  tundra: 'snow',
  rock: 'rocky',
  rocky: 'rocky',
  mountain: 'rocky',
  mountainous: 'rocky',
  cliff: 'rocky',
  stone: 'rocky',
  volcanic: 'volcanic',
  volcano: 'volcanic',
  lava: 'volcanic',
  magma: 'volcanic',
  fire: 'volcanic',
  hell: 'volcanic',
  inferno: 'volcanic',
}

/** Extract a coordinate triple from text like "at 1 2 3" or "at (1, 2, 3)". */
export function parseCoordinates(text: string): [number, number, number] | null {
  // Match patterns like: at 1 2 3, at (1, 2, 3), at 1,2,3, position 1 2 3
  const match = text.match(/(?:at|position|pos|to|@)\s*\(?\s*(-?[\d.]+)[,\s]+(-?[\d.]+)[,\s]+(-?[\d.]+)\s*\)?/)
  if (match) {
    return [parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3])]
  }
  return null
}

/** Extract a single numeric value from text. */
export function parseNumber(text: string): number | null {
  const match = text.match(/(-?[\d.]+)/)
  return match ? parseFloat(match[1]) : null
}

/** Extract degrees from text like "90 degrees", "by 45". */
export function parseDegrees(text: string): number | null {
  const match = text.match(/(-?[\d.]+)\s*(?:deg(?:rees?)?|°)?/)
  return match ? parseFloat(match[1]) : null
}
