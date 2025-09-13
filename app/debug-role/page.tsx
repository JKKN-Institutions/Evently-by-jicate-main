'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'

export default function DebugRolePage() {
  const [debugInfo, setDebugInfo] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const { user, profile } = useAuth()
  const supabase = createClient()

  useEffect(() => {
    async function fetchDebugInfo() {
      try {
        // Get auth user
        const { data: { user: authUser } } = await supabase.auth.getUser()
        
        // Get profile from database
        let dbProfile = null
        if (authUser) {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .single()
          
          dbProfile = data
          
          if (error) {
            console.error('Profile fetch error:', error)
          }
        }
        
        // Get session
        const { data: { session } } = await supabase.auth.getSession()
        
        // Check localStorage
        const localStorageKeys = Object.keys(localStorage).filter(key => 
          key.includes('role') || key.includes('auth') || key.includes('supabase')
        )
        
        const localStorageData: any = {}
        localStorageKeys.forEach(key => {
          try {
            const value = localStorage.getItem(key)
            if (value && value.length < 500) { // Only show small values
              localStorageData[key] = value
            } else if (value) {
              localStorageData[key] = `[Large value: ${value.length} chars]`
            }
          } catch (e) {
            localStorageData[key] = '[Error reading]'
          }
        })
        
        setDebugInfo({
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV,
          authUser: authUser ? {
            id: authUser.id,
            email: authUser.email,
            created_at: authUser.created_at
          } : null,
          contextUser: user ? {
            id: user.id,
            email: user.email
          } : null,
          contextProfile: profile,
          databaseProfile: dbProfile,
          session: session ? {
            expires_at: session.expires_at,
            user_email: session.user?.email
          } : null,
          localStorage: localStorageData,
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL
        })
      } catch (error) {
        console.error('Debug error:', error)
        setDebugInfo({ error: String(error) })
      } finally {
        setLoading(false)
      }
    }
    
    fetchDebugInfo()
  }, [user])

  const refreshRole = async () => {
    setLoading(true)
    
    // Clear all caches
    Object.keys(localStorage).forEach(key => {
      if (key.includes('role') || key.includes('auth') || key.includes('cache')) {
        localStorage.removeItem(key)
      }
    })
    
    // Reload page
    window.location.reload()
  }
  
  const forceUpdateRole = async (newRole: string) => {
    if (!user) return
    
    const { error } = await supabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', user.id)
    
    if (!error) {
      alert(`Role updated to ${newRole}. Refreshing...`)
      setTimeout(() => window.location.reload(), 1000)
    } else {
      alert(`Error: ${error.message}`)
    }
  }

  const fixProfile = async () => {
    try {
      const response = await fetch('/api/debug/fix-user-profile')
      const data = await response.json()
      
      if (response.ok) {
        alert(`Profile fixed: ${data.message}`)
        setTimeout(() => window.location.reload(), 1000)
      } else {
        alert(`Fix failed: ${data.error}`)
      }
    } catch (error) {
      alert(`Error: ${error}`)
    }
  }

  const recreateProfile = async (role: string) => {
    if (!confirm('This will delete and recreate your profile. Continue?')) return
    
    try {
      const response = await fetch('/api/debug/fix-user-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'force_create', role })
      })
      const data = await response.json()
      
      if (response.ok) {
        alert(`Profile recreated as ${role}. Refreshing...`)
        setTimeout(() => window.location.reload(), 1000)
      } else {
        alert(`Recreation failed: ${data.error}`)
      }
    } catch (error) {
      alert(`Error: ${error}`)
    }
  }

  if (loading) {
    return <div className="p-8">Loading debug information...</div>
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Role Debug Information</h1>
      
      <div className="space-y-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="font-bold text-lg mb-2">Quick Actions</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={refreshRole}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Clear Cache & Refresh
            </button>
            <button
              onClick={() => forceUpdateRole('admin')}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Force Set Admin
            </button>
            <button
              onClick={() => forceUpdateRole('user')}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Force Set User
            </button>
            <button
              onClick={fixProfile}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Fix Profile Issues
            </button>
            <button
              onClick={() => recreateProfile('admin')}
              className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
            >
              Recreate as Admin
            </button>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="font-bold text-lg mb-2">Current Role Status</h2>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Context Profile Role:</span>
              <span className={`px-2 py-1 rounded text-sm ${
                profile?.role === 'admin' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {profile?.role || 'NOT SET'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">Database Profile Role:</span>
              <span className={`px-2 py-1 rounded text-sm ${
                debugInfo.databaseProfile?.role === 'admin' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {debugInfo.databaseProfile?.role || 'NOT FOUND'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="font-bold text-lg mb-2">Full Debug Data</h2>
          <pre className="text-xs overflow-x-auto bg-gray-100 p-2 rounded">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}