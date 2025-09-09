'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'

interface UserProfile {
  id: string
  email: string | null
  role: string
  first_name: string | null
  last_name: string | null
  created_at: string
  updated_at: string
}

export function UserDebugInfo() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // Get current session
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          setError(`Session Error: ${sessionError.message}`)
          setLoading(false)
          return
        }

        setSession(currentSession)

        // Get current user
        const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser()
        
        if (userError) {
          setError(`User Error: ${userError.message}`)
          setLoading(false)
          return
        }

        setUser(currentUser)

        // Get user profile from database
        if (currentUser) {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single()

          if (profileError) {
            setError(`Profile Error: ${profileError.message}`)
          } else {
            setProfile(profileData)
          }
        }

        setLoading(false)
      } catch (err) {
        setError(`Unexpected error: ${err}`)
        setLoading(false)
      }
    }

    fetchUserData()

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) {
        setUser(session.user)
        fetchUserData()
      } else {
        setUser(null)
        setProfile(null)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  if (loading) {
    return (
      <div className="fixed bottom-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-md">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-sm">Loading user data...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-md z-50">
      <div className="mb-2 pb-2 border-b border-gray-200">
        <h3 className="font-semibold text-sm text-gray-900">🔍 User Debug Info</h3>
      </div>
      
      <div className="space-y-2 text-xs">
        {/* Authentication Status */}
        <div className="flex items-start gap-2">
          <span className="font-semibold text-gray-600">Status:</span>
          <span className={user ? 'text-green-600' : 'text-red-600'}>
            {user ? '✅ Authenticated' : '❌ Not Authenticated'}
          </span>
        </div>

        {/* Session Info */}
        <div className="flex items-start gap-2">
          <span className="font-semibold text-gray-600">Session:</span>
          <span className={session ? 'text-green-600' : 'text-orange-600'}>
            {session ? '✅ Active' : '⚠️ No Session'}
          </span>
        </div>

        {/* User Email */}
        <div className="flex items-start gap-2">
          <span className="font-semibold text-gray-600">Email:</span>
          <span className="text-gray-800 break-all">
            {user?.email || 'No email'}
          </span>
        </div>

        {/* User ID */}
        <div className="flex items-start gap-2">
          <span className="font-semibold text-gray-600">User ID:</span>
          <span className="text-gray-800 text-[10px] font-mono break-all">
            {user?.id || 'No ID'}
          </span>
        </div>

        {/* Profile Role */}
        <div className="flex items-start gap-2">
          <span className="font-semibold text-gray-600">Role:</span>
          <span className={`font-bold ${profile?.role ? 'text-blue-600' : 'text-red-600'}`}>
            {profile?.role || '❌ No Role Found'}
          </span>
        </div>

        {/* Profile Name */}
        {profile && (
          <div className="flex items-start gap-2">
            <span className="font-semibold text-gray-600">Name:</span>
            <span className="text-gray-800">
              {profile.first_name || profile.last_name 
                ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
                : 'No name set'}
            </span>
          </div>
        )}

        {/* Profile Created */}
        {profile && (
          <div className="flex items-start gap-2">
            <span className="font-semibold text-gray-600">Profile Created:</span>
            <span className="text-gray-800">
              {new Date(profile.created_at).toLocaleString()}
            </span>
          </div>
        )}

        {/* Auth Provider */}
        <div className="flex items-start gap-2">
          <span className="font-semibold text-gray-600">Provider:</span>
          <span className="text-gray-800">
            {user?.app_metadata?.provider || 'Unknown'}
          </span>
        </div>

        {/* Last Sign In */}
        <div className="flex items-start gap-2">
          <span className="font-semibold text-gray-600">Last Sign In:</span>
          <span className="text-gray-800">
            {user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : 'Never'}
          </span>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-2 pt-2 border-t border-red-200">
            <span className="text-red-600 text-xs">⚠️ {error}</span>
          </div>
        )}

        {/* Profile Missing Alert */}
        {user && !profile && (
          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
            <span className="text-yellow-800 text-xs">
              ⚠️ User profile not found in database. This may cause role-based issues.
            </span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="mt-3 pt-3 border-t border-gray-200 flex gap-2">
        <button
          onClick={() => window.location.reload()}
          className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Refresh
        </button>
        <button
          onClick={async () => {
            const { error } = await supabase.auth.signOut()
            if (error) alert(`Sign out error: ${error.message}`)
            else window.location.href = '/'
          }}
          className="text-xs px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}