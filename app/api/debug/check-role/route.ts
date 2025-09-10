import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/config/admin-emails'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError) {
      return NextResponse.json({
        error: 'Failed to get user',
        details: userError.message
      }, { status: 401 })
    }

    if (!user) {
      return NextResponse.json({
        error: 'No user found'
      }, { status: 401 })
    }

    // Get profile from database
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    // Check if email is in admin list
    const isEmailAdmin = user.email ? isAdminEmail(user.email) : false

    return NextResponse.json({
      debug: 'Role Check Debug',
      user: {
        id: user.id,
        email: user.email,
        metadata: user.user_metadata
      },
      profile: profile || null,
      profileError: profileError?.message || null,
      isEmailAdmin,
      shouldBeAdmin: isEmailAdmin,
      currentRole: profile?.role || 'none',
      recommendation: isEmailAdmin && profile?.role !== 'admin' 
        ? 'Profile role should be updated to admin' 
        : 'Roles match correctly'
    })

  } catch (error) {
    console.error('Debug role check error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}