import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { Asset } from '../../types'
import styles from './MoveDialog.module.css'

export interface MoveDialogProps {
  isOpen: boolean
  assetCount: number
  folders: Asset[]
  onMove: (targetFolderId: string) => void
  onCancel: () => void
}

export function MoveDialog({ isOpen, assetCount, folders, onMove, onCancel }: MoveDialogProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null)

  if (!isOpen) return null

  const handleMove = () => {
    if (selectedFolderId) {
      onMove(selectedFolderId)
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.dialog}>
        <h2 className={styles.title}>Move {assetCount} asset{assetCount !== 1 ? 's' : ''}</h2>
        <p className={styles.subtitle}>Select a destination folder for selected assets</p>
        
        <div className={styles.folderList}>
          {folders.map((folder) => {
            const displayName = folder.name === 'Sprites' ? 'Interior Props' : folder.name
            const isSelected = selectedFolderId === folder.id
            
            return (
              <button
                key={folder.id}
                className={`${styles.folderItem} ${isSelected ? styles.folderItemSelected : ''}`}
                onClick={() => setSelectedFolderId(folder.id)}
              >
                <div className={styles.folderIcon}>
                  <img src="/icons/folder.svg" alt="" width={20} height={20} />
                </div>
                <span className={styles.folderName}>{displayName}</span>
                <ChevronRight size={16} className={styles.folderChevron} />
              </button>
            )
          })}
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelButton}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.moveButton}
            onClick={handleMove}
            disabled={!selectedFolderId}
          >
            Move
          </button>
        </div>
      </div>
    </div>
  )
}
