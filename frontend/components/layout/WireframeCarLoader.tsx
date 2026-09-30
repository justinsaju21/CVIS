'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  onComplete?: () => void
  message?: string
}

// Snappy, elegant buildup duration (seconds)
const TOTAL_DURATION = 2.6

export default function WireframeCarLoader({ onComplete, message = 'INITIALIZING VEHICLE CONSOLE' }: Props) {
  const [progress, setProgress] = useState(0)
  const startTime = useRef(Date.now())
  const raf = useRef<number | null>(null)

  useEffect(() => {
    const tick = () => {
      const elapsed = (Date.now() - startTime.current) / 1000
      const pct = Math.min(elapsed / TOTAL_DURATION, 1)
      setProgress(pct)

      if (pct >= 1) {
        const timeout = setTimeout(() => {
          onComplete?.()
        }, 1000)
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

  const pctInt = Math.round(progress * 100)

  // Helper function to calculate path dash offset based on progress interval
  const getPathOffset = (start: number, end: number, length: number) => {
    if (progress <= start) return length
    if (progress >= end) return 0
    const ratio = (progress - start) / (end - start)
    return length * (1 - ratio)
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, scale: 0.99 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          background: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '36px 32px',
          overflow: 'hidden',
          userSelect: 'none',
          color: '#0f172a',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        {/* Architectural Ambient Light Grid */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(2, 132, 199, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(2, 132, 199, 0.04) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          pointerEvents: 'none',
        }} />

        {/* ── TOP MINIMALIST HEADER ────────────────────────────────────────── */}
        <div style={{
          width: '100%',
          maxWidth: 900,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'relative',
          zIndex: 10,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 11,
            letterSpacing: '0.2em',
            fontWeight: 700,
            color: '#475569',
            textTransform: 'uppercase',
            fontFamily: "'Space Mono', monospace",
          }}>
            <span style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#0284c7',
              boxShadow: '0 0 10px rgba(2, 132, 199, 0.6)',
            }} />
            CVIS // AERODYNAMIC ARCHITECTURE
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            fontSize: 10,
            letterSpacing: '0.14em',
            fontWeight: 600,
            color: '#94a3b8',
            fontFamily: "'Space Mono', monospace",
          }}>
            <span>CAD-REV 4.2</span>
            <span style={{ color: '#cbd5e1' }}>|</span>
            <span style={{ color: '#0284c7' }}>STAGE 01 CALIBRATION</span>
          </div>
        </div>

        {/* ── CENTER: POINTY SPORTS CAR BLUEPRINT CAD BUILDUP ───────────────── */}
        <div style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          width: '100%',
          maxWidth: 900,
          margin: '18px 0',
          zIndex: 10,
        }}>
          {/* Blueprint Engineering Viewport Card */}
          <div style={{
            position: 'relative',
            width: '100%',
            background: 'linear-gradient(180deg, #ffffff 0%, #f0f7ff 100%)',
            border: '1.5px solid rgba(2, 132, 199, 0.35)',
            borderRadius: 14,
            padding: '24px 20px',
            boxShadow: '0 16px 40px -12px rgba(2, 132, 199, 0.12), 0 0 0 1px rgba(2, 132, 199, 0.08)',
            overflow: 'hidden',
          }}>
            {/* High-Tech CAD Coordinate Grid Pattern */}
            <div style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `
                linear-gradient(rgba(2, 132, 199, 0.08) 1px, transparent 1px),
                linear-gradient(90deg, rgba(2, 132, 199, 0.08) 1px, transparent 1px)
              `,
              backgroundSize: '28px 28px',
              pointerEvents: 'none',
            }} />

            {/* Corner Precision Registration Marks */}
            <div style={{ position: 'absolute', top: 10, left: 10, fontSize: 10, color: '#0284c7', fontFamily: 'monospace', opacity: 0.6 }}>+</div>
            <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 10, color: '#0284c7', fontFamily: 'monospace', opacity: 0.6 }}>+</div>
            <div style={{ position: 'absolute', bottom: 10, left: 10, fontSize: 10, color: '#0284c7', fontFamily: 'monospace', opacity: 0.6 }}>+</div>
            <div style={{ position: 'absolute', bottom: 10, right: 10, fontSize: 10, color: '#0284c7', fontFamily: 'monospace', opacity: 0.6 }}>+</div>

            {/* Subtle Ground Shadow */}
            <div style={{
              position: 'absolute',
              bottom: 22,
              left: '12%',
              right: '10%',
              height: 10,
              background: 'radial-gradient(ellipse at center, rgba(2, 132, 199, 0.18) 0%, transparent 72%)',
              pointerEvents: 'none',
            }} />

            {/* ── THE POINTY SPORTS SUPERCAR SVG ────────────────────────────── */}
            <svg
              viewBox="0 0 860 280"
              style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
            >
              <defs>
                <linearGradient id="blueprintBlue" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#0284c7" />
                  <stop offset="50%" stopColor="#0ea5e9" />
                  <stop offset="100%" stopColor="#0284c7" />
                </linearGradient>

                {/* Laser Headlight Projection */}
                <linearGradient id="laserBeam" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(2, 132, 199, 0.4)" />
                  <stop offset="100%" stopColor="rgba(2, 132, 199, 0)" />
                </linearGradient>
              </defs>

              {/* Laser Headlight Projected Beam */}
              <motion.polygon
                points="768,198 855,188 855,220 774,208"
                fill="url(#laserBeam)"
                initial={{ opacity: 0 }}
                animate={{ opacity: progress > 0.72 ? 0.7 : 0 }}
                transition={{ duration: 0.3 }}
              />

              {/* ── 1. GROUND PLANE & CHASSIS RAILS (Step 1) ────────────────── */}
              <line
                x1="40" y1="228" x2="820" y2="228"
                stroke="rgba(2, 132, 199, 0.25)"
                strokeWidth="1"
                strokeDasharray="4 4"
              />

              {/* ── 2. REAR GT WING / SPOILER ON STANCHIONS (Matching Reference) ─ */}
              {/* Left Endplate */}
              <path
                d="M 88 74 L 88 102 L 94 102 L 94 74 Z"
                fill="rgba(2, 132, 199, 0.08)"
                stroke="#0284c7"
                strokeWidth="1.6"
                strokeDasharray="100"
                strokeDashoffset={getPathOffset(0.15, 0.5, 100)}
              />
              {/* Main Aerodynamic Wing Blade */}
              <path
                d="M 94 80 L 152 83 L 152 88 L 94 85 Z"
                fill="rgba(2, 132, 199, 0.12)"
                stroke="#0284c7"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeDasharray="140"
                strokeDashoffset={getPathOffset(0.18, 0.52, 140)}
              />
              {/* Rear Strut */}
              <line
                x1="106" y1="86" x2="108" y2="116"
                stroke="#0284c7"
                strokeWidth="1.5"
                strokeDasharray="35"
                strokeDashoffset={getPathOffset(0.22, 0.55, 35)}
              />
              {/* Front Strut */}
              <line
                x1="138" y1="87" x2="136" y2="116"
                stroke="#0284c7"
                strokeWidth="1.5"
                strokeDasharray="35"
                strokeDashoffset={getPathOffset(0.24, 0.56, 35)}
              />

              {/* ── 3. PRIMARY POINTY AERODYNAMIC SUPERCAR SILHOUETTE ─────────── */}
              {/* Length approx 2100px */}
              <path
                d={`
                  M 84 226
                  L 138 226
                  A 52 52 0 0 1 242 226
                  L 578 226
                  A 52 52 0 0 1 682 226
                  L 768 226
                  L 776 220
                  L 774 208
                  L 784 198
                  C 740 184 668 158 584 136
                  C 530 102 460 74 380 72
                  C 310 72 230 88 152 116
                  L 98 116
                  C 80 126 66 156 66 194
                  C 66 216 74 224 84 226
                  Z
                `}
                fill="none"
                stroke="#0284c7"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="2100"
                strokeDashoffset={getPathOffset(0.05, 0.6, 2100)}
              />

              {/* Lower Shark-Nose Carbon Front Splitter Lip */}
              <path
                d="M 682 226 L 778 226 L 786 218 L 774 208"
                fill="none"
                stroke="#0369a1"
                strokeWidth="1.4"
                strokeDasharray="140"
                strokeDashoffset={getPathOffset(0.25, 0.62, 140)}
              />

              {/* ── 4. POINTY CANOPY & DUAL GLASS GREENHOUSE ─────────────────── */}
              {/* Upper Window Frame & Windshield */}
              <path
                d="M 300 98 C 360 80 430 76 470 76 L 576 136 L 312 138 Z"
                fill="rgba(2, 132, 199, 0.05)"
                stroke="#0284c7"
                strokeWidth="1.6"
                strokeDasharray="800"
                strokeDashoffset={getPathOffset(0.3, 0.72, 800)}
              />

              {/* Vertical B-Pillar Window Divider */}
              <line
                x1="395" y1="78" x2="395" y2="138"
                stroke="#0284c7"
                strokeWidth="1.5"
                strokeDasharray="60"
                strokeDashoffset={getPathOffset(0.38, 0.74, 60)}
              />

              {/* Rear Quarter Glass Diagonal Frame */}
              <line
                x1="340" y1="90" x2="322" y2="138"
                stroke="rgba(2, 132, 199, 0.65)"
                strokeWidth="1.2"
                strokeDasharray="50"
                strokeDashoffset={getPathOffset(0.42, 0.76, 50)}
              />

              {/* Aerodynamic Wing Mirror on Door */}
              <path
                d="M 522 136 L 546 134 L 548 140 L 528 141 Z"
                fill="none"
                stroke="#0284c7"
                strokeWidth="1.4"
                strokeDasharray="45"
                strokeDashoffset={getPathOffset(0.45, 0.78, 45)}
              />
              <line
                x1="532" y1="141" x2="534" y2="146"
                stroke="#0284c7"
                strokeWidth="1.4"
                strokeDasharray="10"
                strokeDashoffset={getPathOffset(0.46, 0.79, 10)}
              />

              {/* ── 5. SUPERCAR DOOR CONTOURS & VERTICAL NACA SIDE BLADE ───────── */}
              {/* Front Curved Door Shutline */}
              <path
                d="M 572 138 C 580 162 584 192 578 226"
                fill="none"
                stroke="#0284c7"
                strokeWidth="1.4"
                strokeDasharray="120"
                strokeDashoffset={getPathOffset(0.45, 0.8, 120)}
              />

              {/* Rear Supercar Sweeping Door Shutline */}
              <path
                d="M 395 138 C 406 170 426 200 462 220 L 482 226"
                fill="none"
                stroke="#0284c7"
                strokeWidth="1.4"
                strokeDasharray="150"
                strokeDashoffset={getPathOffset(0.48, 0.82, 150)}
              />

              {/* Flush Minimalist Door Handle */}
              <rect
                x="415" y="152" width="28" height="5" rx="2.5"
                fill="none"
                stroke="#0284c7"
                strokeWidth="1.3"
                strokeDasharray="70"
                strokeDashoffset={getPathOffset(0.52, 0.84, 70)}
              />

              {/* PROMINENT VERTICAL SIDE NACA AIR INTAKE VENT (Audi R8 / Reference) */}
              <path
                d="M 302 182 L 318 182 L 312 224 L 296 224 Z"
                fill="rgba(2, 132, 199, 0.08)"
                stroke="#0284c7"
                strokeWidth="1.6"
                strokeDasharray="140"
                strokeDashoffset={getPathOffset(0.5, 0.85, 140)}
              />
              <line
                x1="306" y1="184" x2="300" y2="222"
                stroke="rgba(2, 132, 199, 0.6)"
                strokeWidth="1"
                strokeDasharray="40"
                strokeDashoffset={getPathOffset(0.53, 0.86, 40)}
              />

              {/* Rocker Aerodynamic Notch Step */}
              <line
                x1="265" y1="222" x2="275" y2="226"
                stroke="#0284c7"
                strokeWidth="1.4"
                strokeDasharray="15"
                strokeDashoffset={getPathOffset(0.55, 0.86, 15)}
              />

              {/* ── 6. FRONT HEADLIGHTS & BUMPER AERODYNAMICS (Pointy Supercar) ── */}
              {/* Sharp Pointy Wedge Headlight Housing */}
              <path
                d="M 684 168 L 760 194 L 718 198 Z"
                fill="rgba(2, 132, 199, 0.15)"
                stroke="#0284c7"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="180"
                strokeDashoffset={getPathOffset(0.6, 0.9, 180)}
              />
              {/* Internal Projector Laser Line */}
              <line
                x1="695" y1="182" x2="746" y2="194"
                stroke="#0284c7"
                strokeWidth="1.8"
                strokeDasharray="60"
                strokeDashoffset={getPathOffset(0.65, 0.92, 60)}
              />

              {/* Lower Front Bumper Intake Vent */}
              <path
                d="M 726 210 L 764 214 L 756 224 L 720 222 Z"
                fill="none"
                stroke="#0284c7"
                strokeWidth="1.4"
                strokeDasharray="120"
                strokeDashoffset={getPathOffset(0.62, 0.9, 120)}
              />

              {/* Hood Sharp Wedge Crease */}
              <path
                d="M 575 138 L 684 168"
                fill="none"
                stroke="rgba(2, 132, 199, 0.55)"
                strokeWidth="1.2"
                strokeDasharray="120"
                strokeDashoffset={getPathOffset(0.55, 0.86, 120)}
              />

              {/* ── 7. REAR TAILLIGHT & REAR HAUNCH SCULPTURE ────────────────── */}
              {/* Curved OLED Taillight Slash */}
              <path
                d="M 68 142 C 72 152 76 172 98 192"
                fill="none"
                stroke="#ef4444"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeDasharray="70"
                strokeDashoffset={getPathOffset(0.68, 0.94, 70)}
              />

              {/* Muscular Rear Fender Arch Crease */}
              <path
                d="M 124 190 C 145 152 238 152 258 190"
                fill="none"
                stroke="rgba(2, 132, 199, 0.4)"
                strokeWidth="1.2"
                strokeDasharray="160"
                strokeDashoffset={getPathOffset(0.6, 0.88, 160)}
              />

              {/* Muscular Front Fender Arch Crease */}
              <path
                d="M 566 190 C 585 152 678 152 698 190"
                fill="none"
                stroke="rgba(2, 132, 199, 0.4)"
                strokeWidth="1.2"
                strokeDasharray="160"
                strokeDashoffset={getPathOffset(0.6, 0.88, 160)}
              />

              {/* ── 8. DIRECTIONAL MULTISPOKE TURBINE ALLOY WHEELS ────────────── */}
              {/* REAR WHEEL (Center 190, 204, Radius 48) */}
              <g transform="translate(190, 204)" opacity={progress > 0.35 ? 1 : 0.08} style={{ transition: 'opacity 0.3s' }}>
                {/* Tire Outer Ring */}
                <circle r="48" fill="none" stroke="#0284c7" strokeWidth="2.2" />
                {/* Rim Lip Ring */}
                <circle r="42" fill="#ffffff" stroke="#0284c7" strokeWidth="1.4" />
                {/* Brembo Performance Red Caliper */}
                <path d="M -18 -22 A 28 28 0 0 1 -4 -28 L -2 -19 A 19 19 0 0 0 -13 -14 Z" fill="#ef4444" />
                {/* 18 Fine Radial Spoke Turbine */}
                <motion.g animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 4.5, ease: 'linear' }}>
                  {[0, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300, 320, 340].map(deg => {
                    const rad = (deg * Math.PI) / 180
                    return (
                      <line
                        key={deg}
                        x1={14 * Math.cos(rad)} y1={14 * Math.sin(rad)}
                        x2={40 * Math.cos(rad)} y2={40 * Math.sin(rad)}
                        stroke="#0284c7"
                        strokeWidth="1.3"
                      />
                    )
                  })}
                  {/* Inner Hub Circle */}
                  <circle r="14" fill="#f8fafc" stroke="#0284c7" strokeWidth="1.5" />
                  {/* Center Lug Cap */}
                  <circle r="6" fill="#0284c7" />
                </motion.g>
              </g>

              {/* FRONT WHEEL (Center 630, 204, Radius 48) */}
              <g transform="translate(630, 204)" opacity={progress > 0.35 ? 1 : 0.08} style={{ transition: 'opacity 0.3s' }}>
                {/* Tire Outer Ring */}
                <circle r="48" fill="none" stroke="#0284c7" strokeWidth="2.2" />
                {/* Rim Lip Ring */}
                <circle r="42" fill="#ffffff" stroke="#0284c7" strokeWidth="1.4" />
                {/* Brembo Performance Red Caliper */}
                <path d="M -18 -22 A 28 28 0 0 1 -4 -28 L -2 -19 A 19 19 0 0 0 -13 -14 Z" fill="#ef4444" />
                {/* 18 Fine Radial Spoke Turbine */}
                <motion.g animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 4.5, ease: 'linear' }}>
                  {[0, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200, 220, 240, 260, 280, 300, 320, 340].map(deg => {
                    const rad = (deg * Math.PI) / 180
                    return (
                      <line
                        key={deg}
                        x1={14 * Math.cos(rad)} y1={14 * Math.sin(rad)}
                        x2={40 * Math.cos(rad)} y2={40 * Math.sin(rad)}
                        stroke="#0284c7"
                        strokeWidth="1.3"
                      />
                    )
                  })}
                  {/* Inner Hub Circle */}
                  <circle r="14" fill="#f8fafc" stroke="#0284c7" strokeWidth="1.5" />
                  {/* Center Lug Cap */}
                  <circle r="6" fill="#0284c7" />
                </motion.g>
              </g>
            </svg>
          </div>
        </div>

        {/* ── BOTTOM: MINIMALIST PROGRESS (ZERO INFORMATION OVERLOAD) ───────── */}
        <div style={{
          width: '100%',
          maxWidth: 900,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          position: 'relative',
          zIndex: 10,
        }}>
          {/* Label + Percentage Readout */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
          }}>
            <div style={{
              fontSize: 11,
              letterSpacing: '0.16em',
              fontWeight: 600,
              color: '#64748b',
              textTransform: 'uppercase',
              fontFamily: "'Space Mono', monospace",
            }}>
              {progress >= 1 ? 'READY // LAUNCHING CONSOLE' : message}
            </div>

            <div style={{
              fontSize: 18,
              fontWeight: 800,
              fontFamily: "'Space Mono', monospace",
              color: '#0284c7',
              letterSpacing: '-0.02em',
            }}>
              {String(pctInt).padStart(2, '0')}%
            </div>
          </div>

          {/* Clean Razor-Thin Progress Bar */}
          <div style={{
            width: '100%',
            height: 3,
            background: '#e2e8f0',
            borderRadius: 2,
            overflow: 'hidden',
          }}>
            <motion.div
              style={{
                height: '100%',
                width: `${pctInt}%`,
                background: '#0284c7',
                borderRadius: 2,
              }}
              transition={{ ease: 'easeOut', duration: 0.08 }}
            />
          </div>

          {/* Minimalist Direct Click Entry */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginTop: 2,
          }}>
            <button
              onClick={() => onComplete?.()}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: 10,
                letterSpacing: '0.12em',
                fontFamily: "'Space Mono', monospace",
                cursor: 'pointer',
                padding: '4px 0',
                transition: 'color 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#0284c7' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8' }}
            >
              SKIP →
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
