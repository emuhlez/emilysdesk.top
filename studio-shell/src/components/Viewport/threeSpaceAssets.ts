/**
 * GLB assets from /3d-space (served at /3d-space/ in public)
 */
export const THREE_SPACE_ASSETS = [
  'Bench A.glb',
  'Bench B.glb',
  'Boots.glb',
  'Cobblestones.glb',
  'Doormat.glb',
  'Fence Corner.glb',
  'Fence Open Long.glb',
  'Fence Open Wide Long.glb',
  'Fence Open.glb',
  'Fence Post.glb',
  'Fence Rails Long.glb',
  'Fence Rails.glb',
  'Fence Straight Long.glb',
  'Fence Straight.glb',
  'Fence Wide Long.glb',
  'Floor Base.glb',
  'Foliage A.glb',
  'Foliage B.glb',
  'Gate Double Left.glb',
  'Gate Double Right.glb',
  'Gate Single.glb',
  'House.glb',
  'Letter.glb',
  'Mailbox.glb',
  'Package.glb',
  'Tree Large.glb',
  'Tree.glb',
] as const

export const THREE_SPACE_BASE = '/3d-space/'

export function assetUrl(filename: string): string {
  return `${THREE_SPACE_BASE}${encodeURIComponent(filename)}`
}
