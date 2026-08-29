'use client'

/**
 * MobileAccessGate — wraps every mobile app route.
 *
 * Fetches the vehicle's tier + mobile_access_enabled state from the backend.
 * Renders one of three states:
 *   1. Loading skeleton
 *   2. PremiumGate    — vehicle is free-tier (upgrade required)
 *   3. AccessSuspended — premium but NOC has disabled access
 *   4. Children       — access granted, renders DriverDashboard
 *
 * CCNS mapping: Unit 4 (Access Control, Authorisation Tiers)
 */

import { useEffect, useState, ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Crown, Lock, Wifi, AlertTriangle } from 'lucide-react'
import { fetchMobileAccess } from '@/lib/api'

interface AccessState {
  loading: boolean
  tier: 'free' | 'premium' | null
  enabled: boolean
  error: string | null
}

// ─── Animated background grid (reuses CVIS aesthetic) ───────────────────────
function HudBg({ accent }: { accent: string }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 0,
      background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${accent}08 0%, #0a0f1a 70%)`,
      overflow: 'hidden',
    }}>
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.04 }}>
        <defs>
          <pattern id="gate-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke={accent} strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#gate-grid)" />
      </svg>
      <div style={{
        position: 'absolute', top: '-20%', left: '50%',
        transform: 'translateX(-50%)',
        width: 600, height: 600,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${accent}12 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
    </div>
  )
}

// ─── Loading skeleton ────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#0a0f1a',
    }}>
      <HudBg accent="#0ea5e9" />
      <motion.div
        animate={{ opacity: [0.3, 0.8, 0.3] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}
      >
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          border: '2px solid #0ea5e9',
          borderTopColor: 'transparent',
          animation: 'spin 0.8s linear infinite',
        }} />
        <span style={{
          fontFamily: 'Inter, sans-serif', fontSize: 13,
          letterSpacing: '0.12em', color: '#0ea5e9',
          textTransform: 'uppercase' as const,
        }}>Verifying access…</span>
      </motion.div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

// ─── Shared gate panel shell ─────────────────────────────────────────────────
function GatePanel({
  accent, icon: Icon, badge, title, subtitle, children,
}: {
  accent: string
  icon: React.ElementType
  badge: string
  title: string
  subtitle: string
  children?: ReactNode
}) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#0a0f1a', padding: '24px 16px',
      fontFamily: 'Inter, sans-serif',
    }}>
      <HudBg accent={accent} />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        style={{
          position: 'relative', zIndex: 1,
          width: '100%', maxWidth: 380,
          background: 'rgba(15, 23, 42, 0.85)',
          border: `1px solid ${accent}30`,
          borderRadius: 16,
          backdropFilter: 'blur(24px)',
          boxShadow: `0 0 60px ${accent}14, 0 32px 80px rgba(0,0,0,0.6)`,
          overflow: 'hidden',
        }}
      >
        <div style={{ height: 3, background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
        <div style={{ padding: '32px 28px 28px' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 12px', borderRadius: 20,
            background: `${accent}14`,
            border: `1px solid ${accent}30`,
            marginBottom: 24,
          }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: accent, boxShadow: `0 0 6px ${accent}` }} />
            <span style={{ fontSize: 11, letterSpacing: '0.12em', color: accent, textTransform: 'uppercase' as const, fontWeight: 600 }}>
              {badge}
            </span>
          </div>

          <motion.div
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              width: 72, height: 72, borderRadius: 20,
              background: `${accent}12`,
              border: `1px solid ${accent}25`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 24,
              boxShadow: `0 0 30px ${accent}18`,
            }}
          >
            <Icon size={32} color={accent} />
          </motion.div>

          <h1 style={{
            fontSize: 22, fontWeight: 700, color: '#f1f5f9',
            marginBottom: 10, letterSpacing: '-0.01em', lineHeight: 1.3,
          }}>{title}</h1>
          <p style={{
            fontSize: 14, color: 'rgba(148, 163, 184, 0.85)',
            lineHeight: 1.7, marginBottom: 28,
          }}>{subtitle}</p>

          {children}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
        style={{
          position: 'relative', zIndex: 1, marginTop: 24,
          display: 'flex', alignItems: 'center', gap: 8,
        }}
      >
        <Wifi size={10} color={`${accent}60`} />
        <span style={{ fontSize: 11, letterSpacing: '0.1em', color: `${accent}50`, textTransform: 'uppercase' as const }}>
          CVIS · Connected Vehicle Intelligence System
        </span>
      </motion.div>
    </div>
  )
}

// ─── Premium Required (free tier) ────────────────────────────────────────────
function PremiumGate({ vehicleName }: { vehicleName: string }) {
  return (
    <GatePanel
      accent="#f59e0b"
      icon={Crown}
      badge="Premium Feature"
      title="Premium Access Required"
      subtitle={`The ${vehicleName} mobile dashboard is available exclusively to Premium tier subscribers. Upgrade your vehicle plan to unlock real-time telemetry, AI recommendations, and live chat — on the go.`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
        {[
          'Real-time telemetry on your phone',
          'AI-powered health recommendations',
          'Live chat with CVIS assistant',
          'Battery & range monitoring',
        ].map((feat) => (
          <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: 'rgba(148,163,184,0.9)' }}>{feat}</span>
          </div>
        ))}
      </div>

      <div style={{
        display: 'flex', gap: 10, padding: '12px 14px',
        background: 'rgba(245,158,11,0.06)',
        border: '1px solid rgba(245,158,11,0.2)',
        borderRadius: 8,
      }}>
        <Lock size={14} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
        <span style={{ fontSize: 12, color: 'rgba(148,163,184,0.8)', lineHeight: 1.6 }}>
          Contact your fleet administrator or NOC engineer to upgrade this vehicle to the Premium tier.
        </span>
      </div>
    </GatePanel>
  )
}

// ─── Main gate component ──────────────────────────────────────────────────────
interface MobileAccessGateProps {
  vehicleId: string
  vehicleName: string
  children: ReactNode
}

export default function MobileAccessGate({ vehicleId, vehicleName, children }: MobileAccessGateProps) {
  const [state, setState] = useState<AccessState>({
    loading: true,
    tier: null,
    enabled: false,
    error: null,
  })

  useEffect(() => {
    fetchMobileAccess(vehicleId)
      .then((data) => {
        const d = data as { tier: 'free' | 'premium'; enabled: boolean }
        setState({ loading: false, tier: d.tier, enabled: d.enabled, error: null })
      })
      .catch((err: unknown) => {
        // Fail-closed on error: show PremiumGate screen
        setState({
          loading: false, tier: null, enabled: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        })
      })
  }, [vehicleId])

  if (state.loading) return <LoadingSkeleton />
  if (!state.enabled) return <PremiumGate vehicleName={vehicleName} />
  
  return <>{children}</>
}
