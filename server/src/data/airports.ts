export interface RunwayDef {
  id:          string
  hdgLow:      number
  hdgHigh:     number
  thresholdLow:  [number, number]   // [lat, lon]
  thresholdHigh: [number, number]
}

export interface GateDef {
  id:  string
  lat: number
  lon: number
}

export interface Airport {
  icao:    string
  name:    string
  lat:     number
  lon:     number
  runways: RunwayDef[]
  gates:   GateDef[]
}

export const AIRPORTS: Airport[] = [
  {
    icao: 'CYYZ',
    name: 'Toronto Pearson',
    lat:  43.6777,
    lon:  -79.6248,
    runways: [
      { id: '05/23',   hdgLow: 50,  hdgHigh: 230, thresholdLow: [43.6721,-79.6392], thresholdHigh: [43.6889,-79.6072] },
      { id: '06L/24R', hdgLow: 57,  hdgHigh: 237, thresholdLow: [43.6584,-79.6476], thresholdHigh: [43.6836,-79.5986] },
      { id: '06R/24L', hdgLow: 57,  hdgHigh: 237, thresholdLow: [43.6638,-79.6383], thresholdHigh: [43.6901,-79.5874] },
      { id: '15L/33R', hdgLow: 150, hdgHigh: 330, thresholdLow: [43.6944,-79.6301], thresholdHigh: [43.6626,-79.6117] },
      { id: '15R/33L', hdgLow: 150, hdgHigh: 330, thresholdLow: [43.6983,-79.6235], thresholdHigh: [43.6663,-79.6051] },
    ],
    gates: [
      { id: 'Gate A1',  lat: 43.6803, lon: -79.6134 },
      { id: 'Gate D30', lat: 43.6771, lon: -79.6089 },
      { id: 'Gate F98', lat: 43.6748, lon: -79.6201 },
    ],
  },
  {
    icao: 'CYVR',
    name: 'Vancouver International',
    lat:  49.1967,
    lon:  -123.1815,
    runways: [
      { id: '08L/26R', hdgLow: 80, hdgHigh: 260, thresholdLow: [49.1944,-123.2103], thresholdHigh: [49.1944,-123.1501] },
      { id: '08R/26L', hdgLow: 80, hdgHigh: 260, thresholdLow: [49.1878,-123.2103], thresholdHigh: [49.1878,-123.1501] },
    ],
    gates: [
      { id: 'Gate C48', lat: 49.1953, lon: -123.1755 },
      { id: 'Gate D72', lat: 49.1941, lon: -123.1788 },
    ],
  },
  {
    icao: 'CYUL',
    name: 'Montréal-Trudeau',
    lat:  45.4706,
    lon:  -73.7408,
    runways: [
      { id: '06L/24R', hdgLow: 60,  hdgHigh: 240, thresholdLow: [45.4598,-73.7672], thresholdHigh: [45.4798,-73.7081] },
      { id: '10/28',   hdgLow: 100, hdgHigh: 280, thresholdLow: [45.4731,-73.7598], thresholdHigh: [45.4680,-73.7203] },
    ],
    gates: [
      { id: 'Gate 61', lat: 45.4712, lon: -73.7401 },
    ],
  },
  {
    icao: 'CYYC',
    name: 'Calgary International',
    lat:  51.1139,
    lon:  -114.0200,
    runways: [
      { id: '08/26',   hdgLow: 80,  hdgHigh: 260, thresholdLow: [51.1128,-114.0551], thresholdHigh: [51.1128,-113.9883] },
      { id: '17L/35R', hdgLow: 170, hdgHigh: 350, thresholdLow: [51.1389,-114.0108], thresholdHigh: [51.0939,-114.0108] },
    ],
    gates: [
      { id: 'Gate C27', lat: 51.1134, lon: -114.0178 },
    ],
  },
  {
    icao: 'CYEG',
    name: 'Edmonton International',
    lat:  53.3097,
    lon:  -113.5797,
    runways: [
      { id: '12/30', hdgLow: 120, hdgHigh: 300, thresholdLow: [53.3197,-113.6101], thresholdHigh: [53.2997,-113.5493] },
      { id: '02/20', hdgLow: 20,  hdgHigh: 200, thresholdLow: [53.2897,-113.5797], thresholdHigh: [53.3297,-113.5797] },
    ],
    gates: [
      { id: 'Gate A11', lat: 53.3097, lon: -113.5771 },
    ],
  },
]

export const getAirport = (icao: string) => AIRPORTS.find(a => a.icao === icao)
