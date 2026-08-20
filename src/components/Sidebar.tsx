import { useMemo } from 'react'
import { CATALOG, CATEGORY_LABELS, isPreassembledHub } from '../data/catalog'
import type { PieceCategory } from '../types/knex'
import { useBuilderStore } from '../store/builderStore'
import { PieceIcon } from './PieceIcon'

const ORDER: PieceCategory[] = [
  'rods',
  'connectors',
  'clips',
  'spacers',
  'wheels',
  'gears',
  'panels',
  'chain',
]

function Chevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 24 24" className="chevron-icon" aria-hidden="true">
      {direction === 'right' ? (
        <path
          d="M9 6l6 6-6 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M15 6l-6 6 6 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  )
}

export function Sidebar() {
  const selectedCatalogId = useBuilderStore((s) => s.selectedCatalogId)
  const selectCatalog = useBuilderStore((s) => s.selectCatalog)
  const placementMode = useBuilderStore((s) => s.placementMode)
  const setPlacementMode = useBuilderStore((s) => s.setPlacementMode)
  const menuOpen = useBuilderStore((s) => s.menuOpen)
  const toggleMenu = useBuilderStore((s) => s.toggleMenu)

  const sections = useMemo(
    () =>
      ORDER.map((category) => ({
        category,
        label: CATEGORY_LABELS[category],
        pieces: CATALOG.filter((p) => p.category === category && !isPreassembledHub(p)),
      })).filter((section) => section.pieces.length > 0),
    [],
  )

  return (
    <aside className={`rail left-rail${menuOpen ? ' open' : ' collapsed'}`}>
      <div className="rail-body">
        <button
          type="button"
          className={`mode-btn${placementMode === 'multiple' ? ' multiple' : ''}`}
          onClick={() =>
            setPlacementMode(placementMode === 'single' ? 'multiple' : 'single')
          }
          title={
            placementMode === 'single'
              ? 'Single mode — tap to switch to Multiple'
              : 'Multiple mode — tap to switch to Single'
          }
          aria-label={`Placement mode: ${placementMode}`}
        >
          {placementMode === 'single' ? 'Single' : 'Multiple'}
        </button>

        <div className="rail-stack" role="listbox" aria-label="Pieces">
          {sections.map((section) => (
            <div key={section.category} className="rail-section">
              <div className="rail-section-label" aria-hidden="true">
                {section.label}
              </div>
              {section.pieces.map((piece) => {
                const active = selectedCatalogId === piece.id
                return (
                  <button
                    key={piece.id}
                    type="button"
                    className={`icon-btn${active ? ' active' : ''}`}
                    onClick={() => selectCatalog(piece.id)}
                    title={piece.name}
                    aria-label={piece.name}
                    aria-pressed={active}
                    role="option"
                  >
                    <PieceIcon piece={piece} />
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        className="edge-chevron"
        onClick={toggleMenu}
        aria-expanded={menuOpen}
        aria-label={menuOpen ? 'Collapse piece menu' : 'Open piece menu'}
        title={menuOpen ? 'Collapse' : 'Pieces'}
      >
        <Chevron direction={menuOpen ? 'left' : 'right'} />
      </button>
    </aside>
  )
}
