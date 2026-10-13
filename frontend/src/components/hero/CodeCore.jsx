import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const LABELS = ['JavaScript', 'TypeScript', 'Python', 'Java', 'React', 'Node.js', 'HTML', 'CSS', 'C++', 'SQL']
const COMPACT = new Set(['JavaScript', 'Python', 'React', 'Node.js', 'HTML', 'SQL'])
// Slender light trails: varied inclination, slow, each with one accent colour.
const RINGS = [
  { r: 1.1, tube: 0.007, arc: 4.6, tilt: [1.1, 0.3, 0.2], speed: 0.28, color: '#A78BFA', bead: true },
  { r: 1.32, tube: 0.006, arc: 3.8, tilt: [0.4, -0.5, -0.7], speed: -0.2, color: '#22D3EE', bead: true },
  { r: 1.58, tube: 0.005, arc: 4.2, tilt: [-0.6, 0.2, 1.0], speed: 0.14, color: '#D946EF' },
]
const LABEL_R = 2.1
const c01 = (x) => Math.min(1, Math.max(0, x))
const { damp, smootherstep } = THREE.MathUtils
const tmp = new THREE.Vector3(), cw = new THREE.Vector3(), cp = new THREE.Vector3()

const VERT = `varying vec3 vN; varying vec3 vV; varying vec3 vP;
void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix * mv; }`
const add = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }
const shader = (frag, uniforms) => new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, ...add, uniforms })

// Rim light: clear face-on, glowing at grazing angles.
const RIM = `uniform vec3 uColor; uniform vec3 uRim; uniform float uStrength; uniform float uPower; uniform float uOpacity;
varying vec3 vN; varying vec3 vV; varying vec3 vP;
void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPower);
  gl_FragColor = vec4(mix(uColor, uRim, clamp(f * 1.3, 0.0, 1.0)), (0.02 + f * uStrength) * uOpacity);
  #include <colorspace_fragment> }`
// Slow drifting plasma inside the glass: violet→magenta swirl with a lavender edge.
const PLASMA = `uniform float uTime; uniform float uOpacity; varying vec3 vN; varying vec3 vV; varying vec3 vP;
void main(){ vec3 p = vP * 5.0;
  float n = sin(p.x + uTime * 0.7) + sin(p.y * 1.3 - uTime * 0.5) + sin(p.z * 1.1 + uTime * 0.6) + sin((p.x + p.y + p.z) * 0.8 + uTime * 0.4);
  n = n * 0.125 + 0.5;
  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
  vec3 c = mix(vec3(0.30, 0.10, 0.70), vec3(0.85, 0.30, 0.95), n); c = mix(c, vec3(0.65, 0.55, 0.98), f * 0.7);
  gl_FragColor = vec4(c, (0.35 + 0.45 * n + f * 0.4) * uOpacity);
  #include <colorspace_fragment> }`
// Orbit trail: brightens toward the head, and segments behind the core (farther from camera) dim.
const TRAIL_V = `varying vec2 vUv; varying float vD;
void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vD = length(mv.xyz); gl_Position = projectionMatrix * mv; }`
const TRAIL_F = `uniform vec3 uColor; uniform float uOpacity; uniform float uCore; varying vec2 vUv; varying float vD;
void main(){ float t = vUv.x; float a = pow(t, 1.6) * (1.0 - smoothstep(0.97, 1.0, t));
  a *= mix(1.0, 0.3, smoothstep(0.0, 0.8, vD - uCore));
  gl_FragColor = vec4(uColor, a * uOpacity);
  #include <colorspace_fragment> }`
const trail = (color) => new THREE.ShaderMaterial({ vertexShader: TRAIL_V, fragmentShader: TRAIL_F, ...add,
  uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 }, uCore: { value: 9 } } })

// Compact, subtly uneven artifact: a fine sphere pushed in/out by low-frequency noise, vertices merged
// so normals are smooth (no facets), then slightly squashed by the group scale.
function makeBlob(detail) {
  let g = new THREE.IcosahedronGeometry(1, detail)
  g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g, 1e-4)
  const p = g.attributes.position, v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize()
    const n = 0.5 * Math.sin(2.1 * v.x + 1.3) * Math.cos(1.7 * v.y) + 0.3 * Math.sin(3.3 * v.z + v.x * 2) + 0.2 * Math.sin(4.1 * v.y + v.z * 3)
    v.multiplyScalar(0.78 * (1 + 0.12 * n)); p.setXYZ(i, v.x, v.y, v.z)
  }
  g.computeVertexNormals()
  return g
}
// Soft radial falloff texture for glow sprites (replaces the hard-edged halo spheres).
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128
  const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64)
  ;[[0, 0.9], [0.25, 0.45], [0.5, 0.16], [0.75, 0.04], [1, 0]].forEach(([o, a]) => g.addColorStop(o, `rgba(255,255,255,${a})`))
  x.fillStyle = g; x.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

export default function CodeCore({ intro, mouse, reduced, compact }) {
  const ringsRoot = useRef(), root = useRef(), spin = useRef(), core = useRef(), labelGroup = useRef()
  const ringRefs = useRef([]), labelEls = useRef([]), labelAnchors = useRef([])
  const rings = compact ? RINGS.slice(0, 2) : RINGS
  const labels = useMemo(() => (compact ? LABELS.filter((l) => COMPACT.has(l)) : LABELS), [compact])
  const blob = useMemo(() => makeBlob(compact ? 6 : 9), [compact])
  const tex = useMemo(glowTexture, [])
  useEffect(() => () => { blob.dispose(); tex.dispose() }, [blob, tex])

  // Unique height per label (>= ~0.4 units apart) so pills can never overlap each other.
  const points = useMemo(() => labels.map((_, i) => {
    const y = labels.length > 1 ? 1 - (i / (labels.length - 1)) * 2 : 0
    const rad = Math.sqrt(1 - y * y), th = i * 2.399963
    return [Math.cos(th) * rad * LABEL_R * 1.05, y * 0.8 * LABEL_R, Math.sin(th) * rad * LABEL_R * 0.9]
  }), [labels])

  const mats = useMemo(() => {
    const sprite = (color) => new THREE.SpriteMaterial({ map: tex, color, ...add, opacity: 0, fog: false })
    return {
      glass: new THREE.MeshPhysicalMaterial({ color: '#07040f', roughness: 0.1, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05,
        envMapIntensity: 1.6, emissive: '#2e1065', emissiveIntensity: 0.25, transparent: true, opacity: 0, depthWrite: false }),
      plasma: shader(PLASMA, { uTime: { value: 0 }, uOpacity: { value: 0 } }),
      rim: shader(RIM, { uColor: { value: new THREE.Color('#7C3AED') }, uRim: { value: new THREE.Color('#22D3EE') }, uStrength: { value: 1.0 }, uPower: { value: 3.0 }, uOpacity: { value: 0 } }),
      glowV: sprite('#7C3AED'), glowC: sprite('#22D3EE'),
      bead: new THREE.MeshBasicMaterial({ color: '#F4F4F5', transparent: true, opacity: 0 }),
      trails: rings.map((r) => trail(r.color)),
      soft: rings.map((r) => trail(r.color)), // wider, faint copy = bloom stand-in
    }
  }, [rings, tex])
  useEffect(() => () => Object.values(mats).flat().forEach((m) => m.dispose()), [mats])

  useFrame((state, dt) => {
    const { v, s } = intro.current // v: GSAP entrance 0→1, s: scroll progress 0→1
    const cam = state.camera, t = reduced ? 0 : state.clock.elapsedTime
    const g = root.current
    g.visible = v > 0.01
    g.scale.setScalar(0.84 + 0.16 * smootherstep(v, 0, 1))

    mats.plasma.uniforms.uOpacity.value = c01(v / 0.4)
    mats.plasma.uniforms.uTime.value = t
    mats.glass.opacity = 0.7 * c01((v - 0.05) / 0.4)
    mats.rim.uniforms.uOpacity.value = c01((v - 0.1) / 0.4)
    mats.glowV.opacity = 0.4 * c01(v / 0.6)
    mats.glowC.opacity = 0.08 * c01(v / 0.6)
    mats.bead.opacity = c01((v - 0.4) / 0.4)

    const mx = reduced ? 0 : mouse.current.x, my = reduced ? 0 : mouse.current.y
    g.position.x = damp(g.position.x, mx * 0.28, 3, dt)
    g.position.y = damp(g.position.y, my * 0.18 + Math.sin(t * 0.7) * 0.12, 3, dt)
    g.rotation.x = damp(g.rotation.x, 0.12 - my * 0.18, 3, dt)
    g.rotation.y = damp(g.rotation.y, mx * 0.28 + s * 1.2, 3, dt)
    labelGroup.current.position.x = damp(labelGroup.current.position.x, mx * 0.16, 2.5, dt)
    labelGroup.current.position.y = damp(labelGroup.current.position.y, my * 0.1, 2.5, dt)

    g.getWorldPosition(cw)
    const cd = cw.distanceTo(cam.position), aspect = state.size.width / state.size.height
    mats.trails.forEach((m, i) => {
      const o = c01((v - 0.15 - i * 0.1) / 0.4)
      m.uniforms.uOpacity.value = 0.9 * o; m.uniforms.uCore.value = cd
      mats.soft[i].uniforms.uOpacity.value = 0.12 * o; mats.soft[i].uniforms.uCore.value = cd
    })

    core.current.scale.setScalar(1 + (reduced ? 0 : Math.sin(t * 1.6) * 0.04))
    if (!reduced) {
      spin.current.rotation.y += dt * 0.12
      spin.current.rotation.z = Math.sin(t * 0.2) * 0.08
      labelGroup.current.rotation.y += dt * 0.06
      ringRefs.current.forEach((r, i) => { if (r) r.rotation.y += dt * rings[i].speed })
    }
    ringsRoot.current.scale.setScalar(1 + 0.7 * smootherstep(s, 0, 1)) // rings open up as the camera travels in

    // Labels: camera-relative depth; labels in front of the core on screen are dimmed.
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
      <pointLight color="#7C3AED" intensity={10} distance={7} />
      <pointLight position={[1.8, 1.2, 2]} color="#22D3EE" intensity={16} distance={7} />
      <pointLight position={[-1.8, -0.8, 1.2]} color="#D946EF" intensity={12} distance={7} />
      {/* soft sprites, no geometry edges: a violet bloom plus a faint cyan accent */}
      <sprite scale={[6, 6, 1]} material={mats.glowV} />
      <sprite scale={[3.2, 3.2, 1]} position={[0.6, 0.4, -0.3]} material={mats.glowC} />
      <group ref={spin} scale={[1, 1.06, 0.96]}>
        <mesh geometry={blob} material={mats.glass} renderOrder={1} />
        <mesh ref={core} material={mats.plasma} renderOrder={2}><sphereGeometry args={[0.48, 32, 32]} /></mesh>
        <mesh geometry={blob} material={mats.rim} scale={1.012} renderOrder={3} />
      </group>

      <group ref={ringsRoot}>
        {rings.map((r, i) => (
          <group key={i} rotation={r.tilt}>
            <group ref={(el) => { ringRefs.current[i] = el }}>
              <mesh material={mats.trails[i]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[r.r, r.tube, 8, 200, r.arc]} /></mesh>
              <mesh material={mats.soft[i]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[r.r, r.tube * 5, 8, 200, r.arc]} /></mesh>
              {r.bead && <mesh material={mats.bead} position={[r.r * Math.cos(r.arc), 0, r.r * Math.sin(r.arc)]}><sphereGeometry args={[0.026, 10, 10]} /></mesh>}
            </group>
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
