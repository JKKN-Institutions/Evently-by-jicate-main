'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { AuthState, UserProfile, getOrCreateProfile, signOutUser } from '@/lib/auth-helpers'

export function useAuthSimple(): AuthState & { signOut: () => Promise<void> } {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
    error: null
  })
  
  const supabase = createClient()
  
  useEffect(() => {
    let mounted = true
    let profileFetchInProgress = false
    
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('Session error:', error)
          if (mounted) {
            setState(prev => ({ ...prev, loading: false, error: error.message }))
          }
          return
        }
        
        if (session?.user && mounted) {
          await handleUser(session.user)
        } else if (mounted) {
          setState(prev => ({ ...prev, loading: false }))
        }
      } catch (error) {
        console.error('Initial session error:', error)
        if (mounted) {
          setState(prev => ({ ...prev, loading: false, error: 'Failed to load session' }))
        }
      }
    }
    
    // Handle user authentication
    const handleUser = async (user: User) => {
      if (!mounted || profileFetchInProgress) return
      
      profileFetchInProgress = true
      setState(prev => ({ ...prev, user, loading: true, error: null }))
      
      try {
        // Reduced timeout and better error handling
        const profilePromise = getOrCreateProfile(user)
        const timeoutPromise = new Promise<UserProfile>((resolve) => 
          setTimeout(() => {
            resolve({
              id: user.id,
              email: user.email!,
              full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User',
              role: user.email === 'sroja@jkkn.ac.in' ? 'admin' : 'user',
              avatar_url: user.user_metadata?.avatar_url || null
            })
          }, 5000) // Reduced to 5 second timeout
        )
        
        const profile = await Promise.race([profilePromise, timeoutPromise])
        
        if (mounted) {
          setState(prev => ({
            ...prev,
            profile,
            loading: false,
            error: null
          }))
        }
      } catch (error) {
        console.error('Profile error:', error)
        if (mounted) {
          // Even on error, provide a fallback profile so the app works
          setState(prev => ({
            ...prev,
            profile: {
              id: user.id,
              email: user.email!,
              full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User',
              role: user.email === 'sroja@jkkn.ac.in' ? 'admin' : 'user',
              avatar_url: user.user_metadata?.avatar_url || null
            },
            loading: false,
            error: null
          }))
        }
      } finally {
        profileFetchInProgress = false
      }
    }
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event)
        
        if (event === 'SIGNED_OUT' || !session?.user) {
          if (mounted) {
            setState({
              user: null,
              profile: null,
              loading: false,
              error: null
            })
          }
          return
        }
        
        if (session?.user && mounted) {
          await handleUser(session.user)
        }
      }
    )
    
    // Initialize
    getInitialSession()
    
    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase])
  
  return {
    ...state,
    signOut: signOutUser
  }
}
