import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    // Check if service role key is available
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 })
    }
    
    // Create service client to bypass RLS
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    // Check if profile exists
    const { data: existingProfile, error: fetchError } = await serviceSupabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
    
    if (fetchError && fetchError.code === 'PGRST116') {
      // Profile doesn't exist, create it with default 'user' role
      // Admins must be promoted manually through the admin panel
      
      const { data: newProfile, error: createError } = await serviceSupabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email!,
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User',
          role: 'user', // All new users start as 'user'
          avatar_url: user.user_metadata?.avatar_url || null
        })
        .select()
        .single()
      
      if (createError) {
        return NextResponse.json({ 
          error: 'Failed to create profile', 
          details: createError 
        }, { status: 500 })
      }
      
      return NextResponse.json({
        message: 'Profile created successfully',
        profile: newProfile,
        action: 'created'
      })
    } else if (fetchError) {
      return NextResponse.json({ 
        error: 'Failed to fetch profile', 
        details: fetchError 
      }, { status: 500 })
    }
    
    // Profile exists - no automatic role updates
    // Roles must be managed through the admin panel
    
    return NextResponse.json({
      message: 'Profile exists and is correctly configured',
      profile: existingProfile,
      action: 'none'
    })
    
  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}