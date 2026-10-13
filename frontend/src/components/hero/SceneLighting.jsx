import { Environment, Lightformer } from '@react-three/drei'

// The Environment is built locally from three light panels (rendered once, no HDR download)
// so the metal has something violet/cyan to reflect.
export default function SceneLighting() {
  return (
    <>
      <ambientLight intensity={0.2} color="#A78BFA" />
      <directionalLight position={[3, 4, 5]} intensity={1.6} color="#F4F4F5" />
      <pointLight position={[3.5, -2.5, -2]} intensity={12} color="#22D3EE" distance={10} />
      <pointLight position={[0, 0, -3]} intensity={18} color="#7C3AED" distance={9} />
      <Environment resolution={64} frames={1}>
        <Lightformer form="rect" intensity={2.5} color="#A78BFA" position={[-4, 2, -2]} scale={[6, 3, 1]} />
        <Lightformer form="rect" intensity={1.8} color="#22D3EE" position={[4, -2, -3]} scale={[5, 2, 1]} />
        <Lightformer form="ring" intensity={2} color="#F4F4F5" position={[0, 4, -4]} scale={4} />
      </Environment>
    </>
  )
}
