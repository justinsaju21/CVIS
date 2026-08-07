'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'
import {
  Cpu, HardDrive, Activity, Shield, AlertTriangle,
  CheckCircle, XCircle, BrainCircuit, Server, Wifi, RefreshCw
} from 'lucide-react'

import WireframeCarLoader from '@/components/layout/WireframeCarLoader'
import Navbar from '@/components/layout/Navbar'
import CustomCursor from '@/components/layout/CustomCursor'
import { useWebSocket } from '@/hooks/useWebSocket'
import { fetchAdminStats, fetchAuthLogs, fetchAdminDevices, fetchPacketStats } from '@/lib/api'
import type { AdminStats, AuthLog, DeviceInfo, WsEvent } from '@/lib/types'

// ─── Stat cell ────────────────────────────────────────────────────────────
function StatCell({ label, value, unit, color = 'var(--text-primary)', sublabel }:
  { label: string; value: string | number; unit?: string; color?: string; sublabel?: string }) {
  return (
    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
      <div className="label" style={{ marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span className="font-mono" style={{ fontSize: 24, color, fontWeight: 700 }}>{value}</span>
        {unit && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{unit}</span>}
      </div>
      {sublabel && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{sublabel}</div>}
    </div>
  )
}

// ─── Progress bar ─────────────────────────────────────────────────────────
function ProgressBar({ pct, color = 'var(--cyan)', label }:
  { pct: number; color?: string; label: string }) {
  const warn = pct > 80 ? 'var(--red)' : pct > 60 ? 'var(--amber)' : color
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</span>
        <span className="font-mono" style={{ fontSize: 11, color: warn }}>{pct.toFixed(1)}%</span>
      </div>
      <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(pct, 100)}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ height: '100%', background: warn, borderRadius: 2, boxShadow: `0 0 6px ${warn}` }}
        />
      </div>
    </div>
  )
}

// ─── Auth log event colors ────────────────────────────────────────────────
const EVENT_COLORS: Record<string, string> = {
  auth_ok:         'var(--green)',
  auth_fail:       'var(--red)',
  tamper_detected: 'var(--red)',
  registered:      'var(--cyan)',
  no_auth:         'var(--amber)',
  disconnected:    'var(--amber)',
  reconnected:     'var(--green)',
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

function fmt(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}h ${m}m`
}

// ─── Admin page ────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [loaded,    setLoaded]    = useState(false)
  const [stats,     setStats]     = useState<AdminStats | null>(null)
  const [authLogs,  setAuthLogs]  = useState<AuthLog[]>([])
  const [devices,   setDevices]   = useState<DeviceInfo[]>([])
  const [pkStats,   setPkStats]   = useState<{ hour: string; count: number }[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [tick,      setTick]      = useState(0)

  const load = useCallback(async () => {
    setRefreshing(true)
    try {
      const [s, logs, devs, pks] = await Promise.all([
        fetchAdminStats(),
        fetchAuthLogs(30),
        fetchAdminDevices(),
        fetchPacketStats(12),
      ])
      setStats(s as AdminStats)
      setAuthLogs(logs as AuthLog[])
      setDevices(devs as DeviceInfo[])
      const raw = (pks as { hour_bucket: string; count: number }[])
      setPkStats(raw.map((r) => ({ hour: new Date(r.hour_bucket).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), count: r.count })).reverse())
    } catch {}
    setRefreshing(false)
  }, [])

  useEffect(() => { load() }, [load, tick])

  // Auto-refresh every 30s
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

  if (!loaded) {
    return <WireframeCarLoader onComplete={() => setLoaded(true)} message="Loading Admin Console..." />
  }

  const sys   = stats?.system
  const pkt   = stats?.packets
  const auth  = stats?.auth
  const ai    = stats?.ai
  const chaos = stats?.chaos

  return (
    <>
      <CustomCursor />
      <div className="scan-line" />
      <Navbar wsConnected={connected} />

      <main style={{ paddingTop: 60, minHeight: '100vh' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '28px 20px' }}>

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            style={{ marginBottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <div>
              <span className="label" style={{ marginBottom: 4, display: 'block' }}>Administrator Console</span>
              <h1 className="font-display" style={{ fontSize: 22, letterSpacing: '0.12em', color: 'var(--text-primary)' }}>
                CVIS Admin
              </h1>
            </div>
            <button
              onClick={load}
              disabled={refreshing}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 8,
                padding: '8px 14px', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
              }}
            >
              <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
              Refresh
            </button>
          </motion.div>

          {/* Row 1: System health */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14, marginBottom: 16 }}>
            {[
              { label: 'CPU Usage',    value: sys?.cpu_pct  ?? 0, color: 'var(--cyan)' },
              { label: 'Memory',       value: sys?.mem_pct  ?? 0, color: 'var(--amber)' },
              { label: 'Disk',         value: sys?.disk_pct ?? 0, color: 'var(--text-secondary)' },
              { label: 'DB Size',      value: sys?.db_size_kb ? `${(sys.db_size_kb / 1024).toFixed(1)}` : '0', unit: 'MB',
                isNumber: true, color: 'var(--text-primary)' },
            ].map((item) => (
              <motion.div
                key={item.label}
                className="glass-card"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                style={{ padding: '18px 20px' }}
              >
                <div className="label" style={{ marginBottom: 10 }}>{item.label}</div>
                {(item as { isNumber?: boolean }).isNumber ? (
                  <div className="font-mono" style={{ fontSize: 22, color: item.color, fontWeight: 700 }}>
                    {item.value}<span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 4 }}>{(item as { unit?: string }).unit}</span>
                  </div>
                ) : (
                  <ProgressBar pct={item.value as number} color={item.color} label="" />
                )}
              </motion.div>
            ))}
          </div>

          {/* Row 2: Packet + Auth + AI stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 16 }}>

            {/* Packet stats */}
            <motion.div className="glass-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={13} color="var(--cyan)" />
                <span className="label">Packet Statistics</span>
              </div>
              <StatCell label="Total Packets"  value={pkt?.total   ?? 0} />
              <StatCell label="Last Hour"      value={pkt?.last_hour ?? 0} />
              <StatCell label="Today"          value={pkt?.today    ?? 0} />
              <StatCell label="Avg Size"       value={pkt?.avg_size_bytes?.toFixed(0) ?? 0} unit="B" />
              <div style={{ padding: '14px 20px' }}>
                <div className="label" style={{ marginBottom: 8 }}>Protocol Split</div>
                {Object.entries(pkt?.protocol_breakdown ?? {}).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: k === 'mqtt' ? 'var(--amber)' : 'var(--cyan)', fontFamily: 'Space Mono' }}>{k.toUpperCase()}</span>
                    <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{v}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Auth stats */}
            <motion.div className="glass-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Shield size={13} color="var(--amber)" />
                <span className="label">Security Stats</span>
              </div>
              <StatCell label="Active Devices"   value={auth?.active_devices    ?? 0} color="var(--green)" />
              <StatCell label="Auth Failures"    value={auth?.auth_failures      ?? 0} color={auth?.auth_failures ? 'var(--red)' : 'var(--text-primary)'} />
              <StatCell label="Tamper Events"    value={auth?.tamper_events      ?? 0} color={auth?.tamper_events ? 'var(--red)' : 'var(--text-primary)'} />
              <StatCell label="Chaos Drops"      value={chaos?.dropped_packets   ?? 0} color="var(--amber)" />
              <StatCell label="Uptime"           value={fmt(sys?.uptime_s ?? 0)} sublabel="Server uptime" />
            </motion.div>

            {/* AI stats */}
            <motion.div className="glass-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <BrainCircuit size={13} color={ai?.running ? 'var(--green)' : 'var(--red)'} />
                <span className="label">AI Service</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: ai?.running ? 'var(--green)' : 'var(--red)' }}>
                  {ai?.running ? '● RUNNING' : '◌ STOPPED'}
                </span>
              </div>
              <StatCell label="Service Enabled"  value={ai?.service_enabled ? 'Yes' : 'No'}  color={ai?.service_enabled ? 'var(--green)' : 'var(--red)'} />
              <StatCell label="Model Available"  value={ai?.model_available ? 'Yes' : 'No'}  color={ai?.model_available ? 'var(--green)' : 'var(--amber)'} />
              <StatCell label="Chaos Latency Added" value={chaos?.latency_added ?? 0} unit="ms" />
              <StatCell label="Tampered Packets" value={chaos?.tampered_packets ?? 0} color={chaos?.tampered_packets ? 'var(--red)' : 'var(--text-primary)'} />
            </motion.div>
          </div>

          {/* Row 3: Packet chart + Device grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 14, marginBottom: 16 }}>

            {/* Packet history chart */}
            <motion.div className="glass-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Activity size={13} color="var(--cyan)" />
                <span className="label">Packets — Last 12 Hours</span>
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={pkStats} barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 9 }} axisLine={false} tickLine={false} width={24} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
                  />
                  <Bar dataKey="count" fill="var(--cyan)" radius={[3, 3, 0, 0]} opacity={0.8} name="Packets" />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Device grid */}
            <motion.div className="glass-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} style={{ overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Server size={13} color="var(--cyan)" />
                <span className="label">Registered Devices</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>{devices.length}</span>
              </div>
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                {devices.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', fontSize: 12, color: 'var(--text-muted)' }}>No devices registered</div>
                ) : devices.map((d) => (
                  <div key={d.device_id} style={{
                    padding: '12px 20px', borderBottom: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: d.active ? 'var(--green)' : 'var(--text-muted)',
                      boxShadow: d.active ? '0 0 6px rgba(46,213,115,0.5)' : 'none',
                      flexShrink: 0,
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="font-mono" style={{ fontSize: 12, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.device_id}</div>
                      {d.last_seen && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                        {new Date(d.last_seen).toLocaleTimeString()} · {d.last_mode ?? '---'} · {d.last_battery?.toFixed(0) ?? '--'}%
                      </div>}
                    </div>
                    <div style={{ fontSize: 10, color: d.active ? 'var(--green)' : 'var(--red)' }}>
                      {d.active ? 'ACTIVE' : 'OFFLINE'}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Row 4: Auth logs */}
          <motion.div className="glass-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Shield size={13} color="var(--amber)" />
              <span className="label">Auth + Security Log</span>
              <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>{authLogs.length} events</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Time', 'Device', 'Event', 'IP', 'Details'].map((h) => (
                      <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {authLogs.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>No auth events yet</td></tr>
                  ) : authLogs.slice(0, 25).map((log) => {
                    const color = EVENT_COLORS[log.event_type] ?? 'var(--text-secondary)'
                    const Icon  = EVENT_ICONS[log.event_type] ?? CheckCircle
                    return (
                      <tr key={log.log_id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 14px', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Space Mono', whiteSpace: 'nowrap' }}>
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </td>
                        <td style={{ padding: '8px 14px', fontSize: 11, color: 'var(--text-primary)', fontFamily: 'Space Mono' }}>{log.device_id}</td>
                        <td style={{ padding: '8px 14px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <Icon size={11} color={color} />
                            <span style={{ fontSize: 10, color, letterSpacing: '0.05em' }}>{log.event_type}</span>
                          </span>
                        </td>
                        <td style={{ padding: '8px 14px', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Space Mono' }}>{log.source_ip || '---'}</td>
                        <td style={{ padding: '8px 14px', fontSize: 11, color: 'var(--text-secondary)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.details}</td>
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
