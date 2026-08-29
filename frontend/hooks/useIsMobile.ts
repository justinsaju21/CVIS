'use client'

import { useState, useEffect } from 'react'

/**
 * Returns true when the viewport width is below `breakpoint` (default 768px).
 * Updates on resize. Safe to use server-side (returns false until mounted).
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [breakpoint])

  return isMobile
}
