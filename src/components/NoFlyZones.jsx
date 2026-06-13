import React from 'react'
import { Circle, Tooltip } from 'react-leaflet'

const NM_TO_M = 1852

export default function NoFlyZones({ zones }) {
  if (!zones || zones.length === 0) return null
  return (
    <>
      {zones.map((z, i) => (
        <Circle
          key={i}
          center={[z.lat, z.lon]}
          radius={z.radiusNm * NM_TO_M}
          pathOptions={{
            color:       '#ef4444',
            fillColor:   '#ef4444',
            fillOpacity: 0.10,
            weight:      1.5,
            dashArray:   '6 4',
          }}
          interactive={false}
        >
          <Tooltip direction="top" className="nfz-label">
            <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#ef4444' }}>
              ⛔ {z.name}
            </span>
          </Tooltip>
        </Circle>
      ))}
    </>
  )
}
