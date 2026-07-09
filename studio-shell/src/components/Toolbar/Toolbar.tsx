import {
  Play,
  Square,
  X,
  Sparkles,
} from 'lucide-react'
import { ExpandDownIcon } from '../shared/ExpandIcons'
import { useState, useRef, useEffect, useCallback } from 'react'
import type { DockZone } from '../../types'
import { useEditorStore } from '../../store/editorStore'
import { useDockingStore } from '../../store/dockingStore'
import { MenuDropdown, MenuItem } from '../shared/MenuDropdown'
import { useAgentChat } from '../../ai/use-agent-chat'
import { isAIIntent } from '../../ai/detect-ai-intent'
import { parseResponse } from '../../ai/parse-response'
import styles from './Toolbar.module.css'
import searchIconImg from '../../../images/search.png'
import annotationIcon from '../../../images/Annotation Icon.png'
import notificationIcon from '../../../images/Small_Notification.png'
import avatar1 from '../../../images/Avatar-1.png'
import avatar2 from '../../../images/Avatar-2.png'
import avatar3 from '../../../images/Avatar-3.png'
import partBlockIcon from '../../../images/Part_Block.png'

export function Toolbar() {
  const [showTestDropdown, setShowTestDropdown] = useState(false)
  const [menuPressed, setMenuPressed] = useState(false)
  const [showMenuDropdown, setShowMenuDropdown] = useState(false)
  const [selectedTestMode, setSelectedTestMode] = useState('Test')
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearchResults, setShowSearchResults] = useState(false)
  const [aiResponseText, setAiResponseText] = useState<string | null>(null)
  const [aiSubmitted, setAiSubmitted] = useState(false)
  const aiDismissTimer = useRef<ReturnType<typeof setTimeout>>()
  const dropdownRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Test dropdown menu items
  const testMenuItems: MenuItem[] = [
    { label: 'Test', onClick: () => setSelectedTestMode('Test') },
    { label: 'Test Here', onClick: () => setSelectedTestMode('Test Here') },
    { label: 'Run', onClick: () => setSelectedTestMode('Run') },
    { label: 'Server & Clients', onClick: () => setSelectedTestMode('Server & Clients') },
  ]
  
  // Menu items without dividers for this variant
  const menuItems: MenuItem[] = [
    { 
      label: 'File',
      submenu: [
        { label: 'New', shortcut: '⌘ N', onClick: () => console.log('New') },
        { label: 'Open from File', onClick: () => console.log('Open from File') },
        { label: 'Open from Roblox', shortcut: '⌘ O', onClick: () => console.log('Open from Roblox') },
        { label: 'Recent', onClick: () => console.log('Recent') },
        { divider: true },
        { label: 'Close Place', shortcut: '⌘ F4', onClick: () => console.log('Close Place') },
        { divider: true },
        { label: 'Import 3D', shortcut: '⌘ M', onClick: () => console.log('Import 3D') },
        { label: 'Import Roblox Model', onClick: () => console.log('Import Roblox Model') },
        { label: 'Export as .obj', onClick: () => console.log('Export as .obj') },
        { divider: true },
        { label: 'Save to File', onClick: () => console.log('Save to File') },
        { label: 'Save to File As', shortcut: '⌘ S', onClick: () => console.log('Save to File As') },
        { label: 'Save to Roblox', onClick: () => console.log('Save to Roblox') },
        { label: 'Save to Roblox As', onClick: () => console.log('Save to Roblox As') },
        { divider: true },
        { label: 'Publish to Roblox', shortcut: '⌃ P', onClick: () => console.log('Publish to Roblox') },
        { label: 'Publish to Roblox As', onClick: () => console.log('Publish to Roblox As') },
        { divider: true },
        { label: 'Game Settings', onClick: () => console.log('Game Settings') },
        { label: 'Avatar Settings', onClick: () => console.log('Avatar Settings') },
        { label: 'Open Configs', onClick: () => console.log('Open Configs') },
        { divider: true },
        { label: 'Beta Features', onClick: () => console.log('Beta Features') },
        { label: 'Open Flag Editor', onClick: () => console.log('Open Flag Editor') },
        { label: 'Customize Shortcuts', onClick: () => console.log('Customize Shortcuts') },
        { divider: true },
        { label: 'Open Auto Saves', onClick: () => console.log('Open Auto Saves') },
      ]
    },
    { 
      label: 'Edit',
      submenu: [
        { label: 'Undo', shortcut: '⌘ Z', onClick: () => console.log('Undo') },
        { label: 'Redo', shortcut: '⇧ ⌘ Z', onClick: () => console.log('Redo') },
        { divider: true },
        { label: 'Cut', shortcut: '⌘ X', onClick: () => console.log('Cut') },
        { label: 'Copy', shortcut: '⌘ C', onClick: () => console.log('Copy') },
        { label: 'Copy As', onClick: () => console.log('Copy As') },
        { label: 'Paste', shortcut: '⌘ V', onClick: () => console.log('Paste') },
        { label: 'Paste Over Selection', shortcut: '⌥ ⌘ V', onClick: () => console.log('Paste Over Selection') },
        { label: 'Paste to Replace', shortcut: '⌥ ⌘ R', onClick: () => console.log('Paste to Replace') },
        { label: 'Duplicate', shortcut: '⌘ D', onClick: () => console.log('Duplicate') },
        { label: 'Delete', shortcut: '⌦', onClick: () => console.log('Delete') },
        { divider: true },
        { label: 'Find', shortcut: '⌘ F', onClick: () => console.log('Find') },
        { label: 'Find Next', shortcut: '⌥ ⌘ F', onClick: () => console.log('Find Next') },
        { label: 'Find Previous', shortcut: '⌥ ⌘ D', onClick: () => console.log('Find Previous') },
        { label: 'Find and Replace...', onClick: () => console.log('Find and Replace') },
        { divider: true },
        { label: 'Set Default Properties', onClick: () => console.log('Set Default Properties') },
        { label: 'Copy Properties', shortcut: '⌃ ⌘ C', onClick: () => console.log('Copy Properties') },
        { label: 'Paste Properties', shortcut: '⌃ ⌘ V', onClick: () => console.log('Paste Properties') },
        { divider: true },
        { label: 'Pick Color', shortcut: '⌃ C', onClick: () => console.log('Pick Color') },
        { divider: true },
        { label: 'Select All', shortcut: '⌘ A', onClick: () => console.log('Select All') },
        { label: 'Select Matching Layers', shortcut: '⌃ ⌘ A', onClick: () => console.log('Select Matching Layers') },
        { label: 'Select None', onClick: () => console.log('Select None') },
        { label: 'Select Inverse', shortcut: '⌥ ⌘ A', onClick: () => console.log('Select Inverse') },
        { label: 'Select All With', submenu: [] },
        { divider: true },
        { label: 'AutoFill', submenu: [] },
        { label: 'Start Dictation...', onClick: () => console.log('Start Dictation') },
        { label: 'Emoji & Symbols', onClick: () => console.log('Emoji & Symbols') },
      ]
    },
    { 
      label: 'Object', 
      submenu: [
        { label: 'Insert Object', onClick: () => console.log('Insert Object') },
      ]
    },
    { 
      label: 'View',
      submenu: [
        { label: 'Zoom In', shortcut: '⌘ =', onClick: () => console.log('Zoom In') },
        { label: 'Zoom Out', shortcut: '⌘ -', onClick: () => console.log('Zoom Out') },
        { divider: true },
        { label: 'Show View Selector', onClick: () => console.log('Show View Selector') },
        { label: 'Show Wind Direction', onClick: () => console.log('Show Wind Direction') },
        { label: 'Show Grid', submenu: [] },
        { label: 'Show Grid Material', onClick: () => console.log('Show Grid Material') },
        { label: 'Show Wireframe Rendering', onClick: () => console.log('Show Wireframe Rendering') },
        { label: 'Show UI', onClick: () => console.log('Show UI') },
        { divider: true },
        { label: 'Show Welds', shortcut: '⌃ W', onClick: () => console.log('Show Welds') },
        { label: 'Show Constraint Details', shortcut: '⌃ D', onClick: () => console.log('Show Constraint Details') },
        { divider: true },
        { label: 'Expand Script Folds', shortcut: '⌘ E', onClick: () => console.log('Expand Script Folds') },
        { label: 'Collapse Script Folds', shortcut: '⌥ ⌘ E', onClick: () => console.log('Collapse Script Folds') },
        { label: 'Toggle Comment', shortcut: '⌘ /', onClick: () => console.log('Toggle Comment') },
        { divider: true },
        { label: 'Screenshot', shortcut: '⇧', onClick: () => console.log('Screenshot') },
        { divider: true },
        { label: 'Mute', onClick: () => console.log('Mute') },
      ]
    },
    { 
      label: 'Plugins',
      submenu: [
        { label: 'Manage Plugins', onClick: () => console.log('Manage Plugins') },
        { label: 'Plugins Folder', onClick: () => console.log('Plugins Folder') },
        { divider: true },
        { label: 'Save as Local Plugin', onClick: () => console.log('Save as Local Plugin') },
        { label: 'Publish as Plugin', onClick: () => console.log('Publish as Plugin') },
        { divider: true },
        { label: 'Ro-Defender Plugin', submenu: [] },
        { label: 'Building Tools by F3X', submenu: [] },
        { label: 'AutoScale Lite', submenu: [] },
        { label: "EgoMoose's plugins", submenu: [] },
        { label: 'GeomTools', submenu: [] },
        { label: 'Rigging', submenu: [] },
        { label: 'Atmos', submenu: [] },
        { label: "AlreadyPro's Plugins", submenu: [] },
        { label: 'Factor Plugins', submenu: [] },
        { label: 'Moon Animator', submenu: [] },
        { label: 'Rojo 7.2.1', submenu: [] },
      ]
    },
    { 
      label: 'Window',
      submenu: [
        { label: 'Toolbox', onClick: () => console.log('Toolbox') },
        { label: 'Properties', onClick: () => console.log('Properties') },
        { label: 'Explorer', shortcut: '⌃ X', onClick: () => console.log('Explorer') },
        { label: 'Output', onClick: () => console.log('Output') },
        { label: 'Activity History', onClick: () => console.log('Activity History') },
        { label: 'Asset Manager', onClick: () => console.log('Asset Manager') },
        { label: 'Insert Object', onClick: () => console.log('Insert Object') },
        { divider: true },
        { label: '3D', submenu: [] },
        { label: 'Avatar', submenu: [] },
        { label: 'Collaboration', submenu: [] },
        { label: 'Debug', submenu: [] },
        { label: 'Localization', submenu: [] },
        { label: 'Performance Summary', submenu: [] },
        { label: 'Script', submenu: [] },
        { label: 'Reset Layout', onClick: () => console.log('Reset Layout') },
      ]
    },
    { 
      label: 'Help', 
      submenu: [
        { label: 'Documentation', onClick: () => console.log('Documentation') },
        { label: 'Community', onClick: () => console.log('Community') },
        { label: 'About', onClick: () => console.log('About') },
      ]
    },
  ]
  const {
    play,
    pause,
    stop,
  } = useEditorStore()

  const dockWidget = useDockingStore((s) => s.dockWidget)
  const undockWidget = useDockingStore((s) => s.undockWidget)
  const aiAssistant = useDockingStore((s) => s.widgets['ai-assistant'])
  const aiPanelVisible = !!aiAssistant
  const lastAIZoneRef = useRef<DockZone>('left')

  const toggleAIPanel = () => {
    if (aiPanelVisible) {
      lastAIZoneRef.current = aiAssistant?.zone ?? 'left'
      undockWidget('ai-assistant')
    } else {
      dockWidget('ai-assistant', lastAIZoneRef.current)
    }
  }

  // AI chat integration for omnisearch
  const { messages, sendMessage, status: aiStatus } = useAgentChat()
  const aiIsLoading = aiStatus === 'streaming' || aiStatus === 'submitted'
  const aiMode = isAIIntent(searchQuery)

  // Count pending tool calls for AI status
  const aiPendingToolCount = messages
    .filter((m) => m.role === 'assistant')
    .flatMap((m) => m.parts ?? [])
    .filter((part) => {
      if (part.type === 'text') return false
      if ('state' in part) {
        return part.state === 'input-streaming' || part.state === 'input-available'
      }
      return false
    }).length

  // Watch for AI status transition to 'ready' after submitting
  const prevAiStatusRef = useRef(aiStatus)
  useEffect(() => {
    const wasLoading = prevAiStatusRef.current === 'streaming' || prevAiStatusRef.current === 'submitted'
    prevAiStatusRef.current = aiStatus

    if (!aiSubmitted) return
    if (!wasLoading || aiStatus !== 'ready') return

    // Status just went from loading → ready; read the final response
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
    if (!lastAssistant) return

    const text = lastAssistant.parts
      ?.filter((p): p is Extract<typeof p, { type: 'text' }> => p.type === 'text')
      .map((p) => p.text)
      .join('') || ''

    if (!text) {
      setAiSubmitted(false)
      return
    }

    const parsed = parseResponse(text)
    setAiSubmitted(false)

    if (parsed.shouldOpenAssistant) {
      dockWidget('ai-assistant', lastAIZoneRef.current)
      setShowSearchResults(false)
      setSearchQuery('')
      setAiResponseText(null)
      return
    }

    const display = parsed.text.length > 150
      ? parsed.text.slice(0, 150) + '...'
      : parsed.text
    setAiResponseText(display)

    clearTimeout(aiDismissTimer.current)
    aiDismissTimer.current = setTimeout(() => {
      setAiResponseText(null)
      setShowSearchResults(false)
      setSearchQuery('')
    }, 4000)
  }, [aiStatus, messages, aiSubmitted, dockWidget])

  // Cleanup AI dismiss timer
  useEffect(() => {
    return () => clearTimeout(aiDismissTimer.current)
  }, [])

  // Handle AI search submit
  const handleAISubmit = useCallback(() => {
    if (!searchQuery.trim() || aiIsLoading) return
    sendMessage({ text: searchQuery })
    setAiSubmitted(true)
    setAiResponseText(null)
    setShowSearchResults(true)
  }, [searchQuery, aiIsLoading, sendMessage])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowTestDropdown(false)
      }
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenuDropdown(false)
        setMenuPressed(false)
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false)
      }
    }

    if (showTestDropdown || showMenuDropdown || showSearchResults) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showTestDropdown, showMenuDropdown, showSearchResults])

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)
    setAiResponseText(null)
    setAiSubmitted(false)
    clearTimeout(aiDismissTimer.current)
    setShowSearchResults(value.length > 0)
  }

  // Handle search keydown (Enter for AI submit, Escape to close)
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && aiMode) {
      e.preventDefault()
      handleAISubmit()
    }
    if (e.key === 'Escape') {
      setSearchQuery('')
      setShowSearchResults(false)
      setAiResponseText(null)
      setAiSubmitted(false)
      clearTimeout(aiDismissTimer.current)
      searchInputRef.current?.blur()
    }
  }

  // Clear search
  const handleClearSearch = () => {
    setSearchQuery('')
    setShowSearchResults(false)
    setAiResponseText(null)
    setAiSubmitted(false)
    clearTimeout(aiDismissTimer.current)
  }

  // Mock search results - replace with actual search logic
  const searchResults = searchQuery.length > 0 ? [
    { type: 'Script', name: 'PlayerController', path: 'Workspace > Scripts' },
    { type: 'Part', name: 'Platform', path: 'Workspace > Models' },
    { type: 'Model', name: 'PlayerModel', path: 'Workspace' },
  ].filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.type.toLowerCase().includes(searchQuery.toLowerCase())
  ) : []

  return (
    <header className={styles.toolbar}>
      <div className={styles.trafficLights}>
        <button className={`${styles.trafficLight} ${styles.red}`} aria-label="Close" />
        <button className={`${styles.trafficLight} ${styles.yellow}`} aria-label="Minimize" />
        <button className={`${styles.trafficLight} ${styles.green}`} aria-label="Maximize" />
      </div>

      <div className={styles.leftSection}>
        <div 
          className={`${styles.actionIconContainer} ${menuPressed ? styles.pressed : ''}`}
          onClick={() => {
            setMenuPressed(!menuPressed)
            setShowMenuDropdown(!showMenuDropdown)
          }}
          ref={menuRef}
        >
          <img src="/roblox_dropdown.png" alt="Menu" className={styles.actionIcon} />
          <MenuDropdown
            items={menuItems}
            isOpen={showMenuDropdown}
            onClose={() => {
              setShowMenuDropdown(false)
              setMenuPressed(false)
            }}
          />
        </div>
        
        <div className={styles.divider} />

        <div className={styles.logo}>
          <div className={styles.logoIcon}></div>
          <span className={styles.logoText}>crossy farm</span>
        </div>

        <div className={styles.divider} />

        <div className={styles.testingModeControls} ref={dropdownRef}>
          <button 
            className={styles.testDropdownButton}
            onClick={() => setShowTestDropdown(!showTestDropdown)}
          >
            <span>{selectedTestMode}</span>
            <ExpandDownIcon />
          </button>
          <MenuDropdown
            items={testMenuItems}
            isOpen={showTestDropdown}
            onClose={() => setShowTestDropdown(false)}
          />
          <button className={styles.testPlayButton} onClick={play} title="Play Test">
            <Play size={16} fill="currentColor" />
          </button>
          <button className={styles.testPauseButton} onClick={pause} title="Pause Test">
            <img src="/pause-split-toggle.png" alt="Pause" width={16} height={16} />
          </button>
          <button className={styles.testStopButton} onClick={stop} title="Stop Test">
            <Square size={16} fill="currentColor" />
          </button>
        </div>
      </div>

      <div className={styles.searchWrapper} ref={searchRef}>
        <div className={styles.searchContainer}>
          <img src={searchIconImg} alt="Search" className={styles.searchIcon} width={16} height={16} />
          {aiMode && <span className={styles.aiIndicator}>AI</span>}
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search Project"
            className={styles.searchInput}
            aria-label="Search Project"
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
            onFocus={() => searchQuery.length > 0 && setShowSearchResults(true)}
          />
          {searchQuery && (
            <button
              className={styles.clearButton}
              onClick={handleClearSearch}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
        {showSearchResults && (
          <div className={styles.searchResultsMenu}>
            {aiMode || aiSubmitted ? (
              <div className={styles.aiResponse}>
                {aiIsLoading && (
                  <div className={styles.aiResponseStatus}>
                    <span className={styles.aiStatusDot} />
                    <span>
                      {aiPendingToolCount > 0
                        ? `Executing ${aiPendingToolCount} tool${aiPendingToolCount > 1 ? 's' : ''}...`
                        : 'Thinking...'}
                    </span>
                  </div>
                )}
                {aiResponseText && (
                  <div className={styles.aiResponseText}>{aiResponseText}</div>
                )}
                {!aiIsLoading && !aiResponseText && !aiSubmitted && (
                  <div className={styles.aiResponseHint}>Press Enter to ask AI</div>
                )}
                <button
                  className={styles.continueLink}
                  onClick={() => {
                    dockWidget('ai-assistant', lastAIZoneRef.current)
                    setShowSearchResults(false)
                  }}
                >
                  Continue in Assistant →
                </button>
              </div>
            ) : searchResults.length > 0 ? (
              searchResults.map((result, index) => (
                <button
                  key={index}
                  className={styles.searchResultItem}
                  onClick={() => {
                    console.log('Selected:', result)
                    setShowSearchResults(false)
                  }}
                >
                  <div className={styles.resultType}>{result.type}</div>
                  <div className={styles.resultInfo}>
                    <div className={styles.resultName}>{result.name}</div>
                    <div className={styles.resultPath}>{result.path}</div>
                  </div>
                </button>
              ))
            ) : (
              <div className={styles.noResults}>
                No results found for &quot;{searchQuery}&quot;
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.group}>
          <div>
            <img src={annotationIcon} alt="Annotation" width={16} height={16} />
          </div>
          <div className={aiPanelVisible ? styles.activeToolbarIcon : ''}>
            <button
              type="button"
              className={styles.groupIconButton}
              title="AI Assistant"
              aria-label="AI Assistant"
              onClick={toggleAIPanel}
            >
              <Sparkles size={16} strokeWidth={1.75} />
            </button>
          </div>
          <div>
            <img src={notificationIcon} alt="Notifications" width={16} height={16} />
          </div>
        </div>
        <div className={styles.group}>
          <img src={avatar1} alt="Avatar 1" width={24} height={24} className={styles.avatar} />
          <img src={avatar2} alt="Avatar 2" width={24} height={24} className={styles.avatar} />
          <img src={avatar3} alt="Avatar 3" width={24} height={24} className={styles.avatar} />
        </div>
        <button className={styles.testDropdownButton}>
          <img src={partBlockIcon} alt="Part Block" width={16} height={16} />
          <span>Build</span>
          <ExpandDownIcon />
        </button>
      </div>
    </header>
  )
}

