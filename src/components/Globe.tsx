import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MeshStandardMaterial, BackSide, BufferGeometry, Float32BufferAttribute } from 'three'

export function Globe() {
  const glowRef = useRef<MeshStandardMaterial>(null)

  const gridLines = useMemo(() => {
    const lines: number[] = []
    const step = 30
    const r = 5.01

    for (let lat = -90; lat <= 90; lat += step) {
      const φ = lat * Math.PI / 180
      const pts: number[] = []
      for (let lng = 0; lng <= 360; lng += 2) {
        const λ = lng * Math.PI / 180
        pts.push(
          r * Math.cos(φ) * Math.cos(λ),
          r * Math.sin(φ),
          r * Math.cos(φ) * Math.sin(λ),
        )
      }
      lines.push(...pts)
    }

    for (let lng = 0; lng < 360; lng += step) {
      const λ = lng * Math.PI / 180
      const pts: number[] = []
      for (let lat = -90; lat <= 90; lat += 2) {
        const φ = lat * Math.PI / 180
        pts.push(
          r * Math.cos(φ) * Math.cos(λ),
          r * Math.sin(φ),
          r * Math.cos(φ) * Math.sin(λ),
        )
      }
      lines.push(...pts)
    }

    const geo = new BufferGeometry()
    geo.setAttribute('position', new Float32BufferAttribute(lines, 3))
    return geo
  }, [])

  useFrame(({ clock }) => {
    if (glowRef.current) {
      glowRef.current.opacity = 0.15 + 0.05 * Math.sin(clock.elapsedTime * 0.3)
    }
  })

  return (
    <group>
      <mesh>
        <sphereGeometry args={[5, 64, 64]} />
        <meshStandardMaterial
          color="#1a2a4a"
          roughness={0.7}
          metalness={0.3}
        />
      </mesh>

      <lineSegments geometry={gridLines}>
        <lineBasicMaterial color="#2a4a7a" transparent opacity={0.3} />
      </lineSegments>

      <mesh>
        <sphereGeometry args={[5.15, 32, 32]} />
        <meshStandardMaterial
          ref={glowRef}
          color="#4488ff"
          transparent
          opacity={0.15}
          side={BackSide}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}
