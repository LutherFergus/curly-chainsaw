import type { CatalogPiece, PortDef } from '../types/knex'

const ROD_RADIUS = 0.08

/** Classic-ish K'NEX rod lengths in scene units (connector pitch ≈ 1). */
const ROD_SPECS = [
  { id: 'rod-gray', name: 'Gray Rod', color: '#9aa3ad', length: 1.0, description: 'Shortest rod — tight links and spacers.' },
  { id: 'rod-green', name: 'Green Rod', color: '#2f9e44', length: 2.0, description: 'Short rod for compact frames.' },
  { id: 'rod-yellow', name: 'Yellow Rod', color: '#f59f00', length: 3.0, description: 'Medium rod for everyday builds.' },
  { id: 'rod-red', name: 'Red Rod', color: '#e03131', length: 4.5, description: 'Long rod for spans and towers.' },
  { id: 'rod-blue', name: 'Blue Rod', color: '#1c7ed6', length: 6.5, description: 'Extra-long rod for big structures.' },
  { id: 'rod-white', name: 'White Rod', color: '#f8f9fa', length: 8.5, description: 'Longest standard rod.' },
] as const

function rodPorts(length: number): PortDef[] {
  const half = length / 2
  return [
    { id: 'end-a', kind: 'rod-end', position: [0, 0, -half], direction: [0, 0, -1] },
    { id: 'end-b', kind: 'rod-end', position: [0, 0, half], direction: [0, 0, 1] },
  ]
}

function socket(id: string, angleDeg: number, elevationDeg = 0): PortDef {
  const yaw = (angleDeg * Math.PI) / 180
  const pitch = (elevationDeg * Math.PI) / 180
  const r = 0.28
  const x = Math.sin(yaw) * Math.cos(pitch) * r
  const y = Math.sin(pitch) * r
  const z = Math.cos(yaw) * Math.cos(pitch) * r
  const dx = Math.sin(yaw) * Math.cos(pitch)
  const dy = Math.sin(pitch)
  const dz = Math.cos(yaw) * Math.cos(pitch)
  return {
    id,
    kind: 'socket',
    position: [x, y, z],
    direction: [dx, dy, dz],
  }
}

const connectors: CatalogPiece[] = [
  {
    id: 'conn-orange-straight',
    name: 'Straight Connector',
    category: 'connectors',
    description: '180° in-line joint.',
    color: '#fd7e14',
    ports: [socket('s0', 0), socket('s1', 180)],
  },
  {
    id: 'conn-red-right',
    name: 'Right-Angle Connector',
    category: 'connectors',
    description: 'Classic 90° elbow.',
    color: '#fa5252',
    ports: [socket('s0', 0), socket('s1', 90)],
  },
  {
    id: 'conn-yellow-3way',
    name: '3-Way Flat Connector',
    category: 'connectors',
    description: 'Planar T-joint at 90° increments.',
    color: '#fcc419',
    ports: [socket('s0', 0), socket('s1', 90), socket('s2', 180)],
  },
  {
    id: 'conn-green-4way',
    name: '4-Way Flat Connector',
    category: 'connectors',
    description: 'Plus-shaped planar hub.',
    color: '#51cf66',
    ports: [socket('s0', 0), socket('s1', 90), socket('s2', 180), socket('s3', 270)],
  },
  {
    id: 'conn-purple-5way',
    name: '5-Way Hub',
    category: 'connectors',
    description: 'Flat hub with five sockets.',
    color: '#9775fa',
    ports: [0, 72, 144, 216, 288].map((a, i) => socket(`s${i}`, a)),
  },
  {
    id: 'conn-blue-8way',
    name: '8-Way Hub',
    category: 'connectors',
    description: 'Dense planar hub every 45°.',
    color: '#339af0',
    ports: [0, 45, 90, 135, 180, 225, 270, 315].map((a, i) => socket(`s${i}`, a)),
  },
  {
    id: 'conn-gray-3d',
    name: '3D Corner Connector',
    category: 'connectors',
    description: 'Three mutually perpendicular sockets.',
    color: '#868e96',
    ports: [
      socket('sx', 90, 0),
      socket('sy', 0, 90),
      socket('sz', 0, 0),
    ],
  },
  {
    id: 'conn-white-ball',
    name: 'Ball Connector',
    category: 'connectors',
    description: 'Spherical hub with six cardinal sockets.',
    color: '#e9ecef',
    accent: '#adb5bd',
    ports: [
      socket('px', 90, 0),
      socket('nx', 270, 0),
      socket('py', 0, 90),
      socket('ny', 0, -90),
      socket('pz', 0, 0),
      socket('nz', 180, 0),
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
    ports: [socket('axle', 0)],
  },
  {
    id: 'wheel-rim',
    name: 'Spoke Rim',
    category: 'wheels',
    description: 'Lightweight rim for carts and cranes.',
    color: '#ced4da',
    accent: '#495057',
    ports: [socket('axle', 0)],
  },
]

const gears: CatalogPiece[] = [
  {
    id: 'gear-small',
    name: 'Small Gear',
    category: 'gears',
    description: 'Compact drive gear.',
    color: '#ff922b',
    ports: [socket('axle', 0)],
  },
  {
    id: 'gear-large',
    name: 'Large Gear',
    category: 'gears',
    description: 'Wide gear for slow torque.',
    color: '#20c997',
    ports: [socket('axle', 0)],
  },
]

export const ROD_RADIUS_SCENE = ROD_RADIUS

export const CATALOG: CatalogPiece[] = [
  ...ROD_SPECS.map((spec) => ({
    id: spec.id,
    name: spec.name,
    category: 'rods' as const,
    description: spec.description,
    color: spec.color,
    length: spec.length,
    ports: rodPorts(spec.length),
  })),
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
