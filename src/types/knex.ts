export type PieceCategory = 'rods' | 'connectors' | 'wheels' | 'gears'

/** rod-end ↔ socket; interlock ↔ interlock (connector plates slid together) */
export type PortKind = 'rod-end' | 'socket' | 'interlock'

export type ConnectorVariant =
  | 'plate' // full/near-full flat connector with center slot
  | 'half' // silver semi-circle with rail
  | 'ball' // two blues joined
  | 'mixed' // silver + blue joined
  | 'corner' // two silvers joined

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
  /** Rod length (end-to-end body), ignored for non-rods */
  length?: number
  /** Visual / assembly style for connectors */
  variant?: ConnectorVariant
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
