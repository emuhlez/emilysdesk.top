import { useReducedMotion } from 'framer-motion'

// Still poster + animated Sequoia loop. The still (`/wallpaper.jpg`) is shared
// with the lock-screen splash + Liquid Glass feImage refraction; the video only
// plays on the unlocked desktop.
const wallpaperPosterUrl = '/wallpaper.jpg'
const wallpaperVideoUrl = '/wallpaper-sequoia.mp4'

/**
 * macOS Sequoia dynamic wallpaper — looping H.264 video with still poster
 * fallback for reduced-motion / before the first frame is ready.
 */
export function Wallpaper() {
  const reduceMotion = useReducedMotion()

  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden" style={{ backgroundColor: '#0b0c10' }}>
      {/* Poster always underneath so there's never a black flash. */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${wallpaperPosterUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: '50% 50%',
          backgroundRepeat: 'no-repeat',
        }}
      />
      {!reduceMotion && (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={wallpaperVideoUrl}
          poster={wallpaperPosterUrl}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        />
      )}
      {/* Light overlay for chrome legibility */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: [
            'radial-gradient(120% 90% at 30% 15%, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 55%)',
            'linear-gradient(180deg, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.28) 100%)',
          ].join(','),
        }}
      />
      {/* subtle vignette */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(120%_120%_at_50%_30%,rgba(255,255,255,0.08)_0%,rgba(0,0,0,0.45)_70%,rgba(0,0,0,0.65)_100%)]" />
      {/* light grain */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.065] mix-blend-overlay"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27160%27 height=%27160%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.9%27 numOctaves=%274%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27160%27 height=%27160%27 filter=%27url(%23n)%27 opacity=%270.55%27/%3E%3C/svg%3E")',
          backgroundSize: '240px 240px',
        }}
      />
    </div>
  )
}
