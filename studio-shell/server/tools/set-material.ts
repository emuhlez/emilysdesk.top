import { tool } from 'ai'
import { z } from 'zod'

export const setMaterialTool = tool({
  description:
    'Update material properties (color, metalness, roughness, etc.) of an existing object.',
  inputSchema: z.object({
    id: z.string().describe('The ID of the object to update'),
    color: z.string().optional().describe('Hex color string'),
    metalness: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe('Metalness factor 0-1 (maps to reflectance)'),
    roughness: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe('Roughness factor 0-1'),
    opacity: z
      .number()
      .min(0)
      .max(1)
      .optional()
      .describe('Opacity 0-1 (1 = fully opaque)'),
  }),
})
