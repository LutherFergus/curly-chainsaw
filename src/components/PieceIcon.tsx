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

  if (piece.variant === 'lock-clip' || piece.variant === 'rod-end-clip') {
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
    const r = piece.id === 'wheel-25' ? 12 : piece.id === 'wheel-hub-50' ? 16 : 18
    return (
      <svg viewBox="0 0 64 64" className="piece-icon" aria-hidden="true">
        <circle cx="32" cy="32" r={r} fill={color} />
        <circle cx="32" cy="32" r={r * 0.55} fill={accent} />
        <circle cx="32" cy="32" r="4" fill="#1a1b1e" opacity="0.35" />
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

  const teeth = piece.teeth ?? (piece.id === 'gear-large' ? 10 : 8)
  return (
    <svg viewBox="0 0 64 64" className="piece-icon" aria-hidden="true">
      <circle cx="32" cy="32" r="12" fill={color} />
      {Array.from({ length: Math.min(teeth, 16) }).map((_, i) => {
        const a = (i / Math.min(teeth, 16)) * Math.PI * 2
        return (
          <rect
            key={i}
            x="29"
            y="10"
            width="6"
            height="10"
            rx="1"
            fill={color}
            transform={`rotate(${(a * 180) / Math.PI} 32 32)`}
          />
        )
      })}
      <circle cx="32" cy="32" r="4" fill="#1a1b1e" opacity="0.3" />
    </svg>
  )
}
