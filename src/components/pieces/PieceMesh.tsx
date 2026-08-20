import { useMemo } from 'react'
import * as THREE from 'three'
import type { CatalogPiece, ConnectorVariant } from '../../types/knex'
import {
  BLUE_SPACER,
  CLIP_ARM_LENGTH,
  FULL_CLIP_ANGLES,
  GEAR_MODULE_MM,
  GEAR_SMALL_OD_MM,
  GEAR_SMALL_THICK_MM,
  HALF_CLIP_ANGLES,
  HOLE_CLIP_HOLE_ID,
  HOLE_CLIP_HOLE_OD,
  HOLE_CLIP_SPAN,
  HUB_HEIGHT,
  HUB_RADIUS,
  NESTED_FULL_CLIP_ANGLES,
  NESTED_HALF_CLIP_ANGLES,
  PANEL_THICK_MM,
  ROD_END_CLIP_GROOVE_LEN,
  ROD_END_CLIP_HEAD_LEN,
  ROD_END_CLIP_NECK_EXTENT,
  ROD_END_CLIP_SHAFT_LEN,
  ROD_RADIUS_SCENE,
  SOCKET_RADIUS,
  SPACER_OUTER_RADIUS,
  WHEEL_50_OD_MM,
  WHEEL_THICK_MM,
  mm,
} from '../../data/catalog'

type MatProps = {
  color: string
  roughness: number
  metalness: number
  transparent: boolean
  opacity: number
  emissive: string
  emissiveIntensity: number
  depthWrite: boolean
}

interface PieceMeshProps {
  catalog: CatalogPiece
  opacity?: number
  emissive?: string
  emissiveIntensity?: number
}

function Plastic({
  mat,
  color,
}: {
  mat: MatProps
  color?: string
}) {
  return (
    <meshStandardMaterial
      color={color ?? mat.color}
      roughness={mat.roughness}
      metalness={mat.metalness}
      transparent={mat.transparent}
      opacity={mat.opacity}
      emissive={mat.emissive}
      emissiveIntensity={mat.emissiveIntensity}
      depthWrite={mat.depthWrite}
    />
  )
}

/**
 * Open C-clip — a pair of gripping arms with no floor or lid.
 * Rods snap in from either face. Local +Z is radial out of the hub.
 * Socket end wall sits at SOCKET_RADIUS (10.1 mm); arms extend outward.
 */
function CClip({ mat, accent }: { mat: MatProps; accent?: string }) {
  const jawThick = mm(1.9)
  const jawHeight = HUB_HEIGHT * 0.95
  const armLen = CLIP_ARM_LENGTH
  const mouth = ROD_RADIUS_SCENE * 2.08
  const wallT = mm(1.2)
  const zWall = SOCKET_RADIUS
  const zArmMid = zWall + armLen / 2
  const webLen = Math.max(mm(1), zWall - HUB_RADIUS)
  const zWeb = HUB_RADIUS + webLen / 2
  const ribR = mm(0.85)
  const ribZ = zWall + mm(1.7)

  return (
    <group>
      <mesh position={[0, 0, zWeb]}>
        <boxGeometry args={[mouth * 0.55, jawHeight * 0.88, webLen]} />
        <Plastic mat={mat} />
      </mesh>
      {/* End wall — contact face at 10.1 mm from the hub origin */}
      <mesh position={[0, 0, zWall - wallT / 2]}>
        <boxGeometry args={[mouth + jawThick * 2, jawHeight, wallT]} />
        <Plastic mat={mat} color={accent ?? mat.color} />
      </mesh>
      <mesh position={[-(mouth / 2 + jawThick / 2), 0, zArmMid]}>
        <boxGeometry args={[jawThick, jawHeight, armLen]} />
        <Plastic mat={mat} />
      </mesh>
      <mesh position={[mouth / 2 + jawThick / 2, 0, zArmMid]}>
        <boxGeometry args={[jawThick, jawHeight, armLen]} />
        <Plastic mat={mat} />
      </mesh>
      {/* Retaining ribs near the end wall, into the rod annular groove */}
      {([-1, 1] as const).map((side) => (
        <mesh key={side} position={[side * (mouth / 2 - ribR * 0.35), 0, ribZ]}>
          <sphereGeometry args={[ribR, 10, 10]} />
          <Plastic mat={mat} color={accent ?? '#ffffff'} />
        </mesh>
      ))}
    </group>
  )
}

function quatForClip(direction: [number, number, number]): THREE.Quaternion {
  const zAxis = new THREE.Vector3(...direction).normalize()
  let yAxis = new THREE.Vector3(0, 1, 0)
  if (Math.abs(zAxis.dot(yAxis)) > 0.9) {
    yAxis = new THREE.Vector3(1, 0, 0)
  }
  const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize()
  yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize()
  return new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis),
  )
}

/**
 * Open 3D slot at 0° (+Z) — the one place another slotted connector slides in.
 * Rectangular channel through the plate with snap nubs, open at the outer end.
 */
function InterlockSlot({ mat }: { mat: MatProps }) {
  const slotW = HUB_HEIGHT * 1.08
  const slotH = HUB_HEIGHT * 1.08
  const inner = HUB_RADIUS * 0.35
  const slotD = SOCKET_RADIUS - inner
  const z = inner + slotD / 2
  const nubR = mm(0.75)
  return (
    <group position={[0, 0, z]}>
      <mesh>
        <boxGeometry args={[slotW, slotH, slotD]} />
        <meshStandardMaterial
          color="#141518"
          roughness={0.75}
          transparent={mat.transparent}
          opacity={mat.opacity}
          depthWrite={mat.depthWrite}
        />
      </mesh>
      {([-1, 1] as const).map((side) => (
        <mesh key={side} position={[0, side * (slotH / 2 - nubR), slotD * 0.12]}>
          <sphereGeometry args={[nubR, 8, 8]} />
          <Plastic mat={mat} color="#868e96" />
        </mesh>
      ))}
    </group>
  )
}

function ConnectorPlate({
  mat,
  accent,
  angles,
  half = false,
  slotted = false,
  nested = false,
  color,
}: {
  mat: MatProps
  accent?: string
  angles: readonly number[]
  half?: boolean
  slotted?: boolean
  /** Second plate of a 90° nest: webbing in the first plate’s slot, no duplicate hub. */
  nested?: boolean
  color?: string
}) {
  const plateMat = color ? { ...mat, color } : mat
  const hubR = HUB_RADIUS
  const hubH = HUB_HEIGHT
  const holeR = ROD_RADIUS_SCENE * 1.05

  const clips = useMemo(
    () =>
      angles.map((deg, i) => {
        const a = (deg * Math.PI) / 180
        const dir: [number, number, number] = [Math.sin(a), 0, Math.cos(a)]
        return { id: `c${i}`, quat: quatForClip(dir) }
      }),
    [angles],
  )

  return (
    <group>
      {!nested && (
        <>
          <mesh>
            <cylinderGeometry args={[hubR, hubR, hubH, 22]} />
            <Plastic mat={plateMat} />
          </mesh>
          {([-1, 1] as const).map((side) => (
            <group key={side}>
              <mesh position={[0, side * (hubH / 2 + mm(0.04)), 0]} rotation={[Math.PI / 2, 0, 0]}>
                <ringGeometry args={[holeR, hubR * 0.92, 22]} />
                <Plastic mat={plateMat} color={accent ?? plateMat.color} />
              </mesh>
              <mesh position={[0, side * (hubH / 2 + mm(0.45)), 0]}>
                <cylinderGeometry args={[hubR * 1.06, hubR * 1.06, mm(0.75), 22]} />
                <Plastic mat={plateMat} />
              </mesh>
            </group>
          ))}
        </>
      )}

      {nested && (
        <mesh renderOrder={1}>
          {/* After Rz(-90): fills the 0° slot without a second hub cylinder. */}
          <boxGeometry args={[hubH * 0.92, hubH * 0.92, hubH * 0.92]} />
          <meshStandardMaterial
            color={plateMat.color}
            roughness={plateMat.roughness}
            metalness={plateMat.metalness}
            transparent={plateMat.transparent}
            opacity={plateMat.opacity}
            emissive={plateMat.emissive}
            emissiveIntensity={plateMat.emissiveIntensity}
            depthWrite={plateMat.depthWrite}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      )}

      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[HUB_RADIUS, mm(0.45), 8, 28]} />
        <Plastic mat={plateMat} />
      </mesh>

      {slotted && !nested && <InterlockSlot mat={plateMat} />}

      {half && !nested && (
        <mesh position={[-HUB_RADIUS * 0.68, 0, 0]}>
          <boxGeometry args={[mm(2.2), hubH * 0.95, SOCKET_RADIUS * 1.55]} />
          <Plastic mat={plateMat} />
        </mesh>
      )}

      {clips.map((clip) => (
        <group key={clip.id} quaternion={clip.quat}>
          <CClip mat={plateMat} accent={accent} />
        </group>
      ))}
    </group>
  )
}

function AssembledHub({
  variant,
  mat,
  accent,
}: {
  variant: ConnectorVariant
  mat: MatProps
  accent?: string
}) {
  const fullColor = '#1c7ed6'
  const halfColor = accent ?? '#adb5bd'
  /** Second plate yaws −90° so its hub is +X and both slots share +Z. */
  const nestYaw: [number, number, number] = [0, 0, -Math.PI / 2]

  if (variant === 'double-full') {
    return (
      <group>
        <ConnectorPlate mat={mat} color={fullColor} angles={FULL_CLIP_ANGLES} slotted />
        <group rotation={nestYaw}>
          <ConnectorPlate mat={mat} color={fullColor} angles={NESTED_FULL_CLIP_ANGLES} nested />
        </group>
      </group>
    )
  }

  if (variant === 'full-half') {
    return (
      <group>
        <ConnectorPlate mat={mat} color={fullColor} angles={FULL_CLIP_ANGLES} slotted />
        <group rotation={nestYaw}>
          <ConnectorPlate
            mat={mat}
            color={halfColor}
            angles={NESTED_HALF_CLIP_ANGLES}
            half
            nested
          />
        </group>
      </group>
    )
  }

  if (variant === 'half-half') {
    return (
      <group>
        <ConnectorPlate mat={mat} color={halfColor} angles={HALF_CLIP_ANGLES} half slotted />
        <group rotation={nestYaw}>
          <ConnectorPlate
            mat={mat}
            color={halfColor}
            angles={NESTED_HALF_CLIP_ANGLES}
            half
            nested
          />
        </group>
      </group>
    )
  }

  return null
}

function ConnectorMesh({
  catalog,
  mat,
}: {
  catalog: CatalogPiece
  mat: MatProps
}) {
  const variant = catalog.variant ?? 'plate'

  const angles = useMemo(() => {
    const list: number[] = []
    for (const port of catalog.ports) {
      if (port.kind !== 'socket') continue
      if (port.id.startsWith('center') || port.id === 'hole' || port.id === 'bore') continue
      if (Math.abs(port.direction[1]) > 0.35) continue
      const yaw = (Math.atan2(port.direction[0], port.direction[2]) * 180) / Math.PI
      list.push(((yaw % 360) + 360) % 360)
    }
    return list.length ? list : [...FULL_CLIP_ANGLES]
  }, [catalog])

  if (variant === 'double-full' || variant === 'full-half' || variant === 'half-half') {
    return <AssembledHub variant={variant} mat={mat} accent={catalog.accent} />
  }

  if (variant === 'half') {
    return (
      <ConnectorPlate
        mat={mat}
        accent={catalog.accent}
        angles={HALF_CLIP_ANGLES}
        half
        slotted
      />
    )
  }

  if (variant === 'full') {
    return (
      <ConnectorPlate
        mat={mat}
        accent={catalog.accent}
        angles={FULL_CLIP_ANGLES}
        slotted
      />
    )
  }

  if (variant === 'hole-clip') {
    const holeR = HOLE_CLIP_HOLE_ID / 2
    const ringR = HOLE_CLIP_HOLE_OD / 2
    return (
      <group>
        <group quaternion={quatForClip([0, 0, 1])}>
          <CClip mat={mat} accent={catalog.accent} />
        </group>
        <mesh position={[0, 0, -HOLE_CLIP_SPAN * 0.35]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[(holeR + ringR) / 2, (ringR - holeR) / 2, 10, 20]} />
          <Plastic mat={mat} />
        </mesh>
        <mesh position={[0, 0, -HOLE_CLIP_SPAN * 0.12]}>
          <boxGeometry args={[mm(3), HUB_HEIGHT * 0.7, HOLE_CLIP_SPAN * 0.45]} />
          <Plastic mat={mat} />
        </mesh>
      </group>
    )
  }

  if (variant === 'lock-clip') {
    return (
      <group quaternion={quatForClip([0, 0, 1])}>
        <CClip mat={mat} accent={catalog.accent} />
      </group>
    )
  }

  if (variant === 'rod-end-clip') {
    const pinR = ROD_RADIUS_SCENE
    const grooveR = mm(4.8) / 2
    const headR = mm(8.2) / 2
    // Overlap the C-clip web so jaws + neck + pin read as one solid body.
    const neckFrom = HUB_RADIUS + mm(2.2)
    const neckTo = -ROD_END_CLIP_NECK_EXTENT
    const neckLen = neckFrom - neckTo
    const neckZ = (neckFrom + neckTo) / 2
    const shaftLen = ROD_END_CLIP_SHAFT_LEN
    const grooveLen = ROD_END_CLIP_GROOVE_LEN
    const headLen = ROD_END_CLIP_HEAD_LEN
    const shaftZ = neckTo - shaftLen / 2
    const grooveZ = neckTo - shaftLen - grooveLen / 2
    const headZ = neckTo - shaftLen - grooveLen - headLen / 2
    const tipZ = neckTo - shaftLen - grooveLen - headLen
    return (
      <group>
        <group quaternion={quatForClip([0, 0, 1])}>
          <CClip mat={mat} accent={catalog.accent} />
        </group>
        <mesh position={[0, 0, neckZ]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[pinR * 1.15, pinR * 1.15, neckLen, 16]} />
          <Plastic mat={mat} />
        </mesh>
        <mesh position={[0, 0, shaftZ]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[pinR, pinR, shaftLen, 16]} />
          <Plastic mat={mat} />
        </mesh>
        <mesh position={[0, 0, grooveZ]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[grooveR, grooveR, grooveLen, 16]} />
          <Plastic mat={mat} color={catalog.accent ?? mat.color} />
        </mesh>
        <mesh position={[0, 0, headZ]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[headR * 0.78, headR, headLen, 16]} />
          <Plastic mat={mat} />
        </mesh>
        <mesh position={[0, 0, tipZ + headR * 0.42]}>
          <sphereGeometry args={[headR * 0.78, 16, 12]} />
          <Plastic mat={mat} />
        </mesh>
      </group>
    )
  }

  if (variant === 'hinge') {
    return (
      <group>
        <mesh>
          <cylinderGeometry args={[mm(2.2), mm(2.2), HUB_HEIGHT * 1.1, 12]} />
          <Plastic mat={mat} color={catalog.accent ?? mat.color} />
        </mesh>
        <group position={[0, 0, SOCKET_RADIUS * 0.15]} quaternion={quatForClip([0, 0, 1])}>
          <CClip mat={mat} />
        </group>
        <group position={[0, 0, -SOCKET_RADIUS * 0.15]} quaternion={quatForClip([0, 0, -1])}>
          <CClip mat={{ ...mat, color: catalog.accent ?? mat.color }} />
        </group>
      </group>
    )
  }

  if (variant === 'ball-clip') {
    const ballR = catalog.radius ?? mm(5.5)
    return (
      <group>
        <group quaternion={quatForClip([0, 0, 1])}>
          <CClip mat={mat} accent={catalog.accent} />
        </group>
        <mesh position={[0, 0, -SOCKET_RADIUS - mm(8)]}>
          <sphereGeometry args={[ballR, 16, 16]} />
          <Plastic mat={mat} color={catalog.accent ?? mat.color} />
        </mesh>
      </group>
    )
  }

  if (variant === 'socket-clip') {
    const cupR = catalog.radius ?? mm(6)
    return (
      <group>
        <group quaternion={quatForClip([0, 0, 1])}>
          <CClip mat={mat} accent={catalog.accent} />
        </group>
        <mesh position={[0, 0, -SOCKET_RADIUS - mm(6)]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[cupR * 0.72, cupR * 0.28, 10, 16]} />
          <Plastic mat={mat} />
        </mesh>
      </group>
    )
  }

  if (variant === 'end-cap') {
    const r = catalog.radius ?? mm(4)
    const t = catalog.thickness ?? mm(4)
    return (
      <group>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[r, r, t, 16]} />
          <Plastic mat={mat} />
        </mesh>
        <mesh position={[0, 0, t * 0.15]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[ROD_RADIUS_SCENE * 1.05, ROD_RADIUS_SCENE * 1.05, t * 0.5, 12]} />
          <Plastic mat={mat} color={catalog.accent ?? '#495057'} />
        </mesh>
      </group>
    )
  }

  return (
    <ConnectorPlate
      mat={mat}
      accent={catalog.accent}
      angles={angles}
      slotted={false}
    />
  )
}

function makeAnnulusGeometry(outerR: number, innerR: number, depth: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape()
  shape.absarc(0, 0, outerR, 0, Math.PI * 2, false)
  const hole = new THREE.Path()
  hole.absarc(0, 0, Math.min(innerR, outerR * 0.92), 0, Math.PI * 2, true)
  shape.holes.push(hole)
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: 28,
  })
  // Center on origin; thickness along Z (axle axis for sleeves/wheels/gears).
  geo.translate(0, 0, -depth / 2)
  return geo
}

function AnnulusMesh({
  outerR,
  innerR,
  depth,
  mat,
  color,
}: {
  outerR: number
  innerR: number
  depth: number
  mat: MatProps
  color?: string
}) {
  const geo = useMemo(
    () => makeAnnulusGeometry(outerR, innerR, depth),
    [outerR, innerR, depth],
  )
  return (
    <mesh geometry={geo}>
      <Plastic mat={mat} color={color} />
    </mesh>
  )
}

function SleeveMesh({ catalog, mat }: { catalog: CatalogPiece; mat: MatProps }) {
  const r = catalog.radius ?? SPACER_OUTER_RADIUS
  const t = catalog.thickness ?? BLUE_SPACER
  const hole = ROD_RADIUS_SCENE * 1.02
  return <AnnulusMesh outerR={r} innerR={hole} depth={t} mat={mat} />
}

function WheelMesh({ catalog, mat }: { catalog: CatalogPiece; mat: MatProps }) {
  const r = catalog.radius ?? mm(25) / 2
  const t = catalog.thickness ?? mm(WHEEL_THICK_MM)
  const hubR = Math.min(r * 0.38, mm(WHEEL_50_OD_MM) / 4)
  const bore = ROD_RADIUS_SCENE * 1.02
  const isTire = catalog.id === 'wheel-tire'
  return (
    <group>
      {isTire ? (
        <>
          {/* Solid tire volume (torus tube) + solid hub annulus */}
          <mesh>
            <torusGeometry args={[r * 0.78, r * 0.22, 14, 32]} />
            <Plastic mat={mat} />
          </mesh>
          <AnnulusMesh
            outerR={hubR * 1.45}
            innerR={bore}
            depth={t}
            mat={mat}
            color={catalog.accent ?? mat.color}
          />
        </>
      ) : (
        <AnnulusMesh outerR={r} innerR={bore} depth={t} mat={mat} />
      )}
      {!isTire &&
        catalog.id === 'wheel-hub-50' &&
        Array.from({ length: 6 }).map((_, i) => {
          const a = (i / 6) * Math.PI * 2
          return (
            <mesh
              key={i}
              position={[Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, 0]}
              rotation={[0, 0, a]}
            >
              <boxGeometry args={[r * 0.42, mm(2.2), t * 0.85]} />
              <Plastic mat={mat} color={catalog.accent ?? mat.color} />
            </mesh>
          )
        })}
    </group>
  )
}

function GearMesh({ catalog, mat }: { catalog: CatalogPiece; mat: MatProps }) {
  const tipR = catalog.radius ?? mm(GEAR_SMALL_OD_MM) / 2
  const t = catalog.thickness ?? mm(GEAR_SMALL_THICK_MM)
  const teeth = catalog.teeth ?? 14
  const style = catalog.variant ?? 'gear-spur'
  const crown = style === 'gear-crown' || style === 'gear-multi'
  const multi = style === 'gear-multi'
  const pushOn = Boolean(catalog.pushOn)
  // Classic axle Ø 6.35 mm — push-on is a tighter visual bore.
  const bore = ROD_RADIUS_SCENE * (pushOn ? 0.92 : 1.02)
  const module = mm(GEAR_MODULE_MM)
  const pitchR = (teeth * module) / 2
  const rootR = Math.max(pitchR - module * 1.25, tipR * 0.62)
  const hubR = Math.min(rootR * 0.55, mm(12))
  const toothW = ((Math.PI * 2 * pitchR) / teeth) * 0.42
  const toothH = tipR - rootR
  const toothDepth = crown ? t * 0.55 : t * 0.95
  const toothZ = crown ? t * 0.28 : 0

  const innerTeeth = catalog.innerTeeth ?? 64
  const innerTipR = catalog.innerRadius ?? tipR * 0.8
  const innerPitchR = (innerTeeth * module) / 2
  const innerRootR = Math.max(innerPitchR - module * 1.25, innerTipR * 0.7)
  const innerToothW = ((Math.PI * 2 * innerPitchR) / innerTeeth) * 0.42
  const innerToothH = innerTipR - innerRootR

  return (
    <group>
      <AnnulusMesh outerR={rootR} innerR={bore} depth={t} mat={mat} />
      <AnnulusMesh
        outerR={hubR}
        innerR={bore}
        depth={t * (pushOn ? 1.05 : 1.15)}
        mat={mat}
        color={catalog.accent ?? mat.color}
      />
      {!pushOn &&
        [0.32, -0.32].map((side) => (
          <mesh key={side} position={[0, 0, side * t * 0.42]}>
            <torusGeometry args={[(hubR + rootR) * 0.42, mm(0.55), 8, 24]} />
            <Plastic mat={mat} color="#343a40" />
          </mesh>
        ))}
      {Array.from({ length: teeth }).map((_, i) => {
        const a = (i / teeth) * Math.PI * 2
        return (
          <mesh
            key={`o${i}`}
            position={[
              Math.cos(a) * (rootR + toothH / 2),
              Math.sin(a) * (rootR + toothH / 2),
              toothZ,
            ]}
            rotation={[crown ? Math.PI / 2 : 0, 0, a]}
          >
            <boxGeometry
              args={crown ? [toothW, toothDepth, toothH] : [toothW, toothH, toothDepth]}
            />
            <Plastic mat={mat} />
          </mesh>
        )
      })}
      {multi &&
        Array.from({ length: innerTeeth }).map((_, i) => {
          const a = (i / innerTeeth) * Math.PI * 2
          return (
            <mesh
              key={`i${i}`}
              position={[
                Math.cos(a) * (innerRootR + innerToothH / 2),
                Math.sin(a) * (innerRootR + innerToothH / 2),
                -t * 0.22,
              ]}
              rotation={[Math.PI / 2, 0, a]}
            >
              <boxGeometry args={[innerToothW, t * 0.5, innerToothH]} />
              <Plastic mat={mat} color={catalog.accent ?? mat.color} />
            </mesh>
          )
        })}
    </group>
  )
}

function PanelMesh({ catalog, mat }: { catalog: CatalogPiece; mat: MatProps }) {
  const side = catalog.length ?? mm(64)
  const thick = catalog.thickness ?? mm(PANEL_THICK_MM)
  const tri = catalog.variant === 'panel-tri'
  const tipLen = SOCKET_RADIUS * 0.85

  const bodyGeo = useMemo(() => {
    if (!tri) {
      const geo = new THREE.BoxGeometry(side, thick, side)
      return geo
    }
    const shape = new THREE.Shape()
    const h = side / 2
    shape.moveTo(0, h)
    shape.lineTo(h, -h)
    shape.lineTo(-h, -h)
    shape.closePath()
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: thick,
      bevelEnabled: false,
    })
    geo.translate(0, 0, -thick / 2)
    geo.rotateX(-Math.PI / 2)
    return geo
  }, [side, thick, tri])

  return (
    <group>
      <mesh geometry={bodyGeo}>
        <Plastic mat={mat} />
      </mesh>
      {catalog.ports
        .filter((p) => p.kind === 'rod-end')
        .map((p) => (
          <mesh
            key={p.id}
            // Center the detent on the corner so half sits on the panel, half sticks out.
            position={[
              p.position[0] - p.direction[0] * (tipLen / 2),
              p.position[1],
              p.position[2] - p.direction[2] * (tipLen / 2),
            ]}
            rotation={[
              Math.PI / 2,
              0,
              Math.atan2(p.direction[0], p.direction[2]),
            ]}
          >
            <cylinderGeometry
              args={[ROD_RADIUS_SCENE * 0.85, ROD_RADIUS_SCENE * 0.85, tipLen, 12]}
            />
            <Plastic mat={mat} color={catalog.accent ?? mat.color} />
          </mesh>
        ))}
    </group>
  )
}

function ChainMesh({ catalog, mat }: { catalog: CatalogPiece; mat: MatProps }) {
  const len = catalog.length ?? mm(20)
  const r = catalog.radius ?? mm(5)
  const t = catalog.thickness ?? mm(4)
  // Chain links are solid toroidal plastic tubes.
  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[r * 0.55, t * 0.35, 10, 20]} />
        <Plastic mat={mat} />
      </mesh>
      <mesh position={[0, 0, len * 0.15]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[r * 0.45, t * 0.3, 10, 18]} />
        <Plastic mat={mat} color={catalog.accent ?? mat.color} />
      </mesh>
    </group>
  )
}

export function PieceMesh({
  catalog,
  opacity = 1,
  emissive = '#000000',
  emissiveIntensity = 0,
}: PieceMeshProps) {
  const transparent = opacity < 0.999
  const mat: MatProps = {
    color: catalog.color,
    roughness: 0.3,
    metalness: 0.03,
    transparent,
    opacity,
    emissive,
    emissiveIntensity,
    depthWrite: !transparent,
  }

  if (catalog.category === 'rods') {
    // Classic rods: solid constant-Ø shaft between end detents (flange + snap groove).
    const length = catalog.length ?? 1
    const shaftRadius = ROD_RADIUS_SCENE
    const flangeRadius = mm(8.2) / 2
    const flangeThickness = mm(1.4)
    const grooveRadius = mm(4.8) / 2
    const grooveLength = mm(1.6)
    const endStack = flangeThickness + grooveLength
    const shaftLength = Math.max(mm(2), length - endStack * 2)
    return (
      <group>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[shaftRadius, shaftRadius, shaftLength, 20]} />
          <Plastic mat={mat} />
        </mesh>
        {([-1, 1] as const).map((side) => {
          const end = (side * length) / 2
          const flangeCenter = end - side * (flangeThickness / 2)
          const grooveCenter = end - side * (flangeThickness + grooveLength / 2)
          return (
            <group key={side}>
              <mesh position={[0, 0, flangeCenter]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[flangeRadius, flangeRadius, flangeThickness, 18]} />
                <Plastic mat={mat} />
              </mesh>
              <mesh position={[0, 0, grooveCenter]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[grooveRadius, grooveRadius, grooveLength, 16]} />
                <Plastic mat={mat} color={catalog.accent ?? catalog.color} />
              </mesh>
            </group>
          )
        })}
      </group>
    )
  }

  if (catalog.category === 'spacers') return <SleeveMesh catalog={catalog} mat={mat} />
  if (catalog.category === 'wheels') return <WheelMesh catalog={catalog} mat={mat} />
  if (catalog.category === 'gears') return <GearMesh catalog={catalog} mat={mat} />
  if (catalog.category === 'panels') return <PanelMesh catalog={catalog} mat={mat} />
  if (catalog.category === 'chain') return <ChainMesh catalog={catalog} mat={mat} />
  if (catalog.category === 'clips') return <ConnectorMesh catalog={catalog} mat={mat} />

  return <ConnectorMesh catalog={catalog} mat={mat} />
}
