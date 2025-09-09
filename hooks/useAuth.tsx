import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { UserProfile, fetchUserProfile } from '@/lib/auth-helpers'

export interface AuthState {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  role: 'user' | 'organizer' | 'admin'
}

export function useAuth() {
  const router = useRouter()
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
    role: 'user'
  })

  useEffect(() => {
    const supabase = createClient()
    let mounted = true

    const initAuth = async () => {
      try {
        // Get initial session
        const { data: { session } } = await supabase.auth.getSession()
        
        if (session?.user && mounted) {
          // Fetch profile with a timeout
          const profilePromise = fetchUserProfile(session.user.id, session.user.email!)
          const timeoutPromise = new Promise<UserProfile>((resolve) => 
            setTimeout(() => resolve({
              id: session.user.id,
              email: session.user.email!,
              full_name: session.user.email!.split('@')[0],
              role: 'user'
            }), 3000)
          )
          
          const profile = await Promise.race([profilePromise, timeoutPromise])
          
          if (mounted) {
            setAuthState({
              user: session.user,
              profile: profile || null,
              loading: false,
              role: profile?.role || 'user'
            })
          }
        } else if (mounted) {
          setAuthState({
            user: null,
            profile: null,
            loading: false,
            role: 'user'
          })
        }
      } catch (error) {
        console.error('Auth initialization error:', error)
        if (mounted) {
          setAuthState({
            user: null,
            profile: null,
            loading: false,
            role: 'user'
          })
        }
      }
    }

    initAuth()

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return
      
      if (event === 'SIGNED_IN' && session?.user) {
        const profile = await fetchUserProfile(session.user.id, session.user.email!)
        setAuthState({
          user: session.user,
          profile: profile || null,
          loading: false,
          role: profile?.role || 'user'
        })
      } else if (event === 'SIGNED_OUT') {
        setAuthState({
          user: null,
          profile: null,
          loading: false,
          role: 'user'
        })
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return {
    ...authState,
    signOut,
    isAuthenticated: !!authState.user,
    isAdmin: authState.role === 'admin',
    isOrganizer: authState.role === 'organizer' || authState.role === 'admin'
  }
}