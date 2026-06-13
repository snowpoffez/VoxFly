import React from 'react'

const TYPE_LABEL = {
  large_airport:  'Large Airport',
  medium_airport: 'Medium Airport',
  small_airport:  'Small Airport',
  heliport:       'Heliport',
  seaplane_base:  'Seaplane Base',
}

const fmtCoord = (v, pos, neg) =>
  v == null ? '—' : `${Math.abs(v).toFixed(5)}° ${v >= 0 ? pos : neg}`

const fmtNum = (n) => {
  if (!n || n === '' || n === '0') return null
  return Number(n).toLocaleString()
}

const SURFACE_SHORT = {
  ASPH: 'Asphalt', ASP: 'Asphalt', ASPHALT: 'Asphalt',
  CONC: 'Concrete', CON: 'Concrete', CONCRETE: 'Concrete',
  TURF: 'Turf', GRS: 'Grass', GRASS: 'Grass',
  DIRT: 'Dirt', GRAVEL: 'Gravel', GVL: 'Gravel',
  WATER: 'Water', ICE: 'Ice',
}
const fmtSurface = (s) => {
  if (!s) return '—'
  const upper = s.toUpperCase().split('-')[0].split('/')[0].trim()
  return SURFACE_SHORT[upper] || s.split('-')[0].split('/')[0].trim()
}

const Row = ({ label, value }) => (
  <div className="airport-card__row">
    <span className="airport-card__label">{label}</span>
    <span className="airport-card__value">{value ?? '—'}</span>
  </div>
)

export default function AirportInfoCard({ airport, runwaysMap, onClose }) {
  if (!airport) return null

  const runways = (runwaysMap?.[airport.ident] ?? []).filter(r => !r.closed)

  const typeLabel = TYPE_LABEL[airport.type] || airport.type || '—'
  const region    = airport.region?.replace(/^[A-Z]+-/, '') || '—'

  return (
    <div className="airport-card">
      <button className="airport-card__close" onClick={onClose} aria-label="Close">×</button>

      {/* header */}
      <div className="airport-card__header">
        <div className="airport-card__icon">⊕</div>
        <div>
          <div className="airport-card__title">{airport.ident}</div>
          <div className="airport-card__subtitle">{airport.name}</div>
        </div>
      </div>

      {/* codes row */}
      {airport.iata && (
        <div className="airport-card__codes">
          <div className="airport-card__code-item">
            <span className="airport-card__code-label">ICAO</span>
            <span className="airport-card__code-value">{airport.ident}</span>
          </div>
          <div className="airport-card__code-item">
            <span className="airport-card__code-label">IATA</span>
            <span className="airport-card__code-value">{airport.iata}</span>
          </div>
          <div className="airport-card__code-item">
            <span className="airport-card__code-label">TYPE</span>
            <span className="airport-card__code-value airport-card__code-value--dim">{typeLabel}</span>
          </div>
        </div>
      )}

      {/* location */}
      <div className="airport-card__section">
        {airport.city    && <Row label="Municipality" value={airport.city} />}
        <Row label="Region"   value={region} />
        <Row label="Country"  value={airport.country} />
        {airport.elevFt  && <Row label="Elevation" value={`${fmtNum(airport.elevFt) ?? airport.elevFt} ft`} />}
      </div>

      {/* coordinates */}
      <div className="airport-card__section">
        <Row label="Latitude"  value={fmtCoord(airport.lat, 'N', 'S')} />
        <Row label="Longitude" value={fmtCoord(airport.lon, 'E', 'W')} />
      </div>

      {/* runways */}
      {runways.length > 0 && (
        <div className="airport-card__section airport-card__section--runways">
          <div className="airport-card__section-title">
            Runways
            <span className="airport-card__section-count">{runways.length}</span>
          </div>
          <div className="airport-card__runway-list">
            {runways.map((rwy, idx) => {
              const desig = rwy.le_ident && rwy.he_ident
                ? `${rwy.le_ident}/${rwy.he_ident}`
                : rwy.le_ident || rwy.he_ident || '—'
              const len = fmtNum(rwy.length_ft)
              return (
                <div key={idx} className="airport-card__runway-row">
                  <span className="airport-card__runway-desig">{desig}</span>
                  <span className="airport-card__runway-len">{len ? `${len} ft` : '—'}</span>
                  <span className="airport-card__runway-surf">{fmtSurface(rwy.surface)}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
