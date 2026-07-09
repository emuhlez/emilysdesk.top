import { useEditorStore } from '../../store/editorStore'
import type { GameObject } from '../../types'

export interface AddObjectArgs {
  name: string
  primitive: string
  position?: [number, number, number]
  rotation?: [number, number, number]
  scale?: [number, number, number]
  color?: string
  metalness?: number
  roughness?: number
}

export function executeAddObject(args: AddObjectArgs): { id: string; name: string } {
  console.log('[executeAddObject] args:', args)
  const store = useEditorStore.getState()
  const workspaceId = store.rootObjectIds[0]

  if (!workspaceId) {
    throw new Error('No workspace found — cannot add object to scene')
  }

  const updates: Partial<GameObject> = {
    primitiveType: args.primitive as GameObject['primitiveType'],
  }

  const [px, py, pz] = args.position ?? [0, 0, 0]
  const [rx, ry, rz] = args.rotation ?? [0, 0, 0]
  const [sx, sy, sz] = args.scale ?? [1, 1, 1]

  updates.transform = {
    position: { x: px, y: py, z: pz },
    rotation: { x: rx, y: ry, z: rz },
    scale: { x: sx, y: sy, z: sz },
  }

  if (args.color) updates.color = args.color
  if (args.metalness !== undefined) updates.reflectance = args.metalness
  if (args.roughness !== undefined) updates.roughness = args.roughness

  const id = store.createAndConfigureObject('mesh', args.name, workspaceId, updates)
  store.selectObject(id)
  store.log(`AI: Created "${args.name}" (${args.primitive})`, 'info', 'AI Agent')

  return { id, name: args.name }
}
