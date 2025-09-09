'use client'

import { useAuth } from '@/contexts/auth-context'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function TestAuthPage() {
  const { user, profile, loading, error } = useAuth()
  const [session, setSession] = useState<any>(null)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [directProfile, setDirectProfile] = useState<any>(null)
  const [directError, setDirectError] = useState<string | null>(null)
  const supabase = createClient()
  
  useEffect(() => {
    async function fetchDirectly() {
      // First check session
      const { data: { session }, error: sessionErr } = await supabase.auth.getSession()
      
      if (sessionErr) {
        setSessionError(sessionErr.message)
        console.error('Session error:', sessionErr)
      } else {
        setSession(session)
        console.log('Session retrieved:', session)
      }
      
      // Then try to get user
      const { data: { user }, error: userErr } = await supabase.auth.getUser()
      
      if (userErr) {
        setDirectError(userErr.message)
        console.error('User fetch error:', userErr)
      } else if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        
        if (error) {
          setDirectError(error.message)
        } else {
          setDirectProfile(data)
        }
      }
    }
    
    fetchDirectly()
    
    // Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state changed in test page:', _event, session)
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])
  
  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirectTo=/test-auth`
        }
      })
      if (error) {
        console.error('Sign in error:', error)
        setDirectError(error.message)
      }
    } catch (err: any) {
      console.error('Sign in exception:', err)
      setDirectError(err.message)
    }
  }

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Sign out error:', error)
        setDirectError(error.message)
      }
      window.location.reload()
    } catch (err: any) {
      console.error('Sign out exception:', err)
      setDirectError(err.message)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Auth Debug Page</h1>
      
      <div className="space-y-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="font-semibold mb-2">Session Status:</h2>
          {sessionError && (
            <div className="text-red-600 mb-2">Session Error: {sessionError}</div>
          )}
          <pre className="text-xs overflow-auto bg-gray-50 p-2 rounded">
            {session ? JSON.stringify({
              user_id: session.user?.id,
              email: session.user?.email,
              expires_at: session.expires_at,
              token_type: session.token_type
            }, null, 2) : 'No active session'}
          </pre>
          <div className="mt-4 flex gap-2">
            {!session ? (
              <button
                onClick={signInWithGoogle}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Sign In with Google
              </button>
            ) : (
              <button
                onClick={signOut}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Sign Out
              </button>
            )}
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="font-semibold mb-2">Auth Context State:</h2>
          <pre className="text-xs overflow-auto bg-gray-50 p-2 rounded">
            {JSON.stringify({ 
              loading, 
              error,
              user: user ? { id: user.id, email: user.email } : null,
              profile 
            }, null, 2)}
          </pre>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="font-semibold mb-2">Direct Supabase Fetch:</h2>
          {directError && (
            <div className="text-red-600 mb-2">Error: {directError}</div>
          )}
          <pre className="text-xs overflow-auto bg-gray-50 p-2 rounded">
            {JSON.stringify(directProfile, null, 2)}
          </pre>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="font-semibold mb-2">Role Check:</h2>
          <div className="space-y-1">
            <p>Context Profile Role: <strong>{profile?.role || 'NOT SET'}</strong></p>
            <p>Direct Fetch Role: <strong>{directProfile?.role || 'NOT SET'}</strong></p>
            <p className={profile?.role === 'admin' ? 'text-green-600' : 'text-red-600'}>
              Is Admin (Context): {profile?.role === 'admin' ? 'YES ✅' : 'NO ❌'}
            </p>
            <p className={directProfile?.role === 'admin' ? 'text-green-600' : 'text-red-600'}>
              Is Admin (Direct): {directProfile?.role === 'admin' ? 'YES ✅' : 'NO ❌'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}