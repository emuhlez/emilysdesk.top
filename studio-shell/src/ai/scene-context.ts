import type { GameObject } from '../types'

export interface CameraInfo {
  position: { x: number; y: number; z: number }
  target: { x: number; y: number; z: number }
  fov: number
}

export function serializeCameraContext(camera: CameraInfo): string {
  const { position, target, fov } = camera
  return [
    `Camera position: [${position.x}, ${position.y}, ${position.z}]`,
    `Camera target: [${target.x}, ${target.y}, ${target.z}]`,
    `Field of view: ${fov}°`,
    `The camera is looking from this position toward the target. Use this to understand the user's viewpoint when interpreting spatial instructions.`,
  ].join('\n')
}

export function serializeSceneContext(
  gameObjects: Record<string, GameObject>,
  _rootObjectIds: string[]
): string {
  // Only include visible objects — hidden objects should not be referenced by the AI
  const allObjects = Object.values(gameObjects).filter((obj) => obj.visible !== false)

  if (allObjects.length === 0) {
    return 'The scene is currently empty.'
  }

  const descriptions = allObjects.map((obj) => {
    const parts = [`- "${obj.name}" (id: ${obj.id}, type: ${obj.type})`]
    const pos = obj.transform.position
    const scl = obj.transform.scale
    parts.push(`  position: [${pos.x}, ${pos.y}, ${pos.z}]`)
    parts.push(`  scale: [${scl.x}, ${scl.y}, ${scl.z}]`)

    if (obj.color) {
      parts.push(`  color: ${obj.color}`)
    }
    if (obj.transparency !== undefined) {
      parts.push(`  transparency: ${obj.transparency}`)
    }
    if (obj.reflectance !== undefined) {
      parts.push(`  reflectance: ${obj.reflectance}`)
    }
    if (obj.primitiveType) {
      parts.push(`  primitive: ${obj.primitiveType}`)
    }
    if (obj.terrainData) {
      const td = obj.terrainData
      parts.push(`  terrain: ${td.width}×${td.depth}, height ${td.heightScale}, biome ${td.biome}, seed ${td.seed}`)
    }

    return parts.join('\n')
  })

  return `Current scene objects (${allObjects.length}):\n${descriptions.join('\n')}`
}

export function serializeSelectionContext(
  gameObjects: Record<string, GameObject>,
  selectedObjectIds: string[]
): string | undefined {
  if (selectedObjectIds.length === 0) return undefined

  const descriptions = selectedObjectIds
    .map((id) => {
      const obj = gameObjects[id]
      if (!obj) return null
      const pos = obj.transform.position
      const scl = obj.transform.scale
      const parts = [`- "${obj.name}" (id: ${obj.id}, type: ${obj.type})`]
      parts.push(`  position: [${pos.x}, ${pos.y}, ${pos.z}]`)
      parts.push(`  scale: [${scl.x}, ${scl.y}, ${scl.z}]`)
      if (obj.color) parts.push(`  color: ${obj.color}`)
      if (obj.primitiveType) parts.push(`  primitive: ${obj.primitiveType}`)
      return parts.join('\n')
    })
    .filter(Boolean)

  if (descriptions.length === 0) return undefined

  return `${descriptions.length} object(s) selected:\n${descriptions.join('\n')}`
}
