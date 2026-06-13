# Assistive Flying System

Real-time assistive co-pilot: detects turbulence from live flight data → announces a
corrective action via ElevenLabs → listens for pilot voice confirmation → moves
servo-driven flaps on a hardware model and stabilizes a 3D aircraft on the dashboard.

## Layout

```
.
├── plan.md
├── frontend/   Vite + React + Mapbox GL + Three.js dashboard
├── backend/    Python orchestrator (OpenSky, turbulence, voice, serial, WebSocket)
└── arduino/    flap_controller.ino (2x servo)
```

## Quick start

### Frontend
```bash
cd frontend
npm install
cp .env.example .env          # optional — no map key needed
npm run dev                   # http://localhost:5173
```

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows  (source venv/bin/activate on macOS/Linux)
pip install -r requirements.txt
copy .env.example .env         # add ElevenLabs key + serial port
python main.py                 # ws://localhost:8765
```

### Arduino
Open `arduino/flap_controller/flap_controller.ino` in the Arduino IDE, select your board
and port, and upload. The Serial Monitor should print `READY`.

## Demo without hardware / network

- **Map uses no API key.** Tiles come from keyless CARTO dark (default) or Esri
  satellite — set `VITE_MAP_STYLE=dark|satellite` in `frontend/.env`. If the venue
  WiFi is down the tiles won't load, but the standalone 3D aircraft panel
  (bottom-right) still shows the shake/stabilize animation driven by WebSocket state.
- **No OpenSky / bad WiFi?** Set `USE_REPLAY=true` in `backend/.env` to play
  `replay_data/recorded_flight.json`.
- **No microphone / noisy room?** Set `SKIP_VOICE=true` in `backend/.env` to
  auto-confirm, and use the **TRIGGER TURBULENCE** button on the dashboard.

## Real-time turbulence detection

Turbulence is driven by **live OpenSky data**, not a timer:

1. The backend queries `/states/all` for a bounding box (default: YYZ / Great Lakes,
   set via `OPENSKY_*` in `backend/.env`) every `POLL_INTERVAL` seconds.
2. It **locks onto one aircraft** by `icao24` and re-finds that same airframe each
   poll, so its `vertical_rate` samples form a coherent time series.
3. `TurbulenceDetector` flags turbulence when that series oscillates (≥2 sign flips)
   with a spike above `TURBULENCE_THRESHOLD` m/s — i.e. the plane is bouncing up and
   down for real on the live feed.

OpenSky's anonymous feed refreshes about every 10s, so polling faster than that adds
nothing. The **TRIGGER TURBULENCE** button stays available to force the sequence for a
deterministic demo regardless of live conditions.

## Airport overlay

Airports come from the [OurAirports](https://ourairports.com/data/) public-domain CSV
(no key). On map load the frontend fetches the CSV, filters to scheduled-service
large/medium airports, and renders them as colored dots with IATA labels; click a dot
for a name/city popup. See `frontend/src/components/AirportLayer.js`.

## State machine

`IDLE → TURBULENCE_DETECTED → ANNOUNCING → AWAITING_CONFIRMATION → EXECUTING →
STABILIZED → IDLE`, with `AWAITING_CONFIRMATION → TIMEOUT → IDLE` if no confirmation
arrives within `CONFIRMATION_TIMEOUT` seconds.
