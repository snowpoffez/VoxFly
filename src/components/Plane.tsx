import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group } from 'three'
import { PlaneState } from '../store/useFlightStore'

export function Plane({ data }: { data: PlaneState }) {
  const groupRef = useRef<Group>(null)
  const dataRef = useRef(data)
  dataRef.current = data

  useFrame(() => {
    if (!groupRef.current) return
    groupRef.current.position.copy(dataRef.current.position)
    groupRef.current.quaternion.copy(dataRef.current.quaternion)
  })

  const s = 0.04

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.3 * s, 0.4 * s, 3 * s, 4]} />
        <meshStandardMaterial color={data.color} emissive={data.color} emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0, 0, -1.8 * s]}>
        <coneGeometry args={[0.3 * s, 0.8 * s, 4]} />
        <meshStandardMaterial color={data.color} />
      </mesh>
      <mesh position={[0, 0.1 * s, -0.2 * s]}>
        <boxGeometry args={[4 * s, 0.05 * s, 0.8 * s]} />
        <meshStandardMaterial color={data.color} emissive={data.color} emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[0, 0.1 * s, 1.4 * s]}>
        <boxGeometry args={[1.5 * s, 0.05 * s, 0.5 * s]} />
        <meshStandardMaterial color={data.color} />
      </mesh>
      <mesh position={[0, 0.6 * s, 1.4 * s]}>
        <boxGeometry args={[0.05 * s, 0.8 * s, 0.5 * s]} />
        <meshStandardMaterial color={data.color} />
      </mesh>
    </group>
  )
}
