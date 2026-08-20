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
export const WHEEL_25_OD_MM = 25
export const WHEEL_50_OD_MM = 50
export const TIRE_MEDIUM_OD_MM = 72
export const WHEEL_THICK_MM = BLUE_SPACER_MM * 4

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
  const stub = mm(8)
  return [
    ...singleClipPorts(),
    {
      id: 'stub',
      kind: 'rod-end',
      position: [0, 0, -SOCKET_RADIUS - stub],
      direction: [0, 0, -1],
    },
  ]
}

function panelSquarePorts(side: number): PortDef[] {
  const half = side / 2
  const tip = SOCKET_RADIUS * 0.85
  return [
    { id: 'tip-n', kind: 'rod-end', position: [0, 0, half + tip], direction: [0, 0, 1] },
    { id: 'tip-e', kind: 'rod-end', position: [half + tip, 0, 0], direction: [1, 0, 0] },
    { id: 'tip-s', kind: 'rod-end', position: [0, 0, -(half + tip)], direction: [0, 0, -1] },
    { id: 'tip-w', kind: 'rod-end', position: [-(half + tip), 0, 0], direction: [-1, 0, 0] },
  ]
}

function panelTriPorts(leg: number): PortDef[] {
  const half = leg / 2
  const tip = SOCKET_RADIUS * 0.85
  return [
    { id: 'tip-a', kind: 'rod-end', position: [0, 0, half + tip], direction: [0, 0, 1] },
    { id: 'tip-b', kind: 'rod-end', position: [half + tip, 0, -half], direction: [1, 0, 0] },
    { id: 'tip-c', kind: 'rod-end', position: [-(half + tip), 0, -half], direction: [-1, 0, 0] },
  ]
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
    description: 'Black C-clip with an integral rod stub that seats in another connector socket.',
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
    description: `Thin axle spacer (${BLUE_SPACER_MM.toFixed(2)} mm) — one Classic blue-spacer unit.`,
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
    description: `Wide axle spacer (${SILVER_SPACER_MM.toFixed(2)} mm) — three blue spacers thick.`,
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
    name: '25mm Wheel',
    category: 'wheels',
    description: 'Closed-centre 25 mm wheel — slide onto a rod; hold with spacers or a tan clip.',
    color: '#212529',
    accent: '#495057',
    radius: mm(WHEEL_25_OD_MM) / 2,
    thickness: mm(WHEEL_THICK_MM),
    ports: [axleSocket()],
  },
  {
    id: 'wheel-hub-50',
    name: '50mm Hub / Pulley',
    category: 'wheels',
    description: '50 mm silver hub/pulley — use alone as a pulley or with a tire.',
    color: '#ced4da',
    accent: '#868e96',
    radius: mm(WHEEL_50_OD_MM) / 2,
    thickness: mm(WHEEL_THICK_MM),
    ports: [axleSocket()],
  },
  {
    id: 'wheel-tire',
    name: 'Medium Tire Wheel',
    category: 'wheels',
    description: `50 mm hub with medium tire (~${TIRE_MEDIUM_OD_MM} mm OD).`,
    color: '#212529',
    accent: '#868e96',
    radius: mm(TIRE_MEDIUM_OD_MM) / 2,
    thickness: mm(WHEEL_THICK_MM),
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
    ports: [axleSocket()],
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
    ports: [axleSocket()],
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
    ports: [axleSocket()],
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
    ports: [axleSocket()],
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
      ? `Right-triangle panel — leg ${PANEL_SIDE_MM[size]} mm with three rod-tip corners.`
      : `Square panel — ${PANEL_SIDE_MM[size]}×${PANEL_SIDE_MM[size]} mm body with edge rod tips.`,
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

/** Flat/3D hubs and specialty clips that use C-clip snap (end-on + Perp). */
export function isConnectorLike(piece: CatalogPiece): boolean {
  return piece.category === 'connectors' || piece.category === 'clips'
}

/** Rings that sit coaxially on a rod shaft (spacers, wheels, gears). */
export function isShaftSleeve(piece: CatalogPiece): boolean {
  return piece.category === 'spacers' || piece.category === 'wheels' || piece.category === 'gears'
}
