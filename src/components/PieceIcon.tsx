import type { CatalogPiece } from '../types/knex'

/** Compact SVG silhouette for palette icons — no labels. */
export function PieceIcon({ piece }: { piece: CatalogPiece }) {
  const color = piece.color
  const accent = piece.accent ?? color

  if (piece.category === 'rods') {
    // Relative length scaled for icon (green shortest → gray longest)
    const lengths: Record<string, number> = {
      'rod-green': 16,
      'rod-white': 22,
      'rod-blue': 28,
      'rod-yellow': 38,
      'rod-red': 48,
      'rod-gray': 56,
    }
    const len = lengths[piece.id] ?? 32
    const x = (64 - len) / 2
    return (
      <svg viewBox="0 0 64 64" className="piece-icon" aria-hidden="true">
        <rect x={x} y="28" width={len} height="4" rx="1" fill={color} />
        <rect x={x} y="30.5" width={len} height="1.2" fill={accent} opacity="0.55" />
        <circle cx={x} cy="30" r="3.2" fill={color} />
        <circle cx={x + len} cy="30" r="3.2" fill={color} />
        <circle cx={x} cy="30" r="1.6" fill="#1a1b1e" opacity="0.25" />
        <circle cx={x + len} cy="30" r="1.6" fill="#1a1b1e" opacity="0.25" />
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

  if (piece.category === 'connectors') {
    const sockets = piece.ports.filter(
      (p) => p.kind === 'socket' && !p.id.startsWith('center'),
    ).length
    const count = Math.min(8, Math.max(2, sockets))
    return (
      <svg viewBox="0 0 64 64" className="piece-icon" aria-hidden="true">
        <circle cx="32" cy="32" r="10" fill={color} />
        <circle cx="32" cy="32" r="3.5" fill="#1a1b1e" opacity="0.28" />
        {Array.from({ length: count }).map((_, i) => {
          const a = (i / count) * Math.PI * 2 - Math.PI / 2
          // 90 connector: fan in a quarter
          const useFan = piece.id === 'conn-90'
          const angle = useFan ? ((i / Math.max(1, count - 1)) * Math.PI) / 2 - Math.PI / 2 : a
          return (
            <circle
              key={i}
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
    return (
      <svg viewBox="0 0 64 64" className="piece-icon" aria-hidden="true">
        <circle cx="32" cy="32" r="18" fill={color} />
        <circle cx="32" cy="32" r="10" fill={accent} />
        <circle cx="32" cy="32" r="4" fill="#1a1b1e" opacity="0.35" />
      </svg>
    )
  }

  // gears
  const teeth = piece.id === 'gear-large' ? 10 : 8
  return (
    <svg viewBox="0 0 64 64" className="piece-icon" aria-hidden="true">
      <circle cx="32" cy="32" r="12" fill={color} />
      {Array.from({ length: teeth }).map((_, i) => {
        const a = (i / teeth) * Math.PI * 2
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
