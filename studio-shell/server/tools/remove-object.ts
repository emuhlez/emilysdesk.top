import { tool } from 'ai'
import { z } from 'zod'

export const removeObjectTool = tool({
  description: 'Remove an object from the scene by its ID.',
  inputSchema: z.object({
    id: z.string().describe('The ID of the object to remove'),
  }),
})
