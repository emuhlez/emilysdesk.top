import { useState, useCallback } from 'react'

interface UseDragAndDropOptions {
  onDragStart?: (id: string) => void
  onDrop?: (draggedId: string, targetId: string) => void
  canDrop?: (draggedId: string, targetId: string) => boolean
}

/**
 * Reusable hook for drag and drop functionality
 * Handles drag state and provides callbacks for drag operations
 */
export function useDragAndDrop(options: UseDragAndDropOptions = {}) {
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const handleDragStart = useCallback((id: string) => {
    setDraggedId(id)
    options.onDragStart?.(id)
  }, [options])

  const handleDragOver = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Check if drop is allowed
    if (draggedId && options.canDrop && !options.canDrop(draggedId, targetId)) {
      return
    }
    
    setDragOverId(targetId)
  }, [draggedId, options])

  const handleDragLeave = useCallback(() => {
    setDragOverId(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverId(null)

    if (draggedId && draggedId !== targetId) {
      // Check if drop is allowed
      if (options.canDrop && !options.canDrop(draggedId, targetId)) {
        setDraggedId(null)
        return
      }
      
      options.onDrop?.(draggedId, targetId)
    }
    
    setDraggedId(null)
  }, [draggedId, options])

  const handleDragEnd = useCallback(() => {
    setDraggedId(null)
    setDragOverId(null)
  }, [])

  return {
    draggedId,
    dragOverId,
    handleDragStart,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragEnd,
    isDragging: draggedId !== null,
  }
}
