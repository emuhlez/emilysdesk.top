import { create } from 'zustand'

export interface NoteItem {
  id: string
  folderId: string
  title: string
  body: string // HTML string
  createdAt: number
  updatedAt: number
}

export interface Folder {
  id: string
  name: string
  isExpanded: boolean
}

interface NotesState {
  folders: Folder[]
  notes: NoteItem[]
  selectedNoteId: string | null
  selectedFolderId: string
  searchQuery: string

  selectNote: (id: string | null) => void
  selectFolder: (id: string) => void
  setSearchQuery: (q: string) => void
  createNote: () => void
  updateNote: (id: string, patch: Partial<Pick<NoteItem, 'title' | 'body'>>) => void
  deleteNote: (id: string) => void
  toggleFolderExpanded: (id: string) => void
}

const STORAGE_KEY = 'notes-app-data'
const SEEDED_TITLES_KEY = 'notes-app-seeded-titles'
const DEBOUNCE_MS = 400

let saveTimer: ReturnType<typeof setTimeout> | null = null

function persist(state: { folders: Folder[]; notes: NoteItem[] }) {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ folders: state.folders, notes: state.notes }))
    } catch { /* quota exceeded – silently ignore */ }
  }, DEBOUNCE_MS)
}

function loadFromStorage(): { folders: Folder[]; notes: NoteItem[] } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (Array.isArray(data.folders) && Array.isArray(data.notes)) return data
  } catch { /* corrupted – ignore */ }
  return null
}

function loadSeededTitles(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEDED_TITLES_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) return new Set(arr)
  } catch { /* ignore */ }
  return new Set()
}

function saveSeededTitles(titles: Set<string>) {
  try {
    localStorage.setItem(SEEDED_TITLES_KEY, JSON.stringify([...titles]))
  } catch { /* ignore */ }
}

const DEFAULT_FOLDERS: Folder[] = [
  { id: 'personal', name: 'Personal', isExpanded: true },
  { id: 'work', name: 'Work', isExpanded: true },
  { id: 'ideas', name: 'Ideas', isExpanded: true },
]

function makeId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

const now = Date.now()

const DEFAULT_NOTES: NoteItem[] = [
  {
    id: makeId(),
    folderId: 'personal',
    title: 'welcome to my desktop',
    body: `<h1>welcome to my desktop</h1><p>I was fortunate to study at an Apple distinguished school for elementary and junior high school. It was here that I learned how to edit videos for book reports, tinkered with robots before I could operate a car, and realized that the rule of thirds always makes for interesting photo composition.</p><p>This technical knowledge coupled with my showmanship was and still continues to be a reflection of my craft. I\u2019m a hands-on designer and the best work happens when I create, entertain, fail, and create again until I succeed.</p><p>Currently at Roblox building AI tools for creators, asset management tooling, and a bunch of other cool things.</p><p>In my free time, I run marathons, create with my hands, study fashion and pop culture trends, and watch a bunch of movies to fill my Letterboxd.</p>`,
    createdAt: now - 86400000 * 3,
    updatedAt: now - 86400000 * 3,
  },
  {
    id: makeId(),
    folderId: 'personal',
    title: 'my history',
    body: `<h1>my history</h1><p class="section-header">My education</p><p>Fight on. I graduated with my BA in Communication at Annenberg and my MS in Production Innovation at Jimmy Iovine and Dr Dre\u2019s Academy.</p><p class="section-header">My values</p><p>Fail fast and often.<br>Practice makes permanent.</p><p class="section-header">My work</p><p>Roblox<br>2022\u2013Present</p><p>I design for Roblox\u2019s Assistant and asset creation/management tools. I previously led design for Asset Privacy, Creator Store, and Music.</p><p>In my time at Roblox, I have been a champion of vibe coding and empowering designers to strengthen their storytelling capabilities through delightful, interactive prototypes.</p><p>I love being in the weeds of building and creating something awesome for creators.</p>`,
    createdAt: now - 86400000 * 4,
    updatedAt: now - 86400000 * 4,
  },
  {
    id: makeId(),
    folderId: 'personal',
    title: 'about this site',
    body: `<h1>about this site</h1><p>Hi! I'm Emily and I built this to be a 1 to 1 reflection of my laptop.</p><p>I live by director Bong Joon Ho\u2019s favorite quote by Martin Scorsese, \u201CThe most personal is the most creative.\u201D I am a believer that our devices are the most personal, unique things about us and I wanted to share something personal about me with you. Take a peek into my brain and things I\u2019ve built with collaborators.</p><p></p><p>I am so glad that you\u2019re here. Poke around :)</p>`,
    createdAt: now - 86400000 * 2,
    updatedAt: now - 86400000 * 2,
  },
]

function getInitialData() {
  const stored = loadFromStorage()
  if (!stored) {
    saveSeededTitles(new Set(DEFAULT_NOTES.map((n) => n.title)))
    return { folders: DEFAULT_FOLDERS, notes: DEFAULT_NOTES }
  }

  // Returning user: backfill any newly-seeded notes (by title) they've never seen.
  // Won't re-add notes the user has explicitly deleted from a previous seed.
  const seenSeededTitles = loadSeededTitles()
  const existingTitles = new Set(stored.notes.map((n) => n.title))
  const toAdd = DEFAULT_NOTES.filter(
    (n) => !seenSeededTitles.has(n.title) && !existingTitles.has(n.title),
  )

  if (toAdd.length > 0) {
    const merged = [...stored.notes, ...toAdd]
    const allSeenTitles = new Set([...seenSeededTitles, ...DEFAULT_NOTES.map((n) => n.title)])
    saveSeededTitles(allSeenTitles)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ folders: stored.folders, notes: merged }))
    } catch { /* ignore */ }
    return { folders: stored.folders, notes: merged }
  }

  return stored
}

export const useNotesStore = create<NotesState>((set, get) => {
  const initial = getInitialData()

  return {
    folders: initial.folders,
    notes: initial.notes,
    selectedNoteId: initial.notes.length > 0 ? initial.notes[initial.notes.length - 1].id : null,
    selectedFolderId: 'personal',
    searchQuery: '',

    selectNote: (id) => set({ selectedNoteId: id }),

    selectFolder: (id) => {
      const { notes } = get()
      const filtered = notes.filter((n) => n.folderId === id)
      const sorted = [...filtered].sort((a, b) => b.updatedAt - a.updatedAt)
      set({ selectedFolderId: id, selectedNoteId: sorted[0]?.id ?? null, searchQuery: '' })
    },

    setSearchQuery: (q) => set({ searchQuery: q }),

    createNote: () => {
      const { notes, selectedFolderId, folders } = get()
      const folderId = selectedFolderId || (folders[0]?.id ?? 'personal')
      const newNote: NoteItem = {
        id: makeId(),
        folderId,
        title: 'New Note',
        body: '<h1>New Note</h1><p></p>',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      const updated = [newNote, ...notes]
      set({ notes: updated, selectedNoteId: newNote.id })
      persist({ folders: get().folders, notes: updated })
    },

    updateNote: (id, patch) => {
      const { notes } = get()
      const updated = notes.map((n) =>
        n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n,
      )
      set({ notes: updated })
      persist({ folders: get().folders, notes: updated })
    },

    deleteNote: (id) => {
      const { notes, selectedNoteId, selectedFolderId } = get()
      const updated = notes.filter((n) => n.id !== id)
      let nextSelected = selectedNoteId
      if (selectedNoteId === id) {
        const filtered = updated.filter((n) => n.folderId === selectedFolderId)
        const sorted = [...filtered].sort((a, b) => b.updatedAt - a.updatedAt)
        nextSelected = sorted[0]?.id ?? null
      }
      set({ notes: updated, selectedNoteId: nextSelected })
      persist({ folders: get().folders, notes: updated })
    },

    toggleFolderExpanded: (id) => {
      const { folders } = get()
      const updated = folders.map((f) => (f.id === id ? { ...f, isExpanded: !f.isExpanded } : f))
      set({ folders: updated })
      persist({ folders: updated, notes: get().notes })
    },
  }
})
