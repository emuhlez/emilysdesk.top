import { useEffect, useId, type ReactNode } from 'react'
import styles from './WorkspaceDialog.module.css'

interface WorkspaceDialogProps {
  isOpen: boolean
  title: string
  children?: ReactNode
  onClose: () => void
}

export function WorkspaceDialog({ isOpen, title, children, onClose }: WorkspaceDialogProps) {
  const titleId = useId()

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className={styles.overlay}
      role="presentation"
      onClick={onClose}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close dialog"
          >
            ×
          </button>
        </header>

        <div className={styles.body}>{children}</div>

        <footer className={styles.footer}>
          <button
            type="button"
            className={styles.secondary}
            onClick={onClose}
          >
            Close
          </button>
        </footer>
      </div>
    </div>
  )
}

