import { useState } from 'react'
import { useNotesStore } from '../../../stores/notes-store'

/**
 * Notes accent — darkened gold for the active-note row background.
 *
 * Notes intentionally diverges from Photos (macOS blue #0A84FF) and Arc
 * (indigo #5046E5) per design audit Slice 3 — each app carries its own
 * accent identity. The gold ramp in Notes is:
 *   - `NOTES_ACCENT`      (#A48100)  selected note row bg (this file)
 *   - `#FFC149`            link color   (`src/index.css:111`)
 *   - `#FFB400`            checked checkbox fill (`src/index.css:225`)
 * Treat those three values as one curated ramp; don't replace with
 * other "gold-ish" hexes.
 */
const NOTES_ACCENT = '#A48100'

function formatDate(ts: number) {
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffDays === 0) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function stripHtml(html: string) {
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent ?? ''
}

export function NotesSidebar({
  width,
  onResizeStart,
}: {
  width: number
  onResizeStart: (e: React.PointerEvent) => void
}) {
  const notes = useNotesStore((s) => s.notes)
  const selectedNoteId = useNotesStore((s) => s.selectedNoteId)
  const selectNote = useNotesStore((s) => s.selectNote)

  const [hoveredNoteId, setHoveredNoteId] = useState<string | null>(null)

  const sorted = [...notes].sort((a, b) => b.updatedAt - a.updatedAt)

  return (
    <div
      className="relative flex h-full shrink-0 flex-col"
      style={{ width, background: '#1E1E1E', borderRight: '0.5px solid rgba(255,255,255,0.08)' }}
    >
      {/* Notes list */}
      <div className="flex flex-1 flex-col overflow-y-auto px-2 py-2">
        {sorted.map((note, i) => {
          const isActive = note.id === selectedNoteId
          const isHovered = note.id === hoveredNoteId
          const preview = stripHtml(note.body).replace(note.title, '').trim().slice(0, 80)

          const showDivider =
            i > 0 && note.id !== selectedNoteId && sorted[i - 1].id !== selectedNoteId

          return (
            <div key={note.id}>
              {/* Always reserve space for the divider so selecting a note doesn't
                  shift the list. Only toggle its color when it should be hidden. */}
              {i > 0 && (
                <div
                  className="mx-2.5 my-1"
                  style={{
                    height: 1,
                    background: showDivider ? 'rgba(255,255,255,0.08)' : 'transparent',
                  }}
                />
              )}
              <div
                className="flex flex-col rounded-lg px-2.5 py-2"
                style={{
                  cursor: 'default',
                  background: isActive
                    ? NOTES_ACCENT
                    : isHovered
                      ? 'rgba(255,255,255,0.08)'
                      : undefined,
                  transition: 'background 0.1s',
                }}
                onClick={() => selectNote(note.id)}
                onMouseEnter={() => setHoveredNoteId(note.id)}
                onMouseLeave={() => setHoveredNoteId(null)}
              >
                <div className="flex items-baseline gap-2">
                  <span
                    className="truncate text-[12px] font-semibold"
                    style={{ color: isActive ? '#ffffff' : 'rgba(255,255,255,0.85)' }}
                  >
                    {note.title || 'Untitled'}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="shrink-0 text-[11px]" style={{ color: isActive ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.35)' }}>
                    {formatDate(note.updatedAt)}
                  </span>
                  <span className="truncate text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    {preview || 'No additional text'}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
        {sorted.length === 0 && (
          <div className="flex flex-1 items-center justify-center">
            <span className="text-[12px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
              No notes
            </span>
          </div>
        )}
      </div>

      {/* Resize handle on right edge */}
      <div
        className="group absolute right-0 top-0 h-full w-1.5 cursor-col-resize"
        style={{ touchAction: 'none' }}
        onPointerDown={onResizeStart}
      >
        <div className="absolute left-1/2 top-2 bottom-2 w-[2px] -translate-x-1/2 rounded-full bg-white/0 transition-colors duration-150 group-hover:bg-white/15" />
      </div>
    </div>
  )
}
