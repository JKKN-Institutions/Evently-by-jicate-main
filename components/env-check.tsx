'use client'

import { useEffect, useState } from 'react'

export default function EnvCheck() {
  const [envStatus, setEnvStatus] = useState<{
    razorpayKey: boolean
    supabaseUrl: boolean
    supabaseAnonKey: boolean
  }>({
    razorpayKey: false,
    supabaseUrl: false,
    supabaseAnonKey: false
  })

  useEffect(() => {
    setEnvStatus({
      razorpayKey: !!process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      supabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    })
  }, [])

  if (process.env.NODE_ENV !== 'development') {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-lg p-4 text-xs max-w-xs">
      <h3 className="font-semibold mb-2">Environment Status</h3>
      <ul className="space-y-1">
        <li className={envStatus.razorpayKey ? 'text-green-600' : 'text-red-600'}>
          Razorpay Key: {envStatus.razorpayKey ? '✓ Set' : '✗ Missing'}
        </li>
        <li className={envStatus.supabaseUrl ? 'text-green-600' : 'text-red-600'}>
          Supabase URL: {envStatus.supabaseUrl ? '✓ Set' : '✗ Missing'}
        </li>
        <li className={envStatus.supabaseAnonKey ? 'text-green-600' : 'text-red-600'}>
          Supabase Anon Key: {envStatus.supabaseAnonKey ? '✓ Set' : '✗ Missing'}
        </li>
      </ul>
      <p className="mt-2 text-gray-500">
        Make sure all environment variables are set in .env.local
      </p>
    </div>
  )
}
