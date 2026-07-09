import { create } from 'zustand'
import { nanoid } from 'nanoid'
import { stripLeadingBrackets } from '../ai/strip-brackets'
import { localStorageManager } from './utils/localStorage'
import type { Conversation, PersistedMessage, ConversationMode } from '../types'

const STORAGE_KEY = 'studio-shell-conversations'
const ACTIVE_KEY = 'studio-shell-active-conversation'

interface ConversationStore {
  conversations: Record<string, Conversation>
  activeConversationId: string | null
  surfaceBindings: Record<string, string> // maps surface name -> conversationId
  streamingIds: Set<string> // conversation IDs currently generating a response
  pendingViewportMessage: string | null // message queued from the mini composer

  // Actions
  createConversation: (title?: string, mode?: ConversationMode) => string
  deleteConversation: (id: string) => void
  switchConversation: (id: string) => void
  renameConversation: (id: string, title: string) => void
  addMessage: (conversationId: string, message: PersistedMessage) => void
  getActiveConversation: () => Conversation | null
  listConversations: () => Conversation[]
  bindSurface: (surface: string, conversationId: string) => void
  unbindSurface: (surface: string) => void
  getConversationForSurface: (surface: string) => string | null
  clearMessages: (conversationId: string) => void
  clearAllConversations: () => void
  markStreaming: (conversationId: string) => void
  markReady: (conversationId: string) => void
  setSummary: (conversationId: string, summary: string) => void
  setPendingViewportMessage: (text: string | null) => void
}

const loadConversations = (): Record<string, Conversation> => {
  return localStorageManager.load<Record<string, Conversation>>(STORAGE_KEY, {})
}

const persistConversations = (conversations: Record<string, Conversation>) => {
  localStorageManager.saveLater(STORAGE_KEY, () => conversations)
}

export const useConversationStore = create<ConversationStore>((set, get) => {
  let saved = loadConversations()
  let savedIds = Object.keys(saved)

  // Migrate: fix conversation titles that contain [Context: ...] bracket content
  let migrated = false
  for (const id of savedIds) {
    const conv = saved[id]
    if (conv.title.startsWith('[')) {
      const firstUserMsg = conv.messages.find((m) => m.role === 'user')
      if (firstUserMsg) {
        const clean = stripLeadingBrackets(firstUserMsg.textContent)
        conv.title = clean.slice(0, 40) + (clean.length > 40 ? '...' : '') || 'New Chat'
      } else {
        conv.title = 'New Chat'
      }
      migrated = true
    }
  }
  if (migrated) persistConversations(saved)

  // Ensure there's always at least one conversation
  if (savedIds.length === 0) {
    const id = nanoid()
    const now = Date.now()
    saved = {
      [id]: { id, title: 'New Chat', createdAt: now, updatedAt: now, messages: [] },
    }
    savedIds = [id]
    persistConversations(saved)
  }

  // Restore the last active conversation; fall back to the most-recent one if invalid
  const savedActiveId = localStorageManager.load<string | null>(ACTIVE_KEY, null)
  const initialActiveId =
    savedActiveId && saved[savedActiveId]
      ? savedActiveId
      : savedIds[savedIds.length - 1]

  const persistActive = (id: string | null) => {
    localStorageManager.saveNow(ACTIVE_KEY, id)
  }

  return {
    conversations: saved,
    activeConversationId: initialActiveId,
    surfaceBindings: {},
    streamingIds: new Set<string>(),
    pendingViewportMessage: null,

    createConversation: (title, mode) => {
      // Reuse an existing empty "New Chat" conversation instead of creating duplicates
      const state = get()
      if (!title && !mode) {
        const existing = Object.values(state.conversations).find(
          (c) => c.messages.length === 0 && c.title === 'New Chat',
        )
        if (existing) {
          persistActive(existing.id)
          set({ activeConversationId: existing.id })
          return existing.id
        }
      }

      const id = nanoid()
      const now = Date.now()
      const conversation: Conversation = {
        id,
        title: title || 'New Chat',
        createdAt: now,
        updatedAt: now,
        messages: [],
        context: mode ? { mode } : undefined,
      }
      set((state) => {
        const conversations = { ...state.conversations, [id]: conversation }
        persistConversations(conversations)
        persistActive(id)
        return { conversations, activeConversationId: id }
      })
      return id
    },

    deleteConversation: (id) => {
      set((state) => {
        const { [id]: _, ...rest } = state.conversations
        const remainingIds = Object.keys(rest)
        const newActive = state.activeConversationId === id
          ? (remainingIds.length > 0 ? remainingIds[remainingIds.length - 1] : null)
          : state.activeConversationId

        // Clean up surface bindings pointing to deleted conversation
        const surfaceBindings = { ...state.surfaceBindings }
        for (const [surface, convId] of Object.entries(surfaceBindings)) {
          if (convId === id) delete surfaceBindings[surface]
        }

        persistConversations(rest)
        persistActive(newActive)
        return { conversations: rest, activeConversationId: newActive, surfaceBindings }
      })
    },

    switchConversation: (id) => {
      const state = get()
      if (state.conversations[id]) {
        persistActive(id)
        set({ activeConversationId: id })
      }
    },

    renameConversation: (id, title) => {
      set((state) => {
        const conv = state.conversations[id]
        if (!conv) return state
        const conversations = {
          ...state.conversations,
          [id]: { ...conv, title, updatedAt: Date.now() },
        }
        persistConversations(conversations)
        return { conversations }
      })
    },

    addMessage: (conversationId, message) => {
      set((state) => {
        const conv = state.conversations[conversationId]
        if (!conv) return state
        // Auto-title from first user message (strip internal brackets like [Context: ...])
        const isFirstUserMessage = message.role === 'user' && conv.messages.length === 0
        const cleanText = stripLeadingBrackets(message.textContent)
        const title = isFirstUserMessage
          ? cleanText.slice(0, 40) + (cleanText.length > 40 ? '...' : '')
          : conv.title

        const conversations = {
          ...state.conversations,
          [conversationId]: {
            ...conv,
            title,
            updatedAt: Date.now(),
            messages: [...conv.messages, message],
          },
        }
        persistConversations(conversations)
        return { conversations }
      })
    },

    getActiveConversation: () => {
      const state = get()
      if (!state.activeConversationId) return null
      return state.conversations[state.activeConversationId] || null
    },

    listConversations: () => {
      return Object.values(get().conversations).sort((a, b) => b.updatedAt - a.updatedAt)
    },

    bindSurface: (surface, conversationId) => {
      set((state) => ({
        surfaceBindings: { ...state.surfaceBindings, [surface]: conversationId },
      }))
    },

    unbindSurface: (surface) => {
      set((state) => {
        const { [surface]: _, ...rest } = state.surfaceBindings
        return { surfaceBindings: rest }
      })
    },

    getConversationForSurface: (surface) => {
      const state = get()
      return state.surfaceBindings[surface] || state.activeConversationId
    },

    clearMessages: (conversationId) => {
      set((state) => {
        const conv = state.conversations[conversationId]
        if (!conv) return state
        const conversations = {
          ...state.conversations,
          [conversationId]: { ...conv, messages: [], updatedAt: Date.now() },
        }
        persistConversations(conversations)
        return { conversations }
      })
    },

    clearAllConversations: () => {
      const id = nanoid()
      const now = Date.now()
      const conversations = {
        [id]: { id, title: 'New Chat', createdAt: now, updatedAt: now, messages: [] },
      }
      persistConversations(conversations)
      persistActive(id)
      set({ conversations, activeConversationId: id, surfaceBindings: {} })
    },

    markStreaming: (conversationId) => {
      set((state) => {
        if (state.streamingIds.has(conversationId)) return state
        const next = new Set(state.streamingIds)
        next.add(conversationId)
        return { streamingIds: next }
      })
    },

    markReady: (conversationId) => {
      set((state) => {
        if (!state.streamingIds.has(conversationId)) return state
        const next = new Set(state.streamingIds)
        next.delete(conversationId)
        return { streamingIds: next }
      })
    },

    setPendingViewportMessage: (text) => set({ pendingViewportMessage: text }),

    setSummary: (conversationId, summary) => {
      set((state) => {
        const conv = state.conversations[conversationId]
        if (!conv) return state
        const conversations = {
          ...state.conversations,
          [conversationId]: { ...conv, summary },
        }
        persistConversations(conversations)
        return { conversations }
      })
    },
  }
})
