import os
import asyncio

from dotenv import load_dotenv

load_dotenv()

from opensky import (
    fetch_flights,
    pick_interesting_flight,
    find_by_icao,
    parse_flight,
)
from turbulence import TurbulenceDetector
from voice import speak, listen_for_confirmation
from serial_handler import SerialHandler
from websocket_server import broadcast, start_server, set_state_ref

USE_REPLAY = os.environ.get("USE_REPLAY", "false").lower() == "true"
# OpenSky's anonymous /states feed refreshes ~every 10s (5s authenticated), so
# there's no benefit polling faster than that.
POLL_INTERVAL = float(os.environ.get("POLL_INTERVAL", 6))

shared_state = {
    "system_state": "IDLE",
    "debug_trigger": False,
    "debug_stabilize": False,
}
set_state_ref(shared_state)

detector = TurbulenceDetector()
serial = SerialHandler()

# icao24 of the aircraft we've locked onto. Tracking one airframe across polls is
# what makes the vertical-rate history (and therefore the turbulence signal) real.
tracked_icao = None

# Last parsed flight, so the manual STABILIZE button has something to broadcast.
last_flight = {
    "callsign": "DEMO",
    "latitude": 43.68,
    "longitude": -79.63,
    "altitude": 9500,
    "velocity": 245,
    "heading": 270,
    "verticalRate": 0,
}


async def push(state_name, turbulence, flight):
    shared_state["system_state"] = state_name
    await broadcast({"systemState": state_name, "turbulence": turbulence, **flight})


def acquire_flight(states):
    """Return the live state for the locked aircraft, re-locking onto a fresh
    target if we have none yet or the current one left the query area."""
    global tracked_icao
    state = find_by_icao(states, tracked_icao) if tracked_icao else None
    if state is None:
        state = pick_interesting_flight(states)
    if state is not None:
        parsed = parse_flight(state)
        tracked_icao = parsed.get("icao24") or tracked_icao
        return parsed
    return None


async def flight_loop():
    while True:
        states = fetch_flights(use_replay=USE_REPLAY)
        parsed = acquire_flight(states)
        if parsed:
            last_flight.update(parsed)
            # Feed the locked aircraft's real vertical rate to the detector.
            detector.update(parsed["verticalRate"])
            print(
                f"[OpenSky] {parsed['callsign'] or parsed['icao24']} "
                f"vr={parsed['verticalRate']:+.1f} m/s  alt={parsed['altitude']}"
            )

        # Manual trigger from the dashboard (bypasses live detection for demos).
        if shared_state.get("debug_trigger"):
            shared_state["debug_trigger"] = False
            detector.set_debug(True)

        # Manual stabilize: clear turbulence and level the flaps immediately.
        if shared_state.get("debug_stabilize"):
            shared_state["debug_stabilize"] = False
            detector.set_debug(False)
            detector.history.clear()
            serial.send("RETURN_LEVEL")

        turbulent = detector.is_turbulent()

        if turbulent and shared_state["system_state"] == "IDLE":
            await run_turbulence_sequence(dict(last_flight))
        else:
            await push("IDLE", turbulent, last_flight)
            detector.set_debug(False)

        await asyncio.sleep(POLL_INTERVAL)


async def run_turbulence_sequence(flight):
    await push("TURBULENCE_DETECTED", True, flight)
    await asyncio.sleep(0.3)

    await push("ANNOUNCING", True, flight)
    await asyncio.get_event_loop().run_in_executor(
        None,
        speak,
        "Turbulence detected. Suggesting 15-degree pitch up to stabilize. Confirm?",
    )

    await push("AWAITING_CONFIRMATION", True, flight)
    confirmed = await asyncio.get_event_loop().run_in_executor(
        None, listen_for_confirmation
    )

    if confirmed:
        await push("EXECUTING", False, flight)
        serial.send("MOVE_UP")
        await asyncio.get_event_loop().run_in_executor(
            None, speak, "Correction applied. Stabilizing."
        )
        await asyncio.sleep(3)

        serial.send("RETURN_LEVEL")
        await push("STABILIZED", False, flight)
        await asyncio.sleep(2)
    else:
        await push("TIMEOUT", False, flight)
        await asyncio.get_event_loop().run_in_executor(
            None, speak, "No confirmation received. Returning to standby."
        )
        await asyncio.sleep(2)

    await push("IDLE", False, flight)
    detector.set_debug(False)
    # Drop the window that just fired so we don't immediately re-trigger on the
    # same oscillation; a fresh real spike has to build up again.
    detector.history.clear()
    shared_state["debug_stabilize"] = False


async def main():
    serial.connect()
    try:
        await asyncio.gather(start_server(), flight_loop())
    finally:
        serial.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[main] Shutting down.")
