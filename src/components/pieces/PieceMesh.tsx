import { useMemo } from 'react'
import * as THREE from 'three'
import type { CatalogPiece, ConnectorVariant } from '../../types/knex'
import {
  FULL_CLIP_ANGLES,
  HALF_CLIP_ANGLES,
  HUB_FULL_CLIP_ANGLES,
  HUB_HEIGHT,
  HUB_RADIUS,
  NESTED_FULL_CLIP_ANGLES,
  NESTED_HALF_CLIP_ANGLES,
  ROD_RADIUS_SCENE,
  SOCKET_RADIUS,
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
 * Open C-clip — opposite of a rod end.
 * Mouth opens along hub axis (+Y) so a rod’s “+” snaps in perpendicularly.
 * Local +Z is radial out of the hub.
 */
function CClip({ mat, accent }: { mat: MatProps; accent?: string }) {
  const jawThick = 0.038
  const jawHeight = 0.155
  const jawLength = 0.2
  const mouth = ROD_RADIUS_SCENE * 2.15
  const zStart = SOCKET_RADIUS * 0.28
  const zMid = zStart + jawLength / 2

  return (
    <group>
      <mesh position={[-(mouth / 2 + jawThick / 2), 0, zMid]}>
        <boxGeometry args={[jawThick, jawHeight, jawLength]} />
        <Plastic mat={mat} />
      </mesh>
      <mesh position={[mouth / 2 + jawThick / 2, 0, zMid]}>
        <boxGeometry args={[jawThick, jawHeight, jawLength]} />
        <Plastic mat={mat} />
      </mesh>
      {/* Bottom only — top open for perpendicular + snap */}
      <mesh position={[0, -(jawHeight / 2 - jawThick / 2), zMid]}>
        <boxGeometry args={[mouth + jawThick * 2, jawThick, jawLength]} />
        <Plastic mat={mat} />
      </mesh>
      <mesh position={[0, 0, zStart - 0.012]}>
        <boxGeometry args={[mouth + jawThick * 2, jawHeight * 0.9, 0.04]} />
        <Plastic mat={mat} color={accent ?? mat.color} />
      </mesh>
      {/* Inward snap bumps that catch the rod-end groove */}
      {([-1, 1] as const).map((side) => (
        <mesh
          key={side}
          position={[side * (mouth / 2 - 0.012), 0.012, zStart + jawLength * 0.55]}
        >
          <sphereGeometry args={[0.022, 10, 10]} />
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

/** Rectangular center notch / rail used to slide connectors together. */
function InterlockSlot({
  mat,
  half = false,
}: {
  mat: MatProps
  half?: boolean
}) {
  const slotW = HUB_HEIGHT * 1.04
  const slotD = half ? 0.22 : 0.38
  const slotH = HUB_HEIGHT * 1.04
  return (
    <group>
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
      {half && (
        <mesh position={[0, 0, -slotD / 2 - 0.02]}>
          <boxGeometry args={[slotW * 1.2, slotH * 1.05, 0.05]} />
          <Plastic mat={mat} />
        </mesh>
      )}
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
              <mesh position={[0, side * (hubH / 2 + 0.001), 0]} rotation={[Math.PI / 2, 0, 0]}>
                <ringGeometry args={[holeR, hubR * 0.92, 22]} />
                <Plastic mat={plateMat} color={accent ?? plateMat.color} />
              </mesh>
              <mesh position={[0, side * (hubH / 2 + 0.012), 0]}>
                <cylinderGeometry args={[hubR * 1.06, hubR * 1.06, 0.02, 22]} />
                <Plastic mat={plateMat} />
              </mesh>
            </group>
          ))}
        </>
      )}

      {nested && (
        <mesh renderOrder={1}>
          {/* After Rx(90): fills the first plate’s slot without a second hub cylinder. */}
          <boxGeometry args={[hubH * 0.92, hubH * 0.92, hubR * 2 * 0.92]} />
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
        <torusGeometry args={[0.18, 0.012, 8, 28]} />
        <Plastic mat={plateMat} />
      </mesh>

      {slotted && !nested && <InterlockSlot mat={plateMat} half={half} />}

      {half && !nested && (
        <mesh position={[0, 0, -0.12]} rotation={[0, 0, 0]}>
          <boxGeometry args={[0.42, hubH * 0.95, 0.06]} />
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
  /** Second plate stands up through the first plate’s slot (same recipe as grey+blue). */
  const nestRx: [number, number, number] = [Math.PI / 2, 0, 0]

  if (variant === 'double-full') {
    return (
      <group>
        <ConnectorPlate mat={mat} color={fullColor} angles={HUB_FULL_CLIP_ANGLES} slotted />
        <group rotation={nestRx}>
          <ConnectorPlate mat={mat} color={fullColor} angles={NESTED_FULL_CLIP_ANGLES} nested />
        </group>
      </group>
    )
  }

  if (variant === 'full-half') {
    return (
      <group>
        <ConnectorPlate mat={mat} color={fullColor} angles={HUB_FULL_CLIP_ANGLES} slotted />
        <group rotation={nestRx}>
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
        <group rotation={nestRx}>
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
      slotted={catalog.ports.some((p) => p.kind === 'interlock')}
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
    const length = catalog.length ?? 1
    const coreRadius = ROD_RADIUS_SCENE * 0.42
    const finWidth = ROD_RADIUS_SCENE * 0.62
    const finDepth = ROD_RADIUS_SCENE * 0.28
    const flangeRadius = ROD_RADIUS_SCENE * 1.05
    const flangeThickness = 0.05
    const grooveRadius = ROD_RADIUS_SCENE * 0.62
    const grooveLength = 0.09
    const shoulderLength = 0.07
    const shaftLength = Math.max(
      0.2,
      length - (flangeThickness + grooveLength + shoulderLength) * 2,
    )
    return (
      <group>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[coreRadius, coreRadius, shaftLength, 16]} />
          <Plastic mat={mat} />
        </mesh>
        {[
          [finWidth, finDepth],
          [finDepth, finWidth],
        ].map(([w, h], index) => (
          <mesh key={index}>
            <boxGeometry args={[w, h, shaftLength]} />
            <Plastic mat={mat} />
          </mesh>
        ))}
        {([-1, 1] as const).map((side) => {
          const end = (side * length) / 2
          const flangeCenter = end - side * (flangeThickness / 2)
          const grooveCenter = end - side * (flangeThickness + grooveLength / 2)
          const shoulderCenter =
            end - side * (flangeThickness + grooveLength + shoulderLength / 2)
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
              <mesh position={[0, 0, shoulderCenter]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry
                  args={[ROD_RADIUS_SCENE * 0.88, ROD_RADIUS_SCENE * 0.88, shoulderLength, 16]}
                />
                <Plastic mat={mat} />
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
