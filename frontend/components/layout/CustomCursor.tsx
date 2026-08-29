'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

type CursorState = 'default' | 'link' | 'data' | 'control'

export function useCursor() {
  const [cursorState, setCursorState] = useState<CursorState>('default')
  return { cursorState, setCursorState }
}

export default function CustomCursor() {
  const dot   = useRef<HTMLDivElement>(null)
  const ring  = useRef<HTMLDivElement>(null)
  const pos   = useRef({ x: 0, y: 0 })
  const ring_pos = useRef({ x: 0, y: 0 })
  const [state, setState] = useState<CursorState>('default')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const move = (e: MouseEvent) => {
      pos.current = { x: e.clientX, y: e.clientY }
      setVisible(true)
      if (dot.current) {
        dot.current.style.transform = `translate(${e.clientX - 4}px, ${e.clientY - 4}px)`
      }
    }

    const lerp = () => {
      ring_pos.current.x += (pos.current.x - ring_pos.current.x) * 0.12
      ring_pos.current.y += (pos.current.y - ring_pos.current.y) * 0.12
      if (ring.current) {
        ring.current.style.transform =
          `translate(${ring_pos.current.x - 16}px, ${ring_pos.current.y - 16}px)`
      }
      requestAnimationFrame(lerp)
    }
    requestAnimationFrame(lerp)

    const over = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('a,button,[data-cursor="link"]')) setState('link')
      else if (target.closest('[data-cursor="data"]'))     setState('data')
      else if (target.closest('[data-cursor="control"]'))  setState('control')
      else setState('default')
    }

    window.addEventListener('mousemove', move, { passive: true })
    window.addEventListener('mouseover', over, { passive: true })
    return () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseover', over)
    }
  }, [])

  const ringColor = {
    default: 'rgba(255,255,255,0.4)',
    link:    'rgba(0,212,255,0.7)',
    data:    'rgba(255,179,71,0.7)',
    control: 'rgba(46,213,115,0.7)',
  }[state]

  if (!visible) return null

  return (
    <>
      {/* Inner dot */}
      <div ref={dot} style={{
        position: 'fixed',
        top: 0, left: 0,
        width: 8, height: 8,
        borderRadius: '50%',
        background: state === 'default' ? '#fff' : 'var(--cyan)',
        pointerEvents: 'none',
        zIndex: 99999,
        mixBlendMode: 'difference',
        transition: 'background 150ms',
        boxShadow: state !== 'default' ? '0 0 8px rgba(0,212,255,0.8)' : 'none',
      }} />
      {/* Trailing ring */}
      <div ref={ring} style={{
        position: 'fixed',
        top: 0, left: 0,
        width: 32, height: 32,
        borderRadius: '50%',
        border: `1.5px solid ${ringColor}`,
        pointerEvents: 'none',
        zIndex: 99998,
        mixBlendMode: 'difference',
        transition: 'border-color 150ms, width 200ms, height 200ms',
        ...(state === 'link' ? { width: 44, height: 44 } : {}),
      }} />
    </>
  )
}
