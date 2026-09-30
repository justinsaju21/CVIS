'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Cpu, ShieldCheck, Activity, Radio, ChevronRight, Zap } from 'lucide-react'

interface Props {
  onComplete?: () => void
  message?: string
}

// Snappy yet cinematic boot sequence duration
const TOTAL_DURATION = 2.8

// Real-time boot diagnostics log messages mapped to progress intervals
const STAGES = [
  { threshold: 0.15, text: 'INITIALIZING CAN-BUS TELEMETRY & TLS 1.3 HANDSHAKE...' },
  { threshold: 0.40, text: 'VALIDATING HMAC-SHA256 INTEGRITY & DEVICE PROVISIONING...' },
  { threshold: 0.65, text: 'CALIBRATING 800V STRUCTURAL BATTERY & DUAL INVERTERS...' },
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
          background: 'radial-gradient(ellipse at 50% 38%, #051424 0%, #02060b 55%, #000204 100%)',
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
            top: '32%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 750,
            height: 380,
            background: 'radial-gradient(ellipse, rgba(0, 240, 255, 0.12) 0%, rgba(2, 132, 199, 0.04) 50%, transparent 75%)',
            filter: 'blur(45px)',
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

          {/* Ambient horizontal scanline texture */}
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
                CVIS-EV · TESLA ARCHITECTURE
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
              AUTOPILOT / FSD: <span style={{ color: '#00ffaa' }}>HW4 ACTIVE</span>
            </div>
            <div style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: 'rgba(255,255,255,0.45)' }}>
              NODE: ESP32-ALPHA · 800V BMS
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
          maxWidth: 880,
          margin: '10px 0',
          zIndex: 10,
        }}>
          {/* Hologram Reticle Frame / Tech Markers */}
          <div style={{
            position: 'absolute',
            inset: '4% 2%',
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
              top: '10%',
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
              [ 01 // AUTOPILOT HW4 ]
            </div>
            <div style={{ fontSize: 11, color: '#ffffff', fontWeight: 600 }}>
              Tri-Camera & Fender Suite
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: progress > 0.65 ? 1 : 0.2, x: 0 }}
            transition={{ duration: 0.5 }}
            style={{
              position: 'absolute',
              top: '10%',
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
              [ 02 // COCKPIT TOUCHSCREEN ]
            </div>
            <div style={{ fontSize: 11, color: '#00ffaa', fontWeight: 600 }}>
              15&quot; Center Console Online
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
              [ 03 // STRUCTURAL BATTERY ]
            </div>
            <div style={{ fontSize: 11, color: '#ffffff', fontWeight: 600 }}>
              4680 Matrix · 800V Architecture
            </div>
          </motion.div>

          {/* SVG Futuristic Tesla EV Wireframe Vehicle */}
          <div style={{ width: '100%', maxWidth: 740, position: 'relative' }}>
            <svg
              viewBox="0 0 700 280"
              style={{ width: '100%', height: 'auto', overflow: 'visible' }}
            >
              <defs>
                {/* Glow Filters */}
                <filter id="cyanGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter id="intenseGlow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="6" result="blur1" />
                  <feGaussianBlur stdDeviation="2.5" result="blur2" />
                  <feMerge>
                    <feMergeNode in="blur1" />
                    <feMergeNode in="blur2" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter id="redGlow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
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
                  <stop offset="0%" stopColor="rgba(0, 240, 255, 0.45)" />
                  <stop offset="100%" stopColor="rgba(0, 240, 255, 0)" />
                </linearGradient>
              </defs>

              {/* Holographic Ground Shadow / Underglow */}
              <ellipse
                cx="350" cy="235" rx="285" ry="18"
                fill="radial-gradient(ellipse, rgba(0, 240, 255, 0.22) 0%, transparent 70%)"
                opacity={0.4 + progress * 0.6}
              />

              {/* Headlight Projector Cones (Front Beam) */}
              <motion.polygon
                points="628,178 700,165 700,225 635,195"
                fill="url(#headlightBeam)"
                initial={{ opacity: 0 }}
                animate={{ opacity: progress > 0.4 ? [0.4, 0.7, 0.5] : 0 }}
                transition={{ repeat: Infinity, duration: 2 }}
              />

              {/* ── INTERNAL TESLA X-RAY POWERTRAIN LAYER ────────────────── */}

              {/* 1. Structural Skateboard Battery Pack (Low Center of Gravity) */}
              <g opacity={progress > 0.3 ? 1 : 0.2} style={{ transition: 'opacity 0.4s' }}>
                {/* Pack Tray */}
                <rect
                  x="225" y="206" width="250" height="12" rx="3"
                  fill="rgba(2, 132, 199, 0.12)"
                  stroke="rgba(0, 240, 255, 0.4)"
                  strokeWidth="1.5"
                />
                {/* 4680 Cylindrical Matrix / Module Blocks */}
                {[0, 1, 2, 3, 4, 5, 6, 7].map(idx => {
                  const cellActive = progress >= (0.35 + idx * 0.05)
                  return (
                    <rect
                      key={idx}
                      x={232 + idx * 30} y="209" width="22" height="6" rx="1.5"
                      fill={cellActive ? 'url(#battGrad)' : 'rgba(0, 240, 255, 0.1)'}
                      stroke={cellActive ? '#00f0ff' : 'rgba(0, 240, 255, 0.2)'}
                      strokeWidth="1"
                      filter={cellActive ? 'url(#cyanGlow)' : 'none'}
                    />
                  )
                })}
              </g>

              {/* 2. High Voltage Bus Cables connecting Motors */}
              <path
                d="M 175 200 L 225 210 M 475 210 L 525 200"
                fill="none"
                stroke="#00f0ff"
                strokeWidth="2"
                strokeDasharray="5 3"
                filter="url(#cyanGlow)"
                opacity={progress > 0.4 ? 1 : 0.2}
              />

              {/* 3. Dual Electric Drive Motors (Front & Rear Axles) */}
              {/* Rear Permanent Magnet Motor */}
              <g transform="translate(175, 200)">
                <circle r="16" fill="rgba(2, 132, 199, 0.15)" stroke="#00f0ff" strokeWidth="1.5" />
                <circle r="7" fill="none" stroke="#00ffaa" strokeWidth="1.5" strokeDasharray="3 2" filter="url(#cyanGlow)" />
                <motion.circle
                  r="3.5"
                  fill="#00ffaa"
                  animate={{ scale: [0.8, 1.25, 0.8] }}
                  transition={{ repeat: Infinity, duration: 1.2 }}
                />
              </g>
              {/* Front Induction Motor */}
              <g transform="translate(525, 200)">
                <circle r="16" fill="rgba(2, 132, 199, 0.15)" stroke="#00f0ff" strokeWidth="1.5" />
                <circle r="7" fill="none" stroke="#00ffaa" strokeWidth="1.5" strokeDasharray="3 2" filter="url(#cyanGlow)" />
                <motion.circle
                  r="3.5"
                  fill="#00ffaa"
                  animate={{ scale: [0.8, 1.25, 0.8] }}
                  transition={{ repeat: Infinity, duration: 1.2 }}
                />
              </g>

              {/* 4. Tesla Center Touchscreen (15" Horizontal Display) */}
              <g transform="translate(378, 136)">
                {/* Screen Mount / Stand */}
                <line x1="0" y1="12" x2="0" y2="24" stroke="rgba(0, 240, 255, 0.6)" strokeWidth="1.5" />
                {/* 15" Floating Horizontal Tablet */}
                <rect x="-14" y="-8" width="28" height="18" rx="2" fill="rgba(4, 20, 42, 0.95)" stroke="#00f0ff" strokeWidth="1.5" filter="url(#cyanGlow)" />
                {/* Mini Visualizer lines on screen */}
                <line x1="-10" y1="-3" x2="-2" y2="-3" stroke="#00ffaa" strokeWidth="1.2" />
                <line x1="-10" y1="2" x2="6" y2="2" stroke="#38bdf8" strokeWidth="1" />
                <circle cx="8" cy="-2" r="2.5" fill="#00f0ff" />
              </g>

              {/* 5. Minimalist Steering Yoke Contour */}
              <path
                d="M 436 138 C 438 135 448 135 450 138 L 448 144 C 445 146 441 146 438 144 Z"
                fill="none"
                stroke="rgba(0, 240, 255, 0.7)"
                strokeWidth="1.2"
              />

              {/* 6. Front & Rear Minimalist Seat Bolsters */}
              <path
                d="M 405 130 C 405 120 412 115 418 115 C 424 115 428 120 425 148 L 398 152"
                fill="none"
                stroke="rgba(0, 240, 255, 0.25)"
                strokeWidth="1.2"
              />
              <path
                d="M 285 130 C 285 120 292 115 298 115 C 304 115 308 120 305 148 L 278 152"
                fill="none"
                stroke="rgba(0, 240, 255, 0.2)"
                strokeWidth="1.2"
              />

              {/* 7. Autopilot Windshield Camera Array (Subtle Vision Cone) */}
              <g transform="translate(450, 108)">
                <circle r="3" fill="#00ffaa" filter="url(#cyanGlow)" />
                {progress > 0.25 && (
                  <path
                    d="M 3 0 L 35 -14 L 35 14 Z"
                    fill="rgba(0, 255, 170, 0.06)"
                    stroke="rgba(0, 255, 170, 0.3)"
                    strokeWidth="0.8"
                    strokeDasharray="2 2"
                  />
                )}
              </g>

              {/* ── EXTERNAL CHASSIS & TESLA AERODYNAMIC BODYWORK ───────── */}

              {/* The Iconic Tesla Sweeping Silhouette */}
              <path
                d={`
                  M 85 195
                  C 85 208, 98 218, 125 218
                  L 133 218
                  A 42 42 0 0 1 217 218
                  L 483 218
                  A 42 42 0 0 1 567 218
                  L 590 218
                  C 610 216, 630 208, 635 202
                  C 638 196, 635 186, 628 178
                  C 605 168, 555 156, 500 142
                  C 440 102, 380 82, 330 82
                  C 270 82, 200 98, 130 148
                  C 115 150, 103 151, 98 155
                  C 90 162, 85 178, 85 195
                  Z
                `}
                fill="rgba(0, 240, 255, 0.03)"
                stroke="#00f0ff"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#cyanGlow)"
              />

              {/* All-Glass Panoramic Teardrop Window Canopy */}
              <path
                d={`
                  M 480 142
                  C 425 106, 375 88, 330 88
                  C 280 88, 225 102, 165 146
                  L 480 142
                  Z
                `}
                fill="rgba(0, 240, 255, 0.08)"
                stroke="rgba(0, 240, 255, 0.8)"
                strokeWidth="1.6"
              />

              {/* Frameless Window B-Pillar & Rear Quarter Glass */}
              <line x1="325" y1="88" x2="325" y2="144" stroke="rgba(0, 240, 255, 0.6)" strokeWidth="1.8" />
              <line x1="215" y1="108" x2="208" y2="145" stroke="rgba(0, 240, 255, 0.5)" strokeWidth="1.4" />

              {/* Autopilot B-Pillar Camera */}
              <circle cx="325" cy="115" r="2.5" fill="#00ffaa" filter="url(#cyanGlow)" />

              {/* Front Fender Autopilot Repeater Camera Blade */}
              <rect x="478" y="150" width="5" height="11" rx="2" fill="#00f0ff" filter="url(#cyanGlow)" />
              <circle cx="480.5" cy="155.5" r="1.5" fill="#ffffff" />

              {/* Tesla Flush Door Handles */}
              <rect x="350" y="152" width="22" height="3" rx="1.5" fill="#00f0ff" filter="url(#cyanGlow)" />
              <rect x="245" y="152" width="22" height="3" rx="1.5" fill="#00f0ff" filter="url(#cyanGlow)" />

              {/* Door Cutlines */}
              <path d="M 325 144 L 325 214" stroke="rgba(0, 240, 255, 0.35)" strokeWidth="1.2" strokeDasharray="3 3" />
              <path d="M 445 142 L 445 214" stroke="rgba(0, 240, 255, 0.35)" strokeWidth="1.2" strokeDasharray="3 3" />

              {/* Sculpted Tesla Shoulder Body Crease */}
              <path
                d="M 98 155 C 150 152, 280 156, 480 154 L 575 166"
                fill="none"
                stroke="rgba(0, 240, 255, 0.45)"
                strokeWidth="1.2"
              />

              {/* Tesla Matrix LED Headlight (Eyebrow DRL Blade) */}
              <path
                d="M 628 178 L 575 166 L 590 172"
                fill="none"
                stroke="#ffffff"
                strokeWidth="3.2"
                filter="url(#intenseGlow)"
              />

              {/* Tesla Signature LED Taillight (Red OLED Blade) */}
              <path
                d="M 98 156 L 125 153"
                fill="none"
                stroke="#ff1744"
                strokeWidth="3.6"
                filter="url(#redGlow)"
              />

              {/* ── HIGH-TECH TESLA ÜBERTURBINE AERO WHEELS ──────────── */}

              {/* Rear Wheel (Überturbine Aero Wheel) */}
              <g transform="translate(175, 200)">
                {/* Outer Tire & Stance */}
                <circle r="36" fill="none" stroke="rgba(0, 240, 255, 0.25)" strokeWidth="4.5" />
                <circle r="33" fill="rgba(3, 14, 28, 0.95)" stroke="#00f0ff" strokeWidth="2" filter="url(#cyanGlow)" />
                {/* Performance Red Brake Caliper */}
                <path
                  d="M -14 -16 A 20 20 0 0 1 -4 -20 L -2 -14 A 14 14 0 0 0 -10 -11 Z"
                  fill="#ff1744"
                  filter="url(#redGlow)"
                />
                {/* 10-Spoke Directional Turbine Blades */}
                <motion.g animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 3.5, ease: 'linear' }}>
                  {[0, 36, 72, 108, 144, 180, 216, 252, 288, 324].map(deg => {
                    const rad = (deg * Math.PI) / 180
                    const radEnd = ((deg + 14) * Math.PI) / 180
                    return (
                      <line
                        key={deg}
                        x1={8 * Math.cos(rad)}
                        y1={8 * Math.sin(rad)}
                        x2={28 * Math.cos(radEnd)}
                        y2={28 * Math.sin(radEnd)}
                        stroke="rgba(0, 240, 255, 0.75)"
                        strokeWidth="1.6"
                      />
                    )
                  })}
                  <circle r="10" fill="#041220" stroke="#00f0ff" strokeWidth="1.8" />
                  {/* Central Tesla "T" Accent */}
                  <path d="M -4 -3 L 4 -3 M 0 -3 L 0 4" stroke="#00ffaa" strokeWidth="1.5" strokeLinecap="round" />
                </motion.g>
              </g>

              {/* Front Wheel (Überturbine Aero Wheel) */}
              <g transform="translate(525, 200)">
                {/* Outer Tire & Stance */}
                <circle r="36" fill="none" stroke="rgba(0, 240, 255, 0.25)" strokeWidth="4.5" />
                <circle r="33" fill="rgba(3, 14, 28, 0.95)" stroke="#00f0ff" strokeWidth="2" filter="url(#cyanGlow)" />
                {/* Performance Red Brake Caliper */}
                <path
                  d="M -14 -16 A 20 20 0 0 1 -4 -20 L -2 -14 A 14 14 0 0 0 -10 -11 Z"
                  fill="#ff1744"
                  filter="url(#redGlow)"
                />
                {/* 10-Spoke Directional Turbine Blades */}
                <motion.g animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 3.5, ease: 'linear' }}>
                  {[0, 36, 72, 108, 144, 180, 216, 252, 288, 324].map(deg => {
                    const rad = (deg * Math.PI) / 180
                    const radEnd = ((deg + 14) * Math.PI) / 180
                    return (
                      <line
                        key={deg}
                        x1={8 * Math.cos(rad)}
                        y1={8 * Math.sin(rad)}
                        x2={28 * Math.cos(radEnd)}
                        y2={28 * Math.sin(radEnd)}
                        stroke="rgba(0, 240, 255, 0.75)"
                        strokeWidth="1.6"
                      />
                    )
                  })}
                  <circle r="10" fill="#041220" stroke="#00f0ff" strokeWidth="1.8" />
                  {/* Central Tesla "T" Accent */}
                  <path d="M -4 -3 L 4 -3 M 0 -3 L 0 4" stroke="#00ffaa" strokeWidth="1.5" strokeLinecap="round" />
                </motion.g>
              </g>

              {/* ── DYNAMIC HOLOGRAPHIC VERTICAL LASER SCANNER ───────── */}
              <motion.g
                initial={{ x: 75 }}
                animate={{ x: [75, 635, 75] }}
                transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
              >
                {/* Vertical laser beam curtain */}
                <rect x="-24" y="65" width="24" height="175" fill="url(#laserBeam)" opacity={0.65} />
                {/* Primary laser stroke */}
                <line x1="0" y1="60" x2="0" y2="238" stroke="#ffffff" strokeWidth="2.5" filter="url(#intenseGlow)" />
                {/* Top & Bottom Emitter Nodes */}
                <circle cx="0" cy="60" r="3.5" fill="#00ffaa" filter="url(#intenseGlow)" />
                <circle cx="0" cy="238" r="3.5" fill="#00ffaa" filter="url(#intenseGlow)" />
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
