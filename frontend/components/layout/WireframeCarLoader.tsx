'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Cpu, ShieldCheck, Activity, Radio, ChevronRight, Zap } from 'lucide-react'

interface Props {
  onComplete?: () => void
  message?: string
}

// Total duration in seconds (snappy yet cinematic)
const TOTAL_DURATION = 2.8

// Real-time boot diagnostics log messages mapped to progress intervals
const STAGES = [
  { threshold: 0.15, text: 'INITIALIZING CAN-BUS TELEMETRY & TLS 1.3 HANDSHAKE...' },
  { threshold: 0.40, text: 'VALIDATING HMAC-SHA256 INTEGRITY & DEVICE PROVISIONING...' },
  { threshold: 0.65, text: 'CALIBRATING 800V BMS BATTERY MATRIX & DUAL MOTOR INVERTERS...' },
  { threshold: 0.88, text: 'SPAWNING OLLAMA 3.2 3B MULTI-FACTOR REASONING PIPELINE...' },
  { threshold: 0.98, text: 'SYNCHRONIZING FULL-DUPLEX WEBSOCKET TELEMETRY STREAM...' },
  { threshold: 1.00, text: 'ALL SYSTEMS NOMINAL // ENGAGING VIRTUAL DRIVE COCKPIT...' },
]

export default function WireframeCarLoader({ onComplete, message = 'Initializing Console...' }: Props) {
  const [progress, setProgress] = useState(0)
  const [isFinishing, setIsFinishing] = useState(false)
  const startTime = useRef(Date.now())
  const raf = useRef<number | null>(null)

  useEffect(() => {
    const tick = () => {
      const elapsed = (Date.now() - startTime.current) / 1000
      const pct = Math.min(elapsed / TOTAL_DURATION, 1)
      setProgress(pct)

      if (pct >= 1) {
        setIsFinishing(true)
        const timeout = setTimeout(() => {
          onComplete?.()
        }, 400)
        return () => clearTimeout(timeout)
      } else {
        raf.current = requestAnimationFrame(tick)
      }
    }

    raf.current = requestAnimationFrame(tick)
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [onComplete])

  // Current diagnostic message
  const currentMessage = STAGES.find(s => progress <= s.threshold)?.text || STAGES[STAGES.length - 1].text
  const pctInt = Math.round(progress * 100)

  // Subsystem states
  const telemetryOk = progress >= 0.25
  const authOk = progress >= 0.50
  const aiOk = progress >= 0.75
  const wsOk = progress >= 0.92

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, scale: 1.03 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          background: 'radial-gradient(ellipse at 50% 35%, #051424 0%, #02060b 55%, #000204 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '24px 20px',
          overflow: 'hidden',
          userSelect: 'none',
          color: '#ffffff',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        {/* Background Cyber Ambient Grid & Horizon */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
          {/* Subtle cyan glow spotlight */}
          <div style={{
            position: 'absolute',
            top: '30%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 700,
            height: 350,
            background: 'radial-gradient(ellipse, rgba(0, 240, 255, 0.12) 0%, rgba(2, 132, 199, 0.04) 50%, transparent 75%)',
            filter: 'blur(40px)',
          }} />

          {/* Perspective 3D floor grid */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: '-20%',
            right: '-20%',
            height: '45%',
            backgroundImage: `
              linear-gradient(rgba(0, 240, 255, 0.08) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 240, 255, 0.08) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
            transform: 'perspective(500px) rotateX(65deg)',
            transformOrigin: 'bottom center',
            maskImage: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.2) 60%, transparent 100%)',
          }} />

          {/* Ambient horizontal scanline */}
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0, 240, 255, 0.015) 3px, rgba(0, 240, 255, 0.015) 4px)',
            opacity: 0.7,
          }} />
        </div>

        {/* ── TOP HUD HEADER ──────────────────────────────────────────────── */}
        <div style={{
          width: '100%',
          maxWidth: 960,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          position: 'relative',
          zIndex: 10,
          borderBottom: '1px solid rgba(0, 240, 255, 0.12)',
          paddingBottom: 14,
        }}>
          {/* Top Left: System Title & Badges */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                background: 'rgba(0, 240, 255, 0.12)',
                border: '1px solid rgba(0, 240, 255, 0.3)',
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 10,
                letterSpacing: '0.15em',
                fontWeight: 700,
                color: '#38bdf8',
                fontFamily: "'Space Mono', monospace",
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00f0ff', boxShadow: '0 0 8px #00f0ff' }} />
                CVIS v2.4-ONLINE
              </span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontFamily: "'Space Mono', monospace" }}>
                // PROTOCOL: HYBRID (HTTP+MQTT)
              </span>
            </div>
            <h1 style={{
              fontSize: 18,
              fontWeight: 800,
              letterSpacing: '0.18em',
              color: '#ffffff',
              textTransform: 'uppercase',
              textShadow: '0 0 20px rgba(0, 240, 255, 0.4)',
              margin: 0,
            }}>
              Connected Vehicle Intelligence System
            </h1>
          </div>

          {/* Top Right: Aerospace Coordinate / Telemetry Specs */}
          <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", color: '#38bdf8', letterSpacing: '0.08em' }}>
              TELEMETRY: <span style={{ color: '#00ffaa' }}>SYNCING</span>
            </div>
            <div style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: 'rgba(255,255,255,0.45)' }}>
              NODE: ESP32-VEHICLE-01 · 800V BMS
            </div>
          </div>
        </div>

        {/* ── CENTER VEHICLE HOLOGRAM ────────────────────────────────────── */}
        <div style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          width: '100%',
          maxWidth: 860,
          margin: '10px 0',
          zIndex: 10,
        }}>
          {/* Hologram Reticle Frame / Tech Markers */}
          <div style={{
            position: 'absolute',
            inset: '5% 2%',
            border: '1px solid rgba(0, 240, 255, 0.08)',
            borderRadius: 12,
            pointerEvents: 'none',
          }}>
            {/* Corner Bracket Accents */}
            <div style={{ position: 'absolute', top: -1, left: -1, width: 14, height: 14, borderTop: '2px solid #00f0ff', borderLeft: '2px solid #00f0ff' }} />
            <div style={{ position: 'absolute', top: -1, right: -1, width: 14, height: 14, borderTop: '2px solid #00f0ff', borderRight: '2px solid #00f0ff' }} />
            <div style={{ position: 'absolute', bottom: -1, left: -1, width: 14, height: 14, borderBottom: '2px solid #00f0ff', borderLeft: '2px solid #00f0ff' }} />
            <div style={{ position: 'absolute', bottom: -1, right: -1, width: 14, height: 14, borderBottom: '2px solid #00f0ff', borderRight: '2px solid #00f0ff' }} />
          </div>

          {/* Floating Sensor Callout Badges */}
          <motion.div
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: progress > 0.35 ? 1 : 0.2, x: 0 }}
            transition={{ duration: 0.5 }}
            style={{
              position: 'absolute',
              top: '12%',
              left: '4%',
              background: 'rgba(4, 16, 32, 0.8)',
              border: '1px solid rgba(0, 240, 255, 0.25)',
              borderRadius: 6,
              padding: '6px 12px',
              backdropFilter: 'blur(8px)',
              pointerEvents: 'none',
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ fontSize: 9, color: '#38bdf8', fontFamily: "'Space Mono', monospace", fontWeight: 700 }}>
              [ 01 // LIDAR MATRIX ]
            </div>
            <div style={{ fontSize: 11, color: '#ffffff', fontWeight: 600 }}>
              Roof Array · 250m FOV
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: progress > 0.65 ? 1 : 0.2, x: 0 }}
            transition={{ duration: 0.5 }}
            style={{
              position: 'absolute',
              top: '12%',
              right: '4%',
              background: 'rgba(4, 16, 32, 0.8)',
              border: '1px solid rgba(0, 240, 255, 0.25)',
              borderRadius: 6,
              padding: '6px 12px',
              backdropFilter: 'blur(8px)',
              pointerEvents: 'none',
              textAlign: 'right',
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ fontSize: 9, color: '#38bdf8', fontFamily: "'Space Mono', monospace", fontWeight: 700 }}>
              [ 02 // AI NEURAL CORE ]
            </div>
            <div style={{ fontSize: 11, color: '#00ffaa', fontWeight: 600 }}>
              Ollama 3B Multi-Factor OK
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: progress > 0.5 ? 1 : 0.2, y: 0 }}
            transition={{ duration: 0.5 }}
            style={{
              position: 'absolute',
              bottom: '10%',
              left: '6%',
              background: 'rgba(4, 16, 32, 0.8)',
              border: '1px solid rgba(0, 240, 255, 0.25)',
              borderRadius: 6,
              padding: '6px 12px',
              backdropFilter: 'blur(8px)',
              pointerEvents: 'none',
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ fontSize: 9, color: '#38bdf8', fontFamily: "'Space Mono', monospace", fontWeight: 700 }}>
              [ 03 // 800V ARCHITECTURE ]
            </div>
            <div style={{ fontSize: 11, color: '#ffffff', fontWeight: 600 }}>
              Dual Motor Inverters · Active
            </div>
          </motion.div>

          {/* SVG Futuristic EV Wireframe Vehicle */}
          <div style={{ width: '100%', maxWidth: 720, position: 'relative' }}>
            <svg
              viewBox="0 0 680 290"
              style={{ width: '100%', height: 'auto', overflow: 'visible' }}
            >
              <defs>
                {/* Glow Filter */}
                <filter id="cyanGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter id="intenseGlow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="7" result="blur1" />
                  <feGaussianBlur stdDeviation="3" result="blur2" />
                  <feMerge>
                    <feMergeNode in="blur1" />
                    <feMergeNode in="blur2" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>

                {/* Laser scan gradient */}
                <linearGradient id="laserBeam" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="transparent" />
                  <stop offset="50%" stopColor="rgba(0, 240, 255, 0.35)" />
                  <stop offset="100%" stopColor="#00f0ff" />
                </linearGradient>

                {/* Battery gradient */}
                <linearGradient id="battGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#0284c7" />
                  <stop offset="50%" stopColor="#00f0ff" />
                  <stop offset="100%" stopColor="#00ffaa" />
                </linearGradient>

                {/* Headlight beam */}
                <linearGradient id="headlightBeam" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(0, 240, 255, 0.5)" />
                  <stop offset="100%" stopColor="rgba(0, 240, 255, 0)" />
                </linearGradient>
              </defs>

              {/* Holographic Ground Shadow / Underglow */}
              <ellipse
                cx="340" cy="240" rx="270" ry="22"
                fill="radial-gradient(ellipse, rgba(0, 240, 255, 0.18) 0%, transparent 70%)"
                opacity={0.4 + progress * 0.6}
              />

              {/* Headlight Projector Cones (Front Beam) */}
              <motion.polygon
                points="560,178 680,165 680,225 560,188"
                fill="url(#headlightBeam)"
                initial={{ opacity: 0 }}
                animate={{ opacity: progress > 0.4 ? [0.4, 0.7, 0.5] : 0 }}
                transition={{ repeat: Infinity, duration: 2 }}
              />

              {/* ── INTERNAL X-RAY TELEMETRY LAYER ────────────────────── */}
              
              {/* 1. 800V Battery Modular Pack (Underfloor Matrix) */}
              <g opacity={progress > 0.3 ? 1 : 0.2} style={{ transition: 'opacity 0.4s' }}>
                {/* Pack Tray */}
                <rect
                  x="200" y="206" width="280" height="18" rx="4"
                  fill="rgba(2, 132, 199, 0.08)"
                  stroke="rgba(0, 240, 255, 0.4)"
                  strokeWidth="1.5"
                  strokeDasharray="4 2"
                />
                {/* Individual Battery Cells */}
                {[0, 1, 2, 3, 4, 5, 6, 7].map(idx => {
                  const cellActive = progress >= (0.35 + idx * 0.05)
                  return (
                    <rect
                      key={idx}
                      x={210 + idx * 33} y="210" width="24" height="10" rx="2"
                      fill={cellActive ? 'url(#battGrad)' : 'rgba(0, 240, 255, 0.1)'}
                      stroke={cellActive ? '#00f0ff' : 'rgba(0, 240, 255, 0.2)'}
                      strokeWidth="1"
                      filter={cellActive ? 'url(#cyanGlow)' : 'none'}
                    />
                  )
                })}
              </g>

              {/* 2. High Voltage Conduits connecting Motors & Battery */}
              <path
                d="M 170 215 L 200 215 M 480 215 L 510 215"
                fill="none"
                stroke="#00f0ff"
                strokeWidth="2"
                strokeDasharray="6 3"
                filter="url(#cyanGlow)"
                opacity={progress > 0.4 ? 1 : 0.2}
              />

              {/* 3. Dual Electric Drive Motors (Front & Rear Axles) */}
              {/* Rear Motor */}
              <g transform="translate(170, 215)">
                <circle r="18" fill="rgba(2, 132, 199, 0.15)" stroke="#00f0ff" strokeWidth="1.5" />
                <circle r="8" fill="none" stroke="#00ffaa" strokeWidth="1.5" strokeDasharray="3 2" filter="url(#cyanGlow)" />
                <motion.circle
                  r="4"
                  fill="#00ffaa"
                  animate={{ scale: [0.8, 1.2, 0.8] }}
                  transition={{ repeat: Infinity, duration: 1.2 }}
                />
              </g>
              {/* Front Motor */}
              <g transform="translate(510, 215)">
                <circle r="18" fill="rgba(2, 132, 199, 0.15)" stroke="#00f0ff" strokeWidth="1.5" />
                <circle r="8" fill="none" stroke="#00ffaa" strokeWidth="1.5" strokeDasharray="3 2" filter="url(#cyanGlow)" />
                <motion.circle
                  r="4"
                  fill="#00ffaa"
                  animate={{ scale: [0.8, 1.2, 0.8] }}
                  transition={{ repeat: Infinity, duration: 1.2 }}
                />
              </g>

              {/* 4. Cockpit AI Core / ECU Processor */}
              <g transform="translate(365, 155)">
                <rect x="-14" y="-14" width="28" height="28" rx="4" fill="rgba(4, 20, 42, 0.9)" stroke="#00f0ff" strokeWidth="1.5" filter="url(#cyanGlow)" />
                <circle r="6" fill="#00ffaa" filter="url(#intenseGlow)" />
                {/* Traces radiating from processor */}
                <path d="M 0 -14 L 0 -28 M 0 14 L 0 50 M -14 0 L -40 0 M 14 0 L 40 0" stroke="rgba(0, 240, 255, 0.4)" strokeWidth="1.2" strokeDasharray="2 2" />
              </g>

              {/* 5. Roof LiDAR Sensor & Sweeping Wave */}
              <g transform="translate(355, 84)">
                <rect x="-10" y="-4" width="20" height="7" rx="3" fill="#00f0ff" filter="url(#cyanGlow)" />
                {progress > 0.25 && (
                  <>
                    <motion.circle
                      r="12"
                      fill="none"
                      stroke="rgba(0, 240, 255, 0.6)"
                      strokeWidth="1.2"
                      initial={{ scale: 0.5, opacity: 1 }}
                      animate={{ scale: 2.4, opacity: 0 }}
                      transition={{ repeat: Infinity, duration: 1.4, ease: 'easeOut' }}
                    />
                    <motion.circle
                      r="20"
                      fill="none"
                      stroke="rgba(0, 240, 255, 0.4)"
                      strokeWidth="1"
                      initial={{ scale: 0.5, opacity: 1 }}
                      animate={{ scale: 2.8, opacity: 0 }}
                      transition={{ repeat: Infinity, duration: 1.4, delay: 0.4, ease: 'easeOut' }}
                    />
                  </>
                )}
              </g>

              {/* ── EXTERNAL CHASSIS & AERODYNAMIC BODYWORK ───────────── */}

              {/* Sleek Aerodynamic Body Silhouette */}
              <path
                d={`
                  M 75 220
                  L 120 220
                  A 48 48 0 0 1 220 220
                  L 460 220
                  A 48 48 0 0 1 560 220
                  L 595 218
                  C 605 215 615 205 605 190
                  L 565 178
                  L 480 148
                  L 410 118
                  L 360 86
                  C 340 85 270 88 230 102
                  L 140 145
                  L 85 162
                  C 68 170 65 190 68 205
                  Z
                `}
                fill="rgba(0, 240, 255, 0.03)"
                stroke="#00f0ff"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#cyanGlow)"
              />

              {/* Aerodynamic Greenhouse / Windows */}
              <path
                d={`
                  M 400 122
                  L 355 93
                  C 335 93 280 96 245 108
                  L 175 145
                  L 290 145
                  L 395 145
                  Z
                `}
                fill="rgba(0, 240, 255, 0.07)"
                stroke="rgba(0, 240, 255, 0.75)"
                strokeWidth="1.6"
              />

              {/* B-Pillar & Door Seam */}
              <line x1="290" y1="100" x2="290" y2="145" stroke="rgba(0, 240, 255, 0.6)" strokeWidth="1.5" />
              <line x1="290" y1="145" x2="290" y2="206" stroke="rgba(0, 240, 255, 0.35)" strokeWidth="1.2" strokeDasharray="3 3" />
              <line x1="400" y1="145" x2="400" y2="206" stroke="rgba(0, 240, 255, 0.35)" strokeWidth="1.2" strokeDasharray="3 3" />

              {/* Flush Door Handles */}
              <rect x="305" y="152" width="22" height="3" rx="1.5" fill="#00f0ff" filter="url(#cyanGlow)" />
              <rect x="415" y="152" width="22" height="3" rx="1.5" fill="#00f0ff" filter="url(#cyanGlow)" />

              {/* High-tech Character Body Crease */}
              <path
                d="M 85 162 L 180 162 L 470 160 L 565 178"
                fill="none"
                stroke="rgba(0, 240, 255, 0.5)"
                strokeWidth="1.2"
              />

              {/* Front Matrix LED Headlight Blade */}
              <path
                d="M 565 178 L 598 184 L 602 188"
                fill="none"
                stroke="#ffffff"
                strokeWidth="3"
                filter="url(#intenseGlow)"
              />

              {/* Rear Cyber Light Blade (OLED Taillight) */}
              <path
                d="M 72 170 L 92 165"
                fill="none"
                stroke="#ff2a5f"
                strokeWidth="3.5"
                filter="url(#intenseGlow)"
              />

              {/* ── HIGH-TECH MULTI-SPOKE AERO WHEELS ────────────────── */}

              {/* Rear Wheel (Aero Turbine Disc) */}
              <g transform="translate(170, 220)">
                {/* Tire Outer Glow */}
                <circle r="44" fill="none" stroke="rgba(0, 240, 255, 0.25)" strokeWidth="5" />
                <circle r="40" fill="rgba(3, 14, 28, 0.9)" stroke="#00f0ff" strokeWidth="2" filter="url(#cyanGlow)" />
                {/* Wheel Turbine Blades */}
                <motion.g animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}>
                  {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
                    <line
                      key={deg}
                      x1="0" y1="0" x2={35 * Math.cos((deg * Math.PI) / 180)} y2={35 * Math.sin((deg * Math.PI) / 180)}
                      stroke="rgba(0, 240, 255, 0.7)"
                      strokeWidth="1.5"
                    />
                  ))}
                  <circle r="14" fill="#041220" stroke="#00f0ff" strokeWidth="2" />
                  {/* Hexagon Hub */}
                  <polygon
                    points="0,-8 7,-4 7,4 0,8 -7,4 -7,-4"
                    fill="none"
                    stroke="#00ffaa"
                    strokeWidth="1.5"
                  />
                </motion.g>
              </g>

              {/* Front Wheel (Aero Turbine Disc) */}
              <g transform="translate(510, 220)">
                {/* Tire Outer Glow */}
                <circle r="44" fill="none" stroke="rgba(0, 240, 255, 0.25)" strokeWidth="5" />
                <circle r="40" fill="rgba(3, 14, 28, 0.9)" stroke="#00f0ff" strokeWidth="2" filter="url(#cyanGlow)" />
                {/* Wheel Turbine Blades */}
                <motion.g animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 4, ease: 'linear' }}>
                  {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
                    <line
                      key={deg}
                      x1="0" y1="0" x2={35 * Math.cos((deg * Math.PI) / 180)} y2={35 * Math.sin((deg * Math.PI) / 180)}
                      stroke="rgba(0, 240, 255, 0.7)"
                      strokeWidth="1.5"
                    />
                  ))}
                  <circle r="14" fill="#041220" stroke="#00f0ff" strokeWidth="2" />
                  {/* Hexagon Hub */}
                  <polygon
                    points="0,-8 7,-4 7,4 0,8 -7,4 -7,-4"
                    fill="none"
                    stroke="#00ffaa"
                    strokeWidth="1.5"
                  />
                </motion.g>
              </g>

              {/* ── DYNAMIC HOLOGRAPHIC VERTICAL LASER SCANNER ───────── */}
              <motion.g
                initial={{ x: 60 }}
                animate={{ x: [60, 610, 60] }}
                transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
              >
                {/* Vertical laser beam curtain */}
                <rect x="-24" y="60" width="24" height="190" fill="url(#laserBeam)" opacity={0.6} />
                {/* Primary laser stroke */}
                <line x1="0" y1="55" x2="0" y2="245" stroke="#ffffff" strokeWidth="2.5" filter="url(#intenseGlow)" />
                {/* Top & Bottom Emitter Nodes */}
                <circle cx="0" cy="55" r="4" fill="#00ffaa" filter="url(#intenseGlow)" />
                <circle cx="0" cy="245" r="4" fill="#00ffaa" filter="url(#intenseGlow)" />
              </motion.g>
            </svg>
          </div>
        </div>

        {/* ── BOTTOM CONSOLE & TELEMETRY PROGRESS ─────────────────────────── */}
        <div style={{
          width: '100%',
          maxWidth: 960,
          background: 'rgba(5, 16, 32, 0.85)',
          border: '1px solid rgba(0, 240, 255, 0.25)',
          borderRadius: 14,
          padding: '18px 24px',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.7), 0 0 30px rgba(0, 240, 255, 0.08)',
          backdropFilter: 'blur(16px)',
          position: 'relative',
          zIndex: 10,
        }}>
          {/* Status Message Line & Percentage Counter */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
            gap: 12,
          }}>
            {/* Real-time Stage Status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: isFinishing ? '#00ffaa' : '#00f0ff',
                boxShadow: isFinishing ? '0 0 10px #00ffaa' : '0 0 10px #00f0ff',
                animation: 'pulse 1.5s infinite',
              }} />
              <div style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 12,
                fontWeight: 700,
                color: '#ffffff',
                letterSpacing: '0.08em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {isFinishing ? '>>> BOOT SEQUENCE COMPLETE // LAUNCHING...' : currentMessage}
              </div>
            </div>

            {/* Glowing Big Percentage Badge */}
            <div style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 4,
              fontFamily: "'Space Mono', monospace",
              fontWeight: 800,
            }}>
              <span style={{
                fontSize: 22,
                color: '#00f0ff',
                textShadow: '0 0 15px rgba(0, 240, 255, 0.6)',
              }}>
                {String(pctInt).padStart(3, '0')}
              </span>
              <span style={{ fontSize: 13, color: '#38bdf8' }}>%</span>
            </div>
          </div>

          {/* Precision Dual-Rail Progress Bar */}
          <div style={{
            height: 6,
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: 3,
            overflow: 'hidden',
            position: 'relative',
            marginBottom: 18,
            border: '1px solid rgba(0, 240, 255, 0.2)',
          }}>
            <motion.div
              style={{
                height: '100%',
                width: `${pctInt}%`,
                background: 'linear-gradient(90deg, #0284c7 0%, #00f0ff 70%, #ffffff 100%)',
                borderRadius: 3,
                boxShadow: '0 0 12px #00f0ff',
                position: 'relative',
              }}
              transition={{ ease: 'easeOut', duration: 0.1 }}
            />
          </div>

          {/* 4 Subsystem Status Cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: 12,
          }}>
            {/* 1. Telemetry */}
            <div style={{
              background: telemetryOk ? 'rgba(0, 240, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
              border: `1px solid ${telemetryOk ? 'rgba(0, 240, 255, 0.35)' : 'rgba(255, 255, 255, 0.08)'}`,
              borderRadius: 8,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.3s ease',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <Activity size={16} color={telemetryOk ? '#00f0ff' : 'rgba(255,255,255,0.4)'} />
                <span style={{ fontSize: 12, fontWeight: 600, color: telemetryOk ? '#ffffff' : 'rgba(255,255,255,0.45)', letterSpacing: '0.04em' }}>
                  Telemetry
                </span>
              </div>
              <span style={{
                fontSize: 10,
                fontFamily: "'Space Mono', monospace",
                fontWeight: 700,
                color: telemetryOk ? '#00ffaa' : 'rgba(255,255,255,0.3)',
              }}>
                {telemetryOk ? 'ONLINE' : 'STANDBY'}
              </span>
            </div>

            {/* 2. Auth Layer */}
            <div style={{
              background: authOk ? 'rgba(0, 240, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
              border: `1px solid ${authOk ? 'rgba(0, 240, 255, 0.35)' : 'rgba(255, 255, 255, 0.08)'}`,
              borderRadius: 8,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.3s ease',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <ShieldCheck size={16} color={authOk ? '#00f0ff' : 'rgba(255,255,255,0.4)'} />
                <span style={{ fontSize: 12, fontWeight: 600, color: authOk ? '#ffffff' : 'rgba(255,255,255,0.45)', letterSpacing: '0.04em' }}>
                  Auth & HMAC
                </span>
              </div>
              <span style={{
                fontSize: 10,
                fontFamily: "'Space Mono', monospace",
                fontWeight: 700,
                color: authOk ? '#00ffaa' : 'rgba(255,255,255,0.3)',
              }}>
                {authOk ? 'VERIFIED' : 'WAITING'}
              </span>
            </div>

            {/* 3. AI Engine */}
            <div style={{
              background: aiOk ? 'rgba(0, 240, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
              border: `1px solid ${aiOk ? 'rgba(0, 240, 255, 0.35)' : 'rgba(255, 255, 255, 0.08)'}`,
              borderRadius: 8,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.3s ease',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <Cpu size={16} color={aiOk ? '#00f0ff' : 'rgba(255,255,255,0.4)'} />
                <span style={{ fontSize: 12, fontWeight: 600, color: aiOk ? '#ffffff' : 'rgba(255,255,255,0.45)', letterSpacing: '0.04em' }}>
                  Ollama 3B AI
                </span>
              </div>
              <span style={{
                fontSize: 10,
                fontFamily: "'Space Mono', monospace",
                fontWeight: 700,
                color: aiOk ? '#00ffaa' : 'rgba(255,255,255,0.3)',
              }}>
                {aiOk ? 'ACTIVE' : 'IDLE'}
              </span>
            </div>

            {/* 4. WebSocket */}
            <div style={{
              background: wsOk ? 'rgba(0, 240, 255, 0.08)' : 'rgba(255, 255, 255, 0.02)',
              border: `1px solid ${wsOk ? 'rgba(0, 240, 255, 0.35)' : 'rgba(255, 255, 255, 0.08)'}`,
              borderRadius: 8,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.3s ease',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <Radio size={16} color={wsOk ? '#00f0ff' : 'rgba(255,255,255,0.4)'} />
                <span style={{ fontSize: 12, fontWeight: 600, color: wsOk ? '#ffffff' : 'rgba(255,255,255,0.45)', letterSpacing: '0.04em' }}>
                  WebSocket
                </span>
              </div>
              <span style={{
                fontSize: 10,
                fontFamily: "'Space Mono', monospace",
                fontWeight: 700,
                color: wsOk ? '#00ffaa' : 'rgba(255,255,255,0.3)',
              }}>
                {wsOk ? 'CONNECTED' : 'POLLING'}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Launch Skip Action */}
        <div style={{ marginTop: 8, position: 'relative', zIndex: 10 }}>
          <button
            onClick={() => onComplete?.()}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.45)',
              fontSize: 11,
              fontFamily: "'Space Mono', monospace",
              letterSpacing: '0.12em',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
              padding: '4px 10px',
              borderRadius: 4,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = '#38bdf8'
              e.currentTarget.style.background = 'rgba(0, 240, 255, 0.08)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.45)'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            QUICK LAUNCH <ChevronRight size={13} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
