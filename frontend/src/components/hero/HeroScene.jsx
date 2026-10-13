import { useEffect, useRef, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import SceneLighting from './SceneLighting.jsx'
import CodeCore from './CodeCore.jsx'
import ParticleField from './ParticleField.jsx'
import { CameraRig, HoloFloor, CodePanels, Fragments } from './Environment3D.jsx'

// Full-viewport world. `intro.v` = entrance 0→1, `intro.s` = scroll progress 0→1 (both written by GSAP in Hero).
export default function HeroScene({ intro, reduced }) {
  const mouse = useRef({ x: 0, y: 0 })
  const small = useMemo(() => window.matchMedia('(max-width: 767px)').matches, [])
  const mid = useMemo(() => window.matchMedia('(max-width: 1023px)').matches, [])
  const n = (a, b, c) => (small ? a : mid ? b : c)

  useEffect(() => {
    const move = (e) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1
      mouse.current.y = -((e.clientY / window.innerHeight) * 2 - 1)
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => window.removeEventListener('pointermove', move)
  }, [])

  return (
    <Canvas dpr={small ? [1, 1.25] : [1, 1.75]} camera={{ fov: 38, position: [0, 0.5, small ? 10.5 : 9], near: 0.1, far: 60 }}
      gl={{ antialias: !small, alpha: true, powerPreference: 'high-performance' }} aria-hidden="true">
      <fog attach="fog" args={['#08080D', 12, 34]} />
      <SceneLighting />
      <CameraRig intro={intro} mouse={mouse} reduced={reduced} compact={small} />
      <HoloFloor intro={intro} reduced={reduced} />
      <CodePanels intro={intro} reduced={reduced} compact={small} />
      <Fragments intro={intro} reduced={reduced} count={n(2, 3, 4)} />
      <CodeCore intro={intro} mouse={mouse} reduced={reduced} compact={small} />
      <ParticleField intro={intro} reduced={reduced} count={n(20, 40, 60)} />
      <ParticleField intro={intro} reduced={reduced} count={n(15, 30, 45)} w={16} h={8} z0={-14} z1={-6} opacity={0.3} />
      <ParticleField intro={intro} reduced={reduced} count={n(6, 10, 14)} w={6} h={3.5} z0={3} z1={6} size={0.04} opacity={0.3} color="#22D3EE" />
    </Canvas>
  )
}
