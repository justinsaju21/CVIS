'use client'

import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield, Lock, Wifi, WifiOff, RefreshCw, BrainCircuit,
  AlertTriangle, CheckCircle, XCircle, Eye, Activity, ChevronRight
} from 'lucide-react'
import { toast } from 'sonner'

import Navbar from '@/components/layout/Navbar'
import CustomCursor from '@/components/layout/CustomCursor'
import { useWebSocket } from '@/hooks/useWebSocket'
import {
  fetchConfig, fetchPackets, fetchVehicles,
  setProtocol, setEncryption, setAuth, setReplay, setChaos,
  disconnectDevice, reconnectDevice, setAiService,
} from '@/lib/api'
import type { ServerConfig, PacketRow, WsEvent, TelemetryRow, FleetVehicle } from '@/lib/types'
import { VehicleSelector } from '@/components/ui/VehicleSelector'

// ─── Packet flow topology ──────────────────────────────────────────────────
function PacketFlow({ protocol, connected }: { protocol: 'http' | 'mqtt'; connected: boolean }) {
  const color = protocol === 'mqtt' ? '#ffb347' : '#00d4ff'
  const W = 520, H = 100

  return (
    <div style={{ width: '100%' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', overflow: 'visible' }}>
        {/* Connection line */}
        <line x1={60} y1={H/2} x2={W-60} y2={H/2}
          stroke={`${color}18`} strokeWidth={2} />
        <line x1={60} y1={H/2} x2={W-60} y2={H/2}
          stroke={`${color}40`} strokeWidth={1} strokeDasharray="6 6" />

        {/* Nodes */}
        {/* ESP32 node */}
        <rect x={10} y={H/2 - 20} width={48} height={40} rx={4}
          fill="rgba(0,0,0,0.6)" stroke={color} strokeWidth={1} strokeOpacity={0.5} />
        <text x={34} y={H/2 - 4} textAnchor="middle" fill={color} fontSize={8}
          fontFamily="Space Mono" opacity={0.8}>ESP32</text>
        <text x={34} y={H/2 + 8} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={7}
          fontFamily="Space Mono">NODE</text>

        {/* Protocol label */}
        <rect x={W/2 - 22} y={H/2 - 9} width={44} height={18} rx={3}
          fill={`${color}15`} stroke={`${color}40`} strokeWidth={0.8} />
        <text x={W/2} y={H/2 + 4} textAnchor="middle" fill={color} fontSize={8}
          fontFamily="Space Mono" letterSpacing={2}>{protocol.toUpperCase()}</text>

        {/* Backend node */}
        <rect x={W-58} y={H/2 - 20} width={48} height={40} rx={4}
          fill="rgba(0,0,0,0.6)" stroke={color} strokeWidth={1} strokeOpacity={0.5} />
        <text x={W-34} y={H/2 - 4} textAnchor="middle" fill={color} fontSize={8}
          fontFamily="Space Mono" opacity={0.8}>FastAPI</text>
        <text x={W-34} y={H/2 + 8} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={7}
          fontFamily="Space Mono">SERVER</text>

        {/* Animated packets */}
        {connected && [0, 0.35, 0.7].map((offset, i) => (
          <motion.circle key={i} r={4} fill={color}
            style={{ filter: `drop-shadow(0 0 5px ${color})` }}
            animate={{ cx: [64, W - 64], cy: [H/2, H/2] }}
            transition={{ duration: 2.2, delay: offset * 2.2, repeat: Infinity, ease: 'linear' }}
          />
        ))}
      </svg>
    </div>
  )
}

// ─── Control toggle ──────────────────────────────────────────────────────────
function Toggle({ on, onChange, disabled = false, accentColor = '#00d4ff' }:
  { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; accentColor?: string }) {
  return (
    <button onClick={() => !disabled && onChange(!on)} disabled={disabled}
      style={{
        width: 40, height: 22, borderRadius: 3,
        background: on ? `${accentColor}18` : 'rgba(255,255,255,0.04)',
        border: `1px solid ${on ? accentColor + '50' : 'rgba(255,255,255,0.08)'}`,
        cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative',
        transition: 'all 150ms',
        flexShrink: 0,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <motion.div
        animate={{ x: on ? 18 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        style={{
          position: 'absolute', top: 3, width: 14, height: 14, borderRadius: 2,
          background: on ? accentColor : 'rgba(255,255,255,0.2)',
          boxShadow: on ? `0 0 8px ${accentColor}80` : 'none',
        }}
      />
    </button>
  )
}

// ─── Packet inspector modal ──────────────────────────────────────────────────
function PacketInspector({ packet, onClose }: { packet: PacketRow; onClose: () => void }) {
  let parsed: unknown = null
  try { parsed = JSON.parse(packet.raw_payload) } catch { parsed = packet.raw_payload }
  const isOk = packet.auth_status === 'ok' || packet.auth_status === 'no_auth'

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)',
        padding: 24,
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#040810',
          border: '1px solid rgba(0,212,255,0.2)',
          borderRadius: 8, padding: 28,
          width: '100%', maxWidth: 580, maxHeight: '82vh',
          overflowY: 'auto',
          boxShadow: '0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(0,212,255,0.05)',
          position: 'relative',
        }}
      >
        {/* Corner decorations */}
        {[
          { top: 6, left: 6, borderWidth: '1px 0 0 1px' },
          { top: 6, right: 6, borderWidth: '1px 1px 0 0' },
          { bottom: 6, left: 6, borderWidth: '0 0 1px 1px' },
          { bottom: 6, right: 6, borderWidth: '0 1px 1px 0' },
        ].map((s, i) => (
          <div key={i} style={{
            position: 'absolute', width: 12, height: 12,
            borderStyle: 'solid', borderColor: 'rgba(0,212,255,0.4)',
            ...s,
          }} />
        ))}

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div className="label" style={{ marginBottom: 6 }}>Packet Inspector</div>
            <div className="font-mono" style={{ fontSize: 20, color: 'var(--cyan)', letterSpacing: '0.05em' }}>
              #{packet.packet_id}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 3,
              background: isOk ? 'rgba(46,213,115,0.1)' : 'rgba(255,71,87,0.1)',
              border: `1px solid ${isOk ? 'rgba(46,213,115,0.25)' : 'rgba(255,71,87,0.25)'}`,
            }}>
              {isOk
                ? <CheckCircle size={11} color="#2ed573" />
                : <XCircle size={11} color="#ff4757" />}
              <span style={{ fontSize: 10, color: isOk ? '#2ed573' : '#ff4757',
                fontFamily: 'Space Mono', letterSpacing: '0.08em' }}>
                {packet.auth_status.toUpperCase()}
              </span>
            </div>
            <button onClick={onClose}
              style={{ display: 'block', marginTop: 8, marginLeft: 'auto', background: 'none',
                border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}>
              ×
            </button>
          </div>
        </div>

        {/* Meta grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
          {[
            { label: 'Device',    value: packet.device_id },
            { label: 'Protocol',  value: packet.protocol.toUpperCase(),
              color: packet.protocol === 'mqtt' ? '#ffb347' : '#00d4ff' },
            { label: 'Size',      value: `${packet.size_bytes} B` },
            { label: 'Timestamp', value: new Date(packet.timestamp).toLocaleTimeString(), span: 2 },
            { label: 'Encrypted', value: packet.encrypted ? 'AES-256-GCM' : 'Plaintext',
              color: packet.encrypted ? '#2ed573' : 'var(--text-muted)' },
          ].map((f) => (
            <div key={f.label}
              style={{
                padding: '10px 12px',
                background: 'rgba(0,212,255,0.03)',
                borderRadius: 4, border: '1px solid rgba(0,212,255,0.08)',
                gridColumn: (f as { span?: number }).span ? `span ${(f as { span?: number }).span}` : undefined,
              }}>
              <div className="label" style={{ marginBottom: 4 }}>{f.label}</div>
              <div className="font-mono" style={{ fontSize: 12,
                color: (f as { color?: string }).color ?? 'var(--text-primary)' }}>
                {f.value}
              </div>
            </div>
          ))}
        </div>

        {/* Payload */}
        <div className="label" style={{ marginBottom: 8 }}>Raw Payload</div>
        <pre style={{
          background: '#020406', borderRadius: 4, padding: '14px 16px',
          border: '1px solid rgba(0,212,255,0.08)', fontSize: 11,
          color: 'rgba(0,212,255,0.7)',
          overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          fontFamily: 'Space Mono, monospace', lineHeight: 1.7,
          maxHeight: 180, overflowY: 'auto',
        }}>
          {typeof parsed === 'object' ? JSON.stringify(parsed, null, 2) : String(parsed)}
        </pre>

        {/* AI response */}
        {packet.ai_response && (
          <>
            <div className="label" style={{ marginBottom: 8, marginTop: 16 }}>AI Analysis</div>
            <div style={{
              background: 'rgba(0,212,255,0.05)', borderRadius: 4, padding: '12px 14px',
              border: '1px solid rgba(0,212,255,0.15)', fontSize: 12,
              color: 'var(--text-secondary)', lineHeight: 1.7, fontFamily: 'Inter',
            }}>
              {packet.ai_response}
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}

// ─── Chip selector ─────────────────────────────────────────────────────────
function ChipSelector({ options, value, onChange, disabled, color = '#00d4ff' }:
  { options: (string | number)[]; value: string | number; onChange: (v: string | number) => void; disabled?: boolean; color?: string }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)} disabled={disabled || value === o}
          style={{
            padding: '3px 9px', borderRadius: 3, fontSize: 10, cursor: 'pointer',
            fontFamily: 'Space Mono', letterSpacing: '0.05em',
            background: value === o ? `${color}18` : 'transparent',
            border: `1px solid ${value === o ? `${color}55` : 'rgba(255,255,255,0.08)'}`,
            color: value === o ? color : 'var(--text-muted)',
            opacity: disabled ? 0.5 : 1,
            transition: 'all 120ms',
          }}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

// ─── Main NOC page ───────────────────────────────────────────────────────────
export default function NocPage() {
  const [config,    setConfigState] = useState<ServerConfig | null>(null)
  const [packets,   setPackets]     = useState<PacketRow[]>([])
  const [inspector, setInspector]   = useState<PacketRow | null>(null)
  const [deviceId,  setDeviceId]    = useState('') // for manual disconnect/reconnect
  const [aiEnabled, setAiEnabled]   = useState(true)
  const [saving,    setSaving]      = useState<string | null>(null)
  const [filter,    setFilter]      = useState<'all' | 'ok' | 'rejected'>('all')
  
  // Fleet state
  const [vehicles,   setVehicles]   = useState<FleetVehicle[]>([])
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null)
  const [selectorOpen, setSelectorOpen] = useState(false)

  useEffect(() => {
    fetchConfig().then((c) => setConfigState(c as ServerConfig)).catch(() => {})
    fetchPackets(80, selectedVehicleId || undefined).then((rows) => setPackets(rows as PacketRow[])).catch(() => {})
    fetchVehicles().then((fleet) => setVehicles(fleet as FleetVehicle[])).catch(() => {})
  }, [selectedVehicleId])

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
      }, ...prev.slice(0, 119)])
    }
    if (ev.event === 'ai_recommendation') {
      setPackets((prev) =>
        prev.map((p) => p.packet_id === ev.packet_id ? { ...p, ai_response: ev.recommendation } : p)
      )
    }
  }, [])

  const { connected } = useWebSocket(handleWs)

  const save = async (key: string, fn: () => Promise<unknown>) => {
    setSaving(key)
    try {
      await fn()
      const c = await fetchConfig() as ServerConfig
      setConfigState(c)
      toast.success(`${key} updated`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(null)
    }
  }

  const handleProtocol   = (p: 'http' | 'mqtt')            => save('protocol',   () => setProtocol(p))
  const handleEncryption = (v: boolean)                     => save('encryption', () => setEncryption(v))
  const handleAuth       = (v: boolean)                     => save('auth',       () => setAuth(v))
  const handleReplay     = (v: boolean)                     => save('replay',     () => setReplay(v))
  const handleChaos      = (loss: number, latency: number, tamper: boolean) =>
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

  const chaos   = config?.chaos
  const loading = (key: string) => saving === key

  const filteredPackets = packets.filter((p) => {
    if (filter === 'ok')       return p.status === 'ok' && p.auth_status !== 'fail' && p.auth_status !== 'tamper_detected'
    if (filter === 'rejected') return p.status !== 'ok' || p.auth_status === 'fail' || p.auth_status === 'tamper_detected'
    return true
  })

  const totalOk       = packets.filter(p => p.status === 'ok').length
  const totalRejected = packets.filter(p => p.status !== 'ok').length

  return (
    <>
      <CustomCursor />
      <Navbar wsConnected={connected} />
      <div className="scan-line" />
      <div className="hud-grid-bg" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />

      <main style={{ paddingTop: 60, minHeight: '100vh', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: 1520, margin: '0 auto', padding: '20px 18px' }}>

          {/* ── Header ── */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div className="live-dot" />
                <span className="label">Network Operations Center</span>
              </div>
              <h1 className="font-display" style={{ fontSize: 20, letterSpacing: '0.2em', color: 'var(--cyan)',
                textShadow: '0 0 30px rgba(0,212,255,0.3)' }}>
                CVIS NOC
              </h1>
            </div>

            {/* Stats strip */}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
              <VehicleSelector
                vehicles={vehicles}
                selectedId={selectedVehicleId}
                onChange={setSelectedVehicleId}
                isOpen={selectorOpen}
                onToggle={() => setSelectorOpen(!selectorOpen)}
              />
              
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { label: 'PROTOCOL', value: config?.active_protocol?.toUpperCase() ?? '---',
                    color: config?.active_protocol === 'mqtt' ? '#ffb347' : '#00d4ff' },
                  { label: 'AUTH',     value: config?.auth_enabled ? 'ON' : 'OFF',
                    color: config?.auth_enabled ? '#2ed573' : '#ff4757' },
                  { label: 'ENCRYPT',  value: config?.encryption_enabled ? 'AES' : 'PLAIN',
                    color: config?.encryption_enabled ? '#2ed573' : 'var(--text-muted)' },
                  { label: 'PACKETS',  value: String(packets.length), color: 'var(--text-primary)' },
                  { label: 'ACCEPTED', value: String(totalOk), color: '#2ed573' },
                  { label: 'REJECTED', value: String(totalRejected),
                    color: totalRejected > 0 ? '#ff4757' : 'var(--text-muted)' },
                ].map((s) => (
                  <div key={s.label} style={{
                    padding: '6px 12px',
                    background: 'rgba(0,212,255,0.03)',
                    border: '1px solid rgba(0,212,255,0.08)',
                    borderRadius: 4,
                    textAlign: 'center',
                    minWidth: 60,
                  }}>
                    <div className="label">{s.label}</div>
                    <div className="font-mono" style={{ fontSize: 13, color: s.color, marginTop: 3 }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          {/* ── Main layout ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 14, alignItems: 'start' }}>

            {/* ── Left panel: Flow + Controls ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Packet flow */}
              <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 }}
                className="hud-panel" style={{ padding: '16px 16px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Activity size={11} color="var(--cyan)" />
                  <span className="label">Live Packet Flow</span>
                  <span style={{ marginLeft: 'auto', fontSize: 9, fontFamily: 'Space Mono',
                    color: connected ? '#2ed573' : '#ff4757' }}>
                    {connected ? '● LIVE' : '◌ OFFLINE'}
                  </span>
                </div>
                <PacketFlow protocol={(config?.active_protocol as 'http' | 'mqtt') ?? 'http'} connected={connected} />
              </motion.div>

              {/* Controls */}
              <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
                className="hud-panel" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14, paddingBottom: 10,
                  borderBottom: '1px solid rgba(0,212,255,0.07)' }}>
                  <Shield size={11} color="var(--cyan)" />
                  <span className="label">NOC Controls</span>
                </div>

                {/* ─ Protocol ─ */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Wifi size={10} color="var(--text-muted)" />
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)', fontWeight: 500 }}>Protocol</span>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 2 }}>HTTP ⇄ MQTT</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {(['http', 'mqtt'] as const).map((p) => (
                      <button key={p} onClick={() => handleProtocol(p)}
                        disabled={loading('protocol') || config?.active_protocol === p}
                        style={{
                          flex: 1, padding: '7px', borderRadius: 3, fontSize: 10, cursor: 'pointer',
                          fontFamily: 'Space Mono', letterSpacing: '0.08em',
                          background: config?.active_protocol === p
                            ? (p === 'mqtt' ? 'rgba(255,179,71,0.12)' : 'rgba(0,212,255,0.12)')
                            : 'transparent',
                          border: `1px solid ${config?.active_protocol === p
                            ? (p === 'mqtt' ? 'rgba(255,179,71,0.4)' : 'rgba(0,212,255,0.4)')
                            : 'rgba(255,255,255,0.07)'}`,
                          color: config?.active_protocol === p
                            ? (p === 'mqtt' ? '#ffb347' : '#00d4ff')
                            : 'var(--text-muted)',
                          opacity: loading('protocol') ? 0.5 : 1,
                          transition: 'all 150ms',
                        }}>
                        {p.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ─ Security toggles ─ */}
                {[
                  {
                    icon: Lock, label: 'AES-256-GCM Encryption', key: 'encryption',
                    on: config?.encryption_enabled ?? false,
                    onChange: handleEncryption, color: '#00d4ff',
                  },
                  {
                    icon: Shield, label: 'Auth Enforcement', key: 'auth',
                    on: config?.auth_enabled ?? true,
                    onChange: handleAuth, color: '#2ed573',
                  },
                  {
                    icon: RefreshCw, label: 'Replay Protection', key: 'replay',
                    on: config?.replay_protection_enabled ?? false,
                    onChange: handleReplay, color: '#2ed573',
                  },
                  {
                    icon: BrainCircuit, label: 'AI Service', key: 'ai',
                    on: aiEnabled,
                    onChange: handleAiToggle, color: '#00d4ff',
                  },
                ].map((ctrl) => (
                  <div key={ctrl.label} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 0', borderBottom: '1px solid rgba(0,212,255,0.04)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <ctrl.icon size={10} color="var(--text-muted)" />
                      <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{ctrl.label}</span>
                    </div>
                    <Toggle on={ctrl.on} onChange={ctrl.onChange}
                      disabled={loading(ctrl.key)} accentColor={ctrl.color} />
                  </div>
                ))}

                {/* ─ Chaos: Packet loss ─ */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
                    <WifiOff size={10} color="var(--text-muted)" />
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Packet Loss</span>
                    <span className="font-mono" style={{ marginLeft: 'auto', fontSize: 10,
                      color: (chaos?.loss_pct ?? 0) > 0 ? '#ffb347' : 'var(--text-muted)' }}>
                      {chaos?.loss_pct ?? 0}%
                    </span>
                  </div>
                  <ChipSelector
                    options={[0, 5, 10, 25]}
                    value={chaos?.loss_pct ?? 0}
                    onChange={(v) => handleChaos(Number(v), chaos?.latency_ms ?? 0, chaos?.tamper ?? false)}
                    disabled={loading('chaos')}
                    color="#ffb347"
                  />
                </div>

                {/* ─ Latency ─ */}
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
                    <RefreshCw size={10} color="var(--text-muted)" />
                    <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Artificial Latency</span>
                    <span className="font-mono" style={{ marginLeft: 'auto', fontSize: 10,
                      color: (chaos?.latency_ms ?? 0) > 0 ? '#ffb347' : 'var(--text-muted)' }}>
                      {chaos?.latency_ms ?? 0}ms
                    </span>
                  </div>
                  <ChipSelector
                    options={[0, 100, 300, 1000]}
                    value={chaos?.latency_ms ?? 0}
                    onChange={(v) => handleChaos(chaos?.loss_pct ?? 0, Number(v), chaos?.tamper ?? false)}
                    disabled={loading('chaos')}
                    color="#ffb347"
                  />
                </div>

                {/* ─ Tamper ─ */}
                <div style={{
                  marginTop: 12, display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', padding: '10px 0',
                  borderTop: '1px solid rgba(0,212,255,0.05)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <AlertTriangle size={10} color="var(--text-muted)" />
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>Tamper Injector</div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'Space Mono', marginTop: 1 }}>
                        Mutates payload → HMAC reject
                      </div>
                    </div>
                  </div>
                  <Toggle
                    on={chaos?.tamper ?? false}
                    onChange={(v) => handleChaos(chaos?.loss_pct ?? 0, chaos?.latency_ms ?? 0, v)}
                    disabled={loading('chaos')}
                    accentColor="#ff4757"
                  />
                </div>

                {/* ─ Vehicle control ─ */}
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(0,212,255,0.05)' }}>
                  <div className="label" style={{ marginBottom: 8 }}>Vehicle Control</div>
                  <input
                    value={deviceId} onChange={(e) => setDeviceId(e.target.value)}
                    placeholder="device_id"
                    style={{
                      width: '100%',
                      background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.1)',
                      borderRadius: 3, padding: '7px 10px', color: 'var(--text-primary)', fontSize: 11,
                      outline: 'none', marginBottom: 8, fontFamily: 'Space Mono',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={handleDisconnect} disabled={loading('disconnect')} style={{
                      flex: 1, padding: '7px', borderRadius: 3, fontSize: 10, cursor: 'pointer',
                      fontFamily: 'Space Mono',
                      background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.25)',
                      color: '#ff4757',
                      opacity: loading('disconnect') ? 0.5 : 1,
                    }}>DISCONNECT</button>
                    <button onClick={handleReconnect} disabled={loading('reconnect')} style={{
                      flex: 1, padding: '7px', borderRadius: 3, fontSize: 10, cursor: 'pointer',
                      fontFamily: 'Space Mono',
                      background: 'rgba(46,213,115,0.08)', border: '1px solid rgba(46,213,115,0.25)',
                      color: '#2ed573',
                      opacity: loading('reconnect') ? 0.5 : 1,
                    }}>RECONNECT</button>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* ── Right panel: Packet table ── */}
            <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
              className="hud-panel" style={{ overflow: 'hidden' }}>

              {/* Table header */}
              <div style={{
                padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8,
                borderBottom: '1px solid rgba(0,212,255,0.08)',
                background: 'rgba(0,212,255,0.02)',
              }}>
                <Activity size={11} color="var(--cyan)" />
                <span className="label">Packet Capture</span>
                <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'Space Mono', marginLeft: 2 }}>
                  {filteredPackets.length} / {packets.length}
                </span>
                <span style={{ marginLeft: 4, fontSize: 9, color: 'var(--text-muted)' }}>· click to inspect</span>

                {/* Filter chips */}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 5 }}>
                  {([
                    { key: 'all',      label: 'ALL' },
                    { key: 'ok',       label: 'ACCEPTED' },
                    { key: 'rejected', label: 'REJECTED' },
                  ] as const).map((f) => (
                    <button key={f.key} onClick={() => setFilter(f.key)}
                      style={{
                        padding: '3px 8px', borderRadius: 3, fontSize: 9, cursor: 'pointer',
                        fontFamily: 'Space Mono', letterSpacing: '0.05em',
                        background: filter === f.key ? 'rgba(0,212,255,0.1)' : 'transparent',
                        border: `1px solid ${filter === f.key ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.06)'}`,
                        color: filter === f.key ? '#00d4ff' : 'var(--text-muted)',
                        transition: 'all 120ms',
                      }}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table */}
              <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
                <table className="noc-table">
                  <thead>
                    <tr>
                      {['#', 'Time', 'Proto', 'Device', 'Size', 'Auth', 'Encrypted', 'Status', ''].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPackets.length === 0 ? (
                      <tr>
                        <td colSpan={9} style={{ padding: '48px 24px', textAlign: 'center',
                          color: 'var(--text-muted)', fontSize: 12, fontFamily: 'Space Mono',
                          letterSpacing: '0.1em' }}>
                          AWAITING PACKETS...
                        </td>
                      </tr>
                    ) : filteredPackets.map((p) => {
                      const statusOk   = p.status === 'ok'
                      const authOk     = p.auth_status === 'ok' || p.auth_status === 'no_auth'
                      const protoColor = p.protocol === 'mqtt' ? '#ffb347' : '#00d4ff'
                      return (
                        <tr key={p.packet_id} onClick={() => setInspector(p)}>
                          <td style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                            {p.packet_id}
                          </td>
                          <td style={{ color: 'var(--text-muted)', fontSize: 10, whiteSpace: 'nowrap' }}>
                            {new Date(p.timestamp).toLocaleTimeString()}
                          </td>
                          <td>
                            <span style={{ fontSize: 9, color: protoColor, letterSpacing: '0.06em' }}>
                              {p.protocol.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ color: 'var(--text-primary)', fontSize: 11 }}>{p.device_id}</td>
                          <td style={{ color: 'var(--text-muted)', fontSize: 10 }}>{p.size_bytes}B</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              {authOk
                                ? <CheckCircle size={10} color="#2ed573" />
                                : <XCircle size={10} color="#ff4757" />}
                              <span style={{ fontSize: 9,
                                color: authOk ? '#2ed573' : '#ff4757', letterSpacing: '0.04em' }}>
                                {p.auth_status}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span style={{ fontSize: 9,
                              color: p.encrypted ? '#2ed573' : 'var(--text-muted)',
                              letterSpacing: '0.04em' }}>
                              {p.encrypted ? 'AES-GCM' : 'PLAIN'}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <div style={{
                                width: 5, height: 5, borderRadius: '50%',
                                background: statusOk ? '#2ed573' : '#ff4757',
                                boxShadow: `0 0 4px ${statusOk ? '#2ed573' : '#ff4757'}`,
                              }} />
                              <span style={{ fontSize: 9,
                                color: statusOk ? '#2ed573' : '#ff4757', letterSpacing: '0.04em' }}>
                                {p.status.toUpperCase()}
                              </span>
                            </div>
                          </td>
                          <td>
                            <ChevronRight size={11} color="rgba(0,212,255,0.3)" />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      <AnimatePresence>
        {inspector && <PacketInspector packet={inspector} onClose={() => setInspector(null)} />}
      </AnimatePresence>
    </>
  )
}
