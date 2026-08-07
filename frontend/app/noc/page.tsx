'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, ShieldOff, Lock, Unlock, Wifi, WifiOff, Zap, ZapOff,
  RefreshCw, StopCircle, BrainCircuit, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle, XCircle, Info, Eye
} from 'lucide-react'
import { toast } from 'sonner'

import WireframeCarLoader from '@/components/layout/WireframeCarLoader'
import Navbar from '@/components/layout/Navbar'
import CustomCursor from '@/components/layout/CustomCursor'
import { useWebSocket } from '@/hooks/useWebSocket'
import {
  fetchConfig, fetchPackets,
  setProtocol, setEncryption, setAuth, setReplay, setChaos,
  disconnectDevice, reconnectDevice, setAiService,
} from '@/lib/api'
import type { ServerConfig, PacketRow, WsEvent, TelemetryRow } from '@/lib/types'

// ─── Packet dot animation ─────────────────────────────────────────────────
// Interpolate points along a bezier curve manually (no CSS offset-path)
function bezier(t: number, p0: number, p1: number, p2: number, p3: number) {
  const u = 1 - t
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3
}

function PacketFlow({ protocol }: { protocol: 'http' | 'mqtt' }) {
  const color  = protocol === 'mqtt' ? 'var(--amber)' : 'var(--cyan)'
  const W = 520, H = 80

  // Control points for the bezier path
  const p = { x0: 20, y0: H/2, x1: 120, y1: H/2, x2: 400, y2: H/2, x3: W-20, y3: H/2 }
  // Gentle wave: mid-points go up/down
  const pathD = `M ${p.x0} ${p.y0} C ${p.x1} ${p.y0} 200 20 260 ${H/2} C 320 ${H-20} ${p.x2} ${H/2} ${p.x3} ${p.y3}`

  const dots = [0, 0.33, 0.66]

  return (
    <div style={{ width: '100%', overflow: 'hidden' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%' }}>
        {/* Path glow */}
        <path d={pathD} fill="none" stroke={`rgba(${protocol === 'mqtt' ? '255,179,71' : '0,212,255'},0.12)`} strokeWidth={2} />
        <path d={pathD} fill="none" stroke={`rgba(${protocol === 'mqtt' ? '255,179,71' : '0,212,255'},0.3)`} strokeWidth={1} strokeDasharray="6 4" />

        {/* Labels */}
        <text x={20}     y={H/2 - 10} fill="var(--text-muted)" fontSize={10} fontFamily="Space Mono">ESP32</text>
        <text x={W - 20} y={H/2 - 10} fill="var(--text-muted)" fontSize={10} fontFamily="Space Mono" textAnchor="end">BACKEND</text>

        {/* Protocol label */}
        <text x={W/2} y={14} fill={color} fontSize={9} fontFamily="Space Mono" textAnchor="middle" letterSpacing={2}>
          {protocol.toUpperCase()}
        </text>

        {/* Animated dots via keyframes on cx using motion.circle */}
        {dots.map((offset, i) => (
          <motion.circle
            key={i}
            r={4}
            fill={color}
            style={{ filter: `drop-shadow(0 0 4px ${color})` }}
            animate={{
              cx: [20, 260, W - 20],
              cy: [H/2, H/2, H/2],
            }}
            transition={{
              duration: 2.5,
              delay: offset * 2.5,
              repeat: Infinity,
              ease: 'linear',
              times: [0, 0.5, 1],
            }}
          />
        ))}

        {/* Node circles */}
        <circle cx={20}     cy={H/2} r={6} fill="rgba(0,0,0,0.8)" stroke={color} strokeWidth={1.5} />
        <circle cx={W - 20} cy={H/2} r={6} fill="rgba(0,0,0,0.8)" stroke={color} strokeWidth={1.5} />
      </svg>
    </div>
  )
}

// ─── Toggle switch ────────────────────────────────────────────────────────
function Toggle({ on, onChange, disabled = false }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onChange(!on)}
      disabled={disabled}
      style={{
        width: 44, height: 24, borderRadius: 12,
        background: on ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.08)',
        border: `1px solid ${on ? 'var(--cyan)' : 'var(--border)'}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative',
        transition: 'background 200ms, border-color 200ms',
        flexShrink: 0,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <motion.div
        animate={{ x: on ? 20 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        style={{
          position: 'absolute', top: 3, width: 16, height: 16, borderRadius: '50%',
          background: on ? 'var(--cyan)' : 'var(--text-muted)',
          boxShadow: on ? '0 0 6px rgba(0,212,255,0.6)' : 'none',
        }}
      />
    </button>
  )
}

// ─── Control row ──────────────────────────────────────────────────────────
function ControlRow({ icon: Icon, label, sublabel, children }:
  { icon: React.FC<{ size: number; color?: string }>; label: string; sublabel?: string; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 0', borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Icon size={14} color="var(--text-muted)" />
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{label}</div>
          {sublabel && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{sublabel}</div>}
        </div>
      </div>
      {children}
    </div>
  )
}

// ─── Packet inspector ──────────────────────────────────────────────────────
function PacketInspector({ packet, onClose }: { packet: PacketRow; onClose: () => void }) {
  let parsed: unknown = null
  try { parsed = JSON.parse(packet.raw_payload) } catch { parsed = packet.raw_payload }

  const authColor = packet.auth_status === 'ok' || packet.auth_status === 'no_auth'
    ? 'var(--green)' : 'var(--red)'

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.2 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-active)',
          borderRadius: 16, padding: 28, width: '100%', maxWidth: 560, maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 40px rgba(0,212,255,0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div className="label">Packet Inspector</div>
            <div className="font-mono" style={{ fontSize: 16, color: 'var(--cyan)', marginTop: 4 }}>
              #{packet.packet_id}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>

        {/* Meta grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Device', value: packet.device_id },
            { label: 'Protocol', value: packet.protocol.toUpperCase() },
            { label: 'Timestamp', value: new Date(packet.timestamp).toLocaleString() },
            { label: 'Size', value: `${packet.size_bytes} B` },
            { label: 'Auth', value: packet.auth_status, color: authColor },
            { label: 'Encrypted', value: packet.encrypted ? 'AES-256-GCM' : 'Plaintext' },
            { label: 'Status', value: packet.status },
          ].map((f) => (
            <div key={f.label} style={{ padding: '10px 14px', background: 'var(--glass)', borderRadius: 8, border: '1px solid var(--border)' }}>
              <div className="label" style={{ marginBottom: 4 }}>{f.label}</div>
              <div className="font-mono" style={{ fontSize: 12, color: (f as { color?: string }).color ?? 'var(--text-primary)' }}>{f.value}</div>
            </div>
          ))}
        </div>

        {/* Payload */}
        <div className="label" style={{ marginBottom: 8 }}>Payload</div>
        <pre style={{
          background: 'var(--bg-secondary)', borderRadius: 8, padding: '14px',
          border: '1px solid var(--border)', fontSize: 11, color: 'var(--text-secondary)',
          overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          fontFamily: 'Space Mono, monospace', lineHeight: 1.6,
          maxHeight: 200, overflowY: 'auto',
        }}>
          {typeof parsed === 'object' ? JSON.stringify(parsed, null, 2) : String(parsed)}
        </pre>

        {/* AI response */}
        {packet.ai_response && (
          <>
            <div className="label" style={{ marginBottom: 8, marginTop: 16 }}>AI Response</div>
            <div style={{
              background: 'var(--cyan-dim)', borderRadius: 8, padding: 14,
              border: '1px solid var(--border-active)', fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.6,
            }}>
              {packet.ai_response}
            </div>
          </>
        )}
      </div>
    </motion.div>
  )
}

// ─── Packet table row ──────────────────────────────────────────────────────
function PacketTableRow({ packet, onClick }: { packet: PacketRow; onClick: () => void }) {
  const statusColor = packet.status === 'ok' ? 'var(--green)' : 'var(--red)'
  const authColor   = packet.auth_status === 'ok' ? 'var(--green)' : packet.auth_status === 'no_auth' ? 'var(--amber)' : 'var(--red)'
  const protoColor  = packet.protocol === 'mqtt' ? 'var(--amber)' : 'var(--cyan)'

  return (
    <motion.tr
      onClick={onClick}
      whileHover={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
      style={{ cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
    >
      <td className="font-mono" style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-muted)' }}>#{packet.packet_id}</td>
      <td style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-secondary)' }}>
        {new Date(packet.timestamp).toLocaleTimeString()}
      </td>
      <td style={{ padding: '8px 10px' }}>
        <span style={{ fontSize: 10, color: protoColor, fontFamily: 'Space Mono', letterSpacing: '0.05em' }}>
          {packet.protocol.toUpperCase()}
        </span>
      </td>
      <td style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-primary)' }}>{packet.device_id}</td>
      <td className="font-mono" style={{ padding: '8px 10px', fontSize: 11, color: 'var(--text-muted)' }}>{packet.size_bytes}B</td>
      <td style={{ padding: '8px 10px' }}>
        <span style={{ fontSize: 10, color: authColor }}>{packet.auth_status}</span>
      </td>
      <td style={{ padding: '8px 10px' }}>
        <span style={{ fontSize: 10, color: packet.encrypted ? 'var(--green)' : 'var(--text-muted)' }}>
          {packet.encrypted ? 'AES' : 'plain'}
        </span>
      </td>
      <td style={{ padding: '8px 10px' }}>
        <span style={{ fontSize: 10, color: statusColor }}>●</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>{packet.status}</span>
      </td>
      <td style={{ padding: '8px 10px' }}>
        <Eye size={12} color="var(--text-muted)" />
      </td>
    </motion.tr>
  )
}

// ─── Main NOC page ────────────────────────────────────────────────────────
export default function NocPage() {
  const [loaded,    setLoaded]    = useState(false)
  const [config,    setConfig]    = useState<ServerConfig | null>(null)
  const [packets,   setPackets]   = useState<PacketRow[]>([])
  const [inspector, setInspector] = useState<PacketRow | null>(null)
  const [stats,     setStats]     = useState({ total: 0, lost: 0, tampered: 0, protocol: 'http' })
  const [deviceId,  setDeviceId]  = useState('')
  const [aiEnabled, setAiEnabled] = useState(true)
  const [saving,    setSaving]    = useState<string | null>(null)

  // Load initial config + packets
  useEffect(() => {
    fetchConfig().then((c) => setConfig(c as ServerConfig)).catch(() => {})
    fetchPackets(50).then((rows) => setPackets(rows as PacketRow[])).catch(() => {})
  }, [])

  // WebSocket: push new packets to the top
  const handleWs = useCallback((ev: WsEvent) => {
    if (ev.event === 'telemetry') {
      const t = ev as unknown as TelemetryRow
      setPackets((prev) => [{
        packet_id:   t.packet_id,
        timestamp:   t.received_at,
        direction:   'inbound',
        protocol:    t.protocol,
        device_id:   t.device_id,
        size_bytes:  0,
        status:      'ok',
        auth_status: 'ok',
        encrypted:   false,
        raw_payload: JSON.stringify(t),
      }, ...prev.slice(0, 99)])
      setStats((s) => ({ ...s, total: s.total + 1, protocol: t.protocol }))
    }
    if (ev.event === 'ai_recommendation') {
      setPackets((prev) =>
        prev.map((p) => p.packet_id === ev.packet_id ? { ...p, ai_response: ev.recommendation } : p)
      )
    }
  }, [])

  const { connected } = useWebSocket(handleWs)

  // ─── Control helpers ─────────────────────────────────────────────────
  const save = async (key: string, fn: () => Promise<unknown>) => {
    setSaving(key)
    try {
      await fn()
      // Re-fetch config
      const c = await fetchConfig() as ServerConfig
      setConfig(c)
      toast.success(`${key} updated`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(null)
    }
  }

  const handleProtocol = (p: 'http' | 'mqtt') => save('protocol', () => setProtocol(p))
  const handleEncryption = (v: boolean) => save('encryption', () => setEncryption(v))
  const handleAuth = (v: boolean) => save('auth', () => setAuth(v))
  const handleReplay = (v: boolean) => save('replay', () => setReplay(v))
  const handleChaos = (loss: number, latency: number, tamper: boolean) =>
    save('chaos', () => setChaos({ loss_pct: loss, latency_ms: latency, tamper }))
  const handleDisconnect = () => {
    if (!deviceId.trim()) { toast.error('Enter device ID'); return }
    save('disconnect', () => disconnectDevice(deviceId.trim()))
  }
  const handleReconnect = () => {
    if (!deviceId.trim()) { toast.error('Enter device ID'); return }
    save('reconnect', () => reconnectDevice(deviceId.trim()))
  }
  const handleAiToggle = (v: boolean) => {
    setAiEnabled(v)
    save('ai', () => setAiService(v))
  }

  const chaos = config?.chaos
  const loading = (key: string) => saving === key

  if (!loaded) {
    return <WireframeCarLoader onComplete={() => setLoaded(true)} message="Initializing NOC..." />
  }

  return (
    <>
      <CustomCursor />
      <div className="scan-line" />
      <Navbar wsConnected={connected} />

      <main style={{ paddingTop: 60, minHeight: '100vh' }}>
        <div style={{ maxWidth: 1500, margin: '0 auto', padding: '24px 20px' }}>

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div className="live-dot" />
                <span className="label">Network Operations Center</span>
              </div>
              <h1 className="font-display" style={{ fontSize: 22, letterSpacing: '0.15em', color: 'var(--cyan)' }}>
                CVIS NOC
              </h1>
            </div>
            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
              {[
                { label: 'Protocol', value: config?.active_protocol?.toUpperCase() ?? '---', color: config?.active_protocol === 'mqtt' ? 'var(--amber)' : 'var(--cyan)' },
                { label: 'Auth',     value: config?.auth_enabled ? 'ON' : 'OFF',            color: config?.auth_enabled ? 'var(--green)' : 'var(--red)' },
                { label: 'Encrypt', value: config?.encryption_enabled ? 'AES' : 'Plain',   color: config?.encryption_enabled ? 'var(--green)' : 'var(--text-muted)' },
                { label: 'Packets', value: packets.length,                                  color: 'var(--text-primary)' },
              ].map((s) => (
                <div key={s.label} style={{ textAlign: 'center' }}>
                  <div className="label">{s.label}</div>
                  <div className="font-mono" style={{ fontSize: 14, color: s.color, marginTop: 2 }}>{s.value}</div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Main grid: flow + controls | table */}
          <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16, alignItems: 'start' }}>

            {/* Left: Packet flow + Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Packet flow SVG */}
              <motion.div
                className="glass-card"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ padding: '20px', overflow: 'hidden' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <Wifi size={13} color="var(--cyan)" />
                  <span className="label">Live Packet Flow</span>
                  <span style={{
                    marginLeft: 'auto', fontSize: 10,
                    color: connected ? 'var(--green)' : 'var(--red)',
                  }}>
                    {connected ? '● LIVE' : '◌ OFFLINE'}
                  </span>
                </div>
                <PacketFlow protocol={(config?.active_protocol as 'http' | 'mqtt') ?? 'http'} />
              </motion.div>

              {/* Control panel */}
              <motion.div
                className="glass-card"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                style={{ padding: '20px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Shield size={13} color="var(--cyan)" />
                  <span className="label">NOC Controls</span>
                </div>

                {/* Protocol */}
                <ControlRow icon={Wifi} label="Protocol" sublabel="HTTP REST ⇄ MQTT pub-sub">
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(['http', 'mqtt'] as const).map((p) => (
                      <button key={p} onClick={() => handleProtocol(p)}
                        disabled={loading('protocol') || config?.active_protocol === p}
                        style={{
                          padding: '4px 10px', borderRadius: 6, fontSize: 10, cursor: 'pointer',
                          background: config?.active_protocol === p ? 'var(--cyan-dim)' : 'transparent',
                          border: `1px solid ${config?.active_protocol === p ? 'var(--cyan)' : 'var(--border)'}`,
                          color: config?.active_protocol === p ? 'var(--cyan)' : 'var(--text-muted)',
                          fontFamily: 'Space Mono',
                          opacity: loading('protocol') ? 0.5 : 1,
                        }}
                      >{p.toUpperCase()}</button>
                    ))}
                  </div>
                </ControlRow>

                {/* Encryption */}
                <ControlRow icon={Lock} label="AES-256-GCM Encryption" sublabel="AEAD payload encryption">
                  <Toggle on={config?.encryption_enabled ?? false} onChange={handleEncryption} disabled={loading('encryption')} />
                </ControlRow>

                {/* Auth */}
                <ControlRow icon={Shield} label="Auth Enforcement" sublabel="API key + HMAC verification">
                  <Toggle on={config?.auth_enabled ?? true} onChange={handleAuth} disabled={loading('auth')} />
                </ControlRow>

                {/* Replay */}
                <ControlRow icon={RefreshCw} label="Replay Protection" sublabel="Timestamp-window deduplication">
                  <Toggle on={config?.replay_protection_enabled ?? false} onChange={handleReplay} disabled={loading('replay')} />
                </ControlRow>

                {/* Packet loss */}
                <ControlRow icon={WifiOff} label="Packet Loss" sublabel={`${chaos?.loss_pct ?? 0}% drop rate`}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {[0, 5, 10, 25].map((v) => (
                      <button key={v} onClick={() => handleChaos(v, chaos?.latency_ms ?? 0, chaos?.tamper ?? false)}
                        disabled={loading('chaos') || chaos?.loss_pct === v}
                        style={{
                          padding: '3px 7px', borderRadius: 4, fontSize: 9, cursor: 'pointer',
                          background: chaos?.loss_pct === v ? 'var(--amber-dim)' : 'transparent',
                          border: `1px solid ${chaos?.loss_pct === v ? 'var(--amber)' : 'var(--border)'}`,
                          color: chaos?.loss_pct === v ? 'var(--amber)' : 'var(--text-muted)',
                          fontFamily: 'Space Mono',
                        }}
                      >{v}%</button>
                    ))}
                  </div>
                </ControlRow>

                {/* Latency */}
                <ControlRow icon={RefreshCw} label="Artificial Latency" sublabel={`${chaos?.latency_ms ?? 0}ms delay`}>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {[0, 100, 300, 1000].map((v) => (
                      <button key={v} onClick={() => handleChaos(chaos?.loss_pct ?? 0, v, chaos?.tamper ?? false)}
                        disabled={loading('chaos') || chaos?.latency_ms === v}
                        style={{
                          padding: '3px 7px', borderRadius: 4, fontSize: 9, cursor: 'pointer',
                          background: chaos?.latency_ms === v ? 'var(--amber-dim)' : 'transparent',
                          border: `1px solid ${chaos?.latency_ms === v ? 'var(--amber)' : 'var(--border)'}`,
                          color: chaos?.latency_ms === v ? 'var(--amber)' : 'var(--text-muted)',
                          fontFamily: 'Space Mono',
                        }}
                      >{v}ms</button>
                    ))}
                  </div>
                </ControlRow>

                {/* Tamper injector */}
                <ControlRow icon={AlertTriangle} label="Tamper Injector" sublabel="Mutates payload → HMAC reject">
                  <Toggle
                    on={chaos?.tamper ?? false}
                    onChange={(v) => handleChaos(chaos?.loss_pct ?? 0, chaos?.latency_ms ?? 0, v)}
                    disabled={loading('chaos')}
                  />
                </ControlRow>

                {/* AI service */}
                <ControlRow icon={BrainCircuit} label="AI Service" sublabel="Telemetry recommendations">
                  <Toggle on={aiEnabled} onChange={handleAiToggle} disabled={loading('ai')} />
                </ControlRow>

                {/* Disconnect / reconnect */}
                <div style={{ paddingTop: 14 }}>
                  <div className="label" style={{ marginBottom: 8 }}>Vehicle Control</div>
                  <input
                    value={deviceId} onChange={(e) => setDeviceId(e.target.value)}
                    placeholder="device_id"
                    style={{
                      width: '100%', background: 'var(--glass)', border: '1px solid var(--border)',
                      borderRadius: 6, padding: '6px 10px', color: 'var(--text-primary)', fontSize: 11,
                      outline: 'none', marginBottom: 8, fontFamily: 'Space Mono',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={handleDisconnect} disabled={loading('disconnect')} style={{
                      flex: 1, padding: '7px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                      background: 'var(--red-dim)', border: '1px solid var(--red)', color: 'var(--red)',
                      opacity: loading('disconnect') ? 0.5 : 1,
                    }}>Disconnect</button>
                    <button onClick={handleReconnect} disabled={loading('reconnect')} style={{
                      flex: 1, padding: '7px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                      background: 'var(--green-dim)', border: '1px solid var(--green)', color: 'var(--green)',
                      opacity: loading('reconnect') ? 0.5 : 1,
                    }}>Reconnect</button>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Right: Packet table */}
            <motion.div
              className="glass-card"
              initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Wifi size={13} color="var(--cyan)" />
                <span className="label">Packet Log</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>{packets.length} packets</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Click to inspect</span>
              </div>
              <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['#', 'Time', 'Proto', 'Device', 'Size', 'Auth', 'Enc', 'Status', ''].map((h) => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {packets.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                          Waiting for packets...
                        </td>
                      </tr>
                    ) : (
                      packets.map((p) => (
                        <PacketTableRow key={p.packet_id} packet={p} onClick={() => setInspector(p)} />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      {/* Packet inspector modal */}
      <AnimatePresence>
        {inspector && <PacketInspector packet={inspector} onClose={() => setInspector(null)} />}
      </AnimatePresence>
    </>
  )
}
