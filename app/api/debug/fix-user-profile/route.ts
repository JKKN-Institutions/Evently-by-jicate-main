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

    console.log('🔍 Checking user profile for:', user.email)

    // Check if profile exists
    const { data: existingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError) {
      console.log('❌ Profile error:', profileError)
      
      // If profile doesn't exist, create it
      if (profileError.code === 'PGRST116') {
        console.log('📝 Creating missing profile for:', user.email)
        
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email || '',
            full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User',
            role: 'user', // Default role
            avatar_url: user.user_metadata?.avatar_url || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single()

        if (createError) {
          console.error('❌ Failed to create profile:', createError)
          return NextResponse.json({
            error: 'Failed to create profile',
            details: createError.message,
            action: 'create_failed'
          }, { status: 500 })
        }

        return NextResponse.json({
          message: 'Profile created successfully',
          action: 'created',
          profile: newProfile,
          user: {
            id: user.id,
            email: user.email
          }
        })
      }

      return NextResponse.json({
        error: 'Profile fetch failed',
        details: profileError.message,
        action: 'fetch_failed'
      }, { status: 500 })
    }

    // Profile exists - check if it's valid
    if (!existingProfile.role || !existingProfile.email) {
      console.log('🔧 Fixing incomplete profile for:', user.email)
      
      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update({
          email: existingProfile.email || user.email || '',
          role: existingProfile.role || 'user',
          full_name: existingProfile.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .select()
        .single()

      if (updateError) {
        return NextResponse.json({
          error: 'Failed to update profile',
          details: updateError.message,
          action: 'update_failed'
        }, { status: 500 })
      }

      return NextResponse.json({
        message: 'Profile updated successfully',
        action: 'updated',
        profile: updatedProfile,
        user: {
          id: user.id,
          email: user.email
        }
      })
    }

    // Profile is good
    return NextResponse.json({
      message: 'Profile is valid',
      action: 'validated',
      profile: existingProfile,
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      }
    })

  } catch (error) {
    console.error('Fix user profile error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
      action: 'server_error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const body = await request.json()
    const { action, role } = body
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({
        error: 'Not authenticated'
      }, { status: 401 })
    }

    if (action === 'force_create') {
      // Force create/recreate profile
      const { error: deleteError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', user.id)

      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email || '',
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
          role: role || 'user',
          avatar_url: user.user_metadata?.avatar_url || null
        })
        .select()
        .single()

      if (createError) {
        return NextResponse.json({
          error: 'Failed to recreate profile',
          details: createError.message
        }, { status: 500 })
      }

      return NextResponse.json({
        message: 'Profile recreated successfully',
        profile: newProfile
      })
    }

    return NextResponse.json({
      error: 'Invalid action'
    }, { status: 400 })
    
  } catch (error) {
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}