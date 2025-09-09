'use client'

import { useEffect, useState } from 'react'

export default function EnvChecker() {
  const [envStatus, setEnvStatus] = useState<{
    supabaseUrl: boolean
    supabaseAnonKey: boolean
    appUrl: boolean
  }>({
    supabaseUrl: false,
    supabaseAnonKey: false,
    appUrl: false
  })

  useEffect(() => {
    setEnvStatus({
      supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      appUrl: !!process.env.NEXT_PUBLIC_APP_URL
    })
  }, [])

  const allGood = Object.values(envStatus).every(Boolean)

  if (allGood) return null

  return (
    <div className="fixed bottom-4 left-4 bg-red-900 text-white p-4 rounded-lg text-xs font-mono z-50 max-w-sm">
      <h3 className="font-bold mb-2 text-red-200">⚠️ Environment Variables Missing</h3>
      <div className="space-y-1">
        <div className={envStatus.supabaseUrl ? 'text-green-300' : 'text-red-300'}>
          NEXT_PUBLIC_SUPABASE_URL: {envStatus.supabaseUrl ? '✅' : '❌'}
        </div>
        <div className={envStatus.supabaseAnonKey ? 'text-green-300' : 'text-red-300'}>
          NEXT_PUBLIC_SUPABASE_ANON_KEY: {envStatus.supabaseAnonKey ? '✅' : '❌'}
        </div>
        <div className={envStatus.appUrl ? 'text-green-300' : 'text-yellow-300'}>
          NEXT_PUBLIC_APP_URL: {envStatus.appUrl ? '✅' : '⚠️ (optional)'}
        </div>
      </div>
      <p className="text-red-200 text-xs mt-2">
        Check your .env.local file and restart the server
      </p>
    </div>
  )
}