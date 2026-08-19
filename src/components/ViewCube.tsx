import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useBuilderStore } from '../store/builderStore'
import {
  orbitByDelta,
  panByDelta,
  snapCameraToNormal,
  getOrbitControls,
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

const CUBE_OPACITY = 0.4

function faceTexture(label: string, color: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, 256, 256)
  ctx.globalAlpha = 1
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 256, 256)
  ctx.strokeStyle = 'rgba(27, 36, 48, 0.35)'
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
  const { camera } = useThree()
  const drag = useRef<{
    pointerId: number
    x: number
    y: number
    moved: boolean
    face: FaceDef
  } | null>(null)
  const lastTap = useRef(0)
  const snapTimer = useRef<number | null>(null)
  const textures = useMemo(
    () => FACES.map((face) => faceTexture(face.label, face.color)),
    [],
  )
  const modeRef = useRef(cameraNavMode)
  modeRef.current = cameraNavMode

  useEffect(() => {
    return () => textures.forEach((texture) => texture.dispose())
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

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const session = drag.current
      if (!session || event.pointerId !== session.pointerId) return
      event.preventDefault()
      const dx = event.clientX - session.x
      const dy = event.clientY - session.y
      if (Math.hypot(dx, dy) > 3) session.moved = true
      session.x = event.clientX
      session.y = event.clientY
      if (modeRef.current === 'pan') panByDelta(dx, dy)
      else orbitByDelta(dx, dy)
    }

    const onUp = (event: PointerEvent) => {
      const session = drag.current
      if (!session || event.pointerId !== session.pointerId) return
      const wasDrag = session.moved
      const face = session.face
      drag.current = null
      if (wasDrag) return

      const now = performance.now()
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

    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      if (snapTimer.current) window.clearTimeout(snapTimer.current)
    }
  }, [toggleCameraNavMode])

  return (
    <group>
      <mesh>
        <boxGeometry args={[1.12, 1.12, 1.12]} />
        <meshStandardMaterial
          color="#f8f9fa"
          roughness={0.4}
          transparent
          opacity={CUBE_OPACITY}
          depthWrite={false}
        />
      </mesh>
      {FACES.map((face, index) => (
        <mesh
          key={face.id}
          position={face.normal.map((n) => n * 0.57) as [number, number, number]}
          rotation={face.rotation}
          onPointerDown={(event) => {
            event.stopPropagation()
            event.nativeEvent.preventDefault()
            drag.current = {
              pointerId: event.pointerId,
              x: event.clientX,
              y: event.clientY,
              moved: false,
              face,
            }
          }}
        >
          <planeGeometry args={[1.12, 1.12]} />
          <meshStandardMaterial
            map={textures[index]}
            roughness={0.35}
            metalness={0.04}
            transparent
            opacity={CUBE_OPACITY}
            depthWrite={false}
          />
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
        gl={{ alpha: true, antialias: true, premultipliedAlpha: false }}
        onCreated={({ gl, scene }) => {
          scene.background = null
          gl.setClearColor(0x000000, 0)
        }}
      >
        <ambientLight intensity={0.9} />
        <directionalLight position={[3, 5, 4]} intensity={1.05} />
        <CubeGizmo />
      </Canvas>
      <span className="view-cube-mode">{cameraNavMode === 'pan' ? 'PAN' : 'FLY'}</span>
    </div>
  )
}
