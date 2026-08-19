import type { CatalogPiece, PortDef } from '../types/knex'

const ROD_RADIUS = 0.08

/** Hub center → clip grip distance. */
export const SOCKET_RADIUS = 0.28
export const ROD_RADIUS_SCENE = ROD_RADIUS

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

/** Full slotted plate: 7 C-clips; 8th position is the interlock notch. */
export const FULL_CLIP_ANGLES = [0, 45, 90, 135, 180, 225, 270] as const
/** Half slotted plate: 5 C-clips along a 180° arc. */
export const HALF_CLIP_ANGLES = [0, 45, 90, 135, 180] as const

function rodPorts(length: number): PortDef[] {
  const half = length / 2
  return [
    { id: 'end-a', kind: 'rod-end', position: [0, 0, -half], direction: [0, 0, -1] },
    { id: 'end-b', kind: 'rod-end', position: [0, 0, half], direction: [0, 0, 1] },
  ]
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
    }
  })
}

/** Clips around hub axis Z (second plate after a 90° slide join). */
function clipsAroundZ(angles: readonly number[], prefix: string): PortDef[] {
  const r = SOCKET_RADIUS
  return angles.map((deg, i) => {
    const a = (deg * Math.PI) / 180
    const x = Math.sin(a) * r
    const y = Math.cos(a) * r
    return {
      id: `${prefix}${i}`,
      kind: 'socket' as const,
      position: [x, y, 0] as [number, number, number],
      direction: [Math.sin(a), Math.cos(a), 0] as [number, number, number],
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

const connectors: CatalogPiece[] = [
  {
    id: 'conn-orange-straight',
    name: 'Straight Connector',
    category: 'connectors',
    description: '180° in-line C-clips. Does not combine with other connectors.',
    color: '#fd7e14',
    variant: 'plate',
    ports: clipsAroundY([0, 180], 's'),
  },
  {
    id: 'conn-90',
    name: '90 Connector',
    category: 'connectors',
    description: 'Same-plane clips at 0°, 45°, and 90°. Does not combine with other connectors.',
    color: '#fa5252',
    variant: 'plate',
    ports: clipsAroundY([0, 45, 90], 's'),
  },
  {
    id: 'conn-yellow-5',
    name: '5-Way Connector',
    category: 'connectors',
    description: 'Yellow flat hub with five C-clips. Does not combine with other connectors.',
    color: '#fcc419',
    variant: 'plate',
    ports: clipsAroundY([0, 45, 90, 135, 180], 's'),
  },
  {
    id: 'conn-white-8',
    name: '8-Way Connector',
    category: 'connectors',
    description: 'White flat hub — clips every 45°. Does not combine with other connectors.',
    color: '#f8f9fa',
    accent: '#ced4da',
    variant: 'plate',
    ports: clipsAroundY([0, 45, 90, 135, 180, 225, 270, 315], 's'),
  },
  {
    id: 'conn-full-slot',
    name: 'Full Slotted Connector',
    category: 'connectors',
    description:
      '7 C-clips plus a center notch. Combines with other slotted connectors for 3D hubs.',
    color: '#1c7ed6',
    variant: 'full',
    ports: [...clipsAroundY(FULL_CLIP_ANGLES, 's'), interlockPort()],
  },
  {
    id: 'conn-half-slot',
    name: 'Half Slotted Connector',
    category: 'connectors',
    description:
      '5 C-clips on a half-circle with a rail. Combines with other slotted connectors for 3D hubs.',
    color: '#adb5bd',
    accent: '#868e96',
    variant: 'half',
    ports: [...clipsAroundY(HALF_CLIP_ANGLES, 's'), interlockPort()],
  },
  {
    id: 'hub-double-full',
    name: 'Double Full',
    category: 'connectors',
    description: 'Two full slotted connectors slid together — clip options on 2 axes.',
    color: '#1c7ed6',
    variant: 'double-full',
    ports: [
      ...clipsAroundY([0, 45, 90, 135, 180, 225, 270, 315], 'a'),
      ...clipsAroundZ([0, 45, 90, 135, 180, 225, 270, 315], 'b'),
    ],
  },
  {
    id: 'hub-full-half',
    name: 'Full/Half Combo',
    category: 'connectors',
    description: 'Full slotted + half slotted joined — 8 options on one axis, 5 on the other.',
    color: '#1c7ed6',
    accent: '#adb5bd',
    variant: 'full-half',
    ports: [
      ...clipsAroundY([0, 45, 90, 135, 180, 225, 270, 315], 'full'),
      ...clipsAroundZ(HALF_CLIP_ANGLES, 'half'),
    ],
  },
  {
    id: 'hub-half-half',
    name: 'Half/Half Combo Connector',
    category: 'connectors',
    description:
      'Two half slotted connectors slid together — 5 options on each of 2 axes, open as a corner.',
    color: '#adb5bd',
    accent: '#868e96',
    variant: 'half-half',
    ports: [
      ...clipsAroundY(HALF_CLIP_ANGLES, 'a'),
      ...clipsAroundZ(HALF_CLIP_ANGLES, 'b'),
    ],
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
      ports: rodPorts(length),
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
