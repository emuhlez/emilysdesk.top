import {
  Children,
  Fragment,
  createContext,
  useContext,
  useState,
  type CSSProperties,
  type PropsWithChildren,
} from 'react'

/**
 * When a `GlassCluster` wraps exactly ONE child button, the cluster paints
 * a hover overlay that fills the whole pill. Context tells the inner
 * `GlassButton` to suppress its own overlay so the two don't double-tint.
 */
export const SingleClusterHoverContext = createContext(false)

/** Shared Liquid Glass pill fill / rim / shadow (Photos toolbar + detail). */
export const GLASS_PILL_BG =
  'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.05) 60%, rgba(255,255,255,0.07) 100%)'
export const GLASS_PILL_SHADOW =
  'inset 0 0.5px 0 rgba(255,255,255,0.45), inset 0 0 0 0.5px rgba(255,255,255,0.10), 0 1px 1px rgba(0,0,0,0.18), 0 6px 14px -8px rgba(0,0,0,0.30)'
export const GLASS_PILL_BACKDROP = 'blur(20px) saturate(180%)'

export type GlassEdge = 'soft' | 'strong' | 'none'

export function GlassCluster({
  children,
  style,
  edge = 'soft',
  bare = false,
  dividers = true,
  fadeDividersOnHover = false,
  role,
}: PropsWithChildren<{
  style?: CSSProperties
  edge?: GlassEdge
  /** Transparent shell — no glass fill/shadow/backdrop (e.g. over another glass surface). */
  bare?: boolean
  /** When false, suppress thin vertical separators between children. */
  dividers?: boolean
  /** Fade inter-child dividers to 0 on cluster hover (zoom +/− pattern). */
  fadeDividersOnHover?: boolean
  role?: string
}>) {
  const [hovered, setHovered] = useState(false)
  const dividerOpacity = fadeDividersOnHover && hovered ? 0 : 1
  const fillHover = Children.count(children) === 1 && !bare

  return (
    <div
      role={role}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        flexShrink: 0,
        gap: 1,
        // Single-icon clusters are circles (equal padding → 30 + 5×2 = 40).
        // Multi-button clusters stay capsules with extra horizontal padding.
        padding: fillHover ? 5 : '5px 8px',
        borderRadius: 999,
        background: bare ? 'transparent' : GLASS_PILL_BG,
        backdropFilter: bare ? undefined : GLASS_PILL_BACKDROP,
        WebkitBackdropFilter: bare ? undefined : GLASS_PILL_BACKDROP,
        boxShadow: bare ? undefined : GLASS_PILL_SHADOW,
        filter: bare
          ? undefined
          : edge === 'strong'
            ? 'url(#photos-lg-edge-strong)'
            : edge === 'soft'
              ? 'url(#photos-lg-edge)'
              : undefined,
        isolation: 'isolate',
        ...style,
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {fillHover && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 999,
            background: hovered ? 'rgba(255,255,255,0.08)' : 'transparent',
            transition: 'background 140ms ease',
            pointerEvents: 'none',
          }}
        />
      )}
      <SingleClusterHoverContext.Provider value={fillHover}>
        {Children.toArray(children).map((child, i) => (
          <Fragment key={i}>
            {i > 0 && dividers && (
              <span
                aria-hidden
                style={{
                  width: 1,
                  height: 14,
                  alignSelf: 'center',
                  background: 'rgba(255,255,255,0.14)',
                  borderRadius: 0.5,
                  flexShrink: 0,
                  margin: '0 1px',
                  opacity: dividerOpacity,
                  transition: 'opacity 140ms ease',
                }}
              />
            )}
            {child}
          </Fragment>
        ))}
      </SingleClusterHoverContext.Provider>
    </div>
  )
}

export function GlassButton({
  onClick,
  children,
  width = 30,
  height = 30,
  hoverDiameter,
  disabled = false,
  'aria-label': ariaLabel,
  'aria-pressed': ariaPressed,
  style,
}: PropsWithChildren<{
  onClick?: () => void
  width?: number
  height?: number
  hoverDiameter?: number
  disabled?: boolean
  'aria-label'?: string
  'aria-pressed'?: boolean
  style?: CSSProperties
}>) {
  const [hovered, setHovered] = useState(false)
  const isCircle = hoverDiameter !== undefined
  const inFillHoverCluster = useContext(SingleClusterHoverContext)
  const showHover = hovered && !disabled && !inFillHoverCluster

  return (
    <div
      role={ariaLabel ? 'button' : undefined}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      tabIndex={ariaLabel ? 0 : undefined}
      className="flex items-center justify-center"
      style={{
        position: 'relative',
        flexShrink: 0,
        width,
        height,
        minWidth: width,
        minHeight: height,
        cursor: 'default',
        color: disabled ? 'rgba(255,255,255,0.32)' : 'rgba(255,255,255,0.92)',
        zIndex: 2,
        ...style,
      }}
      onClick={disabled ? undefined : onClick}
      onKeyDown={
        ariaLabel
          ? (e) => {
              if (disabled) return
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick?.()
              }
            }
          : undefined
      }
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-disabled={disabled || undefined}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          ...(isCircle
            ? {
                top: '50%',
                left: '50%',
                width: hoverDiameter,
                height: hoverDiameter,
                transform: 'translate(-50%, -50%)',
                borderRadius: '50%',
              }
            : {
                top: '50%',
                left: '50%',
                width,
                height,
                transform: 'translate(-50%, -50%)',
                borderRadius: Math.min(width, height) / 2,
              }),
          background: showHover ? 'rgba(255,255,255,0.08)' : 'transparent',
          transition: 'background 140ms ease',
          pointerEvents: 'none',
        }}
      />
      <div className="relative flex items-center justify-center">{children}</div>
    </div>
  )
}
