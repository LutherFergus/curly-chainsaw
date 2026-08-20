export type PieceCategory =
  | 'rods'
  | 'connectors'
  | 'clips'
  | 'spacers'
  | 'wheels'
  | 'gears'
  | 'panels'
  | 'chain'

/** rod-end ↔ socket; interlock ↔ interlock (connector plates slid together) */
export type PortKind = 'rod-end' | 'socket' | 'interlock' | 'shaft'

export type ConnectorVariant =
  | 'plate' // flat non-slotted connector
  | 'full' // full slotted connector
  | 'half' // half slotted connector
  | 'double-full' // two fulls joined
  | 'full-half' // full + half joined
  | 'half-half' // two halves joined
  | 'hole-clip' // 1-way C-clip with free hinge hole
  | 'lock-clip' // tan interlocking clip (locks wheel/gear on shaft)
  | 'rod-end-clip' // C-clip with integral rod stub
  | 'hinge' // two-part hinge assembled
  | 'ball-clip'
  | 'socket-clip'
  | 'end-cap'
  | 'sleeve' // spacer / axle ring
  | 'panel-square'
  | 'panel-tri'
  | 'chain-link'
  | 'wheel-thin'
  | 'wheel-pulley'
  | 'wheel-spoke'
  | 'wheel-race'
  | 'wheel-narrow'
  | 'wheel-tire'

export interface PortDef {
  id: string
  kind: PortKind
  /** Local-space position of the connection point */
  position: [number, number, number]
  /** Local-space outward direction of the connection */
  direction: [number, number, number]
  /** Local-space C-clip mouth axis (plate hub). Rods can elevate in this plane. */
  opening?: [number, number, number]
}

export interface CatalogPiece {
  id: string
  name: string
  category: PieceCategory
  description: string
  color: string
  accent?: string
  /** Rod / chain body length (scene units), or panel tip span */
  length?: number
  /** Outer radius (scene) for wheels, gears, spacers */
  radius?: number
  /** Axial thickness (scene) for spacers, gears, wheels, panels */
  thickness?: number
  /** Gear tooth count when applicable */
  teeth?: number
  /** Hub outer radius (scene) when `radius` is a tire/finished OD */
  hubRadius?: number
  /** Spoke count for spoked wheels */
  spokes?: number
  /** Flexible rod (same snap as rigid; visual bend later) */
  flexi?: boolean
  /** Visual / assembly style */
  variant?: ConnectorVariant
  ports: PortDef[]
}

export interface WorldPort {
  pieceId: string
  portId: string
  kind: PortKind
  position: [number, number, number]
  direction: [number, number, number]
  /** World-space local +Z (slot/rail axis on connectors). */
  slot: [number, number, number]
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

export type ToolMode = 'place' | 'select' | 'slide'

/** single = pick → place → pick again; multiple = keep placing the same piece */
export type PlacementMode = 'single' | 'multiple'

/** fly = orbit/rotate camera; pan = slide the view */
export type CameraNavMode = 'fly' | 'pan'

/** in-plane = spin on the current working plate; opposite = flip toward another plane */
export type ConnectorRotateMode = 'in-plane' | 'opposite'
