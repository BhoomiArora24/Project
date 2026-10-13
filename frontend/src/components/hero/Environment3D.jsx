import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const { damp, lerp, smootherstep: sm } = THREE.MathUtils
const c01 = (x) => Math.min(1, Math.max(0, x))

// Scroll-driven camera: dolly in + orbit (0→.55), then rise and pull back (.55→1).
// The core is pushed right of centre with a view offset (not by moving it), so orbiting stays centred on the core.
export function CameraRig({ intro, mouse, reduced, compact }) {
  const sp = useRef({ x: 0, y: 0 })
  useFrame(({ camera, size, clock }, dt) => {
    const s = intro.current.s, t = reduced ? 0 : clock.elapsedTime
    sp.current.x = damp(sp.current.x, reduced ? 0 : mouse.current.x, 2.5, dt)
    sp.current.y = damp(sp.current.y, reduced ? 0 : mouse.current.y, 2.5, dt)
    const base = compact ? 10.5 : 9
    const r = s < 0.55 ? lerp(base, 4.8, sm(s / 0.55, 0, 1)) : lerp(4.8, 6.6, sm((s - 0.55) / 0.45, 0, 1))
    const a = s * 1.25 + sp.current.x * 0.1 + Math.sin(t * 0.12) * 0.05
    camera.position.set(Math.sin(a) * r, lerp(0.5, 2.1, sm(s, 0, 1)) + sp.current.y * 0.2, Math.cos(a) * r)
    camera.lookAt(0, -0.3 * (1 - s), 0)
    const e = sm(s, 0, 0.5)
    const sx = size.width >= 1024 ? size.width * 0.22 * (1 - e) : 0
    const sy = size.width < 768 ? size.height * 0.2 * (1 - e * 0.4) : 0
    camera.setViewOffset(size.width, size.height, -sx, sy, size.width, size.height)
  })
  const cam = useRef()
  useFrame(({ camera }) => { cam.current = camera })
  useEffect(() => () => cam.current?.clearViewOffset(), [])
  return null
}

// Floor: existing radially-faded grid plus a thin, segmented cyan projection (dashed rings that slowly counter-rotate).
const DASH_V = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }'
const DASH_F = `uniform vec3 uColor; uniform float uOpacity; uniform float uCount; uniform float uFill; uniform float uPhase; varying vec2 vUv;
void main(){ float seg = fract(vUv.x * uCount - uPhase);
  float a = smoothstep(0.0, 0.05, seg) * (1.0 - smoothstep(uFill - 0.05, uFill, seg));
  if (uFill > 1.0) a = 1.0;
  gl_FragColor = vec4(uColor, a * uOpacity);
  #include <colorspace_fragment>
}`
const FLOOR_RINGS = [
  { r: 2.7, tube: 0.012, count: 9, fill: 0.75, speed: 0.03, op: 0.8 },
  { r: 2.0, tube: 0.008, count: 5, fill: 0.55, speed: -0.04, op: 0.6 },
  { r: 3.2, tube: 0.004, count: 1, fill: 1.1, speed: 0, op: 0.22 },
]
export function HoloFloor({ intro, reduced }) {
  const phase = useRef([0, 0, 0])
  const mats = useMemo(() => ({
    grid: new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uOp: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uOp; varying vec2 vUv;
void main(){ vec2 p = (vUv - 0.5) * 26.0; float d = length(p);
  vec2 g = abs(fract(p - 0.5) - 0.5) / fwidth(p); float l = 1.0 - min(min(g.x, g.y), 1.0);
  vec3 c = mix(vec3(0.486, 0.227, 0.929), vec3(0.133, 0.827, 0.933), smoothstep(6.0, 0.0, d) * 0.85);
  gl_FragColor = vec4(c, (l * 0.15 + pow(smoothstep(4.0, 0.0, d), 2.0) * 0.14) * smoothstep(12.0, 1.0, d) * uOp);
  #include <colorspace_fragment>
}` }),
    rings: FLOOR_RINGS.map((r) => new THREE.ShaderMaterial({ vertexShader: DASH_V, fragmentShader: DASH_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: new THREE.Color('#22D3EE') }, uOpacity: { value: 0 }, uCount: { value: r.count }, uFill: { value: r.fill }, uPhase: { value: 0 } } })),
  }), [])
  useEffect(() => () => { mats.grid.dispose(); mats.rings.forEach((m) => m.dispose()) }, [mats])
  useFrame((_, dt) => {
    const e = c01((intro.current.v - 0.3) / 0.7)
    mats.grid.uniforms.uOp.value = e
    mats.rings.forEach((m, i) => {
      if (!reduced) phase.current[i] = (phase.current[i] + dt * FLOOR_RINGS[i].speed + 1) % 1
      m.uniforms.uPhase.value = phase.current[i]; m.uniforms.uOpacity.value = FLOOR_RINGS[i].op * e
    })
  })
  return (
    <group position={[0, -2.3, 0]} rotation-x={-Math.PI / 2}>
      <mesh material={mats.grid}><planeGeometry args={[26, 26]} /></mesh>
      {FLOOR_RINGS.map((r, i) => <mesh key={i} material={mats.rings[i]}><torusGeometry args={[r.r, r.tube, 6, 192]} /></mesh>)}
    </group>
  )
}

// Abstract code-editor panels (canvas-drawn token bars, no real text) at staggered depths.
function panelTexture(seed) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 320
  const x = c.getContext('2d')
  x.fillStyle = 'rgba(18,18,28,.92)'; x.fillRect(0, 0, 512, 320)
  x.strokeStyle = '#282538'; x.lineWidth = 3; x.strokeRect(1.5, 1.5, 509, 317)
  x.fillStyle = '#282538'; x.fillRect(0, 0, 512, 34)
  ;['#7C3AED', '#A78BFA', '#22D3EE'].forEach((col, i) => { x.fillStyle = col; x.beginPath(); x.arc(20 + i * 18, 17, 5, 0, 7); x.fill() })
  let r = seed; const rnd = () => (r = (r * 16807) % 2147483647) / 2147483647
  x.globalAlpha = 0.7
  for (let i = 0; i < 14; i++) {
    let xx = 30 + (rnd() < 0.3 ? 30 : 0)
    for (let j = 0, n = 1 + Math.floor(rnd() * 4); j < n; j++) {
      const w = 20 + rnd() * 90; x.fillStyle = ['#A78BFA', '#22D3EE', '#A1A1AA', '#7C3AED'][Math.floor(rnd() * 4)]
      x.fillRect(xx, 60 + i * 17, w, 6); xx += w + 8
    }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t
}
const PANELS = [[-7.5, 2.4, -9, 0.45, 4.2], [8, 3, -11, -0.4, 4.6], [-10.5, -0.6, -15, 0.3, 5.2], [4.5, -0.8, -16, -0.2, 5], [-1, 5.2, -19, 0, 5.5], [11, -1.2, -9, -0.5, 3.6]]
export function CodePanels({ intro, reduced, compact }) {
  const refs = useRef([])
  const list = compact ? PANELS.slice(0, 4) : PANELS
  const mats = useMemo(() => [11, 23, 37].map((seed) => new THREE.MeshBasicMaterial({
    map: panelTexture(seed), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })), [])
  useEffect(() => () => mats.forEach((m) => { m.map.dispose(); m.dispose() }), [mats])
  useFrame(({ clock }) => {
    const e = c01((intro.current.v - 0.4) / 0.6), t = reduced ? 0 : clock.elapsedTime
    mats.forEach((m) => { m.opacity = 0.22 * e })
    refs.current.forEach((g, i) => { if (g) g.position.y = list[i][1] + Math.sin(t * 0.3 + i) * 0.15 })
  })
  return list.map(([x, y, z, ry, w], i) => (
    <group key={i} ref={(el) => { refs.current[i] = el }} position={[x, y, z]} rotation-y={ry}>
      <mesh material={mats[i % 3]}><planeGeometry args={[w, w * 0.625]} /></mesh>
    </group>
  ))
}

// Sparse distant wireframe shards.
export function Fragments({ intro, reduced, count = 10 }) {
  const refs = useRef([])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#7C3AED', transparent: true, opacity: 0 }), [])
  useEffect(() => () => mat.dispose(), [mat])
  useFrame((_, dt) => {
    mat.opacity = 0.08 * c01((intro.current.v - 0.4) / 0.6)
    if (!reduced) refs.current.forEach((m, i) => { if (m) { m.rotation.x += dt * 0.08 * (i % 2 ? 1 : -1); m.rotation.y += dt * 0.1 } })
  })
  return Array.from({ length: count }, (_, i) => {
    const a = i * 2.4, r = 8 + (i % 4) * 2
    return (
      <mesh key={i} ref={(el) => { refs.current[i] = el }} material={mat} scale={0.3 + (i % 3) * 0.2}
        position={[Math.cos(a) * r, ((i * 3) % 7 - 3) * 1.2, -5 - (i % 5) * 2.5 - Math.abs(Math.sin(a)) * 3]}>
        {i % 2 ? <octahedronGeometry args={[1]} /> : <tetrahedronGeometry args={[1]} />}
      </mesh>
    )
  })
}
