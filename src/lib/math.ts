import * as THREE from 'three'
import type { CatalogPiece, PlacedPiece, PortDef, WorldPort } from '../types/knex'
import { getCatalogPiece } from '../data/catalog'

/** Max cursor distance to a free port for snap to engage. */
export const SNAP_DISTANCE = 1.75
export const GRID_SIZE = 0.5

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
