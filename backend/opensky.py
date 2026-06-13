import os
import json
import time
import requests

OPENSKY_URL = "https://opensky-network.org/api/states/all"
TOKEN_URL = (
    "https://auth.opensky-network.org/auth/realms/"
    "opensky-network/protocol/openid-connect/token"
)
REPLAY_PATH = os.path.join(os.path.dirname(__file__), "replay_data", "recorded_flight.json")

# OpenSky state-vector indices (see rest.html — each row has 18 fields).
IDX_ICAO24 = 0
IDX_CALLSIGN = 1
IDX_LON = 5
IDX_LAT = 6
IDX_BARO_ALT = 7
IDX_ON_GROUND = 8
IDX_VELOCITY = 9
IDX_HEADING = 10        # true_track, degrees
IDX_VERTICAL_RATE = 11

# Bounding box to query (degrees). Defaults to the Great Lakes / YYZ region so the
# tracked aircraft appears inside the dashboard map view. Override via .env.
# Box area drives the credit cost: <=25 sq deg = 1 credit, 25-100 = 2, etc.
BBOX = {
    "lamin": float(os.environ.get("OPENSKY_LAMIN", 41.0)),
    "lomin": float(os.environ.get("OPENSKY_LOMIN", -84.0)),
    "lamax": float(os.environ.get("OPENSKY_LAMAX", 47.0)),
    "lomax": float(os.environ.get("OPENSKY_LOMAX", -74.0)),
}

# --- OAuth2 client-credentials auth (the only auth OpenSky now accepts) --------
# Tokens last 30 minutes; we cache and refresh with a safety margin.
_token = {"value": None, "expires_at": 0.0}


def _get_token():
    client_id = os.environ.get("OPENSKY_CLIENT_ID")
    client_secret = os.environ.get("OPENSKY_CLIENT_SECRET")
    if not (client_id and client_secret):
        return None  # fall back to anonymous access

    now = time.time()
    if _token["value"] and now < _token["expires_at"] - 60:
        return _token["value"]

    try:
        resp = requests.post(
            TOKEN_URL,
            data={
                "grant_type": "client_credentials",
                "client_id": client_id,
                "client_secret": client_secret,
            },
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
        _token["value"] = data["access_token"]
        _token["expires_at"] = now + data.get("expires_in", 1800)
        print("[OpenSky] OAuth2 token acquired")
        return _token["value"]
    except Exception as e:  # noqa: BLE001
        print(f"[OpenSky] Token request failed: {e} — using anonymous access")
        return None


def _headers():
    token = _get_token()
    return {"Authorization": f"Bearer {token}"} if token else {}


def _load_replay():
    with open(REPLAY_PATH) as f:
        return json.load(f)


def _filter(states):
    return [
        s
        for s in states
        if s[IDX_VERTICAL_RATE] is not None
        and s[IDX_LAT] is not None
        and s[IDX_LON] is not None
        and not s[IDX_ON_GROUND]
    ]


def fetch_flights(use_replay=False):
    if use_replay:
        return _load_replay()
    try:
        resp = requests.get(OPENSKY_URL, params=BBOX, headers=_headers(), timeout=15)
        # An expired/invalid token returns 401 — drop it and retry once.
        if resp.status_code == 401:
            _token["value"] = None
            resp = requests.get(
                OPENSKY_URL, params=BBOX, headers=_headers(), timeout=15
            )
        resp.raise_for_status()
        states = resp.json().get("states", []) or []
        return _filter(states)
    except Exception as e:  # noqa: BLE001 — demo resilience over precision
        print(f"[OpenSky] Error: {e} — switching to replay data")
        return _load_replay()


def pick_interesting_flight(states):
    if not states:
        return None
    # Highest absolute vertical rate makes the best subject to lock onto.
    return max(states, key=lambda s: abs(s[IDX_VERTICAL_RATE] or 0))


def find_by_icao(states, icao24):
    """Re-locate a previously tracked aircraft in a fresh poll, so its
    vertical-rate history stays coherent across polls."""
    if not icao24:
        return None
    return next((s for s in states if s[IDX_ICAO24] == icao24), None)


def parse_flight(state):
    return {
        "icao24": state[IDX_ICAO24],
        "callsign": (state[IDX_CALLSIGN] or "UNKNOWN").strip(),
        "latitude": state[IDX_LAT],
        "longitude": state[IDX_LON],
        "altitude": state[IDX_BARO_ALT],
        "velocity": state[IDX_VELOCITY],
        "heading": state[IDX_HEADING] or 0,
        "verticalRate": state[IDX_VERTICAL_RATE],
    }
