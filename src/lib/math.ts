import * as THREE from 'three'
import type {
  CatalogPiece,
  Connection,
  ConnectorRotateMode,
  PlacedPiece,
  PortDef,
  WorldPort,
} from '../types/knex'
import {
  getCatalogPiece,
  isConnectorLike,
  isPreassembledHub,
  isShaftSleeve,
  gearMeshCenterDistance,
  GEAR_MESH_TOLERANCE,
  HUB_HEIGHT,
  HUB_RADIUS,
  MOTOR_WORM_PITCH_R_MM,
  mm,
  ROD_RADIUS_SCENE,
  SOCKET_RADIUS,
  SHAFT_END_INSET,
} from '../data/catalog'

/** Max cursor distance to a free port for snap to engage. */
export const SNAP_DISTANCE = 1.75
export const GRID_SIZE = 0.5
/** K'NEX clips sit on 45° detents. */
export const KNEX_DETENT = Math.PI / 4
const POSE_POS_TOL = 0.08
const POSE_DIR_OPPOSITE = -0.9
const POSE_DIR_PERP = 0.5
const SLOT_ALIGN = 0.82

export function quatFromTuple(q: [number, number, number, number]): THREE.Quaternion {
  return new THREE.Quaternion(q[0], q[1], q[2], q[3])
}

export function tupleFromQuat(q: THREE.Quaternion): [number, number, number, number] {
  return [q.x, q.y, q.z, q.w]
}

export function worldPort(
  piece: PlacedPiece,
  port: PortDef,
  occupied: boolean,
): WorldPort {
  const quat = quatFromTuple(piece.rotation)
  const localPos = new THREE.Vector3(...port.position)
  const localDir = new THREE.Vector3(...port.direction).normalize()
  localPos.applyQuaternion(quat)
  localDir.applyQuaternion(quat)
  const localSlot = new THREE.Vector3(0, 0, 1).applyQuaternion(quat)
  return {
    pieceId: piece.id,
    portId: port.id,
    kind: port.kind,
    position: [
      piece.position[0] + localPos.x,
      piece.position[1] + localPos.y,
      piece.position[2] + localPos.z,
    ],
    direction: [localDir.x, localDir.y, localDir.z],
    slot: [localSlot.x, localSlot.y, localSlot.z],
    occupied,
  }
}

export function allWorldPorts(
  pieces: PlacedPiece[],
  occupiedKeys: Set<string>,
): WorldPort[] {
  const result: WorldPort[] = []
  for (const piece of pieces) {
    const catalog = getCatalogPiece(piece.catalogId)
    if (!catalog) continue
    const centerBlocked = centerHoleBlocked(piece, catalog, occupiedKeys)
    for (const port of catalog.ports) {
      if (centerBlocked && isCenterSocket(port.id)) continue
      const key = `${piece.id}:${port.id}`
      result.push(worldPort(piece, port, occupiedKeys.has(key)))
    }
  }
  return result
}

/** Nested 3D connectors fill the hub — no rod through the center. */
function centerHoleBlocked(
  piece: PlacedPiece,
  catalog: CatalogPiece,
  occupiedKeys: Set<string>,
): boolean {
  if (isPreassembledHub(catalog)) return true
  const interlock = catalog.ports.find((p) => p.kind === 'interlock')
  if (!interlock) return false
  return occupiedKeys.has(`${piece.id}:${interlock.id}`)
}

export function snapPointToGrid(point: THREE.Vector3, y = 0.35): THREE.Vector3 {
  return new THREE.Vector3(
    Math.round(point.x / GRID_SIZE) * GRID_SIZE,
    y,
    Math.round(point.z / GRID_SIZE) * GRID_SIZE,
  )
}

function planeBasis(normal: THREE.Vector3): { tangent: THREE.Vector3; bitangent: THREE.Vector3 } {
  const n = normal.clone().normalize()
  const helper =
    Math.abs(n.dot(new THREE.Vector3(0, 1, 0))) < 0.85
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(1, 0, 0)
  const tangent = new THREE.Vector3().crossVectors(helper, n).normalize()
  const bitangent = new THREE.Vector3().crossVectors(n, tangent).normalize()
  return { tangent, bitangent }
}

/** Snap a direction onto the 45° K'NEX compass in the working plane. */
export function detentDirectionOnPlane(
  from: THREE.Vector3,
  to: THREE.Vector3,
  workNormal: THREE.Vector3,
): THREE.Vector3 | null {
  const normal = workNormal.clone().normalize()
  const delta = to.clone().sub(from)
  delta.sub(normal.clone().multiplyScalar(delta.dot(normal)))
  if (delta.lengthSq() < 0.04) return null
  delta.normalize()
  const { tangent, bitangent } = planeBasis(normal)
  const theta = Math.atan2(delta.dot(bitangent), delta.dot(tangent))
  const snapped = Math.round(theta / KNEX_DETENT) * KNEX_DETENT
  return tangent
    .multiplyScalar(Math.cos(snapped))
    .add(bitangent.multiplyScalar(Math.sin(snapped)))
    .normalize()
}

/**
 * Lay a rod in the working plane with one end pinned at `anchor` and the
 * free tip aimed at `tip` (45° detents).
 */
export function aimRodFromAnchor(
  catalog: CatalogPiece,
  anchor: THREE.Vector3,
  tip: THREE.Vector3,
  workNormal: THREE.Vector3,
): { position: [number, number, number]; rotation: [number, number, number, number] } | null {
  if (catalog.category !== 'rods') return null
  const length = catalog.length ?? 1
  const dir = detentDirectionOnPlane(anchor, tip, workNormal)
  if (!dir) return null
  const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir)
  const half = length / 2
  const center = anchor.clone().add(dir.clone().multiplyScalar(half))
  return {
    position: [center.x, center.y, center.z],
    rotation: tupleFromQuat(rotation),
  }
}

export function isCenterSocket(portId: string): boolean {
  return portId.startsWith('center')
}

/** Coaxial hole a rod shaft can pass through (hub center, spacer/wheel/gear bore). */
export function isThroughHoleSocket(portId: string): boolean {
  return (
    isCenterSocket(portId) ||
    portId === 'bore' ||
    portId === 'axle' ||
    portId === 'drive' ||
    portId === 'drive-end' ||
    portId.startsWith('mount-') ||
    portId === 'rod-loop'
  )
}

export function hasInterlock(catalog: CatalogPiece): boolean {
  return catalog.ports.some((p) => p.kind === 'interlock')
}

/** World position of the snap orb — slot orbs sit at the open 3D slot, not the hub. */
export function portOrbPosition(port: WorldPort): THREE.Vector3 {
  const pos = new THREE.Vector3(...port.position)
  if (port.kind !== 'interlock') return pos
  return pos.add(new THREE.Vector3(...port.slot).normalize().multiplyScalar(SOCKET_RADIUS))
}

function poseFromRotation(
  localPort: PortDef,
  target: WorldPort,
  rotation: THREE.Quaternion,
): { position: [number, number, number]; rotation: [number, number, number, number] } {
  const localPos = new THREE.Vector3(...localPort.position).applyQuaternion(rotation)
  const targetPos = new THREE.Vector3(...target.position)
  const position = targetPos.sub(localPos)
  return {
    position: [position.x, position.y, position.z],
    rotation: tupleFromQuat(rotation),
  }
}

function twistSlotOnto(
  rotation: THREE.Quaternion,
  ghostHub: THREE.Vector3,
  desiredSlot: THREE.Vector3,
) {
  const localSlot = new THREE.Vector3(0, 0, 1).applyQuaternion(rotation)
  const slotDot = localSlot.dot(desiredSlot)
  if (slotDot > 0.98) return
  if (slotDot < -0.98) {
    rotation.premultiply(new THREE.Quaternion().setFromAxisAngle(ghostHub, Math.PI))
    return
  }
  rotation.premultiply(new THREE.Quaternion().setFromUnitVectors(localSlot, desiredSlot))
}

function interlockGhostHub(target: WorldPort, hubSign: 1 | -1): THREE.Vector3 {
  const targetHub = new THREE.Vector3(...target.direction).normalize()
  const targetSlot = new THREE.Vector3(...target.slot).normalize()
  const ghostHub = new THREE.Vector3().crossVectors(targetHub, targetSlot).normalize()
  if (ghostHub.lengthSq() < 1e-6) {
    ghostHub
      .crossVectors(
        targetHub,
        Math.abs(targetHub.y) < 0.85 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0),
      )
      .normalize()
  }
  return ghostHub.multiplyScalar(hubSign)
}

function alignInterlock(
  localPort: PortDef,
  target: WorldPort,
  hubSign: 1 | -1,
  slotSign: 1 | -1,
): { position: [number, number, number]; rotation: [number, number, number, number] } {
  const ghostHub = interlockGhostHub(target, hubSign)
  const desiredSlot = new THREE.Vector3(...target.slot).normalize().multiplyScalar(slotSign)
  const localHub = new THREE.Vector3(...localPort.direction).normalize()
  const rotation = new THREE.Quaternion().setFromUnitVectors(localHub, ghostHub)
  twistSlotOnto(rotation, ghostHub, desiredSlot)
  return poseFromRotation(localPort, target, rotation)
}

/**
 * Orient a piece so one of its ports matches a target world port
 * (opposite direction, same position after placement).
 *
 * Interlock ports (the one 3D slot at local +Z) join slot-into-slot at 90°:
 * incoming hub = targetHub × targetSlot, slots stay aligned. Same recipe
 * for grey/grey, grey/blue, and blue/blue.
 */
export function alignPieceToPort(
  localPort: PortDef,
  target: WorldPort,
): { position: [number, number, number]; rotation: [number, number, number, number] } {
  if (localPort.kind === 'shaft' && isThroughHoleSocket(target.portId)) {
    const localDir = new THREE.Vector3(...localPort.direction).normalize()
    const targetDir = new THREE.Vector3(...target.direction).normalize()
    const rotation = new THREE.Quaternion().setFromUnitVectors(localDir, targetDir)
    const targetPos = new THREE.Vector3(...target.position)
    return {
      position: [targetPos.x, targetPos.y, targetPos.z],
      rotation: tupleFromQuat(rotation),
    }
  }
  if (localPort.kind === 'interlock' && target.kind === 'interlock') {
    return alignInterlock(localPort, target, 1, 1)
  }

  const localDir = new THREE.Vector3(...localPort.direction).normalize()
  const targetDir = new THREE.Vector3(...target.direction).normalize().multiplyScalar(-1)

  const rotation = new THREE.Quaternion().setFromUnitVectors(localDir, targetDir)

  // Twist freedom around the shared axis: keep "up" as upright as possible.
  const localUp = new THREE.Vector3(0, 1, 0)
  const worldUp = localUp.clone().applyQuaternion(rotation)
  const axis = targetDir.clone()
  const projectedDesired = new THREE.Vector3(0, 1, 0)
    .sub(axis.clone().multiplyScalar(axis.dot(new THREE.Vector3(0, 1, 0))))
  const projectedCurrent = worldUp
    .clone()
    .sub(axis.clone().multiplyScalar(axis.dot(worldUp)))

  if (projectedDesired.lengthSq() > 1e-6 && projectedCurrent.lengthSq() > 1e-6) {
    projectedDesired.normalize()
    projectedCurrent.normalize()
    const twist = new THREE.Quaternion().setFromUnitVectors(projectedCurrent, projectedDesired)
    rotation.premultiply(twist)
  }

  const localPos = new THREE.Vector3(...localPort.position).applyQuaternion(rotation)
  const targetPos = new THREE.Vector3(...target.position)
  const position = targetPos.sub(localPos)

  return {
    position: [position.x, position.y, position.z],
    rotation: tupleFromQuat(rotation),
  }
}

export function findBestSnap(
  catalog: CatalogPiece,
  freePorts: WorldPort[],
  cursor: THREE.Vector3,
): {
  position: [number, number, number]
  rotation: [number, number, number, number]
  localPortId: string
  target: WorldPort
  distance: number
} | null {
  let best: {
    position: [number, number, number]
    rotation: [number, number, number, number]
    localPortId: string
    target: WorldPort
    distance: number
  } | null = null

  for (const localPort of catalog.ports) {
    for (const target of freePorts) {
      const compatible =
        (localPort.kind === 'rod-end' &&
          target.kind === 'socket' &&
          !isThroughHoleSocket(target.portId)) ||
        (localPort.kind === 'shaft' &&
          target.kind === 'socket' &&
          isThroughHoleSocket(target.portId)) ||
        (localPort.kind === 'socket' &&
          target.kind === 'rod-end' &&
          !isThroughHoleSocket(localPort.id)) ||
        (localPort.kind === 'interlock' && target.kind === 'interlock')
      if (!compatible) continue

      const pose =
        localPort.kind === 'interlock' && target.kind === 'interlock'
          ? snapInterlockAimed(catalog, target)
          : alignPieceToPort(localPort, target)
      if (!pose) continue
      const portWorld = portOrbPosition(target)
      const score = portWorld.distanceTo(cursor)

      if (score > SNAP_DISTANCE) continue
      if (!best || score < best.distance) {
        best = {
          ...pose,
          localPortId: localPort.id,
          target,
          distance: score,
        }
      }
    }
  }

  return best
}

const HOVER_PERP = 0.16

/** Socket the pointer is actually over — not the ground projection under it. */
export function nearestSocketAlongRay(
  ports: WorldPort[],
  ray: THREE.Ray,
  maxPerp = HOVER_PERP,
): WorldPort | null {
  let best: WorldPort | null = null
  let bestScore = Number.POSITIVE_INFINITY
  const closest = new THREE.Vector3()
  for (const port of ports) {
    if (port.kind !== 'socket' || port.occupied) continue
    const point = new THREE.Vector3(...port.position)
    ray.closestPointToPoint(point, closest)
    const along = closest.clone().sub(ray.origin).dot(ray.direction)
    if (along < 0.08) continue
    const perp = closest.distanceTo(point)
    if (perp > maxPerp) continue
    const score = perp + along * 0.002
    if (score < bestScore) {
      bestScore = score
      best = port
    }
  }
  return best
}

export function findBestSnapOnRay(
  catalog: CatalogPiece,
  freePorts: WorldPort[],
  ray: THREE.Ray,
): ReturnType<typeof findBestSnap> {
  const hovered = nearestSocketAlongRay(freePorts, ray)
  if (!hovered) return null
  return findBestSnap(catalog, [hovered], new THREE.Vector3(...hovered.position))
}

export interface PointerView {
  ray: THREE.Ray
  camera: THREE.Camera
  ndc: THREE.Vector2
}

/** Yellow-orb hit radius in world units, projected to screen for picking. */
const ORB_HIT = 0.14

/** The snap orb under the pointer, using screen position first so hover/press match what you see. */
export function nearestSocketOnPointer(
  ports: WorldPort[],
  view: PointerView,
): WorldPort | null {
  let best: WorldPort | null = null
  let bestDist = Number.POSITIVE_INFINITY
  for (const port of ports) {
    if (port.kind !== 'socket' || port.occupied) continue
    const world = new THREE.Vector3(...port.position)
    const ndc = world.clone().project(view.camera)
    if (ndc.z < -1 || ndc.z > 1) continue
    const dist = Math.hypot(view.ndc.x - ndc.x, view.ndc.y - ndc.y)
    if (dist < bestDist) {
      bestDist = dist
      best = port
    }
  }
  if (!best) return nearestSocketAlongRay(ports, view.ray)
  const pos = new THREE.Vector3(...best.position)
  const posNdc = pos.clone().project(view.camera)
  const edgeNdc = pos.clone().add(new THREE.Vector3(ORB_HIT, 0, 0)).project(view.camera)
  const hitR = Math.max(0.045, Math.hypot(edgeNdc.x - posNdc.x, edgeNdc.y - posNdc.y) * 1.35)
  if (bestDist <= hitR) return best
  return nearestSocketAlongRay(ports, view.ray)
}

/** Socket-to-socket match for a rod that seats in two facing clips. */
const ROD_SPAN_LENGTH_TOL = 0.2
/** Clips must point along the span (toward each other) — ~44°, same as clip seating. */
const ROD_SPAN_FACE = 0.72

function isFreeClip(port: WorldPort): boolean {
  return (
    port.kind === 'socket' &&
    !port.occupied &&
    !isThroughHoleSocket(port.portId) &&
    port.portId !== 'hole'
  )
}

function rodSpanEndPort(catalog: CatalogPiece): PortDef | null {
  return (
    catalog.ports.find((p) => p.kind === 'rod-end' && p.id === 'end-a') ??
    catalog.ports.find((p) => p.kind === 'rod-end') ??
    null
  )
}

function distPointToSegment2(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const abx = bx - ax
  const aby = by - ay
  const apx = px - ax
  const apy = py - ay
  const ab2 = abx * abx + aby * aby
  if (ab2 < 1e-12) return Math.hypot(apx, apy)
  const t = Math.min(1, Math.max(0, (apx * abx + apy * aby) / ab2))
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t))
}

/**
 * Unit A→B when those clips face each other and sit a catalog-rod apart.
 * Skips two clips on the same hub (green vs 2×socket is a false match).
 */
function spanDirection(a: WorldPort, b: WorldPort, length: number): THREE.Vector3 | null {
  if (a.pieceId === b.pieceId) return null
  const av = new THREE.Vector3(...a.position)
  const bv = new THREE.Vector3(...b.position)
  const dist = av.distanceTo(bv)
  if (dist < 1e-6) return null
  if (Math.abs(dist - length) > ROD_SPAN_LENGTH_TOL) return null
  const along = bv.clone().sub(av).multiplyScalar(1 / dist)
  const aDir = new THREE.Vector3(...a.direction).normalize()
  const bDir = new THREE.Vector3(...b.direction).normalize()
  if (aDir.dot(along) < ROD_SPAN_FACE) return null
  if (bDir.dot(along) > -ROD_SPAN_FACE) return null
  return along
}

function poseRodOnSpan(
  catalog: CatalogPiece,
  hovered: WorldPort,
  along: THREE.Vector3,
): ReturnType<typeof findBestSnap> {
  const local = rodSpanEndPort(catalog)
  if (!local) return null
  const facing: WorldPort = {
    ...hovered,
    direction: [along.x, along.y, along.z],
  }
  const pose = alignPieceToPort(local, facing)
  return {
    ...pose,
    rotation: canonicalRotation(pose.rotation),
    localPortId: local.id,
    target: hovered,
    distance: 0,
  }
}

/** Yaw a rod onto the line between two facing clips when the length matches. */
export function findRodSpanSnap(
  catalog: CatalogPiece,
  freePorts: WorldPort[],
  hovered: WorldPort,
): ReturnType<typeof findBestSnap> {
  if (catalog.category !== 'rods') return null
  const length = catalog.length
  if (length == null || !isFreeClip(hovered)) return null
  let best: { along: THREE.Vector3; err: number; face: number } | null = null
  const hoveredPos = new THREE.Vector3(...hovered.position)
  const hoveredDir = new THREE.Vector3(...hovered.direction).normalize()
  for (const partner of freePorts) {
    if (partner === hovered || !isFreeClip(partner)) continue
    const along = spanDirection(hovered, partner, length)
    if (!along) continue
    const err = Math.abs(hoveredPos.distanceTo(new THREE.Vector3(...partner.position)) - length)
    const face = hoveredDir.dot(along)
    if (
      !best ||
      err < best.err - 1e-6 ||
      (Math.abs(err - best.err) <= 1e-6 && face > best.face)
    ) {
      best = { along, err, face }
    }
  }
  if (!best) return null
  return poseRodOnSpan(catalog, hovered, best.along)
}

/** Pointer is over the gap between two facing clips — snap the rod across both. */
function findRodSpanNearPointer(
  catalog: CatalogPiece,
  freePorts: WorldPort[],
  view: PointerView,
): ReturnType<typeof findBestSnap> {
  if (catalog.category !== 'rods') return null
  const length = catalog.length
  if (length == null) return null
  const clips = freePorts.filter(isFreeClip)
  let best: { hovered: WorldPort; along: THREE.Vector3; score: number } | null = null
  for (let i = 0; i < clips.length; i++) {
    for (let j = 0; j < clips.length; j++) {
      if (i === j) continue
      const along = spanDirection(clips[i], clips[j], length)
      if (!along) continue
      const a = new THREE.Vector3(...clips[i].position)
      const b = new THREE.Vector3(...clips[j].position)
      const aNdc = a.clone().project(view.camera)
      const bNdc = b.clone().project(view.camera)
      if (aNdc.z < -1 || aNdc.z > 1 || bNdc.z < -1 || bNdc.z > 1) continue
      const dist = distPointToSegment2(
        view.ndc.x,
        view.ndc.y,
        aNdc.x,
        aNdc.y,
        bNdc.x,
        bNdc.y,
      )
      const mid = a.clone().lerp(b, 0.5)
      const midNdc = mid.clone().project(view.camera)
      const edgeNdc = mid.clone().add(new THREE.Vector3(0.28, 0, 0)).project(view.camera)
      const hitR = Math.max(0.04, Math.hypot(edgeNdc.x - midNdc.x, edgeNdc.y - midNdc.y) * 1.35)
      if (dist > hitR) continue
      if (!best || dist < best.score) best = { hovered: clips[i], along, score: dist }
    }
  }
  if (!best) return null
  return poseRodOnSpan(catalog, best.hovered, best.along)
}

/**
 * Snap a rod to the hovered clip. If another clip faces it at this rod’s length,
 * yaw onto that span so both ends seat at once — otherwise stay on the clip axis.
 */
export function findRodSnapOnPointer(
  catalog: CatalogPiece,
  freePorts: WorldPort[],
  view: PointerView,
): ReturnType<typeof findBestSnap> {
  if (catalog.category !== 'rods') return findBestSnapOnRay(catalog, freePorts, view.ray)
  const hovered = nearestSocketOnPointer(freePorts, view)
  if (hovered && !isThroughHoleSocket(hovered.portId)) {
    const span = findRodSpanSnap(catalog, freePorts, hovered)
    if (span) return span
  }
  if (hovered) {
    return findBestSnap(catalog, [hovered], new THREE.Vector3(...hovered.position))
  }
  return findRodSpanNearPointer(catalog, freePorts, view)
}

export interface InterlockAimPose {
  position: [number, number, number]
  rotation: [number, number, number, number]
  localPortId: string
  /** World direction the incoming plate’s arc faces (perpendicular to the slot). */
  fan: [number, number, number]
}

function interlockFan(
  rotation: [number, number, number, number],
  slotDir: THREE.Vector3,
): THREE.Vector3 {
  const q = quatFromTuple(rotation)
  const fan = new THREE.Vector3(1, 0, 0).applyQuaternion(q)
  fan.sub(slotDir.clone().multiplyScalar(fan.dot(slotDir)))
  if (fan.lengthSq() < 1e-6) {
    fan.set(0, 1, 0).applyQuaternion(q)
    fan.sub(slotDir.clone().multiplyScalar(fan.dot(slotDir)))
  }
  return fan.normalize()
}

/** Valid 90° slot-in-slot poses for a slotted connector on a free slot. */
export function interlockAimPoses(
  catalog: CatalogPiece,
  target: WorldPort,
): InterlockAimPose[] {
  if (target.kind !== 'interlock' || target.occupied) return []
  const local = catalog.ports.find((p) => p.kind === 'interlock')
  if (!local) return []
  const slotDir = new THREE.Vector3(...target.slot).normalize()
  const seen = new Set<string>()
  const poses: InterlockAimPose[] = []
  for (const hubSign of [1, -1] as const) {
    for (const slotSign of [1, -1] as const) {
      const pose = alignInterlock(local, target, hubSign, slotSign)
      const key = geometryKey(pose.position, pose.rotation)
      if (seen.has(key)) continue
      seen.add(key)
      const fan = interlockFan(pose.rotation, slotDir)
      poses.push({
        position: pose.position,
        rotation: canonicalRotation(pose.rotation),
        localPortId: local.id,
        fan: [fan.x, fan.y, fan.z],
      })
    }
  }
  return poses
}

export function pickInterlockAimPose(
  poses: InterlockAimPose[],
  target: WorldPort,
  aimPoint: THREE.Vector3,
): number {
  if (poses.length === 0) return 0
  const slotPos = portOrbPosition(target)
  const slotDir = new THREE.Vector3(...target.slot).normalize()
  const aim = aimPoint.clone().sub(slotPos)
  aim.sub(slotDir.clone().multiplyScalar(aim.dot(slotDir)))
  if (aim.lengthSq() < 0.018) {
    let best = 0
    let bestY = Number.NEGATIVE_INFINITY
    poses.forEach((pose, index) => {
      if (pose.fan[1] > bestY) {
        bestY = pose.fan[1]
        best = index
      }
    })
    return best
  }
  aim.normalize()
  let best = 0
  let bestDot = Number.NEGATIVE_INFINITY
  poses.forEach((pose, index) => {
    const dot = aim.x * pose.fan[0] + aim.y * pose.fan[1] + aim.z * pose.fan[2]
    if (dot > bestDot) {
      bestDot = dot
      best = index
    }
  })
  return best
}

function nearestInterlockAlongRay(ports: WorldPort[], ray: THREE.Ray): WorldPort | null {
  let best: WorldPort | null = null
  let bestScore = Number.POSITIVE_INFINITY
  const closest = new THREE.Vector3()
  for (const port of ports) {
    if (port.kind !== 'interlock' || port.occupied) continue
    const point = portOrbPosition(port)
    ray.closestPointToPoint(point, closest)
    const along = closest.clone().sub(ray.origin).dot(ray.direction)
    if (along < 0.08) continue
    const perp = closest.distanceTo(point)
    if (perp > 0.2) continue
    const score = perp + along * 0.002
    if (score < bestScore) {
      bestScore = score
      best = port
    }
  }
  return best
}

/** Magenta slot orb under the pointer. */
export function nearestInterlockOnPointer(
  ports: WorldPort[],
  view: PointerView,
): WorldPort | null {
  let best: WorldPort | null = null
  let bestDist = Number.POSITIVE_INFINITY
  for (const port of ports) {
    if (port.kind !== 'interlock' || port.occupied) continue
    const world = portOrbPosition(port)
    const ndc = world.clone().project(view.camera)
    if (ndc.z < -1 || ndc.z > 1) continue
    const dist = Math.hypot(view.ndc.x - ndc.x, view.ndc.y - ndc.y)
    if (dist < bestDist) {
      bestDist = dist
      best = port
    }
  }
  if (!best) return nearestInterlockAlongRay(ports, view.ray)
  const pos = portOrbPosition(best)
  const posNdc = pos.clone().project(view.camera)
  const edgeNdc = pos.clone().add(new THREE.Vector3(ORB_HIT * 1.2, 0, 0)).project(view.camera)
  const hitR = Math.max(0.05, Math.hypot(edgeNdc.x - posNdc.x, edgeNdc.y - posNdc.y) * 1.4)
  if (bestDist <= hitR) return best
  return nearestInterlockAlongRay(ports, view.ray)
}

export function aimPointOnSlotPlane(
  target: WorldPort,
  ray: THREE.Ray,
): THREE.Vector3 {
  const slotPos = portOrbPosition(target)
  const slotDir = new THREE.Vector3(...target.slot).normalize()
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(slotDir, slotPos)
  const hit = new THREE.Vector3()
  if (ray.intersectPlane(plane, hit)) return hit
  ray.closestPointToPoint(slotPos, hit)
  return hit
}

/** Snap a slotted connector to a known slot, aimed by drag if given. */
export function snapInterlockAimed(
  catalog: CatalogPiece,
  target: WorldPort,
  aimPoint?: THREE.Vector3,
): ReturnType<typeof findBestSnap> {
  const poses = interlockAimPoses(catalog, target)
  if (!poses.length) return null
  const index = pickInterlockAimPose(
    poses,
    target,
    aimPoint ?? portOrbPosition(target).add(new THREE.Vector3(0, 1, 0)),
  )
  const pose = poses[index]
  return {
    ...pose,
    target,
    distance: 0,
  }
}

/** Snap a slotted connector to the magenta slot orb, aimed by drag if given. */
export function findInterlockSnapOnPointer(
  catalog: CatalogPiece,
  freePorts: WorldPort[],
  view: PointerView,
  aimPoint?: THREE.Vector3,
): ReturnType<typeof findBestSnap> {
  if (!hasInterlock(catalog)) return null
  const hovered = nearestInterlockOnPointer(freePorts, view)
  if (!hovered) return null
  return snapInterlockAimed(catalog, hovered, aimPoint)
}

const CLIP_GRIP = 0.34

/**
 * If a rod end is sitting in a clip, lock to that clip — spanning both ends
 * when a second clip faces it at this length, otherwise the clip’s own axis.
 */
export function axialSnapIfNearSocket(
  catalog: CatalogPiece,
  pose: { position: [number, number, number]; rotation: [number, number, number, number] },
  freePorts: WorldPort[],
): ReturnType<typeof findBestSnap> {
  if (catalog.category !== 'rods') return null
  const dummy: PlacedPiece = {
    id: 'ghost',
    catalogId: catalog.id,
    position: pose.position,
    rotation: pose.rotation,
  }
  let best: { local: PortDef; target: WorldPort; dist: number } | null = null
  for (const local of catalog.ports) {
    if (local.kind !== 'rod-end') continue
    const end = new THREE.Vector3(...worldPort(dummy, local, false).position)
    for (const target of freePorts) {
      if (target.kind !== 'socket' || isThroughHoleSocket(target.portId) || target.occupied) continue
      const dist = end.distanceTo(new THREE.Vector3(...target.position))
      if (dist > CLIP_GRIP) continue
      if (!best || dist < best.dist) best = { local, target, dist }
    }
  }
  if (!best) return null
  const span = findRodSpanSnap(catalog, freePorts, best.target)
  if (span) {
    return { ...span, distance: best.dist }
  }
  const poseSnap = alignPieceToPort(best.local, best.target)
  return {
    ...poseSnap,
    localPortId: best.local.id,
    target: best.target,
    distance: best.dist,
  }
}

export interface ConnectorAimPose {
  position: [number, number, number]
  rotation: [number, number, number, number]
  localPortId: string
  /** World direction from the rod tip toward the connector body, used to aim. */
  fan: [number, number, number]
  inPlane: boolean
}

function poseOnRod(
  localPort: PortDef,
  target: WorldPort,
  twistRad: number,
): { position: [number, number, number]; rotation: [number, number, number, number] } {
  const base = alignPieceToPort(localPort, target)
  if (Math.abs(twistRad) < 1e-8) return base
  const axis = new THREE.Vector3(...target.direction)
  const pivot = new THREE.Vector3(...target.position)
  return rotatePoseAroundAxis(
    { id: '', catalogId: '', position: base.position, rotation: base.rotation },
    axis,
    pivot,
    twistRad,
  )
}

function fanFromPose(
  catalog: CatalogPiece,
  pose: { position: [number, number, number]; rotation: [number, number, number, number] },
  usedPortId: string,
  target: WorldPort,
): THREE.Vector3 {
  const dummy: PlacedPiece = {
    id: 'aim',
    catalogId: catalog.id,
    position: pose.position,
    rotation: pose.rotation,
  }
  const tip = new THREE.Vector3(...target.position)
  const rodDir = new THREE.Vector3(...target.direction).normalize()
  const acc = new THREE.Vector3()
  let count = 0
  for (const port of catalog.ports) {
    if (port.kind !== 'socket' || port.id === usedPortId) continue
    if (port.id.startsWith('center')) continue
    const wp = worldPort(dummy, port, false)
    acc.add(new THREE.Vector3(...wp.position))
    count += 1
  }
  let fan = count > 0 ? acc.multiplyScalar(1 / count).sub(tip) : new THREE.Vector3()
  fan.sub(rodDir.clone().multiplyScalar(fan.dot(rodDir)))
  if (fan.lengthSq() < 1e-5) {
    const plate = new THREE.Vector3(0, 1, 0).applyQuaternion(quatFromTuple(pose.rotation))
    fan = new THREE.Vector3().crossVectors(plate, rodDir)
    if (fan.lengthSq() < 1e-5) fan.crossVectors(new THREE.Vector3(1, 0, 0), rodDir)
  }
  return fan.normalize()
}

function geometryKey(
  position: [number, number, number],
  rotation: [number, number, number, number],
): string {
  const q = canonicalRotation(rotation)
  const r = (n: number) => n.toFixed(2)
  return `${r(position[0])}|${r(position[1])}|${r(position[2])}|${r(q[0])}|${r(q[1])}|${r(q[2])}|${r(q[3])}`
}

function extraRodEndsOnConnectorPose(
  catalog: CatalogPiece,
  pose: { position: [number, number, number]; rotation: [number, number, number, number] },
  usedPortId: string,
  target: WorldPort,
  freePorts: WorldPort[],
): number {
  const dummy: PlacedPiece = {
    id: 'aim',
    catalogId: catalog.id,
    position: pose.position,
    rotation: pose.rotation,
  }
  let extra = 0
  for (const port of catalog.ports) {
    if (port.kind !== 'socket' || port.id === usedPortId) continue
    if (isThroughHoleSocket(port.id) || port.id === 'hole') continue
    const clip = worldPort(dummy, port, false)
    for (const other of freePorts) {
      if (other.kind !== 'rod-end' || other.occupied) continue
      if (other.pieceId === target.pieceId && other.portId === target.portId) continue
      if (clipHoldsRodEnd(clip, other)) {
        extra += 1
        break
      }
    }
  }
  return extra
}

/** Discrete connector poses that can sit on a free rod end. */
export function connectorPosesOnRodEnd(
  catalog: CatalogPiece,
  target: WorldPort,
  workNormal: THREE.Vector3,
  freePorts: WorldPort[] = [],
): ConnectorAimPose[] {
  if (!isConnectorLike(catalog) || target.kind !== 'rod-end') return []
  const sockets = catalog.ports.filter(
    (p) => p.kind === 'socket' && !p.id.startsWith('center') && p.id !== 'hole' && p.id !== 'bore',
  )
  const seen = new Set<string>()
  const poses: ConnectorAimPose[] = []
  const work = workNormal.clone().normalize()

  for (const socket of sockets) {
    for (let t = 0; t < 8; t++) {
      const pose = poseOnRod(socket, target, t * KNEX_DETENT)
      const key = geometryKey(pose.position, pose.rotation)
      if (seen.has(key)) continue
      seen.add(key)
      const plate = new THREE.Vector3(0, 1, 0).applyQuaternion(quatFromTuple(pose.rotation))
      const inPlane = plate.dot(work) > 0.92
      const fan = fanFromPose(catalog, pose, socket.id, target)
      poses.push({
        position: pose.position,
        rotation: canonicalRotation(pose.rotation),
        localPortId: socket.id,
        fan: [fan.x, fan.y, fan.z],
        inPlane,
      })
    }
  }

  if (freePorts.length) {
    const ranked = poses.map((pose) => ({
      pose,
      extra: extraRodEndsOnConnectorPose(catalog, pose, pose.localPortId, target, freePorts),
    }))
    ranked.sort(
      (a, b) => b.extra - a.extra || Number(b.pose.inPlane) - Number(a.pose.inPlane),
    )
    const bestExtra = ranked[0]?.extra ?? 0
    if (bestExtra > 0) {
      return ranked.filter((r) => r.extra === bestExtra).map((r) => r.pose)
    }
  }

  const planar = poses.filter((p) => p.inPlane)
  const chosen = planar.length ? planar : poses
  chosen.sort((a, b) => Number(b.inPlane) - Number(a.inPlane))
  return chosen
}

export function rodAxis(piece: PlacedPiece): {
  origin: THREE.Vector3
  dir: THREE.Vector3
  half: number
} {
  const catalog = getCatalogPiece(piece.catalogId)
  const half = (catalog?.length ?? 1) / 2
  const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(quatFromTuple(piece.rotation)).normalize()
  return { origin: new THREE.Vector3(...piece.position), dir, half }
}

export function pointOnRodShaft(piece: PlacedPiece, point: THREE.Vector3): THREE.Vector3 {
  const { origin, dir, half } = rodAxis(piece)
  const span = Math.max(0, half - SHAFT_END_INSET)
  const t = THREE.MathUtils.clamp(point.clone().sub(origin).dot(dir), -span, span)
  return origin.clone().addScaledVector(dir, t)
}

function perpendicularTo(axis: THREE.Vector3, hint: THREE.Vector3): THREE.Vector3 {
  const radial = hint.clone().sub(axis.clone().multiplyScalar(hint.dot(axis)))
  if (radial.lengthSq() > 1e-8) return radial.normalize()
  const helper =
    Math.abs(axis.dot(new THREE.Vector3(0, 1, 0))) < 0.85
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(1, 0, 0)
  return new THREE.Vector3().crossVectors(axis, helper).normalize()
}

/** Clip opening along the rod, hub offset beside the shaft. */
export function alignClipToShaft(
  localPort: PortDef,
  shaftPoint: THREE.Vector3,
  rodAxisDir: THREE.Vector3,
  hubRadial: THREE.Vector3,
): { position: [number, number, number]; rotation: [number, number, number, number] } {
  const rod = rodAxisDir.clone().normalize()
  const radial = perpendicularTo(rod, hubRadial)
  const towardRod = radial.clone().multiplyScalar(-1)
  const localDir = new THREE.Vector3(...localPort.direction).normalize()
  const rotation = new THREE.Quaternion().setFromUnitVectors(localDir, towardRod)

  const localOpen = new THREE.Vector3(...(localPort.opening ?? [0, 1, 0])).normalize()
  const openWorld = localOpen.clone().applyQuaternion(rotation)
  const openProj = openWorld.sub(towardRod.clone().multiplyScalar(openWorld.dot(towardRod)))
  if (openProj.lengthSq() > 1e-8) {
    openProj.normalize()
    const rodSign = openProj.dot(rod) < 0 ? -1 : 1
    const desired = rod.clone().multiplyScalar(rodSign)
    rotation.premultiply(new THREE.Quaternion().setFromUnitVectors(openProj, desired))
  }

  const localPos = new THREE.Vector3(...localPort.position).applyQuaternion(rotation)
  const position = shaftPoint.clone().sub(localPos)
  return {
    position: [position.x, position.y, position.z],
    rotation: tupleFromQuat(rotation),
  }
}

export function connectorPosesOnShaft(
  catalog: CatalogPiece,
  rod: PlacedPiece,
  shaftPoint: THREE.Vector3,
  workNormal: THREE.Vector3,
): ConnectorAimPose[] {
  if (!isConnectorLike(catalog)) return []
  const { dir } = rodAxis(rod)
  const sockets = catalog.ports.filter(
    (p) => p.kind === 'socket' && !p.id.startsWith('center') && p.id !== 'hole' && p.id !== 'bore',
  )
  const work = workNormal.clone().normalize()
  const basis = perpendicularTo(dir, new THREE.Vector3().crossVectors(work, dir))
  const seen = new Set<string>()
  const poses: ConnectorAimPose[] = []

  for (const socket of sockets) {
    for (let t = 0; t < 8; t++) {
      const radial = basis.clone().applyAxisAngle(dir, t * KNEX_DETENT)
      const pose = alignClipToShaft(socket, shaftPoint, dir, radial)
      const key = geometryKey(pose.position, pose.rotation)
      if (seen.has(key)) continue
      seen.add(key)
      const inPlane = Math.abs(radial.dot(work)) < 0.25
      poses.push({
        position: pose.position,
        rotation: canonicalRotation(pose.rotation),
        localPortId: socket.id,
        fan: [radial.x, radial.y, radial.z],
        inPlane,
      })
    }
  }
  const planar = poses.filter((p) => p.inPlane)
  const chosen = planar.length ? planar : poses
  chosen.sort((a, b) => Number(b.inPlane) - Number(a.inPlane))
  return chosen
}

/** Rod through the hub center hole — stacked like spacers, plate perp to the shaft. */
export function hubPosesOnShaft(
  catalog: CatalogPiece,
  rod: PlacedPiece,
  shaftPoint: THREE.Vector3,
  workNormal: THREE.Vector3,
): ConnectorAimPose[] {
  if (!isConnectorLike(catalog)) return []
  const center = catalog.ports.find((p) => isCenterSocket(p.id))
  if (!center) return []
  const { origin, dir, half } = rodAxis(rod)
  const extra = HUB_HEIGHT / 2
  const span = Math.max(0, half - SHAFT_END_INSET - extra)
  const t = THREE.MathUtils.clamp(shaftPoint.clone().sub(origin).dot(dir), -span, span)
  const onShaft = origin.clone().addScaledVector(dir, t)
  const localDir = new THREE.Vector3(...center.direction).normalize()
  const work = workNormal.clone().normalize()
  const seen = new Set<string>()
  const poses: ConnectorAimPose[] = []

  for (let i = 0; i < 8; i++) {
    const rotation = new THREE.Quaternion().setFromUnitVectors(localDir, dir)
    rotation.premultiply(new THREE.Quaternion().setFromAxisAngle(dir, i * KNEX_DETENT))
    const localPos = new THREE.Vector3(...center.position).applyQuaternion(rotation)
    const position: [number, number, number] = [
      onShaft.x - localPos.x,
      onShaft.y - localPos.y,
      onShaft.z - localPos.z,
    ]
    const rot = canonicalRotation(tupleFromQuat(rotation))
    const key = geometryKey(position, rot)
    if (seen.has(key)) continue
    seen.add(key)
    const clip = new THREE.Vector3(0, 0, 1).applyQuaternion(quatFromTuple(rot))
    const inPlane = Math.abs(clip.dot(work)) < 0.25
    poses.push({
      position,
      rotation: rot,
      localPortId: center.id,
      fan: [dir.x, dir.y, dir.z],
      inPlane,
    })
  }
  const planar = poses.filter((p) => p.inPlane)
  const chosen = planar.length ? planar : poses
  chosen.sort((a, b) => Number(b.inPlane) - Number(a.inPlane))
  return chosen
}

/** Coaxial spacer / wheel / gear on a rod shaft. */
export function sleevePosesOnShaft(
  catalog: CatalogPiece,
  rod: PlacedPiece,
  shaftPoint: THREE.Vector3,
): ConnectorAimPose[] {
  if (!isShaftSleeve(catalog)) return []
  const axle =
    catalog.ports.find((p) => p.id === 'drive' || p.id === 'bore' || p.id === 'axle') ??
    catalog.ports.find((p) => p.kind === 'socket')
  if (!axle) return []
  const { origin, dir, half } = rodAxis(rod)
  const localDir = new THREE.Vector3(...axle.direction).normalize()
  const localPos = new THREE.Vector3(...axle.position)
  const rotation = new THREE.Quaternion().setFromUnitVectors(localDir, dir.clone().normalize())
  const offset = localPos.clone().applyQuaternion(rotation)
  const extra = (catalog.thickness ?? 0) / 2
  const span = Math.max(0, half - SHAFT_END_INSET - extra)
  const t = THREE.MathUtils.clamp(shaftPoint.clone().sub(origin).dot(dir), -span, span)
  const onShaft = origin.clone().addScaledVector(dir, t)
  const position = onShaft.sub(offset)
  const rot = canonicalRotation(tupleFromQuat(rotation))
  return [
    {
      position: [position.x, position.y, position.z],
      rotation: rot,
      localPortId: axle.id,
      fan: [dir.x, dir.y, dir.z],
      inPlane: true,
    },
  ]
}

/**
 * Seat a gear so its teeth mesh with a placed gear (parallel axes, pitch spacing).
 * Also seats beside a 12 V motor worm (gear-mesh port on the motor).
 * Cursor picks which side of the target the new gear sits on.
 */
export function gearMeshPoseOnGear(
  catalog: CatalogPiece,
  target: PlacedPiece,
  cursor: THREE.Vector3,
): ConnectorAimPose | null {
  if (catalog.category !== 'gears') return null
  const targetCat = getCatalogPiece(target.catalogId)
  if (!targetCat) return null
  if (!catalog.ports.some((p) => p.kind === 'gear-mesh')) return null

  const worm = targetCat.ports.find((p) => p.id === 'worm' && p.kind === 'gear-mesh')
  const isWorm = targetCat.category === 'motors' && Boolean(worm)
  if (targetCat.category !== 'gears' && !isWorm) return null

  const qTarget = quatFromTuple(target.rotation)
  const axis = new THREE.Vector3(0, 0, 1).applyQuaternion(qTarget).normalize()
  const origin = new THREE.Vector3(...target.position)
  if (worm) {
    origin.add(new THREE.Vector3(...worm.position).applyQuaternion(qTarget))
  }

  const wormR = mm(MOTOR_WORM_PITCH_R_MM)
  const dist = isWorm
    ? (catalog.radius ?? 0) + wormR
    : gearMeshCenterDistance(catalog, targetCat)

  const planar = cursor.clone().sub(origin)
  planar.sub(axis.clone().multiplyScalar(planar.dot(axis)))
  if (planar.lengthSq() < 1e-5) {
    const helper =
      Math.abs(axis.dot(new THREE.Vector3(0, 1, 0))) < 0.85
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(1, 0, 0)
    planar.copy(new THREE.Vector3().crossVectors(axis, helper).normalize())
  } else {
    planar.normalize()
  }

  const position = origin.clone().addScaledVector(planar, dist)

  const rotAlign = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), axis)
  const localLine = planar.clone().applyQuaternion(qTarget.clone().invert())
  const centerAngle = Math.atan2(localLine.y, localLine.x)
  const teeth = Math.max(6, catalog.teeth ?? 14)
  const twist = centerAngle + Math.PI + Math.PI / teeth
  const qTwist = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), twist)
  const rotation = canonicalRotation(tupleFromQuat(rotAlign.multiply(qTwist)))

  return {
    position: [position.x, position.y, position.z],
    rotation,
    localPortId: 'mesh',
    fan: [planar.x, planar.y, planar.z],
    inPlane: true,
  }
}

export function nearestGearMesh(
  catalog: CatalogPiece,
  pieces: PlacedPiece[],
  cursor: THREE.Vector3,
  maxDistance = SNAP_DISTANCE + 0.35,
): { piece: PlacedPiece; pose: ConnectorAimPose } | null {
  if (catalog.category !== 'gears') return null
  let best: { piece: PlacedPiece; pose: ConnectorAimPose } | null = null
  let bestDist = maxDistance
  for (const piece of pieces) {
    const other = getCatalogPiece(piece.catalogId)
    if (!other) continue
    const worm = other.ports.find((p) => p.id === 'worm')
    if (other.category !== 'gears' && !(other.category === 'motors' && worm)) continue
    const pose = gearMeshPoseOnGear(catalog, piece, cursor)
    if (!pose) continue
    const q = quatFromTuple(piece.rotation)
    const origin = new THREE.Vector3(...piece.position)
    if (worm) origin.add(new THREE.Vector3(...worm.position).applyQuaternion(q))
    const ideal =
      other.category === 'motors'
        ? (catalog.radius ?? 0) + mm(MOTOR_WORM_PITCH_R_MM)
        : gearMeshCenterDistance(catalog, other)
    const centerDist = cursor.distanceTo(origin)
    const rimDist = Math.abs(centerDist - ideal)
    if (rimDist < bestDist) {
      bestDist = rimDist
      best = { piece, pose }
    }
  }
  return best
}

/**
 * Seat a Classic connector on a motor housing lug (structural mount).
 * Aligns the connector hub axis with the motor drive axis so a rod can
 * pass connector → motor drive → connector.
 */
export function connectorPosesOnMotorLug(
  catalog: CatalogPiece,
  motor: PlacedPiece,
  lug: PortDef,
  workNormal: THREE.Vector3,
): ConnectorAimPose[] {
  if (!isConnectorLike(catalog) || lug.kind !== 'connector-lug') return []
  const center = catalog.ports.find((p) => isCenterSocket(p.id))
  if (!center) return []

  const qMotor = quatFromTuple(motor.rotation)
  const lugWorld = new THREE.Vector3(...motor.position).add(
    new THREE.Vector3(...lug.position).applyQuaternion(qMotor),
  )
  const driveAxis = new THREE.Vector3(...lug.direction).applyQuaternion(qMotor).normalize()

  const poses: ConnectorAimPose[] = []
  for (const hubSign of [1, -1] as const) {
    // Connector local Y (hub) → ± motor drive axis (lug outward).
    const desiredHub = driveAxis.clone().multiplyScalar(hubSign)
    const rotation = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(...center.direction).normalize(),
      desiredHub,
    )
    // Fan clips toward the working plane when possible.
    const localFan = new THREE.Vector3(0, 0, 1).applyQuaternion(rotation)
    const planar = workNormal.clone().addScaledVector(desiredHub, -workNormal.dot(desiredHub))
    if (planar.lengthSq() > 1e-6) {
      planar.normalize()
      const fanPlanar = localFan.clone().addScaledVector(desiredHub, -localFan.dot(desiredHub))
      if (fanPlanar.lengthSq() > 1e-6) {
        fanPlanar.normalize()
        const twist = new THREE.Quaternion().setFromUnitVectors(fanPlanar, planar)
        rotation.premultiply(twist)
      }
    }

    const localCenter = new THREE.Vector3(...center.position).applyQuaternion(rotation)
    // Seat hub just outside the lug face.
    const seat = lugWorld
      .clone()
      .addScaledVector(driveAxis, (HUB_HEIGHT / 2) * (hubSign === 1 ? 1 : -1) * 0.15)
    const position = seat.clone().sub(localCenter)
    const inPlane = Math.abs(desiredHub.dot(workNormal)) < 0.35
    poses.push({
      position: [position.x, position.y, position.z],
      rotation: canonicalRotation(tupleFromQuat(rotation)),
      localPortId: center.id,
      fan: [desiredHub.x, desiredHub.y, desiredHub.z],
      inPlane,
    })
  }
  poses.sort((a, b) => Number(b.inPlane) - Number(a.inPlane))
  return poses
}

export function nearestMotorLug(
  catalog: CatalogPiece,
  pieces: PlacedPiece[],
  cursor: THREE.Vector3,
  workNormal: THREE.Vector3,
  maxDistance = SNAP_DISTANCE + 0.4,
): { piece: PlacedPiece; lug: PortDef; poses: ConnectorAimPose[] } | null {
  if (!isConnectorLike(catalog)) return null
  let best: { piece: PlacedPiece; lug: PortDef; poses: ConnectorAimPose[]; dist: number } | null =
    null
  for (const piece of pieces) {
    const motor = getCatalogPiece(piece.catalogId)
    if (!motor || motor.category !== 'motors') continue
    const q = quatFromTuple(piece.rotation)
    for (const lug of motor.ports) {
      if (lug.kind !== 'connector-lug') continue
      const lugWorld = new THREE.Vector3(...piece.position).add(
        new THREE.Vector3(...lug.position).applyQuaternion(q),
      )
      const dist = cursor.distanceTo(lugWorld)
      if (dist > maxDistance) continue
      if (best && dist >= best.dist) continue
      const poses = connectorPosesOnMotorLug(catalog, piece, lug, workNormal)
      if (!poses.length) continue
      best = { piece, lug, poses, dist }
    }
  }
  if (!best) return null
  return { piece: best.piece, lug: best.lug, poses: best.poses }
}

/** Parallel spur gears with teeth interleaved — a join, not a hit. */
export function gearsMeshing(a: PlacedPiece, b: PlacedPiece): boolean {
  const ca = getCatalogPiece(a.catalogId)
  const cb = getCatalogPiece(b.catalogId)
  if (ca?.category !== 'gears' || cb?.category !== 'gears') return false
  const qa = quatFromTuple(a.rotation)
  const qb = quatFromTuple(b.rotation)
  const axisA = new THREE.Vector3(0, 0, 1).applyQuaternion(qa).normalize()
  const axisB = new THREE.Vector3(0, 0, 1).applyQuaternion(qb).normalize()
  if (Math.abs(axisA.dot(axisB)) < 0.9) return false
  const pa = new THREE.Vector3(...a.position)
  const pb = new THREE.Vector3(...b.position)
  const delta = pb.clone().sub(pa)
  const axial = Math.abs(delta.dot(axisA))
  const halfA = (ca.thickness ?? HUB_HEIGHT) / 2
  const halfB = (cb.thickness ?? HUB_HEIGHT) / 2
  if (axial > halfA + halfB + 0.04) return false
  const radial = delta.clone().addScaledVector(axisA, -delta.dot(axisA)).length()
  const ideal = gearMeshCenterDistance(ca, cb)
  return Math.abs(radial - ideal) <= GEAR_MESH_TOLERANCE
}

export function nearestRodShaft(
  pieces: PlacedPiece[],
  cursor: THREE.Vector3,
  maxDistance = SNAP_DISTANCE,
): { piece: PlacedPiece; point: THREE.Vector3 } | null {
  let best: { piece: PlacedPiece; point: THREE.Vector3 } | null = null
  let bestDist = maxDistance
  for (const piece of pieces) {
    const catalog = getCatalogPiece(piece.catalogId)
    if (!catalog || catalog.category !== 'rods') continue
    const point = pointOnRodShaft(piece, cursor)
    const dist = point.distanceTo(cursor)
    if (dist < bestDist) {
      bestDist = dist
      best = { piece, point }
    }
  }
  return best
}

export function shaftHintPort(piece: PlacedPiece, cursor: THREE.Vector3): WorldPort | null {
  const catalog = getCatalogPiece(piece.catalogId)
  if (!catalog || catalog.category !== 'rods') return null
  const point = pointOnRodShaft(piece, cursor)
  const { dir } = rodAxis(piece)
  return {
    pieceId: piece.id,
    portId: 'shaft',
    kind: 'shaft',
    position: [point.x, point.y, point.z],
    direction: [dir.x, dir.y, dir.z],
    slot: [dir.x, dir.y, dir.z],
    occupied: false,
  }
}

export interface SlideJoint {
  pieceId: string
  rodId: string
  /** Pieces that stay fixed while this slide runs (rail hubs / the rod). */
  anchorIds: string[]
  origin: [number, number, number]
  dir: [number, number, number]
  minDelta: number
  maxDelta: number
}

function isShaftSlideHub(catalog: CatalogPiece): boolean {
  return catalog.category === 'connectors' || isShaftSleeve(catalog)
}

function contactOnRod(
  connector: PlacedPiece,
  connectorCatalog: CatalogPiece,
  portId: string,
): THREE.Vector3 | null {
  const port = connectorCatalog.ports.find((p) => p.id === portId)
  if (!port) return null
  if (isThroughHoleSocket(port.id)) return new THREE.Vector3(...connector.position)
  if (port.kind === 'socket') {
    return new THREE.Vector3(...worldPort(connector, port, true).position)
  }
  return null
}

/**
 * Axis slide for a perp clip on a shaft, a hub with a rod through its center,
 * or a spacer / wheel / gear on that shaft. Rod-end joints to outside pieces
 * still pin; nested combo interlocks ride along together.
 */
function slideJointFromSeated(
  piece: PlacedPiece,
  pieces: PlacedPiece[],
  seated: Connection[],
): SlideJoint | null {
  const catalog = getCatalogPiece(piece.catalogId)
  if (!catalog || (catalog.category !== 'rods' && !isShaftSlideHub(catalog))) return null
  const byId = new Map(pieces.map((p) => [p.id, p]))

  for (const conn of seated) {
    if (conn.aPieceId !== piece.id && conn.bPieceId !== piece.id) continue
    const mineIsA = conn.aPieceId === piece.id
    const myPort = catalog.ports.find((p) => p.id === (mineIsA ? conn.aPortId : conn.bPortId))
    const partner = byId.get(mineIsA ? conn.bPieceId : conn.aPieceId)
    const partnerCatalog = partner ? getCatalogPiece(partner.catalogId) : undefined
    const theirPort = partnerCatalog?.ports.find(
      (p) => p.id === (mineIsA ? conn.bPortId : conn.aPortId),
    )
    // Nested combo plates stay locked to each other but may slide as one unit.
    if (myPort?.kind === 'interlock' || theirPort?.kind === 'interlock') continue
    // Only the grabbed piece’s own rod-end seat pins. Rods clipped into this
    // hub’s sockets ride along as companions instead of blocking the slide.
    if (myPort?.kind === 'rod-end') return null
  }

  const joints: { rod: PlacedPiece; connector: PlacedPiece; contact: THREE.Vector3 }[] = []
  for (const conn of seated) {
    if (conn.aPieceId !== piece.id && conn.bPieceId !== piece.id) continue
    const mineIsA = conn.aPieceId === piece.id
    const myPort = catalog.ports.find((p) => p.id === (mineIsA ? conn.aPortId : conn.bPortId))
    const partner = byId.get(mineIsA ? conn.bPieceId : conn.aPieceId)
    const partnerCatalog = partner ? getCatalogPiece(partner.catalogId) : undefined
    const theirPort = partnerCatalog?.ports.find(
      (p) => p.id === (mineIsA ? conn.bPortId : conn.aPortId),
    )
    if (!myPort || !partner || !partnerCatalog || !theirPort) continue
    const shaftMine = myPort.kind === 'shaft'
    const shaftTheirs = theirPort.kind === 'shaft'
    if (!shaftMine && !shaftTheirs) continue
    const rod = shaftMine ? piece : partner
    const connector = shaftMine ? partner : piece
    const rodCatalog = getCatalogPiece(rod.catalogId)
    const connCatalog = getCatalogPiece(connector.catalogId)
    if (rodCatalog?.category !== 'rods' || !connCatalog || !isShaftSlideHub(connCatalog)) continue
    const clipId = shaftMine ? theirPort.id : myPort.id
    const contact = contactOnRod(connector, connCatalog, clipId)
    if (!contact) continue
    joints.push({ rod, connector, contact })
  }
  if (!joints.length) return null

  const rod = joints[0].rod
  if (joints.some((j) => j.rod.id !== rod.id)) return null
  if (catalog.category === 'rods' && rod.id !== piece.id) return null

  const { origin, dir, half } = rodAxis(rod)
  const face = isShaftSleeve(catalog) ? (catalog.thickness ?? 0) / 2 : 0
  const span = Math.max(0, half - SHAFT_END_INSET - face)
  const slidingRod = catalog.category === 'rods'
  let minDelta = Number.NEGATIVE_INFINITY
  let maxDelta = Number.POSITIVE_INFINITY
  for (const joint of joints) {
    const t = joint.contact.clone().sub(origin).dot(dir)
    if (slidingRod) {
      minDelta = Math.max(minDelta, t - span)
      maxDelta = Math.min(maxDelta, t + span)
    } else {
      minDelta = Math.max(minDelta, -span - t)
      maxDelta = Math.min(maxDelta, span - t)
    }
  }
  if (minDelta > maxDelta) return null
  const anchorIds = slidingRod
    ? [...new Set(joints.map((j) => j.connector.id))]
    : [rod.id]
  return {
    pieceId: piece.id,
    rodId: rod.id,
    anchorIds,
    origin: [origin.x, origin.y, origin.z],
    dir: [dir.x, dir.y, dir.z],
    minDelta,
    maxDelta,
  }
}

export function slideJointForPiece(
  piece: PlacedPiece,
  pieces: PlacedPiece[],
  connections: Connection[],
): SlideJoint | null {
  const seated = mergeGeometricConnections(pieces, connections)
  const joint = slideJointFromSeated(piece, pieces, seated)
  if (!joint) return null
  const moving = slideMovingIds(piece.id, joint.anchorIds, pieces, connections)
  if (slideClusterTears(moving, joint.anchorIds, pieces, connections)) return null
  return joint
}

/**
 * Pieces that should translate with a slide: the grabbed piece plus dangling
 * attachments / nested combo partners that are not rail anchors and are not
 * tied into the rest of the build.
 */
export function slideMovingIds(
  rootId: string,
  anchorIds: string[],
  pieces: PlacedPiece[],
  connections: Connection[],
): string[] {
  const seated = mergeGeometricConnections(pieces, connections)
  const anchors = new Set(anchorIds)
  const neighbors = new Map<string, Set<string>>()
  const interlockNeighbors = new Map<string, Set<string>>()
  for (const p of pieces) {
    neighbors.set(p.id, new Set())
    interlockNeighbors.set(p.id, new Set())
  }
  for (const c of seated) {
    neighbors.get(c.aPieceId)?.add(c.bPieceId)
    neighbors.get(c.bPieceId)?.add(c.aPieceId)
    if (c.aPortId === 'interlock' || c.bPortId === 'interlock') {
      interlockNeighbors.get(c.aPieceId)?.add(c.bPieceId)
      interlockNeighbors.get(c.bPieceId)?.add(c.aPieceId)
    }
  }

  const moving = new Set<string>([rootId])
  // Always pull nested combo plates along — they share the hub.
  let grew = true
  while (grew) {
    grew = false
    for (const id of [...moving]) {
      for (const n of interlockNeighbors.get(id) ?? []) {
        if (anchors.has(n) || moving.has(n)) continue
        moving.add(n)
        grew = true
      }
    }
  }

  grew = true
  while (grew) {
    grew = false
    for (const id of [...moving]) {
      for (const n of neighbors.get(id) ?? []) {
        if (anchors.has(n) || moving.has(n)) continue
        const outs = [...(neighbors.get(n) ?? [])]
        // Only ride along when every bond is already in the moving cluster
        // (or the edge we just walked). Anything else anchors it in place.
        if (outs.every((o) => o === id || moving.has(o))) {
          moving.add(n)
          grew = true
        }
      }
    }
  }

  return [...moving]
}

/** True when a slide would leave a seated joint with one side moving and one fixed. */
export function slideClusterTears(
  movingIds: string[],
  anchorIds: string[],
  pieces: PlacedPiece[],
  connections: Connection[],
): boolean {
  const seated = mergeGeometricConnections(pieces, connections)
  const moving = new Set(movingIds)
  const anchors = new Set(anchorIds)
  for (const c of seated) {
    const aMove = moving.has(c.aPieceId)
    const bMove = moving.has(c.bPieceId)
    if (aMove === bMove) continue
    if (anchors.has(c.aPieceId) || anchors.has(c.bPieceId)) continue
    return true
  }
  return false
}

const SLIDE_SNAP_LATERAL = 0.14
/** How far along the rail we’ll pull to seat a nearby mate. */
const SLIDE_SNAP_PULL = 0.85

/**
 * Nudge a slide delta so free ports on the moving cluster seat on nearby
 * fixed ports (and coplanar gear meshes), when the fit is along the rail.
 */
export function slideSnapDelta(
  movingIds: string[],
  pieces: PlacedPiece[],
  connections: Connection[],
  dir: THREE.Vector3,
  proposedDelta: number,
  minDelta: number,
  maxDelta: number,
  startPositions: Map<string, [number, number, number]>,
): number {
  const axis = dir.clone().normalize()
  const moving = new Set(movingIds)
  const seated = mergeGeometricConnections(pieces, connections)
  const occupied = occupiedPortKeys(seated)

  const proposedPieces = pieces.map((p) => {
    if (!moving.has(p.id)) return p
    const start = startPositions.get(p.id) ?? p.position
    return {
      ...p,
      position: [
        start[0] + axis.x * proposedDelta,
        start[1] + axis.y * proposedDelta,
        start[2] + axis.z * proposedDelta,
      ] as [number, number, number],
    }
  })

  const movingPorts = allWorldPorts(proposedPieces, occupied).filter(
    (p) => moving.has(p.pieceId) && !p.occupied,
  )
  const fixedPorts = allWorldPorts(proposedPieces, occupied).filter(
    (p) => !moving.has(p.pieceId) && !p.occupied,
  )

  let bestDelta = proposedDelta
  let bestScore = SLIDE_SNAP_PULL

  for (const a of movingPorts) {
    for (const b of fixedPorts) {
      if (!worldPortsCompatible(a, b)) continue
      if (!worldDirectionsMatch(a, b)) continue

      if (a.kind === 'gear-mesh' && b.kind === 'gear-mesh') {
        const pa = proposedPieces.find((p) => p.id === a.pieceId)
        const pb = proposedPieces.find((p) => p.id === b.pieceId)
        if (!pa || !pb) continue
        // Slide until gear planes coincide (radial pitch already set by rods).
        const qa = quatFromTuple(pa.rotation)
        const axisA = new THREE.Vector3(0, 0, 1).applyQuaternion(qa).normalize()
        if (Math.abs(axisA.dot(axis)) < 0.85) continue
        const start = startPositions.get(a.pieceId)
        if (!start) continue
        const startPos = new THREE.Vector3(...start)
        const other = new THREE.Vector3(...pb.position)
        const needed = other.clone().sub(startPos).dot(axis)
        if (needed < minDelta - 1e-6 || needed > maxDelta + 1e-6) continue
        const radial = other
          .clone()
          .sub(startPos.clone().addScaledVector(axis, needed))
          .length()
        const ca = getCatalogPiece(pa.catalogId)
        const cb = getCatalogPiece(pb.catalogId)
        if (!ca || !cb) continue
        const ideal = gearMeshCenterDistance(ca, cb)
        if (Math.abs(radial - ideal) > GEAR_MESH_TOLERANCE + 0.05) continue
        const score = Math.abs(needed - proposedDelta)
        if (score < bestScore) {
          bestScore = score
          bestDelta = THREE.MathUtils.clamp(needed, minDelta, maxDelta)
        }
        continue
      }

      const pa = new THREE.Vector3(...a.position)
      const pb = new THREE.Vector3(...b.position)
      const delta = pb.clone().sub(pa)
      const along = delta.dot(axis)
      const lateral = delta.clone().addScaledVector(axis, -along).length()
      if (lateral > SLIDE_SNAP_LATERAL) continue
      const needed = proposedDelta + along
      if (needed < minDelta - 1e-6 || needed > maxDelta + 1e-6) continue
      const score = Math.abs(along)
      if (score < bestScore) {
        bestScore = score
        bestDelta = THREE.MathUtils.clamp(needed, minDelta, maxDelta)
      }
    }
  }

  return bestDelta
}

export function canSlidePiece(
  piece: PlacedPiece,
  pieces: PlacedPiece[],
  connections: Connection[],
): boolean {
  return slideJointForPiece(piece, pieces, connections) !== null
}

export function slidablePieceIds(pieces: PlacedPiece[], connections: Connection[]): Set<string> {
  const ids = new Set<string>()
  for (const piece of pieces) {
    if (slideJointForPiece(piece, pieces, connections)) ids.add(piece.id)
  }
  return ids
}

/**
 * Distance from a pointer ray to a slidable piece, or null if it is not a hit.
 * Spacers / wheels / gears are picked as short cylinders so a click on the
 * sleeve wins over the coaxial rod axis (which would otherwise always be closer).
 */
function slidableHitDistance(
  piece: PlacedPiece,
  catalog: CatalogPiece,
  ray: THREE.Ray,
): number | null {
  const pos = new THREE.Vector3(...piece.position)
  const closest = new THREE.Vector3()
  ray.closestPointToPoint(pos, closest)
  const along = closest.clone().sub(ray.origin).dot(ray.direction)
  if (along < 0.05) return null

  if (catalog.category === 'rods') {
    const { origin, dir, half } = rodAxis(piece)
    const t = rayAxisT(ray, origin, dir)
    if (t == null) return null
    const clamped = THREE.MathUtils.clamp(t, -half, half)
    const onRod = origin.clone().addScaledVector(dir, clamped)
    const radial = ray.distanceToPoint(onRod)
    // Bare shaft only — do not claim the whole spacer/wheel radius.
    if (radial > ROD_RADIUS_SCENE * 1.65) return null
    return radial
  }

  if (isShaftSleeve(catalog)) {
    const axis = new THREE.Vector3(0, 0, 1)
      .applyQuaternion(quatFromTuple(piece.rotation))
      .normalize()
    const t = rayAxisT(ray, pos, axis)
    if (t == null) return null
    const half = (catalog.thickness ?? 0) / 2 + 0.05
    if (Math.abs(t) > half) return null
    const onAxis = pos.clone().addScaledVector(axis, THREE.MathUtils.clamp(t, -half, half))
    const radial = ray.distanceToPoint(onAxis)
    const outer = (catalog.radius ?? HUB_RADIUS) * 1.2
    if (radial > outer) return null
    return radial
  }

  return closest.distanceTo(pos)
}

export function nearestSlidablePiece(
  pieces: PlacedPiece[],
  connections: Connection[],
  ray: THREE.Ray,
  maxDist = 0.9,
): PlacedPiece | null {
  // Prefer sleeves / hubs / clips over rods so dragging a spacer moves the
  // spacer along the shaft instead of pulling the rod through it.
  let bestSleeve: PlacedPiece | null = null
  let bestSleeveDist = maxDist
  let bestRod: PlacedPiece | null = null
  let bestRodDist = maxDist

  for (const piece of pieces) {
    if (!slideJointForPiece(piece, pieces, connections)) continue
    const catalog = getCatalogPiece(piece.catalogId)
    if (!catalog) continue
    const dist = slidableHitDistance(piece, catalog, ray)
    if (dist == null || dist >= maxDist) continue
    if (catalog.category === 'rods') {
      if (dist < bestRodDist) {
        bestRodDist = dist
        bestRod = piece
      }
    } else if (dist < bestSleeveDist) {
      bestSleeveDist = dist
      bestSleeve = piece
    }
  }
  return bestSleeve ?? bestRod
}

/** Parameter along an infinite axis for the closest point to a ray. */
export function rayAxisT(ray: THREE.Ray, origin: THREE.Vector3, dir: THREE.Vector3): number | null {
  const d1 = dir.clone().normalize()
  const d2 = ray.direction.clone().normalize()
  const w = new THREE.Vector3().subVectors(origin, ray.origin)
  const a = d1.dot(d1)
  const b = d1.dot(d2)
  const c = d2.dot(d2)
  const d = d1.dot(w)
  const e = d2.dot(w)
  const denom = a * c - b * b
  if (Math.abs(denom) < 1e-8) return d1.dot(new THREE.Vector3().subVectors(ray.origin, origin))
  return (b * e - c * d) / denom
}

export function pickConnectorAimPose(
  poses: ConnectorAimPose[],
  tip: THREE.Vector3,
  camera: THREE.Camera,
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
): number {
  if (poses.length === 0) return 0
  const rect = canvas.getBoundingClientRect()
  const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1
  const ndcY = -(((clientY - rect.top) / rect.height) * 2 - 1)
  const tipNdc = tip.clone().project(camera)
  const pointer = new THREE.Vector2(ndcX - tipNdc.x, ndcY - tipNdc.y)
  if (pointer.lengthSq() < 1e-5) {
    const inPlane = poses.findIndex((p) => p.inPlane)
    return inPlane >= 0 ? inPlane : 0
  }

  let best = 0
  let bestScore = Number.POSITIVE_INFINITY
  for (let i = 0; i < poses.length; i++) {
    const point = tip.clone().add(new THREE.Vector3(...poses[i].fan).multiplyScalar(0.45))
    const ndc = point.project(camera)
    const delta = new THREE.Vector2(ndc.x - tipNdc.x, ndc.y - tipNdc.y)
    if (delta.lengthSq() < 1e-6) continue
    const angle = Math.abs(Math.atan2(pointer.y, pointer.x) - Math.atan2(delta.y, delta.x))
    const wrapped = Math.min(angle, Math.PI * 2 - angle)
    const score = wrapped
    if (score < bestScore) {
      bestScore = score
      best = i
    }
  }
  return best
}

export function nearestRodEnd(
  ports: WorldPort[],
  cursor: THREE.Vector3,
  maxDistance = SNAP_DISTANCE,
): WorldPort | null {
  let best: WorldPort | null = null
  let bestDist = maxDistance
  for (const port of ports) {
    if (port.kind !== 'rod-end' || port.occupied) continue
    const dist = new THREE.Vector3(...port.position).distanceTo(cursor)
    if (dist < bestDist) {
      bestDist = dist
      best = port
    }
  }
  return best
}

export function occupiedPortKeys(
  connections: { aPieceId: string; aPortId: string; bPieceId: string; bPortId: string }[],
): Set<string> {
  const keys = new Set<string>()
  for (const c of connections) {
    // A rod shaft can hold several perp clips (and a through-hub); do not fill the whole shaft.
    if (c.aPortId !== 'shaft') keys.add(`${c.aPieceId}:${c.aPortId}`)
    if (c.bPortId !== 'shaft') keys.add(`${c.bPieceId}:${c.bPortId}`)
  }
  return keys
}

function portKey(pieceId: string, portId: string): string {
  return `${pieceId}:${portId}`
}

/**
 * Adjacent 45° clips are ~0.21 apart; a seated rod-end coincides with its
 * socket. Stay below the adjacent spacing so we only occupy the real clip.
 */
const COUPLE_DIST = 0.11

function isClipSocketPort(port: WorldPort): boolean {
  return port.kind === 'socket' && !isThroughHoleSocket(port.portId)
}

function isThroughHoleWorldPort(port: WorldPort): boolean {
  return port.kind === 'socket' && isThroughHoleSocket(port.portId)
}

function distPointToAxis(
  point: [number, number, number],
  origin: [number, number, number],
  direction: [number, number, number],
): number {
  const p = new THREE.Vector3(...point)
  const o = new THREE.Vector3(...origin)
  const d = new THREE.Vector3(...direction).normalize()
  const t = p.clone().sub(o).dot(d)
  return o.addScaledVector(d, t).distanceTo(p)
}

/** C-clip mouth around a rod — tighter than the 0.21 gap between adjacent 45° clips. */
const CLIP_JAW_RADIAL = SOCKET_RADIUS * 0.52
/** Allow a spanning rod to be slightly long/short and still seat in the far clip. */
const ROD_END_SEAT_ALONG = 0.2

function clipHoldsRodEnd(clip: WorldPort, rodEnd: WorldPort): boolean {
  if (!isClipSocketPort(clip) || rodEnd.kind !== 'rod-end') return false
  const endDir = new THREE.Vector3(...rodEnd.direction).normalize()
  const clipDir = new THREE.Vector3(...clip.direction).normalize()
  if (endDir.dot(clipDir) > -0.72) return false
  const end = new THREE.Vector3(...rodEnd.position)
  const socket = new THREE.Vector3(...clip.position)
  const delta = socket.clone().sub(end)
  const along = delta.dot(endDir)
  const radial = delta.clone().addScaledVector(endDir, -along).length()
  return radial < CLIP_JAW_RADIAL && Math.abs(along) < ROD_END_SEAT_ALONG
}

function clipHoldsRodShaft(clip: WorldPort, rod: PlacedPiece): boolean {
  if (!isClipSocketPort(clip)) return false
  const { origin, dir, half } = rodAxis(rod)
  const clipDir = new THREE.Vector3(...clip.direction).normalize()
  if (Math.abs(clipDir.dot(dir)) > 0.5) return false
  const socket = new THREE.Vector3(...clip.position)
  const t = socket.clone().sub(origin).dot(dir)
  const radial = distPointToAxis(clip.position, [origin.x, origin.y, origin.z], [dir.x, dir.y, dir.z])
  return radial < CLIP_JAW_RADIAL && Math.abs(t) <= half - SHAFT_END_INSET + 0.04
}

/** Connectors (and clips) that actually hold this rod — both ends, not only the hovered snap. */
export function piecesSeatedOnRod(rod: PlacedPiece, others: PlacedPiece[]): Set<string> {
  const ids = new Set<string>()
  const rodCat = getCatalogPiece(rod.catalogId)
  if (!rodCat || rodCat.category !== 'rods') return ids
  const ends = rodCat.ports
    .filter((p) => p.kind === 'rod-end')
    .map((p) => worldPort(rod, p, false))
  for (const other of others) {
    if (other.id === rod.id) continue
    const cat = getCatalogPiece(other.catalogId)
    if (!cat || !isConnectorLike(cat)) continue
    for (const port of cat.ports) {
      if (port.kind !== 'socket' || isThroughHoleSocket(port.id) || port.id === 'hole') continue
      const clip = worldPort(other, port, false)
      if (ends.some((end) => clipHoldsRodEnd(clip, end)) || clipHoldsRodShaft(clip, rod)) {
        ids.add(other.id)
        break
      }
    }
  }
  return ids
}

function worldPortsCompatible(a: WorldPort, b: WorldPort): boolean {
  if (a.kind === 'interlock' && b.kind === 'interlock') return true
  if (a.kind === 'gear-mesh' && b.kind === 'gear-mesh') return true
  if (a.kind === 'connector-lug' && b.kind === 'socket' && isCenterSocket(b.portId)) return true
  if (b.kind === 'connector-lug' && a.kind === 'socket' && isCenterSocket(a.portId)) return true
  if (a.kind === 'rod-end' && b.kind === 'socket') return !isThroughHoleSocket(b.portId)
  if (a.kind === 'socket' && b.kind === 'rod-end') return !isThroughHoleSocket(a.portId)
  if (a.kind === 'shaft' && b.kind === 'socket') return true
  if (a.kind === 'socket' && b.kind === 'shaft') return true
  return false
}

function worldDirectionsMatch(a: WorldPort, b: WorldPort): boolean {
  const dot = new THREE.Vector3(...a.direction).dot(new THREE.Vector3(...b.direction))
  if (a.kind === 'interlock' || b.kind === 'interlock') return Math.abs(dot) < POSE_DIR_PERP
  // Gear mesh ports are radial placeholders; axis alignment is checked via piece poses.
  if (a.kind === 'gear-mesh' && b.kind === 'gear-mesh') return true
  // Connector hub seats on motor lug coaxially (hub axis // lug / drive axis).
  if (a.kind === 'connector-lug' || b.kind === 'connector-lug') return Math.abs(dot) > 0.9
  const shaftClip =
    (a.kind === 'shaft' && isClipSocketPort(b)) || (b.kind === 'shaft' && isClipSocketPort(a))
  if (shaftClip) return Math.abs(dot) < POSE_DIR_PERP
  if (
    a.kind === 'shaft' ||
    b.kind === 'shaft' ||
    isThroughHoleSocket(a.portId) ||
    isThroughHoleSocket(b.portId)
  ) {
    return Math.abs(dot) > 0.9
  }
  return dot < POSE_DIR_OPPOSITE
}

function pairDistance(a: WorldPort, b: WorldPort): number {
  const shaftMate =
    (a.kind === 'shaft' && (isClipSocketPort(b) || isThroughHoleWorldPort(b))) ||
    (b.kind === 'shaft' && (isClipSocketPort(a) || isThroughHoleWorldPort(a)))
  if (shaftMate) {
    const shaft = a.kind === 'shaft' ? a : b
    const mate = a.kind === 'shaft' ? b : a
    return distPointToAxis(mate.position, shaft.position, shaft.direction)
  }
  return new THREE.Vector3(...a.position).distanceTo(new THREE.Vector3(...b.position))
}

/**
 * Record every seated pair (rod in a clip, shaft through a hub, nested slots),
 * not only the single snap used at placement. Two rods on one connector both
 * occupy their clips.
 */
export function mergeGeometricConnections(
  pieces: PlacedPiece[],
  connections: Connection[],
): Connection[] {
  const occupied = occupiedPortKeys(connections)
  const free = allWorldPorts(pieces, occupied).filter((p) => !p.occupied)
  const byId = new Map(pieces.map((p) => [p.id, p]))
  const pairs: { a: WorldPort; b: WorldPort; dist: number }[] = []
  for (let i = 0; i < free.length; i++) {
    for (let j = i + 1; j < free.length; j++) {
      const a = free[i]
      const b = free[j]
      if (a.pieceId === b.pieceId) continue
      if (!worldPortsCompatible(a, b)) continue
      if (a.kind === 'gear-mesh' && b.kind === 'gear-mesh') {
        const pa = byId.get(a.pieceId)
        const pb = byId.get(b.pieceId)
        if (!pa || !pb || !gearsMeshing(pa, pb)) continue
        pairs.push({ a, b, dist: 0 })
        continue
      }
      const dist = pairDistance(a, b)
      const rodClip =
        (a.kind === 'rod-end' && isClipSocketPort(b)) || (b.kind === 'rod-end' && isClipSocketPort(a))
      const seated = rodClip
        ? a.kind === 'rod-end'
          ? clipHoldsRodEnd(b, a)
          : clipHoldsRodEnd(a, b)
        : false
      if (seated) {
        pairs.push({ a, b, dist })
        continue
      }
      if (dist > COUPLE_DIST) continue
      if (!worldDirectionsMatch(a, b)) continue
      pairs.push({ a, b, dist })
    }
  }
  pairs.sort((x, y) => x.dist - y.dist)
  const used = new Set(occupied)
  const existing = new Set(
    connections.map(
      (c) => `${c.aPieceId}:${c.aPortId}|${c.bPieceId}:${c.bPortId}`,
    ),
  )
  const extra: Connection[] = []
  for (const { a, b } of pairs) {
    const ka = portKey(a.pieceId, a.portId)
    const kb = portKey(b.pieceId, b.portId)
    const multiA = a.portId === 'shaft' || a.portId === 'mesh'
    const multiB = b.portId === 'shaft' || b.portId === 'mesh'
    if ((!multiA && used.has(ka)) || (!multiB && used.has(kb))) continue
    const keyAb = `${a.pieceId}:${a.portId}|${b.pieceId}:${b.portId}`
    const keyBa = `${b.pieceId}:${b.portId}|${a.pieceId}:${a.portId}`
    if (existing.has(keyAb) || existing.has(keyBa)) continue
    if (!multiA) used.add(ka)
    if (!multiB) used.add(kb)
    const conn = {
      aPieceId: a.pieceId,
      aPortId: a.portId,
      bPieceId: b.pieceId,
      bPortId: b.portId,
    }
    extra.push(conn)
    existing.add(keyAb)
  }
  return extra.length ? [...connections, ...extra] : connections
}

/** Occupied ports from stored connections plus any geometrically seated mates. */
export function occupancyKeys(pieces: PlacedPiece[], connections: Connection[]): Set<string> {
  return occupiedPortKeys(mergeGeometricConnections(pieces, connections))
}

function portsCompatible(local: PortDef, target: WorldPort): boolean {
  if (local.kind === 'interlock' && target.kind === 'interlock') return true
  if (local.kind === 'gear-mesh' && target.kind === 'gear-mesh') return true
  if (local.kind === 'connector-lug' && target.kind === 'socket' && isCenterSocket(target.portId))
    return true
  if (local.kind === 'socket' && isCenterSocket(local.id) && target.kind === 'connector-lug')
    return true
  if (local.kind === 'rod-end' && target.kind === 'socket') return !isThroughHoleSocket(target.portId)
  if (local.kind === 'socket' && target.kind === 'rod-end') return !isThroughHoleSocket(local.id)
  if (local.kind === 'shaft' && target.kind === 'socket') return isThroughHoleSocket(target.portId)
  if (local.kind === 'socket' && target.kind === 'shaft') return true
  return false
}

function directionsMatch(local: PortDef, a: THREE.Vector3, b: THREE.Vector3): boolean {
  const dot = a.dot(b)
  if (local.kind === 'interlock') return Math.abs(dot) < POSE_DIR_PERP
  if (local.kind === 'shaft' || (local.kind === 'socket' && isThroughHoleSocket(local.id))) {
    return Math.abs(dot) > 0.9
  }
  if (local.kind === 'socket') {
    if (Math.abs(dot) < POSE_DIR_PERP) return true
    return dot < POSE_DIR_OPPOSITE
  }
  return dot < POSE_DIR_OPPOSITE
}

function slotDirection(piece: PlacedPiece): THREE.Vector3 {
  return new THREE.Vector3(0, 0, 1).applyQuaternion(quatFromTuple(piece.rotation)).normalize()
}

function canonicalRotation(
  rotation: [number, number, number, number],
): [number, number, number, number] {
  const q = quatFromTuple(rotation).normalize()
  if (q.w < 0) q.set(-q.x, -q.y, -q.z, -q.w)
  return tupleFromQuat(q)
}

function poseDistance(
  a: { position: [number, number, number]; rotation: [number, number, number, number] },
  b: { position: [number, number, number]; rotation: [number, number, number, number] },
): number {
  const pos = new THREE.Vector3(...a.position).distanceTo(new THREE.Vector3(...b.position))
  const qa = quatFromTuple(a.rotation)
  const qb = quatFromTuple(b.rotation)
  const ang = 2 * Math.acos(Math.min(1, Math.abs(qa.dot(qb))))
  return pos + ang
}

export function rotatePoseAroundAxis(
  piece: PlacedPiece,
  axis: THREE.Vector3,
  pivot: THREE.Vector3,
  angle: number,
): { position: [number, number, number]; rotation: [number, number, number, number] } {
  const delta = new THREE.Quaternion().setFromAxisAngle(axis.clone().normalize(), angle)
  const rotation = delta.clone().multiply(quatFromTuple(piece.rotation))
  const position = new THREE.Vector3(...piece.position)
  position.sub(pivot).applyQuaternion(delta).add(pivot)
  return {
    position: [position.x, position.y, position.z],
    rotation: tupleFromQuat(rotation),
  }
}

/**
 * Rebind this piece's connections after a pose change.
 * Each partner keeps a unique port — two rods cannot claim the same clip.
 */
export function retargetConnectorConnections(
  piece: PlacedPiece,
  catalog: CatalogPiece,
  pieces: PlacedPiece[],
  connections: Connection[],
): Connection[] | null {
  const next = connections.map((c) => ({ ...c }))
  const jobs: {
    index: number
    mineIsA: boolean
    partner: PlacedPiece
    target: WorldPort
  }[] = []

  for (let index = 0; index < next.length; index++) {
    const conn = next[index]
    if (conn.aPieceId !== piece.id && conn.bPieceId !== piece.id) continue
    const mineIsA = conn.aPieceId === piece.id
    const partner = pieces.find((p) => p.id === (mineIsA ? conn.bPieceId : conn.aPieceId))
    if (!partner) return null
    const partnerCatalog = getCatalogPiece(partner.catalogId)
    const partnerPort = partnerCatalog?.ports.find(
      (p) => p.id === (mineIsA ? conn.bPortId : conn.aPortId),
    )
    if (!partnerCatalog || !partnerPort) return null
    jobs.push({
      index,
      mineIsA,
      partner,
      target: worldPort(partner, partnerPort, true),
    })
  }

  const candidatesFor = (job: (typeof jobs)[number], used: Set<string>) => {
    const targetDir = new THREE.Vector3(...job.target.direction)
    const options: { id: string; dist: number }[] = []
    for (const local of catalog.ports) {
      if (used.has(local.id)) continue
      if (!portsCompatible(local, job.target)) continue
      const wp = worldPort(piece, local, true)
      const dist =
        job.target.kind === 'shaft'
          ? distPointToAxis(wp.position, job.target.position, job.target.direction)
          : new THREE.Vector3(...wp.position).distanceTo(new THREE.Vector3(...job.target.position))
      if (dist > POSE_POS_TOL) continue
      if (!directionsMatch(local, new THREE.Vector3(...wp.direction), targetDir)) continue
      if (local.kind === 'interlock') {
        const aligned = Math.abs(slotDirection(piece).dot(slotDirection(job.partner)))
        if (aligned < SLOT_ALIGN) continue
      }
      options.push({ id: local.id, dist })
    }
    options.sort((a, b) => a.dist - b.dist)
    return options
  }

  const assignment: string[] = new Array(jobs.length)
  const search = (i: number, used: Set<string>): boolean => {
    if (i === jobs.length) return true
    for (const option of candidatesFor(jobs[i], used)) {
      used.add(option.id)
      assignment[i] = option.id
      if (search(i + 1, used)) return true
      used.delete(option.id)
    }
    return false
  }

  if (!search(0, new Set())) return null

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i]
    if (job.mineIsA) next[job.index].aPortId = assignment[i]
    else next[job.index].bPortId = assignment[i]
  }
  return next
}

export interface NextConnectorPose {
  position: [number, number, number]
  rotation: [number, number, number, number]
  connections: Connection[]
}

const HUB_ALIGN = 0.92

/**
 * Working-plane normal for a connector: the plate that currently holds more
 * rods, otherwise the primary hub (local Y).
 */
export function connectorWorkNormal(
  piece: PlacedPiece,
  catalog: CatalogPiece,
  connections: Connection[],
): THREE.Vector3 {
  const q = quatFromTuple(piece.rotation)
  let yPlane = 0
  let zPlane = 0
  for (const conn of connections) {
    if (conn.aPieceId !== piece.id && conn.bPieceId !== piece.id) continue
    const portId = conn.aPieceId === piece.id ? conn.aPortId : conn.bPortId
    const port = catalog.ports.find((p) => p.id === portId)
    if (!port || port.kind !== 'socket' || isCenterSocket(port.id)) continue
    if (Math.abs(port.direction[1]) < 0.35) yPlane += 1
    else zPlane += 1
  }
  const local = zPlane > yPlane ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0)
  return local.applyQuaternion(q).normalize()
}

function connectedRodDirections(
  piece: PlacedPiece,
  catalog: CatalogPiece,
  pieces: PlacedPiece[],
  connections: Connection[],
): THREE.Vector3[] {
  const dirs: THREE.Vector3[] = []
  const byId = new Map(pieces.map((p) => [p.id, p]))
  for (const conn of connections) {
    if (conn.aPieceId !== piece.id && conn.bPieceId !== piece.id) continue
    const mineIsA = conn.aPieceId === piece.id
    const myPort = catalog.ports.find((p) => p.id === (mineIsA ? conn.aPortId : conn.bPortId))
    const partner = byId.get(mineIsA ? conn.bPieceId : conn.aPieceId)
    const partnerCatalog = partner ? getCatalogPiece(partner.catalogId) : undefined
    const partnerPort = partnerCatalog?.ports.find(
      (p) => p.id === (mineIsA ? conn.bPortId : conn.aPortId),
    )
    if (!myPort || !partner || !partnerPort) continue
    if (myPort.kind !== 'socket' || partnerPort.kind !== 'rod-end') continue
    dirs.push(new THREE.Vector3(...worldPort(partner, partnerPort, true).direction).normalize())
  }
  return dirs
}

function projectOnPlane(axis: THREE.Vector3, normal: THREE.Vector3): THREE.Vector3 | null {
  const projected = axis.clone().sub(normal.clone().multiplyScalar(axis.dot(normal)))
  if (projected.lengthSq() < 1e-6) return null
  return projected.normalize()
}

function oppositeAxis(
  piece: PlacedPiece,
  workNormal: THREE.Vector3,
  rodDirs: THREE.Vector3[],
): THREE.Vector3 {
  if (rodDirs.length === 1) {
    const alongRod = projectOnPlane(rodDirs[0], workNormal)
    if (alongRod) return alongRod
  }
  const localZ = new THREE.Vector3(0, 0, 1)
    .applyQuaternion(quatFromTuple(piece.rotation))
  const fromClip = projectOnPlane(localZ, workNormal)
  if (fromClip) return fromClip
  const worldUp = new THREE.Vector3(0, 1, 0)
  const fromUp = projectOnPlane(worldUp, workNormal)
  if (fromUp) return fromUp
  return projectOnPlane(new THREE.Vector3(1, 0, 0), workNormal) ?? new THREE.Vector3(1, 0, 0)
}

function isCurrentPose(
  piece: PlacedPiece,
  pose: { position: [number, number, number]; rotation: [number, number, number, number] },
): boolean {
  return poseDistance(piece, pose) < 0.12
}

function shaftMateOf(piece: PlacedPiece, connections: Connection[]): Connection | null {
  for (const conn of connections) {
    if (conn.aPieceId !== piece.id && conn.bPieceId !== piece.id) continue
    const partnerPort = conn.aPieceId === piece.id ? conn.bPortId : conn.aPortId
    if (partnerPort === 'shaft') return conn
  }
  return null
}

/**
 * Next discrete K'NEX orientation for a connector.
 * `in-plane` spins around the current working-plate normal and only keeps
 * poses where every attached rod still has a clip. `opposite` tilts around
 * an axis in that plate (typically a single rod) to change working plane.
 */
export function nextUsableConnectorPose(
  piece: PlacedPiece,
  pieces: PlacedPiece[],
  connections: Connection[],
  mode: ConnectorRotateMode = 'in-plane',
): NextConnectorPose | null {
  const catalog = getCatalogPiece(piece.catalogId)
  if (!catalog || !isConnectorLike(catalog)) return null

  const workNormal = connectorWorkNormal(piece, catalog, connections)
  const origin = new THREE.Vector3(...piece.position)
  const rodDirs = connectedRodDirections(piece, catalog, pieces, connections)

  const shaftMate = shaftMateOf(piece, connections)
  if (shaftMate) {
    const clipId =
      shaftMate.aPieceId === piece.id ? shaftMate.aPortId : shaftMate.bPortId
    const clip = catalog.ports.find((p) => p.id === clipId)
    const rod = pieces.find(
      (p) => p.id === (shaftMate.aPieceId === piece.id ? shaftMate.bPieceId : shaftMate.aPieceId),
    )
    if (clip && rod) {
      const pivot = new THREE.Vector3(...worldPort(piece, clip, true).position)
      const { dir } = rodAxis(rod)
      const hub = new THREE.Vector3(...piece.position)
      const radial = hub.clone().sub(pivot)
      const axis = mode === 'in-plane' ? dir : perpendicularTo(dir, radial)
      for (let i = 1; i <= 8; i++) {
        const pose = rotatePoseAroundAxis(piece, axis, pivot, -i * KNEX_DETENT)
        if (isCurrentPose(piece, pose)) continue
        const nextPiece: PlacedPiece = { ...piece, ...pose }
        const nextConnections = retargetConnectorConnections(
          nextPiece,
          catalog,
          pieces.map((p) => (p.id === piece.id ? nextPiece : p)),
          connections,
        )
        if (!nextConnections) continue
        return {
          position: pose.position,
          rotation: canonicalRotation(pose.rotation),
          connections: nextConnections,
        }
      }
      return null
    }
  }

  const axis =
    mode === 'in-plane' ? workNormal : oppositeAxis(piece, workNormal, rodDirs)

  for (let i = 1; i <= 8; i++) {
    const pose = rotatePoseAroundAxis(piece, axis, origin, -i * KNEX_DETENT)
    if (isCurrentPose(piece, pose)) continue
    const nextPiece: PlacedPiece = { ...piece, ...pose }
    const nextHub = connectorWorkNormal(nextPiece, catalog, connections)
    const hubDot = Math.abs(workNormal.dot(nextHub))
    if (mode === 'in-plane' && hubDot < HUB_ALIGN) continue
    if (mode === 'opposite' && hubDot > HUB_ALIGN) continue
    const nextConnections = retargetConnectorConnections(
      nextPiece,
      catalog,
      pieces.map((p) => (p.id === piece.id ? nextPiece : p)),
      connections,
    )
    if (!nextConnections) continue
    return {
      position: pose.position,
      rotation: canonicalRotation(pose.rotation),
      connections: nextConnections,
    }
  }

  return null
}
