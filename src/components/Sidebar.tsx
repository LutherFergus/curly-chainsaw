import { useMemo } from 'react'
import { CATALOG } from '../data/catalog'
import type { PieceCategory } from '../types/knex'
import { useBuilderStore } from '../store/builderStore'
import { PieceIcon } from './PieceIcon'

const ORDER: PieceCategory[] = ['rods', 'connectors', 'wheels', 'gears']

export function Sidebar() {
  const selectedCatalogId = useBuilderStore((s) => s.selectedCatalogId)
  const selectCatalog = useBuilderStore((s) => s.selectCatalog)
  const placementMode = useBuilderStore((s) => s.placementMode)
  const setPlacementMode = useBuilderStore((s) => s.setPlacementMode)
  const menuOpen = useBuilderStore((s) => s.menuOpen)
  const toggleMenu = useBuilderStore((s) => s.toggleMenu)

  const items = useMemo(
    () => ORDER.flatMap((category) => CATALOG.filter((p) => p.category === category)),
    [],
  )

  return (
    <aside className={`palette${menuOpen ? ' open' : ' collapsed'}`}>
      <button
        type="button"
        className="palette-toggle"
        onClick={toggleMenu}
        aria-expanded={menuOpen}
        aria-label={menuOpen ? 'Collapse piece menu' : 'Expand piece menu'}
        title={menuOpen ? 'Collapse' : 'Pieces'}
      >
        <span className="palette-toggle-bars" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </button>

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

      {menuOpen && (
        <div className="palette-column" role="listbox" aria-label="Pieces">
          {items.map((piece) => {
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
      )}

      {!menuOpen && selectedCatalogId && (
        <button
          type="button"
          className="palette-active-chip"
          onClick={toggleMenu}
          title="Open piece menu"
          aria-label="Open piece menu"
        >
          <PieceIcon piece={CATALOG.find((p) => p.id === selectedCatalogId)!} />
        </button>
      )}
    </aside>
  )
}
