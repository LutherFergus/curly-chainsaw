import * as THREE from 'three'
import type { Connection, PlacedPiece } from '../types/knex'
import {
  CLIP_ARM_LENGTH,
  HUB_HEIGHT,
  HUB_RADIUS,
  ROD_RADIUS_SCENE,
  SOCKET_RADIUS,
  getCatalogPiece,
} from '../data/catalog'
import { isCenterSocket, mergeGeometricConnections, quatFromTuple } from './math'

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

  if (catalog.category === 'connectors') {
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
      const dir = new THREE.Vector3(...port.direction).applyQuaternion(q).normalize()
      caps.push({
        a: origin.clone().addScaledVector(dir, SOCKET_RADIUS),
        b: origin.clone().addScaledVector(dir, SOCKET_RADIUS + CLIP_ARM_LENGTH),
        radius: ROD_HIT,
      })
    }
    return caps
  }

  if (catalog.category === 'wheels') {
    return [{ a: origin.clone(), b: origin.clone(), radius: 0.71 }]
  }

  const radius = catalog.id === 'gear-large' ? 0.7 : 0.42
  return [{ a: origin.clone(), b: origin.clone(), radius }]
}

function pairOverlaps(a: PlacedPiece, b: PlacedPiece): boolean {
  const ca = getCatalogPiece(a.catalogId)
  const cb = getCatalogPiece(b.catalogId)
  const clips = ca?.category === 'rods' || cb?.category === 'rods'
  return capsulesOverlap(capsulesFor(a, clips), capsulesFor(b, clips))
}

export type GhostSnap = {
  localPortId: string
  targetPieceId: string
  targetPortId: string
} | null

/** Rods this piece is shaft-coupled to (perp clip or through-hole). */
function shaftRodIds(pieceId: string, connections: Connection[]): Set<string> {
  const rods = new Set<string>()
  for (const c of connections) {
    if (c.aPieceId === pieceId && c.bPortId === 'shaft') rods.add(c.bPieceId)
    if (c.bPieceId === pieceId && c.aPortId === 'shaft') rods.add(c.aPieceId)
    if (c.aPieceId === pieceId && c.aPortId === 'shaft') rods.add(c.aPieceId)
    if (c.bPieceId === pieceId && c.bPortId === 'shaft') rods.add(c.bPieceId)
  }
  return rods
}

function sharesShaftRod(aId: string, bId: string, connections: Connection[]): boolean {
  const aRods = shaftRodIds(aId, connections)
  if (!aRods.size) return false
  const bRods = shaftRodIds(bId, connections)
  for (const id of aRods) {
    if (bRods.has(id)) return true
  }
  return false
}

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
  const seated = mergeGeometricConnections(scene, conns)
  for (const c of seated) {
    if (c.aPieceId === candidate.id) skip.add(c.bPieceId)
    if (c.bPieceId === candidate.id) skip.add(c.aPieceId)
  }
  // Connectors on one shaft can slide together. Unslotted plates that only
  // overlap in space (no slot join, no shared rod) still collide.
  if (getCatalogPiece(candidate.catalogId)?.category === 'connectors') {
    for (const other of others) {
      if (other.id === candidate.id || skip.has(other.id)) continue
      if (getCatalogPiece(other.catalogId)?.category !== 'connectors') continue
      if (sharesShaftRod(candidate.id, other.id, seated)) skip.add(other.id)
    }
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
