'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'
import {
  Cpu, HardDrive, Activity, Shield, AlertTriangle,
  CheckCircle, XCircle, BrainCircuit, Server, Wifi, RefreshCw,
  Database, Clock
} from 'lucide-react'

import Navbar from '@/components/layout/Navbar'
import CustomCursor from '@/components/layout/CustomCursor'
import { useWebSocket } from '@/hooks/useWebSocket'
import { fetchAdminStats, fetchAuthLogs, fetchAdminDevices, fetchPacketStats, fetchVehicles, setVehicleAiService } from '@/lib/api'
import type { AdminStats, AuthLog, DeviceInfo, WsEvent, FleetVehicle } from '@/lib/types'
import { VehicleSelector } from '@/components/ui/VehicleSelector'

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, unit, color = 'var(--cyan)', sublabel, accent = false }:
  { icon: React.FC<{ size: number; color?: string }>; label: string; value: string | number;
    unit?: string; color?: string; sublabel?: string; accent?: boolean }) {
  return (
    <div className="hud-panel" style={{ padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
        <Icon size={11} color={color} />
        <span className="label">{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span className="font-mono" style={{
          fontSize: 28, fontWeight: 700, color,
          textShadow: accent ? `0 0 20px ${color}44` : 'none',
          letterSpacing: '-0.02em',
        }}>
          {value}
        </span>
        {unit && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{unit}</span>}
      </div>
      {sublabel && <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 6,
        fontFamily: 'Space Mono', letterSpacing: '0.06em' }}>{sublabel}</div>}
    </div>
  )
}

// ─── Resource bar ─────────────────────────────────────────────────────────────
function ResourceBar({ label, pct, icon: Icon }: {
  label: string; pct: number; icon: React.FC<{ size: number; color?: string }>
}) {
  const color = pct > 80 ? '#ff4757' : pct > 60 ? '#ffb347' : '#00d4ff'
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon size={10} color="var(--text-muted)" />
          <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{label}</span>
        </div>
        <span className="font-mono" style={{ fontSize: 11, color }}>{pct.toFixed(1)}%</span>
      </div>
      <div style={{ height: 3, background: 'rgba(0,212,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(pct, 100)}%` }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          style={{
            height: '100%', background: color, borderRadius: 2,
            boxShadow: `0 0 8px ${color}66`,
          }}
        />
      </div>
    </div>
  )
}

// ─── Auth event colors ─────────────────────────────────────────────────────────
const EVENT_COLORS: Record<string, string> = {
  auth_ok:         '#2ed573',
  auth_fail:       '#ff4757',
  tamper_detected: '#ff4757',
  registered:      '#00d4ff',
  no_auth:         '#ffb347',
  disconnected:    '#ffb347',
  reconnected:     '#2ed573',
}
const EVENT_ICONS: Record<string, React.FC<{ size: number; color: string }>> = {
  auth_ok:         CheckCircle,
  auth_fail:       XCircle,
  tamper_detected: AlertTriangle,
  registered:      CheckCircle,
  no_auth:         Shield,
  disconnected:    XCircle,
  reconnected:     CheckCircle,
}

function fmtUptime(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}h ${m}m`
}

// ─── Admin page ───────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [stats,      setStats]      = useState<AdminStats | null>(null)
  const [authLogs,   setAuthLogs]   = useState<AuthLog[]>([])
  const [devices,    setDevices]    = useState<DeviceInfo[]>([])
  const [pkStats,    setPkStats]    = useState<{ hour: string; count: number }[]>([])
  const [vehicles,   setVehicles]   = useState<FleetVehicle[]>([])
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null)
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [tick,       setTick]       = useState(0)

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      const [s, logs, devs, pks, fleet] = await Promise.all([
        fetchAdminStats(),
        fetchAuthLogs(30, selectedVehicleId || undefined),
        fetchAdminDevices(),
        fetchPacketStats(12, selectedVehicleId || undefined),
        fetchVehicles(),
      ])
      setStats(s as AdminStats)
      setAuthLogs(logs as AuthLog[])
      setDevices(devs as DeviceInfo[])
      setVehicles(fleet as FleetVehicle[])
      const raw = (pks as { hour_bucket: string; count: number }[])
      if (Array.isArray(raw)) {
        setPkStats(raw.map((r) => ({
          hour:  new Date(r.hour_bucket).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          count: r.count,
        })).reverse())
      } else {
        const _pks = pks as any
        setPkStats(_pks.packets_per_hour?.map((r: any) => ({
          hour:  new Date(r.hour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          count: r.count,
        })) || [])
      }
    } catch (err) {
      console.error(err)
    }
    setRefreshing(false)
  }, [selectedVehicleId])

  useEffect(() => { load() }, [load, tick])
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000)
    return () => clearInterval(t)
  }, [])

  const handleWs = useCallback((ev: WsEvent) => {
    if (ev.event === 'telemetry') {
      setStats((s) => s ? { ...s, packets: { ...s.packets, total: s.packets.total + 1 } } : s)
    }
  }, [])

  const { connected } = useWebSocket(handleWs)

  const sys   = stats?.system
  const pkt   = stats?.packets
  const auth  = stats?.auth
  const ai    = stats?.ai
  const chaos = stats?.chaos

  return (
    <>
      <CustomCursor />
      <Navbar wsConnected={connected} />
      <div className="scan-line" />
      <div className="hud-grid-bg" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />

      <main style={{ paddingTop: 60, minHeight: '100vh', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: 1440, margin: '0 auto', padding: '20px 18px' }}>

          {/* ── Header ── */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            style={{ marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="label">Administrator Console</span>
              </div>
              <h1 className="font-display" style={{ fontSize: 20, letterSpacing: '0.18em', color: 'var(--text-primary)',
                textShadow: '0 0 20px rgba(0,212,255,0.15)' }}>
                CVIS ADMIN
              </h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Vehicle Selector */}
              <VehicleSelector
                vehicles={vehicles}
                selectedId={selectedVehicleId}
                onChange={setSelectedVehicleId}
                isOpen={selectorOpen}
                onToggle={() => setSelectorOpen(!selectorOpen)}
              />
              
              {/* Server heartbeat */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', border: '1px solid rgba(0,212,255,0.1)', borderRadius: 4,
                background: 'rgba(0,212,255,0.03)' }}>
                <div className="live-dot" />
                <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'Space Mono', letterSpacing: '0.08em' }}>
                  SERVER ACTIVE
                </span>
              </div>
              <button onClick={load} disabled={refreshing}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.12)',
                  borderRadius: 4, padding: '7px 14px', color: 'var(--text-secondary)',
                  fontSize: 10, cursor: 'pointer', fontFamily: 'Space Mono', letterSpacing: '0.06em',
                }}>
                <RefreshCw size={11}
                  style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                REFRESH
              </button>
            </div>
          </motion.div>

          {/* ── Row 1: System resources ── */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="hud-panel" style={{ padding: '18px 20px', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
              <Cpu size={11} color="var(--cyan)" />
              <span className="label">System Resources</span>
              <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--text-muted)',
                fontFamily: 'Space Mono' }}>
                Uptime: {fmtUptime(sys?.uptime_s ?? 0)}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
              <ResourceBar label="CPU Usage"    pct={sys?.cpu_pct  ?? 0} icon={Cpu} />
              <ResourceBar label="Memory"       pct={sys?.mem_pct  ?? 0} icon={HardDrive} />
              <ResourceBar label="Disk Usage"   pct={sys?.disk_pct ?? 0} icon={HardDrive} />
            </div>
            {/* DB Size + WebSocket clients inline */}
            <div style={{ display: 'flex', gap: 12, marginTop: 8, paddingTop: 12,
              borderTop: '1px solid rgba(0,212,255,0.05)' }}>
              {[
                { icon: Database, label: 'DB Size',       value: sys?.db_size_kb ? `${(sys.db_size_kb / 1024).toFixed(1)} MB` : '0 MB' },
                { icon: Wifi,     label: 'Today Packets',  value: `${pkt?.today ?? 0}` },
                { icon: Clock,    label: 'Server Uptime', value: fmtUptime(sys?.uptime_s ?? 0) },
              ].map((item) => (
                <div key={item.label} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 14px',
                  background: 'rgba(0,212,255,0.03)', borderRadius: 4,
                  border: '1px solid rgba(0,212,255,0.06)',
                }}>
                  <item.icon size={10} color="var(--text-muted)" />
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
                    {item.label}
                  </span>
                  <span className="font-mono" style={{ fontSize: 12, color: 'var(--text-primary)', marginLeft: 4 }}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ── Row 2: Key stats ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10, marginBottom: 14 }}>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <StatCard icon={Activity} label="Total Packets"   value={pkt?.total ?? 0}     color="#00d4ff" accent />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
              <StatCard icon={Activity} label="Last Hour"       value={pkt?.last_hour ?? 0} color="#00d4ff" />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
              <StatCard icon={Server}   label="Active Devices"  value={auth?.active_devices ?? 0} color="#2ed573" accent />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
              <StatCard icon={Shield}   label="Auth Failures"   value={auth?.auth_failures ?? 0}
                color={auth?.auth_failures ? '#ff4757' : 'var(--text-muted)'} />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}>
              <StatCard icon={AlertTriangle} label="Tamper Events" value={auth?.tamper_events ?? 0}
                color={auth?.tamper_events ? '#ff4757' : 'var(--text-muted)'} />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <StatCard icon={BrainCircuit} label="AI Status"
                value={ai?.running ? 'ONLINE' : 'OFFLINE'}
                color={ai?.running ? '#2ed573' : '#ff4757'}
                sublabel={ai?.running ? 'MODEL AVAILABLE' : 'STOPPED'} />
            </motion.div>
          </div>

          {/* ── Row 3: Packet chart + Devices + AI detail ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px 240px', gap: 12, marginBottom: 14 }}>

            {/* Packet volume chart */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="hud-panel" style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                <Activity size={11} color="var(--cyan)" />
                <span className="label">Packet Volume — Last 12h</span>
                {/* Protocol breakdown */}
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
                  {Object.entries(pkt?.protocol_breakdown ?? {}).map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 6, height: 6, borderRadius: 1,
                        background: k === 'mqtt' ? '#ffb347' : '#00d4ff' }} />
                      <span style={{ fontSize: 9, fontFamily: 'Space Mono',
                        color: k === 'mqtt' ? '#ffb347' : '#00d4ff' }}>{k.toUpperCase()}</span>
                      <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'Space Mono' }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={pkStats} barSize={12}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,212,255,0.04)" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fill: 'var(--text-muted)', fontSize: 9, fontFamily: 'Space Mono' }}
                    axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 9, fontFamily: 'Space Mono' }}
                    axisLine={false} tickLine={false} width={22} />
                  <Tooltip
                    contentStyle={{
                      background: '#040810', border: '1px solid rgba(0,212,255,0.15)',
                      borderRadius: 4, fontSize: 11, fontFamily: 'Space Mono',
                    }}
                    labelStyle={{ color: 'var(--text-muted)' }}
                    itemStyle={{ color: '#00d4ff' }}
                  />
                  <Bar dataKey="count" fill="#00d4ff" radius={[2, 2, 0, 0]} opacity={0.7} name="Packets" />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Registered devices */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
              className="hud-panel" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(0,212,255,0.07)',
                display: 'flex', alignItems: 'center', gap: 6 }}>
                <Server size={11} color="var(--cyan)" />
                <span className="label">Registered Devices</span>
                <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--text-muted)',
                  fontFamily: 'Space Mono' }}>{devices.length}</span>
              </div>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {devices.length === 0 ? (
                  <div style={{ padding: '20px 16px', textAlign: 'center', fontSize: 11,
                    color: 'var(--text-muted)', fontFamily: 'Space Mono' }}>
                    NO DEVICES
                  </div>
                ) : devices.map((d) => (
                  <div key={d.device_id} style={{
                    padding: '10px 16px', borderBottom: '1px solid rgba(0,212,255,0.04)',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: 1,
                      background: d.active ? '#2ed573' : 'var(--text-muted)',
                      boxShadow: d.active ? '0 0 6px rgba(46,213,115,0.6)' : 'none',
                      flexShrink: 0,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="font-mono" style={{ fontSize: 11, color: 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {d.device_id}
                      </div>
                      {d.last_seen && (
                        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2,
                          fontFamily: 'Space Mono' }}>
                          {new Date(d.last_seen).toLocaleTimeString()} · {d.last_mode ?? '---'} · {d.last_battery?.toFixed(0) ?? '--'}%
                        </div>
                      )}
                    </div>
                    
                    {/* Per-vehicle AI toggle */}
                    {(() => {
                      const fv = vehicles.find(v => v.device_id === d.device_id)
                      const isAiOn = fv ? fv.ai_enabled : true
                      return (
                        <button
                          onClick={async () => {
                            await setVehicleAiService(d.device_id, !isAiOn)
                            load()
                          }}
                          style={{
                            padding: '4px 8px', borderRadius: 4,
                            background: isAiOn ? 'rgba(46,213,115,0.1)' : 'rgba(255,71,87,0.1)',
                            border: `1px solid ${isAiOn ? 'rgba(46,213,115,0.3)' : 'rgba(255,71,87,0.3)'}`,
                            color: isAiOn ? '#2ed573' : '#ff4757',
                            fontSize: 8, fontFamily: 'Space Mono', cursor: 'pointer', flexShrink: 0
                          }}
                        >
                          AI {isAiOn ? 'ON' : 'OFF'}
                        </button>
                      )
                    })()}

                    <span style={{ fontSize: 9, fontFamily: 'Space Mono',
                      color: d.active ? '#2ed573' : 'var(--text-muted)', flexShrink: 0, marginLeft: 4 }}>
                      {d.active ? 'ACTIVE' : 'OFFLINE'}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* AI + Chaos status */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.28 }}
              className="hud-panel" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(0,212,255,0.07)',
                display: 'flex', alignItems: 'center', gap: 6 }}>
                <BrainCircuit size={11} color={ai?.running ? '#2ed573' : '#ff4757'} />
                <span className="label">AI + Chaos</span>
                <span style={{ marginLeft: 'auto', fontSize: 9, fontFamily: 'Space Mono',
                  color: ai?.running ? '#2ed573' : '#ff4757' }}>
                  {ai?.running ? '● RUNNING' : '◌ STOPPED'}
                </span>
              </div>
              {[
                { label: 'Service Enabled',  value: ai?.service_enabled ? 'YES' : 'NO',
                  color: ai?.service_enabled ? '#2ed573' : '#ff4757' },
                { label: 'Model Available',  value: ai?.model_available ? 'YES' : 'NO',
                  color: ai?.model_available ? '#2ed573' : '#ffb347' },
                { label: 'Chaos Drops',      value: String(chaos?.dropped_packets ?? 0),
                  color: chaos?.dropped_packets ? '#ffb347' : 'var(--text-muted)' },
                { label: 'Latency Added',    value: `${chaos?.latency_added ?? 0}ms`,
                  color: chaos?.latency_added ? '#ffb347' : 'var(--text-muted)' },
                { label: 'Tampered Pkts',   value: String(chaos?.tampered_packets ?? 0),
                  color: chaos?.tampered_packets ? '#ff4757' : 'var(--text-muted)' },
                { label: 'Avg Pkt Size',     value: `${(pkt?.avg_size_bytes ?? 0).toFixed(0)} B`,
                  color: 'var(--text-secondary)' },
              ].map((item) => (
                <div key={item.label} style={{
                  padding: '9px 16px', borderBottom: '1px solid rgba(0,212,255,0.04)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.07em' }}>
                    {item.label}
                  </span>
                  <span className="font-mono" style={{ fontSize: 11, color: item.color }}>{item.value}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* ── Row 4: Auth log ── */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="hud-panel" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,212,255,0.07)',
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(0,212,255,0.02)' }}>
              <Shield size={11} color="#ffb347" />
              <span className="label">Security &amp; Auth Log</span>
              <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--text-muted)',
                fontFamily: 'Space Mono' }}>
                {authLogs.length} events
              </span>
            </div>
            <div style={{ overflowX: 'auto', maxHeight: 260, overflowY: 'auto' }}>
              <table className="noc-table">
                <thead>
                  <tr>
                    {['Time', 'Device', 'Event', 'IP', 'Details'].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {authLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ padding: '28px', textAlign: 'center',
                        color: 'var(--text-muted)', fontFamily: 'Space Mono', fontSize: 11,
                        letterSpacing: '0.08em' }}>
                        NO AUTH EVENTS YET
                      </td>
                    </tr>
                  ) : authLogs.slice(0, 25).map((log) => {
                    const color = EVENT_COLORS[log.event_type] ?? 'var(--text-secondary)'
                    const Icon  = EVENT_ICONS[log.event_type] ?? CheckCircle
                    return (
                      <tr key={log.log_id}>
                        <td style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                        <td style={{ color: 'var(--text-primary)' }}>{log.device_id}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Icon size={10} color={color} />
                            <span style={{ fontSize: 9, color, letterSpacing: '0.06em' }}>
                              {log.event_type}
                            </span>
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-muted)' }}>{log.source_ip || '---'}</td>
                        <td style={{
                          color: 'var(--text-secondary)',
                          maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {log.details}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>

        </div>
      </main>
    </>
  )
}
