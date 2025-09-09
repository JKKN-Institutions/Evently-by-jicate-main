'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'

interface Profile {
  id: string
  email: string
  full_name: string | null
  role: 'user' | 'organizer' | 'admin'
  avatar_url: string | null
}

interface AuthContextType {
  user: User | null
  profile: Profile | null
  loading: boolean
  error: string | null
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  error: null
})

export function ClientAuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthContextType>({
    user: null,
    profile: null,
    loading: true,
    error: null
  })

  useEffect(() => {
    // Only run on client
    if (typeof window === 'undefined') return

    const initAuth = async () => {
      try {
        console.log('ClientAuth - Initializing...')
        const supabase = createClient()
        
        // Get user directly
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        console.log('ClientAuth - User:', user)
        
        if (userError) {
          console.error('ClientAuth - User error:', userError)
          setState({ user: null, profile: null, loading: false, error: userError.message })
          return
        }
        
        if (!user) {
          console.log('ClientAuth - No user found')
          setState({ user: null, profile: null, loading: false, error: null })
          return
        }
        
        // Fetch profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()
        
        console.log('ClientAuth - Profile:', profile)
        console.log('ClientAuth - Profile error:', profileError)
        
        setState({
          user,
          profile: profile || null,
          loading: false,
          error: profileError?.message || null
        })
      } catch (error) {
        console.error('ClientAuth - Error:', error)
        setState({
          user: null,
          profile: null,
          loading: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
    
    initAuth()
    
    // Listen for auth changes
    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('ClientAuth - Auth state changed:', event)
      if (event === 'SIGNED_OUT') {
        setState({ user: null, profile: null, loading: false, error: null })
      } else if (session?.user) {
        // Re-initialize on auth change
        initAuth()
      }
    })
    
    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={state}>
      {children}
    </AuthContext.Provider>
  )
}

export function useClientAuth() {
  return useContext(AuthContext)
}