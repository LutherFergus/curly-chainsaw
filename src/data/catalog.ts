import type { CatalogPiece, PortDef } from '../types/knex'

const ROD_RADIUS = 0.08

/** Hub center → clip grip distance. */
export const SOCKET_RADIUS = 0.28
export const ROD_RADIUS_SCENE = ROD_RADIUS
/** Plate thickness (= hub diameter) so 90° interlock flats share a cube. */
export const HUB_RADIUS = 0.11
export const HUB_HEIGHT = HUB_RADIUS * 2

/** Classic K'NEX rod lengths: center-to-center effective length uses √2 progression (green = 1). */
const SQRT2 = Math.SQRT2
const ROD_SPECS = [
  {
    id: 'rod-green',
    name: 'Green Rod',
    color: '#2f9e44',
    effective: 1,
    description: 'Classic #1 rod — shortest standard length.',
  },
  {
    id: 'rod-white',
    name: 'White Rod',
    color: '#f1f3f5',
    effective: SQRT2,
    description: 'Classic #2 rod (√2 × green).',
  },
  {
    id: 'rod-blue',
    name: 'Blue Rod',
    color: '#1c7ed6',
    effective: 2,
    description: 'Classic #3 rod (2 × green).',
  },
  {
    id: 'rod-yellow',
    name: 'Yellow Rod',
    color: '#f59f00',
    effective: 2 * SQRT2,
    description: 'Classic #4 rod (2√2 × green).',
  },
  {
    id: 'rod-red',
    name: 'Red Rod',
    color: '#e03131',
    effective: 4,
    description: 'Classic #5 rod (4 × green).',
  },
  {
    id: 'rod-gray',
    name: 'Gray Rod',
    color: '#868e96',
    effective: 4 * SQRT2,
    description: 'Classic #6 rod — longest standard length.',
  },
] as const

/** Physical body length so end-to-end snap yields classic effective span. */
function rodBodyLength(effective: number): number {
  return Math.max(0.35, 2 * (effective - SOCKET_RADIUS))
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
  if (
    variant === 'double-full' ||
    variant === 'full-half' ||
    variant === 'half-half'
  ) {
    return [...ports, centerSocket('center-y', [0, 1, 0]), centerSocket('center-x', [1, 0, 0])]
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
    id: 'conn-90',
    name: '90 Connector',
    category: 'connectors',
    description: 'Same-plane clips at 0°, 45°, and 90°. Does not combine with other connectors.',
    color: '#fa5252',
    variant: 'plate',
    ports: withCenters(clipsAroundY([0, 45, 90], 's'), 'plate'),
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
    const length = rodBodyLength(spec.effective)
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
