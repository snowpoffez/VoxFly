import maplibregl from 'maplibre-gl'

// OurAirports open data (public domain, no key). ~80k rows; we filter to
// scheduled-service large/medium airports to keep the payload light.
const CSV_URL =
  'https://davidmegginson.github.io/ourairports-data/airports.csv'

// Minimal RFC-4180-ish CSV line parser: handles quoted fields and escaped
// double-quotes. Good enough for the OurAirports export.
function parseCsvLine(line) {
  const out = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      out.push(field)
      field = ''
    } else {
      field += c
    }
  }
  out.push(field)
  return out
}

function toGeoJson(csvText, types) {
  const lines = csvText.split(/\r?\n/)
  const header = parseCsvLine(lines[0])
  const col = (name) => header.indexOf(name)
  const iType = col('type')
  const iName = col('name')
  const iLat = col('latitude_deg')
  const iLon = col('longitude_deg')
  const iIata = col('iata_code')
  const iIdent = col('ident')
  const iMuni = col('municipality')
  const iService = col('scheduled_service')

  const features = []
  for (let k = 1; k < lines.length; k++) {
    if (!lines[k]) continue
    const c = parseCsvLine(lines[k])
    if (!types.includes(c[iType])) continue
    if (c[iService] !== 'yes') continue
    const lat = parseFloat(c[iLat])
    const lon = parseFloat(c[iLon])
    if (Number.isNaN(lat) || Number.isNaN(lon)) continue
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties: {
        name: c[iName],
        code: c[iIata] || c[iIdent] || '',
        type: c[iType],
        municipality: c[iMuni] || '',
      },
    })
  }
  return { type: 'FeatureCollection', features }
}

// Fetches the airport CSV, adds a dot layer + IATA labels, and wires a click
// popup. Returns the number of airports added (0 on failure — non-fatal).
export async function addAirports(
  map,
  { types = ['large_airport', 'medium_airport'] } = {}
) {
  let geojson
  try {
    const res = await fetch(CSV_URL)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    geojson = toGeoJson(await res.text(), types)
  } catch (e) {
    console.warn('[airports] could not load OurAirports CSV:', e)
    return 0
  }

  if (map._removed) return 0
  map.addSource('airports', { type: 'geojson', data: geojson })

  map.addLayer({
    id: 'airport-dots',
    type: 'circle',
    source: 'airports',
    paint: {
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        4,
        ['match', ['get', 'type'], 'large_airport', 3, 1.5],
        9,
        ['match', ['get', 'type'], 'large_airport', 7, 4],
      ],
      'circle-color': [
        'match',
        ['get', 'type'],
        'large_airport',
        '#00ffcc',
        '#3a9bdc',
      ],
      'circle-stroke-width': 1,
      'circle-stroke-color': '#001018',
      'circle-opacity': 0.9,
    },
  })

  map.addLayer({
    id: 'airport-labels',
    type: 'symbol',
    source: 'airports',
    minzoom: 6,
    filter: ['!=', ['get', 'code'], ''],
    layout: {
      'text-field': ['get', 'code'],
      'text-font': ['Open Sans Regular'],
      'text-size': 11,
      'text-offset': [0, 1.1],
      'text-anchor': 'top',
      'text-allow-overlap': false,
    },
    paint: {
      'text-color': '#9ff7e6',
      'text-halo-color': '#001018',
      'text-halo-width': 1.2,
    },
  })

  const popup = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: true,
    offset: 10,
  })

  map.on('mouseenter', 'airport-dots', () => {
    map.getCanvas().style.cursor = 'pointer'
  })
  map.on('mouseleave', 'airport-dots', () => {
    map.getCanvas().style.cursor = ''
  })
  map.on('click', 'airport-dots', (e) => {
    const f = e.features?.[0]
    if (!f) return
    const p = f.properties
    popup
      .setLngLat(f.geometry.coordinates)
      .setHTML(
        `<div style="font-family:monospace;font-size:12px;color:#022">
           <strong>${p.code || '—'}</strong> · ${p.name}<br/>
           <span style="opacity:.7">${p.municipality}</span>
         </div>`
      )
      .addTo(map)
  })

  console.log(`[airports] loaded ${geojson.features.length} airports`)
  return geojson.features.length
}
