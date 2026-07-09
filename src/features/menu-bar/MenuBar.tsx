import { useEffect, useRef, useState } from 'react'
import { FONT_STACK } from '../../styles/typography'

/** Exact Apple logo path from assets/Menu Bar.svg, rendered without the
 *  Figma export's drop-shadow `<filter>`. The original Figma SVG wrapped the
 *  glyph in an `feOffset(dy=1) + feGaussianBlur(stdDev=3)` shadow filter
 *  that read as a soft gray halo *behind* the white apple — matched the
 *  Figma comp where the menu bar sat over a busy wallpaper, but on this
 *  app's near-black menu bar gradient the halo just looks like a dirty
 *  background patch around the glyph. macOS Tahoe's actual menu bar Apple
 *  is a flat white shape with no rim or shadow, so we render the path
 *  directly. If we ever need legibility help on a light wallpaper, the
 *  right move is a 0.5 px white inner stroke (or `text-shadow` style
 *  contrast band) — not the Figma drop shadow. */
function AppleLogo() {
  return (
    <svg
      width="12"
      height="14"
      viewBox="20.2204 7.44443 12.8139 15.7349"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M29.5085 11.2488C29.6199 11.2488 29.7924 11.2621 30.0258 11.2886C30.2646 11.3098 30.5352 11.3682 30.8376 11.4637C31.1401 11.5592 31.4478 11.7131 31.7609 11.9253C32.0739 12.1376 32.3631 12.4347 32.6284 12.8167C32.6019 12.8327 32.5011 12.9043 32.326 13.0316C32.1562 13.159 31.9625 13.3447 31.745 13.5888C31.5274 13.8275 31.3364 14.1326 31.1719 14.5041C31.0127 14.8702 30.9332 15.3079 30.9332 15.8173C30.9332 16.4009 31.034 16.8944 31.2356 17.2977C31.4425 17.7009 31.6813 18.0272 31.9519 18.2766C32.2278 18.526 32.4719 18.709 32.6841 18.8258C32.9017 18.9372 33.0184 18.9956 33.0343 19.0009C33.029 19.0221 32.9892 19.1415 32.9149 19.359C32.8407 19.5713 32.7239 19.8472 32.5647 20.1868C32.4109 20.521 32.2092 20.8712 31.9599 21.2374C31.7317 21.561 31.4956 21.8714 31.2515 22.1686C31.0127 22.4657 30.7501 22.7071 30.4636 22.8928C30.1824 23.0838 29.864 23.1793 29.5085 23.1793C29.2379 23.1793 29.0071 23.1475 28.8161 23.0838C28.625 23.0202 28.442 22.9459 28.2669 22.861C28.0971 22.7814 27.9087 22.7098 27.7018 22.6461C27.4949 22.5824 27.2375 22.5506 26.9298 22.5506C26.5265 22.5506 26.1896 22.601 25.919 22.7018C25.6537 22.8079 25.4017 22.914 25.1629 23.0202C24.9241 23.1263 24.6429 23.1793 24.3192 23.1793C23.8258 23.1793 23.3907 22.9857 23.014 22.5983C22.6425 22.211 22.2605 21.7441 21.8679 21.1976C21.5654 20.7625 21.2895 20.2611 21.0401 19.6933C20.7908 19.1256 20.5918 18.5233 20.4432 17.8866C20.2946 17.2499 20.2204 16.6132 20.2204 15.9765C20.2204 14.9577 20.414 14.0981 20.8014 13.3978C21.1887 12.6921 21.6848 12.1588 22.2897 11.798C22.8946 11.4319 23.5233 11.2488 24.176 11.2488C24.5209 11.2488 24.8445 11.3098 25.147 11.4319C25.4547 11.5539 25.7412 11.676 26.0065 11.798C26.2718 11.9147 26.5133 11.9731 26.7308 11.9731C26.9377 11.9731 27.1818 11.9147 27.463 11.798C27.7443 11.676 28.0547 11.5539 28.3942 11.4319C28.7391 11.3098 29.1105 11.2488 29.5085 11.2488ZM28.9514 9.95947C28.6861 10.2831 28.3518 10.5511 27.9485 10.7633C27.5506 10.9756 27.1739 11.0817 26.8184 11.0817C26.7441 11.0817 26.6724 11.0737 26.6035 11.0578C26.5982 11.0366 26.5902 10.9994 26.5796 10.9464C26.5743 10.8933 26.5716 10.835 26.5716 10.7713C26.5716 10.368 26.6592 9.97539 26.8343 9.59336C27.0094 9.21133 27.211 8.89297 27.4392 8.63828C27.7204 8.304 28.0759 8.02544 28.5057 7.80259C28.9408 7.57974 29.3573 7.46035 29.7552 7.44443C29.7711 7.53464 29.7791 7.6381 29.7791 7.75483C29.7791 8.1634 29.7022 8.56135 29.5483 8.94868C29.3944 9.33071 29.1954 9.66764 28.9514 9.95947Z"
        fill="white"
      />
    </svg>
  )
}

/** Exact Control Center icon path from assets/Menu Bar.svg (line 20, no filter group) */
function ControlCenterIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="1209.82 11.1074 12.36 12.6065"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M1212.69 23.7139C1212.16 23.7139 1211.67 23.5954 1211.23 23.3584C1210.8 23.1257 1210.46 22.8019 1210.2 22.3872C1209.94 21.9725 1209.82 21.4922 1209.82 20.9463C1209.82 20.4004 1209.94 19.9201 1210.2 19.5054C1210.46 19.0907 1210.8 18.7669 1211.23 18.5342C1211.67 18.2972 1212.16 18.1787 1212.69 18.1787H1219.3C1219.84 18.1787 1220.32 18.2972 1220.75 18.5342C1221.19 18.7669 1221.54 19.0907 1221.79 19.5054C1222.05 19.9201 1222.18 20.4004 1222.18 20.9463C1222.18 21.4922 1222.05 21.9725 1221.79 22.3872C1221.54 22.8019 1221.19 23.1257 1220.75 23.3584C1220.32 23.5954 1219.84 23.7139 1219.3 23.7139H1212.69ZM1219.47 22.4634C1219.74 22.4634 1219.99 22.3936 1220.22 22.2539C1220.45 22.1185 1220.63 21.9344 1220.77 21.7017C1220.91 21.4689 1220.98 21.2108 1220.98 20.9272C1220.98 20.6522 1220.92 20.4025 1220.78 20.1782C1220.64 19.9497 1220.46 19.7677 1220.23 19.6323C1220 19.4969 1219.75 19.4292 1219.47 19.4292C1219.19 19.4292 1218.93 19.4969 1218.7 19.6323C1218.48 19.7677 1218.29 19.9497 1218.16 20.1782C1218.02 20.4067 1217.96 20.6606 1217.96 20.9399C1217.96 21.2192 1218.02 21.4731 1218.16 21.7017C1218.29 21.9302 1218.48 22.1121 1218.7 22.2476C1218.93 22.3872 1219.19 22.4591 1219.47 22.4634ZM1212.95 17.2075C1212.36 17.2075 1211.83 17.0806 1211.35 16.8267C1210.88 16.5728 1210.51 16.2173 1210.23 15.7603C1209.95 15.299 1209.82 14.7658 1209.82 14.1606C1209.82 13.5513 1209.95 13.0181 1210.23 12.561C1210.51 12.0998 1210.88 11.7422 1211.35 11.4883C1211.83 11.2344 1212.36 11.1074 1212.95 11.1074H1219.04C1219.63 11.1074 1220.17 11.2344 1220.64 11.4883C1221.11 11.7422 1221.49 12.0998 1221.76 12.561C1222.04 13.0181 1222.18 13.5513 1222.18 14.1606C1222.18 14.7658 1222.04 15.299 1221.76 15.7603C1221.49 16.2173 1221.11 16.5728 1220.64 16.8267C1220.17 17.0806 1219.63 17.2075 1219.04 17.2075H1212.95ZM1212.95 15.9316H1219.04C1219.38 15.9316 1219.69 15.8576 1219.97 15.7095C1220.25 15.5571 1220.48 15.3477 1220.65 15.0811C1220.82 14.8145 1220.9 14.5076 1220.9 14.1606C1220.9 13.8094 1220.82 13.5026 1220.65 13.2402C1220.48 12.9736 1220.25 12.7663 1219.97 12.6182C1219.69 12.4658 1219.38 12.3896 1219.04 12.3896H1212.95C1212.61 12.3896 1212.3 12.4658 1212.02 12.6182C1211.74 12.7663 1211.52 12.9736 1211.35 13.2402C1211.18 13.5026 1211.09 13.8094 1211.09 14.1606C1211.09 14.5076 1211.18 14.8145 1211.35 15.0811C1211.52 15.3477 1211.74 15.5571 1212.02 15.7095C1212.3 15.8576 1212.61 15.9316 1212.95 15.9316ZM1212.95 15.519C1212.7 15.519 1212.47 15.4577 1212.26 15.335C1212.06 15.2122 1211.9 15.0472 1211.77 14.8398C1211.65 14.6325 1211.59 14.404 1211.59 14.1543C1211.59 13.9046 1211.65 13.6761 1211.77 13.4688C1211.9 13.2614 1212.06 13.0964 1212.26 12.9736C1212.47 12.8509 1212.7 12.7896 1212.95 12.7896C1213.21 12.7896 1213.44 12.8509 1213.65 12.9736C1213.85 13.0921 1214.02 13.255 1214.14 13.4624C1214.26 13.6655 1214.32 13.894 1214.32 14.1479C1214.32 14.4019 1214.26 14.6325 1214.13 14.8398C1214.01 15.0472 1213.85 15.2144 1213.64 15.3413C1213.44 15.464 1213.21 15.5233 1212.95 15.519Z"
        fill="white"
        fillOpacity="0.85"
      />
    </svg>
  )
}

/**
 * Selection pill from assets/Menu Bar Selection.svg:
 * - Rounded rect (12.5px radius at 25px height) with backdrop-filter blur(30px)
 * - White fill at 8% opacity, mix-blend-mode: plus-lighter
 * Rendered as an absolute-positioned background behind the active menu item.
 */
function MenuItemSelection() {
  return (
    <div
      className="pointer-events-none absolute inset-y-0 overflow-hidden"
      style={{
        left: -4,
        right: -4,
        borderRadius: 99,
        backdropFilter: 'blur(30px) saturate(150%)',
        WebkitBackdropFilter: 'blur(30px) saturate(150%)',
        boxShadow:
          'inset 0 0.5px 0 0 rgba(255,255,255,0.15), 0 0.5px 1px 0 rgba(0,0,0,0.08)',
        border: '0.5px solid rgba(255,255,255,0.04)',
      }}
    >
      <div
        className="h-full w-full"
        style={{
          borderRadius: 99,
          backgroundColor: 'rgba(100,100,100,0.40)',
        }}
      />
    </div>
  )
}

function formatMenuBarDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).replace(',', '')
}

function formatMenuBarTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  })
}

export function MenuBar({
  appName = 'Finder',
  menuItems = ['File', 'Edit', 'View', 'Go', 'Window', 'Help'],
  fullscreen = false,
}: {
  appName?: string
  menuItems?: string[]
  fullscreen?: boolean
}) {
  const [date, setDate] = useState(() => formatMenuBarDate(new Date()))
  const [time, setTime] = useState(() => formatMenuBarTime(new Date()))
  const [activeItem, setActiveItem] = useState<string | null>(null)
  const [hovered, setHovered] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const update = () => {
      const now = new Date()
      setDate(formatMenuBarDate(now))
      setTime(formatMenuBarTime(now))
    }
    const interval = setInterval(update, 1_000)
    return () => clearInterval(interval)
  }, [])

  // Close selection when clicking outside
  useEffect(() => {
    if (!activeItem) return
    const handleClick = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setActiveItem(null)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [activeItem])

  const handleItemClick = (item: string) => {
    setActiveItem(item)
  }

  const visible = !fullscreen || hovered

  return (
    <>
      {/* Hover trigger zone in fullscreen */}
      {fullscreen && (
        <div
          className="fixed inset-x-0 top-0 z-50"
          style={{ height: 4 }}
          onMouseEnter={() => setHovered(true)}
        />
      )}
      <div
        ref={barRef}
        className="fixed inset-x-0 top-0 flex items-center justify-between"
        style={{
          height: 28,
          paddingTop: 2,
          paddingLeft: 6,
          paddingRight: 6,
          fontFamily: FONT_STACK,
          fontSize: 12,
          color: 'white',
          background: fullscreen ? 'rgba(0, 0, 0, 0.85)' : 'transparent',
          zIndex: fullscreen ? 50 : 30,
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.2s ease',
          pointerEvents: visible ? 'auto' : 'none',
        }}
        onMouseEnter={() => fullscreen && setHovered(true)}
        onMouseLeave={() => fullscreen && setHovered(false)}
      >
      {/* Background: exact reproduction of SVG mask + gradient + blend */}
      {!fullscreen && (
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="menubar-bg-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopOpacity="0.4" />
            <stop offset="1" stopOpacity="0" />
          </linearGradient>
          <mask id="menubar-bg-mask" maskUnits="objectBoundingBox" style={{ maskType: 'alpha' } as React.CSSProperties}>
            <rect width="1" height="1" fill="url(#menubar-bg-grad)" />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="black"
          fillOpacity="0.12"
          mask="url(#menubar-bg-mask)"
          style={{ mixBlendMode: 'plus-darker' }}
        />
      </svg>
      )}

      {/* Left cluster — app + menu items. Allowed to clip first under narrow widths. */}
      <div className="relative z-10 flex min-w-0 items-center gap-1 overflow-hidden">
        <button
          className="relative flex shrink-0 items-center whitespace-nowrap rounded-[7px] px-2.5 opacity-90"
          style={{ height: 25 }}
          onClick={() => handleItemClick('apple')}
          aria-label="Apple menu"
        >
          {activeItem === 'apple' && <MenuItemSelection />}
          <span className="relative z-10"><AppleLogo /></span>
        </button>
        <button
          className={`relative flex shrink-0 items-center whitespace-nowrap rounded-[7px] px-2.5 ${fullscreen ? 'opacity-85 font-medium' : 'font-bold'}`}
          style={{ height: 25 }}
          onClick={() => handleItemClick('appName')}
        >
          {activeItem === 'appName' && <MenuItemSelection />}
          <span className="relative z-10">{appName}</span>
        </button>
        {menuItems.map((item) => (
          <button
            key={item}
            className="relative flex shrink-0 items-center whitespace-nowrap rounded-[7px] px-2.5 opacity-85 font-medium"
            style={{ height: 25 }}
            onClick={() => handleItemClick(item)}
          >
            {activeItem === item && <MenuItemSelection />}
            <span className="relative z-10">{item}</span>
          </button>
        ))}
      </div>

      {/* Right cluster — control center + date/time. Pinned: never shrinks, never wraps. */}
      <div className="relative z-10 flex shrink-0 items-center gap-0.5">
        <button
          className="relative flex shrink-0 items-center whitespace-nowrap rounded-[7px] px-2.5 opacity-85 font-medium"
          style={{ height: 25 }}
          onClick={() => handleItemClick('controlCenter')}
          aria-label="Control Center"
        >
          {activeItem === 'controlCenter' && <MenuItemSelection />}
          <span className="relative z-10"><ControlCenterIcon /></span>
        </button>
        <button
          className="relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[7px] px-2.5 opacity-85 font-medium"
          style={{ height: 25 }}
          onClick={() => handleItemClick('datetime')}
          aria-label={`${date} ${time}`}
        >
          {activeItem === 'datetime' && <MenuItemSelection />}
          <span className="relative z-10">{date}</span>
          <span className="relative z-10">{time}</span>
        </button>
      </div>
    </div>
    </>
  )
}
