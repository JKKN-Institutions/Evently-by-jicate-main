'use client'

import { useEffect } from 'react'

export default function PerformanceMonitor() {
  useEffect(() => {
    // Monitor page load performance
    if (typeof window !== 'undefined' && 'performance' in window) {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'navigation') {
            const navEntry = entry as PerformanceNavigationTiming
            console.log(`🚀 Page Load Performance:`, {
              'DOM Content Loaded': `${Math.round(navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart)}ms`,
              'Load Complete': `${Math.round(navEntry.loadEventEnd - navEntry.loadEventStart)}ms`,
              'Total Time': `${Math.round(navEntry.loadEventEnd - navEntry.fetchStart)}ms`
            })
          }
        }
      })
      
      observer.observe({ entryTypes: ['navigation'] })
      
      return () => observer.disconnect()
    }
  }, [])

  return null // This component doesn't render anything
}
