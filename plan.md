# Assistive Flying System — Hackathon Build Plan

A real-time assistive co-pilot system that detects turbulence from live flight data,
announces a corrective action via ElevenLabs voice, listens for pilot voice confirmation,
and physically moves servo-driven wing flaps on a hardware model while simultaneously
updating a 3D aircraft visualization on a React dashboard.

See the repository README and per-directory files for the full implementation. The state
machine is:

```
IDLE
  └─► TURBULENCE_DETECTED  (OpenSky vertical_rate threshold crossed OR debug toggle)
        └─► ANNOUNCING      (ElevenLabs TTS fires)
              └─► AWAITING_CONFIRMATION  (listening for "yes" / "confirm" / "agree")
                    ├─► EXECUTING   (serial command, servo moves, 3D plane stabilizes)
                    │     └─► STABILIZED └─► IDLE (after 3 seconds)
                    └─► TIMEOUT     (no confirmation in 5 seconds → IDLE, log event)
```
