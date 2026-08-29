'use client'

/**
 * CVIS Mobile Driver Dashboard
 * ─────────────────────────────
 * Receives ALL state as props from DriverDashboard (the real state owner).
 * No independent WebSocket, no duplicate API calls, no separate vehicle state.
 * The desktop and mobile views are always synchronized because they share the
 * same React state tree via DriverDashboard → MobileDriverDashboard prop pass.
 *
 * Layout priority (phone-first):
 *   1. Battery + estimated range  (biggest card, top)
 *   2. Speed + Current mode       (side-by-side row)
 *   3. Route map                  (compact card)
 *   4. Alerts                     (inline strip)
 *   5. AI Advisory                (inline, expandable)
 *   6. Secondary telemetry        (temp, score, efficiency)
 *   Bottom navigation: Home | Vehicle | AI
 */

import { useState, useRef } from 'react'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BrainCircuit, AlertTriangle, Send, X,
  Battery, Thermometer, Gauge, Navigation, Zap,
  Home, Car, MessageSquare, ChevronRight, Wind, Star
} from 'lucide-react'
import type { TelemetryRow } from '@/lib/types'

// Lazy-load map — same component the desktop uses
const LiveMap = dynamic(() => import('./LiveMap'), {
  ssr: false,
  loading: () => (
    <div style={{ height: '100%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(0,0,0,0.3)', fontSize: 13, fontFamily: 'sans-serif' }}>
      Loading map…
    </div>
  ),
})

// ─── Shared types (mirror DriverDashboard, do not import from there to avoid circular) ───

interface AlertItem {
  id: number
  msg: string
  type: 'warn' | 'fault' | 'info'
  time: string
}

export interface MobileDriverProps {
  vehicleId: string
  vehicleName: string
  vehicleColor: string
  // live telemetry state
  latest: TelemetryRow | null
  history: { id: string; time: string; batt: number; speed: number; temp: number }[]
  // AI state
  aiRec: string
  aiTyping: boolean
  requestRecommendation: () => void
  // alerts
  alerts: AlertItem[]
  // connection
  connected: boolean
  isPro: boolean
  // computed mode values (done once in DriverDashboard)
  mode: string
  modeColor: string
  modeAccent: string
  driveMode: string
  driveScore: { score: number; label: string }
  ambientTemp: number
  tires: { fl: number; fr: number; rl: number; rr: number }
  totalKw: number
  // chat (same backend endpoint)
  chatOpen: boolean
  setChatOpen: (v: boolean) => void
  chatMsg: string
  setChatMsg: (v: string) => void
  chatHistory: { role: 'user' | 'ai'; text: string }[]
  chatLoading: boolean
  handleChat: () => void
}

// ─── Small reusable mobile sub-components ────────────────────────────────────

function MCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid rgba(0,0,0,0.07)',
      borderRadius: 16,
      boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
      overflow: 'hidden',
      ...style,
    }}>
      {children}
    </div>
  )
}

function MLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.42)', fontFamily: 'sans-serif' }}>
      {children}
    </div>
  )
}

function MValue({ children, color, size = 36 }: { children: React.ReactNode; color?: string; size?: number }) {
  return (
    <div style={{ fontSize: size, fontWeight: 700, color: color ?? '#0f172a', fontFamily: 'sans-serif', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
      {children}
    </div>
  )
}

// Battery bar component
function BatteryBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ height: 8, borderRadius: 4, background: 'rgba(0,0,0,0.08)', overflow: 'hidden', marginTop: 8 }}>
      <motion.div
        style={{ height: '100%', borderRadius: 4, background: color, boxShadow: `0 0 8px ${color}66` }}
        animate={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
    </div>
  )
}

// Tab IDs for bottom nav
type MobileTab = 'home' | 'vehicle' | 'ai'

// ─── Main Mobile Dashboard ────────────────────────────────────────────────────

export default function MobileDriverDashboard(props: MobileDriverProps) {
  const {
    vehicleId, vehicleName, vehicleColor,
    latest, connected, isPro,
    mode, modeColor, modeAccent, driveMode,
    aiRec, aiTyping, requestRecommendation,
    alerts,
    driveScore: ds,
    ambientTemp, tires, totalKw,
    chatOpen, setChatOpen, chatMsg, setChatMsg,
    chatHistory, chatLoading, handleChat,
  } = props

  const [tab, setTab] = useState<MobileTab>('home')
  const chatBottom = useRef<HTMLDivElement>(null)

  const battPct  = latest?.battery_pct  ?? 0
  const speedKmh = latest?.speed_kmh    ?? 0
  const rangeKm  = latest?.range_km     ?? 0
  const motorT   = latest?.motor_temp_c ?? 0
  const battT    = latest?.battery_temp_c ?? 0

  const battColor =
    battPct < 15 ? '#ef4444' :
    battPct < 30 ? '#f59e0b' : '#10b981'

  const alertCount = alerts.length
  const hasAlert = alertCount > 0

  // scroll chat to bottom when new message arrives
  const scrollChat = () => setTimeout(() => chatBottom.current?.scrollIntoView({ behavior: 'smooth' }), 60)

  // ─── RENDER ────────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f1f5f9',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: 'sans-serif',
      // keep content above bottom nav
      paddingBottom: 72,
    }}>

      {/* ── TOP HEADER ─────────────────────────────────────────────────────── */}
      <div style={{
        background: '#ffffff',
        borderBottom: '1px solid rgba(0,0,0,0.07)',
        padding: '14px 18px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '0.12em', color: '#0f172a' }}>CVIS</span>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '2px 8px', borderRadius: 20,
              background: connected ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${connected ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: connected ? '#10b981' : '#ef4444',
                boxShadow: connected ? '0 0 6px #10b981' : 'none',
              }} />
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.08em', color: connected ? '#10b981' : '#ef4444' }}>
                {connected ? 'LIVE' : 'OFFLINE'}
              </span>
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.45)', fontWeight: 500 }}>
            {vehicleId}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Mode badge */}
          <div style={{
            padding: '4px 12px', borderRadius: 20,
            background: `${modeColor}18`,
            border: `1px solid ${modeColor}44`,
            fontSize: 10, fontWeight: 700, color: modeColor, letterSpacing: '0.1em',
          }}>
            {driveMode}
          </div>

          {/* Alert indicator */}
          {hasAlert && (
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AlertTriangle size={14} color="#ef4444" />
            </div>
          )}
        </div>
      </div>

      {/* ── SCROLLABLE CONTENT ─────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 0' }}>

        {/* ═══════════════════ HOME TAB ═══════════════════ */}
        {tab === 'home' && (
          <motion.div
            key="home"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >

            {/* ── BATTERY HERO CARD ─────────────────────── */}
            <MCard>
              <div style={{ padding: '20px 20px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <Battery size={14} color={battColor} />
                  <MLabel>Battery</MLabel>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                  <div>
                    <MValue color={battColor} size={52}>
                      {Math.round(battPct)}
                      <span style={{ fontSize: 22, fontWeight: 400, color: 'rgba(0,0,0,0.4)' }}>%</span>
                    </MValue>
                    <div style={{ fontSize: 14, color: 'rgba(0,0,0,0.5)', marginTop: 4, fontWeight: 500 }}>
                      {mode === 'Charging'
                        ? `⚡ Charging · ${Math.round(((100 - battPct) / 100) * 60)} min to full`
                        : `${Math.round(rangeKm)} km estimated range`}
                    </div>
                  </div>

                  {/* Charging rate badge */}
                  {mode === 'Charging' && (
                    <div style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      padding: '10px 14px', borderRadius: 12,
                      background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.2)',
                    }}>
                      <Zap size={16} color="#0ea5e9" />
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#0ea5e9', marginTop: 4 }}>
                        {((latest?.charging_rate_w ?? 7400) / 1000).toFixed(1)} kW
                      </div>
                      <div style={{ fontSize: 9, color: 'rgba(0,0,0,0.4)', marginTop: 2, letterSpacing: '0.06em' }}>RATE</div>
                    </div>
                  )}
                </div>

                <BatteryBar pct={battPct} color={battColor} />
              </div>

              {/* Battery status row */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                borderTop: '1px solid rgba(0,0,0,0.05)',
              }}>
                {[
                  { label: 'Voltage', value: battPct > 50 ? '402 V' : '387 V' },
                  { label: 'Temp', value: `${Math.round(battT)}°C`, color: battT > 50 ? '#ef4444' : undefined },
                  { label: 'State', value: mode === 'Charging' ? 'Charging' : mode === 'Low Battery' ? 'Critical' : 'Active', color: mode === 'Charging' ? '#10b981' : mode === 'Low Battery' ? '#ef4444' : undefined },
                ].map(item => (
                  <div key={item.label} style={{ padding: '12px 0', textAlign: 'center', borderRight: '1px solid rgba(0,0,0,0.05)' }}>
                    <div style={{ fontSize: 9, color: 'rgba(0,0,0,0.38)', letterSpacing: '0.1em', marginBottom: 4 }}>{item.label.toUpperCase()}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: item.color ?? '#0f172a' }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </MCard>

            {/* ── SPEED + MODE ROW ───────────────────────── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>

              {/* Speed */}
              <MCard>
                <div style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <Gauge size={12} color={modeAccent} />
                    <MLabel>Speed</MLabel>
                  </div>
                  <MValue color={modeAccent} size={38}>
                    {Math.round(speedKmh)}
                  </MValue>
                  <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)', marginTop: 4 }}>km/h</div>
                </div>
              </MCard>

              {/* Mode */}
              <MCard style={{ background: `${modeColor}0e`, border: `1px solid ${modeColor}33` }}>
                <div style={{ padding: '16px' }}>
                  <MLabel>Mode</MLabel>
                  <div style={{ marginTop: 10 }}>
                    <div style={{
                      fontSize: 22, fontWeight: 800, color: modeColor,
                      letterSpacing: '0.06em', lineHeight: 1,
                      textShadow: `0 0 20px ${modeColor}44`,
                    }}>
                      {driveMode}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(0,0,0,0.45)', marginTop: 6 }}>
                      {mode}
                    </div>
                  </div>
                  {latest?.fault_code ? (
                    <div style={{ marginTop: 8, fontSize: 10, color: '#ef4444', fontWeight: 700 }}>
                      FAULT: 0x{latest.fault_code.toString(16).toUpperCase()}
                    </div>
                  ) : null}
                </div>
              </MCard>
            </div>

            {/* ── ROUTE MAP ─────────────────────────────── */}
            <MCard>
              <div style={{ padding: '12px 16px 10px', display: 'flex', alignItems: 'center', gap: 7, borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                <Navigation size={12} color="#0ea5e9" />
                <MLabel>Live Route</MLabel>
                <div style={{ marginLeft: 'auto', fontSize: 10, color: 'rgba(0,0,0,0.4)' }}>GPS Active</div>
              </div>
              <div style={{ height: 200, position: 'relative' }}>
                <LiveMap speed_kmh={speedKmh} />
              </div>
            </MCard>

            {/* ── ALERTS ────────────────────────────────── */}
            <MCard style={{ border: `1px solid ${hasAlert ? 'rgba(239,68,68,0.2)' : 'rgba(0,0,0,0.07)'}` }}>
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={14} color={hasAlert ? '#ef4444' : '#10b981'} />
                <div style={{ fontSize: 13, fontWeight: 700, color: hasAlert ? '#ef4444' : '#10b981' }}>
                  {hasAlert ? `${alertCount} Active Alert${alertCount > 1 ? 's' : ''}` : 'All Clear'}
                </div>
                {hasAlert && (
                  <ChevronRight size={14} color="rgba(0,0,0,0.3)" style={{ marginLeft: 'auto' }} />
                )}
              </div>
              {hasAlert && (
                <div style={{ borderTop: '1px solid rgba(239,68,68,0.12)', padding: '0 16px 14px' }}>
                  {alerts.slice(0, 2).map(a => (
                    <div key={a.id} style={{
                      marginTop: 10, padding: '10px 12px', borderRadius: 8,
                      background: a.type === 'fault' ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)',
                      border: `1px solid ${a.type === 'fault' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: a.type === 'fault' ? '#ef4444' : '#f59e0b' }}>{a.msg}</div>
                      <div style={{ fontSize: 10, color: 'rgba(0,0,0,0.4)', marginTop: 2 }}>{a.time}</div>
                    </div>
                  ))}
                </div>
              )}
            </MCard>

            {/* ── AI ADVISORY ───────────────────────────── */}
            <MCard style={{ border: '1px solid rgba(14,165,233,0.18)' }}>
              <div style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <BrainCircuit size={14} color="#0ea5e9" />
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', color: '#0ea5e9' }}>CVIS INTELLIGENCE</div>
                  {aiTyping && (
                    <div style={{ display: 'flex', gap: 3, marginLeft: 4 }}>
                      {[0, 1, 2].map(i => (
                        <motion.div
                          key={i}
                          style={{ width: 4, height: 4, borderRadius: '50%', background: '#0ea5e9' }}
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ delay: i * 0.2, repeat: Infinity, duration: 0.9 }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div style={{
                  fontSize: 13, lineHeight: 1.65, color: aiRec ? '#1e293b' : 'rgba(0,0,0,0.35)',
                  minHeight: 48,
                }}>
                  {aiRec || (connected ? 'AI on standby — awaiting telemetry…' : 'Waiting for connection…')}
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button
                    onClick={requestRecommendation}
                    disabled={aiTyping || !latest}
                    style={{
                      flex: 1,
                      padding: '9px 0', borderRadius: 10,
                      background: 'rgba(14,165,233,0.08)', border: '1px solid rgba(14,165,233,0.25)',
                      fontSize: 12, fontWeight: 700, color: '#0ea5e9',
                      cursor: 'pointer', opacity: aiTyping || !latest ? 0.5 : 1,
                      fontFamily: 'sans-serif',
                    }}
                  >
                    ↻ Refresh
                  </button>
                  <button
                    onClick={() => { setChatOpen(true); setTab('ai') }}
                    style={{
                      flex: 1,
                      padding: '9px 0', borderRadius: 10,
                      background: '#0ea5e9', border: 'none',
                      fontSize: 12, fontWeight: 700, color: '#ffffff',
                      cursor: 'pointer',
                      fontFamily: 'sans-serif',
                      boxShadow: '0 2px 10px rgba(14,165,233,0.3)',
                    }}
                  >
                    Ask CVIS →
                  </button>
                </div>
              </div>
            </MCard>

          </motion.div>
        )}

        {/* ═══════════════════ VEHICLE TAB ════════════════ */}
        {tab === 'vehicle' && (
          <motion.div
            key="vehicle"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            {/* Temperature metrics */}
            <MCard>
              <div style={{ padding: '16px 18px 10px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Thermometer size={13} color="#0ea5e9" />
                  <MLabel>Temperature</MLabel>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '0' }}>
                {[
                  { label: 'Battery', value: `${Math.round(battT)}°C`, color: battT > 50 ? '#ef4444' : battT > 40 ? '#f59e0b' : '#10b981' },
                  { label: 'Motor', value: `${Math.round(motorT)}°C`, color: motorT > 80 ? '#ef4444' : motorT > 65 ? '#f59e0b' : '#10b981' },
                  { label: 'Ambient', value: `${Math.round(ambientTemp)}°C`, color: '#0ea5e9' },
                ].map(item => (
                  <div key={item.label} style={{ padding: '18px 0', textAlign: 'center', borderRight: '1px solid rgba(0,0,0,0.05)' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: item.color }}>{item.value}</div>
                    <div style={{ fontSize: 9, color: 'rgba(0,0,0,0.4)', marginTop: 4, letterSpacing: '0.1em' }}>{item.label.toUpperCase()}</div>
                  </div>
                ))}
              </div>
            </MCard>

            {/* Power output */}
            <MCard>
              <div style={{ padding: '16px 18px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                  <Zap size={13} color={modeAccent} />
                  <MLabel>Power Output</MLabel>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
                  <MValue color={modeAccent} size={40}>{Math.round(totalKw)}</MValue>
                  <div style={{ fontSize: 14, color: 'rgba(0,0,0,0.4)', marginBottom: 4 }}>kW</div>
                  <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>{Math.round(totalKw * 1.341)}</div>
                    <div style={{ fontSize: 10, color: 'rgba(0,0,0,0.4)' }}>HP</div>
                  </div>
                </div>
              </div>
            </MCard>

            {/* Tire pressures */}
            <MCard>
              <div style={{ padding: '14px 18px 10px', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                <MLabel>Tire Pressure</MLabel>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                {([
                  ['Front Left', tires.fl],
                  ['Front Right', tires.fr],
                  ['Rear Left', tires.rl],
                  ['Rear Right', tires.rr],
                ] as [string, number][]).map(([pos, psi], i) => {
                  const col = psi < 30 ? '#ef4444' : psi > 36 ? '#f59e0b' : '#10b981'
                  return (
                    <div key={pos} style={{
                      padding: '14px 16px',
                      borderRight: i % 2 === 0 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                      borderBottom: i < 2 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                    }}>
                      <div style={{ fontSize: 10, color: 'rgba(0,0,0,0.4)', marginBottom: 6, letterSpacing: '0.06em' }}>{pos.toUpperCase()}</div>
                      <div style={{ fontSize: 24, fontWeight: 700, color: col }}>{psi}</div>
                      <div style={{ fontSize: 9, color: 'rgba(0,0,0,0.4)', marginTop: 2 }}>PSI {psi < 30 ? '⚠ Low' : psi > 36 ? '⚠ High' : '✓ OK'}</div>
                      <div style={{ height: 3, borderRadius: 2, background: 'rgba(0,0,0,0.07)', marginTop: 8, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(psi / 44) * 100}%`, background: col, borderRadius: 2 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </MCard>

            {/* Drive score */}
            <MCard>
              <div style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                  <Star size={13} color={isPro ? '#f59e0b' : 'rgba(0,0,0,0.25)'} fill={isPro ? '#f59e0b' : 'none'} />
                  <MLabel>Drive Score</MLabel>
                  {!isPro && <div style={{ marginLeft: 'auto', fontSize: 9, padding: '2px 8px', background: 'rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 10, color: 'rgba(0,0,0,0.4)', letterSpacing: '0.06em' }}>PRO</div>}
                </div>
                {isPro ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                      <MValue color={ds.score >= 8 ? '#10b981' : ds.score >= 6 ? '#f59e0b' : '#ef4444'} size={44}>
                        {ds.score}
                      </MValue>
                      <div style={{ fontSize: 16, color: 'rgba(0,0,0,0.4)', marginBottom: 4 }}>/10</div>
                    </div>
                    <div style={{ fontSize: 12, color: ds.score >= 8 ? '#10b981' : '#f59e0b', marginTop: 4, fontWeight: 600 }}>{ds.label}</div>
                    <div style={{ display: 'flex', gap: 3, marginTop: 12 }}>
                      {Array.from({ length: 10 }, (_, i) => (
                        <div key={i} style={{ flex: 1, height: 6, borderRadius: 2, background: i < ds.score ? (ds.score >= 8 ? '#10b981' : ds.score >= 6 ? '#f59e0b' : '#ef4444') : 'rgba(0,0,0,0.09)', transition: 'all 0.4s' }} />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: 'rgba(0,0,0,0.4)', textAlign: 'center', padding: '16px 0' }}>
                    Upgrade to Pro to see your AI-powered drive score
                  </div>
                )}
              </div>
            </MCard>

            {/* Efficiency */}
            <MCard>
              <div style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <MLabel>Efficiency</MLabel>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#0ea5e9' }}>
                    {(14 + battPct / 20).toFixed(1)} <span style={{ fontSize: 11, color: 'rgba(0,0,0,0.4)', fontWeight: 400 }}>km/l</span>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    { label: 'Consumption', value: mode === 'Eco' ? '14.2' : mode === 'Sport' ? '22.8' : '17.5', unit: 'kWh/100km' },
                    { label: 'Regen', value: mode === 'Eco' ? '85%' : mode === 'Heavy Traffic' ? '72%' : '63%', unit: 'recovery' },
                  ].map(item => (
                    <div key={item.label} style={{ padding: '12px', background: 'rgba(0,0,0,0.03)', borderRadius: 10, border: '1px solid rgba(0,0,0,0.06)' }}>
                      <div style={{ fontSize: 9, color: 'rgba(0,0,0,0.4)', marginBottom: 4, letterSpacing: '0.08em' }}>{item.label.toUpperCase()}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>{item.value}</div>
                      <div style={{ fontSize: 9, color: 'rgba(0,0,0,0.35)', marginTop: 2 }}>{item.unit}</div>
                    </div>
                  ))}
                </div>
              </div>
            </MCard>

          </motion.div>
        )}

        {/* ═══════════════════ AI TAB ═════════════════════ */}
        {tab === 'ai' && (
          <motion.div
            key="ai"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            {/* AI Advisory full card */}
            <MCard style={{ border: '1px solid rgba(14,165,233,0.18)' }}>
              <div style={{ padding: '16px 18px 14px', borderBottom: '1px solid rgba(14,165,233,0.1)', background: 'rgba(14,165,233,0.03)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BrainCircuit size={16} color="#0ea5e9" />
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0ea5e9', letterSpacing: '0.08em' }}>CVIS INTELLIGENCE</div>
                  {aiTyping && (
                    <div style={{ display: 'flex', gap: 3, marginLeft: 4 }}>
                      {[0, 1, 2].map(i => (
                        <motion.div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: '#0ea5e9' }}
                          animate={{ opacity: [0.3, 1, 0.3] }} transition={{ delay: i * 0.2, repeat: Infinity, duration: 0.9 }} />
                      ))}
                    </div>
                  )}
                  <button
                    onClick={requestRecommendation}
                    disabled={aiTyping || !latest}
                    style={{ marginLeft: 'auto', background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)', borderRadius: 8, padding: '5px 12px', fontSize: 11, color: '#0ea5e9', cursor: 'pointer', opacity: aiTyping || !latest ? 0.5 : 1 }}
                  >
                    ↻ Refresh
                  </button>
                </div>
              </div>
              <div style={{ padding: '16px 18px' }}>
                <div style={{ fontSize: 14, lineHeight: 1.7, color: aiRec ? '#1e293b' : 'rgba(0,0,0,0.35)', minHeight: 60 }}>
                  {aiRec || (connected ? 'Tap Refresh to get an AI recommendation based on live telemetry.' : 'Waiting for WebSocket connection…')}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(0,0,0,0.35)', marginTop: 10 }}>
                  Based on live telemetry from {vehicleId} · Mode: {mode}
                </div>
              </div>
            </MCard>

            {/* Chat with CVIS */}
            <MCard style={{ border: '1px solid rgba(14,165,233,0.12)' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageSquare size={13} color="#0ea5e9" />
                <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', letterSpacing: '0.04em' }}>Ask CVIS</div>
                <div style={{ fontSize: 10, color: 'rgba(0,0,0,0.35)', marginLeft: 4 }}>
                  {latest ? `${vehicleId} · ${mode}` : 'No data'}
                </div>
              </div>

              {/* Chat messages */}
              <div style={{ height: 260, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, background: '#fafafa' }}>
                {chatHistory.length === 0 && (
                  <div style={{ fontSize: 12, color: 'rgba(0,0,0,0.3)', textAlign: 'center', marginTop: 40, fontWeight: 600 }}>
                    ASK CVIS ANYTHING ABOUT YOUR VEHICLE
                  </div>
                )}
                {chatHistory.map((m, i) => (
                  <div key={i} style={{
                    alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '88%',
                    padding: '10px 14px',
                    borderRadius: m.role === 'user' ? '14px 14px 3px 14px' : '14px 14px 14px 3px',
                    background: m.role === 'user' ? '#e0f2fe' : '#ffffff',
                    border: `1px solid ${m.role === 'user' ? '#bae6fd' : '#e2e8f0'}`,
                    fontSize: 13, color: m.role === 'user' ? '#0369a1' : '#334155',
                    lineHeight: 1.5,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                  }}>
                    {m.text}
                  </div>
                ))}
                {chatLoading && (
                  <div style={{ alignSelf: 'flex-start', display: 'flex', gap: 5, padding: '10px 14px', background: '#ffffff', borderRadius: '14px 14px 14px 3px', border: '1px solid #e2e8f0' }}>
                    {[0, 1, 2].map(i => (
                      <motion.div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#0ea5e9' }}
                        animate={{ y: [0, -5, 0] }} transition={{ delay: i * 0.15, repeat: Infinity, duration: 0.7 }} />
                    ))}
                  </div>
                )}
                <div ref={chatBottom} />
              </div>

              {/* Chat input */}
              <div style={{ padding: '10px 12px', borderTop: '1px solid rgba(0,0,0,0.06)', display: 'flex', gap: 8, background: '#ffffff' }}>
                <input
                  value={chatMsg}
                  onChange={e => setChatMsg(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { handleChat(); scrollChat() } }}
                  placeholder="Ask about your vehicle…"
                  style={{
                    flex: 1, background: '#f8fafc', border: '1px solid rgba(0,0,0,0.1)',
                    borderRadius: 10, padding: '10px 14px', color: '#0f172a',
                    fontSize: 13, outline: 'none', fontFamily: 'sans-serif',
                  }}
                />
                <button
                  onClick={() => { handleChat(); scrollChat() }}
                  disabled={chatLoading}
                  style={{
                    background: '#0ea5e9', border: 'none', borderRadius: 10,
                    padding: '10px 14px', cursor: 'pointer', color: '#ffffff',
                    opacity: chatLoading ? 0.5 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 8px rgba(14,165,233,0.3)',
                  }}
                >
                  <Send size={15} />
                </button>
              </div>
            </MCard>

          </motion.div>
        )}

      </div>{/* end scrollable content */}

      {/* ── BOTTOM NAVIGATION ────────────────────────────────────────────── */}
      <div style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        height: 68,
        background: '#ffffff',
        borderTop: '1px solid rgba(0,0,0,0.08)',
        display: 'flex',
        alignItems: 'stretch',
        zIndex: 200,
        boxShadow: '0 -4px 20px rgba(0,0,0,0.06)',
      }}>
        {([
          { id: 'home' as MobileTab, label: 'Home', Icon: Home },
          { id: 'vehicle' as MobileTab, label: 'Vehicle', Icon: Car },
          { id: 'ai' as MobileTab, label: 'AI', Icon: BrainCircuit, badge: undefined },
        ] as { id: MobileTab; label: string; Icon: React.ComponentType<{ size?: number; color?: string }> }[]).map(item => {
          const active = tab === item.id
          return (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              style={{
                flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 5, background: 'none', border: 'none', cursor: 'pointer',
                color: active ? '#0ea5e9' : 'rgba(0,0,0,0.38)',
                position: 'relative',
                transition: 'color 0.2s',
              }}
            >
              {/* Active indicator */}
              {active && (
                <motion.div
                  layoutId="nav-indicator"
                  style={{
                    position: 'absolute', top: 0, left: '50%',
                    transform: 'translateX(-50%)',
                    width: 28, height: 3, borderRadius: '0 0 3px 3px',
                    background: '#0ea5e9',
                  }}
                />
              )}
              <item.Icon size={20} color={active ? '#0ea5e9' : 'rgba(0,0,0,0.38)'} />
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, letterSpacing: '0.04em', fontFamily: 'sans-serif' }}>
                {item.label}
              </span>
            </button>
          )
        })}
      </div>

    </div>
  )
}
