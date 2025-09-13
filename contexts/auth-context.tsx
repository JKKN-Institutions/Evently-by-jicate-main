'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'

interface UserProfile {
  id: string
  email: string
  full_name: string | null
  role: 'user' | 'organizer' | 'admin'
  avatar_url: string | null
}

interface AuthState {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  error: string | null
}

interface AuthContextType extends AuthState {
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
    error: null
  })

  const supabase = createClient()

  // Fetch user profile from database
  const fetchUserProfile = useCallback(async (userId: string) => {
    try {
      console.log('🔍 Fetching profile for user ID:', userId)
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('❌ Profile fetch error:', error)
        return null
      }

      console.log('✅ Profile fetched:', { email: profile.email, role: profile.role })
      return profile
    } catch (error) {
      console.error('❌ Profile fetch exception:', error)
      return null
    }
  }, [supabase])

  // Initialize authentication
  useEffect(() => {
    console.log('🚀 AuthProvider initializing...')
    
    const initAuth = async () => {
      try {
        // Get current session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('❌ Session error:', sessionError)
          setState({ user: null, profile: null, loading: false, error: sessionError.message })
          return
        }

        if (session?.user) {
          console.log('👤 User session found:', session.user.email)
          
          // Fetch user profile
          const profile = await fetchUserProfile(session.user.id)
          
          if (!profile) {
            console.warn('Profile not found for user, waiting for DB trigger to create it.')
            setState({ user: session.user, profile: null, loading: false, error: 'Profile not found' })
          } else {
            setState({ user: session.user, profile, loading: false, error: null })
          }
        } else {
          console.log('❌ No session found')
          setState({ user: null, profile: null, loading: false, error: null })
        }
      } catch (error) {
        console.error('❌ Auth initialization error:', error)
        setState({ user: null, profile: null, loading: false, error: 'Authentication failed' })
      }
    }

    initAuth()

    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state changed:', event)
      
      if (event === 'SIGNED_OUT') {
        setState({ user: null, profile: null, loading: false, error: null })
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          const profile = await fetchUserProfile(session.user.id)
          setState({ user: session.user, profile, loading: false, error: null })
        }
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, fetchUserProfile])

  // Sign out function
  const signOut = async () => {
    try {
      console.log('🚪 Signing out...')
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('❌ Sign out error:', error)
      }
      setState({ user: null, profile: null, loading: false, error: null })
      window.location.href = '/auth/sign-in'
    } catch (error) {
      console.error('❌ Sign out exception:', error)
    }
  }

  // Refresh profile function
  const refreshProfile = async () => {
    if (state.user) {
      console.log('🔄 Refreshing profile...')
      const profile = await fetchUserProfile(state.user.id)
      setState(prev => ({ ...prev, profile }))
    }
  }

  return (
    <AuthContext.Provider value={{
      ...state,
      signOut,
      refreshProfile
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function useAuthSafe() {
  const context = useContext(AuthContext)
  return context || {
    user: null,
    profile: null,
    loading: true,
    error: null,
    signOut: async () => {},
    refreshProfile: async () => {}
  }
}

export type { UserProfile, AuthState }