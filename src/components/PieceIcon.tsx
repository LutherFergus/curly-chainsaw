import type { CatalogPiece } from '../types/knex'

/** Compact SVG silhouette for palette icons — no labels. */
export function PieceIcon({ piece }: { piece: CatalogPiece }) {
  const color = piece.color
  const accent = piece.accent ?? color

  if (piece.category === 'rods') {
    const lengths: Record<string, number> = {
      'rod-green': 16,
      'rod-white': 22,
      'rod-blue': 28,
      'rod-yellow': 38,
      'rod-red': 48,
      'rod-gray': 56,
      'flexi-white': 22,
      'flexi-blue': 28,
      'flexi-yellow': 38,
      'flexi-gray': 56,
    }
    const len = lengths[piece.id] ?? 32
    const x = (64 - len) / 2
    const wavy = Boolean(piece.flexi)
    return (
      <svg viewBox="0 0 64 64" className="piece-icon" aria-hidden="true">
        {wavy ? (
          <path
            d={`M${x} 30 Q${x + len * 0.25} 22 ${x + len * 0.5} 30 T${x + len} 30`}
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeLinecap="round"
          />
        ) : (
          <>
            <rect x={x} y="28" width={len} height="4" rx="1" fill={color} />
            <rect x={x} y="30.5" width={len} height="1.2" fill={accent} opacity="0.55" />
          </>
        )}
        <circle cx={x} cy="30" r="3.2" fill={color} />
        <circle cx={x + len} cy="30" r="3.2" fill={color} />
      </svg>
    )
  }

  if (piece.category === 'spacers') {
    const thick = piece.id === 'spacer-silver' ? 10 : 4
    return (
      <svg viewBox="0 0 64 64" className="piece-icon" aria-hidden="true">
        <rect x={32 - thick / 2} y="18" width={thick} height="28" rx="2" fill={color} />
        <circle cx="32" cy="32" r="6" fill="#1a1b1e" opacity="0.35" />
      </svg>
    )
  }

  if (piece.variant === 'hole-clip') {
    return (
      <svg viewBox="0 0 64 64" className="piece-icon" aria-hidden="true">
        <circle cx="22" cy="32" r="7" fill="none" stroke={color} strokeWidth="4" />
        <rect x="28" y="28" width="14" height="8" rx="1" fill={color} />
        <path d="M42 26 h10 v12 h-4 v-4 h-6 z" fill={accent} />
      </svg>
    )
  }

  if (piece.variant === 'rod-end-clip') {
    return (
      <svg viewBox="0 0 64 64" className="piece-icon" aria-hidden="true">
        <path d="M14 24 h8 v16 h-8 a8 8 0 0 1 0-16z" fill={color} />
        <rect x="22" y="28" width="16" height="8" rx="1" fill={color} />
        <rect x="38" y="29.5" width="6" height="5" rx="1" fill={accent} />
        <circle cx="50" cy="32" r="6" fill={color} />
      </svg>
    )
  }

  if (piece.variant === 'lock-clip') {
    return (
      <svg viewBox="0 0 64 64" className="piece-icon" aria-hidden="true">
        <path d="M20 24 h8 v16 h-8 a8 8 0 0 1 0-16z" fill={color} />
        <rect x="28" y="28" width="18" height="8" rx="1" fill={accent} />
      </svg>
    )
  }

  if (piece.variant === 'hinge') {
    return (
      <svg viewBox="0 0 64 64" className="piece-icon" aria-hidden="true">
        <circle cx="32" cy="32" r="5" fill={accent} />
        <rect x="12" y="28" width="16" height="8" rx="2" fill={color} />
        <rect x="36" y="28" width="16" height="8" rx="2" fill={color} />
      </svg>
    )
  }

  if (piece.variant === 'end-cap') {
    return (
      <svg viewBox="0 0 64 64" className="piece-icon" aria-hidden="true">
        <rect x="24" y="20" width="16" height="24" rx="3" fill={color} />
        <circle cx="32" cy="32" r="5" fill="#1a1b1e" opacity="0.3" />
      </svg>
    )
  }

  if (piece.variant === 'ball-clip' || piece.variant === 'socket-clip') {
    return (
      <svg viewBox="0 0 64 64" className="piece-icon" aria-hidden="true">
        <rect x="14" y="28" width="20" height="8" rx="2" fill={color} />
        <circle cx="44" cy="32" r="8" fill={accent} opacity={piece.variant === 'socket-clip' ? 0.35 : 1} />
      </svg>
    )
  }

  if (piece.variant === 'half-half') {
    return (
      <svg viewBox="0 0 64 64" className="piece-icon" aria-hidden="true">
        <path
          d="M12 40 A20 20 0 0 1 52 40 L44 40 A12 12 0 0 0 20 40 Z"
          fill={color}
        />
        {[45, 90, 135, 180].map((deg, i) => {
          const a = ((deg - 90) * Math.PI) / 180
          const cx = 32 + Math.cos(a) * 18
          const cy = 40 + Math.sin(a) * 18
          return <circle key={i} cx={cx} cy={cy} r="3.2" fill={accent} />
        })}
        <ellipse cx="32" cy="32" rx="6" ry="14" fill={accent} opacity="0.9" />
        <rect x="42" y="36" width="10" height="8" rx="1" fill="#1a1b1e" opacity="0.45" />
      </svg>
    )
  }

  if (piece.variant === 'half') {
    return (
      <svg viewBox="0 0 64 64" className="piece-icon" aria-hidden="true">
        <path
          d="M12 40 A20 20 0 0 1 52 40 L44 40 A12 12 0 0 0 20 40 Z"
          fill={color}
        />
        {[45, 90, 135, 180].map((deg, i) => {
          const a = ((deg - 90) * Math.PI) / 180
          const cx = 32 + Math.cos(a) * 18
          const cy = 40 + Math.sin(a) * 18
          return <circle key={i} cx={cx} cy={cy} r="3.2" fill={accent} />
        })}
        <rect x="42" y="36" width="10" height="8" rx="1" fill="#1a1b1e" opacity="0.45" />
      </svg>
    )
  }

  if (piece.variant === 'full' || piece.variant === 'double-full' || piece.variant === 'full-half') {
    const second = piece.variant !== 'full'
    return (
      <svg viewBox="0 0 64 64" className="piece-icon" aria-hidden="true">
        <circle cx="32" cy="32" r="14" fill={color} />
        <circle cx="32" cy="32" r="4" fill="#1a1b1e" opacity="0.3" />
        {Array.from({ length: 7 }).map((_, i) => {
          const a = (i / 8) * Math.PI * 2 - Math.PI / 2
          return (
            <circle
              key={i}
              cx={32 + Math.cos(a) * 18}
              cy={32 + Math.sin(a) * 18}
              r="3"
              fill={accent}
            />
          )
        })}
        <rect x="29" y="40" width="6" height="12" rx="1" fill="#1a1b1e" opacity="0.4" />
        {second && (
          <g opacity="0.85">
            <ellipse cx="32" cy="32" rx="6" ry="14" fill={piece.accent ?? color} />
          </g>
        )}
      </svg>
    )
  }

  if (piece.category === 'connectors' || piece.category === 'clips') {
    // Clip dots follow catalog directions (XZ plate) so grey 2-way is 45°, not 180°.
    const clipDirs = piece.ports.filter(
      (p) =>
        p.kind === 'socket' &&
        !p.id.startsWith('center') &&
        p.id !== 'hole' &&
        p.id !== 'bore' &&
        Math.abs(p.direction[1]) <= 0.35,
    )
    return (
      <svg viewBox="0 0 64 64" className="piece-icon" aria-hidden="true">
        <circle cx="32" cy="32" r="10" fill={color} />
        <circle cx="32" cy="32" r="3.5" fill="#1a1b1e" opacity="0.28" />
        {clipDirs.map((port, i) => {
          const angle = Math.atan2(port.direction[0], port.direction[2]) - Math.PI / 2
          return (
            <circle
              key={port.id ?? i}
              cx={32 + Math.cos(angle) * 18}
              cy={32 + Math.sin(angle) * 18}
              r="3.2"
              fill={accent}
            />
          )
        })}
      </svg>
    )
  }

  if (piece.category === 'wheels') {
    const tire = piece.variant === 'wheel-tire'
    const spoke = piece.variant === 'wheel-spoke'
    const race = piece.variant === 'wheel-race'
    const thin = piece.variant === 'wheel-thin'
    const odHint = (piece.radius ?? 0) * 75 // ≈ OD in mm (scene unit = 37.5 mm)
    const r = thin ? 10 : Math.min(20, Math.max(12, odHint * 0.2))
    return (
      <svg viewBox="0 0 64 64" className="piece-icon" aria-hidden="true">
        {tire ? (
          <>
            <circle cx="32" cy="32" r={r} fill={color} />
            <circle cx="32" cy="32" r={r * 0.62} fill={accent} />
            <circle cx="32" cy="32" r={r * 0.38} fill={color} opacity="0.35" />
          </>
        ) : spoke ? (
          <>
            <circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="3.5" />
            <circle cx="32" cy="32" r="5" fill={accent} />
            {[0, 60, 120, 180, 240, 300].map((deg) => {
              const a = (deg * Math.PI) / 180
              return (
                <line
                  key={deg}
                  x1={32 + Math.cos(a) * 5}
                  y1={32 + Math.sin(a) * 5}
                  x2={32 + Math.cos(a) * (r - 2)}
                  y2={32 + Math.sin(a) * (r - 2)}
                  stroke={accent}
                  strokeWidth="2"
                />
              )
            })}
          </>
        ) : (
          <>
            <circle cx="32" cy="32" r={r} fill={color} />
            <circle cx="32" cy="32" r={r * 0.55} fill={accent} />
            {(piece.variant === 'wheel-pulley' || thin) && (
              <circle
                cx="32"
                cy="32"
                r={r * 0.78}
                fill="none"
                stroke={accent}
                strokeWidth="1.5"
                opacity="0.7"
              />
            )}
            {race && (
              <circle
                cx="32"
                cy="32"
                r={r * 0.72}
                fill="none"
                stroke={color}
                strokeWidth="2"
                opacity="0.85"
              />
            )}
          </>
        )}
        <circle cx="32" cy="32" r="3.5" fill="#1a1b1e" opacity="0.4" />
      </svg>
    )
  }

  if (piece.category === 'panels') {
    const tri = piece.variant === 'panel-tri'
    return (
      <svg viewBox="0 0 64 64" className="piece-icon" aria-hidden="true">
        {tri ? (
          <path d="M32 12 L52 50 L12 50 Z" fill={color} />
        ) : (
          <rect x="14" y="14" width="36" height="36" rx="2" fill={color} />
        )}
        <circle cx="32" cy="32" r="3" fill={accent} opacity="0.5" />
      </svg>
    )
  }

  if (piece.category === 'chain') {
    return (
      <svg viewBox="0 0 64 64" className="piece-icon" aria-hidden="true">
        <ellipse cx="24" cy="32" rx="10" ry="7" fill="none" stroke={color} strokeWidth="4" />
        <ellipse cx="40" cy="32" rx="10" ry="7" fill="none" stroke={accent} strokeWidth="4" />
      </svg>
    )
  }

  if (piece.category === 'gears') {
    const teeth = Math.min(piece.teeth ?? 12, 18)
    const tip = 26
    const root = 20
    const hub = piece.id === 'gear-large' ? 7 : 9
    const cx = 32
    const cy = 32
    const pts: string[] = []
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2 - Math.PI / teeth
      const t0 = a + Math.PI / teeth - Math.PI / teeth * 0.35
      const t1 = a + Math.PI / teeth + Math.PI / teeth * 0.35
      const v1 = a + (Math.PI * 2) / teeth
      pts.push(
        `${cx + Math.cos(a) * root},${cy + Math.sin(a) * root}`,
        `${cx + Math.cos(t0) * tip},${cy + Math.sin(t0) * tip}`,
        `${cx + Math.cos(t1) * tip},${cy + Math.sin(t1) * tip}`,
        `${cx + Math.cos(v1) * root},${cy + Math.sin(v1) * root}`,
      )
    }
    return (
      <svg viewBox="0 0 64 64" className="piece-icon" aria-hidden="true">
        <polygon points={pts.join(' ')} fill={color} />
        {piece.id === 'gear-large' &&
          Array.from({ length: 6 }).map((_, i) => {
            const a = (i / 6) * Math.PI * 2
            return (
              <line
                key={i}
                x1={cx + Math.cos(a) * hub}
                y1={cy + Math.sin(a) * hub}
                x2={cx + Math.cos(a) * 17}
                y2={cy + Math.sin(a) * 17}
                stroke={accent}
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            )
          })}
        <circle cx={cx} cy={cy} r={hub} fill={accent} />
        <circle cx={cx} cy={cy} r="3.2" fill="#1a1b1e" opacity="0.4" />
      </svg>
    )
  }

  // Fallback for unknown categories
  return (
    <svg viewBox="0 0 64 64" className="piece-icon" aria-hidden="true">
      <circle cx="32" cy="32" r="12" fill={color} />
      <circle cx="32" cy="32" r="4" fill="#1a1b1e" opacity="0.3" />
    </svg>
  )
}
