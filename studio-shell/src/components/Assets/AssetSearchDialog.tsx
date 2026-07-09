import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import styles from './AssetSearchDialog.module.css'

interface AssetSearchDialogProps {
  isOpen: boolean
  onClose: () => void
  onSearch: (inventory: string, assetType: string) => void
  selectedInventory?: string
  selectedAssetType?: string
}

const INVENTORIES = ['ehopehopehope', 'alpha strike', 'All Inventories']

const ASSET_TYPES = [
  'Animation',
  'Audio',
  'Decal',
  'FontFamily',
  'Image',
  'Mesh',
  'MeshPart',
  'Model',
  'Place',
  'Plugin',
  'Video',
]

export function AssetSearchDialog({
  isOpen,
  onClose,
  onSearch,
  selectedInventory = 'ehopehopehope',
  selectedAssetType = 'Model',
}: AssetSearchDialogProps) {
  const [inventory, setInventory] = useState(selectedInventory)
  const [assetType, setAssetType] = useState(selectedAssetType)
  const [isInventoryOpen, setIsInventoryOpen] = useState(false)

  if (!isOpen) return null

  const handleSearch = () => {
    onSearch(inventory, assetType)
    onClose()
  }

  const handleCancel = () => {
    onClose()
  }

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.section}>
          <label className={styles.sectionLabel}>Inventory</label>
          <div className={styles.dropdown}>
            <button
              className={styles.dropdownButton}
              onClick={() => setIsInventoryOpen(!isInventoryOpen)}
            >
              <span>{inventory}</span>
              <ChevronDown size={14} className={styles.dropdownIcon} />
            </button>
            {isInventoryOpen && (
              <div className={styles.dropdownMenu}>
                {INVENTORIES.map((inv) => (
                  <button
                    key={inv}
                    className={`${styles.dropdownItem} ${inventory === inv ? styles.selected : ''}`}
                    onClick={() => {
                      setInventory(inv)
                      setIsInventoryOpen(false)
                    }}
                  >
                    {inv}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={styles.section}>
          <label className={styles.sectionLabel}>Asset Type</label>
          <div className={styles.radioGroup}>
            {ASSET_TYPES.map((type) => (
              <label
                key={type}
                className={`${styles.radioLabel} ${assetType === type ? styles.selected : ''}`}
              >
                <input
                  type="radio"
                  name="assetType"
                  value={type}
                  checked={assetType === type}
                  onChange={(e) => setAssetType(e.target.value)}
                  className={styles.radioInput}
                />
                <span className={styles.radioCircle} />
                <span className={styles.radioText}>{type}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.cancelButton} onClick={handleCancel}>
          Cancel
        </button>
        <button className={styles.searchButton} onClick={handleSearch}>
          Search
        </button>
      </div>
    </div>
  )
}
