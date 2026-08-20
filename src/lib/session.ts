import type { Connection, PlacedPiece } from '../types/knex'

const AUTOSAVE_KEY = 'knex-studio-autosave'
const LAST_SESSION_KEY = 'knex-studio-last-session'
export const SESSION_VERSION = 1 as const

export interface SessionPayload {
  version: typeof SESSION_VERSION
  pieces: PlacedPiece[]
  connections: Connection[]
  nextId: number
  savedAt: number
}

function isTuple3(v: unknown): v is [number, number, number] {
  return (
    Array.isArray(v) &&
    v.length === 3 &&
    typeof v[0] === 'number' &&
    typeof v[1] === 'number' &&
    typeof v[2] === 'number'
  )
}

function isTuple4(v: unknown): v is [number, number, number, number] {
  return (
    Array.isArray(v) &&
    v.length === 4 &&
    typeof v[0] === 'number' &&
    typeof v[1] === 'number' &&
    typeof v[2] === 'number' &&
    typeof v[3] === 'number'
  )
}

function parsePiece(raw: unknown): PlacedPiece | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Record<string, unknown>
  if (typeof p.id !== 'string' || typeof p.catalogId !== 'string') return null
  if (!isTuple3(p.position) || !isTuple4(p.rotation)) return null
  return {
    id: p.id,
    catalogId: p.catalogId,
    position: [...p.position],
    rotation: [...p.rotation],
  }
}

function parseConnection(raw: unknown): Connection | null {
  if (!raw || typeof raw !== 'object') return null
  const c = raw as Record<string, unknown>
  if (
    typeof c.aPieceId !== 'string' ||
    typeof c.aPortId !== 'string' ||
    typeof c.bPieceId !== 'string' ||
    typeof c.bPortId !== 'string'
  ) {
    return null
  }
  return {
    aPieceId: c.aPieceId,
    aPortId: c.aPortId,
    bPieceId: c.bPieceId,
    bPortId: c.bPortId,
  }
}

export function nextIdFromPieces(pieces: PlacedPiece[]): number {
  let max = 0
  for (const piece of pieces) {
    const match = /^piece-(\d+)$/.exec(piece.id)
    if (match) max = Math.max(max, Number(match[1]))
  }
  return max + 1
}

export function parseSession(raw: string | null): SessionPayload | null {
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as unknown
    if (!data || typeof data !== 'object') return null
    const obj = data as Record<string, unknown>
    if (obj.version !== SESSION_VERSION) return null
    if (!Array.isArray(obj.pieces) || !Array.isArray(obj.connections)) return null
    const pieces: PlacedPiece[] = []
    for (const item of obj.pieces) {
      const piece = parsePiece(item)
      if (!piece) return null
      pieces.push(piece)
    }
    const connections: Connection[] = []
    for (const item of obj.connections) {
      const conn = parseConnection(item)
      if (!conn) return null
      connections.push(conn)
    }
    const nextId =
      typeof obj.nextId === 'number' && Number.isFinite(obj.nextId) && obj.nextId > 0
        ? Math.max(Math.floor(obj.nextId), nextIdFromPieces(pieces))
        : nextIdFromPieces(pieces)
    const savedAt =
      typeof obj.savedAt === 'number' && Number.isFinite(obj.savedAt) ? obj.savedAt : Date.now()
    return { version: SESSION_VERSION, pieces, connections, nextId, savedAt }
  } catch {
    return null
  }
}

function readKey(key: string): SessionPayload | null {
  try {
    return parseSession(localStorage.getItem(key))
  } catch {
    return null
  }
}

function writeKey(key: string, session: SessionPayload): void {
  try {
    localStorage.setItem(key, JSON.stringify(session))
  } catch {
    // Quota or private mode — ignore
  }
}

export function buildSession(
  pieces: PlacedPiece[],
  connections: Connection[],
  nextId: number,
): SessionPayload {
  return {
    version: SESSION_VERSION,
    pieces: pieces.map((p) => ({
      ...p,
      position: [...p.position] as [number, number, number],
      rotation: [...p.rotation] as [number, number, number, number],
    })),
    connections: connections.map((c) => ({ ...c })),
    nextId: Math.max(nextId, nextIdFromPieces(pieces)),
    savedAt: Date.now(),
  }
}

/** Current canvas — restored on refresh. */
export function saveAutosave(session: SessionPayload): void {
  writeKey(AUTOSAVE_KEY, session)
  if (session.pieces.length > 0) {
    writeKey(LAST_SESSION_KEY, session)
  }
}

export function loadAutosave(): SessionPayload | null {
  return readKey(AUTOSAVE_KEY)
}

/** Last non-empty build — for the Load last session button after Clear. */
export function loadLastSession(): SessionPayload | null {
  return readKey(LAST_SESSION_KEY)
}

export function hasLastSession(): boolean {
  const session = loadLastSession()
  return !!session && session.pieces.length > 0
}
