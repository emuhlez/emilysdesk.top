import { create } from 'zustand'
import { v4 as uuid } from 'uuid'
import type { Asset } from '../types'
import { localStorageManager } from './utils/localStorage'

const STORAGE_KEY = 'studio-shell-assets'

interface AssetStore {
  assets: Asset[]
  
  // Actions
  importAssets: (files: File[]) => void
  renameAsset: (id: string, newName: string) => void
  createFolder: (name?: string) => string
  moveAssetToFolder: (assetId: string, targetFolderId: string) => void
  setAssets: (assets: Asset[]) => void
}

const generateAssetId = () => {
  return Math.floor(100000000 + Math.random() * 900000000).toString()
}

const generateDateModified = () => {
  const daysAgo = Math.floor(Math.random() * 30)
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const day = String(date.getDate()).padStart(2, '0')
  const month = months[date.getMonth()]
  const year = date.getFullYear()
  
  return `${day} ${month} ${year}`
}

// Initial demo assets - extracted to separate function to avoid creating on every import
let cachedInitialAssets: Asset[] | null = null

const getInitialAssets = (): Asset[] => {
  if (cachedInitialAssets) return cachedInitialAssets
  
  cachedInitialAssets = [
    { id: uuid(), name: 'Bench A', type: 'model', path: '/3d-space/Bench A.glb', thumbnail: '/thumbnails/Bench-A.png', assetId: generateAssetId(), dateModified: generateDateModified() },
    { id: uuid(), name: 'Bench B', type: 'model', path: '/3d-space/Bench B.glb', thumbnail: '/thumbnails/Bench-B.png', assetId: generateAssetId(), dateModified: generateDateModified() },
    { id: uuid(), name: 'Boots', type: 'model', path: '/3d-space/Boots.glb', thumbnail: '/thumbnails/Boots.png', assetId: generateAssetId(), dateModified: generateDateModified() },
    { id: uuid(), name: 'Cobblestones', type: 'model', path: '/3d-space/Cobblestones.glb', thumbnail: '/thumbnails/Cobblestones.png', assetId: generateAssetId(), dateModified: generateDateModified() },
    { id: uuid(), name: 'Doormat', type: 'model', path: '/3d-space/Doormat.glb', thumbnail: '/thumbnails/Doormat.png', assetId: generateAssetId(), dateModified: generateDateModified() },
    { id: uuid(), name: 'Fence Corner', type: 'model', path: '/3d-space/Fence Corner.glb', thumbnail: '/thumbnails/Fence-Corner.png', assetId: generateAssetId(), dateModified: generateDateModified() },
    { id: uuid(), name: 'Fence Open Long', type: 'model', path: '/3d-space/Fence Open Long.glb', thumbnail: '/thumbnails/Fence-Open-Long.png', assetId: generateAssetId(), dateModified: generateDateModified() },
    { id: uuid(), name: 'Fence Open Wide Long', type: 'model', path: '/3d-space/Fence Open Wide Long.glb', thumbnail: '/thumbnails/Fence-Open-Wide-Long.png', assetId: generateAssetId(), dateModified: generateDateModified() },
    { id: uuid(), name: 'Fence Open', type: 'model', path: '/3d-space/Fence Open.glb', thumbnail: '/thumbnails/Fence-Open.png', assetId: generateAssetId(), dateModified: generateDateModified() },
    { id: uuid(), name: 'Fence Post', type: 'model', path: '/3d-space/Fence Post.glb', thumbnail: '/thumbnails/Fence-Post.png', assetId: generateAssetId(), dateModified: generateDateModified() },
    { id: uuid(), name: 'Fence Rails Long', type: 'model', path: '/3d-space/Fence Rails Long.glb', thumbnail: '/thumbnails/Fence-Rails-Long.png', assetId: generateAssetId(), dateModified: generateDateModified() },
    { id: uuid(), name: 'Fence Rails', type: 'model', path: '/3d-space/Fence Rails.glb', thumbnail: '/thumbnails/Fence-Rails.png', assetId: generateAssetId(), dateModified: generateDateModified() },
    { id: uuid(), name: 'Fence Straight Long', type: 'model', path: '/3d-space/Fence Straight Long.glb', thumbnail: '/thumbnails/Fence-Straight-Long.png', assetId: generateAssetId(), dateModified: generateDateModified() },
    { id: uuid(), name: 'Fence Straight', type: 'model', path: '/3d-space/Fence Straight.glb', thumbnail: '/thumbnails/Fence-Straight.png', assetId: generateAssetId(), dateModified: generateDateModified() },
    { id: uuid(), name: 'Fence Wide Long', type: 'model', path: '/3d-space/Fence Wide Long.glb', thumbnail: '/thumbnails/Fence-Wide-Long.png', assetId: generateAssetId(), dateModified: generateDateModified() },
    { id: uuid(), name: 'Floor Base', type: 'model', path: '/3d-space/Floor Base.glb', thumbnail: '/thumbnails/Floor-Base.png', assetId: generateAssetId(), dateModified: generateDateModified() },
    { id: uuid(), name: 'Foliage A', type: 'model', path: '/3d-space/Foliage A.glb', thumbnail: '/thumbnails/Foliage-A.png', assetId: generateAssetId(), dateModified: generateDateModified() },
    { id: uuid(), name: 'Foliage B', type: 'model', path: '/3d-space/Foliage B.glb', thumbnail: '/thumbnails/Foliage-B.png', assetId: generateAssetId(), dateModified: generateDateModified() },
    { id: uuid(), name: 'Gate Double Left', type: 'model', path: '/3d-space/Gate Double Left.glb', thumbnail: '/thumbnails/Gate-Double-Left.png', assetId: generateAssetId(), dateModified: generateDateModified() },
    { id: uuid(), name: 'Gate Double Right', type: 'model', path: '/3d-space/Gate Double Right.glb', thumbnail: '/thumbnails/Gate-Double-Right.png', assetId: generateAssetId(), dateModified: generateDateModified() },
    { id: uuid(), name: 'Gate Single', type: 'model', path: '/3d-space/Gate Single.glb', thumbnail: '/thumbnails/Gate-Single.png', assetId: generateAssetId(), dateModified: generateDateModified() },
    { id: uuid(), name: 'House', type: 'model', path: '/3d-space/House.glb', thumbnail: '/thumbnails/House.png', assetId: generateAssetId(), dateModified: generateDateModified() },
    { id: uuid(), name: 'Letter', type: 'model', path: '/3d-space/Letter.glb', thumbnail: '/thumbnails/Letter.png', assetId: generateAssetId(), dateModified: generateDateModified() },
    { id: uuid(), name: 'Mailbox', type: 'model', path: '/3d-space/Mailbox.glb', thumbnail: '/thumbnails/Mailbox.png', assetId: generateAssetId(), dateModified: generateDateModified() },
    { id: uuid(), name: 'Package', type: 'model', path: '/3d-space/Package.glb', thumbnail: '/thumbnails/Package.png', assetId: generateAssetId(), dateModified: generateDateModified() },
    { id: uuid(), name: 'Tree Large', type: 'model', path: '/3d-space/Tree Large.glb', thumbnail: '/thumbnails/Tree-Large.png', assetId: generateAssetId(), dateModified: generateDateModified() },
    { id: uuid(), name: 'Tree', type: 'model', path: '/3d-space/Tree.glb', thumbnail: '/thumbnails/Tree.png', assetId: generateAssetId(), dateModified: generateDateModified() },
    {
      id: uuid(),
      name: 'Textures',
      type: 'folder',
      path: '/Textures',
      dateModified: generateDateModified(),
      children: [
        { id: uuid(), name: 'texture_16px 1', type: 'texture', path: '/textures/texture_16px 1.png', thumbnail: '/textures/texture_16px 1.png', assetId: generateAssetId(), dateModified: generateDateModified() },
        { id: uuid(), name: 'texture_16px 2', type: 'texture', path: '/textures/texture_16px 2.png', thumbnail: '/textures/texture_16px 2.png', assetId: generateAssetId(), dateModified: generateDateModified() },
        { id: uuid(), name: 'texture_16px 3', type: 'texture', path: '/textures/texture_16px 3.png', thumbnail: '/textures/texture_16px 3.png', assetId: generateAssetId(), dateModified: generateDateModified() },
        { id: uuid(), name: 'texture_16px 4', type: 'texture', path: '/textures/texture_16px 4.png', thumbnail: '/textures/texture_16px 4.png', assetId: generateAssetId(), dateModified: generateDateModified() },
        { id: uuid(), name: 'texture_16px 5', type: 'texture', path: '/textures/texture_16px 5.png', thumbnail: '/textures/texture_16px 5.png', assetId: generateAssetId(), dateModified: generateDateModified() },
        { id: uuid(), name: 'texture_16px 6', type: 'texture', path: '/textures/texture_16px 6.png', thumbnail: '/textures/texture_16px 6.png', assetId: generateAssetId(), dateModified: generateDateModified() },
        { id: uuid(), name: 'texture_16px 7', type: 'texture', path: '/textures/texture_16px 7.png', thumbnail: '/textures/texture_16px 7.png', assetId: generateAssetId(), dateModified: generateDateModified() },
        { id: uuid(), name: 'texture_16px 8', type: 'texture', path: '/textures/texture_16px 8.png', thumbnail: '/textures/texture_16px 8.png', assetId: generateAssetId(), dateModified: generateDateModified() },
        { id: uuid(), name: 'texture_16px 9', type: 'texture', path: '/textures/texture_16px 9.png', thumbnail: '/textures/texture_16px 9.png', assetId: generateAssetId(), dateModified: generateDateModified() },
        { id: uuid(), name: 'texture_16px 10', type: 'texture', path: '/textures/texture_16px 10.png', thumbnail: '/textures/texture_16px 10.png', assetId: generateAssetId(), dateModified: generateDateModified() },
        { id: uuid(), name: 'texture_16px 11', type: 'texture', path: '/textures/texture_16px 11.png', thumbnail: '/textures/texture_16px 11.png', assetId: generateAssetId(), dateModified: generateDateModified() },
        { id: uuid(), name: 'texture_16px 12', type: 'texture', path: '/textures/texture_16px 12.png', thumbnail: '/textures/texture_16px 12.png', assetId: generateAssetId(), dateModified: generateDateModified() },
        { id: uuid(), name: 'texture_16px 13', type: 'texture', path: '/textures/texture_16px 13.png', thumbnail: '/textures/texture_16px 13.png', assetId: generateAssetId(), dateModified: generateDateModified() },
        { id: uuid(), name: 'texture_16px 14', type: 'texture', path: '/textures/texture_16px 14.png', thumbnail: '/textures/texture_16px 14.png', assetId: generateAssetId(), dateModified: generateDateModified() },
        { id: uuid(), name: 'texture_16px 15', type: 'texture', path: '/textures/texture_16px 15.png', thumbnail: '/textures/texture_16px 15.png', assetId: generateAssetId(), dateModified: generateDateModified() },
        { id: uuid(), name: 'texture_16px 16', type: 'texture', path: '/textures/texture_16px 16.png', thumbnail: '/textures/texture_16px 16.png', assetId: generateAssetId(), dateModified: generateDateModified() },
        { id: uuid(), name: 'texture_16px 17', type: 'texture', path: '/textures/texture_16px 17.png', thumbnail: '/textures/texture_16px 17.png', assetId: generateAssetId(), dateModified: generateDateModified() },
        { id: uuid(), name: 'texture_16px 18', type: 'texture', path: '/textures/texture_16px 18.png', thumbnail: '/textures/texture_16px 18.png', assetId: generateAssetId(), dateModified: generateDateModified() },
        { id: uuid(), name: 'texture_16px 19', type: 'texture', path: '/textures/texture_16px 19.png', thumbnail: '/textures/texture_16px 19.png', assetId: generateAssetId(), dateModified: generateDateModified() },
        { id: uuid(), name: 'texture_16px 20', type: 'texture', path: '/textures/texture_16px 20.png', thumbnail: '/textures/texture_16px 20.png', assetId: generateAssetId(), dateModified: generateDateModified() },
      ],
    },
    {
      id: uuid(),
      name: 'Audio',
      type: 'folder',
      path: '/Audio',
      dateModified: generateDateModified(),
      children: [
        { id: uuid(), name: 'jump.wav', type: 'audio', path: '/Audio/jump.wav', assetId: generateAssetId(), dateModified: generateDateModified() },
        { id: uuid(), name: 'background.mp3', type: 'audio', path: '/Audio/background.mp3', assetId: generateAssetId(), dateModified: generateDateModified() },
      ],
    },
    {
      id: uuid(),
      name: 'Scripts',
      type: 'folder',
      path: '/Scripts',
      dateModified: generateDateModified(),
      children: [
        { id: uuid(), name: 'PlayerController.ts', type: 'script', path: '/Scripts/PlayerController.ts', assetId: generateAssetId(), dateModified: generateDateModified() },
        { id: uuid(), name: 'EnemyAI.ts', type: 'script', path: '/Scripts/EnemyAI.ts', assetId: generateAssetId(), dateModified: generateDateModified() },
      ],
    },
    {
      id: uuid(),
      name: 'Materials',
      type: 'folder',
      path: '/Materials',
      dateModified: generateDateModified(),
      children: [
        { id: uuid(), name: 'Ground.mat', type: 'material', path: '/Materials/Ground.mat', assetId: generateAssetId(), dateModified: generateDateModified() },
      ],
    },
    {
      id: uuid(),
      name: 'Prefabs',
      type: 'folder',
      path: '/Prefabs',
      dateModified: generateDateModified(),
      children: [
        { id: uuid(), name: 'Enemy.prefab', type: 'prefab', path: '/Prefabs/Enemy.prefab', assetId: generateAssetId(), dateModified: generateDateModified() },
        { id: uuid(), name: 'Coin.prefab', type: 'prefab', path: '/Prefabs/Coin.prefab', assetId: generateAssetId(), dateModified: generateDateModified() },
      ],
    },
    {
      id: uuid(),
      name: 'Scenes',
      type: 'folder',
      path: '/Scenes',
      dateModified: generateDateModified(),
      children: [
        { id: uuid(), name: 'MainMenu.scene', type: 'scene', path: '/Scenes/MainMenu.scene', assetId: generateAssetId(), dateModified: generateDateModified() },
        { id: uuid(), name: 'Level1.scene', type: 'scene', path: '/Scenes/Level1.scene', assetId: generateAssetId(), dateModified: generateDateModified() },
      ],
    },
  ]
  
  return cachedInitialAssets
}

const loadSavedAssets = (): Asset[] => {
  return localStorageManager.load<Asset[]>(STORAGE_KEY, getInitialAssets())
}

// Helper to save assets asynchronously with debouncing
const saveAssets = (assets: Asset[]) => {
  localStorageManager.saveLater(STORAGE_KEY, () => assets)
}

export const useAssetStore = create<AssetStore>((set) => ({
  assets: loadSavedAssets(),
  
  importAssets: (files) => {
    const EXCLUDED_EXT = new Set(['.gif', '.pdf'])
    const EXT_TO_TYPE: Record<string, Asset['type']> = {
      '.gltf': 'model', '.glb': 'model', '.fbx': 'model', '.obj': 'model', '.dae': 'model',
      '.mp3': 'audio', '.mp4': 'audio', '.m4a': 'audio', '.wav': 'audio', '.ogg': 'audio', '.aac': 'audio', '.flac': 'audio',
      '.mov': 'video', '.webm': 'video', '.avi': 'video', '.mkv': 'video',
      '.png': 'texture', '.jpg': 'texture', '.jpeg': 'texture', '.webp': 'texture', '.tga': 'texture', '.tif': 'texture', '.tiff': 'texture', '.bmp': 'texture',
      '.js': 'script', '.ts': 'script', '.cjs': 'script', '.mjs': 'script',
      '.mat': 'material',
      '.prefab': 'prefab',
      '.scene': 'scene',
    }
    const TYPE_TO_FOLDER: Record<Asset['type'], string> = {
      texture: 'Sprites', model: 'Models', audio: 'Audio', video: 'Videos',
      script: 'Scripts', material: 'Materials', prefab: 'Prefabs', scene: 'Scenes', folder: 'Sprites', animation: 'Animations',
    }

    const toAdd: { file: File; type: Asset['type'] }[] = []
    for (const file of files) {
      const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '')
      if (EXCLUDED_EXT.has(ext)) continue
      const type = EXT_TO_TYPE[ext]
      if (!type) continue
      toAdd.push({ file, type })
    }
    if (toAdd.length === 0) return

    set((state) => {
      const assets = state.assets.map((a) => ({ ...a, children: a.children ? [...a.children] : [] }))
      const ensureFolder = (name: string): Asset => {
        let folder = assets.find((a) => a.type === 'folder' && a.name === name)
        if (!folder) {
          folder = { id: uuid(), name, type: 'folder', path: `/${name}`, children: [] }
          assets.push(folder)
        }
        return folder
      }

      for (const { file, type } of toAdd) {
        const folderName = TYPE_TO_FOLDER[type]
        const folder = ensureFolder(folderName)
        const path = `${folder.path}/${file.name}`
        const child: Asset = {
          id: uuid(),
          name: file.name,
          type,
          path,
          assetId: generateAssetId(),
          dateModified: generateDateModified(),
        }
        folder.children = [...(folder.children ?? []), child]
      }
      
      // Save asynchronously with debouncing
      saveAssets(assets)
      return { assets }
    })
  },

  renameAsset: (id, newName) => {
    set((state) => {
      const assets = state.assets.map((asset) => {
        // Rename top-level asset
        if (asset.id === id) {
          return { ...asset, name: newName }
        }
        
        // Rename nested asset within folder children
        if (asset.children) {
          const updatedChildren = asset.children.map((child) =>
            child.id === id ? { ...child, name: newName } : child
          )
          return { ...asset, children: updatedChildren }
        }
        
        return asset
      })
      
      // Save asynchronously with debouncing
      saveAssets(assets)
      return { assets }
    })
  },

  createFolder: (name = 'New Folder') => {
    const id = uuid()
    const newFolder: Asset = {
      id,
      name,
      type: 'folder',
      path: `/${name}`,
      children: [],
      dateModified: generateDateModified(),
    }
    
    set((state) => {
      const newAssets = [...state.assets, newFolder]
      // Save asynchronously with debouncing
      saveAssets(newAssets)
      return { assets: newAssets }
    })
    
    return id
  },

  moveAssetToFolder: (assetId, targetFolderId) => {
    set((state) => {
      const assets = state.assets.map(asset => ({ ...asset, children: asset.children ? [...asset.children] : [] }))
      
      // Find the asset to move
      let assetToMove: Asset | undefined
      
      // Check if it's a top-level asset
      const topLevelIndex = assets.findIndex(a => a.id === assetId)
      if (topLevelIndex !== -1) {
        assetToMove = assets[topLevelIndex]
        assets.splice(topLevelIndex, 1)
      } else {
        // Check if it's in a folder's children
        for (const folder of assets) {
          if (folder.children) {
            const childIndex = folder.children.findIndex(c => c.id === assetId)
            if (childIndex !== -1) {
              assetToMove = folder.children[childIndex]
              folder.children.splice(childIndex, 1)
              break
            }
          }
        }
      }
      
      // If asset found, add it to target folder
      if (assetToMove) {
        const targetFolder = assets.find(a => a.id === targetFolderId)
        if (targetFolder && targetFolder.type === 'folder') {
          targetFolder.children = [...(targetFolder.children || []), assetToMove]
        }
      }
      
      // Save asynchronously with debouncing
      saveAssets(assets)
      return { assets }
    })
  },

  setAssets: (assets) => {
    set({ assets })
    saveAssets(assets)
  },
}))
