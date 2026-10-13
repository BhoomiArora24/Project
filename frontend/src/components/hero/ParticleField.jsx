import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// A depth slab of dust (x/y spread, z from z0 to z1). Stack several slabs for foreground/mid/background layers.
export default function ParticleField({ count = 100, w = 9, h = 5, z0 = -6, z1 = 3, size = 0.024, opacity = 0.4, color = '#A78BFA', intro, reduced }) {
  const ref = useRef()
  const positions = useMemo(() => {
    const a = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      a[i * 3] = (Math.random() - 0.5) * 2 * w
      a[i * 3 + 1] = (Math.random() - 0.5) * 2 * h
      a[i * 3 + 2] = z0 + Math.random() * (z1 - z0)
    }
    return a
  }, [count, w, h, z0, z1])
  const material = useMemo(() => new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true }), [color, size])
  useEffect(() => () => material.dispose(), [material])
  useFrame((_, dt) => {
    if (!reduced) ref.current.rotation.y += dt * 0.008
    material.opacity = opacity * intro.current.v
  })
  return (
    <points ref={ref} material={material}>
      <bufferGeometry><bufferAttribute attach="attributes-position" array={positions} count={count} itemSize={3} /></bufferGeometry>
    </points>
  )
}
