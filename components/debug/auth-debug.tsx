'use client'

import { useAuthSimple } from '@/hooks/use-auth-simple'
import { useEffect, useState } from 'react'

export default function AuthDebug() {
  const { user, profile, loading, error } = useAuthSimple()
  const [debugInfo, setDebugInfo] = useState<string[]>([])
  const [currentTime, setCurrentTime] = useState<string>('')

  // Update current time only on client side
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString())
    }
    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const info = [
      `Loading: ${loading}`,
      `User: ${user ? `${user.email} (${user.id})` : 'null'}`,
      `Profile: ${profile ? `${profile.email} - ${profile.role}` : 'null'}`,
      `Error: ${error || 'none'}`,
      `Timestamp: ${currentTime}`
    ]
    setDebugInfo(info)
  }, [user, profile, loading, error, currentTime])

  return (
    <div className="fixed top-4 right-4 bg-black text-white p-4 rounded-lg text-xs font-mono z-50 max-w-md">
      <h3 className="font-bold mb-2">Auth Debug Info</h3>
      {debugInfo.map((info, index) => (
        <div key={index}>{info}</div>
      ))}
    </div>
  )
}
