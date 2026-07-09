import { useCallback, useEffect, useRef, useState } from 'react'

/* All SF-Symbol SVGs in the project, eagerly loaded as raw strings. Loading
 * via glob (rather than static imports) means the playback bar still builds if
 * a glyph hasn't been exported from SF Symbols.app yet — the button just
 * renders without its glyph until the file is dropped in. The four playback
 * glyphs below currently ship as custom stand-ins drawn to SF Symbol geometry
 * (so they render on web + Electron alike); swap them for real Monochrome /
 * Regular / Medium exports from /Applications/SF Symbols.app when available:
 *   play.fill--monochrome--medium.svg
 *   pause.fill--monochrome--medium.svg
 *   speaker.wave.2.fill--monochrome--medium.svg
 *   airplayvideo--monochrome--medium.svg
 */
const RAW_SYMBOLS = import.meta.glob(
  '../../../../assets/sf-symbols/*.svg',
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>

function symbol(file: string): string | undefined {
  const hit = Object.entries(RAW_SYMBOLS).find(([p]) => p.endsWith('/' + file))
  return hit?.[1]
}

const PLAY = symbol('play.fill--monochrome--medium.svg')
const PAUSE = symbol('pause.fill--monochrome--medium.svg')
const SPEAKER = symbol('speaker.wave.2.fill--monochrome--medium.svg')
const AIRPLAY = symbol('airplayvideo--monochrome--medium.svg')

const FONT = '"SF Pro", -apple-system, BlinkMacSystemFont, sans-serif'

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function Glyph({
  svg,
  size = 20,
  label,
}: {
  svg: string | undefined
  size?: number
  label?: string
}) {
  return (
    <span
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className="inline-flex shrink-0 [&>svg]:block [&>svg]:h-full [&>svg]:w-full"
      style={{ width: size, height: size }}
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  )
}

function IconButton({
  svg,
  size = 22,
  label,
  onClick,
  dim = false,
}: {
  svg: string | undefined
  size?: number
  label: string
  onClick?: () => void
  dim?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false)
        setPressed(false)
      }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      className="relative flex items-center justify-center focus:outline-none"
      style={{
        width: 34,
        height: 34,
        border: 'none',
        background: 'transparent',
        borderRadius: '50%',
        cursor: 'default',
        color: 'rgba(255,255,255,0.95)',
        opacity: dim ? 0.55 : 1,
        transition: 'opacity 120ms ease',
      }}
    >
      {/* Circular hover/press fill behind the glyph — matches the toolbar's
       * GlassButton so every control in the detail view shares one hover idiom. */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          inset: 2,
          borderRadius: '50%',
          background: pressed
            ? 'rgba(255,255,255,0.20)'
            : hovered
              ? 'rgba(255,255,255,0.12)'
              : 'transparent',
          transform: pressed ? 'scale(0.92)' : 'scale(1)',
          transition: 'background 140ms ease, transform 140ms ease',
          pointerEvents: 'none',
        }}
      />
      <span className="relative inline-flex">
        <Glyph svg={svg} size={size} />
      </span>
    </button>
  )
}

/**
 * Custom macOS-style playback bar for the detail-view video.
 *
 * Replaces the native <video controls> chrome with a floating Liquid-Glass
 * transport that matches macOS QuickTime/Photos: a rounded translucent bar
 * with volume / play / AirPlay on the top row and an elapsed time · scrubber ·
 * remaining time row beneath. Drives the <video> element passed in via
 * `videoEl` (a callback-ref value from the parent, so the bar re-binds when the
 * focused clip changes).
 */
export function VideoControls({ videoEl }: { videoEl: HTMLVideoElement | null }) {
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [muted, setMuted] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)
  const scrubbingRef = useRef(false)

  /* Mirror the element's playback state into React. Re-binds whenever the
   * focused video element changes (navigating prev/next mounts a new node). */
  useEffect(() => {
    if (!videoEl) return
    const onTime = () => {
      if (!scrubbingRef.current) setCurrent(videoEl.currentTime)
    }
    const onMeta = () => setDuration(videoEl.duration)
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onVol = () => setMuted(videoEl.muted)

    setPlaying(!videoEl.paused)
    setDuration(videoEl.duration || 0)
    setCurrent(videoEl.currentTime || 0)
    setMuted(videoEl.muted)

    videoEl.addEventListener('timeupdate', onTime)
    videoEl.addEventListener('loadedmetadata', onMeta)
    videoEl.addEventListener('durationchange', onMeta)
    videoEl.addEventListener('play', onPlay)
    videoEl.addEventListener('pause', onPause)
    videoEl.addEventListener('volumechange', onVol)
    return () => {
      videoEl.removeEventListener('timeupdate', onTime)
      videoEl.removeEventListener('loadedmetadata', onMeta)
      videoEl.removeEventListener('durationchange', onMeta)
      videoEl.removeEventListener('play', onPlay)
      videoEl.removeEventListener('pause', onPause)
      videoEl.removeEventListener('volumechange', onVol)
    }
  }, [videoEl])

  const togglePlay = useCallback(() => {
    if (!videoEl) return
    if (videoEl.paused) void videoEl.play().catch(() => {})
    else videoEl.pause()
  }, [videoEl])

  const toggleMute = useCallback(() => {
    if (!videoEl) return
    // videoEl is an HTMLVideoElement (an external DOM system, not React state);
    // toggling `.muted` is the intended imperative media API with no declarative
    // equivalent, so the immutability rule is a false positive here.
    // eslint-disable-next-line react-hooks/immutability
    videoEl.muted = !videoEl.muted
  }, [videoEl])

  const airplay = useCallback(() => {
    if (!videoEl) return
    const v = videoEl as HTMLVideoElement & {
      webkitShowPlaybackTargetPicker?: () => void
      remote?: { prompt?: () => Promise<void> }
    }
    if (typeof v.webkitShowPlaybackTargetPicker === 'function') {
      v.webkitShowPlaybackTargetPicker()
    } else if (v.remote?.prompt) {
      void v.remote.prompt().catch(() => {})
    }
  }, [videoEl])

  const seekToClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current
      if (!el || !videoEl || !Number.isFinite(videoEl.duration)) return
      const r = el.getBoundingClientRect()
      const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
      const t = ratio * videoEl.duration
      // Imperative seek on the <video> DOM element; `.currentTime` has no
      // declarative equivalent, so the immutability rule is a false positive.
      // eslint-disable-next-line react-hooks/immutability
      videoEl.currentTime = t
      setCurrent(t)
    },
    [videoEl],
  )

  const progress = duration > 0 ? current / duration : 0
  const remaining = Math.max(0, duration - current)

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        width: 420,
        maxWidth: '90%',
        padding: '10px 16px 12px',
        borderRadius: 18,
        background: 'rgba(30,30,32,0.6)',
        backdropFilter: 'blur(40px) saturate(180%)',
        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        boxShadow:
          'inset 0 0.5px 0 rgba(255,255,255,0.22), inset 0 0 0 0.5px rgba(255,255,255,0.08), 0 12px 36px -10px rgba(0,0,0,0.55)',
      }}
    >
      {/* Transport row: volume · play · airplay. */}
      <div
        className="flex items-center justify-between"
        style={{ padding: '0 2px 2px' }}
      >
        <IconButton
          svg={SPEAKER}
          label={muted ? 'Unmute' : 'Mute'}
          onClick={toggleMute}
          size={20}
          dim={muted}
        />
        <IconButton
          svg={playing ? PAUSE : PLAY}
          label={playing ? 'Pause' : 'Play'}
          onClick={togglePlay}
          size={26}
        />
        <IconButton svg={AIRPLAY} label="AirPlay" onClick={airplay} size={22} />
      </div>

      {/* Scrubber row: elapsed · track · remaining. */}
      <div className="flex items-center" style={{ gap: 12 }}>
        <span
          style={{
            fontFamily: FONT,
            fontSize: 12,
            fontWeight: 500,
            fontVariantNumeric: 'tabular-nums',
            color: 'rgba(255,255,255,0.92)',
            minWidth: 38,
          }}
        >
          {fmt(current)}
        </span>

        <div
          ref={trackRef}
          onPointerDown={(e) => {
            e.stopPropagation()
            e.currentTarget.setPointerCapture(e.pointerId)
            scrubbingRef.current = true
            seekToClientX(e.clientX)
          }}
          onPointerMove={(e) => {
            if (scrubbingRef.current) seekToClientX(e.clientX)
          }}
          onPointerUp={(e) => {
            scrubbingRef.current = false
            e.currentTarget.releasePointerCapture(e.pointerId)
          }}
          style={{
            position: 'relative',
            flex: 1,
            height: 18,
            display: 'flex',
            alignItems: 'center',
            cursor: 'default',
            touchAction: 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              height: 4,
              borderRadius: 2,
              background: 'rgba(255,255,255,0.25)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 0,
              width: `${progress * 100}%`,
              height: 4,
              borderRadius: 2,
              background: 'rgba(255,255,255,0.9)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: `${progress * 100}%`,
              transform: 'translateX(-50%)',
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: '#fff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.45)',
            }}
          />
        </div>

        <span
          style={{
            fontFamily: FONT,
            fontSize: 12,
            fontWeight: 500,
            fontVariantNumeric: 'tabular-nums',
            color: 'rgba(255,255,255,0.92)',
            minWidth: 44,
            textAlign: 'right',
          }}
        >
          {'\u2212'}
          {fmt(remaining)}
        </span>
      </div>
    </div>
  )
}
