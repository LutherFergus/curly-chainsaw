import * as THREE from 'three'
import type { CatalogPiece, Connection, PlacedPiece, PortDef, WorldPort } from '../types/knex'
import { getCatalogPiece } from '../data/catalog'

/** Max cursor distance to a free port for snap to engage. */
export const SNAP_DISTANCE = 1.75
export const GRID_SIZE = 0.5
/** K'NEX clips sit on 45° detents. */
export const KNEX_DETENT = Math.PI / 4
const POSE_POS_TOL = 0.16
const POSE_DIR_OPPOSITE = -0.62
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

function poseKey(
  position: [number, number, number],
  rotation: [number, number, number, number],
): string {
  const q = canonicalRotation(rotation)
  const r = (n: number) => n.toFixed(2)
  return `${r(position[0])}|${r(position[1])}|${r(position[2])}|${r(q[0])}|${r(q[1])}|${r(q[2])}|${r(q[3])}`
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

export function alignPieceToPortWithTwist(
  localPort: PortDef,
  target: WorldPort,
  twistRad: number,
): { position: [number, number, number]; rotation: [number, number, number, number] } {
  const base = alignPieceToPort(localPort, target)
  if (Math.abs(twistRad) < 1e-8) return base
  const axis = new THREE.Vector3(...target.direction).normalize()
  const pivot = new THREE.Vector3(...target.position)
  return rotatePoseAroundAxis(
    { id: '', catalogId: '', position: base.position, rotation: base.rotation },
    axis,
    pivot,
    twistRad,
  )
}

/**
 * Rebind this piece's connections after a pose change.
 * Returns null if any existing connection can no longer reach its partner.
 */
export function retargetConnectorConnections(
  piece: PlacedPiece,
  catalog: CatalogPiece,
  pieces: PlacedPiece[],
  connections: Connection[],
): Connection[] | null {
  const next = connections.map((c) => ({ ...c }))
  for (const conn of next) {
    if (conn.aPieceId !== piece.id && conn.bPieceId !== piece.id) continue
    const mineIsA = conn.aPieceId === piece.id
    const partner = pieces.find((p) => p.id === (mineIsA ? conn.bPieceId : conn.aPieceId))
    if (!partner) return null
    const partnerCatalog = getCatalogPiece(partner.catalogId)
    const partnerPort = partnerCatalog?.ports.find(
      (p) => p.id === (mineIsA ? conn.bPortId : conn.aPortId),
    )
    if (!partnerCatalog || !partnerPort) return null

    const target = worldPort(partner, partnerPort, true)
    const targetDir = new THREE.Vector3(...target.direction)
    let best: { id: string; dist: number } | null = null

    for (const local of catalog.ports) {
      if (!portsCompatible(local.kind, target.kind)) continue
      const wp = worldPort(piece, local, true)
      const dist = new THREE.Vector3(...wp.position).distanceTo(new THREE.Vector3(...target.position))
      if (dist > POSE_POS_TOL) continue
      if (!directionsMatch(local.kind, new THREE.Vector3(...wp.direction), targetDir)) continue
      if (local.kind === 'interlock') {
        const aligned = Math.abs(slotDirection(piece).dot(slotDirection(partner)))
        if (aligned < SLOT_ALIGN) continue
      }
      if (!best || dist < best.dist) best = { id: local.id, dist }
    }

    if (!best) return null
    if (mineIsA) conn.aPortId = best.id
    else conn.bPortId = best.id
  }
  return next
}

export interface NextConnectorPose {
  position: [number, number, number]
  rotation: [number, number, number, number]
  connections: Connection[]
}

/**
 * Next discrete K'NEX orientation for a connector: 45° detents around the
 * hub, or around a connected rod so clips stay usable.
 */
export function nextUsableConnectorPose(
  piece: PlacedPiece,
  pieces: PlacedPiece[],
  connections: Connection[],
): NextConnectorPose | null {
  const catalog = getCatalogPiece(piece.catalogId)
  if (!catalog || catalog.category !== 'connectors') return null

  const involved = connections.filter((c) => c.aPieceId === piece.id || c.bPieceId === piece.id)
  const raw: { position: [number, number, number]; rotation: [number, number, number, number] }[] =
    []

  const q = quatFromTuple(piece.rotation)
  const hub = new THREE.Vector3(0, 1, 0).applyQuaternion(q).normalize()
  const origin = new THREE.Vector3(...piece.position)
  const hubAxes = [hub]
  if (
    catalog.variant === 'double-full' ||
    catalog.variant === 'full-half' ||
    catalog.variant === 'half-half'
  ) {
    hubAxes.push(new THREE.Vector3(0, 0, 1).applyQuaternion(q).normalize())
  }

  for (const axis of hubAxes) {
    for (let i = 1; i <= 8; i++) {
      raw.push(rotatePoseAroundAxis(piece, axis, origin, i * KNEX_DETENT))
    }
  }

  const sockets = catalog.ports.filter((p) => p.kind === 'socket')
  const pieceById = new Map(pieces.map((p) => [p.id, p]))

  for (const conn of involved) {
    const mineIsA = conn.aPieceId === piece.id
    const myPort = catalog.ports.find((p) => p.id === (mineIsA ? conn.aPortId : conn.bPortId))
    const partner = pieceById.get(mineIsA ? conn.bPieceId : conn.aPieceId)
    const partnerCatalog = partner ? getCatalogPiece(partner.catalogId) : undefined
    const partnerPort = partnerCatalog?.ports.find(
      (p) => p.id === (mineIsA ? conn.bPortId : conn.aPortId),
    )
    if (!myPort || !partner || !partnerPort) continue

    const target = worldPort(partner, partnerPort, true)
    const pivot = new THREE.Vector3(...target.position)
    const axis = new THREE.Vector3(...target.direction).normalize()
    for (let i = 1; i <= 8; i++) {
      raw.push(rotatePoseAroundAxis(piece, axis, pivot, i * KNEX_DETENT))
    }

    if (myPort.kind === 'socket' && partnerPort.kind === 'rod-end') {
      for (const socket of sockets) {
        for (let t = 0; t < 8; t++) {
          raw.push(alignPieceToPortWithTwist(socket, target, t * KNEX_DETENT))
        }
      }
    }
  }

  const seen = new Set<string>()
  const valid: NextConnectorPose[] = []
  for (const pose of raw) {
    const key = poseKey(pose.position, pose.rotation)
    if (seen.has(key)) continue
    seen.add(key)
    const nextPiece: PlacedPiece = { ...piece, ...pose }
    const nextConnections = retargetConnectorConnections(
      nextPiece,
      catalog,
      pieces.map((p) => (p.id === piece.id ? nextPiece : p)),
      connections,
    )
    if (!nextConnections) continue
    valid.push({
      position: pose.position,
      rotation: canonicalRotation(pose.rotation),
      connections: nextConnections,
    })
  }

  if (!valid.length) return null

  const current = { position: piece.position, rotation: piece.rotation }
  let closest = 0
  let closestDist = Number.POSITIVE_INFINITY
  for (let i = 0; i < valid.length; i++) {
    const d = poseDistance(current, valid[i])
    if (d < closestDist) {
      closestDist = d
      closest = i
    }
  }

  const alreadyThere = closestDist < 0.12
  const index = alreadyThere ? (closest + 1) % valid.length : closest
  const next = valid[index]
  if (alreadyThere && poseKey(next.position, next.rotation) === poseKey(piece.position, piece.rotation)) {
    return null
  }
  return next
}
