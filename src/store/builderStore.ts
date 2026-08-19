import { create } from 'zustand'
import type {
  CameraNavMode,
  Connection,
  ConnectorRotateMode,
  PlacementMode,
  PlacedPiece,
  ToolMode,
} from '../types/knex'
import { getCatalogPiece } from '../data/catalog'
import {
  aimRodFromAnchor,
  allWorldPorts,
  connectorPosesOnRodEnd,
  connectorWorkNormal,
  findBestSnap,
  nearestRodEnd,
  nextUsableConnectorPose,
  occupiedPortKeys,
  SNAP_DISTANCE,
  snapPointToGrid,
  type ConnectorAimPose,
} from '../lib/math'
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
  workNormal: [number, number, number]
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
  rodAim: {
    targetPieceId: string
    targetPortId: string
    tip: [number, number, number]
    poses: ConnectorAimPose[]
    activeIndex: number
    dragging: boolean
  } | null
  rodSteer: {
    anchor: [number, number, number]
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
  aimRodPose: (index: number) => void
  setRodAimDragging: (dragging: boolean) => void
  clearRodAim: () => void
  beginRodSteer: (anchor: THREE.Vector3) => void
  steerRod: (tip: THREE.Vector3) => void
  endRodSteer: () => void
  clearGhost: () => void
  placeGhost: () => void
  deleteSelected: () => void
  clearAll: () => void
  rotateSelectedY: (deltaRad: number) => void
  rotateConnector: (id: string, mode?: ConnectorRotateMode) => void
  rotateSelectedOpposite: () => void
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
  workNormal: [0, 1, 0],
  past: [],
  future: [],
  ghost: null,
  rodAim: null,
  rodSteer: null,

  selectCatalog: (id) =>
    set({
      selectedCatalogId: id,
      tool: id ? 'place' : get().tool,
      selectedPieceId: null,
      menuOpen: id ? false : true,
      ghost: id ? get().ghost : null,
      rodAim: id ? get().rodAim : null,
      rodSteer: id ? get().rodSteer : null,
    }),

  setTool: (tool) =>
    set({
      tool,
      ghost: tool === 'place' ? get().ghost : null,
      rodAim: tool === 'place' ? get().rodAim : null,
      rodSteer: tool === 'place' ? get().rodSteer : null,
    }),

  setPlacementMode: (mode) => set({ placementMode: mode }),

  toggleCameraNavMode: () =>
    set({ cameraNavMode: get().cameraNavMode === 'fly' ? 'pan' : 'fly' }),

  setMenuOpen: (open) => set({ menuOpen: open }),
  toggleMenu: () => set({ menuOpen: !get().menuOpen }),
  setToolsOpen: (open) => set({ toolsOpen: open }),
  toggleTools: () => set({ toolsOpen: !get().toolsOpen }),

  selectPiece: (id) => set({ selectedPieceId: id, tool: 'select', rodAim: null, rodSteer: null }),

  updateGhost: (point) => {
    const { selectedCatalogId, pieces, connections, tool, rodAim, workNormal } = get()
    if (tool !== 'place' || !selectedCatalogId) {
      set({ ghost: null, rodAim: null, rodSteer: null })
      return
    }
    if (rodAim?.dragging) return
    if (get().rodSteer) return

    const catalog = getCatalogPiece(selectedCatalogId)
    if (!catalog) {
      set({ ghost: null, rodAim: null, rodSteer: null })
      return
    }

    const occupied = occupiedPortKeys(connections)
    const freePorts = allWorldPorts(pieces, occupied).filter((p) => !p.occupied)

    if (catalog.category === 'connectors') {
      const leave = SNAP_DISTANCE + 0.55
      const sameTip =
        rodAim &&
        nearestRodEnd(
          freePorts.filter(
            (p) => p.pieceId === rodAim.targetPieceId && p.portId === rodAim.targetPortId,
          ),
          point,
          leave,
        )
      const rodEnd = sameTip ?? nearestRodEnd(freePorts, point)
      if (rodEnd) {
        const sameTarget =
          rodAim &&
          rodAim.targetPieceId === rodEnd.pieceId &&
          rodAim.targetPortId === rodEnd.portId
        const poses = sameTarget
          ? rodAim.poses
          : connectorPosesOnRodEnd(catalog, rodEnd, new THREE.Vector3(...workNormal))
        if (poses.length) {
          const activeIndex = sameTarget ? rodAim.activeIndex : poses.findIndex((p) => p.inPlane)
          const index = activeIndex >= 0 ? activeIndex : 0
          const pose = poses[index]
          set({
            rodAim: {
              targetPieceId: rodEnd.pieceId,
              targetPortId: rodEnd.portId,
              tip: [...rodEnd.position],
              poses,
              activeIndex: index,
              dragging: false,
            },
            ghost: {
              catalogId: selectedCatalogId,
              position: pose.position,
              rotation: pose.rotation,
              snap: {
                localPortId: pose.localPortId,
                targetPieceId: rodEnd.pieceId,
                targetPortId: rodEnd.portId,
              },
            },
          })
          return
        }
      }
    }

    if (rodAim) set({ rodAim: null })

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

  aimRodPose: (index) => {
    const { rodAim, selectedCatalogId } = get()
    if (!rodAim || !selectedCatalogId) return
    const pose = rodAim.poses[index]
    if (!pose) return
    set({
      rodAim: { ...rodAim, activeIndex: index },
      ghost: {
        catalogId: selectedCatalogId,
        position: pose.position,
        rotation: pose.rotation,
        snap: {
          localPortId: pose.localPortId,
          targetPieceId: rodAim.targetPieceId,
          targetPortId: rodAim.targetPortId,
        },
      },
    })
  },

  setRodAimDragging: (dragging) => {
    const { rodAim } = get()
    if (!rodAim) return
    set({ rodAim: { ...rodAim, dragging } })
  },

  clearRodAim: () => set({ rodAim: null }),

  beginRodSteer: (anchor) => {
    set({
      rodSteer: { anchor: [anchor.x, anchor.y, anchor.z] },
      rodAim: null,
    })
    get().steerRod(anchor)
  },

  steerRod: (tip) => {
    const { selectedCatalogId, pieces, connections, tool, rodSteer, workNormal } = get()
    if (tool !== 'place' || !selectedCatalogId || !rodSteer) return
    const catalog = getCatalogPiece(selectedCatalogId)
    if (!catalog || catalog.category !== 'rods') return

    const occupied = occupiedPortKeys(connections)
    const freePorts = allWorldPorts(pieces, occupied).filter((p) => !p.occupied)
    const snap = findBestSnap(catalog, freePorts, tip)
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

    const anchor = new THREE.Vector3(...rodSteer.anchor)
    const aimed = aimRodFromAnchor(catalog, anchor, tip, new THREE.Vector3(...workNormal))
    if (aimed) {
      set({
        ghost: {
          catalogId: selectedCatalogId,
          position: aimed.position,
          rotation: aimed.rotation,
          snap: null,
        },
      })
      return
    }

    const grid = snapPointToGrid(tip, 0.35)
    set({
      ghost: {
        catalogId: selectedCatalogId,
        position: [grid.x, grid.y, grid.z],
        rotation: identityRotation,
        snap: null,
      },
    })
  },

  endRodSteer: () => set({ rodSteer: null }),

  clearGhost: () => {
    if (get().rodAim?.dragging || get().rodSteer) return
    set({ ghost: null, rodAim: null, rodSteer: null })
  },

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
      rodAim: null,
      rodSteer: null,
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
      rodAim: null,
      rodSteer: null,
      menuOpen: true,
    })),

  rotateSelectedY: (deltaRad) => {
    const { selectedPieceId, pieces, connections, workNormal } = get()
    if (!selectedPieceId) return
    const piece = pieces.find((p) => p.id === selectedPieceId)
    if (!piece) return
    const catalog = getCatalogPiece(piece.catalogId)
    if (catalog?.category === 'connectors') {
      get().rotateConnector(selectedPieceId, 'in-plane')
      return
    }

    const locked = connections.some(
      (c) => c.aPieceId === selectedPieceId || c.bPieceId === selectedPieceId,
    )
    if (locked) return

    const axis = new THREE.Vector3(...workNormal).normalize()
    withHistory(get, set, () => ({
      pieces: pieces.map((p) => {
        if (p.id !== selectedPieceId) return p
        const q = new THREE.Quaternion(p.rotation[0], p.rotation[1], p.rotation[2], p.rotation[3])
        const step = new THREE.Quaternion().setFromAxisAngle(axis, deltaRad)
        q.premultiply(step)
        return { ...p, rotation: [q.x, q.y, q.z, q.w] }
      }),
    }))
  },

  rotateConnector: (id, mode = 'in-plane') => {
    const { pieces, connections } = get()
    const piece = pieces.find((p) => p.id === id)
    if (!piece) return
    const next = nextUsableConnectorPose(piece, pieces, connections, mode)
    if (!next) return
    const nextPiece = { ...piece, position: next.position, rotation: next.rotation }
    const catalog = getCatalogPiece(piece.catalogId)
    const work = catalog
      ? connectorWorkNormal(nextPiece, catalog, next.connections)
      : new THREE.Vector3(0, 1, 0)
    withHistory(get, set, () => ({
      pieces: pieces.map((p) => (p.id === id ? nextPiece : p)),
      connections: next.connections,
      selectedPieceId: id,
      workNormal: [work.x, work.y, work.z],
    }))
  },

  rotateSelectedOpposite: () => {
    const { selectedPieceId, pieces, connections, workNormal } = get()
    if (!selectedPieceId) return
    const piece = pieces.find((p) => p.id === selectedPieceId)
    if (!piece) return
    const catalog = getCatalogPiece(piece.catalogId)
    if (catalog?.category === 'connectors') {
      get().rotateConnector(selectedPieceId, 'opposite')
      return
    }

    const locked = connections.some(
      (c) => c.aPieceId === selectedPieceId || c.bPieceId === selectedPieceId,
    )
    if (locked) return

    const work = new THREE.Vector3(...workNormal).normalize()
    const axis = new THREE.Vector3(1, 0, 0)
    if (Math.abs(work.dot(axis)) > 0.7) axis.set(0, 0, 1)
    axis.sub(work.clone().multiplyScalar(axis.dot(work)))
    if (axis.lengthSq() < 1e-6) axis.set(0, 0, 1)
    axis.normalize()

    withHistory(get, set, () => ({
      pieces: pieces.map((p) => {
        if (p.id !== selectedPieceId) return p
        const q = new THREE.Quaternion(p.rotation[0], p.rotation[1], p.rotation[2], p.rotation[3])
        const step = new THREE.Quaternion().setFromAxisAngle(axis, Math.PI / 4)
        q.premultiply(step)
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
      rodAim: null,
      rodSteer: null,
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
      rodAim: null,
      rodSteer: null,
    })
  },
}))
