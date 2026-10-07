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
import { fetchRecent, fetchRecommendation, sendChat, fetchConfig, setVehicleAiService, fetchMobileAccess, api } from '@/lib/api'
import type { TelemetryRow, WsEvent } from '@/lib/types'
import { toast } from 'sonner'

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
    { icon: '\u26a1', title: 'Optimal Efficiency', desc: 'Powertrain operating within peak efficiency curve', priority: 'low' },
    { icon: '\u3030', title: 'Smooth Dynamics', desc: 'Acceleration and regenerative braking nominal', priority: 'low' },
    { icon: '\ud83d\udee1\ufe0f', title: 'System Health Nominal', desc: 'All telemetry channels reporting normal status', priority: 'low' },
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

function getTirePressures(latest: TelemetryRow | null): { fl: number | null; fr: number | null; rl: number | null; rr: number | null } {
  if (!latest || latest.tire_pressure_psi == null) return { fl: null, fr: null, rl: null, rr: null }
  const base = Math.round(latest.tire_pressure_psi)
  return { fl: base, fr: base, rl: base, rr: base }
}

function ProLockedCard({ title, desc, onUnlock }: { title: string; desc: string; onUnlock: () => void }) {
  return (
    <div
      onClick={(e) => {
        e.stopPropagation()
        onUnlock()
      }}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '5px 10px', background: 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(2,132,199,0.08) 100%)',
        border: '1.5px dashed rgba(245,158,11,0.45)', borderRadius: 8,
        cursor: 'pointer', transition: 'all 0.2s', width: '100%', boxSizing: 'border-box'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Lock size={12} color="#d97706" />
        <span style={{ fontSize: 9.5, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.04em', color: '#b45309', fontWeight: 800, textTransform: 'uppercase' }}>
          {title}
        </span>
      </div>
      <div style={{
        padding: '3px 8px', borderRadius: 6,
        background: '#d97706', color: '#ffffff',
        fontSize: 8.5, fontFamily: "'JetBrains Mono', monospace", fontWeight: 800, letterSpacing: '0.04em'
      }}>
        UNLOCK PRO
      </div>
    </div>
  )
}

function ProLockedModal({
  title,
  feature,
  desc,
  benefits,
  onUnlock,
}: {
  title: string
  feature: string
  desc: string
  benefits: string[]
  onUnlock: () => void
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '10px 0' }}>
      <div style={{
        padding: '24px 20px',
        background: 'linear-gradient(135deg, rgba(2,132,199,0.06) 0%, rgba(245,158,11,0.06) 100%)',
        border: '1.5px dashed rgba(2,132,199,0.35)',
        borderRadius: 12,
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: 'linear-gradient(135deg, #0284c7 0%, #f59e0b 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 20px rgba(2,132,199,0.25)',
          color: '#ffffff'
        }}>
          <Lock size={22} />
        </div>
        <div>
          <div style={{ fontSize: 11, fontFamily: 'monospace', letterSpacing: '0.14em', color: '#0284c7', fontWeight: 800, textTransform: 'uppercase' }}>
            {title}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#0f172a', marginTop: 2 }}>
            {feature}
          </div>
        </div>
        <div style={{ fontSize: 13, color: '#475569', maxWidth: 440, lineHeight: 1.5 }}>
          {desc}
        </div>
      </div>

      <div style={{ padding: '14px 16px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#334155', fontFamily: 'monospace', marginBottom: 8, textTransform: 'uppercase' }}>
          PRO TIER CAPABILITIES INCLUDED:
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {benefits.map((b, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#475569' }}>
              <span style={{ color: '#10b981', fontWeight: 800 }}>✓</span>
              <span>{b}</span>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={onUnlock}
        style={{
          width: '100%',
          padding: '14px',
          borderRadius: 8,
          border: 'none',
          background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
          color: '#ffffff',
          fontSize: 13,
          fontWeight: 800,
          fontFamily: 'monospace',
          letterSpacing: '0.06em',
          cursor: 'pointer',
          boxShadow: '0 4px 14px rgba(2,132,199,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          transition: 'all 0.2s'
        }}
      >
        <Star size={16} fill="#facc15" color="#facc15" />
        ACTIVATE CVIS PRO PLAN (INSTANT DEMO)
      </button>
    </div>
  )
}

function LockedFeature({ title, desc }: { title: string; desc: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, height: '100%', minHeight: 70, padding: '12px 10px', background: 'linear-gradient(135deg,rgba(0,0,0,0.02) 0%,rgba(0,0,0,0.05) 100%)', border: '1px dashed rgba(0,0,0,0.15)', borderRadius: 8, textAlign: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Lock size={12} color="rgba(0,0,0,0.4)" />
        <span style={{ fontSize: 9, fontFamily: 'sans-serif', letterSpacing: '0.15em', color: 'rgba(0,0,0,0.5)', fontWeight: 800, textTransform: 'uppercase' }}>{title}</span>
      </div>
      <div style={{ fontSize: 9.5, color: 'rgba(0,0,0,0.4)', lineHeight: 1.4 }}>{desc}</div>
      <div style={{ padding: '3px 10px', borderRadius: 20, background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.1)', fontSize: 8.5, fontFamily: 'sans-serif', color: 'rgba(0,0,0,0.6)', letterSpacing: '0.1em', fontWeight: 700 }}>UPGRADE TO PRO</div>
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

function SpeedShowerGauge({
  speed, maxSpeed, accent, isAwaiting
}: {
  speed: number; maxSpeed: number; accent: string; isAwaiting: boolean
}) {
  const max = 240
  const pct = Math.min(Math.max(0, speed) / max, 1)
  const startA = -210, totalA = 240
  const toRad = (a: number) => (a * Math.PI) / 180
  const cx = 110, cy = 60, r = 48

  const arc = (r2: number, sA: number, eA: number) => {
    const s2 = { x: cx + r2 * Math.cos(toRad(sA)), y: cy + r2 * Math.sin(toRad(sA)) }
    const e = { x: cx + r2 * Math.cos(toRad(eA)), y: cy + r2 * Math.sin(toRad(eA)) }
    return `M ${s2.x.toFixed(2)} ${s2.y.toFixed(2)} A ${r2} ${r2} 0 ${(eA - sA) > 180 ? 1 : 0} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`
  }

  const na = startA + pct * totalA
  const nx = Number((cx + (r - 9) * Math.cos(toRad(na))).toFixed(2))
  const ny = Number((cy + (r - 9) * Math.sin(toRad(na))).toFixed(2))

  const ticks = Array.from({ length: 9 }, (_, i) => {
    const a = startA + (i / 8) * totalA
    const isMajor = i % 2 === 0
    return {
      x1: Number((cx + (r - (isMajor ? 6 : 4)) * Math.cos(toRad(a))).toFixed(2)),
      y1: Number((cy + (r - (isMajor ? 6 : 4)) * Math.sin(toRad(a))).toFixed(2)),
      x2: Number((cx + r * Math.cos(toRad(a))).toFixed(2)),
      y2: Number((cy + r * Math.sin(toRad(a))).toFixed(2)),
      tx: Number((cx + (r - 13) * Math.cos(toRad(a))).toFixed(2)),
      ty: Number((cy + (r - 13) * Math.sin(toRad(a))).toFixed(2)),
      val: Math.round(i * 30),
      isMajor,
    }
  })

  const regime = isAwaiting
    ? 'STANDBY'
    : speed === 0
      ? 'IDLE'
      : speed < 45
        ? 'CITY PACE'
        : speed < 95
          ? 'CRUISING'
          : 'SPORT BOOST'

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
      <svg width="100%" height={68} viewBox="0 0 220 86" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="speedGaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0ea5e9" />
            <stop offset="60%" stopColor="#0284c7" />
            <stop offset="100%" stopColor={accent} />
          </linearGradient>
        </defs>

        <circle cx={cx} cy={cy} r={r + 6} fill="#f8fafc" stroke="rgba(0,0,0,0.04)" strokeWidth={1} />
        <path d={arc(r, startA, startA + totalA)} fill="none" stroke="#e2e8f0" strokeWidth={5} strokeLinecap="round" />

        {!isAwaiting && pct > 0 && (
          <motion.path
            d={arc(r, startA, startA + totalA)}
            fill="none"
            stroke="url(#speedGaugeGrad)"
            strokeWidth={5}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${accent}66)` }}
            strokeDasharray="400"
            animate={{ strokeDashoffset: 400 - pct * 201 }}
            initial={{ strokeDashoffset: 400 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          />
        )}

        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
              stroke={t.isMajor ? `${accent}aa` : '#94a3b8'}
              strokeWidth={t.isMajor ? 1.5 : 1}
            />
            {t.isMajor && (
              <text
                x={t.tx} y={t.ty + 2}
                textAnchor="middle"
                fontSize={7}
                fill="#334155"
                fontFamily="'Inter', sans-serif"
                fontWeight={700}
              >
                {t.val}
              </text>
            )}
          </g>
        ))}

        {!isAwaiting && pct > 0 && (
          <motion.circle
            cx={nx} cy={ny} r={3.5}
            fill="#ffffff"
            stroke={accent}
            strokeWidth={2}
            style={{ filter: `drop-shadow(0 0 5px ${accent})` }}
            animate={{ cx: nx, cy: ny }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          />
        )}

        <text x={cx} y={cy + 4} textAnchor="middle" fontSize={26} fontWeight={800} fill="#0f172a" fontFamily="'JetBrains Mono', 'Fira Code', monospace">
          {isAwaiting ? '---' : Math.round(speed)}
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" fontSize={8} fontWeight={800} fill="#0284c7" fontFamily="'Inter', sans-serif" letterSpacing="0.08em">
          KM / H
        </text>
      </svg>

      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, padding: '0 4px', fontSize: 9.5, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
        <span style={{ color: '#334155' }}>
          {isAwaiting ? '0 RPM' : `${Math.round(speed * 82)} RPM`}
        </span>
        <span style={{
          padding: '2px 7px', borderRadius: 8,
          background: isAwaiting ? '#f1f5f9' : `${accent}18`,
          color: isAwaiting ? '#64748b' : accent,
          fontWeight: 800,
          border: `1px solid ${isAwaiting ? '#e2e8f0' : accent + '44'}`
        }}>
          {regime}
        </span>
        <span style={{ color: '#334155' }}>
          MAX {maxSpeed > 0 ? Math.round(maxSpeed) : 0}
        </span>
      </div>
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

// ─── Stat Card (click opens modal, supports rich visual slot) ─────────────────
function StatCard({
  title, subtitle, icon, value, valueColor, accent = '#0ea5e9', visual, onClick, P, L9, SB, V
}: {
  title: string; subtitle: string; icon: React.ReactNode
  value: React.ReactNode; valueColor?: string; accent?: string
  visual?: React.ReactNode
  onClick: () => void
  P: React.CSSProperties; L9: React.CSSProperties; SB: React.CSSProperties; V: React.CSSProperties
}) {
  return (
    <motion.div
      initial="rest"
      whileHover="hover"
      whileTap="tap"
      variants={{
        rest: { scale: 1, y: 0, boxShadow: '0 2px 8px rgba(15,23,42,0.04)' },
        hover: { scale: 1.015, y: -3, boxShadow: '0 10px 20px -3px rgba(15,23,42,0.08)' },
        tap: { scale: 0.985, y: 0 }
      }}
      style={{
        ...P,
        cursor: 'pointer',
        position: 'relative',
        borderBottom: `3px solid ${accent}`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'border-color 0.2s',
        height: 148,
        boxSizing: 'border-box'
      }}
      onClick={onClick}
    >
      <div style={{ padding: '13px 16px 11px', display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `${accent}14`, border: `1px solid ${accent}30`,
            flexShrink: 0
          }}>
            {icon}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, flex: 1 }}>
            <span style={L9}>{title}</span>
            <span style={SB}>{subtitle}</span>
          </div>
          <motion.div variants={{ rest: { x: 0, opacity: 0.4 }, hover: { x: 3, opacity: 1 } }} style={{ marginLeft: 'auto', flexShrink: 0 }}>
            <ChevronRight size={14} color={accent} />
          </motion.div>
        </div>
        <div style={{ ...V, fontSize: 25, color: valueColor ?? '#0f172a', lineHeight: 1.15 }}>
          {value}
        </div>
        {visual && (
          <div style={{ width: '100%' }}>
            {visual}
          </div>
        )}
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
        paddingTop: 'max(60px, 8vh)', paddingLeft: 20, paddingRight: 20, paddingBottom: 24,
        background: 'rgba(15,23,42,0.38)', backdropFilter: 'blur(10px)',
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 16, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, y: 16, opacity: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 540,
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 16,
          boxShadow: '0 24px 64px -12px rgba(15,23,42,0.18), 0 0 0 1px rgba(0,0,0,0.04)',
          overflow: 'hidden',
        }}
      >
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #f1f5f9',
          display: 'flex', alignItems: 'center', gap: 12, background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: `${accent}12`, border: `1px solid ${accent}33`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {icon}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em', fontFamily: 'sans-serif' }}>
              {title}
            </div>
            <div style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace', letterSpacing: '0.08em', marginTop: 1 }}>
              CVIS TELEMETRY SUBSYSTEM
            </div>
          </div>
          <button onClick={onClose} style={{
            marginLeft: 'auto', background: '#f1f5f9', border: '1px solid #e2e8f0',
            color: '#64748b', cursor: 'pointer', width: 28, height: 28, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#0f172a'; e.currentTarget.style.borderColor = '#cbd5e1' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#64748b'; e.currentTarget.style.borderColor = '#e2e8f0' }}
          >
            <X size={15} />
          </button>
        </div>
        <div style={{ padding: '22px', maxHeight: '78vh', overflowY: 'auto' }}>
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
  const [cabinTemp, setCabinTemp] = useState(21)
  const [forcedMode, setForcedMode] = useState<string | null>(null)
  const [climateMode, setClimateMode] = useState<'Auto' | 'A/C Max' | 'Eco Heat' | 'Defrost'>('Auto')
  const alertId = useRef(0)
  const chatBottom = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  const typewriterTimer = useRef<NodeJS.Timeout | null>(null)
  const lastRecRef = useRef<string>('')
  const voiceTriggered = useRef(false)
  const femaleVoiceRef = useRef<SpeechSynthesisVoice | null>(null)

  const efficiencyData = useMemo(() => {
    if (history.length === 0) return []
    return history.slice(-14).map((h) => ({
      time: h.time.split(' ')[0],
      efficiency: Math.round(135 + h.speed * 0.7),
      consumption: parseFloat(((135 + h.speed * 0.7) / 10).toFixed(1)),
    }))
  }, [history])

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
    fetchMobileAccess(vehicleId).then((res: any) => {
      if (res && res.tier === 'premium') {
        setIsPro(true)
      } else {
        fetchConfig().then((cfg: any) => {
          if (cfg.force_mode) setForcedMode(cfg.force_mode)
          setIsPro(cfg.ai_service_enabled === true)
        }).catch(() => { })
      }
    }).catch(() => {
      fetchConfig().then((cfg: any) => {
        if (cfg.force_mode) setForcedMode(cfg.force_mode)
        setIsPro(cfg.ai_service_enabled === true)
      }).catch(() => { })
    })

    return () => {
      if (typewriterTimer.current) clearInterval(typewriterTimer.current)
    }
  }, [vehicleId])

  const togglePro = useCallback((enable?: boolean) => {
    const next = enable !== undefined ? enable : !isPro
    setIsPro(next)
    setVehicleAiService(vehicleId, next).catch(() => {})
    if (next) {
      toast.success("CVIS Pro Intelligence Activated", {
        description: "Unlocked Multi-Factor AI Coaching, Driving Score, Neural Insights & Efficiency Curves."
      })
    } else {
      toast.info("Free Plan Mode Active", {
        description: "AI coaching and advanced telemetry analytics are now locked."
      })
    }
  }, [isPro, vehicleId])

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
    // ── Handle initial backfill on WS connect (last 10 rows from server) ──
    if (ev.event === 'backfill') {
      const records = ev.records.filter(r => r.device_id === vehicleId)
      if (records.length > 0) {
        // newest first from server — reverse to get oldest-first for history chart
        const sorted = [...records].reverse()
        setHistory(sorted.map((r) => ({
          id: r.received_at + Math.random(),
          time: new Date(r.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          batt: r.battery_pct,
          speed: r.speed_kmh,
          temp: r.motor_temp_c,
        })))
        setLatest(records[0])  // records[0] is the most recent
        setMaxSpeed(Math.max(...records.map(r => r.speed_kmh)))
      }
    }
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
    if (ev.event === 'config_changed' && 'force_mode' in ev) setForcedMode((ev as any).force_mode ?? null)
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

  // When forcedMode is set, honor user manual selection; otherwise track live telemetry
  const mode = forcedMode ?? (latest?.mode ?? 'Healthy')
  const mconf = modeOf(mode)
  const driveMode = latest ? (DRIVE_MODE_LABEL[mode] ?? 'NORMAL') : '---'
  const tires = getTirePressures(latest), ds = calcDriveScore(latest)
  const keySugs = latest ? (KEY_SUGGESTIONS[mode] ?? KEY_SUGGESTIONS['Healthy']) : []
  const avgSpd = history.length > 0 ? history.reduce((a, b) => a + b.speed, 0) / history.length : 0
  // Use actual ambient_temp_c from firmware if available
  const ambientTemp = latest?.ambient_temp_c != null ? latest.ambient_temp_c : NaN
  const enginePct = !latest ? 0 : mode === 'Charging' || mode === 'Motor Fault' ? 0 : mode === 'Eco' ? 55 : mode === 'Sport' ? 92 : 78
  const battPct2 = !latest ? 0 : mode === 'Charging' ? 100 : mode === 'Motor Fault' ? 20 : mode === 'Eco' ? 82 : mode === 'Sport' ? 58 : Math.round(latest.battery_pct)
  const motorPct = !latest ? 0 : mode === 'Motor Fault' ? 5 : mode === 'Eco' ? 35 : mode === 'Sport' ? 88 : 45
  const regenPct = !latest ? 0 : mode === 'Eco' ? 85 : mode === 'Heavy Traffic' ? 72 : mode === 'Charging' ? 100 : 63
  // Actual kW from telemetry when charging; calculated from speed and mode when running; idle when stationary
  const totalKw = latest
    ? (mode === 'Charging'
        ? -((latest?.charging_rate_w ?? 0) / 1000)
        : latest.speed_kmh === 0
          ? (latest.cabin_climate_w ? Math.round(latest.cabin_climate_w / 1000) : 0)
          : Math.round((latest.speed_kmh / 120) * (mode === 'Sport' ? 320 : mode === 'Eco' ? 160 : 240) + ((latest.cabin_climate_w ?? 0) / 1000)))
    : NaN
  const totalHp = !isNaN(totalKw) ? Math.round(totalKw * 1.341) : NaN

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
        totalKw={isNaN(totalKw) ? null : totalKw}
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

  const P: React.CSSProperties = {
    background: '#ffffff',
    border: '1px solid #e2e8f0',
    boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
    borderRadius: 12,
    position: 'relative',
    overflow: 'hidden',
    height: 148,
    boxSizing: 'border-box'
  }
  const L9: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: '#0f172a',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  }
  const SB: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 500,
    color: '#475569',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  }
  const V: React.CSSProperties = {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontWeight: 800,
    letterSpacing: '-0.02em',
    lineHeight: 1.1,
    color: '#0f172a'
  }

  const handleForceMode = async (m: string | null) => {
    setForcedMode(m)
    try {
      await api.post('/api/v1/config/mode', { mode: m })
      if (m) {
        toast.success(`Drive Mode: ${m.toUpperCase()}`, {
          description: `Powertrain dynamics and simulated vehicle state updated to ${m}.`
        })
      } else {
        toast.info('Auto Telemetry Mode', {
          description: 'Vehicle dynamics tracking live CAN-bus stream.'
        })
      }
    } catch (e) {
      toast.error("Failed to sync mode to backend server")
    }
  };

  return (
    <>
      <CustomCursor />

      <main style={{ position: 'relative', zIndex: 1, paddingTop: 16, paddingBottom: 32, minHeight: '100vh', overflow: 'hidden' }}>
        <div style={{ maxWidth: 1720, margin: '0 auto', padding: '16px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* HEADER */}
          <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={() => router.push('/driver')} style={{ width: 34, height: 34, borderRadius: '50%', background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(15,23,42,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#0284c7', flexShrink: 0 }}>
                <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} />
              </button>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="live-dot" />
                  <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 19, fontWeight: 900, color: '#0f172a', letterSpacing: '0.04em' }}>
                    LUXURY DRIVE CONSOLE <span style={{ color: vehicleColor }}>{vehicleName.toUpperCase()}</span>
                  </span>
                </div>
                <div style={{ fontSize: 11.5, color: '#475569', fontWeight: 500, fontFamily: "'Inter', sans-serif", letterSpacing: '0.02em', marginTop: 2 }}>
                  Advanced real-time performance &amp; vehicle interface &mdash; <strong style={{ color: '#0f172a' }}>{vehicleId}</strong>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => togglePro()}
                style={{
                  padding: '6px 14px', borderRadius: 20, cursor: 'pointer',
                  fontSize: 10, fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.04em', fontWeight: 800,
                  background: isPro ? 'linear-gradient(90deg, rgba(2,132,199,0.12), rgba(16,185,129,0.12))' : '#f8fafc',
                  border: isPro ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
                  color: isPro ? '#0284c7' : '#475569',
                  boxShadow: isPro ? '0 0 10px rgba(2,132,199,0.15)' : 'none',
                  transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', gap: 6
                }}
              >
                {isPro ? '★ PRO ACTIVE' : '☆ FREE TIER (UPGRADE)'}
              </button>
              {[
                { label: latest ? 'HMAC: VALID' : 'HMAC: STANDBY', col: latest ? '#10b981' : '#64748b', active: !!latest },
                { label: 'PROTOCOL: MQTT/HTTP', col: '#0ea5e9', active: true },
                { label: connected ? 'CONNECTED' : 'DISCONNECTED', col: connected ? '#10b981' : '#ef4444', active: connected },
                { label: latest ? `${Math.round(latest.battery_pct)}%` : '--%', col: latest && latest.battery_pct < 20 ? '#ef4444' : '#10b981', active: !!latest },
                { label: connected ? 'WS LIVE' : 'OFFLINE', col: connected ? '#10b981' : '#ef4444', active: connected },
              ].map(pill => (<div key={pill.label} style={{ padding: '5px 12px', borderRadius: 20, background: `${pill.col}14`, border: `1px solid ${pill.col}40`, fontSize: 9.5, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, letterSpacing: '0.04em', color: pill.active ? pill.col : '#64748b', transition: 'all 0.4s' }}>{pill.label}</div>))}
            </div>
          </motion.div>

          {/* ROW 1: Stat Cards — click any to open detail modal */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }} style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>

            <StatCard title="Battery SoC" subtitle="High-Voltage DC Pack"
              icon={<Battery size={15} color={latest && latest.battery_pct < 20 ? '#ef4444' : '#10b981'} />}
              value={latest ? <>{Math.round(latest.battery_pct)}<span style={{ fontSize: 14, color: '#475569', fontWeight: 600 }}>%</span></> : <span style={{ fontSize: 25, color: '#64748b', fontWeight: 800 }}>--%</span>}
              valueColor={latest && latest.battery_pct < 20 ? '#ef4444' : '#10b981'} accent="#10b981"
              visual={
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ display: 'flex', gap: 3, height: 6 }}>
                    {Array.from({ length: 10 }, (_, i) => {
                      const pct = latest?.battery_pct ?? 0
                      const isLit = latest != null && i < Math.round((pct / 100) * 10)
                      const col = pct < 20 ? '#ef4444' : pct < 35 ? '#f59e0b' : '#10b981'
                      return (
                        <div key={i} style={{
                          flex: 1, borderRadius: 2,
                          background: isLit ? col : '#e2e8f0',
                          boxShadow: isLit ? `0 0 6px ${col}66` : 'none',
                          transition: 'all 0.4s'
                        }} />
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#334155' }}>
                    <span>{latest ? `${((latest.battery_pct / 100) * 82).toFixed(1)} kWh` : '--- kWh'}</span>
                    <span style={{ color: latest && latest.battery_pct < 20 ? '#ef4444' : '#059669', fontWeight: 800 }}>
                      {latest ? (mode === 'Charging' ? '⚡ 11 kW CHARGE' : latest.battery_pct < 20 ? 'CRITICAL RESERVE' : '800V NOMINAL') : 'OFFLINE'}
                    </span>
                  </div>
                </div>
              }
              onClick={() => setOpenCard('battery')} P={P} L9={L9} SB={SB} V={V} />

            <StatCard title="Outside & Thermal" subtitle="Ambient & Inverter"
              icon={<Thermometer size={15} color="#0ea5e9" />}
              value={!isNaN(ambientTemp) ? <>{Math.round(ambientTemp)}<span style={{ fontSize: 14, color: '#475569', fontWeight: 600 }}>°C</span></> : <span style={{ fontSize: 25, color: '#64748b', fontWeight: 800 }}>--°C</span>}
              accent="#0ea5e9"
              visual={
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: '#334155', marginBottom: 2, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                      <span>AMBIENT</span>
                      <span style={{ fontWeight: 800, color: '#0284c7' }}>{!isNaN(ambientTemp) ? `${Math.round(ambientTemp)}°C` : '---'}</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: '#e2e8f0', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: !isNaN(ambientTemp) ? `${Math.min(100, Math.max(10, (ambientTemp / 50) * 100))}%` : '0%', background: '#0284c7', borderRadius: 2 }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: '#334155', marginBottom: 2, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                      <span>MOTOR POWERTRAIN</span>
                      <span style={{ fontWeight: 800, color: latest && latest.motor_temp_c > 75 ? '#ef4444' : '#059669' }}>
                        {latest ? `${Math.round(latest.motor_temp_c)}°C` : '---'}
                      </span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: '#e2e8f0', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: latest ? `${Math.min(100, (latest.motor_temp_c / 120) * 100)}%` : '0%', background: latest && latest.motor_temp_c > 75 ? '#ef4444' : '#10b981', borderRadius: 2 }} />
                    </div>
                  </div>
                </div>
              }
              onClick={() => setOpenCard('temp')} P={P} L9={L9} SB={SB} V={V} />

            <StatCard title="Drive Mode" subtitle="Powertrain Dynamics"
              icon={<Gauge size={15} color={mconf.accent} />}
              value={<span style={{ fontSize: 24, fontWeight: 900, color: mconf.accent }}>{driveMode}</span>}
              valueColor={mconf.accent} accent={mconf.accent}
              visual={
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 3 }} onClick={e => e.stopPropagation()}>
                    {[
                      { name: 'ECO', modeVal: 'Eco', col: '#10b981' },
                      { name: 'NORM', modeVal: 'Healthy', col: '#0ea5e9' },
                      { name: 'SPORT', modeVal: 'Sport', col: '#f59e0b' },
                      { name: 'ALERT', modeVal: 'Battery Overheating', col: '#ef4444' }
                    ].map(seg => {
                      const isCur = (
                        (seg.name === 'ECO' && mode === 'Eco') ||
                        (seg.name === 'NORM' && (mode === 'Healthy' || mode === 'Heavy Traffic' || mode === 'Charging')) ||
                        (seg.name === 'SPORT' && mode === 'Sport') ||
                        (seg.name === 'ALERT' && (mode === 'Battery Overheating' || mode === 'Motor Fault' || mode === 'Low Battery'))
                      )
                      return (
                        <button
                          key={seg.name}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleForceMode(seg.modeVal)
                          }}
                          style={{
                            padding: '3px 0', textAlign: 'center', borderRadius: 4,
                            fontSize: 8.5, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace",
                            background: isCur ? `${seg.col}22` : '#f8fafc',
                            color: isCur ? seg.col : '#64748b',
                            border: `1.5px solid ${isCur ? seg.col : '#e2e8f0'}`,
                            boxShadow: isCur ? `0 0 6px ${seg.col}44` : 'none',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {seg.name}
                        </button>
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: '#334155', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                    <span>TORQUE: {mode === 'Sport' ? '40/60 REAR' : mode === 'Eco' ? '100% REAR' : '50/50 AWD'}</span>
                    <span style={{ color: latest ? mconf.color : '#64748b', fontWeight: 800 }}>● {latest ? 'CAN-BUS SYNC' : 'OFFLINE'}</span>
                  </div>
                </div>
              }
              onClick={() => setOpenCard('mode')} P={P} L9={L9} SB={SB} V={V} />

            <StatCard title="Est. Range" subtitle={mode === 'Charging' ? 'Time to full' : 'Distance remaining'}
              icon={<Map size={15} color="#0ea5e9" />}
              value={latest ? (mode === 'Charging'
                ? <>{Math.round(((100 - latest.battery_pct) / 100) * 60)}<span style={{ fontSize: 14, color: '#475569', fontWeight: 600 }}> min</span></>
                : <>{Math.round(latest.range_km)}<span style={{ fontSize: 14, color: '#475569', fontWeight: 600 }}> km</span></>)
                : <span style={{ fontSize: 25, color: '#64748b', fontWeight: 800 }}>-- km</span>}
              accent="#0ea5e9"
              visual={
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <div style={{ height: 5, borderRadius: 2.5, background: '#e2e8f0', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: latest ? `${Math.min(100, (latest.range_km / 500) * 100)}%` : '0%',
                      background: 'linear-gradient(90deg, #0284c7 0%, #38bdf8 100%)',
                      borderRadius: 2.5
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: '#334155', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                    <span>CITY: {latest ? `${Math.round(latest.range_km * 1.08)} km` : '---'}</span>
                    <span>HWY: {latest ? `${Math.round(latest.range_km * 0.88)} km` : '---'}</span>
                    <span style={{ color: '#0284c7', fontWeight: 800 }}>{latest ? `${Math.round(135 + latest.speed_kmh * 0.7)} Wh/km` : '--- Wh/km'}</span>
                  </div>
                </div>
              }
              onClick={() => setOpenCard('range')} P={P} L9={L9} SB={SB} V={V} />

            <StatCard title="Drive Score" subtitle={isPro ? (latest ? ds.label : 'Waiting for Telemetry...') : 'AI Driver Rating'}
              icon={<Star size={15} color="#f59e0b" fill={isPro ? '#f59e0b' : 'none'} />}
              value={isPro ? (latest && !isNaN(ds.score) ? <>{ds.score}<span style={{ fontSize: 14, color: '#475569', fontWeight: 600 }}>/10</span></> : <span style={{ fontSize: 25, color: '#64748b', fontWeight: 800 }}>--/10</span>) : <span style={{ fontSize: 16, color: '#b45309', fontWeight: 800 }}>PRO AI</span>}
              valueColor={isPro && latest && !isNaN(ds.score) ? (ds.score >= 8 ? '#10b981' : ds.score >= 6 ? '#f59e0b' : '#ef4444') : undefined} accent="#f59e0b"
              visual={
                !isPro ? (
                  <ProLockedCard
                    title="AI Telemetry Rating"
                    desc="Unlock multi-factor neural driving score & coaching"
                    onUnlock={() => togglePro(true)}
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 9.5, padding: '2px 8px', borderRadius: 10, background: 'rgba(245,158,11,0.15)', color: '#b45309', fontWeight: 800, fontFamily: "'JetBrains Mono', monospace" }}>
                        {latest && !isNaN(ds.score) ? ds.label : 'Waiting for Telemetry...'}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 3 }}>
                      {[
                        { name: 'SMOOTH', pct: latest ? 92 : 0 },
                        { name: 'REGEN', pct: latest ? 88 : 0 },
                        { name: 'SPEED', pct: latest && latest.speed_kmh > 100 ? 70 : 96 },
                        { name: 'THERM', pct: latest && latest.motor_temp_c > 75 ? 65 : 98 },
                      ].map(p => (
                        <div key={p.name} style={{ height: 4, borderRadius: 2, background: '#e2e8f0', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${p.pct}%`, background: p.pct > 80 ? '#10b981' : p.pct > 70 ? '#f59e0b' : '#ef4444' }} />
                        </div>
                      ))}
                    </div>
                  </div>
                )
              }
              onClick={() => {
                if (!isPro) {
                  togglePro(true)
                } else {
                  setOpenCard('score')
                }
              }} P={P} L9={L9} SB={SB} V={V} />

          </motion.div>


          {/* Card Modals */}
          <AnimatePresence>
            {openCard === 'battery' && (
              <CardModal title="High-Voltage Battery & BMS" icon={<Battery size={16} color="#10b981" />} accent="#10b981" onClose={() => setOpenCard(null)}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* SoC Hero */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '16px 18px', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: '#64748b', textTransform: 'uppercase', fontFamily: 'monospace' }}>
                        STATE OF CHARGE (SoC)
                      </div>
                      <div style={{ fontSize: 48, fontWeight: 800, color: latest && latest.battery_pct < 20 ? '#ef4444' : '#0f172a', fontFamily: 'monospace', lineHeight: 1.1, marginTop: 4 }}>
                        {latest ? Math.round(latest.battery_pct) : 0}<span style={{ fontSize: 20, color: '#64748b', fontWeight: 500 }}>%</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                      <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'rgba(16, 185, 129, 0.1)', color: '#059669', fontWeight: 700, fontFamily: 'monospace' }}>
                        800V DC ARCHITECTURE
                      </span>
                      <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: 'rgba(2, 132, 199, 0.1)', color: '#0284c7', fontWeight: 700, fontFamily: 'monospace' }}>
                        SoH: 98.4% (OPTIMAL)
                      </span>
                    </div>
                  </div>

                  {/* High-Precision Battery Level Bar */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 6, fontFamily: 'monospace' }}>
                      <span>0 kWh (0%)</span>
                      <span>CAPACITY: {latest ? `${((latest.battery_pct / 100) * 82).toFixed(1)} / 82.0 kWh` : '--- / 82.0 kWh'}</span>
                      <span>100%</span>
                    </div>
                    <div style={{ height: 10, borderRadius: 5, background: '#e2e8f0', overflow: 'hidden' }}>
                      <motion.div
                        style={{
                          height: '100%',
                          borderRadius: 5,
                          background: latest && latest.battery_pct < 20 ? '#ef4444' : 'linear-gradient(90deg, #0284c7 0%, #10b981 100%)',
                        }}
                        animate={{ width: `${latest?.battery_pct ?? 0}%` }}
                        transition={{ duration: 0.8 }}
                      />
                    </div>
                  </div>

                  {/* 12-Cell Micro BMS Balancer Array */}
                  <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#334155', fontFamily: 'monospace' }}>
                        CELL VOLTAGE BALANCE MATRIX (96s PACK)
                      </span>
                      <span style={{ fontSize: 10, color: latest ? (latest.max_cell_voltage_delta && latest.max_cell_voltage_delta > 30 ? '#ef4444' : '#059669') : '#94a3b8', fontWeight: 700, fontFamily: 'monospace' }}>
                        DELTA: {latest?.max_cell_voltage_delta != null ? `${latest.max_cell_voltage_delta} mV (${latest.max_cell_voltage_delta > 30 ? 'IMBALANCE' : 'BALANCED'})` : (latest ? 'MEASURING' : '--- mV')}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 4 }}>
                      {Array.from({ length: 12 }, (_, i) => {
                        const cellV = latest
                          ? (3.2 + (latest.battery_pct / 100) * 0.95 + ((i % 4) * (latest.max_cell_voltage_delta ?? 12) / 1000)).toFixed(2)
                          : '---'
                        return (
                          <div
                            key={i}
                            title={latest ? `Cell Bank #${i + 1}: ${cellV}V` : 'Cell Bank: Offline'}
                            style={{
                              height: 18,
                              borderRadius: 3,
                              background: latest ? (latest.battery_temp_c > 50 ? '#fca5a5' : '#86efac') : '#f1f5f9',
                              border: `1px solid ${latest ? (latest.battery_temp_c > 50 ? '#ef4444' : '#22c55e') : '#e2e8f0'}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 8,
                              fontWeight: 700,
                              color: latest ? '#0f172a' : '#94a3b8',
                              fontFamily: 'monospace',
                            }}
                          >
                            {cellV}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Telemetry Stats Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[
                      { label: 'Pack Voltage', val: latest ? `${Math.round(96 * (3.3 + (latest.battery_pct / 100) * 0.85))} V` : '--- V', col: '#0f172a' },
                      {
                        label: 'Battery Temp',
                        val: latest ? `${Math.round(latest.battery_temp_c)}°C` : '--- °C',
                        col: latest && latest.battery_temp_c > 50 ? '#ef4444' : latest && latest.battery_temp_c > 40 ? '#f59e0b' : '#059669'
                      },
                      {
                        label: 'Charge Flow',
                        val: latest ? (mode === 'Charging' ? `${((latest.charging_rate_w ?? 0) / 1000).toFixed(1)} kW (DC Fast)` : '0.0 kW (Discharge)') : '--- kW',
                        col: mode === 'Charging' ? '#0284c7' : '#64748b'
                      },
                      {
                        label: 'Power Status',
                        val: latest ? (mode === 'Charging' ? '⚡ FAST CHARGING' : mode === 'Low Battery' ? '⚠️ CRITICAL RESERVE' : '✓ NORMAL DISCHARGE') : 'OFFLINE',
                        col: mode === 'Charging' ? '#0284c7' : mode === 'Low Battery' ? '#ef4444' : '#059669'
                      },
                    ].map(r => (
                      <div key={r.label} style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: 11, color: '#64748b', fontFamily: 'sans-serif', marginBottom: 2 }}>{r.label}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: r.col, fontFamily: 'monospace' }}>{r.val}</div>
                      </div>
                    ))}
                  </div>

                  {/* Interactive Quick Charging Actions */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <button
                      type="button"
                      onClick={() => handleForceMode(mode === 'Charging' ? 'Healthy' : 'Charging')}
                      style={{
                        flex: 1, padding: '10px 14px', borderRadius: 8,
                        background: mode === 'Charging' ? '#fef2f2' : '#f0fdf4',
                        border: `1px solid ${mode === 'Charging' ? '#fca5a5' : '#86efac'}`,
                        color: mode === 'Charging' ? '#dc2626' : '#15803d',
                        fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        fontFamily: 'monospace'
                      }}
                    >
                      {mode === 'Charging' ? '⏹ STOP FAST CHARGE' : '⚡ SIMULATE 350kW DC FAST CHARGE'}
                    </button>
                    <button
                      type="button"
                      onClick={() => toast.success("Battery Pack Thermal Conditioning Engaged", { description: "Active coolant loops regulating pack to optimal 28°C." })}
                      style={{
                        padding: '10px 14px', borderRadius: 8,
                        background: '#f8fafc', border: '1px solid #cbd5e1',
                        color: '#0369a1', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        fontFamily: 'monospace'
                      }}
                    >
                      ❄️ THERMAL PRECONDITION
                    </button>
                  </div>
                </div>
              </CardModal>
            )}

            {openCard === 'temp' && (
              <CardModal title="Ambient Conditions & Aerodynamics" icon={<Thermometer size={16} color="#0ea5e9" />} accent="#0ea5e9" onClose={() => setOpenCard(null)}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Ambient Temp Hero */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', borderRadius: 12, border: '1px solid #bae6fd' }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: '#0369a1', textTransform: 'uppercase', fontFamily: 'monospace' }}>
                        OUTSIDE AMBIENT TEMPERATURE
                      </div>
                      <div style={{ fontSize: 44, fontWeight: 800, color: '#0284c7', fontFamily: 'monospace', lineHeight: 1.1, marginTop: 4 }}>
                        {!isNaN(ambientTemp) ? <>{Math.round(ambientTemp)}<span style={{ fontSize: 20, color: '#0369a1', fontWeight: 500 }}>°C</span></> : <span style={{ fontSize: 32, color: '#94a3b8' }}>--°C</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, background: '#ffffff', color: '#0284c7', fontWeight: 700, border: '1px solid #bae6fd' }}>
                        {!isNaN(ambientTemp) ? (ambientTemp < 18 ? '❄️ COOL DENSE AIR' : ambientTemp < 28 ? '☀️ OPTIMAL CONDITIONS' : '🔥 ELEVATED THERMAL LOAD') : '◌ TELEMETRY STANDBY'}
                      </span>
                    </div>
                  </div>

                  {/* Aerodynamics & Environmental Impact Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[
                      { label: 'Headwind Velocity', val: latest?.headwind_kmh != null ? `${latest.headwind_kmh} km/h` : '--- km/h', detail: 'Opposing aerodynamic force' },
                      { label: 'Road Gradient', val: latest?.road_gradient_pct != null ? `${latest.road_gradient_pct > 0 ? '+' : ''}${latest.road_gradient_pct.toFixed(1)}%` : '---%', detail: 'Incline elevation load' },
                      { label: 'Drag Coefficient (Cd)', val: '0.208 Cd', detail: 'Low-slung sports silhouette' },
                      { label: 'Cabin HVAC Draw', val: latest?.cabin_climate_w != null ? `${Math.round(latest.cabin_climate_w)} W` : '--- W', detail: `Set to ${cabinTemp}°C Auto` },
                    ].map(item => (
                      <div key={item.label} style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>{item.label}</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>{item.val}</div>
                        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>{item.detail}</div>
                      </div>
                    ))}
                  </div>

                  {/* Range Impact Summary Banner */}
                  <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>
                      Net Aerodynamic & Climate Impact on Range:
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: isNaN(ambientTemp) ? '#94a3b8' : ambientTemp < 18 ? '#059669' : ambientTemp > 30 ? '#dc2626' : '#0284c7', fontFamily: 'monospace' }}>
                      {isNaN(ambientTemp) ? 'Standby (No Telemetry)' : ambientTemp < 18 ? '+2.4% (Dense air boost)' : ambientTemp > 30 ? '-2.8% (HVAC thermal load)' : 'Optimal (+0.0%)'}
                    </span>
                  </div>
                </div>
              </CardModal>
            )}

            {openCard === 'mode' && (
              <CardModal title="Drive Mode & Powertrain Dynamics" icon={<Gauge size={16} color={mconf.accent} />} accent={mconf.accent} onClose={() => setOpenCard(null)}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Current Active Mode Hero */}
                  <div style={{ textAlign: 'center', padding: '16px', background: `${mconf.color}10`, borderRadius: 12, border: `1px solid ${mconf.color}33` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: mconf.color, textTransform: 'uppercase', fontFamily: 'monospace' }}>
                      ACTIVE DRIVING PROFILE
                    </div>
                    <div style={{ fontSize: 32, fontWeight: 800, color: mconf.color, fontFamily: 'sans-serif', margin: '4px 0' }}>
                      {mode} Mode
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 8 }}>
                      <ModeSegments driveMode={driveMode} />
                    </div>
                  </div>

                  {/* Mode Dynamics Characteristics */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: '#64748b' }}>THROTTLE</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', fontFamily: 'monospace', marginTop: 2 }}>
                        {mode === 'Sport' ? '100% INSTANT' : mode === 'Eco' ? '45% DAMPENED' : '75% LINEAR'}
                      </div>
                    </div>
                    <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: '#64748b' }}>REGEN LEVEL</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', fontFamily: 'monospace', marginTop: 2 }}>
                        {mode === 'Eco' ? 'LEVEL 3 (MAX)' : mode === 'Sport' ? 'LEVEL 1 (MIN)' : 'LEVEL 2 (AUTO)'}
                      </div>
                    </div>
                    <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: '#64748b' }}>TORQUE BIAS</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', fontFamily: 'monospace', marginTop: 2 }}>
                        {mode === 'Sport' ? '40/60 REAR' : mode === 'Eco' ? '100% REAR' : '50/50 AWD'}
                      </div>
                    </div>
                  </div>

                  {/* 8 CCNS Vehicle Modes Grid */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', fontFamily: 'monospace' }}>
                        SIMULATE ESP32 VEHICLE STATE:
                      </div>
                      {forcedMode && (
                        <button
                          type="button"
                          onClick={() => handleForceMode(null)}
                          style={{
                            fontSize: 10, padding: '3px 8px', borderRadius: 4,
                            background: '#f1f5f9', border: '1px solid #cbd5e1',
                            color: '#475569', fontWeight: 700, cursor: 'pointer',
                            fontFamily: 'monospace'
                          }}
                        >
                          ↺ RESET TO LIVE TELEMETRY
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                      {(['Healthy', 'Eco', 'Sport', 'Heavy Traffic', 'Low Battery', 'Battery Overheating', 'Charging', 'Motor Fault'] as const).map(m => {
                        const isCurrent = mode === m
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => handleForceMode(m)}
                            style={{
                              padding: '10px 12px',
                              borderRadius: 8,
                              background: isCurrent ? `${modeOf(m).color}18` : '#f8fafc',
                              border: `1.5px solid ${isCurrent ? modeOf(m).color : '#e2e8f0'}`,
                              color: isCurrent ? modeOf(m).color : '#334155',
                              fontSize: 12,
                              fontWeight: isCurrent ? 700 : 500,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              transition: 'all 0.15s',
                              boxShadow: isCurrent ? `0 2px 8px ${modeOf(m).color}33` : 'none'
                            }}
                          >
                            <span>{m}</span>
                            {isCurrent && <span style={{ width: 8, height: 8, borderRadius: '50%', background: modeOf(m).color }} />}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* CAN Bus Fault Code Readout */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: 12, color: '#64748b', fontFamily: 'sans-serif' }}>CAN-Bus Diagnostic Fault:</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: latest?.fault_code ? '#ef4444' : '#059669', fontFamily: 'monospace' }}>
                      {latest?.fault_code ? `0x${latest.fault_code.toString(16).toUpperCase()} (CRITICAL FAULT)` : '0x00 (SYSTEM HEALTHY)'}
                    </span>
                  </div>
                </div>
              </CardModal>
            )}

            {openCard === 'range' && (
              <CardModal title="Range Estimation & Navigation" icon={<Map size={16} color="#0ea5e9" />} accent="#0ea5e9" onClose={() => setOpenCard(null)}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Range Hero */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: '#64748b', textTransform: 'uppercase', fontFamily: 'monospace' }}>
                        PROJECTED DRIVING RANGE
                      </div>
                      <div style={{ fontSize: 48, fontWeight: 800, color: '#0f172a', fontFamily: 'monospace', lineHeight: 1.1, marginTop: 4 }}>
                        {latest ? <>{Math.round(latest.range_km)}<span style={{ fontSize: 20, color: '#0284c7', fontWeight: 500 }}> km</span></> : <span style={{ fontSize: 32, color: '#94a3b8' }}>-- km</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, background: 'rgba(2, 132, 199, 0.1)', color: '#0284c7', fontWeight: 700, fontFamily: 'monospace' }}>
                        EFFICIENCY: {latest ? `${Math.round(135 + latest.speed_kmh * 0.7)} Wh/km` : '--- Wh/km'}
                      </span>
                    </div>
                  </div>

                  {/* Dual Projection: Urban vs Highway */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{ padding: '14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>CITY / URBAN (REGEN ACTIVE)</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#059669', fontFamily: 'monospace' }}>
                        {latest ? `${Math.round(latest.range_km * 1.08)} km` : '--- km'}
                      </div>
                      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>High stop-start energy harvesting</div>
                    </div>
                    <div style={{ padding: '14px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>HIGHWAY (120 KM/H CRUISE)</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#0284c7', fontFamily: 'monospace' }}>
                        {latest ? `${Math.round(latest.range_km * 0.88)} km` : '--- km'}
                      </div>
                      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4 }}>Aerodynamic continuous drag profile</div>
                    </div>
                  </div>

                  {/* Nearest High-Power Fast Charger Guidance */}
                  <div style={{ padding: '14px 16px', background: latest && mode === 'Low Battery' ? '#fef2f2' : '#f0f9ff', borderRadius: 10, border: `1px solid ${latest && mode === 'Low Battery' ? '#fecaca' : '#bae6fd'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: latest && mode === 'Low Battery' ? '#b91c1c' : '#0369a1' }}>
                        {latest?.mode === 'Charging' ? 'ACTIVE CHARGING SESSION' : 'NEAREST DC ULTRA-FAST CHARGER'}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: latest && mode === 'Low Battery' ? '#dc2626' : '#0284c7', fontFamily: 'monospace' }}>
                        {latest ? (latest.mode === 'Charging' ? `${((latest.charging_rate_w ?? 0)/1000).toFixed(1)} kW INGEST` : '4.2 km · 8 min') : 'OFFLINE'}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: '#334155', lineHeight: 1.5 }}>
                      {latest?.mode === 'Charging'
                        ? `Connected to 350 kW CCS2 station · Battery absorbing charge at ${((latest.charging_rate_w ?? 0)/1000).toFixed(1)} kW.`
                        : latest
                          ? 'Ionity Hub #04 · 350 kW CCS2 Connector · 6 of 8 stalls available.'
                          : 'Awaiting vehicle telemetry connection...'}
                    </div>
                    {latest && (
                      <div style={{ fontSize: 10, color: '#0284c7', marginTop: 6, fontWeight: 600 }}>
                        {latest.battery_temp_c > 45 ? '⚠️ Battery cooling system engaged for thermal management' : '✓ Battery Thermal Preconditioning Active for Fast Charge Ingestion'}
                      </div>
                    )}
                  </div>
                </div>
              </CardModal>
            )}

            {openCard === 'score' && (
              <CardModal title="Drive Score & Telemetry Coaching" icon={<Star size={16} color="#f59e0b" fill="#f59e0b" />} accent="#f59e0b" onClose={() => setOpenCard(null)}>
                {!isPro ? (
                  <ProLockedModal
                    title="Driver Telemetry Rating"
                    feature="Neural Driver Performance Score"
                    desc="Multi-factor neural evaluation analyzing acceleration smoothness, kinetic regeneration recapture, speed threshold compliance, and CAN-bus inverter thermal protection."
                    benefits={[
                      "Multi-factor scoring on 10-point scale",
                      "Instant driver coaching prompts and throttle guidance",
                      "Thermal stress warnings & efficiency penalties"
                    ]}
                    onUnlock={() => togglePro(true)}
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Score Hero */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 20px', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: '#64748b', textTransform: 'uppercase', fontFamily: 'monospace' }}>
                          AI DRIVER PERFORMANCE RATING
                        </div>
                        <div style={{ fontSize: 48, fontWeight: 800, color: ds.score >= 8 ? '#059669' : ds.score >= 6 ? '#f59e0b' : '#dc2626', fontFamily: 'monospace', lineHeight: 1.1, marginTop: 4 }}>
                          {!isNaN(ds.score) ? <>{ds.score}<span style={{ fontSize: 20, color: '#64748b', fontWeight: 500 }}>/10</span></> : <span style={{ fontSize: 32, color: '#94a3b8' }}>--/10</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, background: 'rgba(245, 158, 11, 0.12)', color: '#d97706', fontWeight: 700 }}>
                          {ds.label}
                        </span>
                      </div>
                    </div>

                    {/* 4 Score Performance Pillars */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {[
                        { label: 'Acceleration Smoothness', score: latest ? 9.4 : 0, color: '#10b981' },
                        { label: 'Regenerative Energy Recovery', score: latest ? 8.8 : 0, color: '#0ea5e9' },
                        { label: 'Speed Discipline & Limits', score: latest ? (latest.speed_kmh > 100 ? 7.2 : 9.6) : 0, color: latest && latest.speed_kmh > 100 ? '#f59e0b' : '#10b981' },
                        { label: 'Powertrain Thermal Protection', score: latest ? (latest.motor_temp_c > 75 ? 7.0 : 9.8) : 0, color: latest && latest.motor_temp_c > 75 ? '#ef4444' : '#10b981' },
                      ].map(p => (
                        <div key={p.label} style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                            <span style={{ fontWeight: 600, color: '#334155' }}>{p.label}</span>
                            <span style={{ fontWeight: 700, color: p.color, fontFamily: 'monospace' }}>{latest ? `${p.score.toFixed(1)} / 10` : '--- / 10'}</span>
                          </div>
                          <div style={{ height: 6, borderRadius: 3, background: '#e2e8f0', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${p.score * 10}%`, background: p.color, borderRadius: 3 }} />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* AI Coaching Tip */}
                    <div style={{ padding: '12px 16px', background: '#fffbeb', borderRadius: 8, border: '1px solid #fef3c7', fontSize: 12, color: '#92400e', lineHeight: 1.5 }}>
                      💡 <strong>CVIS Coaching:</strong> {latest ? (latest.speed_kmh > 100
                        ? 'Cruising at elevated speeds increases aerodynamic draw. Lowering speed by 10 km/h will gain +14 km of range.'
                        : 'Excellent throttle modulation! Your regenerative braking recovery is currently capturing 88% of deceleration inertia.')
                        : 'Awaiting telemetry feed to generate personalized driver coaching.'}
                    </div>
                  </div>
                )}
              </CardModal>
            )}

            {openCard === 'tires' && (
              <CardModal title="Tire Pressure Monitoring System (TPMS)" icon={<span style={{ fontSize: 16 }}>🛞</span>} accent="#10b981" onClose={() => setOpenCard(null)}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Top-Down Supercar Chassis Wireframe */}
                  <div style={{ position: 'relative', width: '100%', height: 180, background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg viewBox="0 0 300 160" style={{ width: '100%', height: '100%' }}>
                      {/* Car Body Blueprint Outline */}
                      <path
                        d="M 100 20 C 130 18 170 18 200 20 C 220 25 240 45 245 75 C 248 100 240 135 220 145 C 190 148 110 148 80 145 C 60 135 52 100 55 75 C 60 45 80 25 100 20 Z"
                        fill="rgba(2, 132, 199, 0.04)"
                        stroke="#0284c7"
                        strokeWidth="1.5"
                      />
                      {/* Center Chassis Spine */}
                      <line x1="150" y1="20" x2="150" y2="145" stroke="rgba(2, 132, 199, 0.2)" strokeWidth="1" strokeDasharray="3 3" />
                      <line x1="70" y1="50" x2="230" y2="50" stroke="rgba(2, 132, 199, 0.15)" strokeWidth="1" />
                      <line x1="70" y1="115" x2="230" y2="115" stroke="rgba(2, 132, 199, 0.15)" strokeWidth="1" />

                      {/* 4 Wheels */}
                      {/* Front-Left */}
                      <rect x="42" y="32" width="22" height="38" rx="4" fill="#0284c7" opacity="0.15" stroke="#0284c7" strokeWidth="1.5" />
                      {/* Front-Right */}
                      <rect x="236" y="32" width="22" height="38" rx="4" fill="#0284c7" opacity="0.15" stroke="#0284c7" strokeWidth="1.5" />
                      {/* Rear-Left */}
                      <rect x="42" y="96" width="22" height="38" rx="4" fill="#0284c7" opacity="0.15" stroke="#0284c7" strokeWidth="1.5" />
                      {/* Rear-Right */}
                      <rect x="236" y="96" width="22" height="38" rx="4" fill="#0284c7" opacity="0.15" stroke="#0284c7" strokeWidth="1.5" />
                    </svg>

                    {/* Overlay PSI Callouts */}
                    <div style={{ position: 'absolute', top: 38, left: 16, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700, fontFamily: 'monospace', color: tires.fl != null && tires.fl < 30 ? '#ef4444' : tires.fl != null ? '#059669' : '#94a3b8' }}>
                      FL: {tires.fl != null ? `${tires.fl} PSI` : '--- PSI'}
                    </div>
                    <div style={{ position: 'absolute', top: 38, right: 16, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700, fontFamily: 'monospace', color: tires.fr != null && tires.fr < 30 ? '#ef4444' : tires.fr != null ? '#059669' : '#94a3b8' }}>
                      FR: {tires.fr != null ? `${tires.fr} PSI` : '--- PSI'}
                    </div>
                    <div style={{ position: 'absolute', bottom: 38, left: 16, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700, fontFamily: 'monospace', color: tires.rl != null && tires.rl < 30 ? '#ef4444' : tires.rl != null ? '#059669' : '#94a3b8' }}>
                      RL: {tires.rl != null ? `${tires.rl} PSI` : '--- PSI'}
                    </div>
                    <div style={{ position: 'absolute', bottom: 38, right: 16, background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700, fontFamily: 'monospace', color: tires.rr != null && tires.rr < 30 ? '#ef4444' : tires.rr != null ? '#059669' : '#94a3b8' }}>
                      RR: {tires.rr != null ? `${tires.rr} PSI` : '--- PSI'}
                    </div>
                  </div>

                  {/* Individual Wheel Telemetry Rows */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {[
                      { pos: 'Front Left (FL)', psi: tires.fl },
                      { pos: 'Front Right (FR)', psi: tires.fr },
                      { pos: 'Rear Left (RL)', psi: tires.rl },
                      { pos: 'Rear Right (RR)', psi: tires.rr },
                    ].map(w => {
                      const isLow = w.psi != null && w.psi < 30
                      const isHigh = w.psi != null && w.psi > 36
                      const col = w.psi == null ? '#94a3b8' : isLow ? '#ef4444' : isHigh ? '#f59e0b' : '#059669'
                      return (
                        <div key={w.pos} style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: `1px solid ${col}44` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#334155' }}>{w.pos}</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: col, fontFamily: 'monospace' }}>{w.psi != null ? `${w.psi} PSI` : '--- PSI'}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b' }}>
                            <span>Status</span>
                            <span>{w.psi != null ? (isLow ? '⚠️ LOW PRESSURE' : isHigh ? '⚠️ HIGH' : '✓ OPTIMAL') : 'NO DATA'}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Alignment & Telemetry Status Readout */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 11, color: '#475569', fontFamily: 'monospace' }}>
                    <span>TPMS PROTOCOL: CAN-BUS ACTIVE</span>
                    <span>STATUS: {tires.fl != null ? 'STREAMING' : 'STANDBY'}</span>
                  </div>
                </div>
              </CardModal>
            )}
          </AnimatePresence>

          {/* ROW 2 — symmetrical 3-column grid (330px 1fr 330px) */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.13 }}
            style={{ display: 'grid', gridTemplateColumns: '330px 1fr 330px', gap: 16, alignItems: 'start' }}>
            
            {/* Left col: 4 cards, each 148px high, matching right col */}
            <div style={{ display: 'grid', gridTemplateRows: 'repeat(4, 148px)', gap: 16 }}>

              {/* 1. TPMS 4-Wheel Card */}
              <StatCard title="Tire Pressure" subtitle="4-Wheel Monitoring"
                icon={<span style={{ fontSize: 15 }}>🛞</span>}
                value={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 15, color: latest ? (Object.values(tires).some(p => p !== null && p < 30) ? '#ef4444' : '#10b981') : '#64748b', fontWeight: 800 }}>
                      {latest ? (Object.values(tires).some(p => p !== null && p < 30) ? 'PRESSURE LOW' : 'ALL OPTIMAL') : 'OFFLINE'}
                    </span>
                    <span style={{ fontSize: 11, color: '#334155', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                      {tires.fl != null ? `• ${tires.fl}/${tires.fr}/${tires.rl}/${tires.rr} PSI` : '• --- PSI'}
                    </span>
                  </div>
                }
                accent="#10b981"
                visual={
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: '6px 10px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                    <span style={{ color: tires.fl != null && tires.fl < 30 ? '#ef4444' : '#059669' }}>FL: {tires.fl != null ? `${tires.fl} PSI` : '---'}</span>
                    <span style={{ color: tires.fr != null && tires.fr < 30 ? '#ef4444' : '#059669', textAlign: 'right' }}>FR: {tires.fr != null ? `${tires.fr} PSI` : '---'}</span>
                    <span style={{ color: tires.rl != null && tires.rl < 30 ? '#ef4444' : '#059669' }}>RL: {tires.rl != null ? `${tires.rl} PSI` : '---'}</span>
                    <span style={{ color: tires.rr != null && tires.rr < 30 ? '#ef4444' : '#059669', textAlign: 'right' }}>RR: {tires.rr != null ? `${tires.rr} PSI` : '---'}</span>
                  </div>
                }
                onClick={() => setOpenCard('tires')} P={P} L9={L9} SB={SB} V={V} />

              {/* 2. Key Suggestions (Pro Gated) */}
              <StatCard title="Key Suggestions" subtitle="AI Driving Insights"
                icon={<BrainCircuit size={15} color={isPro ? '#0ea5e9' : '#94a3b8'} />}
                value={latest ? (isPro ? <span style={{ fontSize: 15, color: '#0284c7', fontWeight: 800 }}>{keySugs.length} tips active</span> : <span style={{ fontSize: 15, color: '#b45309', fontWeight: 800 }}>PRO AI</span>) : <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 700 }}>STANDBY</span>}
                accent="#0ea5e9"
                visual={
                  !latest ? (
                    <div style={{ fontSize: 10, color: '#94a3b8', textAlign: 'center', padding: '8px 0' }}>Awaiting telemetry feed...</div>
                  ) : !isPro ? (
                    <ProLockedCard
                      title="AI Neural Insights"
                      desc="Multi-factor telemetry recommendations"
                      onUnlock={() => togglePro(true)}
                    />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {keySugs.slice(0, 2).map((s, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 10 }}>
                          <span style={{ color: '#0f172a', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {s.icon} {s.title}
                          </span>
                          <span style={{ fontSize: 8.5, padding: '2px 5px', borderRadius: 4, background: s.priority === 'high' ? '#fee2e2' : '#fef3c7', color: s.priority === 'high' ? '#dc2626' : '#b45309', fontWeight: 800, fontFamily: 'monospace' }}>
                            {s.priority.toUpperCase()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                }
                onClick={() => {
                  if (!isPro) {
                    togglePro(true)
                  } else {
                    setOpenCard('suggestions')
                  }
                }} P={P} L9={L9} SB={SB} V={V} />

              {/* 3. Speed Analytics — PROPER AUTOMOTIVE SPEED SHOWER (148px height) */}
              <motion.div
                initial="rest"
                whileHover="hover"
                whileTap="tap"
                variants={{
                  rest: { scale: 1, y: 0, boxShadow: '0 2px 8px rgba(15,23,42,0.04)' },
                  hover: { scale: 1.015, y: -3, boxShadow: '0 10px 20px -3px rgba(15,23,42,0.08)' },
                  tap: { scale: 0.985, y: 0 }
                }}
                style={{
                  ...P,
                  cursor: 'pointer',
                  position: 'relative',
                  borderBottom: `3px solid ${mconf.accent}`,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'border-color 0.2s',
                  padding: '13px 16px 11px',
                  height: 148,
                  boxSizing: 'border-box'
                }}
                onClick={() => setOpenCard('speed')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 30, height: 30, borderRadius: 8,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: `${mconf.accent}14`, border: `1px solid ${mconf.accent}30`,
                    flexShrink: 0
                  }}>
                    <Gauge size={15} color={mconf.accent} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, flex: 1 }}>
                    <span style={L9}>Speed Analytics</span>
                    <span style={SB}>Automotive Speed Shower</span>
                  </div>
                  <motion.div variants={{ rest: { x: 0, opacity: 0.4 }, hover: { x: 3, opacity: 1 } }} style={{ marginLeft: 'auto', flexShrink: 0 }}>
                    <ChevronRight size={14} color={mconf.accent} />
                  </motion.div>
                </div>
                <SpeedShowerGauge
                  speed={latest?.speed_kmh ?? 0}
                  maxSpeed={maxSpeed}
                  accent={mconf.accent}
                  isAwaiting={!latest}
                />
              </motion.div>

              {/* 4. Cabin Climate */}
              <StatCard title="Cabin Climate" subtitle={`${climateMode} • Target ${cabinTemp}°C`}
                icon={<Wind size={15} color="#0ea5e9" />}
                value={
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <span>{cabinTemp}<span style={{ fontSize: 14, color: '#475569', fontWeight: 600 }}> °C</span></span>
                    <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setCabinTemp(t => Math.max(16, t - 1))
                        }}
                        style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#0f172a' }}
                      >-</button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setCabinTemp(t => Math.min(30, t + 1))
                        }}
                        style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#0f172a' }}
                      >+</button>
                    </div>
                  </div>
                }
                valueColor="#0f172a" accent="#0ea5e9"
                visual={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#334155' }}>
                    <span>HVAC DRAW: {latest ? `${Math.round(latest.cabin_climate_w ?? 0)} W` : '--- W'}</span>
                    <span style={{ color: '#0284c7', fontWeight: 800, background: '#e0f2fe', padding: '2px 6px', borderRadius: 4 }}>{climateMode.toUpperCase()}</span>
                  </div>
                }
                onClick={() => setOpenCard('climate')} P={P} L9={L9} SB={SB} V={V} />

            </div>

            {/* Centre — Route Map (exact 640px height to match 4 x 148px + 3 x 16px) */}
            <div style={{ ...P, height: 640, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '12px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 8, background: '#ffffff', zIndex: 10 }}>
                <Navigation size={14} color="#0284c7" />
                <div style={L9}>Live Route Map</div>
                <div style={{ ...SB, marginLeft: 4 }}>GPS &amp; turn-by-turn guidance</div>
              </div>
              <div style={{ flex: 1, position: 'relative', background: '#e2e8f0' }}>
                <LiveMap speed_kmh={latest?.speed_kmh ?? 0} />
              </div>
            </div>

            {/* Right col: 4 cards, each 148px high, matching left col */}
            <div style={{ display: 'grid', gridTemplateRows: 'repeat(4, 148px)', gap: 16 }}>

              {/* 1. Alerts */}
              <StatCard title="Vehicle Alerts" subtitle="Real-time Health"
                icon={<AlertTriangle size={15} color={alerts.length > 0 ? '#ef4444' : '#10b981'} />}
                value={<span style={{ fontSize: 15, color: alerts.length > 0 ? '#ef4444' : '#10b981', fontWeight: 800 }}>{alerts.length > 0 ? `${alerts.length} ALERTS` : 'ALL CLEAR'}</span>}
                accent={alerts.length > 0 ? '#ef4444' : '#10b981'}
                visual={
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#334155' }}>
                    <span>{latest?.fault_code ? `0x${latest.fault_code.toString(16).toUpperCase()} FAULT` : 'NO ACTIVE FAULTS'}</span>
                    <span style={{ color: alerts.length > 0 ? '#ef4444' : '#059669', fontWeight: 800 }}>
                      ● {alerts.length > 0 ? 'ATTN REQUIRED' : 'NOMINAL'}
                    </span>
                  </div>
                }
                onClick={() => setOpenCard('alerts')} P={P} L9={L9} SB={SB} V={V} />

              {/* 2. AI Advisory */}
              <StatCard title="AI Advisory" subtitle="CVIS Intelligence"
                icon={<BrainCircuit size={15} color="#0284c7" />}
                value={<span style={{ fontSize: 15, color: '#0284c7', fontWeight: 800 }}>{aiRec ? 'Advisory Active' : 'Standby'}</span>}
                accent="#0ea5e9"
                visual={
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {aiRec ? aiRec.slice(0, 42) + '...' : (connected ? 'Awaiting multi-factor telemetry...' : 'Connecting to Edge AI...')}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#475569' }}>
                      <span>MODEL: LLAMA3.2:3B</span>
                      <span style={{ color: '#0284c7', fontWeight: 800 }}>EDGE REASONING</span>
                    </div>
                  </div>
                }
                onClick={() => setOpenCard('ai')} P={P} L9={L9} SB={SB} V={V} />

              {/* 3. Efficiency Graph (Pro Gated) */}
              <StatCard title="Efficiency Graph" subtitle={isPro ? 'Energy & Consumption' : 'Pro Feature'}
                icon={<TrendingUp size={15} color={isPro ? '#0284c7' : '#94a3b8'} />}
                value={isPro ? (latest ? <>{Math.round(135 + latest.speed_kmh * 0.7)}<span style={{ fontSize: 14, color: '#475569', fontWeight: 600 }}> Wh/km</span></> : <span style={{ fontSize: 25, color: '#64748b', fontWeight: 800 }}>--- Wh/km</span>) : <span style={{ fontSize: 15, color: '#b45309', fontWeight: 800 }}>PRO FEATURE</span>}
                accent="#0ea5e9"
                visual={
                  !isPro ? (
                    <ProLockedCard
                      title="Consumption Curves"
                      desc="Historical Wh/km efficiency graphs"
                      onUnlock={() => togglePro(true)}
                    />
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ height: 18, display: 'flex', alignItems: 'flex-end', gap: 2 }}>
                        {history.slice(-14).map((h, i) => {
                          const eff = Math.round(135 + h.speed * 0.7)
                          const hPct = Math.min(100, Math.max(15, ((eff - 100) / 150) * 100))
                          return (
                            <div key={i} style={{ flex: 1, height: `${hPct}%`, background: '#0ea5e9', borderRadius: '2px 2px 0 0', opacity: 0.4 + (i / 14) * 0.6 }} />
                          )
                        })}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#475569' }}>
                        <span>HISTORY ({history.length} pts)</span>
                        <span style={{ color: '#0284c7', fontWeight: 800 }}>TARGET: 140 Wh/km</span>
                      </div>
                    </div>
                  )
                }
                onClick={() => {
                  if (!isPro) {
                    togglePro(true)
                  } else {
                    setOpenCard('efficiency')
                  }
                }} P={P} L9={L9} SB={SB} V={V} />

              {/* 4. Power Flow */}
              <StatCard title="Power Flow" subtitle="Live Distribution"
                icon={<Zap size={15} color={mconf.accent} />}
                value={latest && !isNaN(totalKw) ? <>{Math.round(totalKw)}<span style={{ fontSize: 14, color: '#475569', fontWeight: 600 }}> kW</span></> : <span style={{ fontSize: 25, color: '#64748b', fontWeight: 800 }}>-- kW</span>}
                valueColor={mconf.accent} accent={mconf.accent}
                visual={
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ height: 6, borderRadius: 3, background: '#e2e8f0', position: 'relative', overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 2, background: '#64748b', zIndex: 2 }} />
                      <div style={{
                        height: '100%',
                        width: latest && !isNaN(totalKw) ? `${Math.min(100, (totalKw / 350) * 100)}%` : '0%',
                        background: mode === 'Charging' ? '#10b981' : 'linear-gradient(90deg, #0284c7 0%, #38bdf8 100%)',
                        borderRadius: 3
                      }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#334155' }}>
                      <span>{mode === 'Charging' ? '← REGEN INGEST' : 'POWER OUT →'}</span>
                      <span style={{ color: '#0f172a', fontWeight: 800 }}>{!isNaN(totalHp) ? `${totalHp} HP` : '--- HP'}</span>
                    </div>
                  </div>
                }
                onClick={() => setOpenCard('power')} P={P} L9={L9} SB={SB} V={V} />

            </div>

          </motion.div>

          {/* ROW 2 Modals */}
          <AnimatePresence>
            {openCard === 'suggestions' && (
              <CardModal title="AI Driving Insights & Recommendations" icon={<BrainCircuit size={16} color="var(--cyan)" />} accent="#0ea5e9" onClose={() => setOpenCard(null)}>
                {!isPro ? (
                  <ProLockedModal
                    title="CVIS Intelligence"
                    feature="Proactive AI Fleet & Driving Insights"
                    desc="Centralized Ollama llama3.2:3b model reasons over ambient temperature, battery pack thermal state, headwind, and cabin climate load to provide real-time recommendations."
                    benefits={[
                      "Real-time actionable multi-factor suggestions",
                      "Priority-classified warnings (Low / Med / High)",
                      "Dynamic range extension strategies per driving regime"
                    ]}
                    onUnlock={() => togglePro(true)}
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Top Advisory Banner */}
                    <div style={{ padding: '14px 16px', background: 'rgba(2, 132, 199, 0.08)', borderRadius: 10, border: '1px solid rgba(2, 132, 199, 0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <BrainCircuit size={16} color="#0284c7" />
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#0284c7', fontFamily: 'monospace' }}>
                          CVIS NEURAL ADVISORY (llama3.2:3b)
                        </span>
                      </div>
                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: '#ffffff', color: '#0284c7', fontWeight: 700, border: '1px solid rgba(2, 132, 199, 0.2)' }}>
                        GROUNDED TELEMETRY
                      </span>
                    </div>

                    {/* Suggestion Cards */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {keySugs.map((s, i) => {
                        const isHigh = s.priority === 'high'
                        const isMed = s.priority === 'med'
                        const borderCol = isHigh ? '#fca5a5' : isMed ? '#fde68a' : '#bae6fd'
                        const bgCol = isHigh ? 'rgba(239, 68, 68, 0.04)' : isMed ? 'rgba(245, 158, 11, 0.04)' : 'rgba(2, 132, 199, 0.04)'
                        const tagCol = isHigh ? '#dc2626' : isMed ? '#d97706' : '#0284c7'
                        const tagBg = isHigh ? 'rgba(239, 68, 68, 0.1)' : isMed ? 'rgba(245, 158, 11, 0.1)' : 'rgba(2, 132, 199, 0.1)'

                        return (
                          <div key={i} style={{ display: 'flex', gap: 14, padding: '14px 16px', background: bgCol, border: `1px solid ${borderCol}`, borderRadius: 10 }}>
                            <div style={{ fontSize: 24, lineHeight: 1 }}>{s.icon}</div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{s.title}</div>
                                <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: tagBg, color: tagCol, fontWeight: 700, fontFamily: 'monospace' }}>
                                  {s.priority.toUpperCase()} PRIORITY
                                </span>
                              </div>
                              <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}>{s.desc}</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </CardModal>
            )}

            {openCard === 'alerts' && (
              <CardModal title="Vehicle Health Diagnostics & Alerts" icon={<AlertTriangle size={16} color="#f59e0b" />} accent="#f59e0b" onClose={() => setOpenCard(null)}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {alerts.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', fontFamily: 'monospace', textTransform: 'uppercase' }}>
                        ACTIVE WARNINGS REQUIRING ATTENTION ({alerts.length})
                      </div>
                      {alerts.map(a => (
                        <div key={a.id} style={{ padding: '14px 16px', background: a.type === 'fault' ? '#fef2f2' : '#fffbeb', borderRadius: 10, border: `1px solid ${a.type === 'fault' ? '#fca5a5' : '#fde68a'}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: a.type === 'fault' ? '#dc2626' : '#d97706' }}>{a.msg}</span>
                            <span style={{ fontSize: 10, color: '#64748b', fontFamily: 'monospace' }}>{a.time}</span>
                          </div>
                          <div style={{ fontSize: 11, color: '#475569' }}>
                            {a.type === 'fault' ? 'Emergency intervention: Power output derated. Safely reduce speed.' : 'Subsystem advisory: Monitor telemetry values closely.'}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'rgba(16, 185, 129, 0.08)', borderRadius: 10, border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#10b981', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>
                          ✓
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>All Core Subsystems Operational</div>
                          <div style={{ fontSize: 11, color: '#475569' }}>Continuous CAN-bus telemetry polling active · 0 active faults</div>
                        </div>
                      </div>

                      {/* 6-Point Subsystem Checklist */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
                        {[
                          { name: '800V DC Battery Pack', status: latest?.max_cell_voltage_delta != null ? `BALANCED (${latest.max_cell_voltage_delta} mV)` : (latest ? 'BALANCED' : 'OFFLINE'), ok: !latest || (latest.max_cell_voltage_delta == null || latest.max_cell_voltage_delta <= 30) },
                          { name: 'Permanent Magnet Motor', status: latest ? `${Math.round(latest.motor_temp_c)}°C ${latest.motor_temp_c > 80 ? 'HIGH TEMP' : 'OPTIMAL'}` : 'OFFLINE', ok: !latest || latest.motor_temp_c <= 80 },
                          { name: 'SiC Power Inverter', status: latest ? (mode === 'Sport' ? 'PEAK DISCHARGE' : mode === 'Eco' ? 'ECO REGEN' : 'NOMINAL') : 'STANDBY', ok: true },
                          { name: 'HMAC-SHA256 Auth', status: latest ? 'CRYPTOGRAPHICALLY VALID' : 'OFFLINE', ok: !!latest },
                          { name: 'MQTT / HTTP Comms Layer', status: latest ? 'LOW LATENCY CONNECTED' : 'STANDBY', ok: !!latest },
                          { name: 'Vehicle Powertrain', status: latest?.fault_code ? `FAULT (0x${latest.fault_code.toString(16).toUpperCase()})` : (latest ? 'NOMINAL' : 'STANDBY'), ok: !latest?.fault_code },
                        ].map(sys => (
                          <div key={sys.name} style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: '#0f172a' }}>{sys.name}</div>
                            <div style={{ fontSize: 9.5, fontWeight: 700, color: sys.ok ? '#059669' : '#dc2626', fontFamily: 'monospace', marginTop: 2 }}>
                              {sys.ok ? '✓' : '⚠️'} {sys.status}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Interactive Alert Actions */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    {alerts.length > 0 || mode === 'Motor Fault' || mode === 'Battery Overheating' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setAlerts([])
                          handleForceMode('Healthy')
                          toast.success("All Diagnostic DTC Codes Cleared", { description: "Subsystems restored to normal CAN-bus operational parameters." })
                        }}
                        style={{
                          flex: 1, padding: '10px 14px', borderRadius: 8,
                          background: '#f0fdf4', border: '1px solid #86efac',
                          color: '#15803d', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          fontFamily: 'monospace'
                        }}
                      >
                        ✓ CLEAR DTC FAULTS & RESTORE HEALTHY
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          handleForceMode('Motor Fault')
                          toast.warning("Simulated CAN-Bus Motor Inverter Fault Triggered")
                        }}
                        style={{
                          flex: 1, padding: '10px 14px', borderRadius: 8,
                          background: '#fef2f2', border: '1px solid #fca5a5',
                          color: '#dc2626', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                          fontFamily: 'monospace'
                        }}
                      >
                        ⚠️ TEST INVERTER FAULT (DTC 0x07)
                      </button>
                    )}
                  </div>
                </div>
              </CardModal>
            )}

            {openCard === 'ai' && (
              <CardModal title="Centralized CVIS AI Advisory" icon={<BrainCircuit size={16} color="var(--cyan)" />} accent="#0ea5e9" onClose={() => setOpenCard(null)}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Status header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {aiTyping && <div className="typewriter-cursor" />}
                      <span style={{ fontSize: 12, color: '#0f172a', fontWeight: 600 }}>
                        {aiTyping ? 'Generating AI Recommendation...' : 'Live Ollama 3B Intelligence'}
                      </span>
                    </div>
                    <button
                      onClick={() => { requestRecommendation() }}
                      disabled={aiTyping || !latest}
                      style={{
                        background: '#0284c7',
                        border: 'none',
                        borderRadius: 6,
                        padding: '6px 14px',
                        fontSize: 11,
                        fontWeight: 700,
                        color: '#ffffff',
                        cursor: 'pointer',
                        fontFamily: 'monospace',
                        opacity: aiTyping ? 0.6 : 1,
                        boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)',
                      }}
                    >
                      ↻ REGENERATE
                    </button>
                  </div>

                  {/* Recommendation Content Box */}
                  <div style={{ padding: '18px 20px', background: '#ffffff', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13.5, color: '#1e293b', lineHeight: 1.7, minHeight: 140, maxHeight: 320, overflowY: 'auto', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                    {aiRec ? <FormattedAiText text={aiRec} /> : <span style={{ color: '#94a3b8' }}>{!connected ? '◌ Connecting to CVIS AI Edge Service...' : 'AI on standby — awaiting multi-factor telemetry snapshot.'}</span>}
                  </div>

                  {/* Grounding Parameters Bar */}
                  <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: '#64748b', fontFamily: 'monospace' }}>
                    <span>EVALUATED: SPEED {latest ? Math.round(latest.speed_kmh) : '---'} KM/H · SOC {latest ? Math.round(latest.battery_pct) : '---'}% · TEMP {latest ? Math.round(latest.motor_temp_c) : '---'}°C</span>
                    <span>MODEL: LLAMA3.2:3B</span>
                  </div>
                </div>
              </CardModal>
            )}

            {openCard === 'speed' && (
              <CardModal title="Speed & Powertrain Velocity Analytics" icon={<Gauge size={16} color={mconf.accent} />} accent={mconf.accent} onClose={() => setOpenCard(null)}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Speedometer Dial Container */}
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0', background: 'radial-gradient(circle at center, rgba(2, 132, 199, 0.05) 0%, transparent 70%)' }}>
                    <SpeedometerDial speed={latest?.speed_kmh ?? 0} accent={mconf.accent} />
                  </div>

                  {/* 4-Stat Velocity Breakdown */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                    {[
                      { label: 'Current Velocity', val: latest ? `${Math.round(latest.speed_kmh)} km/h` : '--- km/h', detail: 'Real-time telemetry' },
                      { label: 'Motor Rotor Speed', val: latest ? `${Math.round(latest.speed_kmh * 82)} RPM` : '--- RPM', detail: 'Direct drive ratio 9.2:1' },
                      { label: 'Session Peak Speed', val: maxSpeed > 0 ? `${Math.round(maxSpeed)} km/h` : '--- km/h', detail: 'Maximum recorded' },
                      { label: 'Total Distance', val: totalDist > 0 ? `${totalDist.toFixed(1)} km` : '0.0 km', detail: 'Trip odometry' },
                    ].map(r => (
                      <div key={r.label} style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 2 }}>{r.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>{r.val}</div>
                        <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{r.detail}</div>
                      </div>
                    ))}
                  </div>

                  {/* 0-100 Benchmark Bar */}
                  <div style={{ padding: '12px 16px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>0–100 km/h Benchmark:</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0284c7', fontFamily: 'monospace' }}>3.2s (Dual Motor Launch)</span>
                  </div>
                </div>
              </CardModal>
            )}

            {openCard === 'efficiency' && (
              <CardModal title="Energy Efficiency & Consumption Curves" icon={<TrendingUp size={16} color="var(--cyan)" />} accent="#0ea5e9" onClose={() => setOpenCard(null)}>
                {!isPro ? (
                  <ProLockedModal
                    title="Consumption Curves"
                    feature="Historical Wh/km & Energy Analytics"
                    desc="Detailed ComposedChart visualization correlating vehicle speed with Wh/km efficiency and kWh/100km battery consumption across recent telemetry snapshots."
                    benefits={[
                      "Real-time dual-axis ComposedChart curves",
                      "Trip average Wh/km and energy optimization targets",
                      "Estimated fuel cost and carbon savings vs ICE vehicles"
                    ]}
                    onUnlock={() => togglePro(true)}
                  />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Legend & Summary */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                      <div style={{ display: 'flex', gap: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 14, height: 4, background: '#0ea5e9', borderRadius: 2 }} />
                          <span style={{ fontSize: 11, color: '#334155', fontWeight: 600 }}>Efficiency (Wh/km)</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 14, height: 4, background: '#f59e0b', borderRadius: 2 }} />
                          <span style={{ fontSize: 11, color: '#334155', fontWeight: 600 }}>Consumption (kWh/100km)</span>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#0284c7', fontFamily: 'monospace' }}>
                        AVG {latest ? Math.round(135 + latest.speed_kmh * 0.7) : '---'} Wh/km
                      </div>
                    </div>

                    {/* Clean Light-Mode Recharts Container */}
                    <div style={{ background: '#f8fafc', padding: '16px 12px 8px 0', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                      <ResponsiveContainer width="100%" height={220}>
                        <ComposedChart data={efficiencyData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                          <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} axisLine={false} interval={2} />
                          <YAxis yAxisId="l" hide domain={[0, 30]} />
                          <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 9, fill: '#64748b' }} tickLine={false} axisLine={false} domain={[0, 30]} />
                          <Tooltip
                            contentStyle={{
                              background: '#ffffff',
                              border: '1px solid #e2e8f0',
                              borderRadius: 8,
                              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                              fontSize: 11,
                              color: '#0f172a',
                            }}
                          />
                          <Bar yAxisId="l" dataKey="consumption" fill="rgba(245, 158, 11, 0.4)" radius={[3, 3, 0, 0]} name="Consumption (kWh/100km)" />
                          <Line yAxisId="r" type="monotone" dataKey="efficiency" stroke="#0ea5e9" strokeWidth={2.5} dot={{ r: 2 }} name="Efficiency (Wh/km)" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Energy Savings Callout */}
                    <div style={{ padding: '12px 14px', background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11.5, color: '#166534', fontWeight: 600 }}>Equivalent Fuel Cost Saving vs ICE:</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#15803d', fontFamily: 'monospace' }}>-78% Cost Reduction</span>
                    </div>
                  </div>
                )}
              </CardModal>
            )}

            {openCard === 'climate' && (
              <CardModal title="Dual-Zone Intelligent Cabin Climate" icon={<Wind size={16} color="#0ea5e9" />} accent="#0ea5e9" onClose={() => setOpenCard(null)}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* Climate Temp Readouts */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', borderRadius: 12, border: '1px solid #bae6fd' }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#0369a1', fontWeight: 700 }}>CABIN CURRENT</div>
                      <div style={{ fontSize: 36, fontWeight: 800, color: '#0284c7', fontFamily: 'monospace', marginTop: 2 }}>{latest ? `${cabinTemp}°C` : '---'}</div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <button
                        onClick={() => setCabinTemp(t => Math.max(16, t - 1))}
                        style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid #bae6fd', background: '#ffffff', cursor: 'pointer', fontSize: 18, fontWeight: 700, color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}
                      >
                        -
                      </button>
                      <div style={{ textAlign: 'center', minWidth: 64 }}>
                        <div style={{ fontSize: 10, color: '#0369a1', fontWeight: 700 }}>TARGET</div>
                        <div style={{ fontSize: 32, fontWeight: 800, color: '#0f172a', fontFamily: 'monospace' }}>{cabinTemp}°C</div>
                      </div>
                      <button
                        onClick={() => setCabinTemp(t => Math.min(30, t + 1))}
                        style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid #bae6fd', background: '#ffffff', cursor: 'pointer', fontSize: 18, fontWeight: 700, color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Mode Toggles */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                    {(['Auto', 'A/C Max', 'Eco Heat', 'Defrost'] as const).map((m) => {
                      const isActive = climateMode === m
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => {
                            setClimateMode(m)
                            toast.success(`Climate Mode Set: ${m}`)
                          }}
                          style={{
                            padding: '12px 0',
                            textAlign: 'center',
                            background: isActive ? '#0284c7' : '#f8fafc',
                            color: isActive ? '#ffffff' : '#334155',
                            borderRadius: 8,
                            border: `1px solid ${isActive ? '#0284c7' : '#e2e8f0'}`,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            boxShadow: isActive ? '0 2px 8px rgba(2, 132, 199, 0.3)' : 'none',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {m}
                        </button>
                      )
                    })}
                  </div>

                  {/* Air Quality & Power Draw */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 11, color: '#64748b' }}>CABIN AIR QUALITY</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#059669', fontFamily: 'monospace', marginTop: 2 }}>AQI 12 (EXCELLENT)</div>
                    </div>
                    <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 11, color: '#64748b' }}>HVAC POWER CONSUMPTION</div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#0284c7', fontFamily: 'monospace', marginTop: 2 }}>{latest ? `${latest.cabin_climate_w ?? 0} W` : '--- W'}</div>
                    </div>
                  </div>
                </div>
              </CardModal>
            )}

            {openCard === 'power' && (
              <CardModal title="Dual Motor Powertrain Flow" icon={<Zap size={16} color={mconf.accent} />} accent={mconf.accent} onClose={() => setOpenCard(null)}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {/* 3 Radial Powertrain Rings */}
                  <div style={{ display: 'flex', justifyContent: 'space-around', padding: '12px 0', background: '#f8fafc', borderRadius: 12, border: '1px solid #e2e8f0' }}>
                    <DonutRing pct={enginePct} color="#0ea5e9" label="FRONT MOTOR" size={88} />
                    <DonutRing pct={battPct2} color="#10b981" label="800V BATTERY" size={88} />
                    <DonutRing pct={motorPct} color={mconf.accent} label="REAR MOTOR" size={88} />
                  </div>

                  {/* Dual Torque Split & Regen */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, color: '#334155' }}>Front/Rear Dual Motor Torque Split</span>
                        <span style={{ fontWeight: 700, color: '#0284c7', fontFamily: 'monospace' }}>
                          {mode === 'Sport' ? '40% Front / 60% Rear (Rear Bias)' : mode === 'Eco' ? '100% Front / 0% Rear (FWD Eco)' : mode === 'Charging' ? '0% Front / 0% Rear (Idle)' : '45% Front / 55% Rear'}
                        </span>
                      </div>
                      <div style={{ height: 8, borderRadius: 4, background: '#e2e8f0', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${mode === 'Sport' ? 40 : mode === 'Eco' ? 100 : mode === 'Charging' ? 0 : 45}%`, background: '#0284c7', borderRadius: '4px 0 0 4px' }} />
                      </div>
                    </div>

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, color: '#334155' }}>Regenerative Kinetic Recovery</span>
                        <span style={{ fontWeight: 700, color: '#059669', fontFamily: 'monospace' }}>{regenPct}% Peak Regen</span>
                      </div>
                      <div style={{ height: 8, borderRadius: 4, background: '#e2e8f0', overflow: 'hidden' }}>
                        <motion.div style={{ height: '100%', width: `${regenPct}%`, background: '#10b981', borderRadius: 4 }} animate={{ width: `${regenPct}%` }} transition={{ duration: 0.6 }} />
                      </div>
                    </div>
                  </div>

                  {/* Output kW & Horsepower */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={{ padding: '14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: '#64748b' }}>TOTAL MECHANICAL POWER</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: mconf.accent, fontFamily: 'monospace', marginTop: 2 }}>{latest && !isNaN(totalKw) ? `${Math.round(totalKw)} kW` : '--- kW'}</div>
                    </div>
                    <div style={{ padding: '14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                      <div style={{ fontSize: 11, color: '#64748b' }}>EQUIVALENT HORSEPOWER</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', fontFamily: 'monospace', marginTop: 2 }}>{latest && !isNaN(totalHp) ? `${totalHp} HP` : '--- HP'}</div>
                    </div>
                  </div>

                  {/* Inverter Efficiency */}
                  <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#475569', fontFamily: 'monospace' }}>
                    <span>SILICON CARBIDE (SiC) INVERTER</span>
                    <span>EFFICIENCY: 98.4%</span>
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
            {!isPro ? (
              <div style={{ height: 340, padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', background: '#ffffff', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, #0ea5e9 0%, #f59e0b 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 6px 18px rgba(14,165,233,0.25)' }}>
                  <Lock size={20} />
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                  CVIS Pro Neural Assistant
                </div>
                <div style={{ fontSize: 12.5, color: '#64748b', lineHeight: 1.5, maxWidth: 300 }}>
                  Interactive driver chat with real-time multi-factor telemetry grounding is exclusive to the CVIS Pro subscription tier.
                </div>
                <button
                  onClick={() => togglePro(true)}
                  style={{
                    marginTop: 8, padding: '10px 18px', borderRadius: 8, border: 'none',
                    background: '#0ea5e9', color: '#ffffff', fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'monospace', letterSpacing: '0.04em',
                    boxShadow: '0 4px 12px rgba(14,165,233,0.3)', display: 'flex', alignItems: 'center', gap: 6
                  }}
                >
                  <Star size={14} fill="#fff" /> UNLOCK PRO &amp; START CHATTING
                </button>
              </div>
            ) : (
              <>
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
                            <Volume2 size={12} />
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
              </>
            )}
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
