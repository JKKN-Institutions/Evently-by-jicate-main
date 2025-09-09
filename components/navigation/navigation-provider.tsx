'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

export default function NavigationProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const previousPathname = useRef(pathname)
  const isInitialMount = useRef(true)

  useEffect(() => {
    // Skip on initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false
      return
    }

    // Only scroll if pathname actually changed
    if (previousPathname.current !== pathname) {
      previousPathname.current = pathname
      // Use requestAnimationFrame to ensure smooth scroll
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      })
    }
  }, [pathname])

  // Set up navigation state once
  useEffect(() => {
    // Clean up any stale history state
    if (window.history.state && !window.history.state.__NA) {
      // This is an old history entry, update it
      const newState = {
        ...window.history.state,
        __NA: true,
        __PRIVATE_NEXTJS_INTERNALS_TREE: window.history.state.__PRIVATE_NEXTJS_INTERNALS_TREE || []
      }
      window.history.replaceState(newState, '', window.location.href)
    }
  }, [])

  return <>{children}</>
}