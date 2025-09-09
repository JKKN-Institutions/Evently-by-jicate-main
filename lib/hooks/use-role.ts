'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { UserRole, RoleBasedPermissions, UserEventStats } from '@/types'
import { User } from '@supabase/supabase-js'

export function useUserRole(user?: User | null) {
  const [role, setRole] = useState<UserRole>('user')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setRole('user')
      setLoading(false)
      return
    }

    const fetchUserRole = async () => {
      try {
        setLoading(true)
        setError(null)
        const supabase = createClient()
        
        // First try to get from profiles table directly
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profileError) {
          console.warn('Profile not found, defaulting to user role:', profileError)
          setRole('user')
        } else {
          setRole(profile?.role || 'user')
        }
      } catch (err) {
        console.error('Error fetching user role:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch user role')
        setRole('user') // Default to user role on error
      } finally {
        setLoading(false)
      }
    }

    fetchUserRole()
  }, [user?.id]) // Only depend on user.id to prevent unnecessary re-renders

  return { role, loading, error }
}

export function useRolePermissions(role: UserRole): RoleBasedPermissions {
  return {
    canCreateEvents: role === 'organizer' || role === 'admin',
    canManageAllEvents: role === 'admin',
    canViewAllBookings: role === 'admin',
    canManageUsers: role === 'admin',
    canViewAnalytics: role === 'organizer' || role === 'admin',
    canPromoteUsers: role === 'admin'
  }
}

export function useIsAdmin(user?: User | null) {
  const { role, loading } = useUserRole(user)
  return { isAdmin: role === 'admin', loading }
}

export function useIsOrganizerOrAdmin(user?: User | null) {
  const { role, loading } = useUserRole(user)
  return { isOrganizerOrAdmin: role === 'organizer' || role === 'admin', loading }
}

export function useUserEventStats(user?: User | null) {
  const [stats, setStats] = useState<UserEventStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setStats(null)
      setLoading(false)
      return
    }

    const fetchUserStats = async () => {
      try {
        setLoading(true)
        const supabase = createClient()
        
        const { data, error } = await supabase.rpc('get_user_event_stats', {
          user_id: user.id
        })

        if (error) throw error
        
        setStats(data)
      } catch (err) {
        console.error('Error fetching user stats:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch user stats')
      } finally {
        setLoading(false)
      }
    }

    fetchUserStats()
  }, [user])

  return { stats, loading, error, refetch: () => fetchUserStats() }
}

export function usePromoteToOrganizer() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const promoteUser = async (targetUserId: string) => {
    try {
      setLoading(true)
      setError(null)
      const supabase = createClient()
      
      const { data, error } = await supabase.rpc('promote_to_organizer', {
        target_user_id: targetUserId
      })

      if (error) throw error
      
      return data
    } catch (err) {
      console.error('Error promoting user:', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to promote user'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return { promoteUser, loading, error }
}

export function useCheckEventCapacity() {
  const [loading, setLoading] = useState(false)

  const checkCapacity = async (eventId: string, requestedQuantity: number) => {
    try {
      setLoading(true)
      const supabase = createClient()
      
      const { data, error } = await supabase.rpc('check_event_capacity', {
        event_id: eventId,
        requested_quantity: requestedQuantity
      })

      if (error) throw error
      
      return data as boolean
    } catch (err) {
      console.error('Error checking event capacity:', err)
      return false
    } finally {
      setLoading(false)
    }
  }

  return { checkCapacity, loading }
}

export function useHasPermission() {
  const checkPermission = async (
    userRole: UserRole,
    requiredPermission: string,
    requiredResource: string
  ) => {
    try {
      const supabase = createClient()
      
      const { data, error } = await supabase.rpc('has_permission', {
        user_role: userRole,
        required_permission: requiredPermission,
        required_resource: requiredResource
      })

      if (error) throw error
      
      return data as boolean
    } catch (err) {
      console.error('Error checking permission:', err)
      return false
    }
  }

  return { checkPermission }
}
