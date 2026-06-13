import React from 'react'
import { Polyline, Tooltip } from 'react-leaflet'

// Pulsing achieved via CSS animation on a key-changing element
export default function RoutePreview({ routes, appState }) {
  if (!routes || routes.length === 0) return null

  const isPulsing = appState === 'AWAITING_CONFIRMATION' || appState === 'RECOMMENDING'

  return (
    <>
      {routes.map((route) => {
        const isRec = route.recommended
        return (
          <Polyline
            key={`${route.id}-${isPulsing}`}
            positions={route.waypoints}
            pathOptions={{
              color:     isRec ? '#3b82f6' : '#555',
              weight:    isRec ? 2.5 : 1.5,
              dashArray: isRec ? (isPulsing ? '12 8' : '8 6') : '6 8',
              opacity:   isRec ? 0.9 : 0.45,
              className: isRec && isPulsing ? 'route-pulse' : '',
            }}
            interactive={false}
          >
            <Tooltip permanent direction="center" className="route-label">
              <span style={{ fontFamily: 'monospace', fontSize: 10 }}>
                {route.name} · {(route.score * 100).toFixed(0)}pts
                {isRec ? ' ★' : ''}
              </span>
            </Tooltip>
          </Polyline>
        )
      })}
    </>
  )
}
