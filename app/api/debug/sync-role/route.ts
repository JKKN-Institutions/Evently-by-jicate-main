import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({
        error: 'Not authenticated',
        details: authError?.message
      }, { status: 401 })
    }

    // Get profile directly from database
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError) {
      // Try to create profile if it doesn't exist
      if (profileError.code === 'PGRST116') {
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email || '',
            role: 'user',
            full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
          })
          .select()
          .single()

        if (createError) {
          return NextResponse.json({
            error: 'Failed to create profile',
            details: createError.message
          }, { status: 500 })
        }

        return NextResponse.json({
          message: 'Profile created',
          profile: newProfile,
          user: {
            id: user.id,
            email: user.email
          }
        })
      }

      return NextResponse.json({
        error: 'Failed to fetch profile',
        details: profileError.message,
        code: profileError.code
      }, { status: 500 })
    }

    // Return both user and profile info
    return NextResponse.json({
      message: 'Profile synced',
      profile: profile,
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      },
      debug: {
        supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Sync role error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { role } = body
    
    if (!role || !['user', 'organizer', 'admin'].includes(role)) {
      return NextResponse.json({
        error: 'Invalid role'
      }, { status: 400 })
    }
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({
        error: 'Not authenticated'
      }, { status: 401 })
    }

    // Update role
    const { data: profile, error: updateError } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', user.id)
      .select()
      .single()

    if (updateError) {
      return NextResponse.json({
        error: 'Failed to update role',
        details: updateError.message
      }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Role updated successfully',
      profile
    })
    
  } catch (error) {
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}