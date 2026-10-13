import { create } from 'zustand'

export interface ChatMessage {
  id: string
  /** true = Emily (right / blue iMessage bubble) */
  fromMe: boolean
  text: string
  sentAt: number
}

export interface Conversation {
  id: string
  name: string
  /** Short initials for the avatar chip when no photo */
  initials: string
  /** Soft avatar fill */
  avatarColor: string
  messages: ChatMessage[]
}

interface MessagesState {
  conversations: Conversation[]
  selectedId: string | null
  searchQuery: string
  draft: string

  selectConversation: (id: string | null) => void
  setSearchQuery: (q: string) => void
  setDraft: (text: string) => void
  sendDraft: () => void
}

const STORAGE_KEY = 'messages-app-data'
const DEBOUNCE_MS = 400

let saveTimer: ReturnType<typeof setTimeout> | null = null

function persist(conversations: Conversation[]) {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ conversations }))
    } catch {
      /* quota – ignore */
    }
  }, DEBOUNCE_MS)
}

function loadFromStorage(): Conversation[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (Array.isArray(data.conversations)) return data.conversations
  } catch {
    /* corrupted */
  }
  return null
}

function makeId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

const now = Date.now()
const h = 3_600_000
const d = 86_400_000

const DEFAULT_CONVERSATIONS: Conversation[] = [
  {
    id: 'mom',
    name: 'Mom',
    initials: 'M',
    avatarColor: '#AF52DE',
    messages: [
      {
        id: makeId(),
        fromMe: false,
        text: 'Did you eat today?',
        sentAt: now - d * 2 - h * 3,
      },
      {
        id: makeId(),
        fromMe: true,
        text: 'yes mom 😭 i had a smoothie and then three espressos',
        sentAt: now - d * 2 - h * 2,
      },
      {
        id: makeId(),
        fromMe: false,
        text: 'That is not food Emily.',
        sentAt: now - d * 2 - h,
      },
      {
        id: makeId(),
        fromMe: true,
        text: 'it has protein powder!!',
        sentAt: now - d * 2 - h * 0.5,
      },
    ],
  },
  {
    id: 'roblox-design',
    name: 'Roblox Design',
    initials: 'RD',
    avatarColor: '#0A84FF',
    messages: [
      {
        id: makeId(),
        fromMe: false,
        text: 'Can you poke at the Assistant empty state before standup?',
        sentAt: now - d - h * 5,
      },
      {
        id: makeId(),
        fromMe: true,
        text: 'already in a branch — shipping the softer empty copy + the sparkle glyph',
        sentAt: now - d - h * 4,
      },
      {
        id: makeId(),
        fromMe: false,
        text: 'chef kiss. drop the loom when you can',
        sentAt: now - d - h * 3,
      },
    ],
  },
  {
    id: 'bestie',
    name: 'Ava',
    initials: 'A',
    avatarColor: '#FF2D55',
    messages: [
      {
        id: makeId(),
        fromMe: false,
        text: 'are we still on for a run saturday??',
        sentAt: now - h * 6,
      },
      {
        id: makeId(),
        fromMe: true,
        text: 'yes — 8am lake loop. i will only be 7 minutes late this time',
        sentAt: now - h * 5,
      },
      {
        id: makeId(),
        fromMe: false,
        text: 'lying but noted 🫡',
        sentAt: now - h * 4,
      },
      {
        id: makeId(),
        fromMe: true,
        text: 'bring the playlist that slapped last time',
        sentAt: now - h * 2,
      },
    ],
  },
  {
    id: 'cursor',
    name: 'Cursor',
    initials: 'C',
    avatarColor: '#30D158',
    messages: [
      {
        id: makeId(),
        fromMe: true,
        text: 'ok build me a Messages app that feels like Tahoe',
        sentAt: now - h,
      },
      {
        id: makeId(),
        fromMe: false,
        text: 'on it — Liquid Glass chrome, conversation list, iMessage bubbles.',
        sentAt: now - h * 0.5,
      },
    ],
  },
]

function getInitialData(): { conversations: Conversation[]; selectedId: string | null } {
  const stored = loadFromStorage()
  const conversations = stored ?? DEFAULT_CONVERSATIONS
  if (!stored) persist(conversations)
  const selectedId = conversations[0]?.id ?? null
  return { conversations, selectedId }
}

const initial = getInitialData()

export const useMessagesStore = create<MessagesState>((set, get) => ({
  conversations: initial.conversations,
  selectedId: initial.selectedId,
  searchQuery: '',
  draft: '',

  selectConversation: (id) => set({ selectedId: id, draft: '' }),

  setSearchQuery: (q) => set({ searchQuery: q }),

  setDraft: (text) => set({ draft: text }),

  sendDraft: () => {
    const { draft, selectedId, conversations } = get()
    const text = draft.trim()
    if (!text || !selectedId) return
    const next = conversations.map((c) => {
      if (c.id !== selectedId) return c
      return {
        ...c,
        messages: [
          ...c.messages,
          { id: makeId(), fromMe: true, text, sentAt: Date.now() },
        ],
      }
    })
    set({ conversations: next, draft: '' })
    persist(next)
  },
}))

export function conversationPreview(c: Conversation): string {
  const last = c.messages[c.messages.length - 1]
  return last?.text ?? ''
}

export function conversationUpdatedAt(c: Conversation): number {
  const last = c.messages[c.messages.length - 1]
  return last?.sentAt ?? 0
}
