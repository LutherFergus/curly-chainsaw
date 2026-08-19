import { useEffect } from 'react'
import { useBuilderStore } from '../store/builderStore'
import { getCatalogPiece } from '../data/catalog'

export function Toolbar() {
  const tool = useBuilderStore((s) => s.tool)
  const setTool = useBuilderStore((s) => s.setTool)
  const deleteSelected = useBuilderStore((s) => s.deleteSelected)
  const clearAll = useBuilderStore((s) => s.clearAll)
  const rotateSelectedY = useBuilderStore((s) => s.rotateSelectedY)
  const selectedPieceId = useBuilderStore((s) => s.selectedPieceId)
  const selectedCatalogId = useBuilderStore((s) => s.selectedCatalogId)
  const pieces = useBuilderStore((s) => s.pieces)
  const connections = useBuilderStore((s) => s.connections)
  const ghost = useBuilderStore((s) => s.ghost)
  const placementMode = useBuilderStore((s) => s.placementMode)

  const selectedPiece = pieces.find((p) => p.id === selectedPieceId)
  const selectedCatalog = selectedCatalogId ? getCatalogPiece(selectedCatalogId) : null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if ((e.target as HTMLElement)?.tagName === 'INPUT') return
        e.preventDefault()
        deleteSelected()
      }
      if (e.key === 'r' || e.key === 'R') {
        rotateSelectedY(Math.PI / 4)
      }
      if (e.key === 'v' || e.key === 'V') setTool('select')
      if (e.key === 'b' || e.key === 'B') setTool('place')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [deleteSelected, rotateSelectedY, setTool])

  return (
    <header className="toolbar">
      <div className="tool-group">
        <button
          type="button"
          className={tool === 'place' ? 'active' : ''}
          onClick={() => setTool('place')}
        >
          Build
        </button>
        <button
          type="button"
          className={tool === 'select' ? 'active' : ''}
          onClick={() => setTool('select')}
        >
          Select
        </button>
      </div>

      <div className="status-line">
        {tool === 'place' && selectedCatalog && (
          <p>
            Placing <strong>{selectedCatalog.name}</strong>
            {ghost?.snap ? ' · snap locked' : ' · free on grid'}
            {' · '}
            {placementMode === 'single' ? 'single' : 'multiple'}
          </p>
        )}
        {tool === 'place' && !selectedCatalog && (
          <p>Open the piece menu and pick a part to place</p>
        )}
        {tool === 'select' && (
          <p>
            {selectedPiece
              ? `Selected ${getCatalogPiece(selectedPiece.catalogId)?.name ?? 'piece'}`
              : 'Click a piece to select'}
          </p>
        )}
      </div>

      <div className="tool-group end">
        <button
          type="button"
          onClick={() => rotateSelectedY(Math.PI / 4)}
          disabled={!selectedPieceId}
          title="Rotate selected free piece (R)"
        >
          Rotate
        </button>
        <button type="button" onClick={deleteSelected} disabled={!selectedPieceId}>
          Delete
        </button>
        <button
          type="button"
          className="danger"
          onClick={clearAll}
          disabled={pieces.length === 0}
        >
          Clear
        </button>
        <span className="meta">
          {pieces.length} pieces · {connections.length} joints
        </span>
      </div>
    </header>
  )
}
