import type { ReactNode } from 'react'
import styles from './Panel.module.css'

interface PanelProps {
  title: string
  children: ReactNode
  actions?: ReactNode
  className?: string
}

interface PanelHeaderProps {
  title: string
  actions?: ReactNode
  /** Rendered between title and actions (e.g. inline composer when panel is collapsed) */
  middle?: ReactNode
  /** Rendered before the title (e.g. Tasks dropdown when "On the left") */
  titleLeading?: ReactNode
  /** Rendered after the title (e.g. dropdown chevron) */
  titleTrailing?: ReactNode
  /** When true, the title (h2) is centered in the remaining space between titleLeading and titleTrailing */
  centerTitle?: boolean
  /** When true, render the title before titleLeading so the title is at the far left */
  titleFirst?: boolean
  /** Optional extra class for the header root, used by DockablePanel for special layouts */
  headerClassName?: string
}

export function PanelHeader({
  title,
  actions,
  middle,
  titleLeading,
  titleTrailing,
  centerTitle,
  titleFirst,
  headerClassName,
}: PanelHeaderProps) {
  const titleEl = title ? <h2 className={styles.title}>{title}</h2> : null
  const centerGroup = centerTitle && titleTrailing != null && (
    <div className={styles.titleGroupCenter}>
      {titleEl}
      <span className={styles.titleTrailing}>{titleTrailing}</span>
    </div>
  )
  return (
    <div className={`${styles.header} ${centerGroup ? styles.headerCenterGroup : ''} ${headerClassName || ''}`}>
      <div
        className={`${styles.titleArea} ${centerTitle ? styles.titleAreaCenter : ''} ${centerGroup ? styles.titleAreaCenterGroup : ''}`}
      >
        {titleFirst ? titleEl : null}
        {titleLeading != null ? <span className={styles.titleLeading}>{titleLeading}</span> : null}
        {centerGroup ?? (
          <>
            {!titleFirst ? titleEl : null}
            {titleTrailing != null && !centerTitle ? <span className={styles.titleTrailing}>{titleTrailing}</span> : null}
          </>
        )}
        {centerTitle && titleTrailing == null ? titleEl : null}
      </div>
      {middle != null && <div className={styles.headerMiddle}>{middle}</div>}
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
  )
}

export function Panel({ title, children, actions, className }: PanelProps) {
  return (
    <>
      <PanelHeader title={title} actions={actions} />
      <div className={`${styles.panel} ${className || ''}`}>
        <div className={styles.content}>
          {children}
        </div>
      </div>
    </>
  )
}

