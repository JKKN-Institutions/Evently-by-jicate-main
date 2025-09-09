import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Fetch the current role from profiles table (source of truth)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.error('Error fetching profile:', profileError)
      
      // If profile doesn't exist, create it with default role
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email || '',
          role: 'user'
        })
      
      if (insertError) {
        return NextResponse.json(
          { error: 'Failed to fetch or create profile' },
          { status: 500 }
        )
      }
      
      return NextResponse.json({ 
        role: 'user',
        message: 'Profile created with default role'
      })
    }

    // Return the role from the database
    return NextResponse.json({ 
      role: profile.role,
      source: 'database',
      userId: user.id,
      message: 'Role fetched from profile table'
    })
    
  } catch (error) {
    console.error('Error in refresh-role API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      )
    }

    // Force refresh by clearing any cached data and refetching
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    // Call the database function to sync metadata (if available)
    const { data: refreshResult, error: refreshError } = await supabase
      .rpc('refresh_user_session_role', { user_id: user.id })

    if (refreshError) {
      console.warn('Could not call refresh function:', refreshError)
      // Don't fail, just log the warning
    }

    return NextResponse.json({ 
      role: profile.role,
      refreshed: true,
      message: 'Role refreshed successfully',
      refreshResult
    })
    
  } catch (error) {
    console.error('Error in refresh-role API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}