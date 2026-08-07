'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import {
  Battery, Zap, Thermometer, Gauge, Radio, BrainCircuit,
  AlertTriangle, MessageSquare, Send, X, ChevronDown, ChevronUp, Wifi
} from 'lucide-react'
import { toast } from 'sonner'

import WireframeCarLoader from '@/components/layout/WireframeCarLoader'
import Navbar from '@/components/layout/Navbar'
import CustomCursor from '@/components/layout/CustomCursor'
import { useWebSocket } from '@/hooks/useWebSocket'
import { fetchRecent, fetchRecommendation, sendChat } from '@/lib/api'
import type { TelemetryRow, WsEvent, VehicleMode } from '@/lib/types'

// ─── Mode config ────────────────────────────────────────────────────────
const MODE_CONFIG: Record<string, { color: string; badge: string; glow: string }> = {
  'Healthy':             { color: 'var(--green)',  badge: 'badge-healthy', glow: 'rgba(46,213,115,0.15)' },
  'Eco':                 { color: 'var(--green)',  badge: 'badge-healthy', glow: 'rgba(46,213,115,0.12)' },
  'Sport':               { color: 'var(--cyan)',   badge: 'badge-info',    glow: 'rgba(0,212,255,0.15)' },
  'Heavy Traffic':       { color: 'var(--amber)',  badge: 'badge-warning', glow: 'rgba(255,179,71,0.12)' },
  'Low Battery':         { color: 'var(--amber)',  badge: 'badge-warning', glow: 'rgba(255,179,71,0.15)' },
  'Battery Overheating': { color: 'var(--red)',    badge: 'badge-fault',   glow: 'rgba(255,71,87,0.15)' },
  'Charging':            { color: 'var(--cyan)',   badge: 'badge-info',    glow: 'rgba(0,212,255,0.1)' },
  'Motor Fault':         { color: 'var(--red)',    badge: 'badge-fault',   glow: 'rgba(255,71,87,0.2)' },
}
const modeOf = (m: string) => MODE_CONFIG[m] ?? MODE_CONFIG['Healthy']

// ─── Telemetry card ──────────────────────────────────────────────────────
function TCard({ icon: Icon, label, value, unit, color = 'var(--text-primary)', sublabel }:
  { icon: React.FC<{ size: number; color?: string }>; label: string; value: string | number; unit?: string; color?: string; sublabel?: string }) {
  return (
    <motion.div
      className="glass-card"
      whileHover={{ y: -2, borderColor: 'var(--border-hover)' }}
      style={{ padding: '20px 24px' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Icon size={14} color="var(--text-muted)" />
        <span className="label">{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 32, fontWeight: 600, color, fontFamily: 'Space Mono, monospace', letterSpacing: '-0.02em' }}>
          {value}
        </span>
        {unit && <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{unit}</span>}
      </div>
      {sublabel && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>{sublabel}</div>}
    </motion.div>
  )
}

// ─── Battery arc ─────────────────────────────────────────────────────────
function BatteryArc({ pct }: { pct: number }) {
  const r = 52, stroke = 8, norm = pct / 100
  const circ = 2 * Math.PI * r
  const color = pct < 20 ? 'var(--red)' : pct < 40 ? 'var(--amber)' : 'var(--green)'
  return (
    <svg width={130} height={130} style={{ overflow: 'visible' }}>
      {/* BG ring */}
      <circle cx={65} cy={65} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
      {/* Value arc */}
      <motion.circle
        cx={65} cy={65} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: circ * (1 - norm) }}
        transition={{ duration: 1, ease: 'easeOut' }}
        style={{
          transform: 'rotate(-90deg)',
          transformOrigin: '65px 65px',
          filter: `drop-shadow(0 0 6px ${color})`,
        }}
      />
      <text x={65} y={60} textAnchor="middle" fill={color} style={{ fontFamily: 'Space Mono', fontSize: 22, fontWeight: 700 }}>
        {Math.round(pct)}
      </text>
      <text x={65} y={76} textAnchor="middle" fill="var(--text-muted)" style={{ fontSize: 11 }}>%</text>
    </svg>
  )
}

// ─── Alert item ───────────────────────────────────────────────────────────
interface AlertItem { id: number; msg: string; type: 'warn' | 'fault' | 'info'; time: string }
function AlertRow({ alert }: { alert: AlertItem }) {
  const colors = { warn: 'var(--amber)', fault: 'var(--red)', info: 'var(--cyan)' }
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      style={{
        display: 'flex', gap: 10, alignItems: 'flex-start',
        padding: '10px 0',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <AlertTriangle size={12} color={colors[alert.type]} style={{ marginTop: 2, flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.4 }}>{alert.msg}</div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{alert.time}</div>
      </div>
    </motion.div>
  )
}

// ─── Main Driver page ────────────────────────────────────────────────────
export default function DriverPage() {
  const [loaded,       setLoaded]       = useState(false)
  const [latest,       setLatest]       = useState<TelemetryRow | null>(null)
  const [history,      setHistory]      = useState<{ time: string; batt: number; speed: number; temp: number }[]>([])
  const [aiRec,        setAiRec]        = useState('')
  const [aiTyping,     setAiTyping]     = useState(false)
  const [chatOpen,     setChatOpen]     = useState(false)
  const [chatMsg,      setChatMsg]      = useState('')
  const [chatHistory,  setChatHistory]  = useState<{ role: 'user' | 'ai'; text: string }[]>([])
  const [chatLoading,  setChatLoading]  = useState(false)
  const [alerts,       setAlerts]       = useState<AlertItem[]>([])
  const alertId = useRef(0)
  const chatBottom = useRef<HTMLDivElement>(null)

  // Seed history from REST on mount
  useEffect(() => {
    fetchRecent(60).then((rows: unknown) => {
      const data = (rows as TelemetryRow[]).slice(-30).reverse()
      setHistory(data.map((r) => ({
        time:  new Date(r.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        batt:  r.battery_pct,
        speed: r.speed_kmh,
        temp:  r.motor_temp_c,
      })))
      if (data.length > 0) setLatest(data[0])
    }).catch(() => {})
  }, [])

  // WebSocket
  const handleWs = useCallback((ev: WsEvent) => {
    if (ev.event === 'telemetry' || ev.event === 'telemetry_backfill') {
      const rows = ev.event === 'telemetry_backfill' ? (ev as { items: TelemetryRow[] }).items : [ev as unknown as TelemetryRow]
      rows.forEach((r) => {
        setLatest(r)
        setHistory((prev) => {
          const next = [...prev.slice(-59), {
            time:  new Date(r.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            batt:  r.battery_pct,
            speed: r.speed_kmh,
            temp:  r.motor_temp_c,
          }]
          return next
        })
        // Auto-alert on critical modes
        if (['Motor Fault', 'Battery Overheating', 'Low Battery'].includes(r.mode)) {
          const id = ++alertId.current
          const msgs: Record<string, string> = {
            'Motor Fault':         `Motor fault detected on ${r.device_id} — fault code 0x${r.fault_code.toString(16).toUpperCase()}`,
            'Battery Overheating': `Battery temp critical: ${r.battery_temp_c}°C on ${r.device_id}`,
            'Low Battery':         `Low battery: ${r.battery_pct}% on ${r.device_id} — range ${r.range_km}km`,
          }
          const type = r.mode === 'Motor Fault' || r.mode === 'Battery Overheating' ? 'fault' : 'warn'
          setAlerts((prev) => [{ id, msg: msgs[r.mode] ?? r.mode, type, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 9)])
          if (type === 'fault') toast.error(msgs[r.mode] ?? r.mode)
          else                  toast.warning(msgs[r.mode] ?? r.mode)
        }
      })
    }
    if (ev.event === 'ai_recommendation') {
      typewriterEffect(ev.recommendation)
    }
  }, [])

  const { connected } = useWebSocket(handleWs)

  // Typewriter effect for AI recommendation
  const typewriterEffect = (text: string) => {
    setAiTyping(true)
    setAiRec('')
    let i = 0
    const interval = setInterval(() => {
      setAiRec(text.slice(0, i + 1))
      i++
      if (i >= text.length) { clearInterval(interval); setAiTyping(false) }
    }, 18)
  }

  // Manual AI recommendation
  const requestRecommendation = async () => {
    if (!latest) return
    setAiTyping(true)
    try {
      const res = await fetchRecommendation(latest.device_id) as { recommendation: string }
      typewriterEffect(res.recommendation)
    } catch { setAiTyping(false) }
  }

  // Chat
  const handleChat = async () => {
    if (!chatMsg.trim() || !latest) return
    const msg = chatMsg.trim()
    setChatMsg('')
    setChatHistory((h) => [...h, { role: 'user', text: msg }])
    setChatLoading(true)
    try {
      const res = await sendChat(latest.device_id, msg) as { reply: string }
      setChatHistory((h) => [...h, { role: 'ai', text: res.reply }])
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'AI unavailable'
      setChatHistory((h) => [...h, { role: 'ai', text: `Error: ${msg}` }])
    } finally {
      setChatLoading(false)
      setTimeout(() => chatBottom.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }

  const mode  = latest?.mode ?? 'Healthy'
  const mconf = modeOf(mode)

  if (!loaded) {
    return <WireframeCarLoader onComplete={() => setLoaded(true)} message="Loading Vehicle Dashboard..." />
  }

  return (
    <>
      <CustomCursor />
      <div className="scan-line" />
      <Navbar wsConnected={connected} />

      {/* Aurora background */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <div className="aurora-1" style={{
          position: 'absolute', top: '10%', right: '10%',
          width: 700, height: 700,
          background: `radial-gradient(circle, ${mconf.glow} 0%, transparent 70%)`,
          borderRadius: '50%', transition: 'background 2s',
        }} />
        <div className="aurora-2" style={{
          position: 'absolute', bottom: '5%', left: '5%',
          width: 500, height: 500,
          background: 'radial-gradient(circle, rgba(0,0,40,0.3) 0%, transparent 70%)',
          borderRadius: '50%',
        }} />
      </div>

      <main style={{ position: 'relative', zIndex: 1, paddingTop: 60, minHeight: '100vh' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '32px 24px' }}>

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            style={{ marginBottom: 32 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <div className="live-dot" />
              <span className="label">Live Telemetry</span>
              {latest && (
                <span className={`badge ${mconf.badge}`} style={{ fontSize: 10 }}>
                  {mode}
                </span>
              )}
            </div>
            <h1 className="font-display" style={{ fontSize: 28, letterSpacing: '0.12em', color: mconf.color }}>
              {latest?.device_id ?? '---'}
            </h1>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              Last update: {latest ? new Date(latest.received_at).toLocaleTimeString() : 'Waiting...'}
              {connected
                ? <span style={{ color: 'var(--green)', marginLeft: 12 }}>● WebSocket Connected</span>
                : <span style={{ color: 'var(--text-muted)', marginLeft: 12 }}>◌ Reconnecting...</span>
              }
            </div>
          </motion.div>

          {/* Grid: Battery arc + stats + mode */}
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr 1fr 1fr', gap: 16, marginBottom: 20 }}>
            {/* Battery arc */}
            <motion.div
              className="glass-card"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, gridRow: 'span 1' }}
            >
              <span className="label">Battery</span>
              <BatteryArc pct={latest?.battery_pct ?? 0} />
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Temp: {latest?.battery_temp_c ?? '--'}°C
              </div>
            </motion.div>

            <TCard icon={Gauge}       label="Speed"       value={latest?.speed_kmh?.toFixed(0) ?? '--'}     unit="km/h"  color="var(--cyan)" />
            <TCard icon={Radio}       label="Range"       value={latest?.range_km?.toFixed(0)   ?? '--'}     unit="km"    sublabel={latest?.mode === 'Charging' ? 'Charging' : undefined} />
            <TCard icon={Thermometer} label="Motor Temp"  value={latest?.motor_temp_c?.toFixed(0) ?? '--'}   unit="°C"
              color={latest && latest.motor_temp_c > 85 ? 'var(--red)' : latest && latest.motor_temp_c > 70 ? 'var(--amber)' : 'var(--text-primary)'}
            />
            <TCard icon={Zap}         label="Charging"    value={latest?.charging_rate_w ? `${(latest.charging_rate_w / 1000).toFixed(1)}` : '0'} unit="kW"
              sublabel={latest?.fault_code ? `Fault: 0x${latest.fault_code.toString(16).toUpperCase()}` : undefined}
            />
          </div>

          {/* Charts row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            {/* Battery chart */}
            <motion.div
              className="glass-card"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              style={{ padding: '20px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Battery size={13} color="var(--green)" />
                <span className="label">Battery History</span>
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id="battGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#2ed573" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#2ed573" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="time" hide />
                  <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} width={28} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
                    labelStyle={{ color: 'var(--text-muted)' }}
                  />
                  <Area type="monotone" dataKey="batt" stroke="var(--green)" strokeWidth={2} fill="url(#battGrad)" dot={false} name="Battery %" />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Speed chart */}
            <motion.div
              className="glass-card"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              style={{ padding: '20px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <Gauge size={13} color="var(--cyan)" />
                <span className="label">Speed + Motor Temp</span>
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id="speedGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#00d4ff" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#ffb347" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ffb347" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="time" hide />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 10 }} tickLine={false} axisLine={false} width={28} />
                  <Tooltip
                    contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 11 }}
                  />
                  <Area type="monotone" dataKey="speed" stroke="var(--cyan)" strokeWidth={2} fill="url(#speedGrad)" dot={false} name="Speed km/h" />
                  <Area type="monotone" dataKey="temp"  stroke="var(--amber)" strokeWidth={1.5} fill="url(#tempGrad)" dot={false} name="Motor °C" />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>
          </div>

          {/* Bottom row: AI + Alerts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16 }}>
            {/* AI Recommendation */}
            <motion.div
              className="glass-card"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              style={{ padding: '24px', borderColor: aiRec ? 'rgba(0,212,255,0.2)' : 'var(--glass-border)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BrainCircuit size={14} color="var(--cyan)" />
                  <span className="label">AI Recommendation</span>
                  {aiTyping && <div className="typewriter-cursor" />}
                </div>
                <button
                  onClick={requestRecommendation}
                  disabled={aiTyping || !latest}
                  style={{
                    background: 'var(--cyan-dim)',
                    border: '1px solid var(--border-active)',
                    borderRadius: 6,
                    padding: '5px 12px',
                    fontSize: 11,
                    color: 'var(--cyan)',
                    cursor: 'pointer',
                    letterSpacing: '0.06em',
                    opacity: aiTyping ? 0.5 : 1,
                  }}
                >
                  Refresh
                </button>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, minHeight: 60 }}>
                {aiRec || (
                  <span style={{ color: 'var(--text-muted)' }}>
                    AI recommendations appear here automatically after each telemetry update.
                    {!connected && ' (Waiting for WebSocket connection)'}
                  </span>
                )}
              </div>
            </motion.div>

            {/* Alert feed */}
            <motion.div
              className="glass-card"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              style={{ padding: '20px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <AlertTriangle size={13} color="var(--amber)" />
                <span className="label">Alert Feed</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)' }}>{alerts.length}</span>
              </div>
              <div style={{ maxHeight: 180, overflowY: 'auto' }}>
                <AnimatePresence>
                  {alerts.length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '16px 0' }}>No alerts — vehicle operating normally</div>
                  ) : (
                    alerts.map((a) => <AlertRow key={a.id} alert={a} />)
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        </div>
      </main>

      {/* Chat panel */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{
              position: 'fixed', bottom: 0, right: 24, width: 380, zIndex: 200,
              background: 'rgba(8,8,8,0.98)',
              border: '1px solid var(--border-active)',
              borderRadius: '16px 16px 0 0',
              overflow: 'hidden',
              boxShadow: '0 -8px 40px rgba(0,212,255,0.1)',
            }}
          >
            {/* Chat header */}
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <BrainCircuit size={14} color="var(--cyan)" />
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Chat with CVIS</span>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>
                {latest ? `Grounded on ${latest.device_id} • ${mode}` : 'No vehicle data'}
              </div>
              <button onClick={() => setChatOpen(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={16} />
              </button>
            </div>
            {/* Messages */}
            <div style={{ height: 280, overflowY: 'auto', padding: '12px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {chatHistory.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 40 }}>
                  Ask CVIS anything about your vehicle
                </div>
              )}
              {chatHistory.map((m, i) => (
                <div key={i} style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  padding: '8px 12px',
                  borderRadius: m.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                  background: m.role === 'user' ? 'var(--cyan-dim)' : 'var(--glass)',
                  border: `1px solid ${m.role === 'user' ? 'var(--border-active)' : 'var(--border)'}`,
                  fontSize: 12,
                  color: 'var(--text-primary)',
                  lineHeight: 1.5,
                }}>
                  {m.text}
                </div>
              ))}
              {chatLoading && (
                <div style={{ alignSelf: 'flex-start', display: 'flex', gap: 4, padding: '8px 12px' }}>
                  {[0,1,2].map((i) => (
                    <motion.div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--cyan)' }}
                      animate={{ y: [0, -6, 0] }} transition={{ delay: i * 0.15, repeat: Infinity, duration: 0.8 }}
                    />
                  ))}
                </div>
              )}
              <div ref={chatBottom} />
            </div>
            {/* Input */}
            <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
              <input
                value={chatMsg}
                onChange={(e) => setChatMsg(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleChat()}
                placeholder="Ask about your vehicle..."
                style={{
                  flex: 1, background: 'var(--glass)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)',
                  fontSize: 12, outline: 'none',
                }}
              />
              <button onClick={handleChat} disabled={chatLoading} style={{
                background: 'var(--cyan)', border: 'none', borderRadius: 8,
                padding: '8px 12px', cursor: 'pointer', color: '#000',
                opacity: chatLoading ? 0.5 : 1,
              }}>
                <Send size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat FAB */}
      {!chatOpen && (
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setChatOpen(true)}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 1, type: 'spring' }}
          style={{
            position: 'fixed', bottom: 28, right: 28, zIndex: 200,
            width: 52, height: 52, borderRadius: '50%',
            background: 'var(--cyan)',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(0,212,255,0.4)',
          }}
        >
          <MessageSquare size={20} color="#000" />
        </motion.button>
      )}
    </>
  )
}
