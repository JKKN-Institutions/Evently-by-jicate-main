'use client'

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { isAdminEmail } from '@/lib/config/admin-emails'

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
  const isDev = process.env.NODE_ENV === 'development'
  if (isDev) console.log('🚀 AuthProvider component mounted!')
  
  // Initialize state from localStorage if available (for persistence across navigations)
  const [state, setState] = useState<AuthState>(() => {
    if (typeof window === 'undefined') {
      return { user: null, profile: null, loading: true, error: null }
    }
    
    // Check if we should clear cache
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('clear_cache') === 'true') {
      if (isDev) console.log('🧹 Clearing auth cache as requested')
      localStorage.removeItem('auth_state_cache')
      // Remove the clear_cache param from URL
      urlParams.delete('clear_cache')
      const newUrl = window.location.pathname + (urlParams.toString() ? `?${urlParams.toString()}` : '')
      window.history.replaceState({}, '', newUrl)
      return { user: null, profile: null, loading: true, error: null }
    }
    
    // Try to get cached auth state
    const cachedAuth = localStorage.getItem('auth_state_cache')
    if (cachedAuth) {
      try {
        const parsed = JSON.parse(cachedAuth)
        if (isDev) console.log('📦 Restored auth state from cache:', parsed.profile?.email)
        return { ...parsed, loading: true } // Still set loading to true to verify session
      } catch (e) {
        if (isDev) console.log('Failed to parse cached auth state')
      }
    }
    
    return { user: null, profile: null, loading: true, error: null }
  })

  const supabase = useMemo(() => {
    console.log('🔧 Creating Supabase client in AuthProvider')
    return createClient()
  }, [])
  
  // Immediate session check on mount
  React.useEffect(() => {
    if (isDev) console.log('🔥 IMMEDIATE session check on AuthProvider mount')
    
    // Set a timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      console.warn('⚠️ Auth check timeout - setting loading to false')
      setState(prev => ({ ...prev, loading: false }))
    }, 5000) // 5 second timeout
    
    const immediateCheck = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('🔥 Session error:', sessionError)
          setState({ user: null, profile: null, loading: false, error: sessionError.message })
          clearTimeout(loadingTimeout)
          return
        }
        
        if (isDev) console.log('🔥 IMMEDIATE session result:', session ? `Found: ${session.user?.email}` : 'None')
        
        if (session?.user) {
          if (isDev) console.log('🔥 IMMEDIATE: Setting user immediately')
          
          // Always fetch fresh profile on mount to ensure we have the latest data
          const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
          
          if (profileError && profileError.code !== 'PGRST116') { // PGRST116 = no rows found
            console.error('🔥 IMMEDIATE: Profile fetch error:', profileError)
          }
          
          if (profile) {
            if (isDev) console.log('🔥 IMMEDIATE: Profile found:', profile)
            const newState = { user: session.user, profile, loading: false, error: null }
            setState(newState)
            
            // Cache the auth state
            localStorage.setItem('auth_state_cache', JSON.stringify({
              user: session.user,
              profile,
              error: null
            }))
          } else {
            // No profile, create one
            if (isDev) console.log('🔥 No profile found, creating one...')
            const userRole = isAdminEmail(session.user.email) ? 'admin' : 'user'
            
            const { data: newProfile, error: createError } = await supabase
              .from('profiles')
              .insert({
                id: session.user.id,
                email: session.user.email!,
                full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
                role: userRole,
                avatar_url: session.user.user_metadata?.avatar_url || null
              })
              .select()
              .single()
            
            if (newProfile && !createError) {
              console.log('🔥 IMMEDIATE: Profile created:', newProfile)
              setState({ user: session.user, profile: newProfile, loading: false, error: null })
              
              // Cache the auth state
              localStorage.setItem('auth_state_cache', JSON.stringify({
                user: session.user,
                profile: newProfile,
                error: null
              }))
            } else if (createError?.code === '23505') { // Duplicate key error
              // Profile might already exist, try fetching again
              const { data: existingProfile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
              if (existingProfile) {
                setState({ user: session.user, profile: existingProfile, loading: false, error: null })
              } else {
                setState({ user: session.user, profile: null, loading: false, error: null })
              }
            } else {
              console.error('🔥 IMMEDIATE: Failed to create profile:', createError)
              setState({ user: session.user, profile: null, loading: false, error: null })
            }
          }
        } else {
          // No session, clear loading and cache
          setState({ user: null, profile: null, loading: false, error: null })
          localStorage.removeItem('auth_state_cache')
        }
      } catch (error) {
        console.error('🔥 IMMEDIATE session check error:', error)
        setState({ user: null, profile: null, loading: false, error: null })
        localStorage.removeItem('auth_state_cache')
      } finally {
        clearTimeout(loadingTimeout)
      }
    }
    
    immediateCheck()
    
    // Cleanup
    return () => {
      clearTimeout(loadingTimeout)
    }
  }, [supabase, isDev])

  // Fetch profile for a user
  const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Profile fetch error:', error)
        return null
      }

      return profile
    } catch (error) {
      console.error('Profile fetch exception:', error)
      return null
    }
  }

  // Clear any stale auth data
  const clearStaleAuthData = () => {
    if (typeof window === 'undefined') return
    
    // Clear any old supabase auth tokens that might be causing issues
    const keysToRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('sb-') && key.includes('auth-token')) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => {
      console.log('🧹 Clearing stale auth key:', key)
      localStorage.removeItem(key)
    })
  }

  // Initialize auth
  const initAuth = async () => {
    try {
      // Only run on client
      if (typeof window === 'undefined') {
        setState(prev => ({ ...prev, loading: false }))
        return
      }

      if (isDev) {
        console.log('🔄 Initializing auth...')
        console.log('🌐 Current URL:', window.location.href)
      }
      
      // Clear any potentially stale auth data first
      clearStaleAuthData()
      
      // If we just came from the callback, wait a bit for session to be fully processed
      const cameFromCallback = document.referrer.includes('/auth/callback') || 
                              window.location.search.includes('from_callback')
      
      if (cameFromCallback) {
        console.log('🔄 Just came from OAuth callback, waiting for session sync...')
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
      
      // Get session from Supabase
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      console.log('📍 Session check:', session ? `Found for ${session.user?.email}` : 'None', sessionError ? `Error: ${sessionError.message}` : '')
      
      // If no session found but we came from callback, try to refresh
      if (!session && cameFromCallback) {
        console.log('🔄 No session found after callback, attempting refresh...')
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()
        
        if (refreshedSession) {
          console.log('✅ Session refreshed successfully:', refreshedSession.user?.email)
          // Process the refreshed session
          const profile = await fetchProfile(refreshedSession.user.id)
          setState({ 
            user: refreshedSession.user, 
            profile, 
            loading: false, 
            error: null 
          })
          
          // Clean up the callback parameter
          if (window.location.search.includes('from_callback')) {
            const url = new URL(window.location.href)
            url.searchParams.delete('from_callback')
            window.history.replaceState({}, '', url.toString())
          }
          
          return
        } else {
          console.log('❌ Session refresh failed:', refreshError)
        }
      }

      if (!session || !session.user) {
        // No session, user is not logged in
        console.log('❌ No session found, user not authenticated')
        setState({ user: null, profile: null, loading: false, error: null })
        return
      }

      console.log('✅ Session found for user:', session.user.email)

      // Check if we already have this profile cached and it matches
      if (state.profile && state.profile.id === session.user.id) {
        console.log('📦 Using cached profile for:', state.profile.email)
        setState(prev => ({ ...prev, user: session.user, loading: false }))
        return
      }

      // We have a user, fetch their profile
      console.log('🔍 Fetching profile for user:', session.user.id)
      const profile = await fetchProfile(session.user.id)
      
      // If no profile exists, create one
      if (!profile) {
        console.log('📝 No profile found, creating new profile...')
        // Check if this email should be an admin
        const userRole = isAdminEmail(session.user.email) ? 'admin' : 'user'
        console.log('👑 User role determined:', userRole)
        
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: session.user.id,
            email: session.user.email!,
            full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
            role: userRole,
            avatar_url: session.user.user_metadata?.avatar_url || null
          })
          .select()
          .single()

        if (!createError && newProfile) {
          console.log('✅ Profile created successfully:', newProfile)
          const newState = { user: session.user, profile: newProfile, loading: false, error: null }
          setState(newState)
          
          // Cache the auth state
          localStorage.setItem('auth_state_cache', JSON.stringify({
            user: session.user,
            profile: newProfile,
            error: null
          }))
        } else {
          console.error('❌ Failed to create profile:', createError)
          setState({ user: session.user, profile: null, loading: false, error: 'Failed to create profile' })
        }
      } else {
        console.log('✅ Existing profile found:', profile)
        const newState = { user: session.user, profile, loading: false, error: null }
        setState(newState)
        
        // Cache the auth state for persistence
        localStorage.setItem('auth_state_cache', JSON.stringify({
          user: session.user,
          profile,
          error: null
        }))
      }
      
      // Clean up the callback parameter if present
      if (window.location.search.includes('from_callback')) {
        const url = new URL(window.location.href)
        url.searchParams.delete('from_callback')
        window.history.replaceState({}, '', url.toString())
        console.log('🧹 Cleaned up callback parameter from URL')
      }
    } catch (error) {
      console.error('Auth initialization error:', error)
      setState({
        user: null,
        profile: null,
        loading: false,
        error: error instanceof Error ? error.message : 'Auth initialization failed'
      })
    }
  }

  // Sign out
  const signOut = async () => {
    try {
      await supabase.auth.signOut()
      setState({ user: null, profile: null, loading: false, error: null })
      
      // Clear cached auth state
      localStorage.removeItem('auth_state_cache')
      
      window.location.href = '/login'
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  // Refresh profile
  const refreshProfile = async () => {
    if (state.user) {
      console.log('🔄 Refreshing profile for user:', state.user.email)
      const profile = await fetchProfile(state.user.id)
      if (profile) {
        console.log('✅ Profile refreshed:', profile)
        setState(prev => ({ ...prev, profile }))
        
        // Update cache
        localStorage.setItem('auth_state_cache', JSON.stringify({
          user: state.user,
          profile,
          error: null
        }))
      } else {
        console.log('❌ No profile found during refresh')
      }
    }
  }

  // Initialize on mount
  useEffect(() => {
    console.log('🔄 AuthProvider useEffect triggered - initializing auth')
    console.log('📊 Current state when useEffect runs:', state)
    
    // Force immediate execution
    const runInit = async () => {
      console.log('🚀 Running initAuth...')
      await initAuth()
    }
    
    runInit()
    
    // Timeout to ensure loading doesn't get stuck
    const timeout = setTimeout(() => {
      setState(prev => {
        if (prev.loading) {
          console.log('⏰ Loading timeout - forcing loading to false')
          return { ...prev, loading: false }
        }
        return prev
      })
    }, 5000) // 5 second timeout

    // Listen for auth changes
    console.log('👂 Setting up auth state change listener...')
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state changed:', event, 'Session:', session ? 'Present' : 'None')
      console.log('🔍 Current state before processing:', { 
        user: state.user?.email, 
        profile: state.profile?.email, 
        loading: state.loading 
      })
      
      if (event === 'SIGNED_OUT') {
        console.log('👋 User signed out')
        setState({ user: null, profile: null, loading: false, error: null })
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION') {
        if (session?.user) {
          console.log('👤 Processing auth event for user:', session.user.email)
          
          // Set loading to false immediately to prevent redirect loops
          setState(prev => ({ ...prev, user: session.user, loading: false }))
          
          // Fetch profile
          const profile = await fetchProfile(session.user.id)
          
          // If no profile exists, create one
          if (!profile) {
            console.log('📝 Creating profile for auth state change...')
            // Check if this email should be an admin
            const userRole = isAdminEmail(session.user.email) ? 'admin' : 'user'
            console.log('👑 Role for new profile:', userRole)
            
            const { data: newProfile, error: createError } = await supabase
              .from('profiles')
              .insert({
                id: session.user.id,
                email: session.user.email!,
                full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
                role: userRole,
                avatar_url: session.user.user_metadata?.avatar_url || null
              })
              .select()
              .single()

            if (!createError && newProfile) {
              console.log('✅ Profile created via auth state change:', newProfile)
              const newState = { user: session.user, profile: newProfile, loading: false, error: null }
              setState(newState)
              
              // Cache the auth state
              localStorage.setItem('auth_state_cache', JSON.stringify({
                user: session.user,
                profile: newProfile,
                error: null
              }))
            } else {
              console.error('❌ Failed to create profile via auth state change:', createError)
              setState({ user: session.user, profile: null, loading: false, error: 'Failed to create profile' })
            }
          } else {
            console.log('✅ Using existing profile from auth state change:', profile)
            const newState = { user: session.user, profile, loading: false, error: null }
            setState(newState)
            
            // Cache the auth state
            localStorage.setItem('auth_state_cache', JSON.stringify({
              user: session.user,
              profile,
              error: null
            }))
          }
          
          console.log('🎯 Final state after processing:', { 
            user: session.user.email, 
            profile: profile?.email, 
            role: profile?.role,
            loading: false 
          })
        } else {
          console.log('❌ Auth event without user session')
          setState({ user: null, profile: null, loading: false, error: null })
          
          // Clear cached auth state
          localStorage.removeItem('auth_state_cache')
        }
      }
    })

    return () => {
      console.log('🧹 Cleaning up AuthProvider useEffect')
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, []) // Empty dependency array to run only once on mount

  // Set up realtime subscription for profile changes
  useEffect(() => {
    if (!state.user) return

    const channel = supabase
      .channel(`profile_${state.user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${state.user.id}`
        },
        (payload) => {
          console.log('Profile changed via realtime:', payload)
          if (payload.new && typeof payload.new === 'object' && 'role' in payload.new) {
            setState(prev => ({
              ...prev,
              profile: payload.new as UserProfile
            }))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [state.user, supabase])

  // Debug function to manually trigger session check
  const debugSessionCheck = async () => {
    console.log('🐛 DEBUG: Manual session check triggered')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      console.log('🐛 DEBUG: Session result:', session)
      
      if (session?.user) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
        console.log('🐛 DEBUG: Profile result:', profile)
        
        setState({
          user: session.user,
          profile: profile || null,
          loading: false,
          error: null
        })
        console.log('🐛 DEBUG: State updated with user and profile')
      }
    } catch (error) {
      console.error('🐛 DEBUG: Error in manual session check:', error)
    }
  }

  // Expose debug function globally for manual testing
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).debugAuth = debugSessionCheck;
      (window as any).refreshProfile = refreshProfile;
      console.log('🐛 DEBUG: Added window.debugAuth() and window.refreshProfile() functions for manual testing')
    }
  }, [refreshProfile])

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

// Safe version that doesn't throw
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

// Re-export types and helpers for compatibility
export type { UserProfile, AuthState }