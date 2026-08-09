import { useMemo, useState } from 'react'
import { CATALOG, CATEGORY_LABELS } from '../data/catalog'
import type { PieceCategory } from '../types/knex'
import { useBuilderStore } from '../store/builderStore'

const ORDER: PieceCategory[] = ['rods', 'connectors', 'wheels', 'gears']

export function Sidebar() {
  const [openCategory, setOpenCategory] = useState<PieceCategory>('rods')
  const selectedCatalogId = useBuilderStore((s) => s.selectedCatalogId)
  const selectCatalog = useBuilderStore((s) => s.selectCatalog)

  const grouped = useMemo(() => {
    return ORDER.map((category) => ({
      category,
      label: CATEGORY_LABELS[category],
      items: CATALOG.filter((p) => p.category === category),
    }))
  }, [])

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div>
          <p className="brand-kicker">Studio</p>
          <h1>K’NEX</h1>
        </div>
      </div>

      <p className="sidebar-lead">
        Pick a piece, hover the grid, and snap rod ends into connector sockets.
      </p>

      <div className="category-list">
        {grouped.map((group) => {
          const expanded = openCategory === group.category
          return (
            <section key={group.category} className="category">
              <button
                type="button"
                className={`category-toggle${expanded ? ' open' : ''}`}
                onClick={() =>
                  setOpenCategory((current) =>
                    current === group.category ? current : group.category,
                  )
                }
                aria-expanded={expanded}
              >
                <span>{group.label}</span>
                <span className="count">{group.items.length}</span>
              </button>
              <div className={`piece-grid${expanded ? ' show' : ''}`}>
                {group.items.map((piece) => {
                  const active = selectedCatalogId === piece.id
                  return (
                    <button
                      key={piece.id}
                      type="button"
                      className={`piece-chip${active ? ' active' : ''}`}
                      onClick={() => selectCatalog(piece.id)}
                      title={piece.description}
                    >
                      <span
                        className="swatch"
                        style={{ background: piece.color }}
                        aria-hidden="true"
                      />
                      <span className="piece-copy">
                        <strong>{piece.name}</strong>
                        <small>{piece.description}</small>
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </aside>
  )
}
