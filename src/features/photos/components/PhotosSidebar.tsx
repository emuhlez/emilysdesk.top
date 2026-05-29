import { usePhotosStore, type SidebarSection } from '../../../stores/photos-store'
import { FONT_STACK } from '../../../styles/typography'
import libraryGlyphSvg from '../../../../assets/sf-symbols/photo.on.rectangle--monochrome--medium.svg?raw'
import collectionsGlyphSvg from '../../../../assets/sf-symbols/rectangle.stack--monochrome--medium.svg?raw'
import favoritesGlyphSvg from '../../../../assets/sf-symbols/heart--monochrome--medium.svg?raw'
import videosGlyphSvg from '../../../../assets/sf-symbols/video--monochrome--medium.svg?raw'

type NavItem = {
  id: SidebarSection
  label: string
  iconSvg: string
}

const TOP_ITEMS: NavItem[] = [
  { id: 'library', label: 'Library', iconSvg: libraryGlyphSvg },
  { id: 'collections', label: 'Collections', iconSvg: collectionsGlyphSvg },
]

const PINNED_ITEMS: NavItem[] = [
  { id: 'favorites', label: 'Favorites', iconSvg: favoritesGlyphSvg },
  { id: 'videos', label: 'Videos', iconSvg: videosGlyphSvg },
]

function SectionHeader({ children }: { children: string }) {
  return (
    <div className="shrink-0">
      <span
        style={{
          fontFamily: FONT_STACK,
          fontSize: 12,
          fontWeight: 600,
          lineHeight: 'normal',
          letterSpacing: '-0.12px',
          color: '#989798',
          whiteSpace: 'nowrap',
        }}
      >
        {children}
      </span>
    </div>
  )
}

function SidebarRow({
  item,
  isActive,
  onSelect,
}: {
  item: NavItem
  isActive: boolean
  onSelect: () => void
}) {
  return (
    <div
      className="relative flex w-full shrink-0 cursor-default items-center"
      style={{
        padding: '4px 12px',
        gap: 8,
        borderRadius: 6,
        color: '#ffffff',
        background: isActive
          ? 'linear-gradient(180deg, rgba(10,132,255,0.95) 0%, rgba(10,132,255,0.82) 100%)'
          : undefined,
        boxShadow: isActive
          ? 'inset 0 0.5px 0 rgba(255,255,255,0.35), 0 1px 3px rgba(10,132,255,0.28)'
          : undefined,
        transition:
          'background 140ms cubic-bezier(0.32, 0.72, 0, 1), box-shadow 140ms cubic-bezier(0.32, 0.72, 0, 1)',
      }}
      onClick={onSelect}
      onMouseEnter={(e) => {
        if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'
      }}
      onMouseLeave={(e) => {
        if (!isActive) (e.currentTarget as HTMLElement).style.background = ''
        else {
          (e.currentTarget as HTMLElement).style.background =
            'linear-gradient(180deg, rgba(10,132,255,0.95) 0%, rgba(10,132,255,0.82) 100%)'
        }
      }}
    >
      <div
        className="flex shrink-0 items-center justify-center"
        style={{
          width: 16,
          height: 16,
          transform: 'translateY(0.5px)',
        }}
      >
        <span
          className="inline-flex shrink-0 [&>svg]:block [&>svg]:h-4 [&>svg]:w-4"
          style={{
            color: isActive ? '#ffffff' : 'rgba(255,255,255,0.88)',
          }}
          dangerouslySetInnerHTML={{ __html: item.iconSvg }}
        />
      </div>
      <span
        style={{
          fontFamily: FONT_STACK,
          fontSize: 12,
          fontWeight: 400,
          letterSpacing: '-0.08px',
          whiteSpace: 'nowrap',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {item.label}
      </span>
    </div>
  )
}

export function PhotosSidebar({
  width,
  onResizeStart,
  topContentInset = 0,
}: {
  width: number
  onResizeStart: (e: React.PointerEvent) => void
  /** Extra top padding inside the sidebar to clear the toolbar / traffic lights area. */
  topContentInset?: number
}) {
  const selectedSection = usePhotosStore((s) => s.selectedSection)
  const selectSection = usePhotosStore((s) => s.selectSection)

  return (
    <div
      className="relative flex h-full min-h-0 w-full shrink-0 flex-col"
      style={{
        width,
        borderRadius: 18,
        boxShadow:
          '0 6px 18px -10px rgba(0,0,0,0.45), 0 1px 3px rgba(0,0,0,0.25)',
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background: 'transparent',
          backdropFilter: 'blur(34px) saturate(200%)',
          WebkitBackdropFilter: 'blur(34px) saturate(200%)',
          borderRadius: 18,
          boxShadow:
            '0 0 0 0.5px rgba(255,255,255,0.08), inset 0 0.5px 0 rgba(255,255,255,0.22), inset 0 -0.5px 0 rgba(255,255,255,0.05), inset 0 0 0 0.5px rgba(255,255,255,0.10)',
          filter: 'url(#photos-lg-sidebar)',
        }}
      />
      <div
        className="relative z-[1] flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden"
        style={{
          paddingLeft: 18,
          paddingRight: 18,
          paddingTop: 8 + topContentInset,
          paddingBottom: 18,
          borderRadius: 18,
        }}
      >
        <div className="flex w-full flex-col" style={{ width: '100%' }}>
          {TOP_ITEMS.map((item) => (
            <SidebarRow
              key={item.id}
              item={item}
              isActive={selectedSection === item.id}
              onSelect={() => selectSection(item.id)}
            />
          ))}
        </div>

        <div className="flex w-full flex-col" style={{ marginTop: 20, width: '100%' }}>
          <SectionHeader>Pinned</SectionHeader>
          <div className="flex flex-col">
            {PINNED_ITEMS.map((item) => (
              <SidebarRow
                key={item.id}
                item={item}
                isActive={selectedSection === item.id}
                onSelect={() => selectSection(item.id)}
              />
            ))}
          </div>
        </div>
      </div>

      <div
        className="absolute top-0 z-[2] h-full w-2 cursor-col-resize"
        style={{ right: -4, touchAction: 'none' }}
        onPointerDown={onResizeStart}
      />
    </div>
  )
}
