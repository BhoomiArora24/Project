import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const LABELS = ['JavaScript', 'TypeScript', 'Python', 'Java', 'React', 'Node.js', 'HTML', 'CSS', 'C++', 'SQL']
const COMPACT = new Set(['JavaScript', 'Python', 'React', 'Node.js', 'HTML', 'SQL'])
// Elliptical orbits in a loose bundle (like the reference): one bright continuous trail, one violet,
// two broken-dash orbits. `count` = comets per orbit, `base` = brightness of the unbroken curve.
const ORBITS = [
  { rx: 1.9, rz: 1.25, tilt: [0.35, 0.1, 0.38], tube: 0.011, color: '#D946EF', count: 1, base: 0.45, pow: 2.2, speed: 0.06, glow: true },
  { rx: 2.1, rz: 1.4, tilt: [0.42, 0.15, 0.34], tube: 0.006, color: '#7C3AED', count: 5, base: 0.0, pow: 3.0, speed: -0.05, glow: true },
  { rx: 1.7, rz: 1.1, tilt: [0.28, -0.05, 0.44], tube: 0.007, color: '#D946EF', count: 7, base: 0.0, pow: 4.0, speed: 0.08 },
  { rx: 1.75, rz: 1.05, tilt: [-0.45, 0.3, -0.2], tube: 0.006, color: '#A78BFA', count: 1, base: 0.3, pow: 2.5, speed: -0.04 },
]
const LABEL_R = 2.1
const c01 = (x) => Math.min(1, Math.max(0, x))
const { damp, smootherstep } = THREE.MathUtils
const tmp = new THREE.Vector3(), cw = new THREE.Vector3(), cp = new THREE.Vector3()
const add = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }

const SURF_V = `varying vec3 vN; varying vec3 vV;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`
// Wireframe line colour: dim face-on, brighter toward the silhouette (gives the mesh depth).
// Wire shading: bright on the silhouette, quiet in the interior, and rear-facing lines recede (smooth fade across
// the silhouette so there is no pop). depthTest stays off so rear lines can still be seen faintly through the dark glass.
const WIRE_F = `uniform vec3 uColor; uniform float uOpacity; varying vec3 vN; varying vec3 vV;
void main(){ float nd = dot(normalize(vN), normalize(vV));
  float f = pow(1.0 - abs(nd), 1.4);
  float side = mix(0.28, 1.0, smoothstep(-0.15, 0.15, nd));
  gl_FragColor = vec4(uColor, (0.2 + 0.85 * f) * side * uOpacity);
  #include <colorspace_fragment> }`
const RIM_F = `uniform vec3 uColor; uniform vec3 uRim; uniform float uOpacity; varying vec3 vN; varying vec3 vV;
void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 3.0);
  gl_FragColor = vec4(mix(uColor, uRim, f), (0.02 + f * 0.35) * uOpacity);
  #include <colorspace_fragment> }`
// Orbit light: the whole ellipse is one tube; the shader decides what is lit, and uPhase slides comets along it
// (no per-frame geometry work). Parts farther from the camera than the core dim for depth.
const ORBIT_V = `varying vec2 vUv; varying float vD;
void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vD = length(mv.xyz); gl_Position = projectionMatrix * mv; }`
const ORBIT_F = `uniform vec3 uColor; uniform float uOpacity; uniform float uCore; uniform float uPhase; uniform float uCount; uniform float uBase; uniform float uPow;
varying vec2 vUv; varying float vD;
void main(){ float ph = fract(vUv.x * uCount - uPhase);
  float head = pow(ph, uPow) * (1.0 - smoothstep(0.97, 1.0, ph));
  float a = uBase + (1.0 - uBase) * head;
  a *= mix(1.0, 0.3, smoothstep(0.0, 0.8, vD - uCore));
  gl_FragColor = vec4(uColor, a * uOpacity);
  #include <colorspace_fragment> }`
const orbitMat = (o) => new THREE.ShaderMaterial({ vertexShader: ORBIT_V, fragmentShader: ORBIT_F, ...add, uniforms: {
  uColor: { value: new THREE.Color(o.color) }, uOpacity: { value: 0 }, uCore: { value: 9 }, uPhase: { value: 0 },
  uCount: { value: o.count }, uBase: { value: o.base }, uPow: { value: o.pow } } })
const orbitGeo = (o, k = 1) => {
  const pts = []
  for (let i = 0; i < 96; i++) { const a = (i / 96) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * o.rx, 0, Math.sin(a) * o.rz)) }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 240, o.tube * k, 6, true)
}

// Chunky asteroid-like rock. Radius along each direction = base + broad Gaussian lobes (bumps) and dents at
// hand-placed, unequal positions, plus a little low-frequency noise. Each lobe is a smooth falloff of the angle from
// its centre, so lobes melt into one another: no creases, no planes, no single point.
const LOBES = [
  { c: [-1, -0.05, 0.25], a: 0.34, s: 0.5 },   // broad left bulge
  { c: [0.7, 0.75, 0.05], a: 0.25, s: 0.36 },   // separate, subtler upper-right bulge
  { c: [1, -0.15, 0.3], a: 0.22, s: 0.38 },   // right side
  { c: [-0.5, 1, -0.2], a: 0.47, s: 0.44 },   // top extended upward, sloping toward the left
  { c: [0.4, 0.95, 0.1], a: 0.2, s: 0.4 },   // lower right shoulder of the top (uneven slope)
  { c: [-0.5, -0.55, 0.75], a: 0.24, s: 0.42 },   // lower-left, toward camera
  { c: [0.1, -0.2, -1], a: 0.24, s: 0.5 },   // back
  { c: [0.7, -0.7, 0.2], a: 0.2, s: 0.4 },   // lower-right slope
  { c: [0.4, -1, 0.15], a: 0.36, s: 0.4 },   // bottom extended down, lowest point offset to the right
  { c: [-0.5, -0.8, 0], a: -0.1, s: 0.45 },   // bottom-left eased up so the lowest point is off-centre
  { c: [0.2, 1, 0.2], a: -0.1, s: 0.35 },   // small concavity between the top and the upper-right
].map((l) => { const m = Math.hypot(...l.c); return { c: l.c.map((x) => x / m), a: l.a, k: 1 / (2 * l.s * l.s) } })
function lobeOffset(x, y, z) {
  let r = 0
  for (const l of LOBES) { const ang = Math.acos(Math.min(1, x * l.c[0] + y * l.c[1] + z * l.c[2])); r += l.a * Math.exp(-ang * ang * l.k) }
  return r
}

// Same pipeline as before (fine icosphere, merged vertices, light jitter for irregular triangles, smooth normals),
// but the displacement now follows the lobe field above, with the multi-frequency noise kept as gentle erosion.
function makeBlob(detail) {
  let g = new THREE.IcosahedronGeometry(1, detail)
  g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g, 1e-4)
  const p = g.attributes.position, v = new THREE.Vector3()
  let seed = 5; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize()
    v.x += rnd() * 0.05; v.y += rnd() * 0.05; v.z += rnd() * 0.05; v.normalize()
    const n = 0.45 * Math.sin(2.1 * v.x + 1.3) * Math.cos(1.7 * v.y) + 0.3 * Math.sin(3.3 * v.z + 2 * v.x)
      + 0.2 * Math.sin(4.1 * v.y + 3 * v.z) + 0.12 * Math.sin(7 * v.x + 5 * v.y) * Math.cos(6 * v.z)
    v.multiplyScalar(0.852 * (1 + lobeOffset(v.x, v.y, v.z) + 0.09 * n))
    p.setXYZ(i, v.x, v.y, v.z)
  }
  g.computeVertexNormals()
  return g
}
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128
  const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64)
  ;[[0, 0.9], [0.25, 0.45], [0.5, 0.16], [0.75, 0.04], [1, 0]].forEach(([o, a]) => g.addColorStop(o, `rgba(255,255,255,${a})`))
  x.fillStyle = g; x.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

export default function CodeCore({ intro, mouse, reduced, compact }) {
  const ringsRoot = useRef(), root = useRef(), spin = useRef(), labelGroup = useRef()
  const labelEls = useRef([]), labelAnchors = useRef([]), phases = useRef([])
  const orbits = compact ? ORBITS.slice(0, 2) : ORBITS
  const labels = useMemo(() => (compact ? LABELS.filter((l) => COMPACT.has(l)) : LABELS), [compact])
  const blob = useMemo(() => makeBlob(compact ? 3 : 5), [compact])
  const tex = useMemo(glowTexture, [])
  const geos = useMemo(() => orbits.map((o) => ({ line: orbitGeo(o), soft: o.glow ? orbitGeo(o, 4) : null })), [orbits])
  useEffect(() => () => { blob.dispose(); tex.dispose(); geos.forEach((g) => { g.line.dispose(); g.soft?.dispose() }) }, [blob, tex, geos])

  const points = useMemo(() => labels.map((_, i) => {
    const y = labels.length > 1 ? 1 - (i / (labels.length - 1)) * 2 : 0
    const rad = Math.sqrt(1 - y * y), th = i * 2.399963
    return [Math.cos(th) * rad * LABEL_R * 1.05, y * 0.8 * LABEL_R, Math.sin(th) * rad * LABEL_R * 0.9]
  }), [labels])

  const mats = useMemo(() => {
    const sprite = (color) => new THREE.SpriteMaterial({ map: tex, color, ...add, opacity: 0, fog: false })
    return {
      // Near-black glass; writes depth so orbit segments behind the artifact are genuinely hidden.
      glass: new THREE.MeshPhysicalMaterial({ color: '#02030a', roughness: 0.15, metalness: 0.3, clearcoat: 1, envMapIntensity: 1.2, transparent: true, opacity: 0 }),
      wire: new THREE.ShaderMaterial({ vertexShader: SURF_V, fragmentShader: WIRE_F, ...add, wireframe: true, depthTest: false, side: THREE.DoubleSide,
        uniforms: { uColor: { value: new THREE.Color('#22D3EE') }, uOpacity: { value: 0 } } }),
      rim: new THREE.ShaderMaterial({ vertexShader: SURF_V, fragmentShader: RIM_F, ...add,
        uniforms: { uColor: { value: new THREE.Color('#7C3AED') }, uRim: { value: new THREE.Color('#22D3EE') }, uOpacity: { value: 0 } } }),
      glowM: sprite('#D946EF'), glowC: sprite('#22D3EE'),
      lines: orbits.map(orbitMat), soft: orbits.map(orbitMat),
    }
  }, [orbits, tex])
  useEffect(() => () => Object.values(mats).flat().forEach((m) => m.dispose()), [mats])

  useFrame((state, dt) => {
    const { v, s } = intro.current // v: GSAP entrance 0→1, s: scroll progress 0→1
    const cam = state.camera, t = reduced ? 0 : state.clock.elapsedTime
    const g = root.current
    g.visible = v > 0.01
    g.scale.setScalar(0.84 + 0.16 * smootherstep(v, 0, 1))

    mats.glass.opacity = 0.9 * c01((v - 0.05) / 0.4)
    mats.wire.uniforms.uOpacity.value = 0.9 * c01((v - 0.1) / 0.4)
    mats.rim.uniforms.uOpacity.value = c01((v - 0.1) / 0.4)
    mats.glowM.opacity = 0.12 * c01(v / 0.6)
    mats.glowC.opacity = 0.07 * c01(v / 0.6)

    const mx = reduced ? 0 : mouse.current.x, my = reduced ? 0 : mouse.current.y
    g.position.x = damp(g.position.x, mx * 0.28, 3, dt)
    g.position.y = damp(g.position.y, my * 0.18 + Math.sin(t * 0.7) * 0.12, 3, dt)
    g.rotation.x = damp(g.rotation.x, 0.12 - my * 0.18, 3, dt)
    g.rotation.y = damp(g.rotation.y, mx * 0.28 + s * 1.2, 3, dt)
    labelGroup.current.position.x = damp(labelGroup.current.position.x, mx * 0.16, 2.5, dt)
    labelGroup.current.position.y = damp(labelGroup.current.position.y, my * 0.1, 2.5, dt)

    g.getWorldPosition(cw)
    const cd = cw.distanceTo(cam.position), aspect = state.size.width / state.size.height
    orbits.forEach((o, i) => {
      if (!reduced) phases.current[i] = ((phases.current[i] || 0) + dt * o.speed + 1) % 1
      const ph = reduced ? 0.3 : phases.current[i] || 0, op = c01((v - 0.15 - i * 0.1) / 0.4)
      const a = mats.lines[i].uniforms, b = mats.soft[i].uniforms
      a.uPhase.value = b.uPhase.value = ph; a.uCore.value = b.uCore.value = cd
      a.uOpacity.value = 0.95 * op; b.uOpacity.value = 0.1 * op
    })

    if (!reduced) spin.current.rotation.y += dt * 0.12 // wireframe + body share this group, so they rotate together
    ringsRoot.current.scale.setScalar(1 + 0.7 * smootherstep(s, 0, 1)) // orbits open up as the camera travels in

    cp.copy(cw).project(cam)
    const lv = c01((v - 0.45) / 0.55)
    labelEls.current.forEach((el, i) => {
      if (!el || !labelAnchors.current[i]) return
      labelAnchors.current[i].getWorldPosition(tmp)
      const d = c01(0.5 + (cd - tmp.distanceTo(cam.position)) / (LABEL_R * 2))
      tmp.project(cam)
      const dist = Math.hypot((tmp.x - cp.x) * aspect, tmp.y - cp.y)
      const clear = d > 0.5 ? 0.3 + 0.7 * c01((dist - 0.1) / 0.22) : 1
      el.style.opacity = ((0.3 + 0.7 * d) * clear * c01(lv * 1.6 - i * 0.06) * (1 - c01(s * 3))).toFixed(3)
      el.style.transform = `scale(${(0.9 + 0.12 * d).toFixed(3)})`
    })
  })

  return (
    <group ref={root} scale={0.84}>
      <pointLight position={[1.8, 1.2, 2]} color="#22D3EE" intensity={14} distance={7} />
      <pointLight position={[-1.8, -0.8, 1.2]} color="#D946EF" intensity={12} distance={7} />
      <sprite scale={[4.5, 4.5, 1]} material={mats.glowM} />
      <sprite scale={[3, 3, 1]} position={[0.3, 0.2, -0.3]} material={mats.glowC} />
      <group ref={spin} scale={[1, 1.06, 0.96]}>
        <mesh geometry={blob} material={mats.glass} renderOrder={-1} />
        <mesh geometry={blob} material={mats.rim} scale={1.012} renderOrder={1} />
        <mesh geometry={blob} material={mats.wire} renderOrder={2} />
      </group>

      <group ref={ringsRoot}>
        {orbits.map((o, i) => (
          <group key={i} rotation={o.tilt}>
            <mesh geometry={geos[i].line} material={mats.lines[i]} renderOrder={3} />
            {geos[i].soft && <mesh geometry={geos[i].soft} material={mats.soft[i]} renderOrder={3} />}
          </group>
        ))}
      </group>

      <group ref={labelGroup}>
        {labels.map((text, i) => (
          <group key={text} position={points[i]} ref={(el) => { labelAnchors.current[i] = el }}>
            <Html center zIndexRange={[0, 0]} style={{ pointerEvents: 'none' }}>
              <div ref={(el) => { labelEls.current[i] = el }} style={{ opacity: 0 }}
                className="flex items-center gap-2 whitespace-nowrap rounded-full border border-lavender/20 bg-surface/60 px-3 py-1 font-display text-[11px] font-medium tracking-wide text-ink shadow-[0_4px_18px_rgba(8,8,13,.5)] backdrop-blur-md sm:text-[13px]">
                <i className={`h-1.5 w-1.5 rounded-full ${i % 5 === 0 ? 'bg-cyan' : 'bg-lavender'}`} />
                {text}
              </div>
            </Html>
          </group>
        ))}
      </group>
    </group>
  )
}
