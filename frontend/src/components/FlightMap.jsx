import maplibregl from 'maplibre-gl'
import { useEffect, useRef } from 'react'
import { getMapStyle } from '../utils/mapStyle'
import { createAircraftLayer } from './AircraftLayer'
import { createWindOverlay } from './WindLayer'
import { addTurbZone } from './TurbZone'
import { addAirports } from './AirportLayer'

export default function FlightMap({ flightState, windOn = true }) {
  const containerRef = useRef()
  const mapRef = useRef()
  const aircraftRef = useRef()
  const windRef = useRef()
  const turbRef = useRef()
  const rafRef = useRef()
  const flightStateRef = useRef(flightState)
  const windOnRef = useRef(windOn)

  // Init map once.
  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: getMapStyle(), // keyless CARTO dark / Esri satellite — no token
      center: [-79.63, 43.68], // YYZ
      zoom: 7,
      pitch: 45,
      bearing: 0,
      antialias: true,
    })
    mapRef.current = map

    map.on('load', () => {
      // Turbulence zone polygon.
      turbRef.current = addTurbZone(map)

      // Gray wind strands on a screen-space overlay (projected through the map).
      const wind = createWindOverlay(map)
      windRef.current = wind
      wind.setEnabled(windOnRef.current)

      // Airport overlay from the OurAirports open CSV (keyless). Async fetch —
      // dots/labels appear once loaded; failure is non-fatal.
      addAirports(map)

      // Aircraft arrow custom layer (Three.js, shares the map GL context).
      const aircraft = createAircraftLayer(flightStateRef.current)
      aircraftRef.current = aircraft
      map.addLayer(aircraft.layer)

      // Pulse the turbulence zone every frame.
      let t = 0
      const pulse = () => {
        t += 0.016
        turbRef.current?.tick(t, !!flightStateRef.current.turbulence)
        rafRef.current = requestAnimationFrame(pulse)
      }
      pulse()
    })

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      windRef.current?.stop()
      map.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the latest flightState available to the rAF pulse loop and push
  // updates into the imperative map layers.
  useEffect(() => {
    flightStateRef.current = flightState
    aircraftRef.current?.update(flightState)
  }, [flightState])

  // Toggle the wind overlay on/off.
  useEffect(() => {
    windOnRef.current = windOn
    windRef.current?.setEnabled(windOn)
  }, [windOn])

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
}
