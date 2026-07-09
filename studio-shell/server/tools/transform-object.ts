import { tool } from 'ai'
import { z } from 'zod'

export const transformObjectTool = tool({
  description:
    'Change the position, rotation, or scale of an existing object.',
  inputSchema: z.object({
    id: z.string().describe('The ID of the object to transform'),
    position: z
      .tuple([z.number(), z.number(), z.number()])
      .optional()
      .describe('New world position [x, y, z]'),
    rotation: z
      .tuple([z.number(), z.number(), z.number()])
      .optional()
      .describe('New rotation in degrees [x, y, z]'),
    scale: z
      .tuple([z.number(), z.number(), z.number()])
      .optional()
      .describe('New scale [x, y, z]'),
  }),
})
