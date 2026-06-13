import { useState, useEffect, useRef, useCallback } from 'react'

const DEFAULT_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8765'

const INITIAL_STATE = {
  systemState: 'IDLE',
  turbulence: false,
  verticalRate: 0,
  altitude: 0,
  velocity: 0,
  callsign: '',
  latitude: null,
  longitude: null,
  heading: 0,
}

export function useFlightSocket(url = DEFAULT_URL) {
  const [flightState, setFlightState] = useState(INITIAL_STATE)
  const [connected, setConnected] = useState(false)
  const ws = useRef(null)
  const closedByUs = useRef(false)

  useEffect(() => {
    closedByUs.current = false

    function connect() {
      const socket = new WebSocket(url)
      ws.current = socket

      socket.onopen = () => setConnected(true)

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          setFlightState((prev) => ({ ...prev, ...data }))
        } catch (err) {
          console.warn('[ws] bad message', err)
        }
      }

      socket.onclose = () => {
        setConnected(false)
        if (!closedByUs.current) setTimeout(connect, 2000) // reconnect on drop
      }

      socket.onerror = () => socket.close()
    }

    connect()
    return () => {
      closedByUs.current = true
      ws.current?.close()
    }
  }, [url])

  const send = useCallback((payload) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(payload))
    }
  }, [])

  const sendDebugTrigger = useCallback(
    () => send({ type: 'DEBUG_TURBULENCE' }),
    [send]
  )
  const sendDebugStabilize = useCallback(
    () => send({ type: 'DEBUG_STABILIZE' }),
    [send]
  )

  return { flightState, connected, sendDebugTrigger, sendDebugStabilize }
}
