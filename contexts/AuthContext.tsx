'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User, RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

interface AuthContextType {
  user: User | null
  role: 'user' | 'organizer' | 'admin'
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  forceRefresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: 'user',
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
  forceRefresh: async () => {}
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [role, setRole] = useState<'user' | 'organizer' | 'admin'>('user')
  const [loading, setLoading] = useState(true)
  const [profileSubscription, setProfileSubscription] = useState<RealtimeChannel | null>(null)
  const supabase = createClient()

  const fetchUserProfile = useCallback(async (userId: string) => {
    try {
      console.log('Fetching profile for user:', userId)
      
      // ALWAYS fetch fresh role from profiles table - this is the source of truth
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        console.error('Error fetching profile:', error)
        // If profile doesn't exist, create one with default role
        const { error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            email: (await supabase.auth.getUser()).data.user?.email || '',
            role: 'user'
          })
        
        if (!insertError) {
          setRole('user')
          localStorage.setItem(`user_role_${userId}`, 'user')
        }
        return
      }

      if (profile?.role) {
        const newRole = profile.role as 'user' | 'organizer' | 'admin'
        console.log('Setting user role from profile to:', newRole)
        setRole(newRole)
        
        // Store role in localStorage for persistence
        localStorage.setItem(`user_role_${userId}`, newRole)
      } else {
        // Default to user if no role found
        console.log('No role found in profile, defaulting to user')
        setRole('user')
        localStorage.setItem(`user_role_${userId}`, 'user')
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
      // Default to user role on error
      setRole('user')
    }
  }, [supabase])

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchUserProfile(user.id)
    }
  }, [user, fetchUserProfile])

  // Force refresh - clears cache and refetches
  const forceRefresh = useCallback(async () => {
    if (user) {
      // Clear localStorage cache
      localStorage.removeItem(`user_role_${user.id}`)
      
      // Refetch profile
      await fetchUserProfile(user.id)
      
      // Force page reload to ensure all components get updated
      window.location.reload()
    }
  }, [user, fetchUserProfile])

  const signOut = useCallback(async () => {
    // Clean up subscription
    if (profileSubscription) {
      await supabase.removeChannel(profileSubscription)
    }
    
    await supabase.auth.signOut()
    setUser(null)
    setRole('user')
    
    // Clear all role cache
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('user_role_')) {
        localStorage.removeItem(key)
      }
    })
  }, [supabase, profileSubscription])

  // Set up real-time subscription for profile changes
  useEffect(() => {
    if (!user) return

    console.log('Setting up real-time subscription for user:', user.id)

    // Subscribe to profile changes
    const channel = supabase
      .channel(`profile_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`
        },
        async (payload) => {
          console.log('Profile changed:', payload)
          
          if (payload.new && typeof payload.new === 'object' && 'role' in payload.new) {
            const newRole = payload.new.role as 'user' | 'organizer' | 'admin'
            console.log('Role updated via real-time to:', newRole)
            setRole(newRole)
            
            // Store in localStorage
            localStorage.setItem(`user_role_${user.id}`, newRole)
            
            // Optionally reload the page to ensure all components reflect the change
            // window.location.reload()
          }
        }
      )
      .subscribe()

    setProfileSubscription(channel)

    return () => {
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [user, supabase])

  useEffect(() => {
    let mounted = true

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      
      if (session?.user) {
        setUser(session.user)
        
        // ALWAYS fetch fresh role from database on initial load
        // This ensures we always have the correct role
        fetchUserProfile(session.user.id).then(() => {
          if (mounted) setLoading(false)
        })
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return
      
      console.log('Auth state changed:', _event)
      
      if (session?.user) {
        setUser(session.user)
        
        // ALWAYS fetch fresh profile on auth state change
        // Don't use cached role for login events
        if (_event === 'SIGNED_IN' || _event === 'TOKEN_REFRESHED' || _event === 'USER_UPDATED') {
          // Clear any stale cache on sign in
          localStorage.removeItem(`user_role_${session.user.id}`)
        }
        
        // Always fetch fresh profile data
        await fetchUserProfile(session.user.id)
      } else {
        setUser(null)
        setRole('user')
        // Clear role cache on sign out
        if (_event === 'SIGNED_OUT') {
          Object.keys(localStorage).forEach(key => {
            if (key.startsWith('user_role_')) {
              localStorage.removeItem(key)
            }
          })
        }
      }
      setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase, fetchUserProfile])

  // Periodically check for role updates (fallback for real-time)
  useEffect(() => {
    if (!user) return

    const interval = setInterval(() => {
      fetchUserProfile(user.id)
    }, 30000) // Check every 30 seconds

    return () => clearInterval(interval)
  }, [user, fetchUserProfile])

  return (
    <AuthContext.Provider value={{ 
      user, 
      role, 
      loading, 
      signOut, 
      refreshProfile,
      forceRefresh 
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)