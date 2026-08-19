import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { ContactShadows, Grid, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { getCatalogPiece } from '../data/catalog'
import { useBuilderStore } from '../store/builderStore'
import { PieceMesh } from './pieces/PieceMesh'
import { allWorldPorts, occupiedPortKeys, pickConnectorAimPose } from '../lib/math'
import {
  aimCameraAt,
  captureCameraShot,
  lerpCameraShot,
  setOrbitControls,
  setOrbitTarget,
  type CameraShot,
} from '../lib/orbitBridge'

let skipPlaceClick = false

function consumePlaceClick() {
  if (!skipPlaceClick) return false
  skipPlaceClick = false
  return true
}

function PlacedPieces() {
  const pieces = useBuilderStore((s) => s.pieces)
  const selectedPieceId = useBuilderStore((s) => s.selectedPieceId)
  const selectPiece = useBuilderStore((s) => s.selectPiece)
  const tool = useBuilderStore((s) => s.tool)
  const selectedCatalogId = useBuilderStore((s) => s.selectedCatalogId)
  const updateGhost = useBuilderStore((s) => s.updateGhost)
  const placeGhost = useBuilderStore((s) => s.placeGhost)
  const rotateConnector = useBuilderStore((s) => s.rotateConnector)
  const tap = useRef<{ id: string; x: number; y: number } | null>(null)

  return (
    <group>
      {pieces.map((piece) => {
        const catalog = getCatalogPiece(piece.catalogId)
        if (!catalog) return null
        const selected = piece.id === selectedPieceId
        const placing = tool === 'place' && Boolean(selectedCatalogId)
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
            onPointerDown={(e) => {
              if (placing) return
              tap.current = { id: piece.id, x: e.clientX, y: e.clientY }
              e.stopPropagation()
              if (tool === 'select') selectPiece(piece.id)
            }}
            onPointerUp={(e) => {
              if (placing) return
              const start = tap.current
              tap.current = null
              if (!start || start.id !== piece.id) return
              const dx = e.clientX - start.x
              const dy = e.clientY - start.y
              if (dx * dx + dy * dy > 100) return
              e.stopPropagation()
              if (catalog.category === 'connectors') {
                rotateConnector(piece.id, 'in-plane')
                return
              }
              selectPiece(piece.id)
            }}
            onPointerCancel={() => {
              tap.current = null
            }}
            onClick={(e) => {
              if (consumePlaceClick()) return
              e.stopPropagation()
              if (!placing) return
              updateGhost(e.point.clone())
              placeGhost()
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
  const rodAim = useBuilderStore((s) => s.rodAim)
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
  const aiming = Boolean(rodAim)

  return (
    <group ref={group} position={ghost.position} quaternion={ghost.rotation}>
      <PieceMesh
        catalog={catalog}
        opacity={aiming ? 0.82 : 0.55}
        emissive={ghost.snap ? '#69db7c' : '#74c0fc'}
        emissiveIntensity={ghost.snap ? (aiming ? 0.5 : 0.35) : 0.12}
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
    if (consumePlaceClick()) return
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
    const rodAim = useBuilderStore.getState().rodAim
    if (rodAim?.dragging || useBuilderStore.getState().rodSteer) return
    if (tool !== 'place') return
    raycaster.setFromCamera(pointer, camera)
    if (rodAim) {
      const tip = new THREE.Vector3(...rodAim.tip)
      const closest = new THREE.Vector3()
      raycaster.ray.closestPointToPoint(tip, closest)
      if (last.current.distanceToSquared(closest) < 0.0004) return
      last.current.copy(closest)
      updateGhost(closest.clone())
      return
    }
    if (!raycaster.ray.intersectPlane(plane, hit)) return
    raycaster.setFromCamera(pointer, camera)
    if (!raycaster.ray.intersectPlane(plane, hit)) return
    if (last.current.distanceToSquared(hit) < 0.0004) return
    last.current.copy(hit)
    updateGhost(hit.clone())
  })

  return null
}

function OrbitFocus() {
  const selectedPieceId = useBuilderStore((s) => s.selectedPieceId)
  const tool = useBuilderStore((s) => s.tool)
  const pieces = useBuilderStore((s) => s.pieces)

  useFrame(() => {
    if (useBuilderStore.getState().rodAim) return
    if (tool !== 'select' || !selectedPieceId) return
    const piece = pieces.find((p) => p.id === selectedPieceId)
    if (!piece) return
    setOrbitTarget(new THREE.Vector3(...piece.position))
  })

  return null
}

function RodAimMarkers() {
  const rodAim = useBuilderStore((s) => s.rodAim)
  if (!rodAim) return null
  const tip = rodAim.tip

  return (
    <group>
      <mesh position={tip}>
        <sphereGeometry args={[0.11, 16, 16]} />
        <meshStandardMaterial
          color="#66d9e8"
          emissive="#22b8cf"
          emissiveIntensity={0.85}
          transparent
          opacity={0.95}
        />
      </mesh>
      {rodAim.poses.map((pose, index) => {
        const active = index === rodAim.activeIndex
        const fan = new THREE.Vector3(...pose.fan).multiplyScalar(active ? 0.52 : 0.42)
        return (
          <mesh
            key={`${pose.localPortId}:${index}`}
            position={[tip[0] + fan.x, tip[1] + fan.y, tip[2] + fan.z]}
          >
            <sphereGeometry args={[active ? 0.09 : 0.055, 12, 12]} />
            <meshStandardMaterial
              color={active ? '#69db7c' : pose.inPlane ? '#ffd43b' : '#adb5bd'}
              emissive={active ? '#51cf66' : pose.inPlane ? '#fcc419' : '#868e96'}
              emissiveIntensity={active ? 0.9 : 0.35}
              transparent
              opacity={active ? 1 : 0.7}
            />
          </mesh>
        )
      })}
    </group>
  )
}

function RodAimCamera() {
  const rodAim = useBuilderStore((s) => s.rodAim)
  const saved = useRef<CameraShot | null>(null)

  useFrame(() => {
    if (rodAim) {
      if (!saved.current) saved.current = captureCameraShot()
      aimCameraAt(new THREE.Vector3(...rodAim.tip), 2.2, 0.16)
      return
    }
    if (!saved.current) return
    lerpCameraShot(saved.current, 0.16)
    const controlsShot = captureCameraShot()
    if (controlsShot && controlsShot.position.distanceTo(saved.current.position) < 0.08) {
      saved.current = null
    }
  })

  return null
}

function RodAimGestures() {
  const { camera, gl } = useThree()
  const dragging = useRef(false)

  useEffect(() => {
    const canvas = gl.domElement

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return
      const state = useBuilderStore.getState()
      if (!state.rodAim || state.tool !== 'place' || !state.selectedCatalogId) return
      dragging.current = true
      state.setRodAimDragging(true)
      const index = pickConnectorAimPose(
        state.rodAim.poses,
        new THREE.Vector3(...state.rodAim.tip),
        camera,
        event.clientX,
        event.clientY,
        canvas,
      )
      state.aimRodPose(index)
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
    }

    const onMove = (event: PointerEvent) => {
      if (!dragging.current) return
      const state = useBuilderStore.getState()
      if (!state.rodAim) return
      const index = pickConnectorAimPose(
        state.rodAim.poses,
        new THREE.Vector3(...state.rodAim.tip),
        camera,
        event.clientX,
        event.clientY,
        canvas,
      )
      if (index !== state.rodAim.activeIndex) state.aimRodPose(index)
    }

    const onUp = () => {
      if (!dragging.current) return
      dragging.current = false
      const state = useBuilderStore.getState()
      state.setRodAimDragging(false)
      if (state.rodAim && state.ghost?.snap) {
        skipPlaceClick = true
        state.placeGhost()
      }
    }

    canvas.addEventListener('pointerdown', onDown, { capture: true })
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      canvas.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [camera, gl])

  return null
}

function pointerToWorkPoint(
  event: PointerEvent,
  canvas: HTMLCanvasElement,
  camera: THREE.Camera,
  workNormal: [number, number, number],
): THREE.Vector3 | null {
  const rect = canvas.getBoundingClientRect()
  const ndc = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  )
  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(ndc, camera)
  const plane = new THREE.Plane()
  plane.setFromNormalAndCoplanarPoint(
    new THREE.Vector3(...workNormal).normalize(),
    new THREE.Vector3(0, 0.35, 0),
  )
  const hit = new THREE.Vector3()
  if (!raycaster.ray.intersectPlane(plane, hit)) return null
  return hit
}

function RodSteerGestures() {
  const { camera, gl } = useThree()
  const dragging = useRef(false)

  useEffect(() => {
    const canvas = gl.domElement

    const placingRod = () => {
      const state = useBuilderStore.getState()
      if (state.tool !== 'place' || !state.selectedCatalogId || state.rodAim) return false
      return getCatalogPiece(state.selectedCatalogId)?.category === 'rods'
    }

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return
      if (!placingRod()) return
      const state = useBuilderStore.getState()
      const hit = pointerToWorkPoint(event, canvas, camera, state.workNormal)
      if (!hit) return
      dragging.current = true
      state.beginRodSteer(hit)
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
    }

    const onMove = (event: PointerEvent) => {
      if (!dragging.current) return
      const state = useBuilderStore.getState()
      if (!state.rodSteer) return
      const hit = pointerToWorkPoint(event, canvas, camera, state.workNormal)
      if (hit) state.steerRod(hit)
    }

    const onUp = () => {
      if (!dragging.current) return
      dragging.current = false
      const state = useBuilderStore.getState()
      if (state.rodSteer && state.ghost) {
        skipPlaceClick = true
        state.placeGhost()
      }
      state.endRodSteer()
    }

    canvas.addEventListener('pointerdown', onDown, { capture: true })
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      canvas.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [camera, gl])

  return null
}

export function Scene() {
  const cameraNavMode = useBuilderStore((s) => s.cameraNavMode)
  const rodAim = useBuilderStore((s) => s.rodAim)
  const selectedCatalogId = useBuilderStore((s) => s.selectedCatalogId)
  const tool = useBuilderStore((s) => s.tool)
  const placingRod =
    tool === 'place' && getCatalogPiece(selectedCatalogId ?? '')?.category === 'rods'
  const lockView = Boolean(rodAim) || placingRod
  const controlsRef = useRef<OrbitControlsImpl>(null)
  const fly = cameraNavMode === 'fly' && !lockView

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
      <OrbitFocus />
      <RodAimCamera />
      <RodAimGestures />
      <RodSteerGestures />
      <PlacementPlane />
      <PlacedPieces />
      <GhostPiece />
      <SnapHints />
      <RodAimMarkers />

      <ContactShadows
        position={[0, 0.01, 0]}
        opacity={0.35}
        scale={40}
        blur={2.5}
        far={12}
      />

      <OrbitControls
        ref={(node) => {
          controlsRef.current = node
          setOrbitControls(node)
        }}
        makeDefault
        enableRotate={fly}
        enablePan={!lockView}
        screenSpacePanning
        minPolarAngle={0.04}
        maxPolarAngle={Math.PI - 0.04}
        minDistance={0.45}
        maxDistance={60}
        target={[0, 0.5, 0]}
        mouseButtons={{
          LEFT: fly ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        }}
        touches={{
          ONE: fly ? THREE.TOUCH.ROTATE : THREE.TOUCH.PAN,
          TWO: THREE.TOUCH.DOLLY_PAN,
        }}
      />
    </>
  )
}
