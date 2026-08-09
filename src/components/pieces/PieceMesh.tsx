import { useMemo } from 'react'
import * as THREE from 'three'
import type { CatalogPiece } from '../../types/knex'
import { ROD_RADIUS_SCENE } from '../../data/catalog'

interface PieceMeshProps {
  catalog: CatalogPiece
  opacity?: number
  emissive?: string
  emissiveIntensity?: number
}

export function PieceMesh({
  catalog,
  opacity = 1,
  emissive = '#000000',
  emissiveIntensity = 0,
}: PieceMeshProps) {
  const transparent = opacity < 0.999

  const materialProps = {
    color: catalog.color,
    roughness: 0.35,
    metalness: 0.05,
    transparent,
    opacity,
    emissive,
    emissiveIntensity,
    depthWrite: !transparent,
  }

  if (catalog.category === 'rods') {
    const length = catalog.length ?? 1
    return (
      <mesh rotation={[Math.PI / 2, 0, 0] /* align cylinder to Z */}>
        <cylinderGeometry args={[ROD_RADIUS_SCENE, ROD_RADIUS_SCENE, length, 20]} />
        <meshStandardMaterial {...materialProps} />
        {/* End caps / slot nubs */}
        {([-length / 2, length / 2] as const).map((z, i) => (
          <mesh key={i} position={[0, z, 0]}>
            <sphereGeometry args={[ROD_RADIUS_SCENE * 1.15, 16, 16]} />
            <meshStandardMaterial {...materialProps} color={catalog.accent ?? catalog.color} />
          </mesh>
        ))}
      </mesh>
    )
  }

  if (catalog.category === 'wheels') {
    return (
      <group>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.55, 0.16, 16, 32]} />
          <meshStandardMaterial {...materialProps} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.18, 0.18, 0.22, 20]} />
          <meshStandardMaterial
            {...materialProps}
            color={catalog.accent ?? '#adb5bd'}
          />
        </mesh>
        {Array.from({ length: 6 }).map((_, i) => {
          const a = (i / 6) * Math.PI * 2
          return (
            <mesh key={i} position={[Math.cos(a) * 0.32, Math.sin(a) * 0.32, 0]} rotation={[0, 0, a]}>
              <boxGeometry args={[0.28, 0.06, 0.08]} />
              <meshStandardMaterial {...materialProps} color={catalog.accent ?? '#ced4da'} />
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
          <meshStandardMaterial {...materialProps} />
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
              <meshStandardMaterial {...materialProps} />
            </mesh>
          )
        })}
        <mesh>
          <cylinderGeometry args={[0.12, 0.12, 0.28, 16]} />
          <meshStandardMaterial {...materialProps} color="#495057" />
        </mesh>
      </group>
    )
  }

  // Connectors — hub + socket sleeves along each port
  return <ConnectorMesh catalog={catalog} materialProps={materialProps} />
}

function ConnectorMesh({
  catalog,
  materialProps,
}: {
  catalog: CatalogPiece
  materialProps: {
    color: string
    roughness: number
    metalness: number
    transparent: boolean
    opacity: number
    emissive: string
    emissiveIntensity: number
    depthWrite: boolean
  }
}) {
  const sleeves = useMemo(() => {
    return catalog.ports.map((port) => {
      const dir = new THREE.Vector3(...port.direction).normalize()
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir)
      const pos = new THREE.Vector3(...port.position)
      return { id: port.id, position: pos.toArray() as [number, number, number], quat }
    })
  }, [catalog])

  const isBall = catalog.id.includes('ball')

  return (
    <group>
      <mesh>
        {isBall ? (
          <sphereGeometry args={[0.26, 24, 24]} />
        ) : (
          <sphereGeometry args={[0.2, 20, 20]} />
        )}
        <meshStandardMaterial {...materialProps} />
      </mesh>
      {sleeves.map((s) => (
        <group key={s.id} position={s.position} quaternion={s.quat}>
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.11, 0.13, 0.22, 14]} />
            <meshStandardMaterial {...materialProps} />
          </mesh>
          <mesh position={[0, 0.18, 0]}>
            <boxGeometry args={[0.16, 0.06, 0.05]} />
            <meshStandardMaterial {...materialProps} color={catalog.accent ?? '#fff'} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
