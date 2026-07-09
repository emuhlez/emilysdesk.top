import { useEditorStore } from '../../store/editorStore'
import type { GameObject, TerrainBiome, TerrainData } from '../../types'

export interface CreateTerrainArgs {
  name: string
  width?: number
  depth?: number
  heightScale?: number
  segments?: number
  seed?: number
  octaves?: number
  biome?: TerrainBiome
  position?: [number, number, number]
}

export function executeCreateTerrain(args: CreateTerrainArgs): { id: string; name: string } {
  console.log('[executeCreateTerrain] args:', args)
  const store = useEditorStore.getState()
  const workspaceId = store.rootObjectIds[0]

  if (!workspaceId) {
    throw new Error('No workspace found — cannot add terrain to scene')
  }

  const terrainData: TerrainData = {
    width: args.width ?? 20,
    depth: args.depth ?? 20,
    heightScale: args.heightScale ?? 3,
    segments: args.segments ?? 64,
    seed: args.seed ?? Math.floor(Math.random() * 100000),
    octaves: args.octaves ?? 4,
    biome: args.biome ?? 'grass',
  }

  const [px, py, pz] = args.position ?? [0, 0, 0]

  const updates: Partial<GameObject> = {
    primitiveType: 'terrain',
    terrainData,
    transform: {
      position: { x: px, y: py, z: pz },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    },
  }

  const id = store.createAndConfigureObject('mesh', args.name, workspaceId, updates)
  store.selectObject(id)

  store.log(
    `AI: Created terrain "${args.name}" (${terrainData.biome}, ${terrainData.width}\u00d7${terrainData.depth})`,
    'info',
    'AI Agent',
  )

  return { id, name: args.name }
}
