import { create } from 'zustand'

export interface Comment {
  id: string
  text: string
  /** Who wrote the comment (current user / 'You') */
  author: string
  /** Collaborator IDs that were tagged */
  taggedCollaboratorIds: string[]
  /** Collaborator display names that were tagged */
  taggedCollaboratorNames: string[]
  timestamp: number
}

interface CommentStore {
  comments: Comment[]
  addComment: (comment: Omit<Comment, 'id' | 'timestamp'>) => void
  clearComments: () => void
}

export const useCommentStore = create<CommentStore>((set) => ({
  comments: [],
  addComment: (comment) =>
    set((s) => ({
      comments: [
        ...s.comments,
        {
          ...comment,
          id: `comment-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: Date.now(),
        },
      ],
    })),
  clearComments: () => set({ comments: [] }),
}))
