import * as THREE from 'three'
import type { Connection, PlacedPiece } from '../types/knex'
import {
  CLIP_ARM_LENGTH,
  HUB_HEIGHT,
  HUB_RADIUS,
  ROD_RADIUS_SCENE,
  SOCKET_RADIUS,
  SPACER_OUTER_RADIUS,
  getCatalogPiece,
  isConnectorLike,
  isShaftSleeve,
} from '../data/catalog'
import { isCenterSocket, mergeGeometricConnections, quatFromTuple, rodAxis } from './math'

const ROD_HIT = ROD_RADIUS_SCENE * 1.08
const GHOST_ID = 'ghost'

type Capsule = { a: THREE.Vector3; b: THREE.Vector3; radius: number }

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

/** Squared distance between the closest points of two segments. */
export function segmentDistSq(
  p1: THREE.Vector3,
  q1: THREE.Vector3,
  p2: THREE.Vector3,
  q2: THREE.Vector3,
): number {
  const d1 = q1.clone().sub(p1)
  const d2 = q2.clone().sub(p2)
  const r = p1.clone().sub(p2)
  const a = d1.dot(d1)
  const e = d2.dot(d2)
  const f = d2.dot(r)
  const eps = 1e-10
  let s: number
  let t: number

  if (a <= eps && e <= eps) return p1.distanceToSquared(p2)
  if (a <= eps) {
    s = 0
    t = clamp01(f / e)
  } else {
    const c = d1.dot(r)
    if (e <= eps) {
      t = 0
      s = clamp01(-c / a)
    } else {
      const b = d1.dot(d2)
      const denom = a * e - b * b
      s = Math.abs(denom) <= eps ? 0 : clamp01((b * f - c * e) / denom)
      t = (b * s + f) / e
      if (t < 0) {
        t = 0
        s = clamp01(-c / a)
      } else if (t > 1) {
        t = 1
        s = clamp01((b - c) / a)
      }
    }
  }
  return p1.clone().addScaledVector(d1, s).distanceToSquared(p2.clone().addScaledVector(d2, t))
}

function capsulesOverlap(a: Capsule[], b: Capsule[]): boolean {
  for (const left of a) {
    for (const right of b) {
      const limit = left.radius + right.radius
      if (segmentDistSq(left.a, left.b, right.a, right.b) < limit * limit) return true
    }
  }
  return false
}

function capsulesFor(piece: PlacedPiece, includeClips: boolean): Capsule[] {
  const catalog = getCatalogPiece(piece.catalogId)
  if (!catalog) return []
  const origin = new THREE.Vector3(...piece.position)
  const q = quatFromTuple(piece.rotation)

  if (catalog.category === 'rods') {
    const half = (catalog.length ?? 1) / 2
    const axis = new THREE.Vector3(0, 0, 1).applyQuaternion(q)
    return [
      {
        a: origin.clone().addScaledVector(axis, -half),
        b: origin.clone().addScaledVector(axis, half),
        radius: ROD_HIT,
      },
    ]
  }

  if (isConnectorLike(catalog)) {
    const hubAxis = new THREE.Vector3(0, 1, 0).applyQuaternion(q)
    const h = HUB_HEIGHT / 2
    const caps: Capsule[] = [
      {
        a: origin.clone().addScaledVector(hubAxis, -h),
        b: origin.clone().addScaledVector(hubAxis, h),
        radius: HUB_RADIUS,
      },
    ]
    if (!includeClips) return caps
    for (const port of catalog.ports) {
      if (port.kind !== 'socket' || isCenterSocket(port.id)) continue
      if (port.id === 'hole' || port.id === 'bore') continue
      const dir = new THREE.Vector3(...port.direction).applyQuaternion(q).normalize()
      caps.push({
        a: origin.clone().addScaledVector(dir, SOCKET_RADIUS * 0.35),
        b: origin.clone().addScaledVector(dir, SOCKET_RADIUS + CLIP_ARM_LENGTH),
        radius: ROD_HIT,
      })
    }
    return caps
  }

  const radius = catalog.radius ?? 0.4
  const thick = catalog.thickness ?? HUB_HEIGHT
  const axis = new THREE.Vector3(0, 0, 1).applyQuaternion(q)
  return [
    {
      a: origin.clone().addScaledVector(axis, -thick / 2),
      b: origin.clone().addScaledVector(axis, thick / 2),
      radius: Math.max(radius, ROD_HIT),
    },
  ]
}

function clipCapsulesFor(piece: PlacedPiece): Capsule[] {
  const catalog = getCatalogPiece(piece.catalogId)
  if (!catalog || catalog.category !== 'connectors') return []
  const origin = new THREE.Vector3(...piece.position)
  const q = quatFromTuple(piece.rotation)
  const caps: Capsule[] = []
  for (const port of catalog.ports) {
    if (port.kind !== 'socket' || isCenterSocket(port.id)) continue
    const dir = new THREE.Vector3(...port.direction).applyQuaternion(q).normalize()
    caps.push({
      a: origin.clone().addScaledVector(dir, SOCKET_RADIUS),
      b: origin.clone().addScaledVector(dir, SOCKET_RADIUS + CLIP_ARM_LENGTH),
      radius: ROD_HIT,
    })
  }
  return caps
}

/** Crossing clip arms. Coaxial end-to-end (nose-to-nose on a rod) is not a scissor. */
function clipsScissor(a: Capsule[], b: Capsule[]): boolean {
  for (const left of a) {
    const d1 = left.b.clone().sub(left.a)
    if (d1.lengthSq() < 1e-10) continue
    d1.normalize()
    for (const right of b) {
      const d2 = right.b.clone().sub(right.a)
      if (d2.lengthSq() < 1e-10) continue
      d2.normalize()
      const limit = left.radius + right.radius
      if (segmentDistSq(left.a, left.b, right.a, right.b) >= limit * limit) continue
      if (Math.abs(d1.dot(d2)) > 0.9) {
        const mid1 = left.a.clone().add(left.b).multiplyScalar(0.5)
        const mid2 = right.a.clone().add(right.b).multiplyScalar(0.5)
        const between = mid2.sub(mid1)
        const lateral = between.clone().addScaledVector(d1, -between.dot(d1)).length()
        if (lateral < limit * 0.65) continue
      }
      return true
    }
  }
  return false
}

type Disk = {
  origin: THREE.Vector3
  axis: THREE.Vector3
  radius: number
  halfH: number
}

function pieceDiskOf(piece: PlacedPiece): Disk | null {
  const catalog = getCatalogPiece(piece.catalogId)
  if (!catalog) return null
  const q = quatFromTuple(piece.rotation)
  const origin = new THREE.Vector3(...piece.position)
  if (isShaftSleeve(catalog)) {
    return {
      origin,
      axis: new THREE.Vector3(0, 0, 1).applyQuaternion(q).normalize(),
      radius: catalog.radius ?? SPACER_OUTER_RADIUS,
      halfH: (catalog.thickness ?? HUB_HEIGHT) / 2,
    }
  }
  if (catalog.category === 'connectors') {
    return {
      origin,
      axis: new THREE.Vector3(0, 1, 0).applyQuaternion(q).normalize(),
      radius: HUB_RADIUS,
      halfH: HUB_HEIGHT / 2,
    }
  }
  return null
}

/**
 * Flat hubs and shaft rings may sit face-to-face. Capsules with the outer
 * radius would block a second tire on the same rod from a full diameter away.
 */
function disksOverlap(a: Disk, b: Disk): boolean {
  const align = Math.abs(a.axis.dot(b.axis))
  const delta = b.origin.clone().sub(a.origin)
  if (align > 0.82) {
    const axial = Math.abs(delta.dot(a.axis))
    const radial = delta.clone().addScaledVector(a.axis, -delta.dot(a.axis)).length()
    if (axial >= a.halfH + b.halfH - 0.02) return false
    return radial < a.radius + b.radius - 0.012
  }
  const radialA = delta.clone().addScaledVector(a.axis, -delta.dot(a.axis)).length()
  const radialB = delta.clone().addScaledVector(b.axis, -delta.dot(b.axis)).length()
  const onShaft = Math.min(radialA, radialB) < Math.min(a.radius, b.radius) * 0.45 + ROD_HIT
  if (!onShaft) return false
  const along = radialA <= radialB ? Math.abs(delta.dot(a.axis)) : Math.abs(delta.dot(b.axis))
  return along < a.halfH + b.halfH - 0.02
}

/** A rod through a coaxial bore is a fit, not a hit. */
function shaftThroughDisk(rod: PlacedPiece, disk: Disk): boolean {
  const { origin, dir } = rodAxis(rod)
  if (Math.abs(dir.dot(disk.axis)) < 0.9) return false
  const delta = disk.origin.clone().sub(origin)
  const radial = delta.clone().addScaledVector(dir, -delta.dot(dir)).length()
  return radial < ROD_HIT * 1.8
}

function pairOverlaps(a: PlacedPiece, b: PlacedPiece): boolean {
  const ca = getCatalogPiece(a.catalogId)
  const cb = getCatalogPiece(b.catalogId)
  if (ca?.category === 'connectors' && cb?.category === 'connectors') {
    if (clipsScissor(clipCapsulesFor(a), clipCapsulesFor(b))) return true
    const ha = pieceDiskOf(a)
    const hb = pieceDiskOf(b)
    return Boolean(ha && hb && disksOverlap(ha, hb))
  }
  const rod = ca?.category === 'rods' ? a : cb?.category === 'rods' ? b : null
  const other = rod === a ? b : rod === b ? a : null
  const disk = other ? pieceDiskOf(other) : null
  if (rod && disk && shaftThroughDisk(rod, disk)) return false
  const da = pieceDiskOf(a)
  const db = pieceDiskOf(b)
  if (da && db) return disksOverlap(da, db)
  const clips = ca?.category === 'rods' || cb?.category === 'rods'
  return capsulesOverlap(capsulesFor(a, clips), capsulesFor(b, clips))
}

export type GhostSnap = {
  localPortId: string
  targetPieceId: string
  targetPortId: string
} | null

function skipPieceIds(
  candidate: PlacedPiece,
  others: PlacedPiece[],
  connections: Connection[],
  snap: GhostSnap,
): Set<string> {
  const skip = new Set<string>()
  let conns = connections
  if (snap) {
    skip.add(snap.targetPieceId)
    conns = [
      ...connections,
      {
        aPieceId: candidate.id,
        aPortId: snap.localPortId,
        bPieceId: snap.targetPieceId,
        bPortId: snap.targetPortId,
      },
    ]
  }
  const scene = others.some((p) => p.id === candidate.id) ? others : [...others, candidate]
  for (const c of mergeGeometricConnections(scene, conns)) {
    if (c.aPieceId === candidate.id) skip.add(c.bPieceId)
    if (c.bPieceId === candidate.id) skip.add(c.aPieceId)
  }
  return skip
}

/** True when this pose overlaps another piece that is not a seated mate. */
export function poseCollides(
  candidate: PlacedPiece,
  others: PlacedPiece[],
  connections: Connection[],
  snap: GhostSnap = null,
): boolean {
  const skip = skipPieceIds(candidate, others, connections, snap)
  for (const other of others) {
    if (other.id === candidate.id || skip.has(other.id)) continue
    if (pairOverlaps(candidate, other)) return true
  }
  return false
}

export function ghostCollides(
  catalogId: string,
  position: [number, number, number],
  rotation: [number, number, number, number],
  pieces: PlacedPiece[],
  connections: Connection[],
  snap: GhostSnap,
): boolean {
  return poseCollides(
    { id: GHOST_ID, catalogId, position, rotation },
    pieces,
    connections,
    snap,
  )
}
