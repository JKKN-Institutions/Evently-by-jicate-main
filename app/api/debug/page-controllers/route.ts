import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated', user: null }, { status: 401 })
    }
    
    console.log('Debug API - User ID:', user.id)
    console.log('Debug API - User Email:', user.email)
    
    // Try to fetch from page_controllers
    const { data: pageControllers, error: pcError } = await supabase
      .from('page_controllers')
      .select(`
        *,
        event_pages (
          id,
          title,
          location,
          status
        )
      `)
      .eq('controller_id', user.id)
    
    console.log('Page Controllers Query Result:', { pageControllers, pcError })
    
    // Try to fetch from role_assignments
    const { data: roleAssignments, error: raError } = await supabase
      .from('role_assignments')
      .select(`
        *,
        event_pages (
          id,
          title,
          location,
          status
        )
      `)
      .eq('user_id', user.id)
      .eq('role_type', 'page_controller')
    
    console.log('Role Assignments Query Result:', { roleAssignments, raError })
    
    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    
    console.log('Profile Query Result:', { profile, profileError })
    
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email
      },
      profile,
      pageControllers: pageControllers || [],
      pageControllersError: pcError,
      roleAssignments: roleAssignments || [],
      roleAssignmentsError: raError
    })
  } catch (error) {
    console.error('Debug API Error:', error)
    return NextResponse.json({ error: 'Internal server error', details: error }, { status: 500 })
  }
}