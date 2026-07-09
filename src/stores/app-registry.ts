import type { ComponentType } from 'react'
import finderIconUrl from '../../dock icons/Finder.svg?url'
import arcIconUrl from '../../dock icons/Arc.svg?url'
import robloxStudioIconUrl from '../../dock icons/Roblox Studio.svg?url'
import figmaIconUrl from '../../dock icons/Figma.svg?url'
import notesIconUrl from '../../dock icons/Notes.svg?url'
import photosIconUrl from '../../dock icons/Photos.svg?url'
import messagesIconUrl from '../../dock icons/Messages.svg?url'
import trashIconUrl from '../../dock icons/Trash.svg?url'
import { ArcWindow } from '../features/arc/ArcWindow'
import { NotesWindow } from '../features/notes/NotesWindow'
import { PhotosWindow } from '../features/photos/PhotosWindow'
import { RobloxStudioWindow } from '../features/roblox-studio/RobloxStudioWindow'

export interface AppDefinition {
  id: string
  name: string
  menuItems: string[]
  iconUrl: string
  windowComponent?: ComponentType<{ onFocus: () => void; zIndex: number }>
}

export const APP_REGISTRY: Record<string, AppDefinition> = {
  finder: {
    id: 'finder',
    name: 'Finder',
    menuItems: ['File', 'Edit', 'View', 'Go', 'Window', 'Help'],
    iconUrl: finderIconUrl,
  },
  arc: {
    id: 'arc',
    name: 'Arc',
    menuItems: ['File', 'Edit', 'View', 'History', 'Bookmarks', 'Tab', 'Window', 'Help'],
    iconUrl: arcIconUrl,
    windowComponent: ArcWindow,
  },
  'roblox-studio': {
    id: 'roblox-studio',
    name: 'Roblox Studio',
    menuItems: ['File', 'Edit', 'View', 'Insert', 'Model', 'Test', 'Plugins'],
    iconUrl: robloxStudioIconUrl,
    windowComponent: RobloxStudioWindow,
  },
  figma: {
    id: 'figma',
    name: 'Figma',
    menuItems: ['File', 'Edit', 'View', 'Object', 'Vector', 'Text', 'Arrange', 'Plugins'],
    iconUrl: figmaIconUrl,
  },
  notes: {
    id: 'notes',
    name: 'Notes',
    menuItems: ['File', 'Edit', 'Format', 'View', 'Window', 'Help'],
    iconUrl: notesIconUrl,
    windowComponent: NotesWindow,
  },
  photos: {
    id: 'photos',
    name: 'Photos',
    menuItems: ['File', 'Edit', 'Image', 'View', 'Window', 'Help'],
    iconUrl: photosIconUrl,
    windowComponent: PhotosWindow,
  },
  messages: {
    id: 'messages',
    name: 'Messages',
    menuItems: ['File', 'Edit', 'View', 'Conversation', 'Window', 'Help'],
    iconUrl: messagesIconUrl,
  },
  trash: {
    id: 'trash',
    name: 'Trash',
    menuItems: [],
    iconUrl: trashIconUrl,
  },
}

/** Ordered list of app IDs for dock rendering (excluding trash, which is after the divider).
 *
 *  `figma` and `messages` are intentionally hidden until their app surfaces
 *  are built. Their registry entries + icon imports are kept above so
 *  re-enabling is a one-line revert: add `'figma'` between `roblox-studio`
 *  and `notes`, and `'messages'` after `photos`, to restore the original
 *  order. */
export const DOCK_ORDER: string[] = [
  'finder',
  'arc',
  'roblox-studio',
  'notes',
  'photos',
]
