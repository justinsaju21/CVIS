'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Navigation } from 'lucide-react'

import WireframeCarLoader from '@/components/layout/WireframeCarLoader'
import CustomCursor from '@/components/layout/CustomCursor'
import { fetchVehicles } from '@/lib/api'
import type { FleetVehicle } from '@/lib/types'

export default function HomePage() {
  const router = useRouter()
  const [loaded, setLoaded] = useState(false)
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([])

  useEffect(() => {
    fetchVehicles()
      .then((fleet) => setVehicles(fleet as FleetVehicle[]))
      .catch(() => {})
  }, [])

  if (!loaded) return <WireframeCarLoader onComplete={() => setLoaded(true)} message="Loading Fleet Registry..." />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#020406', position: 'relative' }}>
      <CustomCursor />
      <div className="scan-line" />
      <div className="hud-grid-bg" style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 800, width: '100%', padding: '0 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <h1 className="font-display" style={{ fontSize: 32, letterSpacing: '0.2em', color: 'var(--cyan)', textShadow: '0 0 30px rgba(0,212,255,0.3)' }}>
            CVIS FLEET REGISTRY
          </h1>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'Space Mono', letterSpacing: '0.1em', marginTop: 8 }}>
            SELECT A VEHICLE TO INITIALIZE DRIVE CONSOLE
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {vehicles.map(v => {
            // derive slug from device_id: ESP32-ALPHA -> alpha
            const slug = v.device_id.toLowerCase().replace('esp32-', '')
            return (
              <motion.button
                key={v.device_id}
                onClick={() => router.push(`/driver/${slug}`)}
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  padding: 24, background: 'rgba(0,212,255,0.03)', border: '1px solid rgba(0,212,255,0.15)',
                  borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.5)', cursor: 'pointer', position: 'relative', overflow: 'hidden',
                }}
              >
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: v.color, boxShadow: `0 0 12px ${v.color}` }} />

                <div style={{ width: 48, height: 48, borderRadius: '50%', background: `${v.color}22`, border: `1px solid ${v.color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Navigation size={24} color={v.color} style={{ filter: `drop-shadow(0 0 8px ${v.color})` }} />
                </div>

                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'white', fontFamily: 'Orbitron', letterSpacing: '0.1em' }}>{v.name}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: 'Space Mono', marginTop: 4 }}>{v.device_id}</div>
                  <div style={{ fontSize: 9, color: 'rgba(0,212,255,0.6)', fontFamily: 'Space Mono', marginTop: 2, letterSpacing: '0.08em' }}>
                    /driver/{slug}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, padding: '6px 12px', background: 'rgba(0,0,0,0.4)', borderRadius: 20 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: v.active ? '#2ed573' : 'rgba(255,255,255,0.2)', boxShadow: v.active ? '0 0 8px #2ed573' : 'none' }} />
                  <span style={{ fontSize: 9, fontFamily: 'Space Mono', color: v.active ? '#2ed573' : 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>
                    {v.active ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>
              </motion.button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
