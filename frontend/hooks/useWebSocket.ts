'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { WS_URL } from '@/lib/api'
import type { WsEvent } from '@/lib/types'

type Handler = (event: WsEvent) => void

export function useWebSocket(onMessage: Handler) {
  const ws      = useRef<WebSocket | null>(null)
  const handlers = useRef<Handler>(onMessage)
  const [connected, setConnected] = useState(false)
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Always use latest handler
  useEffect(() => { handlers.current = onMessage }, [onMessage])

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return

    try {
      const socket = new WebSocket(WS_URL)
      ws.current = socket

      socket.onopen = () => {
        setConnected(true)
        console.log('[WS] Connected')
      }

      socket.onmessage = (e) => {
        try {
          const data: WsEvent = JSON.parse(e.data)
          handlers.current(data)
        } catch { /* ignore malformed */ }
      }

      socket.onclose = () => {
        setConnected(false)
        console.log('[WS] Disconnected — reconnecting in 3s')
        reconnectTimeout.current = setTimeout(connect, 3000)
      }

      socket.onerror = () => socket.close()
    } catch (err) {
      console.error('[WS] Error:', err)
      reconnectTimeout.current = setTimeout(connect, 5000)
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current)
      ws.current?.close()
    }
  }, [connect])

  return { connected }
}
