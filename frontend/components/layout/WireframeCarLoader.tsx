'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface Props {
  onComplete?: () => void
  message?: string
}

// Wireframe car SVG paths — side profile of a sedan
// Broken into segments that light up one by one
const CAR_PATHS = [
  // 1. Outline segments (Cybertruck profile)
  { d: 'M 40 100 L 220 50', delay: 0.0, dur: 0.6 }, // Vault (roof to tailgate)
  { d: 'M 220 50 L 330 95 L 420 115', delay: 0.6, dur: 0.8 }, // Windshield & Hood
  { d: 'M 420 115 L 420 130 L 410 140 L 395 145', delay: 1.4, dur: 0.5 }, // Nose & Front Bumper
  { d: 'M 395 145 L 380 110 L 325 110 L 310 145', delay: 1.9, dur: 0.6 }, // Front Arch (Angular)
  { d: 'M 310 145 L 155 145', delay: 2.5, dur: 0.5 }, // Side skirt
  { d: 'M 155 145 L 140 110 L 85 110 L 70 145', delay: 3.0, dur: 0.6 }, // Rear Arch (Angular)
  { d: 'M 70 145 L 55 145 L 45 140 L 40 100', delay: 3.6, dur: 0.6 }, // Rear bumper & tailgate

  // 2. Windows / Greenhouse (Angular)
  { d: 'M 220 58 L 150 82 L 150 97 L 315 97 L 330 87 Z', delay: 1.0, dur: 1.5 }, // Window outline
  { d: 'M 230 65 L 235 97', delay: 2.5, dur: 0.3 }, // B-pillar

  // 3. Wheels (Chunky Hex/Circles)
  { d: 'M 327.5 145 A 25 25 0 1 0 377.5 145 A 25 25 0 1 0 327.5 145', delay: 4.0, dur: 0.6 }, // front wheel
  { d: 'M 352.5 135 L 361 140 L 361 150 L 352.5 155 L 344 150 L 344 140 Z', delay: 4.2, dur: 0.5 }, // front hex hub
  { d: 'M 87.5 145 A 25 25 0 1 0 137.5 145 A 25 25 0 1 0 87.5 145', delay: 4.5, dur: 0.6 }, // rear wheel
  { d: 'M 112.5 135 L 121 140 L 121 150 L 112.5 155 L 104 150 L 104 140 Z', delay: 4.7, dur: 0.5 }, // rear hex hub

  // 4. Character Lines & Details
  { d: 'M 420 115 L 40 100', delay: 5.0, dur: 1.0 }, // Main angular body crease
  { d: 'M 235 97 L 235 145', delay: 5.5, dur: 0.3 }, // Front door gap
  { d: 'M 160 97 L 160 145', delay: 5.7, dur: 0.3 }, // Rear door gap
  
  // 5. Door Handles & Lights
  { d: 'M 175 105 L 185 105', delay: 6.0, dur: 0.1 }, // Rear door handle
  { d: 'M 250 105 L 260 105', delay: 6.1, dur: 0.1 }, // Front door handle
  { d: 'M 420 115 L 410 115', delay: 6.2, dur: 0.2 }, // Headlight slit
  { d: 'M 40 100 L 45 102', delay: 6.3, dur: 0.2 }, // Taillight slit
]

const TOTAL_DURATION = 7.0

export default function WireframeCarLoader({ onComplete, message = 'Connecting to CVIS...' }: Props) {
  const [progress,   setProgress]   = useState(0)
  const [phase,      setPhase]      = useState<'drawing' | 'glowing' | 'done'>('drawing')
  const [show,       setShow]       = useState(true)
  const startTime = useRef(Date.now())
  const raf       = useRef<number | null>(null)

  useEffect(() => {
    const tick = () => {
      const elapsed = (Date.now() - startTime.current) / 1000
      const pct     = Math.min(elapsed / TOTAL_DURATION, 1)
      setProgress(pct)

      if (pct >= 1 && phase === 'drawing') {
        setPhase('glowing')
        setTimeout(() => {
          setPhase('done')
          setTimeout(() => {
            setShow(false)
            onComplete?.()
          }, 600)
        }, 800)
        return
      }
      if (pct < 1) {
        raf.current = requestAnimationFrame(tick)
      }
    }
    raf.current = requestAnimationFrame(tick)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [phase, onComplete])

  const pathLength = 800

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'radial-gradient(ellipse at center, #050a0f 0%, #000000 70%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 40,
          }}
        >
          {/* Aurora blobs */}
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
            <div className="aurora-1" style={{
              position: 'absolute', top: '20%', left: '15%',
              width: 600, height: 600,
              background: 'radial-gradient(circle, rgba(0,212,255,0.06) 0%, transparent 70%)',
              borderRadius: '50%',
            }} />
            <div className="aurora-2" style={{
              position: 'absolute', bottom: '10%', right: '10%',
              width: 500, height: 500,
              background: 'radial-gradient(circle, rgba(0,100,255,0.05) 0%, transparent 70%)',
              borderRadius: '50%',
            }} />
          </div>

          {/* CVIS Brand */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            style={{ textAlign: 'center' }}
          >
            <div className="font-display" style={{
              fontSize: 13,
              letterSpacing: '0.3em',
              color: 'var(--cyan)',
              marginBottom: 8,
              textTransform: 'uppercase',
            }}>
              Connected Vehicle Intelligence System
            </div>
          </motion.div>

          {/* Wireframe car SVG */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            style={{ position: 'relative' }}
          >
            {/* Glow backdrop */}
            <div style={{
              position: 'absolute',
              inset: '-40px',
              background: 'radial-gradient(ellipse at center, rgba(0,212,255,0.08) 0%, transparent 70%)',
              borderRadius: '50%',
              pointerEvents: 'none',
              opacity: phase === 'glowing' ? 1 : 0,
              transition: 'opacity 0.5s',
            }} />

            <svg
              viewBox="0 0 440 230"
              width={Math.min(480, typeof window !== 'undefined' ? window.innerWidth * 0.85 : 480)}
              style={{ overflow: 'visible' }}
            >
              {/* Dark fill */}
              <path
                d="M 50 160 C 45 160 40 155 40 145 C 40 125 45 115 55 112 C 60 110 70 108 80 108 C 120 95 180 65 240 55 C 270 52 290 55 315 65 C 340 75 360 90 380 105 C 410 115 435 125 440 135 C 445 140 445 155 430 160 L 405 160 C 405 128 345 128 345 160 L 145 160 C 145 128 85 128 85 160 L 50 160 Z"
                fill="rgba(0,212,255,0.02)"
                stroke="none"
              />

              {/* Animated strokes */}
              {CAR_PATHS.map((p, i) => {
                const pathProgress = Math.max(0, Math.min(1,
                  (progress * TOTAL_DURATION - p.delay) / p.dur
                ))
                const glowIntensity = phase === 'glowing' ? 1 : pathProgress

                return (
                  <path
                    key={i}
                    d={p.d}
                    fill="none"
                    stroke={`rgba(0,212,255,${0.3 + glowIntensity * 0.7})`}
                    strokeWidth={phase === 'glowing' ? 2 : 1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={pathLength}
                    strokeDashoffset={pathLength * (1 - pathProgress)}
                    style={{
                      filter: pathProgress > 0.5
                        ? `drop-shadow(0 0 ${4 + glowIntensity * 8}px rgba(0,212,255,${glowIntensity * 0.8}))`
                        : 'none',
                      transition: 'filter 0.3s, stroke 0.3s',
                    }}
                  />
                )
              })}



              {/* Node dots at key points */}
              {[
                { cx: 115, cy: 160 }, { cx: 375, cy: 160 },  // wheel centers
                { cx: 245, cy: 62 },                           // B-pillar top
                { cx: 200, cy: 70 },                          // C-pillar top
                { cx: 440, cy: 135 },                         // Headlight tip
              ].map((pt, i) => (
                <motion.circle
                  key={i}
                  cx={pt.cx} cy={pt.cy} r={3}
                  fill="var(--cyan)"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={progress > 0.7 ? { opacity: [0, 1, 0.6], scale: [0, 1.5, 1] } : { opacity: 0 }}
                  transition={{ delay: i * 0.1, duration: 0.4 }}
                  style={{ filter: 'drop-shadow(0 0 6px rgba(0,212,255,0.8))' }}
                />
              ))}
            </svg>
          </motion.div>

          {/* Progress bar + status */}
          <div style={{ width: Math.min(400, typeof window !== 'undefined' ? window.innerWidth * 0.8 : 400) }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: 10,
              alignItems: 'center',
            }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                {phase === 'glowing' ? 'CVIS ONLINE' : message}
              </span>
              <span className="font-mono" style={{ fontSize: 12, color: 'var(--cyan)' }}>
                {Math.round(progress * 100)}%
              </span>
            </div>
            <div style={{
              height: 2,
              background: 'rgba(255,255,255,0.06)',
              borderRadius: 1,
              overflow: 'hidden',
            }}>
              <motion.div
                style={{
                  height: '100%',
                  background: 'linear-gradient(90deg, var(--cyan), rgba(0,212,255,0.4))',
                  borderRadius: 1,
                  boxShadow: '0 0 8px rgba(0,212,255,0.6)',
                  width: `${progress * 100}%`,
                }}
                transition={{ duration: 0.05 }}
              />
            </div>
          </div>

          {/* Status dots */}
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            {[
              { label: 'Telemetry', done: progress > 0.3 },
              { label: 'Auth Layer', done: progress > 0.5 },
              { label: 'AI Engine',  done: progress > 0.7 },
              { label: 'WebSocket', done: progress > 0.9 },
            ].map((item) => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: item.done ? 'var(--cyan)' : 'var(--text-muted)',
                  boxShadow: item.done ? '0 0 8px rgba(0,212,255,0.6)' : 'none',
                  transition: 'all 0.3s',
                }} />
                <span style={{ fontSize: 10, color: item.done ? 'var(--text-secondary)' : 'var(--text-muted)', letterSpacing: '0.1em' }}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
