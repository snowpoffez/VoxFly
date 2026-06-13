import { create } from 'zustand'
import { Vector3, Quaternion } from 'three'

export interface PlaneState {
  id: string
  position: Vector3
  quaternion: Quaternion
  altitude: number
  heading: number
  color: string
  flightNumber: string
  origin: string
  destination: string
}

interface GlobeStore {
  planes: PlaneState[]
  setPlanes: (planes: PlaneState[]) => void
}

export const useGlobeStore = create<GlobeStore>((set) => ({
  planes: [],
  setPlanes: (planes) => set({ planes }),
}))
