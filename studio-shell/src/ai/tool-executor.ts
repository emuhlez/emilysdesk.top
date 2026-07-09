import { executeAddObject, type AddObjectArgs } from './tools/add-object'
import { executeRemoveObject, type RemoveObjectArgs } from './tools/remove-object'
import { executeTransformObject, type TransformObjectArgs } from './tools/transform-object'
import { executeSetMaterial, type SetMaterialArgs } from './tools/set-material'
import { executeCreateTerrain, type CreateTerrainArgs } from './tools/create-terrain'
import { executeGenerateMesh, type GenerateMeshArgs } from './tools/generate-mesh'
import { usePlanStore } from '../store/planStore'
import type { PlanTodo, PlanQuestion } from '../types'

interface CreatePlanArgs {
  todos: PlanTodo[]
  questions?: PlanQuestion[]
  prompt?: string
}

export function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  toolCallId?: string,
): unknown {
  switch (toolName) {
    case 'addObject':
      return executeAddObject(args as unknown as AddObjectArgs)
    case 'removeObject':
      return executeRemoveObject(args as unknown as RemoveObjectArgs)
    case 'transformObject':
      return executeTransformObject(args as unknown as TransformObjectArgs)
    case 'setMaterial':
      return executeSetMaterial(args as unknown as SetMaterialArgs)
    case 'createTerrain':
      return executeCreateTerrain(args as unknown as CreateTerrainArgs)
    case 'createPlan': {
      const planArgs = args as unknown as CreatePlanArgs
      const id = toolCallId || `plan-${Date.now()}`
      const hasQuestions = (planArgs.questions?.length ?? 0) > 0
      usePlanStore.getState().setPlan(id, {
        todos: planArgs.todos,
        questions: planArgs.questions,
        prompt: planArgs.prompt,
      })
      if (hasQuestions) {
        return { status: 'questions_asked', questionCount: planArgs.questions!.length }
      }
      return { status: 'plan_created', todoCount: planArgs.todos.length }
    }
    case 'generateMesh':
      return executeGenerateMesh(args as unknown as GenerateMeshArgs)
    default:
      return { error: `Unknown tool: ${toolName}` }
  }
}
