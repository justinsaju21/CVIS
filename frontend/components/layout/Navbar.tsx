'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Wifi, WifiOff, Activity, Settings, LayoutDashboard, Network, Menu, X } from 'lucide-react'

const NAV_LINKS = [
  { href: '/driver', label: 'Driver',    icon: LayoutDashboard },
  { href: '/noc',    label: 'NOC',       icon: Network },
  { href: '/admin',  label: 'Admin',     icon: Settings },
]

interface Props {
  wsConnected?: boolean
}

export default function Navbar({ wsConnected = false }: Props) {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 30)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  return (
    <motion.header
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0,
        zIndex: 100,
        padding: '0 32px',
        height: 60,
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        background: scrolled ? 'rgba(0,0,0,0.85)' : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid var(--border)' : '1px solid transparent',
        transition: 'background 300ms, border-color 300ms',
      }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Animated CVIS hexagon */}
        <motion.svg
          width={28} height={28} viewBox="0 0 28 28"
          whileHover={{ rotate: 60 }}
          transition={{ type: 'spring', stiffness: 200 }}
        >
          <polygon
            points="14,2 25,8 25,20 14,26 3,20 3,8"
            fill="none"
            stroke="var(--cyan)"
            strokeWidth="1.5"
            style={{ filter: 'drop-shadow(0 0 4px rgba(0,212,255,0.5))' }}
          />
          <polygon
            points="14,7 21,11 21,17 14,21 7,17 7,11"
            fill="rgba(0,212,255,0.12)"
            stroke="var(--cyan)"
            strokeWidth="1"
          />
          <circle cx="14" cy="14" r="2.5" fill="var(--cyan)" style={{ filter: 'drop-shadow(0 0 4px rgba(0,212,255,0.8))' }} />
        </motion.svg>
        <div className="font-display" style={{
          fontSize: 14,
          letterSpacing: '0.2em',
          color: 'var(--text-primary)',
          display: 'flex',
          flexDirection: 'column',
          lineHeight: 1.1,
        }}>
          <span style={{ color: 'var(--cyan)', fontSize: 11 }}>CVIS</span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>Vehicle Intelligence</span>
        </div>
      </div>

      {/* Desktop nav */}
      <nav style={{ display: 'flex', gap: 4, alignItems: 'center' }} className="hide-mobile">
        {NAV_LINKS.map((link, i) => {
          const active = pathname?.startsWith(link.href)
          const Icon   = link.icon
          return (
            <motion.div
              key={link.href}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08, duration: 0.4 }}
            >
              <Link href={link.href} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: active ? 600 : 400,
                color: active ? 'var(--cyan)' : 'var(--text-secondary)',
                textDecoration: 'none',
                letterSpacing: '0.06em',
                background: active ? 'var(--cyan-dim)' : 'transparent',
                border: `1px solid ${active ? 'var(--border-active)' : 'transparent'}`,
                transition: 'all 150ms',
              }}>
                <Icon size={13} />
                {link.label}
              </Link>
            </motion.div>
          )
        })}
      </nav>

      {/* Right: WS status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {wsConnected ? (
            <>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', boxShadow: '0 0 6px rgba(46,213,115,0.6)' }} />
              <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>LIVE</span>
            </>
          ) : (
            <>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-muted)' }} />
              <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.1em' }}>OFFLINE</span>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <motion.button
          className="show-mobile"
          whileTap={{ scale: 0.9 }}
          onClick={() => setMenuOpen(!menuOpen)}
          style={{ background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: 4 }}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </motion.button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="show-mobile"
            style={{
              position: 'absolute',
              top: 60, left: 0, right: 0,
              background: 'rgba(0,0,0,0.95)',
              backdropFilter: 'blur(20px)',
              borderBottom: '1px solid var(--border)',
              padding: '16px 32px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              overflow: 'hidden',
            }}
          >
            {NAV_LINKS.map((link) => {
              const active = pathname?.startsWith(link.href)
              const Icon   = link.icon
              return (
                <Link key={link.href} href={link.href} onClick={() => setMenuOpen(false)} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  borderRadius: 8,
                  fontSize: 14,
                  color: active ? 'var(--cyan)' : 'var(--text-secondary)',
                  textDecoration: 'none',
                  background: active ? 'var(--cyan-dim)' : 'transparent',
                }}>
                  <Icon size={16} />
                  {link.label}
                </Link>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @media (max-width: 768px) {
          .hide-mobile { display: none !important; }
          .show-mobile { display: flex !important; }
        }
        @media (min-width: 769px) {
          .show-mobile { display: none !important; }
        }
      `}</style>
    </motion.header>
  )
}
