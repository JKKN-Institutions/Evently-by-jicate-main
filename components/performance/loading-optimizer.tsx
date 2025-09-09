'use client'

import { useEffect, useState } from 'react'

interface LoadingOptimizerProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export default function LoadingOptimizer({ children, fallback }: LoadingOptimizerProps) {
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    // Preload critical resources
    const preloadCriticalResources = async () => {
      try {
        // Preload commonly used libraries
        const promises = [
          import('@/lib/utils'),
          import('lucide-react'),
        ]
        
        await Promise.all(promises)
        setIsLoaded(true)
      } catch (error) {
        console.error('Error preloading resources:', error)
        setIsLoaded(true) // Still show content even if preloading fails
      }
    }

    preloadCriticalResources()
  }, [])

  if (!isLoaded && fallback) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
