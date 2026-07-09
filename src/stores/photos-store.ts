import { create } from 'zustand'

export interface PhotoItem {
  id: string
  src: string
  alt: string
  date: string // ISO date string
  favorite: boolean
  albumIds: string[]
  width: number
  height: number
  isVideo?: boolean
  duration?: number // seconds, for videos
  /** For video items: the playable source URL. The grid renders a <video>
   *  element so the still frame acts as the thumbnail and the clip plays in
   *  place. Images leave this undefined and render via <img src>. */
  videoSrc?: string
  /** For video items: a pre-rendered first-frame JPEG. Shown instantly as the
   *  grid thumbnail and as the <video poster> so nothing has to decode the
   *  clip before a frame appears. Generated into public/videos/. */
  poster?: string
}

export interface Album {
  id: string
  name: string
}

export type SidebarSection =
  | 'library'
  | 'collections'
  | 'favorites'
  | 'recents'
  | 'map'
  | 'videos'
  | 'screenshots'
  | 'people'
  | 'deleted'
  | 'shared-albums'
  | 'activity'
  | 'shared-with-you'
  | 'utility-deleted'
  | 'handwriting'
  | 'utility-recents'
  | 'imports'
  | 'utility-map'
  | 'all-projects'

export type ViewMode = 'all' | 'months' | 'years'

/** Inclusive bounds for the thumbnail-size zoom level (mirrors the macOS Photos.app
 *  zoom slider's 5 discrete stops). Exported so toolbar controls can disable the
 *  zoom in / zoom out buttons at the extremes without duplicating the constants. */
export const ZOOM_MIN = 1
export const ZOOM_MAX = 5

interface PhotosState {
  photos: PhotoItem[]
  albums: Album[]
  selectedSection: SidebarSection | null
  viewMode: ViewMode
  selectedPhotoId: string | null
  searchQuery: string
  /** Thumbnail-size zoom, ZOOM_MIN..ZOOM_MAX. Continuous (float) so trackpad
   *  pinch can drive a seamless visual scale between the discrete stops the
   *  toolbar +/- buttons snap to. The grid layout snaps internally for row
   *  packing (Math.round) but interpolates the row height for smooth scaling. */
  zoom: number

  selectSection: (s: SidebarSection) => void
  setViewMode: (m: ViewMode) => void
  selectPhoto: (id: string | null) => void
  /** Toggle the `favorite` flag on a single photo by id (detail-view heart
   *  button). No-op if the id isn't in the library. */
  toggleFavorite: (id: string) => void
  setSearchQuery: (q: string) => void
  /** Snap zoom up to the next integer stop (toolbar + button). */
  zoomIn: () => void
  /** Snap zoom down to the previous integer stop (toolbar − button). */
  zoomOut: () => void
  /** Apply a fractional delta to zoom, clamped to [ZOOM_MIN, ZOOM_MAX]. Used
   *  by trackpad-pinch / Ctrl+wheel gestures for seamless (sub-stop) zoom. */
  nudgeZoom: (delta: number) => void
  /** Snap the current (possibly fractional) zoom to its nearest integer stop.
   *  Called when a trackpad-pinch gesture ends so the resting state is always
   *  one of the 5 defined zoom points — pinch is smooth during the gesture,
   *  detent-clean once released. */
  snapZoom: () => void
}

/* The library is Emily's real home movies, served from `public/videos/`.
 * Each entry is a video: the grid renders a <video> so the still first frame
 * acts as the thumbnail and the clip plays in place. Dimensions/durations are
 * the files' true values (probed via `mdls`) so the justified-row packing and
 * duration badges are accurate. */
const SAMPLE_PHOTOS: PhotoItem[] = [
  {
    id: 'video-mozart',
    src: '/videos/emily-old-movies-mozart.poster.jpg',
    videoSrc: '/videos/emily-old-movies-mozart.m4v',
    poster: '/videos/emily-old-movies-mozart.poster.jpg',
    alt: "Emily's Old Movies — Mozart",
    date: new Date(2026, 3, 12, 12, 0).toISOString(),
    favorite: true,
    albumIds: ['album-1'],
    width: 320,
    height: 240,
    isVideo: true,
    duration: 258,
  },
  {
    id: 'video-animation',
    src: '/videos/emily-old-movies-animation.poster.jpg',
    videoSrc: '/videos/emily-old-movies-animation.m4v',
    poster: '/videos/emily-old-movies-animation.poster.jpg',
    alt: "Emily's Old Movies Animation",
    date: new Date(2026, 3, 10, 14, 30).toISOString(),
    favorite: false,
    albumIds: [],
    width: 480,
    height: 272,
    isVideo: true,
    duration: 63,
  },
  {
    id: 'video-matilda',
    src: '/videos/matilda-movie-preview.poster.jpg',
    videoSrc: '/videos/matilda-movie-preview.m4v',
    poster: '/videos/matilda-movie-preview.poster.jpg',
    alt: 'Matilda Movie Preview',
    date: new Date(2026, 3, 8, 16, 15).toISOString(),
    favorite: false,
    albumIds: [],
    width: 480,
    height: 272,
    isVideo: true,
    duration: 74,
  },
]

const DEFAULT_ALBUMS: Album[] = [{ id: 'album-1', name: 'Favorites' }]

export const usePhotosStore = create<PhotosState>((set) => ({
  photos: SAMPLE_PHOTOS,
  albums: DEFAULT_ALBUMS,
  selectedSection: null,
  viewMode: 'all',
  selectedPhotoId: null,
  searchQuery: '',
  zoom: 3,

  selectSection: (s) => set({ selectedSection: s, selectedPhotoId: null }),
  setViewMode: (m) => set({ viewMode: m }),
  selectPhoto: (id) => set({ selectedPhotoId: id }),
  toggleFavorite: (id) =>
    set((st) => ({
      photos: st.photos.map((p) =>
        p.id === id ? { ...p, favorite: !p.favorite } : p,
      ),
    })),
  setSearchQuery: (q) => set({ searchQuery: q }),
  /* Snap to the next integer stop *above* the current (possibly fractional)
   * value — so pinching to 2.3 and clicking + lands you on 3, not 3.3. */
  zoomIn: () =>
    set((st) => ({ zoom: Math.min(ZOOM_MAX, Math.floor(st.zoom) + 1) })),
  /* Mirror image: snap to the next integer stop *below* the current value
   * (pinching to 2.3 and clicking − lands you on 2, not 1.3). */
  zoomOut: () =>
    set((st) => ({ zoom: Math.max(ZOOM_MIN, Math.ceil(st.zoom) - 1) })),
  nudgeZoom: (delta) =>
    set((st) => ({
      zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, st.zoom + delta)),
    })),
  snapZoom: () =>
    set((st) => ({
      zoom: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(st.zoom))),
    })),
}))

export function filterPhotosBySection(
  photos: PhotoItem[],
  section: SidebarSection | null,
): PhotoItem[] {
  if (section == null) return photos
  switch (section) {
    case 'favorites':
      return photos.filter((p) => p.favorite)
    case 'videos':
      return photos.filter((p) => p.isVideo)
    default:
      return photos
  }
}

/** A time-bucketed group of photos for the Months/Years views. `label` is the
 * human-readable section title ("April 2026", "2025"); empty string for the
 * single bucket used by the 'all' view (caller suppresses the header). */
export interface PhotosSection {
  key: string
  label: string
  sublabel: string
  photos: PhotoItem[]
}

const FMT_MONTH = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
})
const FMT_YEAR = new Intl.DateTimeFormat('en-US', { year: 'numeric' })

/** Group photos into time-based sections matching the active ViewMode.
 *
 *  - 'all'    → one synthetic section with every photo, empty label (the grid
 *               renders no header, preserving the flat-justified layout).
 *  - 'months' → one section per (year, month). Sections sorted newest-first;
 *               photos within each section sorted newest-first.
 *  - 'years'  → one section per year. Same sort.
 *
 *  Why bucket here (vs. inside the grid component): the grid only needs a
 *  list of sections to iterate, and bucketing is a pure function of (photos,
 *  mode). Keeping it next to the store gives any future caller (e.g. an
 *  alternate layout, a memo selector) a single source of truth for the
 *  Years/Months partition. */
export function bucketPhotos(
  photos: PhotoItem[],
  mode: ViewMode,
): PhotosSection[] {
  if (mode === 'all') {
    return [{ key: 'all', label: '', sublabel: '', photos }]
  }

  type Bucket = { key: string; date: Date; photos: PhotoItem[] }
  const map = new Map<string, Bucket>()

  for (const p of photos) {
    const d = new Date(p.date)
    const key =
      mode === 'years'
        ? `${d.getFullYear()}`
        : `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`
    let b = map.get(key)
    if (!b) {
      b = { key, date: d, photos: [] }
      map.set(key, b)
    }
    b.photos.push(p)
  }

  const buckets = Array.from(map.values())
  buckets.sort((a, b) => b.date.getTime() - a.date.getTime())
  for (const b of buckets) {
    b.photos.sort(
      (p1, p2) => new Date(p2.date).getTime() - new Date(p1.date).getTime(),
    )
  }

  return buckets.map((b) => {
    const fmt = mode === 'years' ? FMT_YEAR : FMT_MONTH
    return {
      key: b.key,
      label: fmt.format(b.date),
      sublabel: `${b.photos.length} ${b.photos.length === 1 ? 'item' : 'items'}`,
      photos: b.photos,
    }
  })
}
