import { create } from 'zustand'
import type {
  CameraNavMode,
  Connection,
  ConnectorRotateMode,
  PlacementMode,
  PlacedPiece,
  ToolMode,
  WorldPort,
} from '../types/knex'
import { getCatalogPiece, isConnectorLike, isShaftSleeve } from '../data/catalog'
import {
  aimPointOnSlotPlane,
  aimRodFromAnchor,
  allWorldPorts,
  connectorPosesOnRodEnd,
  connectorWorkNormal,
  findBestSnap,
  findInterlockSnapOnPointer,
  snapInterlockAimed,
  findRodSnapOnPointer,
  axialSnapIfNearSocket,
  hasInterlock,
  nearestInterlockOnPointer,
  nearestRodEnd,
  nearestRodShaft,
  nearestGearMesh,
  nearestMotorLug,
  connectorPosesOnShaft,
  hubPosesOnShaft,
  sleevePosesOnShaft,
  nextUsableConnectorPose,
  occupancyKeys,
  mergeGeometricConnections,
  slideJointForPiece,
  slideMovingIds,
  slideSnapDelta,
  rayAxisT,
  SNAP_DISTANCE,
  snapPointToGrid,
  type ConnectorAimPose,
  type PointerView,
} from '../lib/math'
import { ghostCollides, poseCollides, type GhostSnap } from '../lib/collision'
import {
  buildSession,
  hasLastSession,
  loadAutosave,
  loadLastSession as readLastSession,
  saveAutosave,
  type SessionPayload,
} from '../lib/session'
import * as THREE from 'three'

let nextId = 1

function createId(): string {
  return `piece-${nextId++}`
}

function applySessionState(session: SessionPayload): Partial<BuilderState> {
  nextId = session.nextId
  return {
    pieces: session.pieces,
    connections: session.connections,
    selectedPieceId: null,
    selectedCatalogId: null,
    ghost: null,
    rodAim: null,
    rodSteer: null,
    slotSteer: null,
    slide: null,
    hasSavedSession: session.pieces.length > 0 || hasLastSession(),
  }
}

const bootSession = typeof localStorage !== 'undefined' ? loadAutosave() : null
if (bootSession) nextId = bootSession.nextId

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
  perpSnap: boolean
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
    collision: boolean
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
  slotSteer: {
    targetPieceId: string
    targetPortId: string
  } | null
  slide: {
    pieceId: string
    companionIds: string[]
    startPositions: Record<string, [number, number, number]>
    origin: [number, number, number]
    dir: [number, number, number]
    grabT: number
    minDelta: number
    maxDelta: number
    moved: boolean
    startSnapshot: Snapshot
  } | null
  /** True when a non-empty last session exists in localStorage. */
  hasSavedSession: boolean
  selectCatalog: (id: string | null) => void
  setTool: (tool: ToolMode) => void
  setPlacementMode: (mode: PlacementMode) => void
  toggleCameraNavMode: () => void
  setMenuOpen: (open: boolean) => void
  toggleMenu: () => void
  setToolsOpen: (open: boolean) => void
  toggleTools: () => void
  togglePerpSnap: () => void
  selectPiece: (id: string | null) => void
  updateGhost: (point: THREE.Vector3, view?: PointerView) => void
  aimRodPose: (index: number) => void
  setRodAimDragging: (dragging: boolean) => void
  clearRodAim: () => void
  beginRodSteer: (anchor: THREE.Vector3) => void
  steerRod: (tip: THREE.Vector3, view?: PointerView) => void
  endRodSteer: () => void
  beginSlotSteer: (target: WorldPort) => void
  steerSlot: (view: PointerView) => void
  endSlotSteer: () => void
  beginSlide: (pieceId: string, ray: THREE.Ray) => boolean
  steerSlide: (ray: THREE.Ray) => void
  endSlide: () => void
  clearGhost: () => void
  placeGhost: () => void
  deleteSelected: () => void
  clearAll: () => void
  /** Restore the last non-empty autosaved build (e.g. after Clear). */
  loadLastSession: () => boolean
  rotateSelectedY: (deltaRad: number) => void
  rotateConnector: (id: string, mode?: ConnectorRotateMode) => void
  rotateSelectedOpposite: () => void
  undo: () => void
  redo: () => void
}

const identityRotation: [number, number, number, number] = [0, 0, 0, 1]
const HISTORY_LIMIT = 80

function makeGhost(
  catalogId: string,
  position: [number, number, number],
  rotation: [number, number, number, number],
  snap: GhostSnap,
  pieces: PlacedPiece[],
  connections: Connection[],
): NonNullable<BuilderState['ghost']> {
  return {
    catalogId,
    position,
    rotation,
    snap,
    collision: ghostCollides(catalogId, position, rotation, pieces, connections, snap),
  }
}

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
  pieces: bootSession?.pieces ?? [],
  connections: bootSession?.connections ?? [],
  selectedCatalogId: null,
  selectedPieceId: null,
  tool: 'place',
  placementMode: 'single',
  cameraNavMode: 'fly',
  menuOpen: true,
  toolsOpen: true,
  workNormal: [0, 1, 0],
  perpSnap: false,
  past: [],
  future: [],
  ghost: null,
  rodAim: null,
  rodSteer: null,
  slotSteer: null,
  slide: null,
  hasSavedSession: hasLastSession(),

  selectCatalog: (id) =>
    set({
      selectedCatalogId: id,
      tool: id ? 'place' : get().tool,
      selectedPieceId: null,
      menuOpen: id ? false : true,
      ghost: id ? get().ghost : null,
      rodAim: id ? get().rodAim : null,
      rodSteer: id ? get().rodSteer : null,
      slotSteer: id ? get().slotSteer : null,
      slide: null,
    }),

  setTool: (tool) =>
    set({
      tool,
      selectedCatalogId: tool === 'slide' ? null : get().selectedCatalogId,
      ghost: tool === 'place' ? get().ghost : null,
      rodAim: tool === 'place' ? get().rodAim : null,
      rodSteer: tool === 'place' ? get().rodSteer : null,
      slotSteer: tool === 'place' ? get().slotSteer : null,
      slide: null,
    }),

  setPlacementMode: (mode) => set({ placementMode: mode }),

  toggleCameraNavMode: () =>
    set({ cameraNavMode: get().cameraNavMode === 'fly' ? 'pan' : 'fly' }),

  setMenuOpen: (open) => set({ menuOpen: open }),
  toggleMenu: () => set({ menuOpen: !get().menuOpen }),
  setToolsOpen: (open) => set({ toolsOpen: open }),
  toggleTools: () => set({ toolsOpen: !get().toolsOpen }),
  togglePerpSnap: () => set({ perpSnap: !get().perpSnap }),

  selectPiece: (id) =>
    set({
      selectedPieceId: id,
      tool: get().tool === 'slide' ? 'slide' : 'select',
      rodAim: null,
      rodSteer: null,
      slotSteer: null,
    }),

  updateGhost: (point, view) => {
    const { selectedCatalogId, pieces, connections, tool, rodAim, workNormal, perpSnap } = get()
    if (tool !== 'place' || !selectedCatalogId) {
      set({ ghost: null, rodAim: null, rodSteer: null, slotSteer: null })
      return
    }
    if (rodAim?.dragging) return
    if (get().rodSteer) return
    if (get().slotSteer) return

    const catalog = getCatalogPiece(selectedCatalogId)
    if (!catalog) {
      set({ ghost: null, rodAim: null, rodSteer: null, slotSteer: null })
      return
    }

    const occupied = occupancyKeys(pieces, connections)
    const freePorts = allWorldPorts(pieces, occupied).filter((p) => !p.occupied)

    if (hasInterlock(catalog) && view) {
      const slotSnap = findInterlockSnapOnPointer(catalog, freePorts, view)
      if (slotSnap) {
        set({
          rodAim: null,
          ghost: makeGhost(
            selectedCatalogId,
            slotSnap.position,
            slotSnap.rotation,
            {
              localPortId: slotSnap.localPortId,
              targetPieceId: slotSnap.target.pieceId,
              targetPortId: slotSnap.target.portId,
            },
            pieces,
            connections,
          ),
        })
        return
      }
    }

    if (catalog.category === 'rods' && view) {
      const hoverSnap = findRodSnapOnPointer(catalog, freePorts, view)
      if (hoverSnap) {
        set({
          rodAim: null,
          ghost: makeGhost(
            selectedCatalogId,
            hoverSnap.position,
            hoverSnap.rotation,
            {
              localPortId: hoverSnap.localPortId,
              targetPieceId: hoverSnap.target.pieceId,
              targetPortId: hoverSnap.target.portId,
            },
            pieces,
            connections,
          ),
        })
        return
      }
    }

    if (perpSnap && isConnectorLike(catalog)) {
      const hit = nearestRodShaft(pieces, point)
      if (hit) {
        const poses = connectorPosesOnShaft(
          catalog,
          hit.piece,
          hit.point,
          new THREE.Vector3(...workNormal),
        )
        if (poses.length) {
          const sameRod =
            rodAim &&
            rodAim.targetPieceId === hit.piece.id &&
            rodAim.targetPortId === 'shaft'
          const activeIndex = sameRod ? rodAim.activeIndex : poses.findIndex((p) => p.inPlane)
          const index = activeIndex >= 0 && activeIndex < poses.length ? activeIndex : 0
          const pose = poses[index]
          set({
            rodAim: {
              targetPieceId: hit.piece.id,
              targetPortId: 'shaft',
              tip: [hit.point.x, hit.point.y, hit.point.z],
              poses,
              activeIndex: index,
              dragging: false,
            },
            ghost: makeGhost(
              selectedCatalogId,
              pose.position,
              pose.rotation,
              {
                localPortId: pose.localPortId,
                targetPieceId: hit.piece.id,
                targetPortId: 'shaft',
              },
              pieces,
              connections,
            ),
          })
          return
        }
      }
      if (rodAim) set({ rodAim: null })
      const grid = snapPointToGrid(point, 0.35)
      set({
        ghost: makeGhost(
          selectedCatalogId,
          [grid.x, grid.y, grid.z],
          identityRotation,
          null,
          pieces,
          connections,
        ),
      })
      return
    }

    if (isConnectorLike(catalog)) {
      const lugHit = nearestMotorLug(
        catalog,
        pieces,
        point,
        new THREE.Vector3(...workNormal),
      )
      const hit = nearestRodShaft(pieces, point)
      const leave = SNAP_DISTANCE + 0.55
      const sameTip =
        rodAim &&
        rodAim.targetPortId !== 'shaft' &&
        nearestRodEnd(
          freePorts.filter(
            (p) => p.pieceId === rodAim.targetPieceId && p.portId === rodAim.targetPortId,
          ),
          point,
          leave,
        )
      const rodEnd = sameTip ?? nearestRodEnd(freePorts, point)
      const shaftDist = hit ? hit.point.distanceTo(point) : Number.POSITIVE_INFINITY
      const endDist = rodEnd
        ? new THREE.Vector3(...rodEnd.position).distanceTo(point)
        : Number.POSITIVE_INFINITY
      const lugDist = lugHit
        ? (() => {
            const motor = getCatalogPiece(lugHit.piece.catalogId)
            if (!motor) return Number.POSITIVE_INFINITY
            const q = new THREE.Quaternion(
              lugHit.piece.rotation[0],
              lugHit.piece.rotation[1],
              lugHit.piece.rotation[2],
              lugHit.piece.rotation[3],
            )
            const lugWorld = new THREE.Vector3(...lugHit.piece.position).add(
              new THREE.Vector3(...lugHit.lug.position).applyQuaternion(q),
            )
            return lugWorld.distanceTo(point)
          })()
        : Number.POSITIVE_INFINITY
      if (lugHit && lugDist <= shaftDist && lugDist <= endDist) {
        const poses = lugHit.poses
        const sameLug =
          rodAim &&
          rodAim.targetPieceId === lugHit.piece.id &&
          rodAim.targetPortId === lugHit.lug.id
        const activeIndex = sameLug ? rodAim.activeIndex : poses.findIndex((p) => p.inPlane)
        const index = activeIndex >= 0 && activeIndex < poses.length ? activeIndex : 0
        const pose = poses[index]
        set({
          rodAim: {
            targetPieceId: lugHit.piece.id,
            targetPortId: lugHit.lug.id,
            tip: pose.position,
            poses,
            activeIndex: index,
            dragging: false,
          },
          ghost: makeGhost(
            selectedCatalogId,
            pose.position,
            pose.rotation,
            {
              localPortId: pose.localPortId,
              targetPieceId: lugHit.piece.id,
              targetPortId: lugHit.lug.id,
            },
            pieces,
            connections,
          ),
        })
        return
      }
      if (hit && shaftDist <= endDist) {
        const poses = hubPosesOnShaft(
          catalog,
          hit.piece,
          hit.point,
          new THREE.Vector3(...workNormal),
        )
        if (poses.length) {
          const sameRod =
            rodAim &&
            rodAim.targetPieceId === hit.piece.id &&
            rodAim.targetPortId === 'shaft'
          const activeIndex = sameRod ? rodAim.activeIndex : poses.findIndex((p) => p.inPlane)
          const index = activeIndex >= 0 && activeIndex < poses.length ? activeIndex : 0
          const pose = poses[index]
          set({
            rodAim: {
              targetPieceId: hit.piece.id,
              targetPortId: 'shaft',
              tip: [hit.point.x, hit.point.y, hit.point.z],
              poses,
              activeIndex: index,
              dragging: false,
            },
            ghost: makeGhost(
              selectedCatalogId,
              pose.position,
              pose.rotation,
              {
                localPortId: pose.localPortId,
                targetPieceId: hit.piece.id,
                targetPortId: 'shaft',
              },
              pieces,
              connections,
            ),
          })
          return
        }
      }
      if (rodEnd) {
        const sameTarget =
          rodAim &&
          rodAim.targetPieceId === rodEnd.pieceId &&
          rodAim.targetPortId === rodEnd.portId
        const poses = sameTarget
          ? rodAim.poses
          : connectorPosesOnRodEnd(
              catalog,
              rodEnd,
              new THREE.Vector3(...workNormal),
              freePorts,
            )
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
            ghost: makeGhost(
              selectedCatalogId,
              pose.position,
              pose.rotation,
              {
                localPortId: pose.localPortId,
                targetPieceId: rodEnd.pieceId,
                targetPortId: rodEnd.portId,
              },
              pieces,
              connections,
            ),
          })
          return
        }
      }
    }

    if (isShaftSleeve(catalog)) {
      const hit = nearestRodShaft(pieces, point)
      if (hit) {
        const poses = sleevePosesOnShaft(catalog, hit.piece, hit.point)
        if (poses.length) {
          const pose = poses[0]
          set({
            rodAim: null,
            ghost: makeGhost(
              selectedCatalogId,
              pose.position,
              pose.rotation,
              {
                localPortId: pose.localPortId,
                targetPieceId: hit.piece.id,
                targetPortId: 'shaft',
              },
              pieces,
              connections,
            ),
          })
          return
        }
      }
      if (catalog.category === 'gears') {
        const mesh = nearestGearMesh(catalog, pieces, point)
        if (mesh) {
          const targetCat = getCatalogPiece(mesh.piece.catalogId)
          const meshPort =
            targetCat?.ports.find((p) => p.id === 'worm') ??
            targetCat?.ports.find((p) => p.kind === 'gear-mesh')
          set({
            rodAim: null,
            ghost: makeGhost(
              selectedCatalogId,
              mesh.pose.position,
              mesh.pose.rotation,
              {
                localPortId: mesh.pose.localPortId,
                targetPieceId: mesh.piece.id,
                targetPortId: meshPort?.id ?? 'mesh',
              },
              pieces,
              connections,
            ),
          })
          return
        }
      }
    }

    if (rodAim) set({ rodAim: null })

    const snap = catalog.category === 'rods' && view ? null : findBestSnap(catalog, freePorts, point)

    if (snap) {
      set({
        ghost: makeGhost(
          selectedCatalogId,
          snap.position,
          snap.rotation,
          {
            localPortId: snap.localPortId,
            targetPieceId: snap.target.pieceId,
            targetPortId: snap.target.portId,
          },
          pieces,
          connections,
        ),
      })
      return
    }

    const grid = snapPointToGrid(point, 0.35)
    set({
      ghost: makeGhost(
        selectedCatalogId,
        [grid.x, grid.y, grid.z],
        identityRotation,
        null,
        pieces,
        connections,
      ),
    })
  },

  aimRodPose: (index) => {
    const { rodAim, selectedCatalogId, pieces, connections } = get()
    if (!rodAim || !selectedCatalogId) return
    const pose = rodAim.poses[index]
    if (!pose) return
    set({
      rodAim: { ...rodAim, activeIndex: index },
      ghost: makeGhost(
        selectedCatalogId,
        pose.position,
        pose.rotation,
        {
          localPortId: pose.localPortId,
          targetPieceId: rodAim.targetPieceId,
          targetPortId: rodAim.targetPortId,
        },
        pieces,
        connections,
      ),
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
  },

  steerRod: (tip, view) => {
    const { selectedCatalogId, pieces, connections, tool, rodSteer, workNormal } = get()
    if (tool !== 'place' || !selectedCatalogId || !rodSteer) return
    const catalog = getCatalogPiece(selectedCatalogId)
    if (!catalog || catalog.category !== 'rods') return

    const occupied = occupancyKeys(pieces, connections)
    const freePorts = allWorldPorts(pieces, occupied).filter((p) => !p.occupied)
    const hoverSnap = view ? findRodSnapOnPointer(catalog, freePorts, view) : null
    if (hoverSnap) {
      set({
        ghost: makeGhost(
          selectedCatalogId,
          hoverSnap.position,
          hoverSnap.rotation,
          {
            localPortId: hoverSnap.localPortId,
            targetPieceId: hoverSnap.target.pieceId,
            targetPortId: hoverSnap.target.portId,
          },
          pieces,
          connections,
        ),
      })
      return
    }

    const anchor = new THREE.Vector3(...rodSteer.anchor)
    const aimed = aimRodFromAnchor(catalog, anchor, tip, new THREE.Vector3(...workNormal))
    if (aimed) {
      const locked = axialSnapIfNearSocket(catalog, aimed, freePorts)
      if (locked) {
        set({
          ghost: makeGhost(
            selectedCatalogId,
            locked.position,
            locked.rotation,
            {
              localPortId: locked.localPortId,
              targetPieceId: locked.target.pieceId,
              targetPortId: locked.target.portId,
            },
            pieces,
            connections,
          ),
        })
        return
      }
      set({
        ghost: makeGhost(
          selectedCatalogId,
          aimed.position,
          aimed.rotation,
          null,
          pieces,
          connections,
        ),
      })
      return
    }

    const grid = snapPointToGrid(tip, 0.35)
    set({
      ghost: makeGhost(
        selectedCatalogId,
        [grid.x, grid.y, grid.z],
        identityRotation,
        null,
        pieces,
        connections,
      ),
    })
  },

  endRodSteer: () => set({ rodSteer: null }),

  beginSlotSteer: (target) => {
    set({
      slotSteer: { targetPieceId: target.pieceId, targetPortId: target.portId },
      rodAim: null,
    })
  },

  steerSlot: (view) => {
    const { selectedCatalogId, pieces, connections, tool, slotSteer } = get()
    if (tool !== 'place' || !selectedCatalogId || !slotSteer) return
    const catalog = getCatalogPiece(selectedCatalogId)
    if (!catalog || !hasInterlock(catalog)) return
    const occupied = occupancyKeys(pieces, connections)
    const freePorts = allWorldPorts(pieces, occupied).filter((p) => !p.occupied)
    const target =
      freePorts.find(
        (p) =>
          p.kind === 'interlock' &&
          p.pieceId === slotSteer.targetPieceId &&
          p.portId === slotSteer.targetPortId,
      ) ?? nearestInterlockOnPointer(freePorts, view)
    if (!target) return
    const aim = aimPointOnSlotPlane(target, view.ray)
    const snap = snapInterlockAimed(catalog, target, aim)
    if (!snap) return
    set({
      ghost: makeGhost(
        selectedCatalogId,
        snap.position,
        snap.rotation,
        {
          localPortId: snap.localPortId,
          targetPieceId: snap.target.pieceId,
          targetPortId: snap.target.portId,
        },
        pieces,
        connections,
      ),
    })
  },

  endSlotSteer: () => set({ slotSteer: null }),

  beginSlide: (pieceId, ray) => {
    const { pieces, connections } = get()
    const piece = pieces.find((p) => p.id === pieceId)
    if (!piece) return false
    const joint = slideJointForPiece(piece, pieces, connections)
    if (!joint) return false
    const origin = new THREE.Vector3(...joint.origin)
    const dir = new THREE.Vector3(...joint.dir)
    const grabT = rayAxisT(ray, origin, dir)
    if (grabT == null) return false
    const companionIds = slideMovingIds(pieceId, joint.anchorIds, pieces, connections)
    const startPositions: Record<string, [number, number, number]> = {}
    for (const id of companionIds) {
      const p = pieces.find((x) => x.id === id)
      if (p) startPositions[id] = [...p.position]
    }
    set({
      selectedPieceId: pieceId,
      slide: {
        pieceId,
        companionIds,
        startPositions,
        origin: joint.origin,
        dir: joint.dir,
        grabT,
        minDelta: joint.minDelta,
        maxDelta: joint.maxDelta,
        moved: false,
        startSnapshot: snapshotOf(get()),
      },
    })
    return true
  },

  steerSlide: (ray) => {
    const { slide, pieces, connections } = get()
    if (!slide) return
    const origin = new THREE.Vector3(...slide.origin)
    const dir = new THREE.Vector3(...slide.dir)
    const t = rayAxisT(ray, origin, dir)
    if (t == null) return
    let delta = THREE.MathUtils.clamp(t - slide.grabT, slide.minDelta, slide.maxDelta)
    const startMap = new Map(
      Object.entries(slide.startPositions) as [string, [number, number, number]][],
    )
    delta = slideSnapDelta(
      slide.companionIds,
      pieces,
      connections,
      dir,
      delta,
      slide.minDelta,
      slide.maxDelta,
      startMap,
    )

    const moving = new Set(slide.companionIds)
    const nextPieces = pieces.map((p) => {
      if (!moving.has(p.id)) return p
      const start = slide.startPositions[p.id] ?? p.position
      return {
        ...p,
        position: [
          start[0] + dir.x * delta,
          start[1] + dir.y * delta,
          start[2] + dir.z * delta,
        ] as [number, number, number],
      }
    })

    const root = nextPieces.find((p) => p.id === slide.pieceId)
    if (!root) return
    const prev = pieces.find((p) => p.id === slide.pieceId)
    if (
      prev &&
      Math.abs(root.position[0] - prev.position[0]) < 1e-5 &&
      Math.abs(root.position[1] - prev.position[1]) < 1e-5 &&
      Math.abs(root.position[2] - prev.position[2]) < 1e-5
    ) {
      return
    }

    for (const id of slide.companionIds) {
      const next = nextPieces.find((p) => p.id === id)
      if (!next) continue
      if (poseCollides(next, nextPieces, connections)) return
    }

    set({
      pieces: nextPieces,
      connections: mergeGeometricConnections(nextPieces, connections),
      slide: { ...slide, moved: true },
    })
  },

  endSlide: () => {
    const { slide, past } = get()
    if (!slide) return
    if (slide.moved) {
      set({
        slide: null,
        past: [...past, slide.startSnapshot].slice(-HISTORY_LIMIT),
        future: [],
      })
      return
    }
    set({ slide: null })
  },

  clearGhost: () => {
    if (get().rodAim?.dragging || get().rodSteer || get().slotSteer) return
    set({ ghost: null, rodAim: null, rodSteer: null, slotSteer: null })
  },

  placeGhost: () => {
    const current = get()
    const { ghost, pieces, connections, placementMode } = current
    if (!ghost) return
    if (
      ghost.collision ||
      ghostCollides(
        ghost.catalogId,
        ghost.position,
        ghost.rotation,
        pieces,
        connections,
        ghost.snap,
      )
    ) {
      return
    }

    const id = createId()
    const nextPiece: PlacedPiece = {
      id,
      catalogId: ghost.catalogId,
      position: ghost.position,
      rotation: ghost.rotation,
    }

    const nextConnections = mergeGeometricConnections(
      [...pieces, nextPiece],
      ghost.snap
        ? [
            ...connections,
            {
              aPieceId: id,
              aPortId: ghost.snap.localPortId,
              bPieceId: ghost.snap.targetPieceId,
              bPortId: ghost.snap.targetPortId,
            },
          ]
        : connections,
    )

    const single = placementMode === 'single'
    withHistory(get, set, () => ({
      pieces: [...pieces, nextPiece],
      connections: nextConnections,
      selectedPieceId: id,
      menuOpen: true,
      selectedCatalogId: single ? null : ghost.catalogId,
      ghost: single
        ? null
        : makeGhost(ghost.catalogId, ghost.position, ghost.rotation, null, [...pieces, nextPiece], nextConnections),
      rodAim: null,
      rodSteer: null,
      slotSteer: null,
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
      slotSteer: null,
      slide: null,
      menuOpen: true,
    })),

  loadLastSession: () => {
    const session = readLastSession()
    if (!session || session.pieces.length === 0) return false
    withHistory(get, set, () => applySessionState(session))
    return true
  },

  rotateSelectedY: (deltaRad) => {
    const { selectedPieceId, pieces, connections, workNormal } = get()
    if (!selectedPieceId) return
    const piece = pieces.find((p) => p.id === selectedPieceId)
    if (!piece) return
    const catalog = getCatalogPiece(piece.catalogId)
    if (catalog && isConnectorLike(catalog)) {
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
    const coupled = mergeGeometricConnections(pieces, connections)
    let probe = piece
    let probeConns = coupled
    for (let step = 0; step < 8; step++) {
      const next = nextUsableConnectorPose(probe, pieces, probeConns, mode)
      if (!next) return
      const nextPiece = { ...probe, position: next.position, rotation: next.rotation }
      if (!poseCollides(nextPiece, pieces, next.connections)) {
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
        return
      }
      probe = nextPiece
      probeConns = next.connections
    }
  },

  rotateSelectedOpposite: () => {
    const { selectedPieceId, pieces, connections, workNormal } = get()
    if (!selectedPieceId) return
    const piece = pieces.find((p) => p.id === selectedPieceId)
    if (!piece) return
    const catalog = getCatalogPiece(piece.catalogId)
    if (catalog && isConnectorLike(catalog)) {
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
      slotSteer: null,
      slide: null,
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
      slotSteer: null,
      slide: null,
    })
  },
}))

let autosaveTimer: ReturnType<typeof setTimeout> | undefined

function persistSession(state: BuilderState) {
  const session = buildSession(state.pieces, state.connections, nextId)
  saveAutosave(session)
  const available = hasLastSession()
  if (state.hasSavedSession !== available) {
    useBuilderStore.setState({ hasSavedSession: available })
  }
}

useBuilderStore.subscribe((state, prev) => {
  if (state.pieces === prev.pieces && state.connections === prev.connections) return
  if (autosaveTimer !== undefined) clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(() => {
    autosaveTimer = undefined
    persistSession(useBuilderStore.getState())
  }, 250)
})

// Keep last-session in sync with a hydrated non-empty boot build.
if (bootSession && bootSession.pieces.length > 0) {
  persistSession(useBuilderStore.getState())
}
