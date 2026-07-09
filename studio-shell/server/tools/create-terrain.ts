import { tool } from 'ai'
import { z } from 'zod'

export const createTerrainTool = tool({
  description:
    'Create a procedural terrain mesh with heightmap-based hills/mountains and biome-based vertex coloring. Returns the created object\'s ID and name.',
  inputSchema: z.object({
    name: z
      .string()
      .describe("Display name for the terrain (e.g., 'Rolling Hills', 'Volcanic Island')"),
    width: z
      .number()
      .min(5)
      .max(100)
      .default(20)
      .describe('Terrain width in world units (X axis). Default 20.'),
    depth: z
      .number()
      .min(5)
      .max(100)
      .default(20)
      .describe('Terrain depth in world units (Z axis). Default 20.'),
    heightScale: z
      .number()
      .min(0.1)
      .max(20)
      .default(3)
      .describe('Maximum height of terrain peaks. 1-3 for gentle hills, 5-10 for mountains, 10-20 for dramatic peaks. Default 3.'),
    segments: z
      .number()
      .int()
      .min(16)
      .max(128)
      .default(64)
      .describe('Grid resolution (vertices per side). Higher = smoother but heavier. Default 64.'),
    seed: z
      .number()
      .int()
      .optional()
      .describe('Random seed for deterministic generation. Omit for random.'),
    octaves: z
      .number()
      .int()
      .min(1)
      .max(6)
      .default(4)
      .describe('Noise detail layers. 1 = smooth blobs, 4 = natural, 6 = very detailed. Default 4.'),
    biome: z
      .enum(['grass', 'desert', 'snow', 'rocky', 'volcanic'])
      .default('grass')
      .describe('Color theme: grass (green valleys), desert (sandy dunes), snow (white peaks), rocky (gray stone), volcanic (dark with lava). Default grass.'),
    position: z
      .tuple([z.number(), z.number(), z.number()])
      .optional()
      .describe('World position [x, y, z]. Default is [0, 0, 0].'),
  }),
})
