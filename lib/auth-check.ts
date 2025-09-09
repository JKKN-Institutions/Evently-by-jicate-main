import { createClient } from '@/lib/supabase/client'

export async function checkAuth() {
  const supabase = createClient()
  
  try {
    // Use getSession which is faster than getUser
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error || !session) {
      return { user: null, role: 'user' }
    }
    
    // Try to get profile, but don't fail if it doesn't exist
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle()
    
    return {
      user: session.user,
      role: profile?.role || 'user'
    }
  } catch (error) {
    console.error('Auth check error:', error)
    return { user: null, role: 'user' }
  }
}

export async function ensureProfile(userId: string, email: string) {
  const supabase = createClient()
  
  try {
    // Check if profile exists
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle()
    
    if (!existing) {
      // Create profile
      await supabase
        .from('profiles')
        .insert({
          id: userId,
          email: email,
          full_name: email.split('@')[0],
          role: 'user'
        })
    }
  } catch (error) {
    console.error('Profile ensure error:', error)
  }
}