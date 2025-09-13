'use client'

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react'
import { createClient, resetClient } from '@/lib/supabase/client'
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
  const isDev = process.env.NODE_ENV === 'development'
  
  // Initialize state with simpler logic
  const [state, setState] = useState<AuthState>(() => {
    if (typeof window === 'undefined') {
      return { user: null, profile: null, loading: true, error: null }
    }
    
    // Check if we just came from OAuth callback
    const urlParams = new URLSearchParams(window.location.search)
    const fromAuthCallback = urlParams.get('auth_callback') === 'success'
    
    if (fromAuthCallback) {
      if (isDev) console.log('🔄 OAuth callback detected - starting fresh with no cache')
      // Clear any cached state to force fresh session check
      localStorage.removeItem('auth_state_cache')
      return { user: null, profile: null, loading: true, error: null }
    }
    
    // Try to get cached auth state for normal page loads
    const cachedAuth = localStorage.getItem('auth_state_cache')
    if (cachedAuth) {
      try {
        const parsed = JSON.parse(cachedAuth)
        if (isDev) console.log('📦 Restored auth state from cache:', parsed.profile?.email)
        return { ...parsed, loading: true } // Still verify session
      } catch (e) {
        if (isDev) console.log('Failed to parse cached auth state')
      }
    }
    
    return { user: null, profile: null, loading: true, error: null }
  })

  // Create a stable supabase client instance
  const supabase = useMemo(() => createClient(), [])
  
  // Simplified session check on mount
  React.useEffect(() => {
    if (isDev) console.log('🔥 Starting session check on AuthProvider mount')
    
    let mounted = true
    
    const checkSession = async () => {
      try {
        // Check if we're coming from auth callback
        const urlParams = new URLSearchParams(window.location.search)
        const fromAuthCallback = urlParams.get('auth_callback') === 'success'
        
        if (fromAuthCallback) {
          if (isDev) console.log('🔄 Coming from auth callback, checking session immediately...')
          // Clean up the URL parameter
          urlParams.delete('auth_callback')
          const newUrl = window.location.pathname + (urlParams.toString() ? `?${urlParams.toString()}` : '')
          window.history.replaceState({}, '', newUrl)
        }
        
        if (isDev) console.log('🔍 Getting session from Supabase...')
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          if (isDev) console.error('❌ Session error:', sessionError)
          setState({ user: null, profile: null, loading: false, error: sessionError.message })
          return
        }
        
        if (isDev) console.log('📍 Session result:', session ? `Found: ${session.user?.email}` : 'None')
        
        if (session?.user) {
          if (isDev) console.log('👤 User found, fetching profile...')
          
          // Fetch user profile - CRITICAL: Get fresh data
          console.log('🔍 Fetching profile for user:', session.user.id, session.user.email)
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()
          
          if (profileError && profileError.code !== 'PGRST116') {
            console.error('❌ Profile fetch error:', profileError)
          }
          
          if (profile) {
            // Always log in production for debugging
            console.log('✅ Profile found:', { 
              email: profile.email, 
              role: profile.role,
              id: profile.id,
              timestamp: new Date().toISOString()
            })
            const newState = { user: session.user, profile, loading: false, error: null }
            setState(newState)
            
            // Cache the auth state
            localStorage.setItem('auth_state_cache', JSON.stringify({
              user: session.user,
              profile,
              error: null
            }))
          } else {
            // Create profile if it doesn't exist
            if (isDev) console.log('📝 Creating new profile...')
            // Don't assign admin role automatically - let it be set manually in database
            const userRole = 'user'
            
            const { data: newProfile, error: createError } = await supabase
              .from('profiles')
              .insert({
                id: session.user.id,
                email: session.user.email!,
                full_name: session.user.user_metadata?.full_name || 
                         session.user.user_metadata?.name || 
                         session.user.email?.split('@')[0] || 'User',
                role: userRole,
                avatar_url: session.user.user_metadata?.avatar_url || null
              })
              .select()
              .single()
            
            if (newProfile && !createError) {
              // Always log for debugging
              console.log('✅ Profile created:', { 
                email: newProfile.email, 
                role: newProfile.role,
                reason: 'new_user_signup',
                timestamp: new Date().toISOString()
              })
              setState({ user: session.user, profile: newProfile, loading: false, error: null })
              
              // Cache the auth state
              localStorage.setItem('auth_state_cache', JSON.stringify({
                user: session.user,
                profile: newProfile,
                error: null
              }))
            } else {
              if (isDev) console.error('❌ Failed to create profile:', createError)
              setState({ user: session.user, profile: null, loading: false, error: null })
            }
          }
        } else {
          // No session found
          if (isDev) console.log('❌ No session found')
          setState({ user: null, profile: null, loading: false, error: null })
          localStorage.removeItem('auth_state_cache')
        }
        
      } catch (error) {
        if (isDev) console.error('❌ Session check error:', error)
        setState({ user: null, profile: null, loading: false, error: null })
        localStorage.removeItem('auth_state_cache')
      }
    }
    
    // Start the check
    checkSession()
    
    // Set a timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      if (mounted) {
        setState(prev => {
          if (prev.loading) {
            console.warn('⚠️ Auth check timeout - forcing loading to false')
            return { ...prev, loading: false }
          }
          return prev
        })
      }
    }, 15000) // 15 second timeout
    
    return () => {
      mounted = false
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
      if (isDev) console.log('🧹 Clearing stale auth key:', key)
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
      
      // Skip callback waiting - it's causing hangs
      const cameFromCallback = false
      
      // Get session from Supabase
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      
      if (isDev) console.log('📍 Session check:', session ? `Found for ${session.user?.email}` : 'None', sessionError ? `Error: ${sessionError.message}` : '')
      
      // If no session found but we came from callback, try to refresh
      if (!session && cameFromCallback) {
        if (isDev) console.log('🔄 No session found after callback, attempting refresh...')
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()
        
        if (refreshedSession) {
          if (isDev) console.log('✅ Session refreshed successfully:', refreshedSession.user?.email)
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
          if (isDev) console.log('❌ Session refresh failed:', refreshError)
        }
      }

      if (!session || !session.user) {
        // No session, user is not logged in
        if (isDev) console.log('❌ No session found, user not authenticated')
        setState({ user: null, profile: null, loading: false, error: null })
        return
      }

      if (isDev) console.log('✅ Session found for user:', session.user.email)

      // Check if we already have this profile cached and it matches
      if (state.profile && state.profile.id === session.user.id) {
        if (isDev) console.log('📦 Using cached profile for:', state.profile.email)
        setState(prev => ({ ...prev, user: session.user, loading: false }))
        return
      }

      // We have a user, fetch their profile
      if (isDev) console.log('🔍 Fetching profile for user:', session.user.id)
      const profile = await fetchProfile(session.user.id)
      
      // If no profile exists, create one
      if (!profile) {
        if (isDev) console.log('📝 No profile found, creating new profile...')
        // Don't automatically assign admin - let it be set in database manually
        const userRole = 'user'
        if (isDev) console.log('👑 User role determined:', userRole)
        
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
          if (isDev) console.log('✅ Profile created successfully:', newProfile)
          const newState = { user: session.user, profile: newProfile, loading: false, error: null }
          setState(newState)
          
          // Cache the auth state
          localStorage.setItem('auth_state_cache', JSON.stringify({
            user: session.user,
            profile: newProfile,
            error: null
          }))
        } else {
          if (isDev) console.error('❌ Failed to create profile:', createError)
          setState({ user: session.user, profile: null, loading: false, error: 'Failed to create profile' })
        }
      } else {
        if (isDev) console.log('✅ Existing profile found:', profile)
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
        if (isDev) console.log('🧹 Cleaned up callback parameter from URL')
      }
    } catch (error) {
      if (isDev) console.error('Auth initialization error:', error)
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
      if (isDev) console.log('🚪 Starting sign out process...')
      
      // Clear all localStorage items related to auth and Supabase
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.includes('supabase') || key.includes('auth') || key === 'lastAuthRedirect')) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(key => {
        if (isDev) console.log(`🧹 Removing localStorage key: ${key}`)
        localStorage.removeItem(key)
      })
      
      // Clear sessionStorage
      sessionStorage.clear()
      
      // Clear state immediately
      setState({ user: null, profile: null, loading: false, error: null })
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        if (isDev) console.error('⚠️ Supabase sign out error (continuing anyway):', error)
      }
      
      if (isDev) console.log('✅ Sign out successful, redirecting to auth page...')
      
      // Force redirect to the sign-in page
      window.location.href = '/auth/sign-in'
    } catch (error) {
      if (isDev) console.error('❌ Sign out error:', error)
      // Even on error, clear everything and redirect
      
      // Clear all auth-related localStorage
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && (key.includes('supabase') || key.includes('auth'))) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key))
      
      sessionStorage.clear()
      setState({ user: null, profile: null, loading: false, error: null })
      window.location.href = '/auth/sign-in'
    }
  }

  // Refresh profile
  const refreshProfile = async () => {
    if (state.user) {
      if (isDev) console.log('🔄 Refreshing profile for user:', state.user.email)
      
      // Always fetch fresh from database
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', state.user.id)
        .single()
      
      if (profile && !error) {
        if (isDev) console.log('✅ Profile refreshed:', profile)
        
        // Check if role changed
        const roleChanged = state.profile?.role !== profile.role
        
        setState(prev => ({ ...prev, profile }))
        
        // Update cache
        localStorage.setItem('auth_state_cache', JSON.stringify({
          user: state.user,
          profile,
          error: null
        }))
        
        // If role changed, reload to update UI
        if (roleChanged) {
          console.log('🔄 Role changed from', state.profile?.role, 'to', profile.role, '- reloading page')
          window.location.reload()
        }
      } else {
        if (isDev) console.log('❌ No profile found during refresh:', error)
      }
    }
  }

  // Initialize on mount
  useEffect(() => {
    let isMounted = true
    let initComplete = false
    
    if (isDev) {
      console.log('🔄 AuthProvider useEffect triggered - initializing auth')
      console.log('📊 Current state when useEffect runs:', state)
    }
    
    // Force immediate execution
    const runInit = async () => {
      if (!isMounted || initComplete) return
      initComplete = true
      
      console.log('🚀 Running initAuth...') // Always log
      try {
        await initAuth()
        console.log('✅ InitAuth completed')
      } catch (error) {
        console.error('❌ InitAuth failed:', error)
        setState(prev => ({ ...prev, loading: false, error: 'Init failed' }))
      }
    }
    
    runInit()
    
    // Note: Periodic refresh removed to avoid dependency issues
    // Role will be refreshed on auth state changes and manual refresh
    
    // Timeout to ensure loading doesn't get stuck
    const timeout = setTimeout(() => {
      if (!isMounted) return
      setState(prev => {
        if (prev.loading) {
          console.log('⏰ Loading timeout - forcing loading to false after 5 seconds')
          return { ...prev, loading: false, error: 'Authentication timeout' }
        }
        return prev
      })
    }, 5000) // 5 second timeout

    // Listen for auth changes
    if (isDev) console.log('👂 Setting up auth state change listener...')
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) {
        if (isDev) console.log('⚠️ Auth state change received but component unmounted')
        return
      }
      
      if (isDev) {
        console.log('🔄 Auth state changed:', event, 'Session:', session ? 'Present' : 'None')
        console.log('🔍 Current state before processing:', { 
          user: state.user?.email, 
          profile: state.profile?.email, 
          loading: state.loading 
        })
      }
      
      // Skip INITIAL_SESSION event as we handle this in initAuth
      if (event === 'INITIAL_SESSION') {
        if (isDev) console.log('⏭️ Skipping INITIAL_SESSION event (handled in initAuth)')
        return
      }
      
      if (event === 'SIGNED_OUT') {
        if (isDev) console.log('👋 User signed out')
        setState({ user: null, profile: null, loading: false, error: null })
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (session?.user) {
          if (isDev) console.log('👤 Processing auth event for user:', session.user.email)
          
          // Set loading to false immediately to prevent redirect loops
          setState(prev => ({ ...prev, user: session.user, loading: false }))
          
          // Fetch profile
          const profile = await fetchProfile(session.user.id)
          
          // If no profile exists, create one
          if (!profile) {
            if (isDev) console.log('📝 Creating profile for auth state change...')
            // Check if this email should be an admin
            const userRole = isAdminEmail(session.user.email) ? 'admin' : 'user'
            if (isDev) console.log('👑 Role for new profile:', userRole)
            
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
              if (isDev) console.log('✅ Profile created via auth state change:', newProfile)
              const newState = { user: session.user, profile: newProfile, loading: false, error: null }
              setState(newState)
              
              // Cache the auth state
              localStorage.setItem('auth_state_cache', JSON.stringify({
                user: session.user,
                profile: newProfile,
                error: null
              }))
            } else {
              if (isDev) console.error('❌ Failed to create profile via auth state change:', createError)
              setState({ user: session.user, profile: null, loading: false, error: 'Failed to create profile' })
            }
          } else {
            if (isDev) console.log('✅ Using existing profile from auth state change:', profile)
            const newState = { user: session.user, profile, loading: false, error: null }
            setState(newState)
            
            // Cache the auth state
            localStorage.setItem('auth_state_cache', JSON.stringify({
              user: session.user,
              profile,
              error: null
            }))
          }
          
          if (isDev) {
            console.log('🎯 Final state after processing:', { 
              user: session.user.email, 
              profile: profile?.email, 
              role: profile?.role,
              loading: false 
            })
          }
        } else {
          if (isDev) console.log('❌ Auth event without user session')
          setState({ user: null, profile: null, loading: false, error: null })
          
          // Clear cached auth state
          localStorage.removeItem('auth_state_cache')
        }
      }
    })

    return () => {
      isMounted = false
      if (isDev) console.log('🧹 Cleaning up AuthProvider useEffect')
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, []) // Empty dependency array to run only once on mount

  // Remove periodic refresh - it's causing infinite loops
  // Role will be refreshed on auth state changes and manual refresh only

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
          if (isDev) console.log('Profile changed via realtime:', payload)
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
      if (isDev) console.log('🐛 DEBUG: Added window.debugAuth() and window.refreshProfile() functions for manual testing')
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