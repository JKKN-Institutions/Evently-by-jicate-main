import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'

export interface UserProfile {
  id: string
  email: string
  full_name: string | null
  role: 'user' | 'organizer' | 'admin'
  avatar_url: string | null
}

export interface AuthState {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  error: string | null
}

/**
 * Safely fetch user profile with timeout and error handling
 */
export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  console.log('fetchUserProfile - Starting fetch for userId:', userId)
  try {
    const supabase = createClient()
    
    // Direct fetch without timeout
    console.log('fetchUserProfile - Executing query...')
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, avatar_url')
      .eq('id', userId)
      .single()
    
    console.log('fetchUserProfile - Query result:', { profile, error })
    
    if (error) {
      console.error('Profile fetch error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      })
      return null
    }
    
    if (!profile) {
      console.warn('Profile query returned null for userId:', userId)
      return null
    }
    
    console.log('fetchUserProfile - Returning profile with role:', profile.role)
    return profile as UserProfile
  } catch (error) {
    console.error('Profile fetch exception:', error)
    return null
  }
}

/**
 * Create or update profile for new user
 */
export async function createUserProfile(user: User): Promise<UserProfile | null> {
  try {
    const supabase = createClient()
    
    // First check if profile already exists to preserve existing role
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, avatar_url')
      .eq('id', user.id)
      .single()
    
    if (existingProfile) {
      // Profile exists, return it without modifying role
      return existingProfile as UserProfile
    }
    
    // Only create new profile if it doesn't exist
    const profileData = {
      id: user.id,
      email: user.email!,
      full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User',
      role: 'user' as const, // New users always start as 'user'
      avatar_url: user.user_metadata?.avatar_url || null
    }
    
    // Use upsert to handle conflicts gracefully
    const { data: profile, error } = await supabase
      .from('profiles')
      .upsert(profileData, { 
        onConflict: 'id',
        ignoreDuplicates: false 
      })
      .select()
      .single()
    
    if (error) {
      console.warn('Profile upsert error:', error)
      // If upsert fails, try to fetch existing profile
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, avatar_url')
        .eq('id', user.id)
        .single()
      
      return existingProfile as UserProfile || null
    }
    
    return profile as UserProfile
  } catch (error) {
    console.warn('Profile creation failed, attempting fetch:', error)
    // Try to fetch existing profile as fallback
    try {
      const supabase = createClient()
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, avatar_url')
        .eq('id', user.id)
        .single()
      
      return existingProfile as UserProfile || null
    } catch (fetchError) {
      console.error('Profile fetch also failed:', fetchError)
      return null
    }
  }
}

/**
 * Get or create user profile
 */
export async function getOrCreateProfile(user: User): Promise<UserProfile | null> {
  try {
    console.log('getOrCreateProfile - Fetching for user:', user.email)
    // First try to fetch existing profile
    let profile = await fetchUserProfile(user.id)
    console.log('getOrCreateProfile - Initial fetch result:', profile)
    
    if (!profile) {
      // If no profile exists, create one
      console.log('getOrCreateProfile - No profile found, creating...')
      profile = await createUserProfile(user)
      console.log('getOrCreateProfile - Created profile:', profile)
    }
    
    // If still no profile (database issues), create a fallback profile
    if (!profile) {
      console.warn('Database profile creation failed, using fallback profile')
      profile = {
        id: user.id,
        email: user.email!,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User',
        role: 'user', // Default fallback role
        avatar_url: user.user_metadata?.avatar_url || null
      }
    }
    
    // Don't override roles here - let database be the source of truth
    // Roles should only be updated through the admin panel
    
    return profile
  } catch (error) {
    console.error('Profile creation/fetch completely failed:', error)
    // Return a basic fallback profile so the app doesn't break
    return {
      id: user.id,
      email: user.email!,
      full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User',
      role: 'user', // Default fallback role
      avatar_url: user.user_metadata?.avatar_url || null
    }
  }
}

/**
 * Sign out user and clear all auth state
 */
export async function signOutUser(): Promise<void> {
  try {
    const supabase = createClient()
    
    // Clear Supabase auth
    await supabase.auth.signOut()
    
    // Clear localStorage
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.includes('supabase')) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key))
    
    // Clear sessionStorage
    sessionStorage.clear()
    
    // Redirect to login
    window.location.href = '/login'
  } catch (error) {
    console.error('Sign out error:', error)
    // Force redirect anyway
    window.location.href = '/login'
  }
}

/**
 * Check if user has specific role
 */
export function hasRole(profile: UserProfile | null, role: 'user' | 'organizer' | 'admin'): boolean {
  if (!profile) return false
  
  switch (role) {
    case 'admin':
      return profile.role === 'admin'
    case 'organizer':
      return profile.role === 'organizer' || profile.role === 'admin'
    case 'user':
      return true // All authenticated users have user role
    default:
      return false
  }
}

/**
 * Get navigation items based on user role
 */
export function getNavigationForRole(profile: UserProfile | null) {
  const baseNavigation = [
    { name: 'Home', href: '/', icon: 'Home' },
    { name: 'Events', href: '/events', icon: 'Calendar' },
    { name: 'My Bookings', href: '/bookings', icon: 'Ticket' },
  ]
  
  if (!profile) return baseNavigation
  
  let navigation = [...baseNavigation]
  
  // Add controller dashboards - these will show for users who have the roles
  // We'll add them for all authenticated users and let the pages themselves check permissions
  navigation.push(
    { name: 'Page Controller', href: '/page-controller', icon: 'Shield' },
    { name: 'Event Controller', href: '/event-controller', icon: 'UserCheck' }
  )
  
  // Add organizer navigation
  if (hasRole(profile, 'organizer')) {
    navigation.push(
      { name: 'My Events', href: '/organizer/my-events', icon: 'Calendar' },
      { name: 'Payments', href: '/payments', icon: 'CreditCard' },
      { name: 'Verify Tickets', href: '/verify', icon: 'CheckCircle' }
    )
  }
  
  // Add admin navigation
  if (hasRole(profile, 'admin')) {
    // Only add Verify Tickets if not already added by organizer role
    const hasVerifyTickets = navigation.some(item => item.name === 'Verify Tickets')
    
    navigation.push(
      { name: 'Event Pages', href: '/admin/event-pages', icon: 'Layers' },
      { name: 'Page Controllers', href: '/admin/page-controllers', icon: 'Shield' },
      { name: 'User Management', href: '/admin/users', icon: 'Users' },
      { name: 'Admin Payments', href: '/admin/payments', icon: 'CreditCard' },
      { name: 'Analytics', href: '/admin/analytics', icon: 'BarChart3' }
    )
    
    if (!hasVerifyTickets) {
      navigation.push({ name: 'Verify Tickets', href: '/verify', icon: 'CheckCircle' })
    }
    
    navigation.push(
      { name: 'Enhanced Ticket Generator', href: '/admin/enhanced-ticket-generator', icon: 'Ticket' },
      { name: 'Predefined Tickets', href: '/admin/predefined-tickets', icon: 'FolderOpen' }
    )
  }
  
  return navigation
}