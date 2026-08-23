// Shared TypeScript types for the CVIS frontend

export interface TelemetryPayload {
  device_id:       string
  schema_version:  string
  timestamp_ms:    number
  mode:            VehicleMode
  speed_kmh:       number
  battery_pct:     number
  battery_temp_c:  number
  motor_temp_c:    number
  range_km:        number
  fault_code:      number
  charging_rate_w: number
}

export type VehicleMode =
  | 'Healthy'
  | 'Eco'
  | 'Sport'
  | 'Heavy Traffic'
  | 'Low Battery'
  | 'Battery Overheating'
  | 'Charging'
  | 'Motor Fault'

export interface TelemetryRow extends TelemetryPayload {
  packet_id:   number
  received_at: string
  protocol:    'http' | 'mqtt'
  status:      string
}

export interface PacketRow {
  packet_id:          number
  timestamp:          string
  direction:          string
  protocol:           'http' | 'mqtt'
  device_id:          string
  size_bytes:         number
  status:             string
  auth_status:        string
  encrypted:          boolean | number
  encryption_method?: string
  raw_payload:        string
  ai_response?:       string
}

export interface DeviceInfo {
  device_id:    string
  registered_at: string
  active:       boolean
  last_seen?:   string | null
  last_mode?:   string | null
  last_battery?: number | null
}

export interface AuthLog {
  log_id:     number
  timestamp:  string
  device_id:  string
  event_type: AuthEventType
  source_ip:  string
  details:    string
}

export type AuthEventType =
  | 'auth_ok'
  | 'auth_fail'
  | 'tamper_detected'
  | 'registered'
  | 'no_auth'
  | 'disconnected'
  | 'reconnected'

export interface ChaosConfig {
  loss_pct:   number
  latency_ms: number
  tamper:     boolean
}

export interface ServerConfig {
  active_protocol:           'http' | 'mqtt'
  encryption_enabled:        boolean
  auth_enabled:              boolean
  replay_protection_enabled: boolean
  ai_service_enabled?:       boolean
  chaos:                     ChaosConfig
}

export interface AdminStats {
  packets: {
    total:              number
    today:              number
    last_hour:          number
    avg_size_bytes:     number
    protocol_breakdown: Record<string, number>
  }
  system: {
    cpu_pct:    number
    mem_pct:    number
    disk_pct:   number
    uptime_s:   number
    db_size_kb: number
  }
  auth: {
    active_devices:            number
    auth_failures:             number
    tamper_events:             number
    auth_enabled:              boolean
    replay_protection_enabled: boolean
  }
  ai: {
    running:        boolean
    model_available:boolean
    service_enabled:boolean
  }
  chaos: {
    total_requests:    number
    dropped_packets:   number
    tampered_packets:  number
    latency_added:     number
  }
}

export interface AiStatus {
  running:         boolean
  model_available: boolean
  model:           string
  available_models: string[]
}

export interface FleetVehicle {
  device_id:    string
  name:         string
  description:  string
  color:        string
  personality:  string
  active:       boolean
  last_mode?:   string | null
  last_battery?:number | null
  last_temp?:   number | null
  last_seen?:   string | null
  ai_enabled:   boolean
}

// WebSocket event types
export type WsEvent =
  | { event: 'telemetry';          packet_id: number; received_at: string } & TelemetryPayload
  | { event: 'telemetry_backfill'; items: TelemetryRow[] }
  | { event: 'ai_recommendation';  packet_id: number; device_id: string; mode: string; recommendation: string }
  | { event: 'device_disconnected';device_id: string; reason: string }
  | { event: 'device_reconnected'; device_id: string }
  | { event: 'ai_service_status';  enabled: boolean }
  | { event: 'vehicle_ai_status';  device_id: string; enabled: boolean }
