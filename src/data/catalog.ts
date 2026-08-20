import type { CatalogPiece, PortDef } from '../types/knex'

/**
 * Classic K’NEX layout scale.
 * 1 scene unit = green hub-to-hub spacing (37.5 mm). Snap math still uses
 * catalog.length and SOCKET_RADIUS; only the millimetre mapping changed.
 */
export const SCENE_MM = 1 / 37.5
export function mm(n: number): number {
  return n * SCENE_MM
}

/** Hub center → inner/base wall of every rod socket (10.1 mm). */
export const SOCKET_RADIUS = mm(10.1)
/** Nominal rod body radius (Ø 6.35 mm / 0.250 in). */
export const ROD_RADIUS_SCENE = mm(6.35) / 2
/** Hub cylinder stays inside the 10.1 mm socket wall. */
export const HUB_RADIUS = mm(6.6)
export const HUB_HEIGHT = mm(7.4)
/** Gripping arms extend outward from the socket end wall over the rod. */
export const CLIP_ARM_LENGTH = mm(8.6)
/** Keep perp clips off the rod-end flanges. */
export const SHAFT_END_INSET = mm(6.2)

/**
 * Physical rod body lengths (mm). Hub-to-hub = body + 2×10.1 mm, which
 * follows the Classic √2 node spacing (37.5, 53.0, 75.0, 106.1, 150.0, 212.1).
 */
const ROD_SPECS = [
  {
    id: 'rod-green',
    name: 'Green Rod',
    color: '#2f9e44',
    bodyMm: 17.3,
    description: 'Classic #1 rod — just long enough for two connectors nose-to-nose.',
  },
  {
    id: 'rod-white',
    name: 'White Rod',
    color: '#f1f3f5',
    bodyMm: 32.8,
    description: 'Classic #2 rod (√2 node spacing from green).',
  },
  {
    id: 'rod-blue',
    name: 'Blue Rod',
    color: '#1c7ed6',
    bodyMm: 54.8,
    description: 'Classic #3 rod (2 × green node spacing).',
  },
  {
    id: 'rod-yellow',
    name: 'Yellow Rod',
    color: '#f59f00',
    bodyMm: 85.9,
    description: 'Classic #4 rod (2√2 × green node spacing).',
  },
  {
    id: 'rod-red',
    name: 'Red Rod',
    color: '#e03131',
    bodyMm: 129.8,
    description: 'Classic #5 rod (4 × green node spacing).',
  },
  {
    id: 'rod-gray',
    name: 'Gray Rod',
    color: '#868e96',
    bodyMm: 192.0,
    description: 'Classic #6 rod — longest standard length.',
  },
] as const

function rodBodyLength(bodyMm: number): number {
  return mm(bodyMm)
}

/**
 * 3D slot sits at 0° (+Z) in place of a clip — the only place two slotted
 * connectors slide together (grey/grey, grey/blue, blue/blue).
 * Full 7-way: every 45° except that slot. Half 4-way: four clips on the arc.
 */
export const FULL_CLIP_ANGLES = [45, 90, 135, 180, 225, 270, 315] as const
export const HALF_CLIP_ANGLES = [45, 90, 135, 180] as const
/** Second plate after Rz(-90) — skip 180° so the −Z clip is not doubled. */
export const NESTED_HALF_CLIP_ANGLES = [45, 90, 135] as const
export const NESTED_FULL_CLIP_ANGLES = [45, 90, 135, 225, 270, 315] as const

function rodPorts(length: number): PortDef[] {
  const half = length / 2
  return [
    { id: 'end-a', kind: 'rod-end', position: [0, 0, -half], direction: [0, 0, -1] },
    { id: 'end-b', kind: 'rod-end', position: [0, 0, half], direction: [0, 0, 1] },
  ]
}

function shaftPort(): PortDef {
  return { id: 'shaft', kind: 'shaft', position: [0, 0, 0], direction: [0, 0, 1] }
}

/** Clips around hub axis Y (connector lying in XZ). */
function clipsAroundY(angles: readonly number[], prefix: string): PortDef[] {
  const r = SOCKET_RADIUS
  return angles.map((deg, i) => {
    const a = (deg * Math.PI) / 180
    const x = Math.sin(a) * r
    const z = Math.cos(a) * r
    return {
      id: `${prefix}${i}`,
      kind: 'socket' as const,
      position: [x, 0, z] as [number, number, number],
      direction: [Math.sin(a), 0, Math.cos(a)] as [number, number, number],
      opening: [0, 1, 0] as [number, number, number],
    }
  })
}

/**
 * Clips on the second plate after Rz(-90) slot-in-slot nest.
 * Hub goes to +X; slot stays +Z; local (sin, 0, cos) → (0, −sin, cos).
 */
function clipsAfterYawNeg90(angles: readonly number[], prefix: string): PortDef[] {
  const r = SOCKET_RADIUS
  return angles.map((deg, i) => {
    const a = (deg * Math.PI) / 180
    const y = -Math.sin(a) * r
    const z = Math.cos(a) * r
    return {
      id: `${prefix}${i}`,
      kind: 'socket' as const,
      position: [0, y, z] as [number, number, number],
      direction: [0, -Math.sin(a), Math.cos(a)] as [number, number, number],
      opening: [1, 0, 0] as [number, number, number],
    }
  })
}

/** Center slot/rail — only on slotted connectors that can combine. */
function interlockPort(): PortDef {
  return {
    id: 'interlock',
    kind: 'interlock',
    position: [0, 0, 0],
    direction: [0, 1, 0],
  }
}

function axleSocket(): PortDef {
  return {
    id: 'axle',
    kind: 'socket',
    position: [0, 0, SOCKET_RADIUS],
    direction: [0, 0, 1],
  }
}

function centerSocket(id: string, direction: [number, number, number]): PortDef {
  return {
    id,
    kind: 'socket',
    position: [0, 0, 0],
    direction,
  }
}

function withCenters(ports: PortDef[], variant?: CatalogPiece['variant']): PortDef[] {
  // Pre-assembled 3D hubs have no through-hole — the nested plates fill the center.
  if (variant === 'double-full' || variant === 'full-half' || variant === 'half-half') {
    return ports
  }
  return [...ports, centerSocket('center', [0, 1, 0])]
}

const connectors: CatalogPiece[] = [
  {
    id: 'conn-orange-straight',
    name: 'Straight Connector',
    category: 'connectors',
    description: '180° in-line C-clips. Slides into a slotted connector at 90°.',
    color: '#fd7e14',
    variant: 'plate',
    ports: withCenters([...clipsAroundY([0, 180], 's'), interlockPort()], 'plate'),
  },
  {
    id: 'conn-grey-2',
    name: '2-Way Angle Connector',
    category: 'connectors',
    description:
      'Classic light-grey 2-way — C-clips at 0° and 45°. Flat angle hub; does not combine with other connectors.',
    color: '#ced4da',
    accent: '#868e96',
    variant: 'plate',
    ports: withCenters(clipsAroundY([0, 45], 's'), 'plate'),
  },
  {
    id: 'conn-90',
    name: '90 Connector',
    category: 'connectors',
    description: 'Same-plane clips at 0°, 45°, and 90°. Does not combine with other connectors.',
    color: '#fa5252',
    variant: 'plate',
    ports: withCenters(clipsAroundY([0, 45, 90], 's'), 'plate'),
  },
  {
    id: 'conn-green-4',
    name: '4-Way Connector',
    category: 'connectors',
    description:
      'Classic green flat 4-way — C-clips at 0°, 90°, 180°, and 270° (no diagonals, no 3D slot).',
    color: '#2f9e44',
    variant: 'plate',
    ports: withCenters(clipsAroundY([0, 90, 180, 270], 's'), 'plate'),
  },
  {
    id: 'conn-yellow-5',
    name: '5-Way Connector',
    category: 'connectors',
    description: 'Yellow flat hub with five C-clips. Does not combine with other connectors.',
    color: '#fcc419',
    variant: 'plate',
    ports: withCenters(clipsAroundY([0, 45, 90, 135, 180], 's'), 'plate'),
  },
  {
    id: 'conn-white-8',
    name: '8-Way Connector',
    category: 'connectors',
    description: 'White flat hub — clips every 45°. Does not combine with other connectors.',
    color: '#f8f9fa',
    accent: '#ced4da',
    variant: 'plate',
    ports: withCenters(clipsAroundY([0, 45, 90, 135, 180, 225, 270, 315], 's'), 'plate'),
  },
  {
    id: 'conn-full-slot',
    name: 'Full Slotted Connector',
    category: 'connectors',
    description:
      '7 C-clips plus one 3D slot. Another slotted connector slides in only at that slot.',
    color: '#1c7ed6',
    variant: 'full',
    ports: withCenters([...clipsAroundY(FULL_CLIP_ANGLES, 's'), interlockPort()], 'full'),
  },
  {
    id: 'conn-half-slot',
    name: 'Half Slotted Connector',
    category: 'connectors',
    description:
      '4 C-clips plus one 3D slot on the straight edge. Slides into another slotted connector only at that slot.',
    color: '#adb5bd',
    accent: '#868e96',
    variant: 'half',
    ports: withCenters([...clipsAroundY(HALF_CLIP_ANGLES, 's'), interlockPort()], 'half'),
  },
  {
    id: 'hub-double-full',
    name: 'Double Full',
    category: 'connectors',
    description: 'Two full 3D connectors slid together at the one slot — clips on 2 axes.',
    color: '#1c7ed6',
    variant: 'double-full',
    ports: withCenters(
      [
        ...clipsAroundY(FULL_CLIP_ANGLES, 'a'),
        ...clipsAfterYawNeg90(NESTED_FULL_CLIP_ANGLES, 'b'),
      ],
      'double-full',
    ),
  },
  {
    id: 'hub-full-half',
    name: 'Full/Half Combo',
    category: 'connectors',
    description:
      'Blue 7-way and grey 4-way slid together at the one 3D slot, plates at 90°.',
    color: '#1c7ed6',
    accent: '#adb5bd',
    variant: 'full-half',
    ports: withCenters(
      [
        ...clipsAroundY(FULL_CLIP_ANGLES, 'full'),
        ...clipsAfterYawNeg90(NESTED_HALF_CLIP_ANGLES, 'half'),
      ],
      'full-half',
    ),
  },
  {
    id: 'hub-half-half',
    name: 'Half/Half Combo Connector',
    category: 'connectors',
    description:
      'Two grey 4-way 3D connectors slid together at the one slot — same join as grey-and-blue.',
    color: '#adb5bd',
    accent: '#868e96',
    variant: 'half-half',
    ports: withCenters(
      [
        ...clipsAroundY(HALF_CLIP_ANGLES, 'a'),
        ...clipsAfterYawNeg90(NESTED_HALF_CLIP_ANGLES, 'b'),
      ],
      'half-half',
    ),
  },
]

const wheels: CatalogPiece[] = [
  {
    id: 'wheel-black',
    name: 'Tire Wheel',
    category: 'wheels',
    description: 'Rolling wheel with a center axle socket.',
    color: '#212529',
    accent: '#868e96',
    ports: [axleSocket()],
  },
  {
    id: 'wheel-rim',
    name: 'Spoke Rim',
    category: 'wheels',
    description: 'Lightweight rim for carts and cranes.',
    color: '#ced4da',
    accent: '#495057',
    ports: [axleSocket()],
  },
]

const gears: CatalogPiece[] = [
  {
    id: 'gear-small',
    name: 'Small Gear',
    category: 'gears',
    description: 'Compact drive gear.',
    color: '#ff922b',
    ports: [axleSocket()],
  },
  {
    id: 'gear-large',
    name: 'Large Gear',
    category: 'gears',
    description: 'Wide gear for slow torque.',
    color: '#20c997',
    ports: [axleSocket()],
  },
]

export const CATALOG: CatalogPiece[] = [
  ...ROD_SPECS.map((spec) => {
    const length = rodBodyLength(spec.bodyMm)
    return {
      id: spec.id,
      name: spec.name,
      category: 'rods' as const,
      description: spec.description,
      color: spec.color,
      length,
      ports: [...rodPorts(length), shaftPort()],
    }
  }),
  ...connectors,
  ...wheels,
  ...gears,
]

export const CATEGORY_LABELS: Record<CatalogPiece['category'], string> = {
  rods: 'Rods',
  connectors: 'Connectors',
  wheels: 'Wheels',
  gears: 'Gears',
}

export function getCatalogPiece(id: string): CatalogPiece | undefined {
  return CATALOG.find((p) => p.id === id)
}

/** Two-piece 3D hubs are built by sliding singles together, not picked from the palette. */
export function isPreassembledHub(piece: CatalogPiece): boolean {
  return (
    piece.variant === 'double-full' ||
    piece.variant === 'full-half' ||
    piece.variant === 'half-half'
  )
}
