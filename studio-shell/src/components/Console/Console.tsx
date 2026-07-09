import { 
  Terminal, 
  Trash2, 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  FileText,
  Filter
} from 'lucide-react'
import { DockablePanel } from '../shared/DockablePanel'
import { IconButton } from '../shared/IconButton'
import { useEditorStore } from '../../store/editorStore'
import type { ConsoleMessage } from '../../types'
import styles from './Console.module.css'

const typeIcons: Record<ConsoleMessage['type'], React.ReactNode> = {
  log: <FileText size={12} />,
  info: <Info size={12} />,
  warning: <AlertTriangle size={12} />,
  error: <AlertCircle size={12} />,
}

export function Console() {
  const { consoleMessages, clearConsole, log } = useEditorStore()

  const handleTestLog = () => {
    log('This is a test message', 'log', 'Console')
  }

  return (
    <DockablePanel
      widgetId="console"
      title="Console"
      actions={
        <div className={styles.actions}>
          <IconButton 
            icon={<Filter size={14} />} 
            size="sm" 
            tooltip="Filter Messages" 
          />
          <IconButton
            icon={<Trash2 size={14} />}
            size="sm"
            tooltip="Clear Console"
            onClick={clearConsole}
          />
        </div>
      }
    >
      <div className={styles.content}>
        {consoleMessages.length === 0 ? (
          <div className={styles.empty}>
            <Terminal size={24} />
            <p>Console output will appear here</p>
            <button className={styles.testBtn} onClick={handleTestLog}>
              Send test message
            </button>
          </div>
        ) : (
          <div className={styles.messages}>
            {consoleMessages.map((msg) => (
              <div 
                key={msg.id} 
                className={`${styles.message} ${styles[msg.type]}`}
              >
                <span className={styles.icon}>{typeIcons[msg.type]}</span>
                <span className={styles.text}>{msg.message}</span>
                <span className={styles.time}>
                  {msg.timestamp.toLocaleTimeString()}
                </span>
                {msg.source && (
                  <span className={styles.source}>{msg.source}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </DockablePanel>
  )
}




