import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/config/admin-emails'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({
        error: 'Not authenticated'
      }, { status: 401 })
    }

    // Check if user should be admin
    if (!user.email || !isAdminEmail(user.email)) {
      return NextResponse.json({
        error: 'Not authorized - email not in admin list'
      }, { status: 403 })
    }

    // Use service role to bypass RLS and force update
    const serviceSupabase = await createClient()

    // First try to get existing profile
    const { data: existingProfile } = await serviceSupabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (existingProfile) {
      // Update existing profile to admin
      const { error: updateError } = await serviceSupabase
        .from('profiles')
        .update({ 
          role: 'admin',
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

      if (updateError) {
        console.error('Profile update error:', updateError)
        return NextResponse.json({
          error: 'Failed to update profile',
          details: updateError.message
        }, { status: 500 })
      }
    } else {
      // Create new profile as admin
      const { error: insertError } = await serviceSupabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Admin User',
          role: 'admin',
          avatar_url: user.user_metadata?.avatar_url || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

      if (insertError) {
        console.error('Profile creation error:', insertError)
        return NextResponse.json({
          error: 'Failed to create admin profile',
          details: insertError.message
        }, { status: 500 })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Admin role has been set successfully',
      user: {
        id: user.id,
        email: user.email,
        role: 'admin'
      }
    })

  } catch (error) {
    console.error('Force admin role error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}