import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import { Scene } from './Scene'

export function Viewer() {
  return (
    <div className="viewer">
      <Canvas
        shadows
        camera={{ position: [7, 6, 9], fov: 42, near: 0.1, far: 120 }}
        dpr={[1, 2]}
        gl={{ antialias: true }}
      >
        <Suspense fallback={null}>
          <Scene />
        </Suspense>
      </Canvas>
      <div className="viewer-hint">
        <span>Drag to orbit</span>
        <span>Scroll to zoom</span>
        <span>Click grid to place</span>
        <span>Yellow / cyan dots = open sockets & rod ends</span>
      </div>
    </div>
  )
}
