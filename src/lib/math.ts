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
 * for grey/grey, grey/blue, blue/blue, and the 2-clip bar.
 */
export function alignPieceToPort(
  localPort: PortDef,
  target: WorldPort,
): { position: [number, number, number]; rotation: [number, number, number, number] } {
  if (localPort.kind === 'shaft' && isCenterSocket(target.portId)) {
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
        (localPort.kind === 'rod-end' && target.kind === 'socket' && !isCenterSocket(target.portId)) ||
        (localPort.kind === 'shaft' && target.kind === 'socket' && isCenterSocket(target.portId)) ||
        (localPort.kind === 'socket' && target.kind === 'rod-end') ||
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

/** Snap a rod firmly along the hovered orb’s own direction — never a guessed tilt. */
export function findRodSnapOnPointer(
  catalog: CatalogPiece,
  freePorts: WorldPort[],
  view: PointerView,
): ReturnType<typeof findBestSnap> {
  if (catalog.category !== 'rods') return findBestSnapOnRay(catalog, freePorts, view.ray)
  const hovered = nearestSocketOnPointer(freePorts, view)
  if (!hovered) return null
  return findBestSnap(catalog, [hovered], new THREE.Vector3(...hovered.position))
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

/** If a rod end is sitting in a clip, lock to that clip’s axis — no in-between tilts. */
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
      if (target.kind !== 'socket' || isCenterSocket(target.portId) || target.occupied) continue
      const dist = end.distanceTo(new THREE.Vector3(...target.position))
      if (dist > CLIP_GRIP) continue
      if (!best || dist < best.dist) best = { local, target, dist }
    }
  }
  if (!best) return null
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

/** Discrete connector poses that can sit on a free rod end. */
export function connectorPosesOnRodEnd(
  catalog: CatalogPiece,
  target: WorldPort,
  workNormal: THREE.Vector3,
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

/** Coaxial spacer / wheel / gear on a rod shaft. */
export function sleevePosesOnShaft(
  catalog: CatalogPiece,
  rod: PlacedPiece,
  shaftPoint: THREE.Vector3,
): ConnectorAimPose[] {
  if (!isShaftSleeve(catalog)) return []
  const axle =
    catalog.ports.find((p) => p.id === 'bore' || p.id === 'axle') ??
    catalog.ports.find((p) => p.kind === 'socket')
  if (!axle) return []
  const { dir } = rodAxis(rod)
  const localDir = new THREE.Vector3(...axle.direction).normalize()
  const localPos = new THREE.Vector3(...axle.position)
  const rotation = new THREE.Quaternion().setFromUnitVectors(localDir, dir.clone().normalize())
  const offset = localPos.clone().applyQuaternion(rotation)
  const position = shaftPoint.clone().sub(offset)
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
  origin: [number, number, number]
  dir: [number, number, number]
  minDelta: number
  maxDelta: number
}

function contactOnRod(
  connector: PlacedPiece,
  connectorCatalog: CatalogPiece,
  portId: string,
): THREE.Vector3 | null {
  const port = connectorCatalog.ports.find((p) => p.id === portId)
  if (!port) return null
  if (isCenterSocket(port.id)) return new THREE.Vector3(...connector.position)
  if (port.kind === 'socket') {
    return new THREE.Vector3(...worldPort(connector, port, true).position)
  }
  return null
}

/**
 * Axis slide for a perp clip on a shaft, or a hub with a rod through its center.
 * Rod-end and interlock joints pin the piece, so those cannot slide.
 */
function slideJointFromSeated(
  piece: PlacedPiece,
  pieces: PlacedPiece[],
  seated: Connection[],
): SlideJoint | null {
  const catalog = getCatalogPiece(piece.catalogId)
  if (!catalog || (catalog.category !== 'rods' && catalog.category !== 'connectors')) return null
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
    if (myPort?.kind === 'interlock' || theirPort?.kind === 'interlock') return null
    if (myPort?.kind === 'rod-end' || theirPort?.kind === 'rod-end') return null
  }

  const joints: { rod: PlacedPiece; contact: THREE.Vector3 }[] = []
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
    if (rodCatalog?.category !== 'rods' || connCatalog?.category !== 'connectors') continue
    const clipId = shaftMine ? theirPort.id : myPort.id
    const contact = contactOnRod(connector, connCatalog, clipId)
    if (!contact) continue
    joints.push({ rod, contact })
  }
  if (!joints.length) return null

  const rod = joints[0].rod
  if (joints.some((j) => j.rod.id !== rod.id)) return null
  if (catalog.category === 'rods' && rod.id !== piece.id) return null

  const { origin, dir, half } = rodAxis(rod)
  const span = Math.max(0, half - SHAFT_END_INSET)
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
  return {
    pieceId: piece.id,
    rodId: rod.id,
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
  return slideJointFromSeated(piece, pieces, mergeGeometricConnections(pieces, connections))
}

export function canSlidePiece(
  piece: PlacedPiece,
  pieces: PlacedPiece[],
  connections: Connection[],
): boolean {
  return slideJointForPiece(piece, pieces, connections) !== null
}

export function slidablePieceIds(pieces: PlacedPiece[], connections: Connection[]): Set<string> {
  const seated = mergeGeometricConnections(pieces, connections)
  const ids = new Set<string>()
  for (const piece of pieces) {
    if (slideJointFromSeated(piece, pieces, seated)) ids.add(piece.id)
  }
  return ids
}

export function nearestSlidablePiece(
  pieces: PlacedPiece[],
  connections: Connection[],
  ray: THREE.Ray,
  maxDist = 0.9,
): PlacedPiece | null {
  const seated = mergeGeometricConnections(pieces, connections)
  let best: PlacedPiece | null = null
  let bestDist = maxDist
  const closest = new THREE.Vector3()
  for (const piece of pieces) {
    if (!slideJointFromSeated(piece, pieces, seated)) continue
    const pos = new THREE.Vector3(...piece.position)
    ray.closestPointToPoint(pos, closest)
    const along = closest.clone().sub(ray.origin).dot(ray.direction)
    if (along < 0.05) continue
    let dist = closest.distanceTo(pos)
    const catalog = getCatalogPiece(piece.catalogId)
    if (catalog?.category === 'rods') {
      const { origin, dir, half } = rodAxis(piece)
      const t = rayAxisT(ray, origin, dir)
      if (t != null) {
        const clamped = THREE.MathUtils.clamp(t, -half, half)
        const onRod = origin.clone().addScaledVector(dir, clamped)
        dist = Math.min(dist, ray.distanceToPoint(onRod))
      }
    }
    if (dist < bestDist) {
      bestDist = dist
      best = piece
    }
  }
  return best
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
  return port.kind === 'socket' && !isCenterSocket(port.portId)
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

function worldPortsCompatible(a: WorldPort, b: WorldPort): boolean {
  if (a.kind === 'interlock' && b.kind === 'interlock') return true
  if (a.kind === 'rod-end' && b.kind === 'socket') return !isCenterSocket(b.portId)
  if (a.kind === 'socket' && b.kind === 'rod-end') return !isCenterSocket(a.portId)
  if (a.kind === 'shaft' && b.kind === 'socket') return true
  if (a.kind === 'socket' && b.kind === 'shaft') return true
  return false
}

function worldDirectionsMatch(a: WorldPort, b: WorldPort): boolean {
  const dot = new THREE.Vector3(...a.direction).dot(new THREE.Vector3(...b.direction))
  if (a.kind === 'interlock' || b.kind === 'interlock') return Math.abs(dot) < POSE_DIR_PERP
  const shaftClip =
    (a.kind === 'shaft' && isClipSocketPort(b)) || (b.kind === 'shaft' && isClipSocketPort(a))
  if (shaftClip) return Math.abs(dot) < POSE_DIR_PERP
  if (
    a.kind === 'shaft' ||
    b.kind === 'shaft' ||
    isCenterSocket(a.portId) ||
    isCenterSocket(b.portId)
  ) {
    return Math.abs(dot) > 0.9
  }
  return dot < POSE_DIR_OPPOSITE
}

function pairDistance(a: WorldPort, b: WorldPort): number {
  const shaftClip =
    (a.kind === 'shaft' && isClipSocketPort(b)) || (b.kind === 'shaft' && isClipSocketPort(a))
  if (shaftClip) {
    const shaft = a.kind === 'shaft' ? a : b
    const clip = a.kind === 'shaft' ? b : a
    return distPointToAxis(clip.position, shaft.position, shaft.direction)
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
  const pairs: { a: WorldPort; b: WorldPort; dist: number }[] = []
  for (let i = 0; i < free.length; i++) {
    for (let j = i + 1; j < free.length; j++) {
      const a = free[i]
      const b = free[j]
      if (a.pieceId === b.pieceId) continue
      if (!worldPortsCompatible(a, b)) continue
      const dist = pairDistance(a, b)
      if (dist > COUPLE_DIST) continue
      if (!worldDirectionsMatch(a, b)) continue
      pairs.push({ a, b, dist })
    }
  }
  pairs.sort((x, y) => x.dist - y.dist)
  const used = new Set(occupied)
  const extra: Connection[] = []
  for (const { a, b } of pairs) {
    const ka = portKey(a.pieceId, a.portId)
    const kb = portKey(b.pieceId, b.portId)
    if ((a.portId !== 'shaft' && used.has(ka)) || (b.portId !== 'shaft' && used.has(kb))) continue
    if (a.portId !== 'shaft') used.add(ka)
    if (b.portId !== 'shaft') used.add(kb)
    extra.push({
      aPieceId: a.pieceId,
      aPortId: a.portId,
      bPieceId: b.pieceId,
      bPortId: b.portId,
    })
  }
  return extra.length ? [...connections, ...extra] : connections
}

/** Occupied ports from stored connections plus any geometrically seated mates. */
export function occupancyKeys(pieces: PlacedPiece[], connections: Connection[]): Set<string> {
  return occupiedPortKeys(mergeGeometricConnections(pieces, connections))
}

function portsCompatible(local: PortDef, target: WorldPort): boolean {
  if (local.kind === 'interlock' && target.kind === 'interlock') return true
  if (local.kind === 'rod-end' && target.kind === 'socket') return !isCenterSocket(target.portId)
  if (local.kind === 'socket' && target.kind === 'rod-end') return !isCenterSocket(local.id)
  if (local.kind === 'shaft' && target.kind === 'socket') return isCenterSocket(target.portId)
  if (local.kind === 'socket' && target.kind === 'shaft') return !isCenterSocket(local.id)
  return false
}

function directionsMatch(local: PortDef, a: THREE.Vector3, b: THREE.Vector3): boolean {
  const dot = a.dot(b)
  if (local.kind === 'interlock') return Math.abs(dot) < POSE_DIR_PERP
  if (local.kind === 'shaft' || (local.kind === 'socket' && isCenterSocket(local.id))) {
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
