import { tool } from 'ai'
import { z } from 'zod'

export const createPlanTool = tool({
  description:
    'Create a structured plan for a complex request. Use with `todos` (and empty `questions`) when the request is specific enough to produce actionable steps. Use with `questions` (and empty `todos`) when the request is vague and you need clarification first. After calling this tool, STOP and wait — do NOT call addObject or any other scene tools.',
  inputSchema: z.object({
    todos: z
      .array(
        z.object({
          label: z.string().describe('Short description of the task'),
          category: z
            .string()
            .optional()
            .describe('Category prefix (e.g. "World", "Logic", "Items")'),
        })
      )
      .describe('The list of to-do items in execution order'),
    questions: z
      .array(
        z.object({
          text: z.string().describe('The clarifying question to ask the user'),
          placeholder: z
            .string()
            .optional()
            .describe('Placeholder hint for the free-text input'),
          category: z
            .string()
            .optional()
            .describe('Category tab label (e.g. "Scope", "Mechanics", "World", "Style", "Summary")'),
          options: z
            .array(
              z.object({
                label: z.string().describe('Short option title (e.g. "Small (5-8 stages)")'),
                description: z.string().describe('Brief explanation of what this option means'),
              })
            )
            .optional()
            .describe('Selectable option cards for the question'),
        })
      )
      .optional()
      .describe('Clarifying questions to ask when the request is too vague for concrete todos'),
  }),
})

/** Questions-only variant — no `todos` field so the model cannot produce them */
export const createPlanQuestionsTool = tool({
  description:
    'Ask the user clarifying questions before building. Generate 3-5 questions with category tabs and selectable options. Do NOT produce any to-do items — only questions.',
  inputSchema: z.object({
    questions: z
      .array(
        z.object({
          text: z.string().describe('The clarifying question to ask the user'),
          placeholder: z
            .string()
            .optional()
            .describe('Placeholder hint for the free-text input'),
          category: z
            .string()
            .optional()
            .describe('Category tab label (e.g. "Scope", "Mechanics", "World", "Style", "Summary")'),
          options: z
            .array(
              z.object({
                label: z.string().describe('Short option title (e.g. "Small (5-8 stages)")'),
                description: z.string().describe('Brief explanation of what this option means'),
              })
            )
            .optional()
            .describe('Selectable option cards for the question'),
        })
      )
      .describe('Clarifying questions to ask the user — generate 3-5 complete questions'),
  }),
})
