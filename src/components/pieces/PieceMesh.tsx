import { useMemo } from 'react'
import * as THREE from 'three'
import type { CatalogPiece, ConnectorVariant } from '../../types/knex'
import {
  CLIP_ARM_LENGTH,
  FULL_CLIP_ANGLES,
  HALF_CLIP_ANGLES,
  HUB_HEIGHT,
  HUB_RADIUS,
  NESTED_FULL_CLIP_ANGLES,
  NESTED_HALF_CLIP_ANGLES,
  ROD_RADIUS_SCENE,
  SOCKET_RADIUS,
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
      // Only use ports that lie in the primary (Y-hub) plane for single plates.
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

  return (
    <ConnectorPlate
      mat={mat}
      accent={catalog.accent}
      angles={angles}
      slotted={false}
    />
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
    // Classic rods: constant Ø shaft between end detents (flange + snap groove).
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

  if (catalog.category === 'wheels') {
    return (
      <group>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.55, 0.16, 16, 32]} />
          <Plastic mat={mat} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.18, 0.18, 0.22, 20]} />
          <Plastic mat={mat} color={catalog.accent ?? '#adb5bd'} />
        </mesh>
        {Array.from({ length: 6 }).map((_, i) => {
          const a = (i / 6) * Math.PI * 2
          return (
            <mesh
              key={i}
              position={[Math.cos(a) * 0.32, Math.sin(a) * 0.32, 0]}
              rotation={[0, 0, a]}
            >
              <boxGeometry args={[0.28, 0.06, 0.08]} />
              <Plastic mat={mat} color={catalog.accent ?? '#ced4da'} />
            </mesh>
          )
        })}
      </group>
    )
  }

  if (catalog.category === 'gears') {
    const radius = catalog.id === 'gear-large' ? 0.7 : 0.42
    const teeth = catalog.id === 'gear-large' ? 16 : 12
    return (
      <group>
        <mesh>
          <cylinderGeometry args={[radius * 0.7, radius * 0.7, 0.18, 24]} />
          <Plastic mat={mat} />
        </mesh>
        {Array.from({ length: teeth }).map((_, i) => {
          const a = (i / teeth) * Math.PI * 2
          return (
            <mesh
              key={i}
              position={[Math.cos(a) * radius * 0.85, Math.sin(a) * radius * 0.85, 0]}
              rotation={[0, 0, a]}
            >
              <boxGeometry args={[0.16, 0.14, 0.2]} />
              <Plastic mat={mat} />
            </mesh>
          )
        })}
        <mesh>
          <cylinderGeometry args={[0.12, 0.12, 0.28, 16]} />
          <Plastic mat={mat} color="#495057" />
        </mesh>
      </group>
    )
  }

  return <ConnectorMesh catalog={catalog} mat={mat} />
}
