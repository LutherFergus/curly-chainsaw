import { useMemo } from 'react'
import * as THREE from 'three'
import type { CatalogPiece, ConnectorVariant } from '../../types/knex'
import {
  BLUE_CLIP_ANGLES,
  ROD_RADIUS_SCENE,
  SILVER_CLIP_ANGLES,
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
  const slotW = 0.11
  const slotD = half ? 0.2 : 0.34
  const slotH = 0.085
  return (
    <group>
      {/* Dark void reading as the through-slot */}
      <mesh position={[0, 0, half ? -0.05 : -0.02]}>
        <boxGeometry args={[slotW, slotH, slotD]} />
        <meshStandardMaterial
          color="#141518"
          roughness={0.75}
          transparent={mat.transparent}
          opacity={mat.opacity}
          depthWrite={mat.depthWrite}
        />
      </mesh>
      {/* Side walls of the notch */}
      {([-1, 1] as const).map((side) => (
        <mesh key={side} position={[side * (slotW / 2 + 0.018), 0, half ? -0.04 : -0.01]}>
          <boxGeometry args={[0.03, slotH * 1.15, slotD * 0.95]} />
          <Plastic mat={mat} />
        </mesh>
      ))}
      {half && (
        <mesh position={[0, 0, -0.16]}>
          <boxGeometry args={[slotW * 1.35, slotH * 1.1, 0.05]} />
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
  color,
}: {
  mat: MatProps
  accent?: string
  angles: readonly number[]
  half?: boolean
  color?: string
}) {
  const plateMat = color ? { ...mat, color } : mat
  const hubR = 0.11
  const hubH = 0.14
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

      {/* Light webbing rings between hub and clips */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.18, 0.012, 8, 28]} />
        <Plastic mat={plateMat} />
      </mesh>

      <InterlockSlot mat={plateMat} half={half} />

      {half && (
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
  const blue = '#1c7ed6'
  const silver = accent ?? '#adb5bd'

  if (variant === 'ball') {
    return (
      <group>
        <ConnectorPlate mat={mat} color={blue} angles={[0, 45, 90, 135, 180, 225, 270, 315]} />
        <group rotation={[Math.PI / 2, 0, 0]}>
          <ConnectorPlate mat={mat} color={blue} angles={[0, 45, 90, 135, 180, 225, 270, 315]} />
        </group>
      </group>
    )
  }

  if (variant === 'mixed') {
    return (
      <group>
        <ConnectorPlate mat={mat} color={blue} angles={[0, 45, 90, 135, 180, 225, 270, 315]} />
        <group rotation={[Math.PI / 2, 0, 0]}>
          <ConnectorPlate mat={mat} color={silver} angles={SILVER_CLIP_ANGLES} half />
        </group>
      </group>
    )
  }

  if (variant === 'corner') {
    return (
      <group>
        <ConnectorPlate mat={mat} color={silver} angles={SILVER_CLIP_ANGLES} half />
        <group rotation={[Math.PI / 2, 0, 0]}>
          <ConnectorPlate mat={mat} color={silver} angles={SILVER_CLIP_ANGLES} half />
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
    return list.length ? list : [...BLUE_CLIP_ANGLES]
  }, [catalog])

  if (variant === 'ball' || variant === 'mixed' || variant === 'corner') {
    return <AssembledHub variant={variant} mat={mat} accent={catalog.accent} />
  }

  if (variant === 'half') {
    return (
      <ConnectorPlate
        mat={mat}
        accent={catalog.accent}
        angles={SILVER_CLIP_ANGLES}
        half
      />
    )
  }

  return <ConnectorPlate mat={mat} accent={catalog.accent} angles={angles} />
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
