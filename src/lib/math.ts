import * as THREE from 'three'
import type {
  CatalogPiece,
  Connection,
  ConnectorRotateMode,
  PlacedPiece,
  PortDef,
  WorldPort,
} from '../types/knex'
import { getCatalogPiece } from '../data/catalog'

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
    for (const port of catalog.ports) {
      const key = `${piece.id}:${port.id}`
      result.push(worldPort(piece, port, occupiedKeys.has(key)))
    }
  }
  return result
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

/**
 * Orient a piece so one of its ports matches a target world port
 * (opposite direction, same position after placement).
 *
 * Interlock ports (connector center slots) join at 90° so two flat
 * plates nest into a 3D hub — matching blue/silver slide joins.
 */
export function alignPieceToPort(
  localPort: PortDef,
  target: WorldPort,
): { position: [number, number, number]; rotation: [number, number, number, number] } {
  if (localPort.kind === 'interlock' && target.kind === 'interlock') {
    const targetHub = new THREE.Vector3(...target.direction).normalize()
    const helper =
      Math.abs(targetHub.dot(new THREE.Vector3(0, 1, 0))) < 0.85
        ? new THREE.Vector3(0, 1, 0)
        : new THREE.Vector3(1, 0, 0)
    const newHub = new THREE.Vector3().crossVectors(targetHub, helper).normalize()
    const localHub = new THREE.Vector3(...localPort.direction).normalize()
    const rotation = new THREE.Quaternion().setFromUnitVectors(localHub, newHub)
    const localPos = new THREE.Vector3(...localPort.position).applyQuaternion(rotation)
    const targetPos = new THREE.Vector3(...target.position)
    const position = targetPos.sub(localPos)
    return {
      position: [position.x, position.y, position.z],
      rotation: tupleFromQuat(rotation),
    }
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
        (localPort.kind === 'rod-end' && target.kind === 'socket') ||
        (localPort.kind === 'socket' && target.kind === 'rod-end') ||
        (localPort.kind === 'interlock' && target.kind === 'interlock')
      if (!compatible) continue

      const pose = alignPieceToPort(localPort, target)
      // Score by proximity to the target port — not the piece center —
      // so long rods still snap when the cursor is near a socket.
      const portWorld = new THREE.Vector3(...target.position)
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
  if (catalog.category !== 'connectors' || target.kind !== 'rod-end') return []
  const sockets = catalog.ports.filter((p) => p.kind === 'socket')
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
    keys.add(`${c.aPieceId}:${c.aPortId}`)
    keys.add(`${c.bPieceId}:${c.bPortId}`)
  }
  return keys
}

function portsCompatible(localKind: PortDef['kind'], targetKind: PortDef['kind']): boolean {
  return (
    (localKind === 'rod-end' && targetKind === 'socket') ||
    (localKind === 'socket' && targetKind === 'rod-end') ||
    (localKind === 'interlock' && targetKind === 'interlock')
  )
}

function directionsMatch(localKind: PortDef['kind'], a: THREE.Vector3, b: THREE.Vector3): boolean {
  const dot = a.dot(b)
  if (localKind === 'interlock') return Math.abs(dot) < POSE_DIR_PERP
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
      if (!portsCompatible(local.kind, job.target.kind)) continue
      const wp = worldPort(piece, local, true)
      const dist = new THREE.Vector3(...wp.position).distanceTo(
        new THREE.Vector3(...job.target.position),
      )
      if (dist > POSE_POS_TOL) continue
      if (!directionsMatch(local.kind, new THREE.Vector3(...wp.direction), targetDir)) continue
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
    if (!port || port.kind !== 'socket') continue
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
  if (!catalog || catalog.category !== 'connectors') return null

  const workNormal = connectorWorkNormal(piece, catalog, connections)
  const origin = new THREE.Vector3(...piece.position)
  const rodDirs = connectedRodDirections(piece, catalog, pieces, connections)
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
