'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export default function DebugAuthPage() {
  const [user, setUser] = useState<any>(null)
  const [session, setSession] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Get current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        console.log('Session:', session)
        console.log('Session Error:', sessionError)
        
        setSession(session)
        
        if (session?.user) {
          setUser(session.user)
          
          // Get profile
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()
            
          console.log('Profile:', profile)
          console.log('Profile Error:', profileError)
          
          setProfile(profile)
        }
      } catch (err) {
        console.error('Auth check error:', err)
        setError(String(err))
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  const handleGoogleSignIn = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirectTo=/debug-auth`
        }
      })
      
      if (error) {
        setError(error.message)
      }
    } catch (err) {
      setError(String(err))
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setProfile(null)
  }

  if (loading) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Authentication Debug Page</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong>Error:</strong> {error}
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Session Info */}
        <div className="bg-gray-100 p-4 rounded">
          <h2 className="font-bold mb-2">Session</h2>
          <pre className="text-xs overflow-auto">
            {JSON.stringify(session, null, 2)}
          </pre>
        </div>
        
        {/* User Info */}
        <div className="bg-blue-100 p-4 rounded">
          <h2 className="font-bold mb-2">User</h2>
          <pre className="text-xs overflow-auto">
            {JSON.stringify(user, null, 2)}
          </pre>
        </div>
        
        {/* Profile Info */}
        <div className="bg-green-100 p-4 rounded">
          <h2 className="font-bold mb-2">Profile</h2>
          <pre className="text-xs overflow-auto">
            {JSON.stringify(profile, null, 2)}
          </pre>
        </div>
      </div>
      
      <div className="mt-6 space-x-4">
        {!user ? (
          <button
            onClick={handleGoogleSignIn}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            Sign In with Google
          </button>
        ) : (
          <button
            onClick={handleSignOut}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Sign Out
          </button>
        )}
      </div>
      
      {/* Environment Check */}
      <div className="mt-6 bg-yellow-100 p-4 rounded">
        <h2 className="font-bold mb-2">Environment</h2>
        <p><strong>Origin:</strong> {typeof window !== 'undefined' ? window.location.origin : 'N/A'}</p>
        <p><strong>Supabase URL:</strong> {process.env.NEXT_PUBLIC_SUPABASE_URL}</p>
        <p><strong>Has Anon Key:</strong> {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Yes' : 'No'}</p>
      </div>
    </div>
  )
}
