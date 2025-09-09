'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User, RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

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
  const router = useRouter()

  const fetchUserProfile = useCallback(async (userId: string) => {
    try {
      console.log('Fetching profile for user:', userId)
      
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        console.error('Error fetching profile:', error)
        return
      }

      if (profile?.role) {
        const newRole = profile.role as 'user' | 'organizer' | 'admin'
        console.log('Setting user role to:', newRole)
        setRole(newRole)
        
        // Store role in localStorage for persistence
        localStorage.setItem(`user_role_${userId}`, newRole)
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
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
      
      // Force router refresh
      router.refresh()
    }
  }, [user, fetchUserProfile, router])

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
            
            // Force router refresh to update UI
            router.refresh()
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
  }, [user, supabase, router])

  useEffect(() => {
    let mounted = true

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      
      if (session?.user) {
        setUser(session.user)
        
        // Try to get role from localStorage first for faster load
        const cachedRole = localStorage.getItem(`user_role_${session.user.id}`)
        if (cachedRole && ['user', 'organizer', 'admin'].includes(cachedRole)) {
          setRole(cachedRole as 'user' | 'organizer' | 'admin')
        }
        
        // Then fetch fresh data
        fetchUserProfile(session.user.id)
      }
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return
      
      console.log('Auth state changed:', _event)
      
      if (session?.user) {
        setUser(session.user)
        
        // Try cached role first
        const cachedRole = localStorage.getItem(`user_role_${session.user.id}`)
        if (cachedRole && ['user', 'organizer', 'admin'].includes(cachedRole)) {
          setRole(cachedRole as 'user' | 'organizer' | 'admin')
        }
        
        // Fetch fresh profile
        await fetchUserProfile(session.user.id)
      } else {
        setUser(null)
        setRole('user')
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