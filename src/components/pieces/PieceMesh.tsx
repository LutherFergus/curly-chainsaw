import { useMemo } from 'react'
import * as THREE from 'three'
import type { CatalogPiece } from '../../types/knex'
import { ROD_RADIUS_SCENE } from '../../data/catalog'

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
 * Classic open C-clip: opposite of a rod end.
 * - Open on top (hub-axis) so a rod’s “+” shaft snaps in perpendicularly
 * - Side jaws grip the + fins
 * - Inner ribs catch the rod-end groove for straight-in snaps
 *
 * Local frame: +Z radial (out of hub), +Y hub axis (clip mouth opens ±Y).
 */
function CClip({ mat, accent }: { mat: MatProps; accent?: string }) {
  const jawThick = 0.038
  const jawHeight = 0.16
  const jawLength = 0.2
  // Opening wide enough for the rod “+” cross-section
  const mouth = ROD_RADIUS_SCENE * 2.15
  const zStart = 0.08
  const zMid = zStart + jawLength / 2

  return (
    <group>
      {/* Left jaw */}
      <mesh position={[-(mouth / 2 + jawThick / 2), 0, zMid]}>
        <boxGeometry args={[jawThick, jawHeight, jawLength]} />
        <Plastic mat={mat} />
      </mesh>
      {/* Right jaw */}
      <mesh position={[mouth / 2 + jawThick / 2, 0, zMid]}>
        <boxGeometry args={[jawThick, jawHeight, jawLength]} />
        <Plastic mat={mat} />
      </mesh>
      {/* Bottom bridge — top stays open for perpendicular “+” snap-in */}
      <mesh position={[0, -(jawHeight / 2 - jawThick / 2), zMid]}>
        <boxGeometry args={[mouth + jawThick * 2, jawThick, jawLength]} />
        <Plastic mat={mat} />
      </mesh>
      {/* Inner back wall (socket base) */}
      <mesh position={[0, 0, zStart - 0.015]}>
        <boxGeometry args={[mouth + jawThick * 2, jawHeight * 0.92, 0.04]} />
        <Plastic mat={mat} color={accent ?? mat.color} />
      </mesh>
      {/* Groove-catching ribs near the outer mouth (mate to rod-end neck) */}
      {([-1, 1] as const).map((side) => (
        <mesh
          key={side}
          position={[side * (mouth / 2 - 0.01), 0.015, zStart + jawLength - 0.035]}
        >
          <boxGeometry args={[0.028, 0.055, 0.04]} />
          <Plastic mat={mat} color={accent ?? '#ffffff'} />
        </mesh>
      ))}
      {/* Small top lips so the C reads clearly while staying open */}
      {([-1, 1] as const).map((side) => (
        <mesh
          key={`lip-${side}`}
          position={[side * (mouth / 2 + jawThick / 2), jawHeight / 2 - 0.012, zMid]}
        >
          <boxGeometry args={[jawThick * 1.15, 0.024, jawLength * 0.85]} />
          <Plastic mat={mat} />
        </mesh>
      ))}
    </group>
  )
}

function ConnectorMesh({
  catalog,
  mat,
}: {
  catalog: CatalogPiece
  mat: MatProps
}) {
  const hubR = 0.12
  const hubH = 0.15
  const holeR = ROD_RADIUS_SCENE * 1.05

  const clips = useMemo(() => {
    return catalog.ports.map((port) => {
      const zAxis = new THREE.Vector3(...port.direction).normalize()
      // Keep clip mouth aligned with hub axis (Y) for planar connectors.
      let yAxis = new THREE.Vector3(0, 1, 0)
      if (Math.abs(zAxis.dot(yAxis)) > 0.9) {
        yAxis = new THREE.Vector3(1, 0, 0)
      }
      const xAxis = new THREE.Vector3().crossVectors(yAxis, zAxis).normalize()
      yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize()
      const matrix = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis)
      const quat = new THREE.Quaternion().setFromRotationMatrix(matrix)
      return { id: port.id, quat }
    })
  }, [catalog])

  return (
    <group>
      {/* Flat hub body */}
      <mesh>
        <cylinderGeometry args={[hubR, hubR, hubH, 24]} />
        <Plastic mat={mat} />
      </mesh>
      {/* Through-hole cues (rod can pass as an axle) */}
      {([-1, 1] as const).map((side) => (
        <group key={side}>
          <mesh position={[0, side * (hubH / 2 + 0.001), 0]} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[holeR, hubR * 0.95, 24]} />
            <Plastic mat={mat} color={catalog.accent ?? mat.color} />
          </mesh>
          <mesh position={[0, side * (hubH / 2 + 0.002), 0]}>
            <cylinderGeometry args={[holeR, holeR, 0.012, 16]} />
            <meshStandardMaterial
              color="#1a1b1e"
              roughness={0.7}
              transparent={mat.transparent}
              opacity={mat.opacity}
              depthWrite={mat.depthWrite}
            />
          </mesh>
          <mesh position={[0, side * (hubH / 2 + 0.014), 0]}>
            <cylinderGeometry args={[hubR * 1.08, hubR * 1.08, 0.022, 24]} />
            <Plastic mat={mat} />
          </mesh>
        </group>
      ))}

      {clips.map((clip) => (
        <group key={clip.id} quaternion={clip.quat}>
          <CClip mat={mat} accent={catalog.accent} />
        </group>
      ))}
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
    roughness: 0.32,
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
