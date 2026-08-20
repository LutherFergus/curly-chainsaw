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
 * Solid rod-end clip pin (C-clip faces +Z, pin faces −Z).
 * Neck fills through the origin so the C-jaws and grooved pin are one piece.
 * Tip stack matches a rod end: shaft → groove → bulbous head.
 */
export const ROD_END_CLIP_NECK_EXTENT = SOCKET_RADIUS * 0.12
export const ROD_END_CLIP_SHAFT_LEN = mm(6.5)
export const ROD_END_CLIP_GROOVE_LEN = mm(1.6)
export const ROD_END_CLIP_HEAD_LEN = mm(3.2)
export const ROD_END_CLIP_PIN_TIP =
  ROD_END_CLIP_NECK_EXTENT +
  ROD_END_CLIP_SHAFT_LEN +
  ROD_END_CLIP_GROOVE_LEN +
  ROD_END_CLIP_HEAD_LEN

/**
 * Classic “blue spacer” unit. Green hub-to-hub (37.5 mm) is 12 units (MIT).
 * Shop listings that say “0.31 mm” for blue / “0.93 mm” for silver are typos;
 * silver is three blue spacers wide.
 */
export const BLUE_SPACER_MM = 37.5 / 12
export const SILVER_SPACER_MM = BLUE_SPACER_MM * 3
export const BLUE_SPACER = mm(BLUE_SPACER_MM)
export const SILVER_SPACER = mm(SILVER_SPACER_MM)
/** Spacer outer radius — sits on the rod, clear of clip arms. */
export const SPACER_OUTER_RADIUS = mm(11.5)

/** Gear / wheel sizes from User Group + MIT spacer units. */
export const GEAR_SMALL_OD_MM = BLUE_SPACER_MM * 8 // ~25 mm (14 teeth)
export const GEAR_MEDIUM_OD_MM = 55
export const GEAR_LARGE_OD_MM = 130
export const GEAR_SMALL_THICK_MM = BLUE_SPACER_MM * 4
export const GEAR_MEDIUM_THICK_MM = BLUE_SPACER_MM * 4
export const GEAR_LARGE_THICK_MM = BLUE_SPACER_MM * 3

/** Tooth depth used by the spur mesh and by mesh-center spacing. */
export function gearToothDepth(radius: number, teeth: number): number {
  const n = Math.max(6, Math.floor(teeth))
  return Math.max(
    radius * 0.055,
    Math.min(radius * 0.28, ((2 * Math.PI * radius) / n) * 0.72),
  )
}

/** Ideal center distance for two spur gears meshing teeth-to-teeth. */
export function gearMeshCenterDistance(a: CatalogPiece, b: CatalogPiece): number {
  const rA = a.radius ?? 0
  const rB = b.radius ?? 0
  const dA = gearToothDepth(rA, a.teeth ?? 14)
  const dB = gearToothDepth(rB, b.teeth ?? 14)
  return rA + rB - (dA + dB) * 0.5
}

/** How far from ideal mesh distance still counts as joined (scene units). */
export const GEAR_MESH_TOLERANCE = 0.14
/**
 * Classic K’NEX wheel / hub / tire family (visual CAD envelopes).
 * Axle: Classic 6.35 mm rod with free-spin clearance in the hub bore.
 */
export const WHEEL_THIN_OD_MM = 25
export const HUB_SMALL_OD_MM = 37
export const HUB_MEDIUM_OD_MM = 50
export const TIRE_SMALL_OD_MM = 47
export const TIRE_MEDIUM_OD_MM = 65
export const TIRE_LARGE_OD_MM = 92
export const TIRE_NARROW_OD_MM = 60
/** Default hub/pulley axial thickness (approx). */
export const WHEEL_THICK_MM = BLUE_SPACER_MM * 4
export const WHEEL_NARROW_WIDTH_MM = 12
export const WHEEL_LARGE_WIDTH_MM = 15
/** @deprecated Use WHEEL_THIN_OD_MM */
export const WHEEL_25_OD_MM = WHEEL_THIN_OD_MM
/** @deprecated Use HUB_MEDIUM_OD_MM */
export const WHEEL_50_OD_MM = HUB_MEDIUM_OD_MM

/**
 * Classic motor housing envelopes (visual CAD — not mold tooling).
 * Drive axis is local +Z; side connector lugs sit on the ±Z faces.
 */
export const MOTOR_ENCLOSED_LEN_MM = 78
export const MOTOR_ENCLOSED_WID_MM = 42
export const MOTOR_ENCLOSED_HGT_MM = 54
export const MOTOR_2SPEED_LEN_MM = 95
export const MOTOR_2SPEED_WID_MM = 52
export const MOTOR_2SPEED_HGT_MM = 62
export const MOTOR_12V_LEN_MM = 70
export const MOTOR_12V_WID_MM = 48
export const MOTOR_12V_HGT_MM = 40
export const MOTOR_SPRING_LEN_MM = 55
export const MOTOR_SPRING_WID_MM = 40
export const MOTOR_SPRING_HGT_MM = 40
/** 12 V DC barrel plug (adapter side), for reference only. */
export const MOTOR_12V_BARREL_OD_MM = 5.5
export const MOTOR_12V_BARREL_ID_MM = 2.1
export const MOTOR_12V_BARREL_MIN_LEN_MM = 10
/** Worm pitch radius used for gear mesh spacing (approx). */
export const MOTOR_WORM_PITCH_R_MM = 8

/** Panels: small body 64×64 mm (shop); large ~5.5 in / 140 mm (patent). */
export const PANEL_THICK_MM = 2.5
export const PANEL_SIDE_MM = {
  mini: 45,
  small: 64,
  medium: 91,
  large: 140,
} as const

/** Hole-end clip: same C-clip jaws; hinge hole matches rod Ø. */
export const HOLE_CLIP_HOLE_ID = mm(6.35)
export const HOLE_CLIP_HOLE_OD = mm(12.5)
export const HOLE_CLIP_SPAN = mm(18)

/** Chain link pitch (part names: 20 mm small / 32 mm large). */
export const CHAIN_SMALL_MM = 20
export const CHAIN_LARGE_MM = 32

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
    position: [0, 0, 0],
    direction: [0, 0, 1],
  }
}

/** Torque-drive through-hole — same socket kind, tagged id for driven vs passive. */
function drivenRodThrough(z = 0): PortDef {
  return {
    id: 'drive',
    kind: 'socket',
    position: [0, 0, z],
    direction: [0, 0, 1],
  }
}

/** End-insert driven output (tethered motor). */
function drivenRodEnd(z: number): PortDef {
  return {
    id: 'drive-end',
    kind: 'socket',
    position: [0, 0, z],
    direction: [0, 0, 1],
  }
}

/** Passive structural rod hole (no torque). */
function passiveRodThrough(id: string, position: [number, number, number], direction: [number, number, number]): PortDef {
  return { id, kind: 'socket', position, direction }
}

/** Housing lug that seats a Classic connector (typically white 8-way). */
function connectorLug(id: string, z: number, sign: 1 | -1): PortDef {
  return {
    id,
    kind: 'connector-lug',
    position: [0, 0, z],
    direction: [0, 0, sign],
  }
}

/** Rim mate — another gear’s teeth can join here (multi-partner). */
function gearMeshPort(): PortDef {
  return {
    id: 'mesh',
    kind: 'gear-mesh',
    position: [0, 0, 0],
    direction: [1, 0, 0],
  }
}

/** External worm on 12 V motor — meshes with a Classic gear. */
function wormMeshPort(x: number): PortDef {
  return {
    id: 'worm',
    kind: 'gear-mesh',
    position: [x, 0, 0],
    direction: [1, 0, 0],
  }
}

function sleeveBore(): PortDef {
  return {
    id: 'bore',
    kind: 'socket',
    position: [0, 0, 0],
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

/** Single C-clip at 0° (+Z), same jaws as a hub clip. */
function singleClipPorts(): PortDef[] {
  return clipsAroundY([0], 's')
}

function holeClipPorts(): PortDef[] {
  // Clip grabs a rod; hinge hole axis is Y (through the purple ring).
  return [
    ...singleClipPorts(),
    {
      id: 'hole',
      kind: 'socket',
      position: [0, 0, -HOLE_CLIP_SPAN * 0.35],
      direction: [0, 1, 0],
    },
  ]
}

function rodEndClipPorts(): PortDef[] {
  return [
    ...singleClipPorts(),
    {
      id: 'stub',
      kind: 'rod-end',
      position: [0, 0, -ROD_END_CLIP_PIN_TIP],
      direction: [0, 0, -1],
    },
  ]
}

function panelSquarePorts(side: number): PortDef[] {
  // Tips sit on corners along the diagonals (an “X”), centered halfway on each vertex.
  const half = side / 2
  const tipLen = SOCKET_RADIUS * 0.85
  const corners: [number, number][] = [
    [1, 1],
    [1, -1],
    [-1, -1],
    [-1, 1],
  ]
  return corners.map(([sx, sz], i) => {
    const inv = 1 / Math.SQRT2
    const dx = sx * inv
    const dz = sz * inv
    return {
      id: `tip-${i}`,
      kind: 'rod-end' as const,
      position: [sx * half + dx * (tipLen / 2), 0, sz * half + dz * (tipLen / 2)],
      direction: [dx, 0, dz],
    }
  })
}

function panelTriPorts(leg: number): PortDef[] {
  // Match PanelMesh extrusion after rotateX(-π/2): (0,-half), (±half,+half).
  const half = leg / 2
  const tipLen = SOCKET_RADIUS * 0.85
  const verts: [number, number][] = [
    [0, -half],
    [half, half],
    [-half, half],
  ]
  const centroidZ = half / 3
  return verts.map(([vx, vz], i) => {
    let dx = vx
    let dz = vz - centroidZ
    const len = Math.hypot(dx, dz) || 1
    dx /= len
    dz /= len
    return {
      id: `tip-${i}`,
      kind: 'rod-end' as const,
      position: [vx + dx * (tipLen / 2), 0, vz + dz * (tipLen / 2)],
      direction: [dx, 0, dz],
    }
  })
}

function chainPorts(length: number): PortDef[] {
  const half = length / 2
  return [
    { id: 'end-a', kind: 'rod-end', position: [0, 0, -half], direction: [0, 0, -1] },
    { id: 'end-b', kind: 'socket', position: [0, 0, half], direction: [0, 0, 1] },
  ]
}

const connectors: CatalogPiece[] = [
  {
    id: 'conn-orange-straight',
    name: 'Straight Connector',
    category: 'connectors',
    description: '180° in-line C-clips. Does not combine with other connectors.',
    color: '#fd7e14',
    variant: 'plate',
    ports: withCenters(clipsAroundY([0, 180], 's'), 'plate'),
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

const clips: CatalogPiece[] = [
  {
    id: 'clip-hole',
    name: '1-Way Hole Clip',
    category: 'clips',
    description:
      'Purple 1-way C-clip with a free hinge hole (rod Ø). Clip onto a rod; pass another rod through the hole.',
    color: '#9c36b5',
    accent: '#be4bdb',
    variant: 'hole-clip',
    thickness: HUB_HEIGHT,
    radius: HOLE_CLIP_HOLE_OD / 2,
    ports: holeClipPorts(),
  },
  {
    id: 'clip-lock',
    name: 'Interlocking Clip',
    category: 'clips',
    description:
      'Tan lock clip — grips a rod shaft to fix a wheel or gear, or seats on a rod end as a retainer.',
    color: '#e7c6a0',
    accent: '#c9925a',
    variant: 'lock-clip',
    thickness: HUB_HEIGHT * 0.9,
    ports: singleClipPorts(),
  },
  {
    id: 'clip-rod-end',
    name: 'Rod-End Clip',
    category: 'clips',
    description:
      'One solid piece: C-clip onto a rod shaft, pin into a connector socket. Spins on the rod and in the clip.',
    color: '#212529',
    accent: '#495057',
    variant: 'rod-end-clip',
    ports: rodEndClipPorts(),
  },
  {
    id: 'clip-hinge',
    name: 'Hinge',
    category: 'clips',
    description: 'Assembled two-part hinge — each side clips onto a rod for a pivoted joint.',
    color: '#228be6',
    accent: '#212529',
    variant: 'hinge',
    ports: [
      {
        id: 's0',
        kind: 'socket',
        position: [0, 0, SOCKET_RADIUS],
        direction: [0, 0, 1],
        opening: [0, 1, 0],
      },
      {
        id: 's1',
        kind: 'socket',
        position: [0, 0, -SOCKET_RADIUS],
        direction: [0, 0, -1],
        opening: [0, 1, 0],
      },
    ],
  },
  {
    id: 'clip-ball',
    name: 'Ball-End Clip',
    category: 'clips',
    description: 'C-clip with a ball end — mates with a socket-end clip for a free 3D joint.',
    color: '#868e96',
    accent: '#ced4da',
    variant: 'ball-clip',
    radius: mm(5.5),
    ports: [
      ...singleClipPorts(),
      {
        id: 'ball',
        kind: 'rod-end',
        position: [0, 0, -SOCKET_RADIUS - mm(8)],
        direction: [0, 0, -1],
      },
    ],
  },
  {
    id: 'clip-socket-end',
    name: 'Socket-End Clip',
    category: 'clips',
    description: 'C-clip with a cup that receives a ball-end clip.',
    color: '#868e96',
    accent: '#495057',
    variant: 'socket-clip',
    radius: mm(6),
    ports: [
      ...singleClipPorts(),
      {
        id: 'cup',
        kind: 'socket',
        position: [0, 0, -SOCKET_RADIUS - mm(6)],
        direction: [0, 0, -1],
      },
    ],
  },
  {
    id: 'clip-end-cap',
    name: 'End Cap',
    category: 'clips',
    description: 'Black end / snap cap — finishes a free rod tip or keeps a wheel from sliding off.',
    color: '#212529',
    variant: 'end-cap',
    thickness: mm(4),
    radius: mm(8.2) / 2,
    ports: [
      {
        id: 'cap',
        kind: 'socket',
        position: [0, 0, 0],
        direction: [0, 0, 1],
      },
    ],
  },
]

const spacers: CatalogPiece[] = [
  {
    id: 'spacer-blue',
    name: 'Blue Spacer',
    category: 'spacers',
    description: `Thin axle spacer (${BLUE_SPACER_MM.toFixed(2)} mm) — one Classic blue-spacer unit. Goes on a rod shaft and slides like a connector through-hole.`,
    color: '#1c7ed6',
    accent: '#4dabf7',
    variant: 'sleeve',
    thickness: BLUE_SPACER,
    radius: SPACER_OUTER_RADIUS,
    ports: [sleeveBore()],
  },
  {
    id: 'spacer-silver',
    name: 'Silver Spacer',
    category: 'spacers',
    description: `Wide axle spacer (${SILVER_SPACER_MM.toFixed(2)} mm) — three blue spacers thick. Goes on a rod shaft and slides like a connector through-hole.`,
    color: '#adb5bd',
    accent: '#e9ecef',
    variant: 'sleeve',
    thickness: SILVER_SPACER,
    radius: SPACER_OUTER_RADIUS,
    ports: [sleeveBore()],
  },
]

const wheels: CatalogPiece[] = [
  {
    id: 'wheel-25',
    name: 'Thin Wheel / Pulley',
    category: 'wheels',
    description:
      'Black thin wheel/pulley (~25 mm OD). Smaller than the 37 mm small hub; free-spin on a Classic rod.',
    color: '#212529',
    accent: '#495057',
    variant: 'wheel-thin',
    radius: mm(WHEEL_THIN_OD_MM) / 2,
    thickness: mm(WHEEL_THICK_MM * 0.55),
    ports: [axleSocket()],
  },
  {
    id: 'wheel-hub-small',
    name: 'Small Hub / Pulley',
    category: 'wheels',
    description:
      '37 mm silver hub/pulley (90978). Free-spin on Classic rod; rim retains the small tire or works as a pulley.',
    color: '#ced4da',
    accent: '#868e96',
    variant: 'wheel-pulley',
    radius: mm(HUB_SMALL_OD_MM) / 2,
    thickness: mm(WHEEL_THICK_MM),
    ports: [axleSocket()],
  },
  {
    id: 'wheel-spoke-small',
    name: 'Small Spoked Wheel',
    category: 'wheels',
    description:
      '37 mm six-spoke wheel (91978). Alternative to the solid small hub; takes the small tire (~47 mm finished).',
    color: '#adb5bd',
    accent: '#495057',
    variant: 'wheel-spoke',
    spokes: 6,
    radius: mm(HUB_SMALL_OD_MM) / 2,
    thickness: mm(WHEEL_THICK_MM),
    ports: [axleSocket()],
  },
  {
    id: 'wheel-race-small',
    name: 'Small Racing Hub',
    category: 'wheels',
    description:
      '37 mm racing hub (91170/91174). Vehicle hub — different rim from the 90978 pulley; free-spin on Classic rod.',
    color: '#868e96',
    accent: '#343a40',
    variant: 'wheel-race',
    radius: mm(HUB_SMALL_OD_MM) / 2,
    thickness: mm(WHEEL_THICK_MM),
    ports: [axleSocket()],
  },
  {
    id: 'wheel-small',
    name: 'Small Tire Wheel',
    category: 'wheels',
    description: `37 mm hub with small tire 91975 (~${TIRE_SMALL_OD_MM} mm finished OD).`,
    color: '#212529',
    accent: '#ced4da',
    variant: 'wheel-tire',
    hubRadius: mm(HUB_SMALL_OD_MM) / 2,
    radius: mm(TIRE_SMALL_OD_MM) / 2,
    thickness: mm(WHEEL_THICK_MM),
    ports: [axleSocket()],
  },
  {
    id: 'wheel-hub-50',
    name: 'Medium Hub / Pulley',
    category: 'wheels',
    description:
      '50 mm silver hub/pulley (90979). Free-spin; takes medium (~65 mm) or large (~92 mm) tires.',
    color: '#ced4da',
    accent: '#868e96',
    variant: 'wheel-pulley',
    radius: mm(HUB_MEDIUM_OD_MM) / 2,
    thickness: mm(WHEEL_THICK_MM),
    ports: [axleSocket()],
  },
  {
    id: 'wheel-race-medium',
    name: 'Medium Racing Hub',
    category: 'wheels',
    description:
      '50 mm racing hub (91184). Different rim/tire interface from the 90979 pulley hub.',
    color: '#868e96',
    accent: '#343a40',
    variant: 'wheel-race',
    radius: mm(HUB_MEDIUM_OD_MM) / 2,
    thickness: mm(WHEEL_THICK_MM),
    ports: [axleSocket()],
  },
  {
    id: 'wheel-narrow-hub',
    name: 'Narrow Racing Hub',
    category: 'wheels',
    description:
      '50 mm narrow racing hub (91254). Pair with 91240 narrow tire, or two hubs in a wider 50 mm racing tire.',
    color: '#868e96',
    accent: '#495057',
    variant: 'wheel-narrow',
    radius: mm(HUB_MEDIUM_OD_MM) / 2,
    thickness: mm(WHEEL_NARROW_WIDTH_MM * 0.55),
    ports: [axleSocket()],
  },
  {
    id: 'wheel-tire',
    name: 'Medium Tire Wheel',
    category: 'wheels',
    description: `50 mm hub with medium tire 91976 (~${TIRE_MEDIUM_OD_MM} mm finished OD).`,
    color: '#212529',
    accent: '#ced4da',
    variant: 'wheel-tire',
    hubRadius: mm(HUB_MEDIUM_OD_MM) / 2,
    radius: mm(TIRE_MEDIUM_OD_MM) / 2,
    thickness: mm(WHEEL_THICK_MM),
    ports: [axleSocket()],
  },
  {
    id: 'wheel-narrow',
    name: 'Narrow Tire Wheel',
    category: 'wheels',
    description: `Narrow hub + 91240 tire (~${TIRE_NARROW_OD_MM} mm OD, ~${WHEEL_NARROW_WIDTH_MM} mm wide).`,
    color: '#212529',
    accent: '#868e96',
    variant: 'wheel-tire',
    hubRadius: mm(HUB_MEDIUM_OD_MM) / 2,
    radius: mm(TIRE_NARROW_OD_MM) / 2,
    thickness: mm(WHEEL_NARROW_WIDTH_MM),
    ports: [axleSocket()],
  },
  {
    id: 'wheel-large',
    name: 'Large Tire Wheel',
    category: 'wheels',
    description: `50 mm hub with large tire 91977 (~${TIRE_LARGE_OD_MM} mm OD, ~${WHEEL_LARGE_WIDTH_MM} mm wide).`,
    color: '#212529',
    accent: '#ced4da',
    variant: 'wheel-tire',
    hubRadius: mm(HUB_MEDIUM_OD_MM) / 2,
    radius: mm(TIRE_LARGE_OD_MM) / 2,
    thickness: mm(WHEEL_LARGE_WIDTH_MM),
    ports: [axleSocket()],
  },
]

const gears: CatalogPiece[] = [
  {
    id: 'gear-small',
    name: 'Small Gear',
    category: 'gears',
    description: '14-tooth small gear (~25 mm). Blue style needs a tan lock clip on the shaft.',
    color: '#1c7ed6',
    accent: '#4dabf7',
    teeth: 14,
    radius: mm(GEAR_SMALL_OD_MM) / 2,
    thickness: mm(GEAR_SMALL_THICK_MM),
    ports: [axleSocket(), gearMeshPort()],
  },
  {
    id: 'gear-medium',
    name: 'Medium Gear',
    category: 'gears',
    description: '34-tooth medium red gear — ~55 mm diameter.',
    color: '#e03131',
    accent: '#ff6b6b',
    teeth: 34,
    radius: mm(GEAR_MEDIUM_OD_MM) / 2,
    thickness: mm(GEAR_MEDIUM_THICK_MM),
    ports: [axleSocket(), gearMeshPort()],
  },
  {
    id: 'gear-crown',
    name: 'Crown Gear Medium',
    category: 'gears',
    description: '34-tooth medium crown gear (~55 mm) — meshes parallel or at right angles.',
    color: '#fcc419',
    accent: '#ffe066',
    teeth: 34,
    radius: mm(GEAR_MEDIUM_OD_MM) / 2,
    thickness: mm(GEAR_MEDIUM_THICK_MM),
    ports: [axleSocket(), gearMeshPort()],
  },
  {
    id: 'gear-large',
    name: 'Large Crown Gear',
    category: 'gears',
    description: '82-tooth large crown gear — ~130 mm diameter.',
    color: '#fcc419',
    accent: '#868e96',
    teeth: 82,
    radius: mm(GEAR_LARGE_OD_MM) / 2,
    thickness: mm(GEAR_LARGE_THICK_MM),
    ports: [axleSocket(), gearMeshPort()],
  },
]

function motorBox(
  lenMm: number,
  widMm: number,
  hgtMm: number,
): { thickness: number; radius: number; boxSize: [number, number, number] } {
  const thickness = mm(lenMm)
  const boxSize: [number, number, number] = [mm(widMm), mm(hgtMm), thickness]
  const radius = Math.hypot(mm(widMm), mm(hgtMm)) / 2
  return { thickness, radius, boxSize }
}

function enclosedMotorPorts(lenMm: number): PortDef[] {
  const half = mm(lenMm) / 2
  return [
    drivenRodThrough(0),
    connectorLug('lug-a', half, 1),
    connectorLug('lug-b', -half, -1),
  ]
}

const motors: CatalogPiece[] = [
  {
    id: 'motor-black-22',
    name: 'Battery Motor 22 RPM',
    category: 'motors',
    description:
      'Enclosed Classic 3 V motor (2×AA). Forward/Off/Reverse. Black ≈22 RPM. Driven rod through center; white 8-way on side lugs.',
    color: '#212529',
    accent: '#495057',
    variant: 'motor-enclosed',
    motorVolts: 3,
    motorRpm: 22,
    ...motorBox(MOTOR_ENCLOSED_LEN_MM, MOTOR_ENCLOSED_WID_MM, MOTOR_ENCLOSED_HGT_MM),
    ports: enclosedMotorPorts(MOTOR_ENCLOSED_LEN_MM),
  },
  {
    id: 'motor-blue-34',
    name: 'Battery Motor 34 RPM',
    category: 'motors',
    description:
      'Enclosed Classic 3 V motor (2×AA). Forward/Off/Reverse. Blue ≈34 RPM. Driven rod through center; white 8-way on side lugs.',
    color: '#1c7ed6',
    accent: '#4dabf7',
    variant: 'motor-enclosed',
    motorVolts: 3,
    motorRpm: 34,
    ...motorBox(MOTOR_ENCLOSED_LEN_MM, MOTOR_ENCLOSED_WID_MM, MOTOR_ENCLOSED_HGT_MM),
    ports: enclosedMotorPorts(MOTOR_ENCLOSED_LEN_MM),
  },
  {
    id: 'motor-green-45',
    name: 'Battery Motor 45 RPM',
    category: 'motors',
    description:
      'Enclosed Classic 3 V motor (2×AA). Forward/Off/Reverse. Green ≈45 RPM. Driven rod through center; white 8-way on side lugs.',
    color: '#2f9e44',
    accent: '#51cf66',
    variant: 'motor-enclosed',
    motorVolts: 3,
    motorRpm: 45,
    ...motorBox(MOTOR_ENCLOSED_LEN_MM, MOTOR_ENCLOSED_WID_MM, MOTOR_ENCLOSED_HGT_MM),
    ports: enclosedMotorPorts(MOTOR_ENCLOSED_LEN_MM),
  },
  {
    id: 'motor-red-190',
    name: 'Battery Motor 190 RPM',
    category: 'motors',
    description:
      'Enclosed Classic 3 V motor (2×AA). Forward/Off/Reverse. Red ≈190 RPM. Driven rod through center; white 8-way on side lugs.',
    color: '#e03131',
    accent: '#ff6b6b',
    variant: 'motor-enclosed',
    motorVolts: 3,
    motorRpm: 190,
    ...motorBox(MOTOR_ENCLOSED_LEN_MM, MOTOR_ENCLOSED_WID_MM, MOTOR_ENCLOSED_HGT_MM),
    ports: enclosedMotorPorts(MOTOR_ENCLOSED_LEN_MM),
  },
  {
    id: 'motor-silver-190',
    name: 'Battery Motor Silver',
    category: 'motors',
    description:
      'Enclosed Classic 3 V motor (2×AA). Forward/Off/Reverse. Silver ≈190 RPM. Driven rod through center; white 8-way on side lugs.',
    color: '#adb5bd',
    accent: '#868e96',
    variant: 'motor-enclosed',
    motorVolts: 3,
    motorRpm: 190,
    ...motorBox(MOTOR_ENCLOSED_LEN_MM, MOTOR_ENCLOSED_WID_MM, MOTOR_ENCLOSED_HGT_MM),
    ports: enclosedMotorPorts(MOTOR_ENCLOSED_LEN_MM),
  },
  {
    id: 'motor-remote-45',
    name: 'Separate Battery Motor',
    category: 'motors',
    description:
      '3 V motor with separate battery box (~45 RPM). Forward/Off/Reverse. Same driven-rod + side-lug interfaces as the enclosed motor.',
    color: '#868e96',
    accent: '#343a40',
    variant: 'motor-enclosed',
    motorVolts: 3,
    motorRpm: 45,
    ...motorBox(MOTOR_ENCLOSED_LEN_MM * 0.85, MOTOR_ENCLOSED_WID_MM, MOTOR_ENCLOSED_HGT_MM * 0.75),
    ports: enclosedMotorPorts(MOTOR_ENCLOSED_LEN_MM * 0.85),
  },
  {
    id: 'motor-tethered',
    name: 'Tethered Battery Motor',
    category: 'motors',
    description:
      '3 V tethered motor (2×AA pack). Forward/Off/Reverse. Rod through center or into end output; structural rods can sandwich the housing.',
    color: '#74c0fc',
    accent: '#1864ab',
    variant: 'motor-tethered',
    motorVolts: 3,
    ...motorBox(MOTOR_ENCLOSED_LEN_MM * 0.9, MOTOR_ENCLOSED_WID_MM * 0.95, MOTOR_ENCLOSED_HGT_MM * 0.7),
    ports: [
      drivenRodThrough(0),
      drivenRodEnd(mm(MOTOR_ENCLOSED_LEN_MM * 0.9) / 2),
      passiveRodThrough('mount-a', [0, mm(MOTOR_ENCLOSED_HGT_MM * 0.28), 0], [0, 1, 0]),
      passiveRodThrough('mount-b', [0, -mm(MOTOR_ENCLOSED_HGT_MM * 0.28), 0], [0, -1, 0]),
    ],
  },
  {
    id: 'motor-2speed',
    name: '2-Speed Battery Motor',
    category: 'motors',
    description:
      '6 V motor (4×AA). Forward/Off/Reverse plus Slow/Fast. Side mounting lugs; larger than the standard 3 V enclosed motors. Exact RPM not published.',
    color: '#fab005',
    accent: '#e67700',
    variant: 'motor-2speed',
    motorVolts: 6,
    ...motorBox(MOTOR_2SPEED_LEN_MM, MOTOR_2SPEED_WID_MM, MOTOR_2SPEED_HGT_MM),
    ports: enclosedMotorPorts(MOTOR_2SPEED_LEN_MM),
  },
  {
    id: 'motor-12v',
    name: '12 V Mains Motor',
    category: 'motors',
    description:
      '12 V external-supply motor (~66 RPM). External worm drives a Classic gear (e.g. white 90983 + tan clip). Two passive underside rod mounts — not driven. Barrel plug ~5.5/2.1 mm.',
    color: '#495057',
    accent: '#ced4da',
    variant: 'motor-12v',
    motorVolts: 12,
    motorRpm: 66,
    teeth: 8,
    ...motorBox(MOTOR_12V_LEN_MM, MOTOR_12V_WID_MM, MOTOR_12V_HGT_MM),
    ports: [
      wormMeshPort(mm(MOTOR_12V_WID_MM) / 2 + mm(MOTOR_WORM_PITCH_R_MM) * 0.35),
      passiveRodThrough(
        'mount-a',
        [-mm(12), -mm(MOTOR_12V_HGT_MM) / 2, -mm(12)],
        [0, -1, 0],
      ),
      passiveRodThrough(
        'mount-b',
        [mm(12), -mm(MOTOR_12V_HGT_MM) / 2, mm(12)],
        [0, -1, 0],
      ),
    ],
  },
  {
    id: 'motor-spring',
    name: 'Spring Motor',
    category: 'motors',
    description:
      'Mechanical spring motor. Wind with a Classic rod through the winding hole; light-load / higher-speed models.',
    color: '#e8590c',
    accent: '#ff922b',
    variant: 'motor-spring',
    ...motorBox(MOTOR_SPRING_LEN_MM, MOTOR_SPRING_WID_MM, MOTOR_SPRING_HGT_MM),
    ports: [drivenRodThrough(0)],
  },
  {
    id: 'motor-robotics',
    name: 'Robotics Motor',
    category: 'motors',
    description:
      'Education robotics motor with rotation sensor and PTO drive. Rod-loop structural mount — separate standard from battery motors.',
    color: '#5c7cfa',
    accent: '#91a7ff',
    variant: 'motor-robotics',
    motorVolts: 0,
    ...motorBox(65, 45, 48),
    ports: [
      drivenRodThrough(0),
      passiveRodThrough('rod-loop', [0, mm(28), 0], [0, 1, 0]),
    ],
  },
  {
    id: 'motor-brick',
    name: 'Brick Battery Motor',
    category: 'motors',
    description:
      'Brick-system battery motor (2×AA). Projecting axles accept Classic 37 mm racing wheels (91174) directly.',
    color: '#862e9c',
    accent: '#cc5de8',
    variant: 'motor-brick',
    motorVolts: 3,
    ...motorBox(60, 40, 35),
    ports: [
      {
        id: 'axle-a',
        kind: 'rod-end',
        position: [0, 0, mm(22)],
        direction: [0, 0, 1],
      },
      {
        id: 'axle-b',
        kind: 'rod-end',
        position: [0, 0, -mm(22)],
        direction: [0, 0, -1],
      },
    ],
  },
]

const FLEXI_SPECS = [
  {
    id: 'flexi-white',
    name: 'Flexi Rod 32mm',
    color: '#9775fa',
    bodyMm: 32.8,
    description: 'Flexible white-length rod (~32 mm body) for curves.',
  },
  {
    id: 'flexi-blue',
    name: 'Flexi Rod 52mm',
    color: '#da77f2',
    bodyMm: 54.8,
    description: 'Flexible blue-length rod (~52–55 mm body) for curves.',
  },
  {
    id: 'flexi-yellow',
    name: 'Flexi Rod 86mm',
    color: '#ff922b',
    bodyMm: 85.9,
    description: 'Flexible yellow-length rod (~86 mm body) for curves.',
  },
  {
    id: 'flexi-gray',
    name: 'Flexi Rod 190mm',
    color: '#40c057',
    bodyMm: 192.0,
    description: 'Flexible grey-length rod (~190 mm body) for long curves.',
  },
] as const

function makePanel(
  id: string,
  name: string,
  size: keyof typeof PANEL_SIDE_MM,
  tri: boolean,
  color: string,
): CatalogPiece {
  const side = mm(PANEL_SIDE_MM[size])
  return {
    id,
    name,
    category: 'panels',
    description: tri
      ? `Right-triangle panel — leg ${PANEL_SIDE_MM[size]} mm with corner rod tips.`
      : `Square panel — ${PANEL_SIDE_MM[size]}×${PANEL_SIDE_MM[size]} mm body with diagonal corner rod tips.`,
    color,
    accent: '#212529',
    variant: tri ? 'panel-tri' : 'panel-square',
    length: side,
    thickness: mm(PANEL_THICK_MM),
    ports: tri ? panelTriPorts(side) : panelSquarePorts(side),
  }
}

const panels: CatalogPiece[] = [
  makePanel('panel-sq-mini', 'Square Panel Mini', 'mini', false, '#212529'),
  makePanel('panel-sq-small', 'Square Panel Small', 'small', false, '#e03131'),
  makePanel('panel-sq-medium', 'Square Panel Medium', 'medium', false, '#212529'),
  makePanel('panel-sq-large', 'Square Panel Large', 'large', false, '#1c7ed6'),
  makePanel('panel-tri-mini', 'Tri Panel Mini', 'mini', true, '#212529'),
  makePanel('panel-tri-small', 'Tri Panel Small', 'small', true, '#2f9e44'),
  makePanel('panel-tri-medium', 'Tri Panel Medium', 'medium', true, '#fcc419'),
  makePanel('panel-tri-large', 'Tri Panel Large', 'large', true, '#212529'),
]

const chain: CatalogPiece[] = [
  {
    id: 'chain-small',
    name: 'Chain Link Small',
    category: 'chain',
    description: `Small chain link — ${CHAIN_SMALL_MM} mm pitch.`,
    color: '#495057',
    accent: '#868e96',
    variant: 'chain-link',
    length: mm(CHAIN_SMALL_MM),
    thickness: mm(4),
    radius: mm(5),
    ports: chainPorts(mm(CHAIN_SMALL_MM)),
  },
  {
    id: 'chain-large',
    name: 'Chain Link Large',
    category: 'chain',
    description: `Large chain link — ${CHAIN_LARGE_MM} mm pitch.`,
    color: '#343a40',
    accent: '#868e96',
    variant: 'chain-link',
    length: mm(CHAIN_LARGE_MM),
    thickness: mm(5),
    radius: mm(7),
    ports: chainPorts(mm(CHAIN_LARGE_MM)),
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
  ...FLEXI_SPECS.map((spec) => {
    const length = rodBodyLength(spec.bodyMm)
    return {
      id: spec.id,
      name: spec.name,
      category: 'rods' as const,
      description: spec.description,
      color: spec.color,
      length,
      flexi: true,
      ports: [...rodPorts(length), shaftPort()],
    }
  }),
  ...connectors,
  ...clips,
  ...spacers,
  ...wheels,
  ...gears,
  ...motors,
  ...panels,
  ...chain,
]

export const CATEGORY_LABELS: Record<CatalogPiece['category'], string> = {
  rods: 'Rods',
  connectors: 'Connectors',
  clips: 'Clips',
  spacers: 'Spacers',
  wheels: 'Wheels',
  gears: 'Gears',
  motors: 'Motors',
  panels: 'Panels',
  chain: 'Chain',
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

/** Categories kept in data but not shown in the left piece menu. */
export function isHiddenFromPalette(piece: CatalogPiece): boolean {
  return (
    piece.category === 'clips' ||
    piece.category === 'chain' ||
    piece.category === 'panels' ||
    Boolean(piece.flexi) ||
    isPreassembledHub(piece)
  )
}

/** Flat/3D hubs and specialty clips that use C-clip snap (end-on + Perp). */
export function isConnectorLike(piece: CatalogPiece): boolean {
  return piece.category === 'connectors' || piece.category === 'clips'
}

/** Rings that sit coaxially on a rod shaft (spacers, wheels, gears, motors with drive bore). */
export function isShaftSleeve(piece: CatalogPiece): boolean {
  if (piece.category === 'spacers' || piece.category === 'wheels' || piece.category === 'gears') {
    return true
  }
  if (piece.category !== 'motors') return false
  // Driven through-hole motors only — not worm-only / brick-axle motors.
  return piece.ports.some((p) => p.id === 'drive' || p.id === 'axle')
}

/** Motor housing with connector mounting lugs (structural, not drive). */
export function isMotorWithLugs(piece: CatalogPiece): boolean {
  return piece.category === 'motors' && piece.ports.some((p) => p.kind === 'connector-lug')
}
