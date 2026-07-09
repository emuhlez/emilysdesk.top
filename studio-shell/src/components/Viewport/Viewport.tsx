import { useRef, memo } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { Viewport3D } from './Viewport3D'
import styles from './Viewport.module.css'

export const Viewport = memo(function Viewport() {
  const canvas3DRef = useRef<HTMLDivElement>(null)
  const isPlaying = useEditorStore((s) => s.isPlaying)

  return (
    <div className={styles.viewport}>
      <div className={styles.canvas}>
        {/* 3D workspace – assets from /3d-space */}
        <div ref={canvas3DRef} className={styles.canvas3D} aria-hidden />
        <Viewport3D containerRef={canvas3DRef} />

        {/* Center crosshair */}
        <div className={styles.origin}>
          <div className={styles.originX} />
          <div className={styles.originY} />
        </div>

        {isPlaying && (
          <div className={styles.info}>
            <span className={styles.playingBadge}>▶ Playing</span>
          </div>
        )}
      </div>
    </div>
  )
})





