export type PieceCategory = 'rods' | 'connectors' | 'wheels' | 'gears'

export type PortKind = 'rod-end' | 'socket'

export interface PortDef {
  id: string
  kind: PortKind
  /** Local-space position of the connection point */
  position: [number, number, number]
  /** Local-space outward direction of the connection */
  direction: [number, number, number]
}

export interface CatalogPiece {
  id: string
  name: string
  category: PieceCategory
  description: string
  color: string
  accent?: string
  /** Rod length (center-to-center when connected), ignored for non-rods */
  length?: number
  ports: PortDef[]
}

export interface WorldPort {
  pieceId: string
  portId: string
  kind: PortKind
  position: [number, number, number]
  direction: [number, number, number]
  occupied: boolean
}

export interface Connection {
  aPieceId: string
  aPortId: string
  bPieceId: string
  bPortId: string
}

export interface PlacedPiece {
  id: string
  catalogId: string
  position: [number, number, number]
  /** Quaternion as [x, y, z, w] */
  rotation: [number, number, number, number]
}

export type ToolMode = 'place' | 'select'
