export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
export const WS_URL   = process.env.NEXT_PUBLIC_WS_URL  || 'ws://localhost:8000/ws'

// ─── Generic fetch helper ────────────────────────────────────────────────
async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || res.statusText)
  }
  return res.json()
}

export const api = {
  get:    <T>(path: string)              => req<T>('GET',  path),
  post:   <T>(path: string, body: unknown) => req<T>('POST', path, body),
  delete: <T>(path: string)              => req<T>('DELETE', path),
}

// ─── Telemetry ───────────────────────────────────────────────────────────
export const fetchRecent     = (limit = 60, device_id?: string) => 
  api.get(`/api/v1/telemetry/recent?limit=${limit}${device_id ? `&device_id=${device_id}` : ''}`)
export const fetchPackets    = (limit = 100, device_id?: string) => 
  api.get(`/api/v1/telemetry/packets?limit=${limit}${device_id ? `&device_id=${device_id}` : ''}`)

// ─── Config ──────────────────────────────────────────────────────────────
export const fetchConfig     = ()            => api.get('/api/v1/config/all')
export const setProtocol     = (p: string)   => api.post('/api/v1/config/protocol', { protocol: p })
export const setEncryption   = (e: boolean)  => api.post('/api/v1/config/encryption', { enabled: e })
export const setAuth         = (e: boolean)  => api.post('/api/v1/config/auth', { enabled: e })
export const setReplay       = (e: boolean)  => api.post('/api/v1/config/replay', { enabled: e })
export const setChaos        = (c: { loss_pct: number; latency_ms: number; tamper: boolean }) =>
  api.post('/api/v1/config/chaos', c)

// ─── Control ─────────────────────────────────────────────────────────────
export const disconnectDevice = (device_id: string, reason = 'NOC disconnect') =>
  api.post('/api/v1/control/disconnect', { device_id, reason })
export const reconnectDevice  = (device_id: string) =>
  api.post('/api/v1/control/reconnect', { device_id, reason: 'NOC reconnect' })
export const setAiService     = (e: boolean) =>
  api.post('/api/v1/control/ai-service', { enabled: e })
export const setVehicleAiService = (device_id: string, e: boolean) =>
  api.post('/api/v1/control/ai-service/vehicle', { device_id, enabled: e })
export const setGlobalMobileApp = (e: boolean) =>
  api.post('/api/v1/config/mobile-app', { enabled: e })
export const fetchVehicles    = () => api.get('/api/v1/control/vehicles')

// ─── AI ──────────────────────────────────────────────────────────────────
export const fetchAiStatus        = ()                       => api.get('/api/v1/ai/status')
export const fetchRecommendation  = (device_id: string)      =>
  api.post('/api/v1/ai/recommendation', { device_id })
export const sendChat             = (device_id: string, message: string) =>
  api.post('/api/v1/ai/chat', { device_id, message })

// ─── Admin ───────────────────────────────────────────────────────────────
export const fetchAdminStats   = ()            => api.get('/api/v1/admin/stats')
export const fetchAuthLogs     = (limit = 50, device_id?: string)  => 
  api.get(`/api/v1/admin/auth-logs?limit=${limit}${device_id ? `&device_id=${device_id}` : ''}`)
export const fetchAdminDevices = ()            => api.get('/api/v1/admin/devices')
export const fetchPacketStats  = (hours = 24, device_id?: string)  => 
  api.get(`/api/v1/admin/packet-stats?hours=${hours}${device_id ? `&device_id=${device_id}` : ''}`)
export const fetchErrorLog     = (limit = 50)  => api.get(`/api/v1/admin/error-log?limit=${limit}`)

// ─── Devices ─────────────────────────────────────────────────────────────
export const fetchDevices      = ()            => api.get('/api/v1/devices')
export const registerDevice    = (device_id: string) =>
  api.post('/api/v1/devices/register', { device_id })

// ─── Mobile App Access ────────────────────────────────────────────────────
export const fetchMobileAccess = (vehicle_id: string) =>
  api.get(`/api/v1/config/mobile-access?vehicle_id=${vehicle_id}`)
