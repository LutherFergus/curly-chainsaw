import { create } from 'zustand'
import type { CameraNavMode, Connection, PlacementMode, PlacedPiece, ToolMode } from '../types/knex'
import { getCatalogPiece } from '../data/catalog'
import { allWorldPorts, findBestSnap, occupiedPortKeys, snapPointToGrid } from '../lib/math'
import * as THREE from 'three'

let nextId = 1

function createId(): string {
  return `piece-${nextId++}`
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
  selectPiece: (id: string | null) => void
  updateGhost: (point: THREE.Vector3) => void
  clearGhost: () => void
  placeGhost: () => void
  deleteSelected: () => void
  clearAll: () => void
  rotateSelectedY: (deltaRad: number) => void
}

const identityRotation: [number, number, number, number] = [0, 0, 0, 1]

export const useBuilderStore = create<BuilderState>((set, get) => ({
  pieces: [],
  connections: [],
  selectedCatalogId: null,
  selectedPieceId: null,
  tool: 'place',
  placementMode: 'single',
  cameraNavMode: 'fly',
  menuOpen: true,
  ghost: null,

  selectCatalog: (id) =>
    set({
      selectedCatalogId: id,
      tool: id ? 'place' : get().tool,
      selectedPieceId: null,
      // Selecting a piece collapses the palette until placement.
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
    const { ghost, pieces, connections, placementMode } = get()
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
    set({
      pieces: [...pieces, nextPiece],
      connections: nextConnections,
      selectedPieceId: id,
      // Always reopen the palette after a place.
      menuOpen: true,
      // Single mode: clear the active piece so the next place requires a new pick.
      selectedCatalogId: single ? null : ghost.catalogId,
      ghost: single ? null : { ...ghost, snap: null },
      tool: 'place',
    })
  },

  deleteSelected: () => {
    const { selectedPieceId, pieces, connections } = get()
    if (!selectedPieceId) return
    set({
      pieces: pieces.filter((p) => p.id !== selectedPieceId),
      connections: connections.filter(
        (c) => c.aPieceId !== selectedPieceId && c.bPieceId !== selectedPieceId,
      ),
      selectedPieceId: null,
    })
  },

  clearAll: () =>
    set({
      pieces: [],
      connections: [],
      selectedPieceId: null,
      ghost: null,
      menuOpen: true,
    }),

  rotateSelectedY: (deltaRad) => {
    const { selectedPieceId, pieces, connections } = get()
    if (!selectedPieceId) return
    const locked = connections.some(
      (c) => c.aPieceId === selectedPieceId || c.bPieceId === selectedPieceId,
    )
    if (locked) return

    set({
      pieces: pieces.map((p) => {
        if (p.id !== selectedPieceId) return p
        const q = new THREE.Quaternion(p.rotation[0], p.rotation[1], p.rotation[2], p.rotation[3])
        const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), deltaRad)
        q.premultiply(yaw)
        return { ...p, rotation: [q.x, q.y, q.z, q.w] }
      }),
    })
  },
}))
