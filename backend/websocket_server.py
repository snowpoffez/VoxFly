import json
import asyncio
import websockets

connected_clients = set()

# Set by main.py so the handler can flip debug flags on the shared state dict.
_shared_state = None


def set_state_ref(state: dict):
    global _shared_state
    _shared_state = state


async def handler(websocket):
    connected_clients.add(websocket)
    print(f"[WS] Client connected ({len(connected_clients)} total)")
    try:
        async for message in websocket:
            try:
                data = json.loads(message)
            except json.JSONDecodeError:
                continue
            msg_type = data.get("type")
            if msg_type == "DEBUG_TURBULENCE" and _shared_state is not None:
                _shared_state["debug_trigger"] = True
            elif msg_type == "DEBUG_STABILIZE" and _shared_state is not None:
                _shared_state["debug_stabilize"] = True
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        connected_clients.discard(websocket)
        print(f"[WS] Client disconnected ({len(connected_clients)} total)")


async def broadcast(payload: dict):
    if not connected_clients:
        return
    message = json.dumps(payload)
    results = await asyncio.gather(
        *[c.send(message) for c in connected_clients],
        return_exceptions=True,
    )
    for r in results:
        if isinstance(r, Exception):
            pass  # client dropped mid-send; cleaned up by the handler


async def start_server(host="localhost", port=8765):
    async with websockets.serve(handler, host, port):
        print(f"[WS] Server running on ws://{host}:{port}")
        await asyncio.Future()  # run forever
