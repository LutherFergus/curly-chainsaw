import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { ContactShadows, Grid, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { getCatalogPiece, isConnectorLike, isShaftSleeve } from '../data/catalog'
import { useBuilderStore } from '../store/builderStore'
import { PieceMesh } from './pieces/PieceMesh'
import {
  allWorldPorts,
  hasInterlock,
  isCenterSocket,
  nearestInterlockOnPointer,
  shaftHintPort,
  occupancyKeys,
  pickConnectorAimPose,
  portOrbPosition,
  slidablePieceIds,
  nearestSlidablePiece,
  type PointerView,
} from '../lib/math'
import {
  aimCameraAt,
  captureCameraShot,
  lerpCameraShot,
  setOrbitControls,
  setOrbitTarget,
  type CameraShot,
} from '../lib/orbitBridge'

let skipPlaceClick = false

function viewFromEvent(e: ThreeEvent<PointerEvent | MouseEvent>): PointerView {
  return { ray: e.ray.clone(), camera: e.camera, ndc: e.pointer.clone() }
}

function consumePlaceClick() {
  if (!skipPlaceClick) return false
  skipPlaceClick = false
  return true
}

function PlacedPieces() {
  const pieces = useBuilderStore((s) => s.pieces)
  const connections = useBuilderStore((s) => s.connections)
  const selectedPieceId = useBuilderStore((s) => s.selectedPieceId)
  const selectPiece = useBuilderStore((s) => s.selectPiece)
  const tool = useBuilderStore((s) => s.tool)
  const selectedCatalogId = useBuilderStore((s) => s.selectedCatalogId)
  const updateGhost = useBuilderStore((s) => s.updateGhost)
  const placeGhost = useBuilderStore((s) => s.placeGhost)
  const rotateConnector = useBuilderStore((s) => s.rotateConnector)
  const tap = useRef<{ id: string; x: number; y: number } | null>(null)
  const slidableIds = useMemo(
    () => (tool === 'slide' ? slidablePieceIds(pieces, connections) : new Set<string>()),
    [tool, pieces, connections],
  )

  return (
    <group>
      {pieces.map((piece) => {
        const catalog = getCatalogPiece(piece.catalogId)
        if (!catalog) return null
        const selected = piece.id === selectedPieceId
        const placing = tool === 'place' && Boolean(selectedCatalogId)
        const slidable = slidableIds.has(piece.id)
        return (
          <group
            key={piece.id}
            position={piece.position}
            quaternion={piece.rotation}
            onPointerMove={(e) => {
              if (tool !== 'place') return
              e.stopPropagation()
              updateGhost(e.point.clone(), viewFromEvent(e))
            }}
            onPointerDown={(e) => {
              if (placing) return
              tap.current = { id: piece.id, x: e.clientX, y: e.clientY }
              e.stopPropagation()
              if (tool === 'select' || tool === 'slide') selectPiece(piece.id)
            }}
            onPointerUp={(e) => {
              if (placing || tool === 'slide') return
              const start = tap.current
              tap.current = null
              if (!start || start.id !== piece.id) return
              const dx = e.clientX - start.x
              const dy = e.clientY - start.y
              if (dx * dx + dy * dy > 100) return
              e.stopPropagation()
              if (isConnectorLike(catalog)) {
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
              updateGhost(e.point.clone(), viewFromEvent(e))
              placeGhost()
            }}
          >
            <PieceMesh
              catalog={catalog}
              emissive={selected ? '#fff3bf' : slidable ? '#74c0fc' : '#000000'}
              emissiveIntensity={selected ? 0.22 : slidable ? 0.18 : 0}
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
    if (group.current && ghost?.snap && !ghost.collision) {
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
  const blocked = ghost.collision

  return (
    <group ref={group} position={ghost.position} quaternion={ghost.rotation}>
      <PieceMesh
        catalog={catalog}
        opacity={blocked ? 0.42 : aiming ? 0.82 : 0.55}
        emissive={blocked ? '#fa5252' : ghost.snap ? '#69db7c' : '#74c0fc'}
        emissiveIntensity={blocked ? 0.7 : ghost.snap ? (aiming ? 0.5 : 0.35) : 0.12}
      />
    </group>
  )
}

function SnapHints() {
  const pieces = useBuilderStore((s) => s.pieces)
  const connections = useBuilderStore((s) => s.connections)
  const tool = useBuilderStore((s) => s.tool)
  const selectedCatalogId = useBuilderStore((s) => s.selectedCatalogId)
  const ghost = useBuilderStore((s) => s.ghost)
  const perpSnap = useBuilderStore((s) => s.perpSnap)
  const rodAim = useBuilderStore((s) => s.rodAim)

  const catalog = selectedCatalogId ? getCatalogPiece(selectedCatalogId) : undefined
  const placingRod = catalog?.category === 'rods'
  const placingConnector = catalog ? isConnectorLike(catalog) : false
  const placingSleeve = catalog ? isShaftSleeve(catalog) : false
  const placingSlotted = catalog ? hasInterlock(catalog) : false

  const freePorts = useMemo(() => {
    if (tool !== 'place' || !selectedCatalogId) return []
    if (placingConnector || placingSleeve) {
      const cursor = rodAim?.targetPortId === 'shaft'
        ? new THREE.Vector3(...rodAim.tip)
        : ghost
          ? new THREE.Vector3(...ghost.position)
          : new THREE.Vector3(0, 0.35, 0)
      const shafts = pieces
        .map((piece) => shaftHintPort(piece, cursor))
        .filter((p): p is NonNullable<typeof p> => Boolean(p))
      if (perpSnap || placingSleeve) {
        if (catalog?.category === 'gears') {
          const occupied = occupancyKeys(pieces, connections)
          const meshes = allWorldPorts(pieces, occupied).filter(
            (p) => p.kind === 'gear-mesh' && !p.occupied,
          )
          return [...shafts, ...meshes]
        }
        return shafts
      }
      const occupied = occupancyKeys(pieces, connections)
      const world = allWorldPorts(pieces, occupied).filter((p) => !p.occupied)
      return [...world, ...shafts]
    }
    const occupied = occupancyKeys(pieces, connections)
    return allWorldPorts(pieces, occupied).filter((p) => !p.occupied)
  }, [
    pieces,
    connections,
    tool,
    selectedCatalogId,
    perpSnap,
    placingConnector,
    placingSleeve,
    catalog,
    rodAim,
    ghost,
  ])

  const hints = freePorts.filter((p) => {
    if (p.kind === 'shaft') return placingConnector || placingSleeve
    if (p.kind === 'gear-mesh') return catalog?.category === 'gears'
    if (p.kind === 'connector-lug') return placingConnector
    if (placingRod) return p.kind === 'socket'
    if (placingSlotted) return p.kind === 'interlock' || p.kind === 'rod-end'
    if (p.kind === 'interlock') return false
    return true
  })
  if (!hints.length) return null

  const hoverKey = ghost?.snap ? `${ghost.snap.targetPieceId}:${ghost.snap.targetPortId}` : null

  return (
    <group renderOrder={20}>
      {hints.map((port) => {
        const key = `${port.pieceId}:${port.portId}`
        const hovered = key === hoverKey
        const center = port.kind === 'socket' && isCenterSocket(port.portId)
        const slot = port.kind === 'interlock'
        const shaft = port.kind === 'shaft'
        const mesh = port.kind === 'gear-mesh'
        const color = hovered
          ? '#69db7c'
          : slot
            ? '#e64980'
            : shaft
              ? '#ff922b'
              : mesh
                ? '#9775fa'
                : center
                  ? '#c0eb75'
                  : port.kind === 'socket'
                    ? '#ffd43b'
                    : '#66d9e8'
        const emissive = hovered
          ? '#51cf66'
          : slot
            ? '#d6336c'
            : shaft
              ? '#f76707'
              : mesh
                ? '#845ef7'
                : center
                  ? '#82c91e'
                  : port.kind === 'socket'
                    ? '#fcc419'
                    : '#22b8cf'
        const radius = hovered ? 0.13 : slot ? 0.12 : shaft ? 0.11 : mesh ? 0.1 : center ? 0.08 : 0.1
        const pos = portOrbPosition(port)
        return (
          <mesh key={key} position={pos} renderOrder={20}>
            <sphereGeometry args={[radius, 16, 16]} />
            <meshStandardMaterial
              color={color}
              emissive={emissive}
              emissiveIntensity={hovered ? 1.1 : slot ? 0.85 : 0.65}
              transparent
              opacity={hovered ? 1 : 0.92}
              depthTest={false}
              depthWrite={false}
            />
          </mesh>
        )
      })}
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
    updateGhost(e.point.clone(), viewFromEvent(e))
  }

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (consumePlaceClick()) return
    e.stopPropagation()
    if (tool === 'place') {
      updateGhost(e.point.clone(), viewFromEvent(e))
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

/** Keep ghost aligned to the pointer ray without spamming store updates. */
function CursorTracker() {
  const tool = useBuilderStore((s) => s.tool)
  const updateGhost = useBuilderStore((s) => s.updateGhost)
  const { raycaster, camera, pointer } = useThree()
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])
  const hit = useMemo(() => new THREE.Vector3(), [])
  const lastPoint = useRef(new THREE.Vector3(Number.NaN, 0, 0))
  const lastDir = useRef(new THREE.Vector3(Number.NaN, 0, 0))

  const lastNdc = useRef(new THREE.Vector2(Number.NaN, 0))

  useFrame(() => {
    const rodAim = useBuilderStore.getState().rodAim
    if (rodAim?.dragging || useBuilderStore.getState().rodSteer || useBuilderStore.getState().slotSteer) return
    if (tool !== 'place') return
    raycaster.setFromCamera(pointer, camera)
    const ray = raycaster.ray
    const sample = hit
    if (rodAim) {
      const tip = new THREE.Vector3(...rodAim.tip)
      ray.closestPointToPoint(tip, sample)
    } else if (!ray.intersectPlane(plane, sample)) {
      sample.copy(ray.origin).addScaledVector(ray.direction, 4)
    }
    const moved = lastPoint.current.distanceToSquared(sample) > 1e-6
    const turned = lastDir.current.distanceToSquared(ray.direction) > 1e-8
    const shifted = lastNdc.current.distanceToSquared(pointer) > 1e-8
    if (!moved && !turned && !shifted) return
    lastPoint.current.copy(sample)
    lastDir.current.copy(ray.direction)
    lastNdc.current.copy(pointer)
    updateGhost(sample.clone(), { ray: ray.clone(), camera, ndc: pointer.clone() })
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

function pointerView(
  event: PointerEvent,
  canvas: HTMLCanvasElement,
  camera: THREE.Camera,
): PointerView {
  const rect = canvas.getBoundingClientRect()
  const ndc = new THREE.Vector2(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    -((event.clientY - rect.top) / rect.height) * 2 + 1,
  )
  const raycaster = new THREE.Raycaster()
  raycaster.setFromCamera(ndc, camera)
  return { ray: raycaster.ray.clone(), camera, ndc }
}

function pointerToWorkPoint(
  event: PointerEvent,
  canvas: HTMLCanvasElement,
  camera: THREE.Camera,
  workNormal: [number, number, number],
): THREE.Vector3 | null {
  const { ray } = pointerView(event, canvas, camera)
  const plane = new THREE.Plane()
  plane.setFromNormalAndCoplanarPoint(
    new THREE.Vector3(...workNormal).normalize(),
    new THREE.Vector3(0, 0.35, 0),
  )
  const hit = new THREE.Vector3()
  if (!ray.intersectPlane(plane, hit)) return null
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
      const view = pointerView(event, canvas, camera)
      const hit = pointerToWorkPoint(event, canvas, camera, state.workNormal)
      const fallback = new THREE.Vector3(0, 0.35, 0)
      dragging.current = true
      state.beginRodSteer(hit ?? fallback)
      state.steerRod(hit ?? fallback, view)
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
    }

    const onMove = (event: PointerEvent) => {
      if (!dragging.current) return
      const state = useBuilderStore.getState()
      if (!state.rodSteer) return
      const view = pointerView(event, canvas, camera)
      const hit = pointerToWorkPoint(event, canvas, camera, state.workNormal)
      state.steerRod(hit ?? new THREE.Vector3(...state.rodSteer.anchor), view)
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

function SlotSteerGestures() {
  const { camera, gl } = useThree()
  const dragging = useRef(false)

  useEffect(() => {
    const canvas = gl.domElement

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return
      const state = useBuilderStore.getState()
      if (state.tool !== 'place' || !state.selectedCatalogId || state.rodAim) return
      const catalog = getCatalogPiece(state.selectedCatalogId)
      if (!catalog || !hasInterlock(catalog)) return
      const view = pointerView(event, canvas, camera)
      const occupied = occupancyKeys(state.pieces, state.connections)
      const freePorts = allWorldPorts(state.pieces, occupied).filter((p) => !p.occupied)
      const hovered = nearestInterlockOnPointer(freePorts, view)
      if (!hovered) return
      dragging.current = true
      state.beginSlotSteer(hovered)
      state.steerSlot(view)
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
    }

    const onMove = (event: PointerEvent) => {
      if (!dragging.current) return
      const state = useBuilderStore.getState()
      if (!state.slotSteer) return
      state.steerSlot(pointerView(event, canvas, camera))
    }

    const onUp = () => {
      if (!dragging.current) return
      dragging.current = false
      const state = useBuilderStore.getState()
      if (state.slotSteer && state.ghost?.snap) {
        skipPlaceClick = true
        state.placeGhost()
      }
      state.endSlotSteer()
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

function SlideGestures() {
  const { camera, gl } = useThree()
  const dragging = useRef(false)
  const tool = useBuilderStore((s) => s.tool)
  const slide = useBuilderStore((s) => s.slide)

  useEffect(() => {
    const canvas = gl.domElement
    canvas.style.cursor = tool === 'slide' ? (slide ? 'grabbing' : 'grab') : ''
    return () => {
      canvas.style.cursor = ''
    }
  }, [tool, slide, gl])

  useEffect(() => {
    const canvas = gl.domElement

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return
      const state = useBuilderStore.getState()
      if (state.tool !== 'slide') return
      const view = pointerView(event, canvas, camera)
      const hit = nearestSlidablePiece(state.pieces, state.connections, view.ray)
      if (!hit) return
      if (!state.beginSlide(hit.id, view.ray)) return
      dragging.current = true
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
    }

    const onMove = (event: PointerEvent) => {
      if (!dragging.current) return
      const state = useBuilderStore.getState()
      if (!state.slide) return
      state.steerSlide(pointerView(event, canvas, camera).ray)
    }

    const onUp = () => {
      if (!dragging.current) return
      dragging.current = false
      useBuilderStore.getState().endSlide()
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
  const slotSteer = useBuilderStore((s) => s.slotSteer)
  const selectedCatalogId = useBuilderStore((s) => s.selectedCatalogId)
  const tool = useBuilderStore((s) => s.tool)
  const slide = useBuilderStore((s) => s.slide)
  const placingRod =
    tool === 'place' && getCatalogPiece(selectedCatalogId ?? '')?.category === 'rods'
  const lockView = Boolean(rodAim) || Boolean(slotSteer) || placingRod || Boolean(slide)
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
      <SlotSteerGestures />
      <SlideGestures />
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
