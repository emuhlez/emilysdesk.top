import { useState } from 'react'
import { ChevronDown, ChevronRight, Check, X } from 'lucide-react'
import searchIconImg from '../../../images/search.png'
import styles from './FilterMenu.module.css'

export interface ActiveFilters {
  assetTypes: Set<string>
  sources: Set<string>
  creators: Set<string>
}

interface FilterMenuProps {
  isOpen: boolean
  onClose: () => void
  position: { top: number; right: number }
  activeFilters: ActiveFilters
  onFilterChange: (filters: ActiveFilters) => void
}

export function FilterMenu({ isOpen, onClose, position, activeFilters, onFilterChange }: FilterMenuProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['Asset Type', 'Source', 'Creator'])
  )

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(section)) {
        next.delete(section)
      } else {
        next.add(section)
      }
      return next
    })
  }

  const toggleFilter = (filter: string, category: 'assetTypes' | 'sources' | 'creators') => {
    const newFilters = { ...activeFilters }
    const categorySet = new Set(newFilters[category])
    
    if (categorySet.has(filter)) {
      categorySet.delete(filter)
    } else {
      categorySet.add(filter)
    }
    
    newFilters[category] = categorySet
    onFilterChange(newFilters)
  }

  const resetFilters = () => {
    onFilterChange({
      assetTypes: new Set(),
      sources: new Set(),
      creators: new Set(),
    })
  }

  const assetTypes = [
    'Animation',
    'Audio',
    'Decal',
    'FontFamily',
    'Image',
    'Mesh',
    'MeshPart',
    'Model',
    'Only Archived',
    'Package',
    'Plugin',
    'Video',
  ]

  const sources = ['Creator Store', 'Shared With Me', 'Uploaded']

  const creators = [
    'ehopehopehope',
    'Alpha_Strike',
  ]

  // Filter options based on search query
  const filterBySearch = (items: string[]) => {
    if (!searchQuery) return items
    const query = searchQuery.toLowerCase()
    return items.filter(item => item.toLowerCase().includes(query))
  }

  const filteredAssetTypes = filterBySearch(assetTypes)
  const filteredSources = filterBySearch(sources)
  const filteredCreators = filterBySearch(creators)

  // Check if section has any matching results
  const hasResults = (items: string[]) => filterBySearch(items).length > 0

  if (!isOpen) return null

  return (
    <>
      <div className={styles.backdrop} onClick={onClose} />
      <div className={styles.menu} style={{ top: position.top, right: position.right }}>
        <div className={styles.searchContainer}>
          <img src={searchIconImg} alt="Search" className={styles.searchIcon} width={16} height={16} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search all filters..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search filters"
          />
          {searchQuery && (
            <button
              type="button"
              className={styles.searchClear}
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className={styles.scrollContent}>
          {searchQuery && !hasResults(assetTypes) && !hasResults(sources) && !hasResults(creators) && (
            <div className={styles.noResults}>No filters match "{searchQuery}"</div>
          )}

          {/* Asset Type Section */}
          {hasResults(assetTypes) && (
            <div className={styles.section}>
              <button
                className={styles.sectionHeader}
                onClick={() => toggleSection('Asset Type')}
              >
                {expandedSections.has('Asset Type') ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )}
                <span>Asset Type</span>
              </button>
              {expandedSections.has('Asset Type') && (
                <div className={styles.sectionContent}>
                  {filteredAssetTypes.map((type) => {
                    const isSelected = activeFilters.assetTypes.has(type)
                    return (
                      <button
                        key={type}
                        className={`${styles.checkboxLabel} ${isSelected ? styles.selected : ''}`}
                        onClick={() => toggleFilter(type, 'assetTypes')}
                      >
                        {isSelected && <Check size={14} className={styles.checkmark} />}
                        <span>{type}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Source Section */}
          {hasResults(sources) && (
            <div className={styles.section}>
              <button
                className={styles.sectionHeader}
                onClick={() => toggleSection('Source')}
              >
                {expandedSections.has('Source') ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )}
                <span>Source</span>
              </button>
              {expandedSections.has('Source') && (
                <div className={styles.sectionContent}>
                  {filteredSources.map((source) => {
                    const isSelected = activeFilters.sources.has(source)
                    return (
                      <button
                        key={source}
                        className={`${styles.checkboxLabel} ${isSelected ? styles.selected : ''}`}
                        onClick={() => toggleFilter(source, 'sources')}
                      >
                        {isSelected && <Check size={14} className={styles.checkmark} />}
                        <span>{source}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Creator Section */}
          {hasResults(creators) && (
            <div className={styles.section}>
              <button
                className={styles.sectionHeader}
                onClick={() => toggleSection('Creator')}
              >
                {expandedSections.has('Creator') ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )}
                <span>Creator</span>
              </button>
              {expandedSections.has('Creator') && (
                <div className={styles.sectionContent}>
                  {filteredCreators.map((creator) => {
                    const isSelected = activeFilters.creators.has(creator)
                    return (
                      <button
                        key={creator}
                        className={`${styles.checkboxLabel} ${isSelected ? styles.selected : ''}`}
                        onClick={() => toggleFilter(creator, 'creators')}
                      >
                        {isSelected && <Check size={14} className={styles.checkmark} />}
                        <span>{creator}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <button className={styles.resetButton} onClick={resetFilters}>
          Reset Filters
        </button>
      </div>
    </>
  )
}
