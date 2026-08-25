'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts'
import {
  BrainCircuit, AlertTriangle, MessageSquare, Send, X,
  Zap, ChevronRight, Lock, Star, TrendingUp, Navigation, Gauge
} from 'lucide-react'

import WireframeCarLoader from '@/components/layout/WireframeCarLoader'
import CustomCursor from '@/components/layout/CustomCursor'
import { useWebSocket } from '@/hooks/useWebSocket'
import { fetchRecent, fetchRecommendation, sendChat } from '@/lib/api'
import type { TelemetryRow, WsEvent } from '@/lib/types'

const MODE_CONFIG: Record<string, { color: string; badge: string; glow: string; accent: string }> = {
  'Healthy':             { color: '#2ed573', badge: 'badge-healthy', glow: 'rgba(46,213,115,0.12)',  accent: '#2ed573' },
  'Eco':                 { color: '#2ed573', badge: 'badge-healthy', glow: 'rgba(46,213,115,0.10)',  accent: '#2ed573' },
  'Sport':               { color: '#00d4ff', badge: 'badge-info',    glow: 'rgba(0,212,255,0.15)',   accent: '#00d4ff' },
  'Heavy Traffic':       { color: '#ffb347', badge: 'badge-warning', glow: 'rgba(255,179,71,0.12)',  accent: '#ffb347' },
  'Low Battery':         { color: '#ffb347', badge: 'badge-warning', glow: 'rgba(255,179,71,0.14)',  accent: '#ffb347' },
  'Battery Overheating': { color: '#ff4757', badge: 'badge-fault',   glow: 'rgba(255,71,87,0.15)',   accent: '#ff4757' },
  'Charging':            { color: '#00d4ff', badge: 'badge-info',    glow: 'rgba(0,212,255,0.10)',   accent: '#00d4ff' },
  'Motor Fault':         { color: '#ff4757', badge: 'badge-fault',   glow: 'rgba(255,71,87,0.20)',   accent: '#ff4757' },
}
const modeOf = (m: string) => MODE_CONFIG[m] ?? MODE_CONFIG['Healthy']

const DRIVE_MODE_LABEL: Record<string, string> = {
  'Healthy': 'NORMAL', 'Eco': 'ECO', 'Sport': 'SPORT',
  'Heavy Traffic': 'CITY', 'Low Battery': 'ECO',
  'Battery Overheating': 'ALERT', 'Charging': 'CHARGE', 'Motor Fault': 'FAULT',
}

const KEY_SUGGESTIONS: Record<string, { icon: string; title: string; desc: string; priority: 'low' | 'med' | 'high' }[]> = {
  'Healthy': [
    { icon: '\u26a1', title: 'Optimize Speed', desc: 'Maintain 55\u201365 km/h for best efficiency', priority: 'low' },
    { icon: '\u3030', title: 'Lane Discipline', desc: 'Keep safe distance for smooth deceleration', priority: 'low' },
    { icon: '\ud83d\udd0b', title: 'Check Tire Pressure', desc: 'Rear left tire slightly low', priority: 'med' },
  ],
  'Eco': [
    { icon: '\ud83c\udf3f', title: 'Eco Mode Active', desc: 'Regeneration maximized', priority: 'low' },
    { icon: '\ud83d\udcc9', title: 'Reduce HVAC Load', desc: 'Lower cabin temp 1\u00b0C \u2192 gain +8 km range', priority: 'med' },
    { icon: '\u3030', title: 'Smooth Braking', desc: 'Anticipate stops to maximize regen', priority: 'low' },
  ],
  'Sport': [
    { icon: '\u26a1', title: 'Performance Mode', desc: 'Motor drawing peak power', priority: 'med' },
    { icon: '\ud83c\udf21', title: 'Motor Temp Rising', desc: 'Reduce aggression if temp exceeds 80\u00b0C', priority: 'med' },
    { icon: '\ud83c\udfc8', title: 'Traction Optimal', desc: 'Dynamic performance \u2014 all systems nominal', priority: 'low' },
  ],
  'Heavy Traffic': [
    { icon: '\ud83d\udea6', title: 'Stop-Start Detected', desc: 'Regen harvesting energy in idle cycles', priority: 'low' },
    { icon: '\u23f1', title: 'Estimated Delay', desc: 'Traffic pattern adds +12 min to ETA', priority: 'med' },
    { icon: '\u2744\ufe0f', title: 'Precondition Cabin', desc: 'Cool now to reduce draw when moving', priority: 'low' },
  ],
  'Low Battery': [
    { icon: '\u26a0\ufe0f', title: 'Low Battery Critical', desc: 'Find charging station within 25 km', priority: 'high' },
    { icon: '\ud83d\udcc9', title: 'Disable Non-Essentials', desc: 'Turn off AC/heating to extend range', priority: 'high' },
    { icon: '\ud83d\uddfa', title: 'Route to Charger', desc: 'Nearest fast-charger is 4.2 km away', priority: 'high' },
  ],
  'Battery Overheating': [
    { icon: '\ud83d\udd34', title: 'Thermal Alert', desc: 'Battery temp critical', priority: 'high' },
    { icon: '\ud83d\uded1', title: 'Reduce Speed Now', desc: 'Under 40 km/h to allow cooling', priority: 'high' },
    { icon: '\ud83d\udcde', title: 'Contact Service', desc: 'If temp persists above 60\u00b0C, pull over safely', priority: 'high' },
  ],
  'Charging': [
    { icon: '\u26a1', title: 'Charging Active', desc: 'Session at optimal rate', priority: 'low' },
    { icon: '\ud83d\udd0b', title: 'Precondition Battery', desc: 'Warming cells for optimal charge acceptance', priority: 'low' },
    { icon: '\ud83d\udcc5', title: 'Schedule Departure', desc: 'Set time to finish charging just-in-time', priority: 'low' },
  ],
  'Motor Fault': [
    { icon: '\ud83d\udd34', title: 'Motor Fault Detected', desc: 'Immediate service recommended', priority: 'high' },
    { icon: '\ud83d\uded1', title: 'Do Not Drive', desc: 'Vehicle should not be driven until cleared', priority: 'high' },
    { icon: '\ud83d\udcde', title: 'Emergency Service', desc: 'Contact CVIS support at 1800-CVIS-911', priority: 'high' },
  ],
}

function calcDriveScore(latest: TelemetryRow | null): { score: number; label: string } {
  if (!latest) return { score: 8.5, label: 'Excellent Performance' }
  let score = 10
  if (latest.speed_kmh > 120) score -= 1.5
  else if (latest.speed_kmh > 100) score -= 0.5
  if (latest.motor_temp_c > 85) score -= 2
  else if (latest.motor_temp_c > 70) score -= 0.8
  if (latest.battery_pct < 15) score -= 1.5
  else if (latest.battery_pct < 25) score -= 0.5
  if (latest.fault_code) score -= 3
  if (latest.mode === 'Eco') score = Math.min(10, score + 0.5)
  score = Math.max(1, Math.min(10, score))
  const label = score >= 9 ? 'Outstanding' : score >= 8 ? 'Excellent Performance' : score >= 7 ? 'Good Driver' : score >= 5 ? 'Fair \u2014 Improve Habits' : 'Poor \u2014 Check Vehicle'
  return { score: parseFloat(score.toFixed(1)), label }
}

function getTirePressures(mode: string) {
  if (mode === 'Motor Fault') return { fl: 33, fr: 34, rl: 28, rr: 33 }
  if (mode === 'Battery Overheating') return { fl: 34, fr: 35, rl: 33, rr: 34 }
  return { fl: 33, fr: 34, rl: 32, rr: 33 }
}

function LockedFeature({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, height: '100%', minHeight: 80, padding: '16px 12px', background: 'linear-gradient(135deg,rgba(0,212,255,0.03) 0%,rgba(80,40,120,0.06) 100%)', border: '1px dashed rgba(0,212,255,0.15)', borderRadius: 4, textAlign: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Lock size={12} color="rgba(0,212,255,0.5)" />
        <span style={{ fontSize: 9, fontFamily: 'Space Mono', letterSpacing: '0.15em', color: 'rgba(0,212,255,0.6)', fontWeight: 700, textTransform: 'uppercase' }}>{title}</span>
      </div>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', lineHeight: 1.5 }}>{desc}</div>
      <div style={{ padding: '4px 14px', borderRadius: 20, background: 'linear-gradient(90deg,rgba(0,212,255,0.15),rgba(120,60,200,0.15))', border: '1px solid rgba(0,212,255,0.2)', fontSize: 9, fontFamily: 'Space Mono', color: 'var(--cyan)', letterSpacing: '0.1em' }}>UPGRADE TO PRO</div>
    </div>
  )
}

function MiniBars({ pct, color }: { pct: number; color: string }) {
  const bars = 6, filled = Math.round((pct / 100) * bars)
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 24 }}>
      {Array.from({ length: bars }, (_, i) => (
        <div key={i} style={{ width: 5, height: 8 + (i / bars) * 14, borderRadius: 2, background: i < filled ? color : 'rgba(255,255,255,0.08)', boxShadow: i < filled ? `0 0 6px ${color}66` : 'none', transition: 'all 0.4s' }} />
      ))}
    </div>
  )
}

function ModeSegments({ driveMode }: { driveMode: string }) {
  const segs = [{ key: 'ECO', color: '#2ed573' }, { key: 'NORMAL', color: '#00d4ff' }, { key: 'SPORT', color: '#ffb347' }, { key: 'MAX', color: '#ff4757' }]
  const active = ['FAULT','ALERT'].includes(driveMode) ? 3 : driveMode === 'ECO' ? 0 : driveMode === 'SPORT' ? 2 : 1
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {segs.map((s, i) => (<div key={s.key} style={{ width: 26, height: 5, borderRadius: 2, background: i <= active ? s.color : 'rgba(255,255,255,0.08)', boxShadow: i === active ? `0 0 8px ${s.color}88` : 'none', transition: 'all 0.4s' }} />))}
    </div>
  )
}

function SpeedometerDial({ speed, accent }: { speed: number; accent: string }) {
  const max = 250, pct = Math.min(speed / max, 1)
  const startA = -220, totalA = 260
  const toRad = (a: number) => (a * Math.PI) / 180
  const cx = 90, cy = 90, r = 68
  const arc = (r2: number, sA: number, eA: number) => {
    const s2 = { x: cx + r2 * Math.cos(toRad(sA)), y: cy + r2 * Math.sin(toRad(sA)) }
    const e = { x: cx + r2 * Math.cos(toRad(eA)), y: cy + r2 * Math.sin(toRad(eA)) }
    return `M ${s2.x.toFixed(2)} ${s2.y.toFixed(2)} A ${r2} ${r2} 0 ${(eA - sA) > 180 ? 1 : 0} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`
  }
  const na = startA + pct * totalA
  const nx = cx + (r - 20) * Math.cos(toRad(na)), ny = cy + (r - 20) * Math.sin(toRad(na))
  const ticks = Array.from({ length: 11 }, (_, i) => {
    const a = startA + (i / 10) * totalA
    return { x1: cx + (r - 7) * Math.cos(toRad(a)), y1: cy + (r - 7) * Math.sin(toRad(a)), x2: cx + r * Math.cos(toRad(a)), y2: cy + r * Math.sin(toRad(a)), tx: cx + (r - 17) * Math.cos(toRad(a)), ty: cy + (r - 17) * Math.sin(toRad(a)), val: Math.round(i * max / 10), major: i % 5 === 0 }
  })
  return (
    <svg width={180} height={155} viewBox="0 0 180 155">
      <circle cx={cx} cy={cy} r={r + 10} fill="rgba(0,8,18,0.9)" stroke={`${accent}18`} strokeWidth={1.5} />
      <path d={arc(r, startA, startA + totalA)} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8} strokeLinecap="round" />
      <motion.path d={arc(r, startA, startA + totalA)} fill="none" stroke={accent} strokeWidth={8} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 8px ${accent}88)` }} strokeDasharray="1000" animate={{ strokeDashoffset: 1000 - pct * 445 }} initial={{ strokeDashoffset: 1000 }} transition={{ duration: 0.5, ease: 'easeOut' }} />
      {ticks.map((t, i) => (<g key={i}><line x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={t.major ? `${accent}77` : `${accent}33`} strokeWidth={t.major ? 2 : 1} />{t.major && <text x={t.tx} y={t.ty + 3} textAnchor="middle" fontSize={6.5} fill="rgba(255,255,255,0.3)" fontFamily="Space Mono">{t.val}</text>}</g>))}
      <motion.line x1={cx} y1={cy} x2={nx} y2={ny} stroke={accent} strokeWidth={2.5} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 5px ${accent})` }} animate={{ x2: nx, y2: ny }} transition={{ duration: 0.5 }} />
      <circle cx={cx} cy={cy} r={5} fill={accent} style={{ filter: `drop-shadow(0 0 8px ${accent})` }} />
      <text x={cx} y={cy + 22} textAnchor="middle" fontSize={28} fontWeight={700} fill="white" fontFamily="Space Mono">{Math.round(speed)}</text>
      <text x={cx} y={cy + 35} textAnchor="middle" fontSize={7} fill="rgba(255,255,255,0.35)" fontFamily="Space Mono">km/h</text>
    </svg>
  )
}

function DonutRing({ pct, color, label, size = 76 }: { pct: number; color: string; label: string; size?: number }) {
  const r = size / 2 - 8, circ = 2 * Math.PI * r, offset = circ * (1 - Math.min(pct / 100, 1))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={7} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={7} strokeLinecap="round" strokeDasharray={circ} animate={{ strokeDashoffset: offset }} initial={{ strokeDashoffset: circ }} transition={{ duration: 0.8, ease: 'easeOut' }} style={{ filter: `drop-shadow(0 0 6px ${color}88)` }} />
        <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700} fill="white" fontFamily="Space Mono" style={{ transform: `rotate(90deg)`, transformOrigin: `${size / 2}px ${size / 2}px` }}>{Math.round(pct)}%</text>
      </svg>
      <span style={{ fontSize: 7.5, fontFamily: 'Space Mono', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>{label}</span>
    </div>
  )
}

interface AlertItem { id: number; msg: string; type: 'warn' | 'fault' | 'info'; time: string }

interface Props { vehicleId: string; vehicleName: string; vehicleColor: string }

export default function DriverDashboard({ vehicleId, vehicleName, vehicleColor }: Props) {
  const router = useRouter()
  const [loaded, setLoaded] = useState(false)
  const [latest, setLatest] = useState<TelemetryRow | null>(null)
  const [history, setHistory] = useState<{ id: string; time: string; batt: number; speed: number; temp: number }[]>([])
  const [aiRec, setAiRec] = useState('')
  const [aiTyping, setAiTyping] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMsg, setChatMsg] = useState('')
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai'; text: string }[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [isPro, setIsPro] = useState(false)
  const [maxSpeed, setMaxSpeed] = useState(0)
  const [totalDist, setTotalDist] = useState(0)
  const alertId = useRef(0)
  const chatBottom = useRef<HTMLDivElement>(null)

  const efficiencyData = useMemo(() => Array.from({ length: 13 }, (_, i) => ({
    time: `${(i * 2).toString().padStart(2, '00')}:00`,
    efficiency: parseFloat((14 + Math.sin(i * 0.8) * 4 + Math.random() * 1.5).toFixed(1)),
    consumption: parseFloat((8 + Math.cos(i * 0.6) * 3 + Math.random() * 2).toFixed(1)),
  })), [])

  useEffect(() => {
    fetchRecent(60, vehicleId).then((rows: unknown) => {
      const data = (rows as TelemetryRow[]).slice(-40).reverse()
      setHistory(data.map((r, i) => ({ id: String(i), time: new Date(r.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), batt: r.battery_pct, speed: r.speed_kmh, temp: r.motor_temp_c })))
      if (data.length > 0) { setLatest(data[0]); setMaxSpeed(Math.max(...data.map(r => r.speed_kmh))) }
    }).catch(() => {})
  }, [vehicleId])

  const typewriterEffect = (text: string) => {
    setAiTyping(true); setAiRec('')
    let i = 0
    const iv = setInterval(() => { setAiRec(text.slice(0, i + 1)); i++; if (i >= text.length) { clearInterval(iv); setAiTyping(false) } }, 18)
  }

  const handleWs = useCallback((ev: WsEvent) => {
    if (ev.event === 'telemetry' || ev.event === 'telemetry_backfill') {
      const rows = ev.event === 'telemetry_backfill' ? (ev as { items: TelemetryRow[] }).items : [ev as unknown as TelemetryRow]
      rows.forEach((r) => {
        if (r.device_id !== vehicleId) return
        setLatest(r)
        setHistory(prev => [...prev.slice(-59), { id: r.received_at + Math.random(), time: new Date(r.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), batt: r.battery_pct, speed: r.speed_kmh, temp: r.motor_temp_c }])
        setMaxSpeed(prev => Math.max(prev, r.speed_kmh))
        setTotalDist(prev => prev + r.speed_kmh * (2 / 3600))
        if (['Motor Fault', 'Battery Overheating', 'Low Battery'].includes(r.mode)) {
          const id = ++alertId.current
          const msgs: Record<string, string> = { 'Motor Fault': `Motor fault \u2014 0x${r.fault_code.toString(16).toUpperCase()}`, 'Battery Overheating': `Batt temp critical: ${r.battery_temp_c.toFixed(0)}\u00b0C`, 'Low Battery': `Low battery: ${r.battery_pct.toFixed(0)}% \u2014 ${r.range_km.toFixed(0)}km range` }
          setAlerts(prev => [{ id, msg: msgs[r.mode] ?? r.mode, type: r.mode === 'Motor Fault' || r.mode === 'Battery Overheating' ? 'fault' : 'warn', time: new Date().toLocaleTimeString() }, ...prev.slice(0, 7)])
        }
      })
    }
    if (ev.event === 'ai_recommendation' && ev.device_id === vehicleId) typewriterEffect(ev.recommendation)
    if (ev.event === 'vehicle_ai_status' && ev.device_id === vehicleId) setIsPro(ev.enabled)
  }, [vehicleId])

  const { connected } = useWebSocket(handleWs)

  const requestRecommendation = async () => {
    if (!latest) return; setAiTyping(true)
    try { const res = await fetchRecommendation(latest.device_id) as { recommendation: string }; typewriterEffect(res.recommendation) }
    catch { setAiTyping(false) }
  }

  const handleChat = async () => {
    if (!chatMsg.trim() || !latest) return
    const msg = chatMsg.trim(); setChatMsg(''); setChatHistory(h => [...h, { role: 'user', text: msg }]); setChatLoading(true)
    try { const res = await sendChat(latest.device_id, msg) as { reply: string }; setChatHistory(h => [...h, { role: 'ai', text: res.reply }]) }
    catch (e: unknown) { setChatHistory(h => [...h, { role: 'ai', text: `Error: ${e instanceof Error ? e.message : 'AI unavailable'}` }]) }
    finally { setChatLoading(false); setTimeout(() => chatBottom.current?.scrollIntoView({ behavior: 'smooth' }), 50) }
  }

  const mode = latest?.mode ?? 'Healthy', mconf = modeOf(mode)
  const driveMode = DRIVE_MODE_LABEL[mode] ?? 'NORMAL'
  const tires = getTirePressures(mode), ds = calcDriveScore(latest)
  const keySugs = KEY_SUGGESTIONS[mode] ?? KEY_SUGGESTIONS['Healthy']
  const avgSpd = history.length > 0 ? history.reduce((a, b) => a + b.speed, 0) / history.length : 0
  const ambientTemp = latest ? Math.max(15, Math.min(40, latest.battery_temp_c - 5)) : 21
  const enginePct = mode === 'Charging' || mode === 'Motor Fault' ? 0 : mode === 'Eco' ? 55 : mode === 'Sport' ? 92 : 78
  const battPct2 = mode === 'Charging' ? 100 : mode === 'Motor Fault' ? 20 : mode === 'Eco' ? 82 : mode === 'Sport' ? 58 : 63
  const motorPct = mode === 'Motor Fault' ? 5 : mode === 'Eco' ? 35 : mode === 'Sport' ? 88 : 45
  const regenPct = mode === 'Eco' ? 85 : mode === 'Heavy Traffic' ? 72 : mode === 'Charging' ? 100 : 63
  const totalKw = mode === 'Charging' ? (latest?.charging_rate_w ?? 0) / 1000 : mode === 'Sport' ? 320 : mode === 'Eco' ? 180 : 256
  const totalHp = Math.round(totalKw * 1.341)

  const P: React.CSSProperties = { background: 'rgba(0,8,18,0.88)', border: '1px solid rgba(0,212,255,0.13)', borderRadius: 4, backdropFilter: 'blur(20px)', position: 'relative', overflow: 'hidden' }
  const L9: React.CSSProperties = { fontSize: 8.5, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.32)', fontFamily: 'Space Mono' }
  const SB: React.CSSProperties = { fontSize: 8, color: 'rgba(255,255,255,0.22)', fontFamily: 'Inter' }
  const V: React.CSSProperties = { fontFamily: 'Space Mono', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1 }

  if (!loaded) return <WireframeCarLoader onComplete={() => setLoaded(true)} message={`Initializing ${vehicleName} Console...`} />

  return (
    <>
      <CustomCursor />
      <div className="scan-line" />
      <div className="hud-grid-bg" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <div className="aurora-1" style={{ position: 'absolute', top: 0, right: '5%', width: 700, height: 700, background: `radial-gradient(circle,${mconf.glow} 0%,transparent 65%)`, borderRadius: '50%', transition: 'background 2s' }} />
        <div className="aurora-2" style={{ position: 'absolute', bottom: '5%', left: '5%', width: 500, height: 500, background: 'radial-gradient(circle,rgba(0,30,60,0.4) 0%,transparent 70%)', borderRadius: '50%' }} />
      </div>

      <main style={{ position: 'relative', zIndex: 1, paddingTop: 12, minHeight: '100vh', overflow: 'hidden' }}>
        <div style={{ maxWidth: 1580, margin: '0 auto', padding: '6px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>

          {/* HEADER */}
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => router.push('/driver')} style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--cyan)', flexShrink: 0 }}>
                <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
              </button>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="live-dot" />
                  <span style={{ fontFamily: 'Orbitron', fontSize: 19, fontWeight: 700, color: 'white', letterSpacing: '0.1em' }}>
                    LUXURY DRIVE CONSOLE <span style={{ color: vehicleColor }}>{vehicleName.toUpperCase()}</span>
                  </span>
                </div>
                <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.28)', fontFamily: 'Space Mono', letterSpacing: '0.1em', marginTop: 2 }}>
                  Advanced real-time performance &amp; vehicle interface &mdash; {vehicleId}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
              <button onClick={() => setIsPro(p => !p)} style={{ padding: '4px 11px', borderRadius: 20, cursor: 'pointer', fontSize: 7.5, fontFamily: 'Space Mono', letterSpacing: '0.1em', fontWeight: 700, background: isPro ? 'linear-gradient(90deg,rgba(0,212,255,0.18),rgba(120,60,200,0.18))' : 'rgba(255,255,255,0.04)', border: isPro ? '1px solid rgba(0,212,255,0.4)' : '1px solid rgba(255,255,255,0.1)', color: isPro ? 'var(--cyan)' : 'rgba(255,255,255,0.35)', transition: 'all 0.3s' }}>
                {isPro ? '\u2605 PRO PLAN' : '\u2606 FREE PLAN'}
              </button>
              {[
                { label: 'CONNECTED', col: connected ? '#2ed573' : '#ff4757', active: connected },
                { label: 'INTERNET', col: '#00d4ff', active: true },
                { label: `${Math.round(latest?.battery_pct ?? 0)}%`, col: latest && latest.battery_pct < 20 ? '#ff4757' : '#2ed573', active: true },
                { label: connected ? 'WS LIVE' : 'OFFLINE', col: connected ? '#2ed573' : '#ff4757', active: connected },
              ].map(pill => (<div key={pill.label} style={{ padding: '4px 11px', borderRadius: 20, background: `${pill.col}15`, border: `1px solid ${pill.col}44`, fontSize: 7.5, fontFamily: 'Space Mono', letterSpacing: '0.08em', color: pill.active ? pill.col : 'rgba(255,255,255,0.22)', transition: 'all 0.4s' }}>{pill.label}</div>))}
            </div>
          </motion.div>

          {/* ROW 1: Stat strip */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }} style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
            <div style={{ ...P, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={L9}>Battery</div>
                <div style={{ ...SB, marginBottom: 4 }}>Charge Remaining</div>
                <div style={{ ...V, fontSize: 32, color: latest && latest.battery_pct < 20 ? '#ff4757' : '#2ed573' }}>{Math.round(latest?.battery_pct ?? 0)}<span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>%</span></div>
              </div>
              <MiniBars pct={latest?.battery_pct ?? 0} color={latest && latest.battery_pct < 20 ? '#ff4757' : '#2ed573'} />
            </div>
            <div style={{ ...P, padding: '12px 14px' }}>
              <div style={L9}>Outside Temp</div>
              <div style={SB}>Ambient Conditions</div>
              <div style={{ ...V, fontSize: 32, color: 'white', marginTop: 4 }}>{Math.round(ambientTemp)}<span style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>&deg;C</span></div>
              <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.28)', fontFamily: 'Inter', marginTop: 2 }}>{ambientTemp < 18 ? 'Cool' : ambientTemp < 28 ? 'Clear Sky' : 'Warm Conditions'}</div>
            </div>
            <div style={{ ...P, padding: '12px 14px' }}>
              <div style={L9}>Drive Mode</div>
              <div style={SB}>Dynamic Performance</div>
              <div style={{ ...V, fontSize: 28, color: mconf.accent, marginTop: 4, textShadow: `0 0 20px ${mconf.accent}55` }}>{driveMode}</div>
              <div style={{ marginTop: 6 }}><ModeSegments driveMode={driveMode} /></div>
            </div>
            <div style={{ ...P, padding: '12px 14px' }}>
              <div style={L9}>Est. Range</div>
              <div style={SB}>{mode === 'Charging' ? 'Time to full charge' : 'Time to empty point'}</div>
              <div style={{ ...V, fontSize: 28, color: 'white', marginTop: 4 }}>
                {mode === 'Charging' ? `${Math.round(((100 - (latest?.battery_pct ?? 0)) / 100) * 60)} min` : latest && latest.speed_kmh > 5 ? `${Math.round((latest.range_km / latest.speed_kmh) * 60)} min` : `${Math.round(latest?.range_km ?? 0)} km`}
              </div>
              <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.28)', fontFamily: 'Space Mono', marginTop: 2 }}>{Math.round(latest?.range_km ?? 0)} km remaining</div>
            </div>
            <div style={{ ...P, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div><div style={L9}>Drive Score</div><div style={SB}>{isPro ? ds.label : 'AI Feature'}</div></div>
                <Star size={11} color={isPro ? '#ffb347' : 'rgba(255,255,255,0.15)'} fill={isPro ? '#ffb347' : 'none'} />
              </div>
              {isPro ? (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, marginTop: 4 }}>
                  <div style={{ ...V, fontSize: 30, color: ds.score >= 8 ? '#2ed573' : ds.score >= 6 ? '#ffb347' : '#ff4757' }}>{ds.score}</div>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.28)', marginBottom: 3 }}>/10</span>
                  <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', marginLeft: 4, marginBottom: 3 }}>{Array.from({ length: 5 }, (_, i) => <div key={i} style={{ width: 4, height: 6 + i * 2, background: i < Math.round(ds.score / 2) ? '#ffb347' : 'rgba(255,255,255,0.08)', borderRadius: 1 }} />)}</div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  <Lock size={10} color="rgba(255,255,255,0.22)" />
                  <span style={{ fontSize: 8.5, fontFamily: 'Space Mono', color: 'rgba(255,255,255,0.22)', letterSpacing: '0.08em' }}>PRO FEATURE</span>
                </div>
              )}
            </div>
          </motion.div>

          {/* ROW 2 */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.13 }} style={{ display: 'grid', gridTemplateColumns: '236px 1fr 218px', gap: 10, alignItems: 'start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ ...P, padding: '13px' }}>
                <div style={{ marginBottom: 8 }}><div style={L9}>Tire Pressure</div><div style={SB}>Real-time Monitoring</div></div>
                <svg width="100%" viewBox="0 0 180 78" style={{ overflow: 'visible' }}>
                  <rect x={58} y={18} width={64} height={42} rx={5} fill="none" stroke="rgba(0,212,255,0.18)" strokeWidth={1} />
                  <line x1={90} y1={18} x2={90} y2={60} stroke="rgba(0,212,255,0.08)" strokeWidth={0.5} />
                  <line x1={58} y1={39} x2={122} y2={39} stroke="rgba(0,212,255,0.08)" strokeWidth={0.5} />
                  {([{ cx: 38, cy: 20, psi: tires.fl, pos: 'FL' }, { cx: 142, cy: 20, psi: tires.fr, pos: 'FR' }, { cx: 38, cy: 58, psi: tires.rl, pos: 'RL' }, { cx: 142, cy: 58, psi: tires.rr, pos: 'RR' }] as const).map(w => {
                    const col = w.psi < 30 ? '#ff4757' : w.psi > 36 ? '#ffb347' : '#2ed573'
                    return (<g key={w.pos}><rect x={w.cx - 14} y={w.cy - 11} width={28} height={22} rx={3} fill={`${col}16`} stroke={col} strokeWidth={0.8} style={{ filter: `drop-shadow(0 0 3px ${col}55)` }} /><text x={w.cx} y={w.cy - 1} textAnchor="middle" fontSize={9} fontWeight={700} fill={col} fontFamily="Space Mono">{w.psi}</text><text x={w.cx} y={w.cy + 8} textAnchor="middle" fontSize={5.5} fill="rgba(255,255,255,0.28)" fontFamily="Space Mono">PSI</text><text x={w.cx} y={w.cy - 13} textAnchor="middle" fontSize={5} fill="rgba(255,255,255,0.22)" fontFamily="Space Mono">{w.pos}</text></g>)
                  })}
                </svg>
                <div style={{ marginTop: 8 }}>
                  <div style={{ height: 3, borderRadius: 2, background: 'linear-gradient(90deg,#ff4757 0%,#ffb347 30%,#2ed573 50%,#2ed573 70%,#ffb347 85%,#ff4757 100%)' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>{['LOW', 'NORMAL', 'HIGH'].map(l => <span key={l} style={{ fontSize: 6, fontFamily: 'Space Mono', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.08em' }}>{l}</span>)}</div>
                </div>
              </div>
              <div style={{ ...P, padding: '13px' }}>
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><BrainCircuit size={8} color={isPro ? 'var(--cyan)' : 'rgba(255,255,255,0.2)'} /><div style={L9}>Key Suggestions</div></div>
                  <div style={SB}>AI Driving Insights for Safety</div>
                </div>
                {isPro ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {keySugs.map((s, i) => (<motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 9px', background: s.priority === 'high' ? 'rgba(255,71,87,0.06)' : 'rgba(0,212,255,0.04)', border: `1px solid ${s.priority === 'high' ? 'rgba(255,71,87,0.18)' : 'rgba(0,212,255,0.09)'}`, borderRadius: 3 }}><div style={{ fontSize: 13, lineHeight: 1 }}>{s.icon}</div><div style={{ flex: 1 }}><div style={{ fontSize: 8.5, fontWeight: 700, color: s.priority === 'high' ? '#ff4757' : 'rgba(255,255,255,0.7)', letterSpacing: '0.04em' }}>{s.title}</div><div style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.28)', lineHeight: 1.4, marginTop: 1 }}>{s.desc}</div></div><ChevronRight size={8} color="rgba(255,255,255,0.18)" /></motion.div>))}
                  </div>
                ) : (<LockedFeature title="AI Key Suggestions" desc="Get real-time AI driving tips personalized to your vehicle state and road conditions." />)}
              </div>
            </div>

            <div style={{ ...P, minHeight: 290, display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '13px 16px', borderBottom: '1px solid rgba(0,212,255,0.08)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Navigation size={9} color="var(--cyan)" /><div style={L9}>Route Map</div><div style={{ ...SB, marginLeft: 4 }}>Live navigation &amp; turn-by-turn guidance</div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '20px 24px', background: 'repeating-linear-gradient(45deg,rgba(0,212,255,0.01) 0,rgba(0,212,255,0.01) 1px,transparent 1px,transparent 22px)' }}>
                <svg width="100%" height={170} viewBox="0 0 440 170" style={{ opacity: 0.16 }}>
                  {Array.from({ length: 9 }, (_, i) => <line key={`h${i}`} x1={0} y1={i * 20 + 5} x2={440} y2={i * 20 + 5} stroke="var(--cyan)" strokeWidth={0.4} />)}
                  {Array.from({ length: 16 }, (_, i) => <line key={`v${i}`} x1={i * 30} y1={0} x2={i * 30} y2={170} stroke="var(--cyan)" strokeWidth={0.4} />)}
                  <path d="M 20 140 Q 90 120 150 95 Q 210 70 280 55 Q 340 42 420 58" fill="none" stroke="var(--cyan)" strokeWidth={2.5} strokeOpacity={0.7} strokeDasharray="8 4" />
                  <circle cx={150} cy={95} r={7} fill="var(--cyan)" fillOpacity={0.85} /><circle cx={150} cy={95} r={14} fill="none" stroke="var(--cyan)" strokeOpacity={0.3} strokeWidth={1} />
                  <circle cx={420} cy={58} r={6} fill="#ffb347" fillOpacity={0.9} /><text x={380} y={48} fontSize={9} fill="#ffb347" fillOpacity={0.7} fontFamily="Space Mono">DEST</text>
                </svg>
                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 18px', background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.18)', borderRadius: 4 }}>
                    <Navigation size={11} color="var(--cyan)" /><span style={{ fontSize: 9.5, fontFamily: 'Space Mono', color: 'var(--cyan)', letterSpacing: '0.12em' }}>ROUTE MAP &mdash; COMING SOON</span>
                  </div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', fontFamily: 'Inter', lineHeight: 1.6 }}>Live navigation with turn-by-turn directions<br />will be integrated in the next release</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ ...P, padding: '13px' }}>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><AlertTriangle size={8} color="var(--amber)" /><div style={L9}>Vehicle Alerts</div></div>
                  <div style={SB}>Real-time Vehicle Health</div>
                </div>
                {alerts.length === 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {[{ icon: '\u2713', label: 'All Systems Normal', col: '#2ed573', dim: 'rgba(46,213,115,0.08)' }, { icon: '!', label: tires.rl < 30 ? 'Tire Pressure Low \u2014 Rear Left' : 'Tire Pressure OK', col: tires.rl < 30 ? '#ffb347' : '#2ed573', dim: tires.rl < 30 ? 'rgba(255,179,71,0.08)' : 'rgba(46,213,115,0.06)' }, { icon: '\u2139', label: 'Upcoming Service in 2300 km', col: '#00d4ff', dim: 'rgba(0,212,255,0.06)' }].map((a, i) => (<div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 8px', background: a.dim, borderRadius: 3, border: `1px solid ${a.col}28` }}><div style={{ width: 15, height: 15, borderRadius: '50%', background: `${a.col}22`, border: `1px solid ${a.col}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: a.col }}>{a.icon}</div><span style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.6)', fontFamily: 'Inter', lineHeight: 1.3 }}>{a.label}</span></div>))}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 160, overflowY: 'auto' }}>
                    {alerts.slice(0, 5).map(a => (<div key={a.id} style={{ padding: '6px 8px', background: a.type === 'fault' ? 'rgba(255,71,87,0.08)' : 'rgba(255,179,71,0.08)', border: `1px solid ${a.type === 'fault' ? 'rgba(255,71,87,0.22)' : 'rgba(255,179,71,0.22)'}`, borderRadius: 3 }}><div style={{ fontSize: 8.5, color: a.type === 'fault' ? '#ff4757' : '#ffb347', fontFamily: 'Space Mono', lineHeight: 1.3 }}>{a.msg}</div><div style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.22)', marginTop: 2, fontFamily: 'Space Mono' }}>{a.time}</div></div>))}
                  </div>
                )}
              </div>
              <div style={{ ...P, padding: '13px', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><BrainCircuit size={9} color="var(--cyan)" /><span style={L9}>AI Advisory</span>{aiTyping && <div className="typewriter-cursor" />}</div>
                  <button onClick={requestRecommendation} disabled={aiTyping || !latest} style={{ background: 'none', border: '1px solid rgba(0,212,255,0.18)', borderRadius: 3, padding: '2px 6px', fontSize: 7, color: 'var(--cyan)', cursor: 'pointer', letterSpacing: '0.08em', fontFamily: 'Space Mono', opacity: aiTyping ? 0.5 : 1 }}>REFRESH</button>
                </div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', lineHeight: 1.65, fontFamily: 'Inter', minHeight: 50 }}>
                  {aiRec || <span style={{ color: 'rgba(255,255,255,0.2)', fontFamily: 'Space Mono', fontSize: 8 }}>{!connected ? '\u25cc WAITING...' : 'AI STANDBY \u2014 AWAITING TELEMETRY'}</span>}
                </div>
              </div>
            </div>
          </motion.div>

          {/* ROW 3 */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.19 }} style={{ display: 'grid', gridTemplateColumns: '236px 1fr 260px', gap: 10, alignItems: 'stretch' }}>
            <div style={{ ...P, padding: '13px' }}>
              <div style={{ marginBottom: 8 }}><div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Gauge size={8} color={mconf.accent} /><div style={L9}>Speed Analytics</div></div><div style={SB}>Real-time Speed Monitor</div></div>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><SpeedometerDial speed={latest?.speed_kmh ?? 0} accent={mconf.accent} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                {[{ label: 'AVG SPEED', val: `${Math.round(avgSpd)} km/h` }, { label: 'MAX SPEED', val: `${Math.round(maxSpeed)} km/h` }, { label: 'DISTANCE', val: `${totalDist.toFixed(1)} km`, span: 2 }].map((s, i) => (<div key={i} style={{ gridColumn: (s as { span?: number }).span ? `span ${(s as { span?: number }).span}` : undefined, padding: '6px 8px', background: 'rgba(255,255,255,0.025)', borderRadius: 3, border: '1px solid rgba(255,255,255,0.05)' }}><div style={{ ...L9, fontSize: 7 }}>{s.label}</div><div style={{ ...V, fontSize: 13, color: 'white', marginTop: 2 }}>{s.val}</div></div>))}
              </div>
            </div>
            <div style={{ ...P, padding: '13px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ marginBottom: 8 }}><div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><TrendingUp size={8} color={isPro ? 'var(--cyan)' : 'rgba(255,255,255,0.18)'} /><div style={L9}>Efficiency Graph</div></div><div style={SB}>Fuel Efficiency &amp; Consumption</div></div>
              {isPro ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8, flexWrap: 'wrap' }}>
                    {[{ col: '#00d4ff', label: 'Efficiency (km/l)' }, { col: '#ffb347', label: 'Consumption (L/100km)' }].map(l => (<div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 14, height: 2, background: l.col, borderRadius: 1 }} /><span style={{ fontSize: 7.5, fontFamily: 'Space Mono', color: 'rgba(255,255,255,0.32)', letterSpacing: '0.07em' }}>{l.label}</span></div>))}
                    <div style={{ marginLeft: 'auto', fontSize: 9, fontFamily: 'Space Mono', color: mconf.accent }}>AVG {(14 + (latest?.battery_pct ?? 80) / 20).toFixed(1)} km/l</div>
                  </div>
                  <div style={{ flex: 1, minHeight: 120 }}>
                    <ResponsiveContainer width="100%" height={130}>
                      <ComposedChart data={efficiencyData} margin={{ top: 4, right: 4, left: -26, bottom: 0 }}>
                        <XAxis dataKey="time" tick={{ fontSize: 7, fill: 'rgba(255,255,255,0.25)', fontFamily: 'Space Mono' }} tickLine={false} axisLine={false} interval={2} />
                        <YAxis yAxisId="l" hide domain={[0, 30]} />
                        <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 7, fill: 'rgba(255,255,255,0.25)', fontFamily: 'Space Mono' }} tickLine={false} axisLine={false} domain={[0, 30]} />
                        <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid rgba(0,212,255,0.15)', borderRadius: 4, fontSize: 8 }} labelStyle={{ fontFamily: 'Space Mono', color: 'rgba(255,255,255,0.4)', fontSize: 7 }} />
                        <Bar yAxisId="l" dataKey="consumption" fill="rgba(255,179,71,0.35)" radius={[2, 2, 0, 0]} name="Consumption L/100km" />
                        <Line yAxisId="r" type="monotone" dataKey="efficiency" stroke="#00d4ff" strokeWidth={2} dot={false} name="Efficiency km/l" style={{ filter: 'drop-shadow(0 0 4px #00d4ff88)' }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (<div style={{ flex: 1, display: 'flex', alignItems: 'center' }}><LockedFeature title="AI Efficiency Graph" desc="Pro subscribers get hourly fuel efficiency analysis, consumption trends, and driving optimization insights." /></div>)}
            </div>
            <div style={{ ...P, padding: '13px' }}>
              <div style={{ marginBottom: 10 }}><div style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Zap size={8} color={mconf.accent} /><div style={L9}>Power Flow</div></div><div style={SB}>Real-time Power Distribution &amp; Performance</div></div>
              <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 12 }}>
                <DonutRing pct={enginePct} color="#00d4ff" label="ENGINE" size={74} />
                <DonutRing pct={battPct2} color="#2ed573" label="BATTERY" size={74} />
                <DonutRing pct={motorPct} color={mconf.accent} label="MOTOR" size={74} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[{ label: 'Power Distribution', pct: enginePct, col: '#00d4ff', grad: 'linear-gradient(90deg,#00d4ff,#2ed573)' }, { label: 'Regeneration', pct: regenPct, col: '#2ed573', grad: 'linear-gradient(90deg,#2ed573,#00d4ff88)' }].map(b => (
                  <div key={b.label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}><span style={{ ...L9, fontSize: 7.5 }}>{b.label}</span><span style={{ fontSize: 8, fontFamily: 'Space Mono', color: b.col }}>{b.pct}%</span></div>
                    <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }}><motion.div style={{ height: '100%', borderRadius: 2, background: b.grad, boxShadow: `0 0 8px ${b.col}44` }} animate={{ width: `${b.pct}%` }} transition={{ duration: 0.6 }} /></div>
                  </div>
                ))}
                <div style={{ padding: '8px 10px', marginTop: 2, background: 'rgba(255,255,255,0.025)', borderRadius: 3, border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div><div style={{ ...L9, fontSize: 7 }}>TOTAL OUTPUT</div><div style={{ ...V, fontSize: 16, color: mconf.accent, marginTop: 2 }}>{Math.round(totalKw)} <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>kW</span></div></div>
                  <div style={{ textAlign: 'right' }}><div style={{ ...L9, fontSize: 7 }}>HORSEPOWER</div><div style={{ ...V, fontSize: 16, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>{totalHp} <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>HP</span></div></div>
                </div>
              </div>
            </div>
          </motion.div>

        </div>
      </main>

      <AnimatePresence>
        {chatOpen && (
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 280, damping: 28 }} style={{ position: 'fixed', bottom: 0, right: 24, width: 380, zIndex: 200, background: 'rgba(4,8,12,0.98)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: '8px 8px 0 0', overflow: 'hidden', boxShadow: '0 -8px 40px rgba(0,212,255,0.08)' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(0,212,255,0.1)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <BrainCircuit size={12} color="var(--cyan)" />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.06em' }}>CVIS AI ASSISTANT</span>
              <div style={{ fontSize: 9, color: 'var(--text-muted)', marginLeft: 4, fontFamily: 'Space Mono' }}>{latest ? `${latest.device_id} \u00b7 ${mode}` : 'NO DATA'}</div>
              <button onClick={() => setChatOpen(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={14} /></button>
            </div>
            <div style={{ height: 280, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {chatHistory.length === 0 && <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 40, fontFamily: 'Space Mono' }}>ASK CVIS ANYTHING ABOUT YOUR VEHICLE</div>}
              {chatHistory.map((m, i) => (<div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%', padding: '8px 12px', borderRadius: m.role === 'user' ? '8px 8px 2px 8px' : '8px 8px 8px 2px', background: m.role === 'user' ? 'rgba(0,212,255,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${m.role === 'user' ? 'rgba(0,212,255,0.25)' : 'rgba(0,212,255,0.07)'}`, fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.6 }}>{m.text}</div>))}
              {chatLoading && <div style={{ alignSelf: 'flex-start', display: 'flex', gap: 5, padding: '8px 12px' }}>{[0, 1, 2].map(i => <motion.div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--cyan)' }} animate={{ y: [0, -5, 0] }} transition={{ delay: i * 0.15, repeat: Infinity, duration: 0.7 }} />)}</div>}
              <div ref={chatBottom} />
            </div>
            <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(0,212,255,0.08)', display: 'flex', gap: 8 }}>
              <input value={chatMsg} onChange={e => setChatMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleChat()} placeholder="Ask about your vehicle..." style={{ flex: 1, background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.12)', borderRadius: 4, padding: '8px 12px', color: 'var(--text-primary)', fontSize: 12, outline: 'none', fontFamily: 'Inter' }} />
              <button onClick={handleChat} disabled={chatLoading} style={{ background: 'var(--cyan)', border: 'none', borderRadius: 4, padding: '8px 12px', cursor: 'pointer', color: '#000', opacity: chatLoading ? 0.5 : 1 }}><Send size={13} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!chatOpen && (
        <motion.button whileHover={{ scale: 1.08, boxShadow: '0 4px 24px rgba(0,212,255,0.5)' }} whileTap={{ scale: 0.95 }} onClick={() => setChatOpen(true)} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.2, type: 'spring' }} style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 200, width: 48, height: 48, borderRadius: '50%', background: 'rgba(0,212,255,0.15)', border: '1px solid rgba(0,212,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(0,212,255,0.2)', backdropFilter: 'blur(12px)' }}>
          <MessageSquare size={18} color="var(--cyan)" />
        </motion.button>
      )}
    </>
  )
}
