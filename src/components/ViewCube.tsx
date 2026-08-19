import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useBuilderStore } from '../store/builderStore'
import {
  getOrbitControls,
  orbitByDelta,
  panByDelta,
  snapCameraToNormal,
} from '../lib/orbitBridge'

type FaceId = 'front' | 'back' | 'right' | 'left' | 'top' | 'bottom'

interface FaceDef {
  id: FaceId
  label: string
  color: string
  normal: [number, number, number]
  rotation: [number, number, number]
}

const FACES: FaceDef[] = [
  { id: 'front', label: 'FRONT', color: '#74c0fc', normal: [0, 0, 1], rotation: [0, 0, 0] },
  { id: 'back', label: 'BACK', color: '#91a7ff', normal: [0, 0, -1], rotation: [0, Math.PI, 0] },
  { id: 'right', label: 'RIGHT', color: '#63e6be', normal: [1, 0, 0], rotation: [0, Math.PI / 2, 0] },
  { id: 'left', label: 'LEFT', color: '#ffe066', normal: [-1, 0, 0], rotation: [0, -Math.PI / 2, 0] },
  { id: 'top', label: 'TOP', color: '#ffc9c9', normal: [0, 1, 0], rotation: [-Math.PI / 2, 0, 0] },
  { id: 'bottom', label: 'BOT', color: '#ced4da', normal: [0, -1, 0], rotation: [Math.PI / 2, 0, 0] },
]

function faceTexture(label: string, color: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 256, 256)
  ctx.strokeStyle = 'rgba(27, 36, 48, 0.28)'
  ctx.lineWidth = 14
  ctx.strokeRect(8, 8, 240, 240)
  ctx.fillStyle = '#1b2430'
  ctx.font = 'bold 42px Sora, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, 128, 128)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

function CubeGizmo() {
  const cameraNavMode = useBuilderStore((s) => s.cameraNavMode)
  const toggleCameraNavMode = useBuilderStore((s) => s.toggleCameraNavMode)
  const { camera, gl } = useThree()
  const dragging = useRef(false)
  const moved = useRef(false)
  const last = useRef({ x: 0, y: 0 })
  const lastTap = useRef(0)
  const snapTimer = useRef<number | null>(null)
  const textures = useMemo(
    () => FACES.map((face) => faceTexture(face.label, face.color)),
    [],
  )

  useEffect(() => {
    return () => {
      textures.forEach((texture) => texture.dispose())
      if (snapTimer.current) window.clearTimeout(snapTimer.current)
    }
  }, [textures])

  useFrame(() => {
    const controls = getOrbitControls()
    if (!controls) return
    const mainCam = controls.object
    const dir = new THREE.Vector3().subVectors(mainCam.position, controls.target).normalize()
    camera.position.copy(dir.multiplyScalar(3.4))
    camera.up.copy(mainCam.up)
    camera.lookAt(0, 0, 0)
  })

  const finishPointer = (event: PointerEvent, face: FaceDef) => {
    const now = performance.now()
    const wasDrag = moved.current
    dragging.current = false
    moved.current = false
    try {
      gl.domElement.releasePointerCapture(event.pointerId)
    } catch {
      // already released
    }
    if (wasDrag) return
    if (now - lastTap.current < 320) {
      lastTap.current = 0
      if (snapTimer.current) {
        window.clearTimeout(snapTimer.current)
        snapTimer.current = null
      }
      toggleCameraNavMode()
      return
    }
    lastTap.current = now
    if (snapTimer.current) window.clearTimeout(snapTimer.current)
    snapTimer.current = window.setTimeout(() => {
      snapCameraToNormal(new THREE.Vector3(...face.normal))
      snapTimer.current = null
    }, 280)
  }

  return (
    <group>
      <mesh>
        <boxGeometry args={[1.18, 1.18, 1.18]} />
        <meshStandardMaterial color="#f1f3f5" roughness={0.45} />
      </mesh>
      {FACES.map((face, index) => (
        <mesh
          key={face.id}
          position={face.normal.map((n) => n * 0.6) as [number, number, number]}
          rotation={face.rotation}
          onPointerDown={(event) => {
            event.stopPropagation()
            dragging.current = true
            moved.current = false
            last.current = { x: event.clientX, y: event.clientY }
            gl.domElement.setPointerCapture(event.pointerId)
          }}
          onPointerMove={(event) => {
            if (!dragging.current) return
            event.stopPropagation()
            const dx = event.clientX - last.current.x
            const dy = event.clientY - last.current.y
            if (Math.hypot(dx, dy) > 3) moved.current = true
            last.current = { x: event.clientX, y: event.clientY }
            if (cameraNavMode === 'pan') panByDelta(dx, dy)
            else orbitByDelta(dx, dy)
          }}
          onPointerUp={(event) => {
            event.stopPropagation()
            finishPointer(event.nativeEvent, face)
          }}
          onPointerCancel={(event) => {
            dragging.current = false
            moved.current = false
            try {
              gl.domElement.releasePointerCapture(event.pointerId)
            } catch {
              // ignore
            }
          }}
        >
          <planeGeometry args={[1.16, 1.16]} />
          <meshStandardMaterial map={textures[index]} roughness={0.35} metalness={0.05} />
        </mesh>
      ))}
    </group>
  )
}

export function ViewCube() {
  const cameraNavMode = useBuilderStore((s) => s.cameraNavMode)

  return (
    <div className={`view-cube${cameraNavMode === 'pan' ? ' pan' : ''}`}>
      <Canvas
        camera={{ position: [2.2, 1.8, 2.6], fov: 40, near: 0.1, far: 20 }}
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <ambientLight intensity={0.85} />
        <directionalLight position={[3, 5, 4]} intensity={1.1} />
        <CubeGizmo />
      </Canvas>
      <span className="view-cube-mode">{cameraNavMode === 'pan' ? 'PAN' : 'FLY'}</span>
    </div>
  )
}
