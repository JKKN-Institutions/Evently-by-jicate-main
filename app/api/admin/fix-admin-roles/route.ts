import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { ADMIN_EMAILS } from '@/lib/config/admin-emails'

export async function POST() {
  try {
    const supabase = await createClient()
    
    // Get current user to check if they're already an admin
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if current user is an admin or is in the admin emails list
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    
    const isCurrentUserAdmin = currentProfile?.role === 'admin' || ADMIN_EMAILS.includes(user.email?.toLowerCase() || '')
    
    if (!isCurrentUserAdmin) {
      return NextResponse.json(
        { error: 'Only admins can fix admin roles' },
        { status: 403 }
      )
    }

    // Fix admin roles for all emails in the admin list
    const results = []
    
    for (const email of ADMIN_EMAILS) {
      // Get user by email
      const { data: userData, error: userFetchError } = await supabase
        .from('profiles')
        .select('id, email, role')
        .eq('email', email)
        .single()
      
      if (userData && userData.role !== 'admin') {
        // Update to admin role
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ role: 'admin', updated_at: new Date().toISOString() })
          .eq('id', userData.id)
        
        if (!updateError) {
          results.push({
            email,
            status: 'updated',
            previousRole: userData.role,
            newRole: 'admin'
          })
        } else {
          results.push({
            email,
            status: 'error',
            error: updateError.message
          })
        }
      } else if (userData && userData.role === 'admin') {
        results.push({
          email,
          status: 'already_admin',
          role: 'admin'
        })
      } else {
        results.push({
          email,
          status: 'not_found',
          message: 'User profile not found'
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Admin roles check completed',
      results
    })
  } catch (error) {
    console.error('Error fixing admin roles:', error)
    return NextResponse.json(
      { error: 'Failed to fix admin roles' },
      { status: 500 }
    )
  }
}