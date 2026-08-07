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
  // 1. Lower body line and bumpers
  { d: 'M 50 160 C 45 160 40 155 40 150 C 40 135 50 125 65 120', delay: 0, dur: 0.5 }, // rear bumper
  { d: 'M 65 120 C 80 115 100 112 110 110', delay: 0.5, dur: 0.4 }, // rear trunk lid
  { d: 'M 110 110 C 130 95 160 75 200 65', delay: 0.9, dur: 0.6 }, // rear window
  { d: 'M 200 65 C 240 55 280 55 310 65', delay: 1.5, dur: 0.5 }, // roof
  { d: 'M 310 65 C 340 75 365 95 385 110', delay: 2.0, dur: 0.6 }, // windshield
  { d: 'M 385 110 C 410 115 430 120 445 130', delay: 2.6, dur: 0.5 }, // hood
  { d: 'M 445 130 C 455 135 460 145 455 155 C 450 160 440 160 430 160', delay: 3.1, dur: 0.4 }, // front bumper
  
  // 2. Wheel arches
  { d: 'M 430 160 L 390 160', delay: 3.5, dur: 0.2 }, // front overhang
  { d: 'M 390 160 C 390 128 340 128 340 160', delay: 3.7, dur: 0.5 }, // front wheel arch
  { d: 'M 340 160 L 160 160', delay: 4.2, dur: 0.5 }, // side skirt
  { d: 'M 160 160 C 160 128 110 128 110 160', delay: 4.7, dur: 0.5 }, // rear wheel arch
  { d: 'M 110 160 L 50 160', delay: 5.2, dur: 0.3 }, // rear overhang

  // 3. Windows / Greenhouse
  { d: 'M 130 112 C 150 98 175 80 205 72 C 240 64 275 64 300 72 C 325 80 345 98 360 112 C 365 115 365 118 360 118 L 135 118 C 130 118 128 115 130 112 Z', delay: 1.5, dur: 1.5 }, // window outline
  { d: 'M 240 70 L 240 118', delay: 3.0, dur: 0.3 }, // B-pillar
  
  // 4. Wheels
  { d: 'M 345 160 A 20 20 0 1 1 385 160 A 20 20 0 1 1 345 160', delay: 4.0, dur: 0.6 }, // front wheel
  { d: 'M 355 160 A 10 10 0 1 1 375 160 A 10 10 0 1 1 355 160', delay: 4.2, dur: 0.4 }, // front alloy
  { d: 'M 115 160 A 20 20 0 1 1 155 160 A 20 20 0 1 1 115 160', delay: 5.0, dur: 0.6 }, // rear wheel
  { d: 'M 125 160 A 10 10 0 1 1 145 160 A 10 10 0 1 1 125 160', delay: 5.2, dur: 0.4 }, // rear alloy
  
  // 5. Details
  { d: 'M 110 125 C 200 125 300 125 370 125', delay: 5.5, dur: 0.8 }, // character line / shoulder
  { d: 'M 435 135 L 415 130 L 410 135', delay: 6.0, dur: 0.2 }, // headlight
  { d: 'M 45 135 L 60 130 L 60 135', delay: 6.2, dur: 0.2 }, // taillight
  { d: 'M 170 118 L 178 118', delay: 6.4, dur: 0.1 }, // door handle rear
  { d: 'M 260 118 L 268 118', delay: 6.5, dur: 0.1 }, // door handle front
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
                d="M 40 150 C 40 135 50 125 65 120 C 80 115 100 112 110 110 C 130 95 160 75 200 65 C 240 55 280 55 310 65 C 340 75 365 95 385 110 C 410 115 430 120 445 130 C 455 135 460 145 455 155 C 450 160 440 160 430 160 L 390 160 C 390 128 340 128 340 160 L 160 160 C 160 128 110 128 110 160 L 50 160 C 45 160 40 155 40 150 Z"
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

              {/* Scan line effect */}
              {phase !== 'done' && (
                <motion.line
                  x1="0" y1="0" x2="440" y2="0"
                  stroke="rgba(0,212,255,0.3)"
                  strokeWidth="1"
                  animate={{ y1: [0, 230, 0], y2: [0, 230, 0] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
                />
              )}

              {/* Node dots at key points */}
              {[
                { cx: 135, cy: 160 }, { cx: 365, cy: 160 },  // wheel centers
                { cx: 240, cy: 70 },                           // B-pillar top
                { cx: 200, cy: 65 },                          // C-pillar top
                { cx: 435, cy: 135 },                         // Headlight
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
