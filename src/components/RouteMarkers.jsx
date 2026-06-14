import React from 'react'
import { CircleMarker, Tooltip, Polyline } from 'react-leaflet'

export default function RouteMarkers({ routes, targetHeading }) {
  if (!routes || routes.length === 0) return null

  // Format array to standard Leaflet LatLng arrays [[lat, lon], ...]
  const polylinePositions = routes.map(point => [point.lat, point.lon])

  return (
    <>
      {/* Optional: Connect the red markers with a subtle red path line */}
      <Polyline 
        positions={polylinePositions} 
        pathOptions={{ color: '#ef4444', weight: 2, dashArray: '5, 5', opacity: 0.6 }} 
      />

      {routes.map((point, idx) => {
        if (!point.lat || !point.lon) return null

        return (
          <CircleMarker
            key={`route-point-${idx}`}
            center={[point.lat, point.lon]}
            radius={6}
            pathOptions={{
              color: '#ef4444',       // Red border
              fillColor: '#b91c1c',   // Darker red fill
              fillOpacity: 0.9,
              weight: 2
            }}
          >
            <Tooltip permanent={false} direction="top" offset={[0, -5]}>
              <div style={{ color: '#000', fontSize: '11px', fontWeight: 'bold' }}>
                {point.ident || `FIX-${idx + 1}`}
                {point.alt ? <div style={{ fontWeight: 'normal', color: '#666' }}>FL{point.alt / 100}</div> : null}
              </div>
            </Tooltip>
          </CircleMarker>
        )
      })}
    </>
  )
}