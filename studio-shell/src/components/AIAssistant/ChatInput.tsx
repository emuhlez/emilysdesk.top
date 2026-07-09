import { useState, useRef, type FormEvent, type ReactNode } from 'react'
import { ArrowUp } from 'lucide-react'
import { PillInput } from '../shared/PillInput'
import type { InputSegment, PillInputHandle } from '../../types'
import styles from './AIAssistant.module.css'

interface ChatInputProps {
  onSend: (text: string) => void
  isLoading: boolean
  placeholder?: string
  extraButtons?: ReactNode
  inline?: boolean
  onExpandRequested?: () => void
  segments?: InputSegment[]
  onSegmentsChange?: (segments: InputSegment[]) => void
}

export function ChatInput({ onSend, isLoading, placeholder, extraButtons, inline = false, onExpandRequested, segments: controlledSegments, onSegmentsChange }: ChatInputProps) {
  const [internalSegments, setInternalSegments] = useState<InputSegment[]>([])
  const pillInputRef = useRef<PillInputHandle>(null)
  const isControlled = controlledSegments !== undefined
  const segments = isControlled ? controlledSegments : internalSegments

  // Pill chips only appear when the user explicitly types `@` and picks an
  // entry from the mention dropdown — we intentionally do NOT sync
  // selection / creation events into the composer.

  const handleSegmentsChange = (next: InputSegment[]) => {
    if (isControlled && onSegmentsChange) {
      onSegmentsChange(next)
    } else {
      setInternalSegments(next)
    }
    const hasContent = next.some(s => (s.type === 'text' && s.text.trim()) || s.type === 'pill')
    if (hasContent && onExpandRequested) {
      onExpandRequested()
    }
  }

  const submit = () => {
    const text = pillInputRef.current?.getTextContent()?.trim() ?? ''
    if (!text || isLoading) return
    onSend(text)
    if (isControlled && onSegmentsChange) {
      onSegmentsChange([])
    } else {
      setInternalSegments([])
    }
  }

  const onFormSubmit = (e: FormEvent) => {
    e.preventDefault()
    submit()
  }

  const hasText = segments.some(s => (s.type === 'text' && s.text.trim()) || s.type === 'pill')

  return (
    <form
      onSubmit={onFormSubmit}
      className={`${styles.inputArea} ${inline ? styles.inputAreaInline : ''}`}
      onMouseDown={inline ? (e) => e.stopPropagation() : undefined}
    >
      <div className={styles.inputWrapper}>
        <PillInput
          ref={pillInputRef}
          segments={segments}
          onSegmentsChange={handleSegmentsChange}
          onSubmit={submit}
          placeholder={placeholder || 'Build anything'}
          disabled={isLoading}
          className={styles.inputField}
        />
        <button
          type="submit"
          className={styles.collapsedInputTrailingButton}
          disabled={!hasText || isLoading}
          title="Send message"
          aria-label="Send message"
        >
          <ArrowUp size={16} />
        </button>
      </div>
      {extraButtons}
    </form>
  )
}
