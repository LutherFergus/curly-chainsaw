import { create } from 'zustand'
import type { CameraNavMode, Connection, PlacementMode, PlacedPiece, ToolMode } from '../types/knex'
import { getCatalogPiece } from '../data/catalog'
import { allWorldPorts, findBestSnap, occupiedPortKeys, snapPointToGrid } from '../lib/math'
import * as THREE from 'three'

let nextId = 1

function createId(): string {
  return `piece-${nextId++}`
}

interface Snapshot {
  pieces: PlacedPiece[]
  connections: Connection[]
  selectedPieceId: string | null
}

interface BuilderState {
  pieces: PlacedPiece[]
  connections: Connection[]
  selectedCatalogId: string | null
  selectedPieceId: string | null
  tool: ToolMode
  placementMode: PlacementMode
  cameraNavMode: CameraNavMode
  menuOpen: boolean
  toolsOpen: boolean
  past: Snapshot[]
  future: Snapshot[]
  ghost: {
    catalogId: string
    position: [number, number, number]
    rotation: [number, number, number, number]
    snap: {
      localPortId: string
      targetPieceId: string
      targetPortId: string
    } | null
  } | null
  selectCatalog: (id: string | null) => void
  setTool: (tool: ToolMode) => void
  setPlacementMode: (mode: PlacementMode) => void
  toggleCameraNavMode: () => void
  setMenuOpen: (open: boolean) => void
  toggleMenu: () => void
  setToolsOpen: (open: boolean) => void
  toggleTools: () => void
  selectPiece: (id: string | null) => void
  updateGhost: (point: THREE.Vector3) => void
  clearGhost: () => void
  placeGhost: () => void
  deleteSelected: () => void
  clearAll: () => void
  rotateSelectedY: (deltaRad: number) => void
  undo: () => void
  redo: () => void
}

const identityRotation: [number, number, number, number] = [0, 0, 0, 1]
const HISTORY_LIMIT = 80

function snapshotOf(state: Pick<BuilderState, 'pieces' | 'connections' | 'selectedPieceId'>): Snapshot {
  return {
    pieces: state.pieces.map((p) => ({ ...p, position: [...p.position], rotation: [...p.rotation] })),
    connections: state.connections.map((c) => ({ ...c })),
    selectedPieceId: state.selectedPieceId,
  }
}

function withHistory(
  get: () => BuilderState,
  set: (partial: Partial<BuilderState>) => void,
  mutate: (current: BuilderState) => Partial<BuilderState>,
) {
  const current = get()
  const past = [...current.past, snapshotOf(current)].slice(-HISTORY_LIMIT)
  set({ ...mutate(current), past, future: [] })
}

export const useBuilderStore = create<BuilderState>((set, get) => ({
  pieces: [],
  connections: [],
  selectedCatalogId: null,
  selectedPieceId: null,
  tool: 'place',
  placementMode: 'single',
  cameraNavMode: 'fly',
  menuOpen: true,
  toolsOpen: true,
  past: [],
  future: [],
  ghost: null,

  selectCatalog: (id) =>
    set({
      selectedCatalogId: id,
      tool: id ? 'place' : get().tool,
      selectedPieceId: null,
      menuOpen: id ? false : true,
      ghost: id ? get().ghost : null,
    }),

  setTool: (tool) =>
    set({
      tool,
      ghost: tool === 'place' ? get().ghost : null,
    }),

  setPlacementMode: (mode) => set({ placementMode: mode }),

  toggleCameraNavMode: () =>
    set({ cameraNavMode: get().cameraNavMode === 'fly' ? 'pan' : 'fly' }),

  setMenuOpen: (open) => set({ menuOpen: open }),
  toggleMenu: () => set({ menuOpen: !get().menuOpen }),
  setToolsOpen: (open) => set({ toolsOpen: open }),
  toggleTools: () => set({ toolsOpen: !get().toolsOpen }),

  selectPiece: (id) => set({ selectedPieceId: id, tool: 'select' }),

  updateGhost: (point) => {
    const { selectedCatalogId, pieces, connections, tool } = get()
    if (tool !== 'place' || !selectedCatalogId) {
      set({ ghost: null })
      return
    }
    const catalog = getCatalogPiece(selectedCatalogId)
    if (!catalog) {
      set({ ghost: null })
      return
    }

    const occupied = occupiedPortKeys(connections)
    const freePorts = allWorldPorts(pieces, occupied).filter((p) => !p.occupied)
    const snap = findBestSnap(catalog, freePorts, point)

    if (snap) {
      set({
        ghost: {
          catalogId: selectedCatalogId,
          position: snap.position,
          rotation: snap.rotation,
          snap: {
            localPortId: snap.localPortId,
            targetPieceId: snap.target.pieceId,
            targetPortId: snap.target.portId,
          },
        },
      })
      return
    }

    const grid = snapPointToGrid(point, 0.35)
    set({
      ghost: {
        catalogId: selectedCatalogId,
        position: [grid.x, grid.y, grid.z],
        rotation: identityRotation,
        snap: null,
      },
    })
  },

  clearGhost: () => set({ ghost: null }),

  placeGhost: () => {
    const current = get()
    const { ghost, pieces, connections, placementMode } = current
    if (!ghost) return

    const id = createId()
    const nextPiece: PlacedPiece = {
      id,
      catalogId: ghost.catalogId,
      position: ghost.position,
      rotation: ghost.rotation,
    }

    const nextConnections = [...connections]
    if (ghost.snap) {
      nextConnections.push({
        aPieceId: id,
        aPortId: ghost.snap.localPortId,
        bPieceId: ghost.snap.targetPieceId,
        bPortId: ghost.snap.targetPortId,
      })
    }

    const single = placementMode === 'single'
    withHistory(get, set, () => ({
      pieces: [...pieces, nextPiece],
      connections: nextConnections,
      selectedPieceId: id,
      menuOpen: true,
      selectedCatalogId: single ? null : ghost.catalogId,
      ghost: single ? null : { ...ghost, snap: null },
      tool: 'place' as const,
    }))
  },

  deleteSelected: () => {
    const { selectedPieceId, pieces, connections } = get()
    if (!selectedPieceId) return
    withHistory(get, set, () => ({
      pieces: pieces.filter((p) => p.id !== selectedPieceId),
      connections: connections.filter(
        (c) => c.aPieceId !== selectedPieceId && c.bPieceId !== selectedPieceId,
      ),
      selectedPieceId: null,
    }))
  },

  clearAll: () =>
    withHistory(get, set, () => ({
      pieces: [],
      connections: [],
      selectedPieceId: null,
      ghost: null,
      menuOpen: true,
    })),

  rotateSelectedY: (deltaRad) => {
    const { selectedPieceId, pieces, connections } = get()
    if (!selectedPieceId) return
    const locked = connections.some(
      (c) => c.aPieceId === selectedPieceId || c.bPieceId === selectedPieceId,
    )
    if (locked) return

    withHistory(get, set, () => ({
      pieces: pieces.map((p) => {
        if (p.id !== selectedPieceId) return p
        const q = new THREE.Quaternion(p.rotation[0], p.rotation[1], p.rotation[2], p.rotation[3])
        const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), deltaRad)
        q.premultiply(yaw)
        return { ...p, rotation: [q.x, q.y, q.z, q.w] }
      }),
    }))
  },

  undo: () => {
    const { past, future, pieces, connections, selectedPieceId } = get()
    const previous = past[past.length - 1]
    if (!previous) return
    set({
      past: past.slice(0, -1),
      future: [...future, snapshotOf({ pieces, connections, selectedPieceId })],
      pieces: previous.pieces,
      connections: previous.connections,
      selectedPieceId: previous.selectedPieceId,
      ghost: null,
    })
  },

  redo: () => {
    const { past, future, pieces, connections, selectedPieceId } = get()
    const next = future[future.length - 1]
    if (!next) return
    set({
      future: future.slice(0, -1),
      past: [...past, snapshotOf({ pieces, connections, selectedPieceId })],
      pieces: next.pieces,
      connections: next.connections,
      selectedPieceId: next.selectedPieceId,
      ghost: null,
    })
  },
}))
