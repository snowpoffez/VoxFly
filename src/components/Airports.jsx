import React, { useEffect, useState } from 'react'
import { CircleMarker, Polyline, Popup } from 'react-leaflet'

const parseCSVLine = (line) => {
  const result = []
  let current = ''
  let insideQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"'
        i++
      } else {
        insideQuotes = !insideQuotes
      }
    } else if (char === ',' && !insideQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }

  result.push(current)
  return result
}

/**
 * Fetches airport + runway data, renders all CircleMarkers and runway Polylines.
 *
 * Props:
 *   onLoad(airports)        — called once data is ready with the full airport list
 *   selectedIdent           — ident string of the currently selected airport
 *   onSelectAirport(airport) — called when the user clicks a marker
 */
export default function Airports({ onLoad, selectedIdent, onSelectAirport }) {
  const [airports, setAirports] = useState([])
  const [cyyzRunways, setCyyzRunways] = useState([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const airportResponse = await fetch('/data/airports.csv')
        const airportText = await airportResponse.text()
        const airportLines = airportText.split('\n')
        const airportList = []

        for (let i = 1; i < airportLines.length; i++) {
          if (airportLines[i].trim() === '') continue

          const row = parseCSVLine(airportLines[i])
          if (row.length >= 12) {
            const ident = row[1]?.trim()
            const name = row[3]?.trim()
            const type = row[2]?.trim()
            const lat = parseFloat(row[4])
            const lon = parseFloat(row[5])
            const country = row[8]?.trim()
            const region = row[9]?.trim()
            const scheduledService = row[11]?.trim()
            const isLargeAirport = type === 'large_airport'
            const isOntarioServiceAirport =
              country === 'CA' && region === 'CA-ON' && scheduledService === 'yes'

            if (!isNaN(lat) && !isNaN(lon) && ident && name && (isLargeAirport || isOntarioServiceAirport)) {
              airportList.push({ ident, name, lat, lon })
            }
          }
        }

        setAirports(airportList)
        onLoad?.(airportList)

        const runwayResponse = await fetch('/data/runways.csv')
        const runwayText = await runwayResponse.text()
        const runwayLines = runwayText.split('\n')
        const runways = []

        for (let i = 1; i < runwayLines.length; i++) {
          if (runwayLines[i].trim() === '') continue

          const row = parseCSVLine(runwayLines[i])
          const airportIdent = row[2]?.trim()

          if (airportIdent === 'CYYZ' && row.length >= 20) {
            runways.push({
              airport_ident: airportIdent,
              length_ft: row[3]?.trim() || '',
              width_ft: row[4]?.trim() || '',
              surface: row[5]?.trim() || '',
              le_ident: row[8]?.trim() || '',
              le_latitude_deg: parseFloat(row[9]) || 0,
              le_longitude_deg: parseFloat(row[10]) || 0,
              he_ident: row[14]?.trim() || '',
              he_latitude_deg: parseFloat(row[15]) || 0,
              he_longitude_deg: parseFloat(row[16]) || 0,
              le_heading_degT: parseFloat(row[12]) || 0,
            })
          }
        }

        setCyyzRunways(runways)
      } catch (error) {
        console.error('Error fetching airport data:', error)
        onLoad?.([])
      }
    }

    fetchData()
  }, [])

  const cyyzAirport = airports.find((a) => a.ident === 'CYYZ')

  const runwayPolylines = cyyzAirport
    ? cyyzRunways.map((runway, idx) => {
        const startLat = runway.le_latitude_deg || cyyzAirport.lat
        const startLon = runway.le_longitude_deg || cyyzAirport.lon
        const endLat = runway.he_latitude_deg || cyyzAirport.lat
        const endLon = runway.he_longitude_deg || cyyzAirport.lon

        return (
          <Polyline
            key={`runway-${idx}`}
            positions={[[startLat, startLon], [endLat, endLon]]}
            color="#00ff00"
            weight={4}
            opacity={0.8}
          >
            <Popup>
              <div style={{ fontSize: '12px' }}>
                Runway {runway.le_ident}/{runway.he_ident}<br />
                Length: {runway.length_ft} ft<br />
                Width: {runway.width_ft} ft<br />
                Surface: {runway.surface}
              </div>
            </Popup>
          </Polyline>
        )
      })
    : null

  return (
    <>
      {airports.map((airport, idx) => {
        const isSelected = selectedIdent === airport.ident
        const isCYYZ = airport.ident === 'CYYZ'

        return (
          <CircleMarker
            key={`airport-${idx}`}
            center={[airport.lat, airport.lon]}
            radius={isCYYZ ? 8 : 5}
            fillColor={isCYYZ ? '#ff6600' : isSelected ? '#ff7a18' : '#00ccff'}
            color={isCYYZ ? '#ff6600' : isSelected ? '#ff7a18' : '#00ccff'}
            weight={isCYYZ ? 2 : 1}
            opacity={isCYYZ ? 1 : 0.85}
            fillOpacity={isCYYZ ? 0.8 : 0.65}
            eventHandlers={{ click: () => onSelectAirport?.(airport) }}
          >
            <Popup>
              <div style={{ fontSize: '12px' }}>
                <strong>{airport.ident}</strong><br />
                {airport.name}<br />
                {isCYYZ && <>Runways: {cyyzRunways.length}<br /></>}
                Lat: {airport.lat.toFixed(4)}, Lon: {airport.lon.toFixed(4)}
              </div>
            </Popup>
          </CircleMarker>
        )
      })}

      {runwayPolylines}
    </>
  )
}