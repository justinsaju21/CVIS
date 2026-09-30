'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Car, ChevronRight, Activity, ShieldCheck, Zap } from 'lucide-react'

import WireframeCarLoader from '@/components/layout/WireframeCarLoader'
import CustomCursor from '@/components/layout/CustomCursor'
import { fetchVehicles } from '@/lib/api'
import type { FleetVehicle } from '@/lib/types'

export default function HomePage() {
  const router = useRouter()
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null)
  const [vehicles, setVehicles] = useState<FleetVehicle[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchVehicles()
      .then((fleet) => setVehicles(fleet as FleetVehicle[]))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (selectedVehicle) {
    return (
      <WireframeCarLoader
        onComplete={() => router.push(`/driver/${selectedVehicle}`)}
        message="Initializing Drive Console..."
      />
    )
  }

  // Fallback vehicle list if API is starting up
  const displayVehicles = vehicles.length > 0 ? vehicles : [
    { device_id: 'ESP32-ALPHA', name: 'Alpha Vehicle', color: '#0284c7', active: true },
    { device_id: 'ESP32-BETA',  name: 'Beta Vehicle',  color: '#10b981', active: true },
    { device_id: 'ESP32-GAMMA', name: 'Gamma Vehicle', color: '#8b5cf6', active: false },
    { device_id: 'ESP32-DELTA', name: 'Delta Vehicle', color: '#f59e0b', active: false },
  ]

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f8fafc',
      color: '#0f172a',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
    }}>
      <CustomCursor />

      {/* Subtle luxury light grid background */}
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(15, 23, 42, 0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(15, 23, 42, 0.03) 1px, transparent 1px)
        `,
        backgroundSize: '48px 48px',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* Main Container */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        width: '100%',
        maxWidth: 920,
        display: 'flex',
        flexDirection: 'column',
        gap: 32,
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            borderRadius: 20,
            background: 'rgba(2, 132, 199, 0.08)',
            border: '1px solid rgba(2, 132, 199, 0.2)',
            fontSize: 11,
            fontWeight: 700,
            color: '#0284c7',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: 14,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0284c7' }} />
            Connected Vehicle Intelligence System
          </div>

          <h1 style={{
            fontSize: 32,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: '#0f172a',
            margin: '0 0 10px 0',
          }}>
            CVIS Fleet Registry
          </h1>

          <p style={{
            fontSize: 14,
            color: '#64748b',
            maxWidth: 520,
            margin: '0 auto',
            lineHeight: 1.6,
          }}>
            Select an active vehicle to initialize secure telemetry synchronization, multi-factor AI reasoning, and real-time drive console.
          </p>
        </div>

        {/* Vehicle Cards Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 20,
        }}>
          {displayVehicles.map((v) => {
            const slug = v.device_id.toLowerCase().replace('esp32-', '')
            return (
              <motion.button
                key={v.device_id}
                onClick={() => setSelectedVehicle(slug)}
                whileHover={{ y: -4, boxShadow: '0 12px 28px rgba(0, 0, 0, 0.08)' }}
                whileTap={{ scale: 0.98 }}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 14,
                  padding: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  textAlign: 'left',
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
              >
                {/* Top Colored Accent Stripe */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 4,
                  background: v.color,
                }} />

                {/* Top Row: Icon + Online Status */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  width: '100%',
                  marginBottom: 16,
                }}>
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: `${v.color}14`,
                    border: `1px solid ${v.color}33`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Car size={22} color={v.color} />
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '3px 10px',
                    borderRadius: 12,
                    background: v.active ? 'rgba(16, 185, 129, 0.08)' : 'rgba(100, 116, 139, 0.08)',
                    border: `1px solid ${v.active ? 'rgba(16, 185, 129, 0.25)' : 'rgba(100, 116, 139, 0.15)'}`,
                  }}>
                    <span style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: v.active ? '#10b981' : '#94a3b8',
                      boxShadow: v.active ? '0 0 6px #10b981' : 'none',
                    }} />
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      color: v.active ? '#059669' : '#64748b',
                    }}>
                      {v.active ? 'ACTIVE' : 'STANDBY'}
                    </span>
                  </div>
                </div>

                {/* Vehicle Title & Device ID */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{
                    fontSize: 17,
                    fontWeight: 700,
                    color: '#0f172a',
                    letterSpacing: '-0.01em',
                  }}>
                    {v.name}
                  </div>
                  <div style={{
                    fontSize: 11,
                    color: '#64748b',
                    fontFamily: "'Space Mono', monospace",
                    marginTop: 3,
                  }}>
                    {v.device_id}
                  </div>
                </div>

                {/* Quick Specs Badges */}
                <div style={{
                  display: 'flex',
                  gap: 6,
                  flexWrap: 'wrap',
                  marginBottom: 20,
                  width: '100%',
                }}>
                  <span style={{
                    fontSize: 10,
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: '#f1f5f9',
                    color: '#475569',
                    fontWeight: 600,
                  }}>
                    800V BMS
                  </span>
                  <span style={{
                    fontSize: 10,
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: '#f1f5f9',
                    color: '#475569',
                    fontWeight: 600,
                  }}>
                    HMAC-SHA256
                  </span>
                  <span style={{
                    fontSize: 10,
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: '#f1f5f9',
                    color: '#475569',
                    fontWeight: 600,
                  }}>
                    MQTT / HTTP
                  </span>
                </div>

                {/* Bottom Launch Button Link */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                  paddingTop: 12,
                  borderTop: '1px solid #f1f5f9',
                  color: '#0284c7',
                  fontSize: 12,
                  fontWeight: 700,
                }}>
                  <span>Launch Drive Console</span>
                  <ChevronRight size={15} />
                </div>
              </motion.button>
            )
          })}
        </div>

        {/* Global Navigation Links (NOC / Admin) */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 16,
          marginTop: 8,
        }}>
          <button
            onClick={() => router.push('/noc')}
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: 12,
              fontWeight: 600,
              color: '#334155',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#0284c7'; e.currentTarget.style.color = '#0284c7' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#334155' }}
          >
            <Activity size={14} color="#0284c7" />
            Network Operations Center (NOC)
          </button>

          <button
            onClick={() => router.push('/admin')}
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: 12,
              fontWeight: 600,
              color: '#334155',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#0284c7'; e.currentTarget.style.color = '#0284c7' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#334155' }}
          >
            <ShieldCheck size={14} color="#0284c7" />
            Administrator Console
          </button>
        </div>
      </div>
    </div>
  )
}
