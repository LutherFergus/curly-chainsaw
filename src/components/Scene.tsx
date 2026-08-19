import { useMemo, useRef } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { ContactShadows, Grid, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { getCatalogPiece } from '../data/catalog'
import { useBuilderStore } from '../store/builderStore'
import { PieceMesh } from './pieces/PieceMesh'
import { allWorldPorts, occupiedPortKeys } from '../lib/math'

function PlacedPieces() {
  const pieces = useBuilderStore((s) => s.pieces)
  const selectedPieceId = useBuilderStore((s) => s.selectedPieceId)
  const selectPiece = useBuilderStore((s) => s.selectPiece)
  const tool = useBuilderStore((s) => s.tool)
  const updateGhost = useBuilderStore((s) => s.updateGhost)
  const placeGhost = useBuilderStore((s) => s.placeGhost)

  return (
    <group>
      {pieces.map((piece) => {
        const catalog = getCatalogPiece(piece.catalogId)
        if (!catalog) return null
        const selected = piece.id === selectedPieceId
        return (
          <group
            key={piece.id}
            position={piece.position}
            quaternion={piece.rotation}
            onPointerMove={(e) => {
              if (tool !== 'place') return
              e.stopPropagation()
              updateGhost(e.point.clone())
            }}
            onClick={(e) => {
              e.stopPropagation()
              if (tool === 'place') {
                updateGhost(e.point.clone())
                placeGhost()
                return
              }
              selectPiece(piece.id)
            }}
            onPointerDown={(e) => {
              if (tool === 'select') {
                e.stopPropagation()
                selectPiece(piece.id)
              }
            }}
          >
            <PieceMesh
              catalog={catalog}
              emissive={selected ? '#fff3bf' : '#000000'}
              emissiveIntensity={selected ? 0.22 : 0}
            />
          </group>
        )
      })}
    </group>
  )
}

function GhostPiece() {
  const ghost = useBuilderStore((s) => s.ghost)
  const pulse = useRef(0)
  const group = useRef<THREE.Group>(null)

  useFrame((_, dt) => {
    pulse.current += dt
    if (group.current && ghost?.snap) {
      const s = 1 + Math.sin(pulse.current * 8) * 0.02
      group.current.scale.setScalar(s)
    } else if (group.current) {
      group.current.scale.setScalar(1)
    }
  })

  if (!ghost) return null
  const catalog = getCatalogPiece(ghost.catalogId)
  if (!catalog) return null

  return (
    <group ref={group} position={ghost.position} quaternion={ghost.rotation}>
      <PieceMesh
        catalog={catalog}
        opacity={0.55}
        emissive={ghost.snap ? '#69db7c' : '#74c0fc'}
        emissiveIntensity={ghost.snap ? 0.35 : 0.12}
      />
    </group>
  )
}

function SnapHints() {
  const pieces = useBuilderStore((s) => s.pieces)
  const connections = useBuilderStore((s) => s.connections)
  const tool = useBuilderStore((s) => s.tool)
  const selectedCatalogId = useBuilderStore((s) => s.selectedCatalogId)

  const freePorts = useMemo(() => {
    if (tool !== 'place' || !selectedCatalogId) return []
    const occupied = occupiedPortKeys(connections)
    return allWorldPorts(pieces, occupied).filter((p) => !p.occupied)
  }, [pieces, connections, tool, selectedCatalogId])

  if (!freePorts.length) return null

  return (
    <group>
      {freePorts.map((port) => (
        <mesh key={`${port.pieceId}:${port.portId}`} position={port.position}>
          <sphereGeometry args={[0.07, 12, 12]} />
          <meshStandardMaterial
            color={
              port.kind === 'socket'
                ? '#ffd43b'
                : port.kind === 'interlock'
                  ? '#ff922b'
                  : '#66d9e8'
            }
            emissive={
              port.kind === 'socket'
                ? '#fcc419'
                : port.kind === 'interlock'
                  ? '#fd7e14'
                  : '#22b8cf'
            }
            emissiveIntensity={0.4}
            transparent
            opacity={0.85}
          />
        </mesh>
      ))}
    </group>
  )
}

function PlacementPlane() {
  const updateGhost = useBuilderStore((s) => s.updateGhost)
  const placeGhost = useBuilderStore((s) => s.placeGhost)
  const clearGhost = useBuilderStore((s) => s.clearGhost)
  const tool = useBuilderStore((s) => s.tool)
  const selectPiece = useBuilderStore((s) => s.selectPiece)

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (tool !== 'place') return
    updateGhost(e.point.clone())
  }

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (tool === 'place') {
      updateGhost(e.point.clone())
      placeGhost()
      return
    }
    selectPiece(null)
  }

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      onPointerMove={onMove}
      onPointerOut={clearGhost}
      onClick={onClick}
    >
      <planeGeometry args={[80, 80]} />
      <meshStandardMaterial visible={false} />
    </mesh>
  )
}

/** Keep ghost aligned from the ground plane without spamming store updates. */
function CursorTracker() {
  const tool = useBuilderStore((s) => s.tool)
  const updateGhost = useBuilderStore((s) => s.updateGhost)
  const { raycaster, camera, pointer } = useThree()
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])
  const hit = useMemo(() => new THREE.Vector3(), [])
  const last = useRef(new THREE.Vector3(Number.NaN, 0, 0))

  useFrame(() => {
    if (tool !== 'place') return
    raycaster.setFromCamera(pointer, camera)
    if (!raycaster.ray.intersectPlane(plane, hit)) return
    if (last.current.distanceToSquared(hit) < 0.0004) return
    last.current.copy(hit)
    updateGhost(hit.clone())
  })

  return null
}

export function Scene() {
  return (
    <>
      <color attach="background" args={['#d8e2ec']} />
      <fog attach="fog" args={['#d8e2ec', 28, 55]} />
      <ambientLight intensity={0.55} />
      <directionalLight
        castShadow
        position={[8, 14, 6]}
        intensity={1.15}
        shadow-mapSize={[2048, 2048]}
      />
      <hemisphereLight args={['#f8fbff', '#9aa8b5', 0.45]} />

      <Grid
        args={[40, 40]}
        cellSize={0.5}
        sectionSize={2}
        cellColor="#b7c4d1"
        sectionColor="#8fa0b2"
        fadeDistance={32}
        fadeStrength={1.4}
        infiniteGrid
        position={[0, 0.001, 0]}
      />

      <CursorTracker />
      <PlacementPlane />
      <PlacedPieces />
      <GhostPiece />
      <SnapHints />

      <ContactShadows
        position={[0, 0.01, 0]}
        opacity={0.35}
        scale={40}
        blur={2.5}
        far={12}
      />

      <OrbitControls
        makeDefault
        maxPolarAngle={Math.PI * 0.49}
        minDistance={0.45}
        maxDistance={60}
        target={[0, 0.5, 0]}
      />
    </>
  )
}
