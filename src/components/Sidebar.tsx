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
  const setMenuOpen = useBuilderStore((s) => s.setMenuOpen)

  const grouped = useMemo(() => {
    return ORDER.map((category) => ({
      category,
      items: CATALOG.filter((p) => p.category === category),
    }))
  }, [])

  return (
    <aside className={`palette${menuOpen ? ' open' : ' collapsed'}`}>
      <div className="palette-rail">
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

        {!menuOpen && selectedCatalogId && (
          <button
            type="button"
            className="palette-active-chip"
            onClick={() => setMenuOpen(true)}
            title="Open piece menu"
            aria-label="Open piece menu"
          >
            <PieceIcon piece={CATALOG.find((p) => p.id === selectedCatalogId)!} />
          </button>
        )}
      </div>

      <div className="palette-panel" aria-hidden={!menuOpen}>
        <div className="palette-brand">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <strong>K’NEX</strong>
        </div>

        <div className="placement-toggle" role="group" aria-label="Placement mode">
          <button
            type="button"
            className={placementMode === 'single' ? 'active' : ''}
            onClick={() => setPlacementMode('single')}
            title="Place one piece, then pick again"
          >
            Single
          </button>
          <button
            type="button"
            className={placementMode === 'multiple' ? 'active' : ''}
            onClick={() => setPlacementMode('multiple')}
            title="Keep placing the same piece"
          >
            Multiple
          </button>
        </div>

        <div className="palette-scroll">
          {grouped.map((group) => (
            <section key={group.category} className="palette-section">
              <div className="icon-grid">
                {group.items.map((piece) => {
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
                    >
                      <PieceIcon piece={piece} />
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </aside>
  )
}
