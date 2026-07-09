import { useState } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { publicUrl } from '../../utils/assetUrl'
import styles from './AIAssistant.module.css'

interface ToolPartData {
  toolCallId: string
  toolName: string
  state: string
  input: unknown
  output?: unknown
}

interface ToolCallPartProps {
  toolData: ToolPartData
}

const TOOL_LABELS: Record<string, string> = {
  addObject: 'Added Object',
  removeObject: 'Removed Object',
  transformObject: 'Transformed Object',
  setMaterial: 'Set Material',
  createTerrain: 'Created Terrain',
}

function getToolDisplayName(toolName: string, input: unknown): string {
  if (input && typeof input === 'object' && 'name' in input && typeof (input as Record<string, unknown>).name === 'string') {
    return (input as Record<string, unknown>).name as string
  }
  return TOOL_LABELS[toolName] || toolName
}

export function ToolCallPart({ toolData }: ToolCallPartProps) {
  const [expanded, setExpanded] = useState(false)
  const { toolName, input, state, output } = toolData

  const label = getToolDisplayName(toolName, input)
  const hasOutput = output !== undefined
  const isComplete = state === 'output-available' || (state === 'input-available' && hasOutput)

  return (
    <div className={styles.toolCard}>
      <button
        className={styles.toolCardHeader}
        onClick={() => setExpanded(!expanded)}
      >
        <span className={styles.toolCardChevron}>
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
        <span className={styles.toolCardName}>
          Added{' '}
          <span className={styles.toolCardObjectName}>
            <img src={publicUrl('icons/model.svg')} alt="" width={12} height={12} />
            <span>{label}</span>
          </span>
        </span>
      </button>

      {expanded && (
        <div className={styles.toolCardBody}>
          <div className={styles.toolCardSection}>
            <span className={styles.toolCardSectionLabel}>Args</span>
            <pre className={styles.toolCardPre}>
              {JSON.stringify(input, null, 2)}
            </pre>
          </div>
          {isComplete && output !== undefined && (
            <div className={styles.toolCardSection}>
              <span className={styles.toolCardSectionLabel}>Result</span>
              <pre className={styles.toolCardPre}>
                {JSON.stringify(output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
