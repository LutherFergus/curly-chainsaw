import * as THREE from 'three'
import type { OrbitControls } from 'three-stdlib'

let controls: OrbitControls | null = null

export function setOrbitControls(next: OrbitControls | null) {
  controls = next
}

export function getOrbitControls(): OrbitControls | null {
  return controls
}

export function getViewDistance(): number {
  if (!controls) return 12
  return controls.object.position.distanceTo(controls.target)
}

export function orbitByDelta(dx: number, dy: number) {
  if (!controls) return
  const camera = controls.object
  const offset = new THREE.Vector3().subVectors(camera.position, controls.target)
  const spherical = new THREE.Spherical().setFromVector3(offset)
  spherical.theta -= dx * 0.008
  spherical.phi = THREE.MathUtils.clamp(spherical.phi - dy * 0.008, 0.04, Math.PI - 0.04)
  offset.setFromSpherical(spherical)
  camera.position.copy(controls.target).add(offset)
  camera.lookAt(controls.target)
  controls.update()
}

export function panByDelta(dx: number, dy: number) {
  if (!controls) return
  const camera = controls.object
  const distance = camera.position.distanceTo(controls.target)
  const panScale = distance * 0.0022
  const right = new THREE.Vector3()
  const up = new THREE.Vector3()
  right.setFromMatrixColumn(camera.matrix, 0).multiplyScalar(-dx * panScale)
  up.setFromMatrixColumn(camera.matrix, 1).multiplyScalar(dy * panScale)
  camera.position.add(right).add(up)
  controls.target.add(right).add(up)
  controls.update()
}

export function snapCameraToNormal(normal: THREE.Vector3) {
  if (!controls) return
  const camera = controls.object
  const distance = Math.max(4, getViewDistance())
  const dir = normal.clone().normalize()
  camera.up.set(0, 1, 0)
  camera.position.copy(controls.target).add(dir.multiplyScalar(distance))
  camera.lookAt(controls.target)
  controls.update()
}

export function setOrbitTarget(point: THREE.Vector3) {
  if (!controls) return
  const camera = controls.object
  const offset = new THREE.Vector3().subVectors(camera.position, controls.target)
  controls.target.copy(point)
  camera.position.copy(point).add(offset)
  camera.lookAt(controls.target)
  controls.update()
}

export interface CameraShot {
  target: THREE.Vector3
  position: THREE.Vector3
}

export function captureCameraShot(): CameraShot | null {
  if (!controls) return null
  return {
    target: controls.target.clone(),
    position: controls.object.position.clone(),
  }
}

export function lerpCameraShot(goal: CameraShot, t: number) {
  if (!controls) return
  const camera = controls.object
  camera.position.lerp(goal.position, t)
  controls.target.lerp(goal.target, t)
  camera.lookAt(controls.target)
  controls.update()
}

export function aimCameraAt(point: THREE.Vector3, distance: number, t: number) {
  if (!controls) return
  const camera = controls.object
  const offset = new THREE.Vector3().subVectors(camera.position, controls.target)
  if (offset.lengthSq() < 1e-6) offset.set(0, 0.4, 1)
  offset.setLength(distance)
  const goalPos = point.clone().add(offset)
  camera.position.lerp(goalPos, t)
  controls.target.lerp(point, t)
  camera.lookAt(controls.target)
  controls.update()
}
