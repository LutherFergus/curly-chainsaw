import { useEffect, useState } from 'react'
import { useBuilderStore } from '../store/builderStore'

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

export function BuildMenu() {
  const tool = useBuilderStore((s) => s.tool)
  const setTool = useBuilderStore((s) => s.setTool)
  const deleteSelected = useBuilderStore((s) => s.deleteSelected)
  const clearAll = useBuilderStore((s) => s.clearAll)
  const rotateSelectedY = useBuilderStore((s) => s.rotateSelectedY)
  const rotateSelectedOpposite = useBuilderStore((s) => s.rotateSelectedOpposite)
  const perpSnap = useBuilderStore((s) => s.perpSnap)
  const togglePerpSnap = useBuilderStore((s) => s.togglePerpSnap)
  const selectedPieceId = useBuilderStore((s) => s.selectedPieceId)
  const pieces = useBuilderStore((s) => s.pieces)
  const undo = useBuilderStore((s) => s.undo)
  const redo = useBuilderStore((s) => s.redo)
  const past = useBuilderStore((s) => s.past)
  const future = useBuilderStore((s) => s.future)
  const toolsOpen = useBuilderStore((s) => s.toolsOpen)
  const toggleTools = useBuilderStore((s) => s.toggleTools)

  const [clearArmed, setClearArmed] = useState(0)
  const [clearStamp, setClearStamp] = useState(0)

  useEffect(() => {
    if (clearArmed === 0) return
    const timer = window.setTimeout(() => setClearArmed(0), 700)
    return () => window.clearTimeout(timer)
  }, [clearArmed, clearStamp])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if ((e.metaKey || e.ctrlKey) && key === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if ((e.metaKey || e.ctrlKey) && key === 'y') {
        e.preventDefault()
        redo()
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if ((e.target as HTMLElement)?.tagName === 'INPUT') return
        e.preventDefault()
        deleteSelected()
      }
      if (key === 'r') {
        if (e.shiftKey) rotateSelectedOpposite()
        else rotateSelectedY(Math.PI / 4)
      }
      if (key === 'p') togglePerpSnap()
      if (key === 'l') setTool('slide')
      if (key === 'v') setTool('select')
      if (key === 'b') setTool('place')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [deleteSelected, rotateSelectedY, rotateSelectedOpposite, setTool, undo, redo, togglePerpSnap])

  const onClearClick = () => {
    if (pieces.length === 0) return
    const next = clearArmed + 1
    if (next >= 3) {
      clearAll()
      setClearArmed(0)
      return
    }
    setClearArmed(next)
    setClearStamp(Date.now())
  }

  return (
    <aside className={`rail right-rail${toolsOpen ? ' open' : ' collapsed'}`}>
      <button
        type="button"
        className="edge-chevron"
        onClick={toggleTools}
        aria-expanded={toolsOpen}
        aria-label={toolsOpen ? 'Collapse build menu' : 'Open build menu'}
        title={toolsOpen ? 'Collapse' : 'Build'}
      >
        <Chevron direction={toolsOpen ? 'right' : 'left'} />
      </button>

      <div className="rail-body">
        <div className="rail-stack">
          <button
            type="button"
            className={`tool-btn${tool === 'place' ? ' active' : ''}`}
            onClick={() => setTool('place')}
            title="Build"
          >
            Build
          </button>
          <button
            type="button"
            className={`tool-btn${tool === 'select' ? ' active' : ''}`}
            onClick={() => setTool('select')}
            title="Select"
          >
            Select
          </button>
          <button
            type="button"
            className="tool-btn"
            onClick={() => rotateSelectedY(Math.PI / 4)}
            disabled={!selectedPieceId}
            title="Rotate in the current working plane"
          >
            Rotate
          </button>
          <button
            type="button"
            className="tool-btn"
            onClick={() => rotateSelectedOpposite()}
            disabled={!selectedPieceId}
            title="Rotate around the opposite axis — flip onto another working plane"
          >
            Opp. axis
          </button>
          <button
            type="button"
            className={`tool-btn${perpSnap ? ' active' : ''}`}
            onClick={togglePerpSnap}
            title="Snap a connector clip onto a rod shaft at 90°"
          >
            Perp
          </button>
          <button
            type="button"
            className={`tool-btn${tool === 'slide' ? ' active' : ''}`}
            onClick={() => setTool('slide')}
            title="Slide a spacer, perp clip, or through-hole hub along the shaft — or slide the rod (L)"
          >
            Slide
          </button>
          <button
            type="button"
            className="tool-btn"
            onClick={deleteSelected}
            disabled={!selectedPieceId}
            title="Delete"
          >
            Delete
          </button>
          <button
            type="button"
            className="tool-btn"
            onClick={undo}
            disabled={past.length === 0}
            title="Undo"
          >
            Undo
          </button>
          <button
            type="button"
            className="tool-btn"
            onClick={redo}
            disabled={future.length === 0}
            title="Redo"
          >
            Redo
          </button>
          <button
            type="button"
            className="tool-btn danger"
            onClick={onClearClick}
            disabled={pieces.length === 0}
            title="Triple-click to clear"
          >
            {clearArmed === 1 ? 'Clear 2' : clearArmed === 2 ? 'Clear 1' : 'Clear'}
          </button>
        </div>
      </div>
    </aside>
  )
}
