import { toolRegistry } from './registry'
import { addObjectTool } from './add-object'
import { removeObjectTool } from './remove-object'
import { transformObjectTool } from './transform-object'
import { setMaterialTool } from './set-material'
import { createPlanTool } from './create-plan'
import { createTerrainTool } from './create-terrain'

toolRegistry.register('addObject', addObjectTool)
toolRegistry.register('removeObject', removeObjectTool)
toolRegistry.register('transformObject', transformObjectTool)
toolRegistry.register('setMaterial', setMaterialTool)
toolRegistry.register('createPlan', createPlanTool)
toolRegistry.register('createTerrain', createTerrainTool)

export { toolRegistry }
