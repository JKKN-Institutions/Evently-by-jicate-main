'use client'

import { useEffect, useState } from 'react'

interface ClientTimeDisplayProps {
  className?: string
}

export default function ClientTimeDisplay({ className = "text-xs text-gray-500" }: ClientTimeDisplayProps) {
  const [currentTime, setCurrentTime] = useState<string>('')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString())
    }
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  // Prevent hydration mismatch by not rendering until client-side
  if (!mounted) {
    return <span className={className}>--:--:--</span>
  }

  return <span className={className}>{currentTime}</span>
}