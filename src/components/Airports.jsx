import React, { useEffect, useState } from 'react'
import { CircleMarker, Polyline } from 'react-leaflet'

const parseCSVLine = (line) => {
  const result = []
  let current = '', insideQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (insideQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else insideQuotes = !insideQuotes
    } else if (ch === ',' && !insideQuotes) { result.push(current); current = '' }
    else current += ch
  }
  result.push(current)
  return result
}

const TYPE_LABEL = {
  large_airport:  'Large Airport',
  medium_airport: 'Medium Airport',
  small_airport:  'Small Airport',
  heliport:       'Heliport',
  seaplane_base:  'Seaplane Base',
}

export default function Airports({ onLoad, onRunwaysLoaded, selectedIdent, onSelectAirport }) {
  const [airports,   setAirports]   = useState([])
  const [runwaysMap, setRunwaysMap] = useState({})   // { ident: runway[] }

  useEffect(() => {
    const load = async () => {
      try {
        // ── airports ────────────────────────────────────────────────
        const airportText  = await (await fetch('/data/airports.csv')).text()
        const airportLines = airportText.split('\n')
        const list = []

        for (let i = 1; i < airportLines.length; i++) {
          if (!airportLines[i].trim()) continue
          const r = parseCSVLine(airportLines[i])
          if (r.length < 12) continue

          const ident    = r[1]?.trim()
          const type     = r[2]?.trim()
          const name     = r[3]?.trim()
          const lat      = parseFloat(r[4])
          const lon      = parseFloat(r[5])
          const elevFt   = r[6]?.trim()
          const country  = r[8]?.trim()
          const region   = r[9]?.trim()
          const city     = r[10]?.trim()
          const scheduled = r[11]?.trim()
          const iata     = r[13]?.trim()

          const isLarge   = type === 'large_airport'
          const isOntario = country === 'CA' && region === 'CA-ON' && scheduled === 'yes'

          if (!isNaN(lat) && !isNaN(lon) && ident && name && (isLarge || isOntario)) {
            list.push({ ident, name, type, lat, lon, elevFt, country, region, city, iata })
          }
        }

        setAirports(list)
        onLoad?.(list)

        // ── runways ─────────────────────────────────────────────────
        const runwayText  = await (await fetch('/data/runways.csv')).text()
        const runwayLines = runwayText.split('\n')
        const map = {}

        for (let i = 1; i < runwayLines.length; i++) {
          if (!runwayLines[i].trim()) continue
          const r = parseCSVLine(runwayLines[i])
          if (r.length < 17) continue

          const ident = r[2]?.trim()
          if (!map[ident]) map[ident] = []

          map[ident].push({
            le_ident:   r[8]?.trim()  || '',
            he_ident:   r[14]?.trim() || '',
            length_ft:  r[3]?.trim()  || '',
            width_ft:   r[4]?.trim()  || '',
            surface:    r[5]?.trim()  || '',
            lighted:    r[6]?.trim()  === '1',
            closed:     r[7]?.trim()  === '1',
            le_lat:     parseFloat(r[9])  || 0,
            le_lon:     parseFloat(r[10]) || 0,
            he_lat:     parseFloat(r[15]) || 0,
            he_lon:     parseFloat(r[16]) || 0,
          })
        }

        setRunwaysMap(map)
        onRunwaysLoaded?.(map)
      } catch (err) {
        console.error('Airport/runway load failed:', err)
        onLoad?.([])
      }
    }
    load()
  }, [])

  return (
    <>
      {airports.map((airport) => {
        const isSelected = selectedIdent === airport.ident

        return (
          <CircleMarker
            key={airport.ident}
            center={[airport.lat, airport.lon]}
            radius={isSelected ? 7 : 5}
            pathOptions={{
              color:       isSelected ? '#fff' : '#555',
              fillColor:   isSelected ? '#fff' : '#333',
              fillOpacity: isSelected ? 1 : 0.8,
              weight:      1,
            }}
            eventHandlers={{ click: () => onSelectAirport?.(airport) }}
          />
        )
      })}

      {/* runway lines for selected airport */}
      {selectedIdent && (runwaysMap[selectedIdent] ?? []).map((rwy, idx) => {
        if (!rwy.le_lat || !rwy.le_lon || !rwy.he_lat || !rwy.he_lon) return null
        return (
          <Polyline
            key={`rwy-${selectedIdent}-${idx}`}
            positions={[[rwy.le_lat, rwy.le_lon], [rwy.he_lat, rwy.he_lon]]}
            pathOptions={{ color: '#fff', weight: 3, opacity: 0.35 }}
            interactive={false}
          />
        )
      })}
    </>
  )
}
