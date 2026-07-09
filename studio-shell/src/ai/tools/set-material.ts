import { useEditorStore } from '../../store/editorStore'
import type { GameObject } from '../../types'

export interface SetMaterialArgs {
  id: string
  color?: string
  metalness?: number
  roughness?: number
  opacity?: number
}

export function executeSetMaterial(args: SetMaterialArgs): { updated: boolean; id: string } {
  const store = useEditorStore.getState()
  const obj = store.gameObjects[args.id]

  if (!obj) {
    store.log(`AI: Object not found (id: ${args.id})`, 'warning', 'AI Agent')
    return { updated: false, id: args.id }
  }

  const updates: Partial<GameObject> = {}
  if (args.color !== undefined) updates.color = args.color
  if (args.metalness !== undefined) updates.reflectance = args.metalness
  if (args.roughness !== undefined) updates.roughness = args.roughness
  if (args.opacity !== undefined) updates.transparency = 1 - args.opacity

  store.updateGameObject(args.id, updates)
  store.selectObject(args.id)

  const changes: string[] = []
  if (args.color !== undefined) changes.push(`color=${args.color}`)
  if (args.metalness !== undefined) changes.push(`reflectance=${args.metalness}`)
  if (args.roughness !== undefined) changes.push(`roughness=${args.roughness}`)
  if (args.opacity !== undefined) changes.push(`opacity=${args.opacity}`)
  store.log(`AI: Updated material on "${obj.name}" (${changes.join(', ')})`, 'info', 'AI Agent')

  return { updated: true, id: args.id }
}
