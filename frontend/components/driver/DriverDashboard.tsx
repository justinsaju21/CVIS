'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ComposedChart, Line, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts'
import {
  BrainCircuit, AlertTriangle, MessageSquare, Send, X,
  Zap, ChevronRight, Lock, Star, TrendingUp, Navigation, Gauge,
  Thermometer, Battery, Map, Wind, Mic, MicOff, Volume2, VolumeX
} from 'lucide-react'
import dynamic from 'next/dynamic'

const LiveMap = dynamic(() => import('./LiveMap'), { ssr: false, loading: () => <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', color: 'rgba(0,0,0,0.4)' }}>Loading Map...</div> })

import WireframeCarLoader from '@/components/layout/WireframeCarLoader'
import CustomCursor from '@/components/layout/CustomCursor'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useIsMobile } from '@/hooks/useIsMobile'
import MobileDriverDashboard from './MobileDriverDashboard'
import { fetchRecent, fetchRecommendation, sendChat, fetchConfig, api } from '@/lib/api'
import type { TelemetryRow, WsEvent } from '@/lib/types'

const MODE_CONFIG: Record<string, { color: string; badge: string; glow: string; accent: string }> = {
  'Healthy': { color: '#10b981', badge: 'badge-healthy', glow: 'rgba(16,185,129,0.12)', accent: '#10b981' },
  'Eco': { color: '#10b981', badge: 'badge-healthy', glow: 'rgba(16,185,129,0.10)', accent: '#10b981' },
  'Sport': { color: '#0ea5e9', badge: 'badge-info', glow: 'rgba(14,165,233,0.15)', accent: '#0ea5e9' },
  'Heavy Traffic': { color: '#f59e0b', badge: 'badge-warning', glow: 'rgba(245,158,11,0.12)', accent: '#f59e0b' },
  'Low Battery': { color: '#f59e0b', badge: 'badge-warning', glow: 'rgba(245,158,11,0.14)', accent: '#f59e0b' },
  'Battery Overheating': { color: '#ef4444', badge: 'badge-fault', glow: 'rgba(239,68,68,0.15)', accent: '#ef4444' },
  'Charging': { color: '#0ea5e9', badge: 'badge-info', glow: 'rgba(14,165,233,0.10)', accent: '#0ea5e9' },
  'Motor Fault': { color: '#ef4444', badge: 'badge-fault', glow: 'rgba(239,68,68,0.20)', accent: '#ef4444' },
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
  if (!latest) return { score: NaN, label: 'Waiting for Telemetry...' }
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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, height: '100%', minHeight: 80, padding: '16px 12px', background: 'linear-gradient(135deg,rgba(0,0,0,0.02) 0%,rgba(0,0,0,0.05) 100%)', border: '1px dashed rgba(0,0,0,0.15)', borderRadius: 8, textAlign: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Lock size={12} color="rgba(0,0,0,0.4)" />
        <span style={{ fontSize: 9, fontFamily: 'sans-serif', letterSpacing: '0.15em', color: 'rgba(0,0,0,0.5)', fontWeight: 800, textTransform: 'uppercase' }}>{title}</span>
      </div>
      <div style={{ fontSize: 10, color: 'rgba(0,0,0,0.4)', lineHeight: 1.5 }}>{desc}</div>
      <div style={{ padding: '4px 14px', borderRadius: 20, background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.1)', fontSize: 9, fontFamily: 'sans-serif', color: 'rgba(0,0,0,0.6)', letterSpacing: '0.1em', fontWeight: 700 }}>UPGRADE TO PRO</div>
    </div>
  )
}

function MiniBars({ pct, color }: { pct: number; color: string }) {
  const bars = 6, filled = Math.round((pct / 100) * bars)
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 24 }}>
      {Array.from({ length: bars }, (_, i) => (
        <div key={i} style={{ width: 5, height: 8 + (i / bars) * 14, borderRadius: 2, background: i < filled ? color : 'rgba(0,0,0,0.12)', boxShadow: i < filled ? `0 0 6px ${color}66` : 'none', transition: 'all 0.4s' }} />
      ))}
    </div>
  )
}

function ModeSegments({ driveMode }: { driveMode: string }) {
  const segs = [{ key: 'ECO', color: '#10b981' }, { key: 'NORMAL', color: '#0ea5e9' }, { key: 'SPORT', color: '#f59e0b' }, { key: 'MAX', color: '#ef4444' }]
  const active = ['FAULT', 'ALERT'].includes(driveMode) ? 3 : driveMode === 'ECO' ? 0 : driveMode === 'SPORT' ? 2 : 1
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {segs.map((s, i) => (<div key={s.key} style={{ width: 26, height: 5, borderRadius: 2, background: i <= active ? s.color : 'rgba(0,0,0,0.12)', boxShadow: i === active ? `0 0 8px ${s.color}88` : 'none', transition: 'all 0.4s' }} />))}
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
  const nx = Number((cx + (r - 20) * Math.cos(toRad(na))).toFixed(2)), ny = Number((cy + (r - 20) * Math.sin(toRad(na))).toFixed(2))
  const ticks = Array.from({ length: 11 }, (_, i) => {
    const a = startA + (i / 10) * totalA
    return { x1: Number((cx + (r - 7) * Math.cos(toRad(a))).toFixed(2)), y1: Number((cy + (r - 7) * Math.sin(toRad(a))).toFixed(2)), x2: Number((cx + r * Math.cos(toRad(a))).toFixed(2)), y2: Number((cy + r * Math.sin(toRad(a))).toFixed(2)), tx: Number((cx + (r - 17) * Math.cos(toRad(a))).toFixed(2)), ty: Number((cy + (r - 17) * Math.sin(toRad(a))).toFixed(2)), val: Math.round(i * max / 10), major: i % 5 === 0 }
  })
  return (
    <svg width={180} height={155} viewBox="0 0 180 155">
      <circle cx={cx} cy={cy} r={r + 10} fill="#ffffff" stroke={`rgba(0,0,0,0.06)`} strokeWidth={1.5} style={{ filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.05))' }} />
      <path d={arc(r, startA, startA + totalA)} fill="none" stroke="rgba(0,0,0,0.09)" strokeWidth={8} strokeLinecap="round" />
      <motion.path d={arc(r, startA, startA + totalA)} fill="none" stroke={accent} strokeWidth={8} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 8px ${accent}88)` }} strokeDasharray="1000" animate={{ strokeDashoffset: 1000 - pct * 445 }} initial={{ strokeDashoffset: 1000 }} transition={{ duration: 0.5, ease: 'easeOut' }} />
      {ticks.map((t, i) => (<g key={i}><line x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={t.major ? `${accent}77` : `${accent}33`} strokeWidth={t.major ? 2 : 1} />{t.major && <text x={t.tx} y={t.ty + 3} textAnchor="middle" fontSize={6.5} fill="rgba(0,0,0,0.45)" fontFamily="sans-serif">{t.val}</text>}</g>))}
      <motion.line x1={cx} y1={cy} x2={nx} y2={ny} stroke={accent} strokeWidth={2.5} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 5px ${accent})` }} animate={{ x2: nx, y2: ny }} transition={{ duration: 0.5 }} />
      <circle cx={cx} cy={cy} r={5} fill={accent} style={{ filter: `drop-shadow(0 0 8px ${accent})` }} />
      <text x={cx} y={cy + 22} textAnchor="middle" fontSize={28} fontWeight={700} fill="#0f172a" fontFamily="sans-serif">{Math.round(speed)}</text>
      <text x={cx} y={cy + 35} textAnchor="middle" fontSize={7} fill="rgba(0,0,0,0.52)" fontFamily="sans-serif">km/h</text>
    </svg>
  )
}

function DonutRing({ pct, color, label, size = 76 }: { pct: number; color: string; label: string; size?: number }) {
  const r = size / 2 - 8, circ = 2 * Math.PI * r, offset = circ * (1 - Math.min(pct / 100, 1))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.09)" strokeWidth={7} />
        <motion.circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={7} strokeLinecap="round" strokeDasharray={circ} animate={{ strokeDashoffset: offset }} initial={{ strokeDashoffset: circ }} transition={{ duration: 0.8, ease: 'easeOut' }} style={{ filter: `drop-shadow(0 0 6px ${color}88)` }} />
        <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700} fill="#0f172a" fontFamily="sans-serif" style={{ transform: `rotate(90deg)`, transformOrigin: `${size / 2}px ${size / 2}px` }}>{Math.round(pct)}%</text>
      </svg>
      <span style={{ fontSize: 7.5, fontFamily: 'sans-serif', letterSpacing: '0.12em', color: 'rgba(0,0,0,0.52)', textTransform: 'uppercase' }}>{label}</span>
    </div>
  )
}

// ─── Stat Card (click opens modal) ───────────────────────────────────────────
function StatCard({
  title, subtitle, icon, value, valueColor, accent = '#0ea5e9', onClick, P, L9, SB, V
}: {
  title: string; subtitle: string; icon: React.ReactNode
  value: React.ReactNode; valueColor?: string; accent?: string
  onClick: () => void
  P: React.CSSProperties; L9: React.CSSProperties; SB: React.CSSProperties; V: React.CSSProperties
}) {
  return (
    <motion.div
      initial="rest"
      whileHover="hover"
      whileTap="tap"
      variants={{
        rest: { scale: 1, y: 0, boxShadow: '0 4px 12px rgba(0,0,0,0.03)' },
        hover: { scale: 1.02, y: -4, boxShadow: '0 16px 32px rgba(0,0,0,0.08)' },
        tap: { scale: 0.98, y: 0 }
      }}
      style={{ ...P, cursor: 'pointer', position: 'relative', borderBottom: `3px solid ${accent}` }}
      onClick={onClick}
    >
      <div style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${accent}15`, boxShadow: `inset 0 0 0 1px ${accent}22`, transform: 'scale(1.2)' }}>
            {icon}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span style={L9}>{title}</span>
            <span style={SB}>{subtitle}</span>
          </div>
          <motion.div variants={{ rest: { x: 0, opacity: 0.4 }, hover: { x: 4, opacity: 1 } }} style={{ marginLeft: 'auto' }}>
            <ChevronRight size={14} color={accent} />
          </motion.div>
        </div>
        <div style={{ ...V, fontSize: 34, color: valueColor ?? '#0f172a' }}>{value}</div>
      </div>
    </motion.div>
  )
}

// ─── Formatted AI Text Component ───────────────────────────────────────────
function FormattedAiText({ text }: { text: string }) {
  if (!text) return null
  const parts = text.split(/(\*\*.*?\*\*)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} style={{ color: '#0f172a', fontWeight: 700 }}>
              {part.slice(2, -2)}
            </strong>
          )
        }
        return <span key={i} style={{ color: '#334155' }}>{part}</span>
      })}
    </>
  )
}

// ─── Card Modal (fixed top-centered overlay) ─────────────────────────────────
function CardModal({ title, icon, accent = '#0ea5e9', onClose, children }: {
  title: string; icon: React.ReactNode; accent?: string
  onClose: () => void; children: React.ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: 'max(80px, 10vh)', paddingLeft: 24, paddingRight: 24, paddingBottom: 24,
        background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(8px)',
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 16, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, y: 16, opacity: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 500,
          background: '#ffffff',
          border: `1px solid rgba(0,0,0,0.12)`,
          borderRadius: 12,
          boxShadow: `0 24px 60px rgba(0,0,0,0.2), 0 0 20px rgba(0,0,0,0.05)`,
          overflow: 'hidden',
        }}
      >
        <div style={{
          padding: '16px 20px', borderBottom: `1px solid ${accent}22`,
          display: 'flex', alignItems: 'center', gap: 10, background: `${accent}0a`,
        }}>
          {icon}
          <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', letterSpacing: '0.08em', fontFamily: 'sans-serif' }}>
            {title}
          </span>
          <button onClick={onClose} style={{
            marginLeft: 'auto', background: 'none', border: 'none',
            color: 'rgba(0,0,0,0.5)', cursor: 'pointer', lineHeight: 1,
          }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: '20px', maxHeight: '75vh', overflowY: 'auto' }}>
          {children}
        </div>
      </motion.div>
    </motion.div>
  )
}

interface AlertItem { id: number; msg: string; type: 'warn' | 'fault' | 'info'; time: string }

interface Props { vehicleId: string; vehicleName: string; vehicleColor: string; forceMobile?: boolean }

export default function DriverDashboard({ vehicleId, vehicleName, vehicleColor, forceMobile }: Props) {
  const router = useRouter()
  const isMobile = useIsMobile() || forceMobile
  const [latest, setLatest] = useState<TelemetryRow | null>(null)
  const [history, setHistory] = useState<{ id: string; time: string; batt: number; speed: number; temp: number }[]>([])
  const [aiRec, setAiRec] = useState('')
  const [aiTyping, setAiTyping] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatMsg, setChatMsg] = useState('')
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai'; text: string }[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [isPro, setIsPro] = useState(false)
  const [maxSpeed, setMaxSpeed] = useState(0)
  const [totalDist, setTotalDist] = useState(0)
  const [openCard, setOpenCard] = useState<string | null>(null)
  const alertId = useRef(0)
  const chatBottom = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  const typewriterTimer = useRef<NodeJS.Timeout | null>(null)
  const lastRecRef = useRef<string>('')
  const voiceTriggered = useRef(false)
  const femaleVoiceRef = useRef<SpeechSynthesisVoice | null>(null)

  const efficiencyData = useMemo(() => Array.from({ length: 13 }, (_, i) => ({
    time: `${(i * 2).toString().padStart(2, '00')}:00`,
    efficiency: parseFloat((14 + Math.sin(i * 0.8) * 4 + Math.random() * 1.5).toFixed(1)),
    consumption: parseFloat((8 + Math.cos(i * 0.6) * 3 + Math.random() * 2).toFixed(1)),
  })), [])

  // ─── Resolve & cache female TTS voice once ──────────────────────────────
  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    const FEMALE_PRIORITY = [
      'Google UK English Female',
      'Google US English',
      'Samantha',
      'Karen',
      'Moira',
      'Tessa',
      'Veena',
      'Fiona',
    ]
    const pickFemaleVoice = () => {
      const voices = window.speechSynthesis.getVoices()
      if (!voices.length) return
      // Try priority list first
      for (const name of FEMALE_PRIORITY) {
        const v = voices.find(x => x.name === name)
        if (v) { femaleVoiceRef.current = v; return }
      }
      // Fallback: any voice whose name contains 'female' (case-insensitive)
      const fallback = voices.find(v => v.name.toLowerCase().includes('female'))
      if (fallback) { femaleVoiceRef.current = fallback; return }
      // Last resort: first en voice
      const en = voices.find(v => v.lang.startsWith('en'))
      if (en) femaleVoiceRef.current = en
    }
    pickFemaleVoice()
    // Voices may load asynchronously in Chrome
    window.speechSynthesis.onvoiceschanged = pickFemaleVoice
    return () => { window.speechSynthesis.onvoiceschanged = null }
  }, [])

  useEffect(() => {
    fetchRecent(60, vehicleId).then((rows: unknown) => {
      const data = (rows as TelemetryRow[]).slice(-40).reverse()
      setHistory(data.map((r, i) => ({ id: String(i), time: new Date(r.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), batt: r.battery_pct, speed: r.speed_kmh, temp: r.motor_temp_c })))
      if (data.length > 0) { setLatest(data[0]); setMaxSpeed(Math.max(...data.map(r => r.speed_kmh))) }
    }).catch(() => { })
    fetchConfig().then((cfg: any) => {
      setIsPro(cfg.ai_service_enabled === true)
    }).catch(() => { })

    return () => {
      if (typewriterTimer.current) clearInterval(typewriterTimer.current)
    }
  }, [vehicleId])

  const typewriterEffect = useCallback((text: string) => {
    if (typewriterTimer.current) clearInterval(typewriterTimer.current)
    if (!text) {
      setAiRec('')
      setAiTyping(false)
      lastRecRef.current = ''
      return
    }
    if (lastRecRef.current === text) {
      setAiRec(text)
      setAiTyping(false)
      return
    }
    lastRecRef.current = text
    setAiTyping(true)
    let i = 0
    const step = 3
    typewriterTimer.current = setInterval(() => {
      i += step
      setAiRec(text.slice(0, i))
      if (i >= text.length) {
        if (typewriterTimer.current) clearInterval(typewriterTimer.current)
        setAiTyping(false)
      }
    }, 24)
  }, [])

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

          setAlerts(prev => {
            if (prev.length > 0 && prev[0].msg.startsWith(msgs[r.mode].split(':')[0])) return prev;
            return [{ id, msg: msgs[r.mode] ?? r.mode, type: r.mode === 'Motor Fault' || r.mode === 'Battery Overheating' ? 'fault' : 'warn', time: new Date().toLocaleTimeString() }, ...prev.slice(0, 7)]
          })
        } else {
          setAlerts([])
        }
      })
    }
    if (ev.event === 'ai_recommendation' && ev.device_id === vehicleId && ev.recommendation) typewriterEffect(ev.recommendation)
    if (ev.event === 'vehicle_ai_status' && ev.device_id === vehicleId) setIsPro(ev.enabled)
    if (ev.event === 'ai_service_status') setIsPro(ev.enabled as boolean)
  }, [vehicleId, typewriterEffect])

  const { connected } = useWebSocket(handleWs)

  const requestRecommendation = async () => {
    if (!latest) return; setAiTyping(true)
    try { const res = await fetchRecommendation(latest.device_id) as { recommendation: string }; typewriterEffect(res.recommendation) }
    catch { setAiTyping(false) }
  }

  // ─── TTS helpers ───────────────────────────────────────────────────────────
  const speakText = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    // Strip markdown bold markers for cleaner speech
    const clean = text.replace(/\*\*(.*?)\*\*/g, '$1')
    const utt = new SpeechSynthesisUtterance(clean)
    utt.rate = 1.0
    utt.pitch = 1.05   // slightly higher pitch reinforces female tone
    utt.volume = 1.0
    // Always use the pre-resolved female voice
    if (femaleVoiceRef.current) utt.voice = femaleVoiceRef.current
    utt.onstart = () => setIsSpeaking(true)
    utt.onend = () => setIsSpeaking(false)
    utt.onerror = () => setIsSpeaking(false)
    window.speechSynthesis.speak(utt)
  }, [])

  const stopSpeaking = useCallback(() => {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    setIsSpeaking(false)
  }, [])

  const handleChat = async (useVoice = false) => {
    if (!chatMsg.trim() || !latest) return
    const msg = chatMsg.trim()
    const shouldSpeak = useVoice || voiceTriggered.current
    voiceTriggered.current = false
    setChatMsg('')
    setChatHistory(h => [...h, { role: 'user', text: msg }])
    setChatLoading(true)
    try {
      const res = await sendChat(latest.device_id, msg) as { reply: string }
      setChatHistory(h => [...h, { role: 'ai', text: res.reply }])
      if (shouldSpeak) speakText(res.reply)
    } catch (e: unknown) {
      setChatHistory(h => [...h, { role: 'ai', text: `Error: ${e instanceof Error ? e.message : 'AI unavailable'}` }])
    } finally {
      setChatLoading(false)
      setTimeout(() => chatBottom.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }

  const toggleListening = () => {
    if (isListening) {
      setIsListening(false)
      if (recognitionRef.current) recognitionRef.current.stop()
      return
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert("Voice recognition is not supported in this browser.")
      return
    }

    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      alert("Note: Voice recognition usually requires HTTPS or localhost. If it fails, this is a browser security restriction.")
    }

    // Stop any ongoing TTS before listening
    stopSpeaking()

    try {
      const recognition = new SpeechRecognition()
      recognitionRef.current = recognition
      recognition.continuous = false
      recognition.interimResults = true

      const initialInput = chatMsg.trim()
      let finalTranscript = ''

      recognition.onstart = () => setIsListening(true)
      recognition.onresult = (event: any) => {
        let currentTranscript = ''
        for (let i = 0; i < event.results.length; i++) {
          currentTranscript += event.results[i][0].transcript
          if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript
        }
        setChatMsg(initialInput ? `${initialInput} ${currentTranscript}` : currentTranscript)
      }
      recognition.onerror = (e: any) => {
        if (e.error !== 'no-speech') {
          console.error("Speech recognition error:", e.error || e)
        }
        setIsListening(false)
        voiceTriggered.current = false
      }
      recognition.onend = () => {
        setIsListening(false)
        // Auto-submit if we captured something via voice
        const captured = finalTranscript.trim() || (initialInput ? '' : '')
        if (captured || (!initialInput && finalTranscript.trim())) {
          // Use a slight delay so setChatMsg has flushed
          setTimeout(() => {
            voiceTriggered.current = true
            // Programmatically trigger submit by calling handleChat with the transcript
            if (!latest) return
            const msg = (initialInput ? `${initialInput} ${finalTranscript}` : finalTranscript).trim()
            if (!msg) { voiceTriggered.current = false; return }
            setChatMsg('')
            setChatHistory(h => [...h, { role: 'user', text: msg }])
            setChatLoading(true)
            sendChat(latest.device_id, msg)
              .then((res: any) => {
                setChatHistory(h => [...h, { role: 'ai', text: res.reply }])
                speakText(res.reply)
              })
              .catch((e: unknown) => {
                setChatHistory(h => [...h, { role: 'ai', text: `Error: ${e instanceof Error ? e.message : 'AI unavailable'}` }])
              })
              .finally(() => {
                setChatLoading(false)
                voiceTriggered.current = false
                setTimeout(() => chatBottom.current?.scrollIntoView({ behavior: 'smooth' }), 50)
              })
          }, 80)
        }
      }

      recognition.start()
    } catch (e) {
      console.error(e)
      alert("Failed to start microphone. Please check permissions.")
      setIsListening(false)
    }
  }

  const mode = latest?.mode ?? 'Healthy', mconf = modeOf(mode)
  const driveMode = DRIVE_MODE_LABEL[mode] ?? 'NORMAL'
  const tires = getTirePressures(mode), ds = calcDriveScore(latest)
  const keySugs = KEY_SUGGESTIONS[mode] ?? KEY_SUGGESTIONS['Healthy']
  const avgSpd = history.length > 0 ? history.reduce((a, b) => a + b.speed, 0) / history.length : 0
  const ambientTemp = latest ? Math.max(15, Math.min(40, latest.battery_temp_c - 5)) : NaN
  const enginePct = mode === 'Charging' || mode === 'Motor Fault' ? 0 : mode === 'Eco' ? 55 : mode === 'Sport' ? 92 : 78
  const battPct2 = mode === 'Charging' ? 100 : mode === 'Motor Fault' ? 20 : mode === 'Eco' ? 82 : mode === 'Sport' ? 58 : 63
  const motorPct = mode === 'Motor Fault' ? 5 : mode === 'Eco' ? 35 : mode === 'Sport' ? 88 : 45
  const regenPct = mode === 'Eco' ? 85 : mode === 'Heavy Traffic' ? 72 : mode === 'Charging' ? 100 : 63
  const totalKw = latest ? (mode === 'Charging' ? (latest?.charging_rate_w ?? 0) / 1000 : mode === 'Sport' ? 320 : mode === 'Eco' ? 180 : 256) : NaN
  const totalHp = latest ? Math.round(totalKw * 1.341) : NaN

  // ─── Mobile: render compact app-style layout (same state, same WebSocket) ─
  if (isMobile) {
    return (
      <MobileDriverDashboard
        vehicleId={vehicleId}
        vehicleName={vehicleName}
        vehicleColor={vehicleColor}
        latest={latest}
        history={history}
        aiRec={aiRec}
        aiTyping={aiTyping}
        requestRecommendation={requestRecommendation}
        alerts={alerts}
        connected={connected}
        isPro={isPro}
        mode={mode}
        modeColor={mconf.color}
        modeAccent={mconf.accent}
        driveMode={driveMode}
        driveScore={ds}
        ambientTemp={ambientTemp}
        tires={tires}
        totalKw={totalKw}
        chatOpen={chatOpen}
        setChatOpen={setChatOpen}
        chatMsg={chatMsg}
        setChatMsg={setChatMsg}
        chatHistory={chatHistory}
        chatLoading={chatLoading}
        handleChat={handleChat}
      />
    )
  }

  const P: React.CSSProperties = { background: '#f1f5f9', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', borderRadius: 10, position: 'relative', overflow: 'hidden' }
  const L9: React.CSSProperties = { fontSize: 11, fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.7)', fontFamily: 'sans-serif' }
  const SB: React.CSSProperties = { fontSize: 12, color: 'rgba(0,0,0,0.5)', fontFamily: 'sans-serif' }
  const V: React.CSSProperties = { fontFamily: 'sans-serif', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1 }

  const handleForceMode = async (m: string | null) => {
    try {
      await api.post('/api/v1/config/mode', { mode: m })
    } catch (e) { }
  };

  return (
    <>
      <CustomCursor />

      <main style={{ position: 'relative', zIndex: 1, paddingTop: 16, paddingBottom: 32, minHeight: '100vh', overflow: 'hidden' }}>
        <div style={{ maxWidth: 1720, margin: '0 auto', padding: '16px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* HEADER */}
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => router.push('/driver')} style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(14,165,233,0.05)', border: '1px solid rgba(14,165,233,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--cyan)', flexShrink: 0 }}>
                <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
              </button>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="live-dot" />
                  <span style={{ fontFamily: 'sans-serif', fontSize: 19, fontWeight: 700, color: '#0f172a', letterSpacing: '0.1em' }}>
                    LUXURY DRIVE CONSOLE <span style={{ color: vehicleColor }}>{vehicleName.toUpperCase()}</span>
                  </span>
                </div>
                <div style={{ fontSize: 8.5, color: 'rgba(0,0,0,0.42)', fontFamily: 'sans-serif', letterSpacing: '0.1em', marginTop: 2 }}>
                  Advanced real-time performance &amp; vehicle interface &mdash; {vehicleId}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
              <button onClick={() => setIsPro(p => !p)} style={{ padding: '4px 11px', borderRadius: 20, cursor: 'pointer', fontSize: 7.5, fontFamily: 'sans-serif', letterSpacing: '0.1em', fontWeight: 700, background: isPro ? 'linear-gradient(90deg,rgba(14,165,233,0.18),rgba(120,60,200,0.18))' : 'rgba(0,0,0,0.06)', border: isPro ? '1px solid rgba(14,165,233,0.4)' : '1px solid rgba(0,0,0,0.15)', color: isPro ? 'var(--cyan)' : 'rgba(0,0,0,0.52)', transition: 'all 0.3s' }}>
                {isPro ? '\u2605 PRO PLAN' : '\u2606 FREE PLAN'}
              </button>
              {[
                { label: 'CONNECTED', col: connected ? '#10b981' : '#ef4444', active: connected },
                { label: 'INTERNET', col: '#0ea5e9', active: true },
                { label: `${Math.round(latest?.battery_pct ?? 0)}%`, col: latest && latest.battery_pct < 20 ? '#ef4444' : '#10b981', active: true },
                { label: connected ? 'WS LIVE' : 'OFFLINE', col: connected ? '#10b981' : '#ef4444', active: connected },
              ].map(pill => (<div key={pill.label} style={{ padding: '4px 11px', borderRadius: 20, background: `${pill.col}15`, border: `1px solid ${pill.col}44`, fontSize: 7.5, fontFamily: 'sans-serif', letterSpacing: '0.08em', color: pill.active ? pill.col : 'rgba(0,0,0,0.33)', transition: 'all 0.4s' }}>{pill.label}</div>))}
            </div>
          </motion.div>

          {/* ROW 1: Stat Cards — click any to open detail modal */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }} style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 16 }}>

            <StatCard title="Battery" subtitle="Charge Remaining"
              icon={<Battery size={10} color={latest && latest.battery_pct < 20 ? '#ef4444' : '#10b981'} />}
              value={<>{Math.round(latest?.battery_pct ?? 0)}<span style={{ fontSize: 13, color: 'rgba(0,0,0,0.52)', fontWeight: 400 }}>%</span></>}
              valueColor={latest && latest.battery_pct < 20 ? '#ef4444' : '#10b981'} accent="#10b981"
              onClick={() => setOpenCard('battery')} P={P} L9={L9} SB={SB} V={V} />

            <StatCard title="Outside Temp" subtitle="Ambient Conditions"
              icon={<Thermometer size={10} color="#0ea5e9" />}
              value={<>{Math.round(ambientTemp)}<span style={{ fontSize: 13, color: 'rgba(0,0,0,0.52)', fontWeight: 400 }}>°C</span></>}
              accent="#0ea5e9"
              onClick={() => setOpenCard('temp')} P={P} L9={L9} SB={SB} V={V} />

            <StatCard title="Drive Mode" subtitle="Dynamic Performance"
              icon={<Gauge size={10} color={mconf.accent} />}
              value={<span style={{ fontSize: 20, textShadow: `0 0 16px ${mconf.accent}77` }}>{driveMode}</span>}
              valueColor={mconf.accent} accent={mconf.accent}
              onClick={() => setOpenCard('mode')} P={P} L9={L9} SB={SB} V={V} />

            <StatCard title="Est. Range" subtitle={mode === 'Charging' ? 'Time to full' : 'Distance left'}
              icon={<Map size={10} color="#0ea5e9" />}
              value={mode === 'Charging'
                ? <>{Math.round(((100 - (latest?.battery_pct ?? 0)) / 100) * 60)}<span style={{ fontSize: 13, color: 'rgba(0,0,0,0.52)', fontWeight: 400 }}> min</span></>
                : <>{Math.round(latest?.range_km ?? 0)}<span style={{ fontSize: 13, color: 'rgba(0,0,0,0.52)', fontWeight: 400 }}> km</span></>}
              accent="#0ea5e9"
              onClick={() => setOpenCard('range')} P={P} L9={L9} SB={SB} V={V} />

            <StatCard title="Drive Score" subtitle={isPro ? ds.label : 'AI Feature — Pro'}
              icon={<Star size={10} color={isPro ? '#f59e0b' : 'rgba(0,0,0,0.30)'} fill={isPro ? '#f59e0b' : 'none'} />}
              value={isPro ? <>{ds.score}<span style={{ fontSize: 13, color: 'rgba(0,0,0,0.52)', fontWeight: 400 }}>/10</span></> : <Lock size={16} color="rgba(0,0,0,0.30)" />}
              valueColor={isPro ? (ds.score >= 8 ? '#10b981' : ds.score >= 6 ? '#f59e0b' : '#ef4444') : undefined} accent="#f59e0b"
              onClick={() => setOpenCard('score')} P={P} L9={L9} SB={SB} V={V} />

          </motion.div>

          {/* Card Modals */}
          <AnimatePresence>
            {openCard === 'battery' && (
              <CardModal title="Battery Details" icon={<Battery size={14} color="#10b981" />} accent="#10b981" onClose={() => setOpenCard(null)}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 48, fontWeight: 700, color: latest && latest.battery_pct < 20 ? '#ef4444' : '#10b981', fontFamily: 'sans-serif' }}>{Math.round(latest?.battery_pct ?? 0)}<span style={{ fontSize: 20, color: 'rgba(0,0,0,0.60)', fontWeight: 400 }}>%</span></span>
                    <MiniBars pct={latest?.battery_pct ?? 0} color={latest && latest.battery_pct < 20 ? '#ef4444' : '#10b981'} />
                  </div>
                  <div style={{ height: 8, borderRadius: 4, background: 'rgba(0,0,0,0.11)', overflow: 'hidden' }}>
                    <motion.div style={{ height: '100%', borderRadius: 4, background: latest && latest.battery_pct < 20 ? '#ef4444' : 'linear-gradient(90deg,#10b981,#0ea5e9)' }} animate={{ width: `${latest?.battery_pct ?? 0}%` }} transition={{ duration: 0.8 }} />
                  </div>
                  {[{ label: 'Voltage', val: (latest?.battery_pct ?? 80) > 50 ? '402V' : '387V', col: '#0f172a' }, { label: 'Battery Temp', val: `${Math.round(latest?.battery_temp_c ?? 28)}°C`, col: latest && latest.battery_temp_c > 50 ? '#ef4444' : '#10b981' }, { label: 'Charge Rate', val: mode === 'Charging' ? `${((latest?.charging_rate_w ?? 11000) / 1000).toFixed(1)} kW` : '— Not Charging', col: mode === 'Charging' ? '#0ea5e9' : 'rgba(0,0,0,0.60)' }, { label: 'State', val: mode === 'Charging' ? 'Charging' : mode === 'Low Battery' ? 'Critical' : 'Discharging', col: mode === 'Charging' ? '#10b981' : mode === 'Low Battery' ? '#ef4444' : '#0f172a' }].map(r => (
                    <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(0,0,0,0.04)', borderRadius: 6, border: '1px solid rgba(0,0,0,0.09)' }}>
                      <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.60)', fontFamily: 'sans-serif' }}>{r.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: r.col, fontFamily: 'sans-serif' }}>{r.val}</span>
                    </div>
                  ))}
                </div>
              </CardModal>
            )}
            {openCard === 'temp' && (
              <CardModal title="Ambient Conditions" icon={<Thermometer size={14} color="#0ea5e9" />} accent="#0ea5e9" onClose={() => setOpenCard(null)}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ textAlign: 'center', fontSize: 52, fontWeight: 700, color: '#0f172a', fontFamily: 'sans-serif' }}>{Math.round(ambientTemp)}<span style={{ fontSize: 22, color: 'rgba(0,0,0,0.60)', fontWeight: 400 }}>°C</span></div>
                  <div style={{ textAlign: 'center', fontSize: 14, color: '#0ea5e9', fontFamily: 'sans-serif', marginTop: -8 }}>{ambientTemp < 18 ? '❄️ Cool — Range +3%' : ambientTemp < 28 ? '☀️ Clear Sky — Optimal' : '🔥 Warm — Range -2%'}</div>
                  {[{ label: 'Feels Like', val: `${Math.round(ambientTemp - 2)}°C` }, { label: 'Cabin Temp', val: `${Math.round(ambientTemp + 4)}°C` }, { label: 'Range Impact', val: ambientTemp < 18 ? '+3%' : ambientTemp < 28 ? 'Neutral' : '-2%' }, { label: 'HVAC Load', val: ambientTemp > 28 ? 'High' : ambientTemp > 18 ? 'Moderate' : 'Low' }, { label: 'Dew Point', val: `${Math.round(ambientTemp - 6)}°C` }].map(r => (
                    <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(0,0,0,0.04)', borderRadius: 6, border: '1px solid rgba(0,0,0,0.09)' }}>
                      <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.60)', fontFamily: 'sans-serif' }}>{r.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', fontFamily: 'sans-serif' }}>{r.val}</span>
                    </div>
                  ))}
                </div>
              </CardModal>
            )}
            {openCard === 'mode' && (
              <CardModal title="Drive Mode" icon={<Gauge size={14} color={mconf.accent} />} accent={mconf.accent} onClose={() => setOpenCard(null)}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 36, fontWeight: 700, color: mconf.accent, fontFamily: 'sans-serif', textShadow: `0 0 30px ${mconf.accent}66` }}>{mode}</div>
                    <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.52)', fontFamily: 'sans-serif', marginTop: 4 }}>ESP32 Simulated Mode</div>
                    <div style={{ marginTop: 10 }}><ModeSegments driveMode={driveMode} /></div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {(['Healthy', 'Eco', 'Sport', 'Heavy Traffic', 'Low Battery', 'Battery Overheating', 'Charging', 'Motor Fault'] as const).map(m => {
                      const isSelectable = ['Healthy', 'Eco', 'Sport', 'Heavy Traffic'].includes(m);
                      return isSelectable ? (
                        <button key={m} onClick={() => handleForceMode(m)} style={{ cursor: 'pointer', padding: '10px 12px', borderRadius: 6, background: mode === m ? `${modeOf(m).color}18` : 'rgba(0,0,0,0.04)', border: `1px solid ${mode === m ? modeOf(m).color + '55' : 'rgba(0,0,0,0.11)'}`, fontSize: 11, fontFamily: 'sans-serif', color: mode === m ? modeOf(m).color : 'rgba(0,0,0,0.52)', textAlign: 'center', fontWeight: mode === m ? 700 : 400 }}>
                          {m}
                        </button>
                      ) : (
                        <div key={m} style={{ padding: '10px 12px', borderRadius: 6, background: mode === m ? `${modeOf(m).color}18` : 'rgba(0,0,0,0.02)', border: `1px dashed ${mode === m ? modeOf(m).color + '55' : 'rgba(0,0,0,0.08)'}`, fontSize: 11, fontFamily: 'sans-serif', color: mode === m ? modeOf(m).color : 'rgba(0,0,0,0.3)', textAlign: 'center', fontWeight: mode === m ? 700 : 400, opacity: mode === m ? 1 : 0.6 }}>
                          {m} {mode === m && '⚠️'}
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: -4 }}>
                    <button onClick={() => handleForceMode(null)} style={{ cursor: 'pointer', fontSize: 10, color: '#0ea5e9', background: 'transparent', border: 'none', textDecoration: 'underline' }}>
                      Resume Auto-Cycle
                    </button>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(0,0,0,0.04)', borderRadius: 6, border: '1px solid rgba(0,0,0,0.09)' }}>
                    <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.60)', fontFamily: 'sans-serif' }}>Fault Code</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: latest?.fault_code ? '#ef4444' : '#10b981', fontFamily: 'sans-serif' }}>{latest?.fault_code ? `0x${latest.fault_code.toString(16).toUpperCase()}` : 'NONE'}</span>
                  </div>
                </div>
              </CardModal>
            )}
            {openCard === 'range' && (
              <CardModal title="Range & Navigation" icon={<Map size={14} color="#0ea5e9" />} accent="#0ea5e9" onClose={() => setOpenCard(null)}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ textAlign: 'center', fontSize: 52, fontWeight: 700, color: '#0f172a', fontFamily: 'sans-serif' }}>{Math.round(latest?.range_km ?? 0)}<span style={{ fontSize: 20, color: 'rgba(0,0,0,0.60)', fontWeight: 400 }}> km</span></div>
                  <div style={{ height: 8, borderRadius: 4, background: 'rgba(0,0,0,0.11)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, (latest?.range_km ?? 0) / 5)}%`, background: 'linear-gradient(90deg,#ef4444,#f59e0b,#10b981)', borderRadius: 4 }} />
                  </div>
                  {[{ label: 'Current Speed', val: `${Math.round(latest?.speed_kmh ?? 0)} km/h` }, { label: 'ETA at Speed', val: latest && latest.speed_kmh > 5 ? `${Math.round((latest.range_km / latest.speed_kmh) * 60)} min` : '—' }, { label: 'Consumption', val: `${mode === 'Eco' ? '14.2' : mode === 'Sport' ? '22.8' : '17.5'} kWh/100km` }, { label: 'Charging ETA', val: mode === 'Charging' ? `${Math.round(((100 - (latest?.battery_pct ?? 0)) / 100) * 60)} min to full` : 'Not Charging' }].map(r => (
                    <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(0,0,0,0.04)', borderRadius: 6, border: '1px solid rgba(0,0,0,0.09)' }}>
                      <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.60)', fontFamily: 'sans-serif' }}>{r.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', fontFamily: 'sans-serif' }}>{r.val}</span>
                    </div>
                  ))}
                </div>
              </CardModal>
            )}
            {openCard === 'score' && (
              <CardModal title="Drive Score" icon={<Star size={14} color="#f59e0b" fill="#f59e0b" />} accent="#f59e0b" onClose={() => setOpenCard(null)}>
                {isPro ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 64, fontWeight: 700, color: ds.score >= 8 ? '#10b981' : ds.score >= 6 ? '#f59e0b' : '#ef4444', fontFamily: 'sans-serif' }}>{ds.score}<span style={{ fontSize: 24, color: 'rgba(0,0,0,0.5)', fontWeight: 400 }}>/10</span></div>
                      <div style={{ fontSize: 13, color: '#f59e0b', fontFamily: 'sans-serif', marginTop: 4 }}>{ds.label}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                      {Array.from({ length: 10 }, (_, i) => <div key={i} style={{ width: 22, height: 10 + i * 3, background: i < ds.score ? '#f59e0b' : 'rgba(0,0,0,0.11)', borderRadius: 3, transition: 'all 0.4s' }} />)}
                    </div>
                    {[{ label: 'Speed Habits', val: latest && latest.speed_kmh > 100 ? 'Aggressive' : 'Smooth', col: latest && latest.speed_kmh > 100 ? '#ef4444' : '#10b981' }, { label: 'Braking', val: 'Moderate', col: '#f59e0b' }, { label: 'Efficiency', val: mode === 'Eco' ? 'Excellent' : 'Good', col: '#10b981' }, { label: 'Motor Health', val: latest?.fault_code ? 'Fault Detected' : 'Normal', col: latest?.fault_code ? '#ef4444' : '#10b981' }].map(r => (
                      <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(0,0,0,0.04)', borderRadius: 6, border: '1px solid rgba(0,0,0,0.09)' }}>
                        <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.60)', fontFamily: 'sans-serif' }}>{r.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: r.col, fontFamily: 'sans-serif' }}>{r.val}</span>
                      </div>
                    ))}
                  </div>
                ) : <LockedFeature title="Drive Score" desc="Upgrade to Pro to get AI-powered scoring across speed, braking, and efficiency." />}
              </CardModal>
            )}
            {openCard === 'tires' && (
              <CardModal title="Tire Pressure" icon={<span style={{ fontSize: 14 }}>🛞</span>} accent="#10b981" onClose={() => setOpenCard(null)}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <svg width="100%" viewBox="0 0 220 100" style={{ overflow: 'visible', margin: '0 auto', display: 'block' }}>
                    <rect x={70} y={22} width={80} height={56} rx={6} fill="none" stroke="rgba(14,165,233,0.2)" strokeWidth={1.5} />
                    <line x1={110} y1={22} x2={110} y2={78} stroke="rgba(14,165,233,0.1)" strokeWidth={0.8} />
                    <line x1={70} y1={50} x2={150} y2={50} stroke="rgba(14,165,233,0.1)" strokeWidth={0.8} />
                    {([{ cx: 44, cy: 28, psi: tires.fl, pos: 'Front Left' }, { cx: 176, cy: 28, psi: tires.fr, pos: 'Front Right' }, { cx: 44, cy: 72, psi: tires.rl, pos: 'Rear Left' }, { cx: 176, cy: 72, psi: tires.rr, pos: 'Rear Right' }] as const).map(w => {
                      const col = w.psi < 30 ? '#ef4444' : w.psi > 36 ? '#f59e0b' : '#10b981'
                      return (<g key={w.pos}><rect x={w.cx - 17} y={w.cy - 14} width={34} height={28} rx={4} fill={`${col}18`} stroke={col} strokeWidth={1} style={{ filter: `drop-shadow(0 0 4px ${col}55)` }} /><text x={w.cx} y={w.cy - 1} textAnchor="middle" fontSize={11} fontWeight={700} fill={col} fontFamily="sans-serif">{w.psi}</text><text x={w.cx} y={w.cy + 10} textAnchor="middle" fontSize={7} fill="rgba(0,0,0,0.45)" fontFamily="sans-serif">PSI</text></g>)
                    })}
                  </svg>
                  {([['Front Left', tires.fl], ['Front Right', tires.fr], ['Rear Left', tires.rl], ['Rear Right', tires.rr]] as [string, number][]).map(([pos, psi]) => {
                    const col = psi < 30 ? '#ef4444' : psi > 36 ? '#f59e0b' : '#10b981'
                    const status = psi < 30 ? 'Low — Inflate Soon' : psi > 36 ? 'High — Release Air' : 'Normal'
                    return (
                      <div key={pos} style={{ padding: '12px 14px', background: 'rgba(0,0,0,0.04)', borderRadius: 6, border: `1px solid ${col}33` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(0,0,0,1.00)', fontFamily: 'sans-serif' }}>{pos}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: col, fontFamily: 'sans-serif' }}>{psi} PSI — {status}</span>
                        </div>
                        <div style={{ height: 5, background: 'rgba(0,0,0,0.09)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(100, (psi / 44) * 100)}%`, background: col, borderRadius: 3 }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </CardModal>
            )}
          </AnimatePresence>

          {/* ROW 2 — left col: clickable stat cards */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.13 }} style={{ display: 'grid', gridTemplateColumns: '280px 1fr 280px', gap: 16, alignItems: 'stretch' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              <StatCard title="Tire Pressure" subtitle="4-Wheel Monitoring"
                icon={<span style={{ fontSize: 10 }}>🛞</span>}
                value={Object.values(tires).some(p => p < 30) ? <span style={{ fontSize: 14, color: '#ef4444' }}>LOW</span> : <span style={{ fontSize: 14, color: '#10b981' }}>OK</span>}
                accent="#10b981" onClick={() => setOpenCard('tires')} P={P} L9={L9} SB={SB} V={V} />

              <StatCard title="Key Suggestions" subtitle="AI Driving Insights"
                icon={<BrainCircuit size={10} color={isPro ? 'var(--cyan)' : 'rgba(0,0,0,0.30)'} />}
                value={isPro ? <span style={{ fontSize: 14, color: 'var(--cyan)' }}>{keySugs.length} tips</span> : <Lock size={14} color="rgba(0,0,0,0.30)" />}
                accent="#0ea5e9" onClick={() => setOpenCard('suggestions')} P={P} L9={L9} SB={SB} V={V} />

              <StatCard title="Speed Analytics" subtitle="Real-time Speed Monitor"
                icon={<Gauge size={10} color={mconf.accent} />}
                value={<>{Math.round(latest?.speed_kmh ?? 0)}<span style={{ fontSize: 13, color: 'rgba(0,0,0,0.52)', fontWeight: 400 }}> km/h</span></>}
                valueColor={mconf.accent} accent={mconf.accent}
                onClick={() => setOpenCard('speed')} P={P} L9={L9} SB={SB} V={V} />

              <StatCard title="Cabin Climate" subtitle="Auto • 22°C Target"
                icon={<Wind size={10} color="#0ea5e9" />}
                value={<>21<span style={{ fontSize: 13, color: 'rgba(0,0,0,0.52)', fontWeight: 400 }}> °C</span></>}
                valueColor="#0f172a" accent="#0ea5e9"
                onClick={() => setOpenCard('climate')} P={P} L9={L9} SB={SB} V={V} />

            </div>

            {/* Centre — Route Map */}
            <div style={{ ...P, height: '100%', minHeight: 500, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,0.03)', zIndex: 10 }}>
                <Navigation size={12} color="var(--cyan)" /><div style={L9}>Live Route Map</div><div style={{ ...SB, marginLeft: 4 }}>GPS &amp; turn-by-turn guidance</div>
              </div>
              <div style={{ flex: 1, position: 'relative', background: '#e2e8f0' }}>
                <LiveMap speed_kmh={latest?.speed_kmh ?? 0} />
              </div>
            </div>

            {/* Right col */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <StatCard title="Vehicle Alerts" subtitle="Real-time Health"
                icon={<AlertTriangle size={10} color={alerts.length > 0 ? '#ef4444' : '#10b981'} />}
                value={<span style={{ fontSize: 14, color: alerts.length > 0 ? '#ef4444' : '#10b981' }}>{alerts.length > 0 ? `${alerts.length} alert${alerts.length > 1 ? 's' : ''}` : 'All Clear'}</span>}
                accent={alerts.length > 0 ? '#ef4444' : '#10b981'} onClick={() => setOpenCard('alerts')} P={P} L9={L9} SB={SB} V={V} />

              <StatCard title="AI Advisory" subtitle="CVIS Intelligence"
                icon={<BrainCircuit size={10} color="var(--cyan)" />}
                value={<span style={{ fontSize: 12, color: 'var(--cyan)' }}>{aiRec ? 'View' : 'Standby'}</span>}
                accent="#0ea5e9" onClick={() => setOpenCard('ai')} P={P} L9={L9} SB={SB} V={V} />
              <StatCard title="Efficiency Graph" subtitle={isPro ? 'Fuel & Consumption' : 'Pro Feature'}
                icon={<TrendingUp size={10} color={isPro ? 'var(--cyan)' : 'rgba(0,0,0,0.30)'} />}
                value={isPro ? <>{(14 + (latest?.battery_pct ?? 80) / 20).toFixed(1)}<span style={{ fontSize: 13, color: 'rgba(0,0,0,0.52)', fontWeight: 400 }}> km/l</span></> : <Lock size={14} color="rgba(0,0,0,0.30)" />}
                accent="#0ea5e9" onClick={() => setOpenCard('efficiency')} P={P} L9={L9} SB={SB} V={V} />

              <StatCard title="Power Flow" subtitle="Live Power Distribution"
                icon={<Zap size={10} color={mconf.accent} />}
                value={<>{Math.round(totalKw)}<span style={{ fontSize: 13, color: 'rgba(0,0,0,0.52)', fontWeight: 400 }}> kW</span></>}
                valueColor={mconf.accent} accent={mconf.accent}
                onClick={() => setOpenCard('power')} P={P} L9={L9} SB={SB} V={V} />
            </div>
          </motion.div>

          {/* ROW 2 Modals */}
          <AnimatePresence>
            {openCard === 'suggestions' && (
              <CardModal title="AI Key Suggestions" icon={<BrainCircuit size={14} color="var(--cyan)" />} accent="#0ea5e9" onClose={() => setOpenCard(null)}>
                {isPro ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {keySugs.map((s, i) => (
                      <div key={i} style={{ display: 'flex', gap: 14, padding: '14px', background: s.priority === 'high' ? 'rgba(239,68,68,0.06)' : 'rgba(14,165,233,0.04)', border: `1px solid ${s.priority === 'high' ? 'rgba(239,68,68,0.22)' : 'rgba(14,165,233,0.12)'}`, borderRadius: 8 }}>
                        <div style={{ fontSize: 24, lineHeight: 1 }}>{s.icon}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: s.priority === 'high' ? '#ef4444' : '#0f172a', fontFamily: 'sans-serif', marginBottom: 4 }}>{s.title}</div>
                          <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.7)', lineHeight: 1.5, fontFamily: 'sans-serif' }}>{s.desc}</div>
                          <div style={{ marginTop: 8, display: 'inline-block', padding: '2px 8px', borderRadius: 10, background: s.priority === 'high' ? 'rgba(239,68,68,0.15)' : 'rgba(14,165,233,0.1)', fontSize: 10, color: s.priority === 'high' ? '#ef4444' : '#0ea5e9', fontFamily: 'sans-serif' }}>{s.priority.toUpperCase()} PRIORITY</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <LockedFeature title="AI Key Suggestions" desc="Get real-time AI driving tips personalized to your vehicle state and road conditions." />}
              </CardModal>
            )}
            {openCard === 'alerts' && (
              <CardModal title="Vehicle Alerts" icon={<AlertTriangle size={14} color="#f59e0b" />} accent="#f59e0b" onClose={() => setOpenCard(null)}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {alerts.length === 0 ? (
                    [{ icon: '✓', label: 'All Systems Normal', detail: 'No active faults detected.', col: '#10b981' }, { icon: '!', label: tires.rl < 30 ? 'Tire Pressure Low — Rear Left' : 'Tire Pressure OK', detail: `Rear left: ${tires.rl} PSI`, col: tires.rl < 30 ? '#f59e0b' : '#10b981' }, { icon: 'ℹ', label: 'Upcoming Service in 2300 km', detail: 'Schedule at your nearest service centre.', col: '#0ea5e9' }].map((a, i) => (
                      <div key={i} style={{ padding: '14px', background: `${a.col}08`, borderRadius: 8, border: `1px solid ${a.col}33` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                          <div style={{ width: 22, height: 22, borderRadius: '50%', background: `${a.col}22`, border: `1px solid ${a.col}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: a.col, flexShrink: 0 }}>{a.icon}</div>
                          <span style={{ fontSize: 13, fontWeight: 600, color: a.col, fontFamily: 'sans-serif' }}>{a.label}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.60)', fontFamily: 'sans-serif', paddingLeft: 32 }}>{a.detail}</div>
                      </div>
                    ))
                  ) : alerts.map(a => (
                    <div key={a.id} style={{ padding: '14px', background: a.type === 'fault' ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)', borderRadius: 8, border: `1px solid ${a.type === 'fault' ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)'}` }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: a.type === 'fault' ? '#ef4444' : '#f59e0b', fontFamily: 'sans-serif', marginBottom: 4 }}>{a.msg}</div>
                      <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.52)', fontFamily: 'sans-serif' }}>{a.time}</div>
                    </div>
                  ))}
                </div>
              </CardModal>
            )}
            {openCard === 'ai' && (
              <CardModal title="AI Advisory" icon={<BrainCircuit size={14} color="var(--cyan)" />} accent="#0ea5e9" onClose={() => setOpenCard(null)}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {aiTyping && <div className="typewriter-cursor" />}
                      <span style={{ fontSize: 12, color: '#64748b', fontFamily: 'sans-serif', fontWeight: 500 }}>
                        {aiTyping ? 'Generating recommendation...' : 'Live AI Recommendation'}
                      </span>
                    </div>
                    <button onClick={() => { requestRecommendation() }} disabled={aiTyping || !latest} style={{ background: 'rgba(14,165,233,0.12)', border: '1px solid rgba(14,165,233,0.3)', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 600, color: '#0284c7', cursor: 'pointer', fontFamily: 'sans-serif', opacity: aiTyping ? 0.5 : 1 }}>↻ Refresh</button>
                  </div>
                  <div style={{ padding: '16px 18px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13.5, color: '#334155', lineHeight: 1.7, fontFamily: 'sans-serif', minHeight: 140, maxHeight: 300, overflowY: 'auto' }}>
                    {aiRec ? <FormattedAiText text={aiRec} /> : <span style={{ color: '#94a3b8' }}>{!connected ? '◌ Waiting for connection...' : 'AI on standby — awaiting telemetry data.'}</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: '#64748b', fontFamily: 'sans-serif', textAlign: 'center' }}>Based on live telemetry from {vehicleId}</div>
                </div>
              </CardModal>
            )}
          </AnimatePresence>

          {/* Modals for all rows */}
          <AnimatePresence>
            {openCard === 'speed' && (
              <CardModal title="Speed Analytics" icon={<Gauge size={14} color={mconf.accent} />} accent={mconf.accent} onClose={() => setOpenCard(null)}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'center' }}><SpeedometerDial speed={latest?.speed_kmh ?? 0} accent={mconf.accent} /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[{ label: 'Current Speed', val: `${Math.round(latest?.speed_kmh ?? 0)} km/h` }, { label: 'Avg Speed', val: `${Math.round(avgSpd)} km/h` }, { label: 'Max Speed', val: `${Math.round(maxSpeed)} km/h` }, { label: 'Distance', val: `${totalDist.toFixed(1)} km` }].map(r => (
                      <div key={r.label} style={{ padding: '12px', background: 'rgba(0,0,0,0.04)', borderRadius: 8, border: '1px solid rgba(0,0,0,0.11)', textAlign: 'center' }}>
                        <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.52)', fontFamily: 'sans-serif', marginBottom: 4 }}>{r.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a', fontFamily: 'sans-serif' }}>{r.val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardModal>
            )}
            {openCard === 'efficiency' && (
              <CardModal title="Efficiency Graph" icon={<TrendingUp size={14} color="var(--cyan)" />} accent="#0ea5e9" onClose={() => setOpenCard(null)}>
                {isPro ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                      {[{ col: '#0ea5e9', label: 'Efficiency (km/l)' }, { col: '#f59e0b', label: 'Consumption (L/100km)' }].map(l => (<div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div style={{ width: 16, height: 3, background: l.col, borderRadius: 2 }} /><span style={{ fontSize: 12, fontFamily: 'sans-serif', color: 'rgba(0,0,0,0.7)' }}>{l.label}</span></div>))}
                      <div style={{ marginLeft: 'auto', fontSize: 13, fontFamily: 'sans-serif', color: mconf.accent, fontWeight: 700 }}>AVG {(14 + (latest?.battery_pct ?? 80) / 20).toFixed(1)} km/l</div>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <ComposedChart data={efficiencyData} margin={{ top: 4, right: 4, left: -26, bottom: 0 }}>
                        <XAxis dataKey="time" tick={{ fontSize: 9, fill: 'rgba(0,0,0,0.38)', fontFamily: 'sans-serif' }} tickLine={false} axisLine={false} interval={2} />
                        <YAxis yAxisId="l" hide domain={[0, 30]} />
                        <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 9, fill: 'rgba(0,0,0,0.38)', fontFamily: 'sans-serif' }} tickLine={false} axisLine={false} domain={[0, 30]} />
                        <Tooltip contentStyle={{ background: '#0d1117', border: '1px solid rgba(14,165,233,0.15)', borderRadius: 6, fontSize: 11 }} />
                        <Bar yAxisId="l" dataKey="consumption" fill="rgba(245,158,11,0.35)" radius={[2, 2, 0, 0]} name="Consumption L/100km" />
                        <Line yAxisId="r" type="monotone" dataKey="efficiency" stroke="#0ea5e9" strokeWidth={2.5} dot={false} name="Efficiency km/l" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                ) : <LockedFeature title="AI Efficiency Graph" desc="Pro subscribers get hourly fuel efficiency analysis, consumption trends, and driving optimization insights." />}
              </CardModal>
            )}
            {openCard === 'climate' && (
              <CardModal title="Cabin Climate" icon={<Wind size={14} color="#0ea5e9" />} accent="#0ea5e9" onClose={() => setOpenCard(null)}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'rgba(14,165,233,0.06)', borderRadius: 10, border: '1px solid rgba(14,165,233,0.15)' }}>
                    <div>
                      <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.5)', fontFamily: 'sans-serif' }}>Interior Temp</div>
                      <div style={{ fontSize: 32, fontWeight: 700, color: '#0ea5e9', fontFamily: 'sans-serif', marginTop: 4 }}>21°C</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.5)', fontFamily: 'sans-serif' }}>Target Temp</div>
                      <div style={{ fontSize: 32, fontWeight: 700, color: '#0f172a', fontFamily: 'sans-serif', marginTop: 4 }}>22°C</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    {['Auto', 'A/C', 'Heat', 'Defrost'].map((m, i) => (
                      <div key={m} style={{ flex: 1, padding: '12px 0', textAlign: 'center', background: i === 0 ? '#0ea5e9' : 'rgba(0,0,0,0.04)', color: i === 0 ? '#fff' : 'rgba(0,0,0,0.6)', borderRadius: 8, fontSize: 13, fontWeight: 600, fontFamily: 'sans-serif' }}>
                        {m}
                      </div>
                    ))}
                  </div>
                  <div style={{ padding: '12px', background: 'rgba(0,0,0,0.03)', borderRadius: 8, fontSize: 12, color: 'rgba(0,0,0,0.5)', textAlign: 'center', fontFamily: 'sans-serif' }}>
                    Air quality is GOOD. Fan speed is automatically controlled.
                  </div>
                </div>
              </CardModal>
            )}
            {openCard === 'power' && (
              <CardModal title="Power Flow" icon={<Zap size={14} color={mconf.accent} />} accent={mconf.accent} onClose={() => setOpenCard(null)}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                    <DonutRing pct={enginePct} color="#0ea5e9" label="ENGINE" size={90} />
                    <DonutRing pct={battPct2} color="#10b981" label="BATTERY" size={90} />
                    <DonutRing pct={motorPct} color={mconf.accent} label="MOTOR" size={90} />
                  </div>
                  {[{ label: 'Power Distribution', pct: enginePct, col: '#0ea5e9', grad: 'linear-gradient(90deg,#0ea5e9,#10b981)' }, { label: 'Regeneration', pct: regenPct, col: '#10b981', grad: 'linear-gradient(90deg,#10b981,#0ea5e988)' }].map(b => (
                    <div key={b.label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.75)', fontFamily: 'sans-serif' }}>{b.label}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: b.col, fontFamily: 'sans-serif' }}>{b.pct}%</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3, background: 'rgba(0,0,0,0.09)' }}>
                        <motion.div style={{ height: '100%', borderRadius: 3, background: b.grad, boxShadow: `0 0 8px ${b.col}44` }} animate={{ width: `${b.pct}%` }} transition={{ duration: 0.6 }} />
                      </div>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px', background: 'rgba(0,0,0,0.04)', borderRadius: 8, border: '1px solid rgba(0,0,0,0.11)' }}>
                    <div style={{ textAlign: 'center' }}><div style={{ fontSize: 12, color: 'rgba(0,0,0,0.52)', fontFamily: 'sans-serif', marginBottom: 4 }}>TOTAL OUTPUT</div><div style={{ fontSize: 24, fontWeight: 700, color: mconf.accent, fontFamily: 'sans-serif' }}>{Math.round(totalKw)} kW</div></div>
                    <div style={{ width: 1, background: 'rgba(0,0,0,0.12)' }} />
                    <div style={{ textAlign: 'center' }}><div style={{ fontSize: 12, color: 'rgba(0,0,0,0.52)', fontFamily: 'sans-serif', marginBottom: 4 }}>HORSEPOWER</div><div style={{ fontSize: 24, fontWeight: 700, color: 'rgba(0,0,0,0.98)', fontFamily: 'sans-serif' }}>{totalHp} HP</div></div>
                  </div>
                </div>
              </CardModal>
            )}
          </AnimatePresence>



        </div>
      </main>

      <AnimatePresence>
        {chatOpen && (
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 280, damping: 28 }} style={{ position: 'fixed', bottom: 0, right: 24, width: 380, zIndex: 9999, background: '#ffffff', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '12px 12px 0 0', overflow: 'hidden', boxShadow: '0 -12px 48px rgba(0,0,0,0.12)' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 8, background: '#f8fafc' }}>
              <BrainCircuit size={14} color="#0ea5e9" />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', letterSpacing: '0.04em' }}>CVIS AI ASSISTANT</span>
              <div style={{ fontSize: 10, color: 'rgba(0,0,0,0.4)', marginLeft: 4, fontFamily: 'sans-serif' }}>{latest ? `${latest.device_id} \u00b7 ${mode}` : 'NO DATA'}</div>
              <button onClick={() => setChatOpen(false)} style={{ marginLeft: 'auto', background: 'rgba(0,0,0,0.04)', border: 'none', color: 'rgba(0,0,0,0.6)', cursor: 'pointer', width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={14} /></button>
            </div>
            <div style={{ height: 320, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12, background: '#ffffff' }}>
              {chatHistory.length === 0 && <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.3)', textAlign: 'center', marginTop: 60, fontFamily: 'sans-serif', fontWeight: 600 }}>ASK CVIS ANYTHING ABOUT YOUR VEHICLE</div>}
              {chatHistory.map((m, i) => (
                <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%' }}>
                  <div style={{ padding: '10px 14px', borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px', background: m.role === 'user' ? '#e0f2fe' : '#f1f5f9', border: `1px solid ${m.role === 'user' ? '#bae6fd' : '#e2e8f0'}`, fontSize: 13, color: m.role === 'user' ? '#0369a1' : '#334155', lineHeight: 1.5, fontFamily: 'sans-serif' }}>
                    {m.text}
                  </div>
                  {m.role === 'ai' && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 4 }}>
                      <button
                        onClick={() => isSpeaking ? stopSpeaking() : speakText(m.text)}
                        title={isSpeaking ? 'Stop speaking' : 'Speak this reply'}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 4, color: isSpeaking ? '#0ea5e9' : 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontFamily: 'sans-serif', transition: 'color 0.2s' }}
                      >
                        {isSpeaking ? <Volume2 size={12} /> : <Volume2 size={12} />}
                        <span>{isSpeaking ? 'Stop' : 'Speak'}</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {chatLoading && <div style={{ alignSelf: 'flex-start', display: 'flex', gap: 5, padding: '10px 14px', background: '#f1f5f9', borderRadius: '12px 12px 12px 2px', border: '1px solid #e2e8f0' }}>{[0, 1, 2].map(i => <motion.div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#0ea5e9' }} animate={{ y: [0, -5, 0] }} transition={{ delay: i * 0.15, repeat: Infinity, duration: 0.7 }} />)}</div>}
              <div ref={chatBottom} />
            </div>
            {/* Speaking indicator */}
            {isSpeaking && (
              <div style={{ padding: '6px 16px', background: 'linear-gradient(90deg,rgba(14,165,233,0.08),rgba(14,165,233,0.04))', borderTop: '1px solid rgba(14,165,233,0.15)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 0.8 }} style={{ width: 6, height: 6, borderRadius: '50%', background: '#0ea5e9' }} />
                <span style={{ fontSize: 10, color: '#0ea5e9', fontFamily: 'sans-serif', fontWeight: 600, letterSpacing: '0.06em' }}>AI SPEAKING...</span>
                <button onClick={stopSpeaking} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#0ea5e9', cursor: 'pointer', fontSize: 10, fontFamily: 'sans-serif', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <VolumeX size={12} /> Stop
                </button>
              </div>
            )}
            <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(0,0,0,0.06)', display: 'flex', gap: 8, background: '#f8fafc' }}>
              <button
                onClick={toggleListening}
                title={isListening ? 'Stop listening' : 'Ask with voice — AI will speak the reply'}
                style={{ background: isListening ? '#ef4444' : '#f1f5f9', border: `1px solid ${isListening ? '#fca5a5' : '#e2e8f0'}`, borderRadius: 6, padding: '10px', cursor: 'pointer', color: isListening ? '#ffffff' : '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s', position: 'relative' }}>
                {isListening
                  ? <MicOff size={14} />
                  : <Mic size={14} />}
                {isListening && (
                  <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1 }}
                    style={{ position: 'absolute', top: -3, right: -3, width: 8, height: 8, borderRadius: '50%', background: '#ef4444', border: '1.5px solid #fff' }} />
                )}
              </button>
              <input value={chatMsg} onChange={e => setChatMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleChat()} placeholder={isListening ? '🎙 Listening... speak now' : 'Ask about your vehicle...'} style={{ flex: 1, background: '#ffffff', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 6, padding: '10px 14px', color: '#0f172a', fontSize: 13, outline: 'none', fontFamily: 'sans-serif', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }} />
              <button onClick={() => handleChat(false)} disabled={chatLoading} style={{ background: '#0ea5e9', border: 'none', borderRadius: 6, padding: '10px 14px', cursor: 'pointer', color: '#ffffff', opacity: chatLoading ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(14,165,233,0.3)' }}><Send size={14} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!chatOpen && (
        <motion.button whileHover={{ scale: 1.08, boxShadow: '0 4px 24px rgba(14,165,233,0.4)' }} whileTap={{ scale: 0.95 }} onClick={() => setChatOpen(true)} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.2, type: 'spring' }} style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, width: 56, height: 56, borderRadius: '50%', background: '#0ea5e9', border: '2px solid #ffffff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 32px rgba(14,165,233,0.3)', backdropFilter: 'blur(12px)' }}>
          <MessageSquare size={22} color="#ffffff" />
        </motion.button>
      )}
    </>
  )
}
