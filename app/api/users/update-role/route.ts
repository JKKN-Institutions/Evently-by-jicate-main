import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if current user is admin
    const { data: currentUserProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (currentUserProfile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      )
    }

    // Get request body
    const body = await request.json()
    const { userId, newRole } = body

    // Validate input
    if (!userId || !newRole) {
      return NextResponse.json(
        { error: 'Missing userId or newRole' },
        { status: 400 }
      )
    }

    // Validate role value
    const validRoles = ['user', 'organizer', 'admin']
    if (!validRoles.includes(newRole)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be user, organizer, or admin' },
        { status: 400 }
      )
    }

    // Prevent removing the last admin
    if (newRole !== 'admin') {
      const { data: adminCount } = await supabase
        .from('profiles')
        .select('id', { count: 'exact' })
        .eq('role', 'admin')

      if (adminCount && adminCount.length <= 1) {
        const { data: targetUser } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .single()

        if (targetUser?.role === 'admin') {
          return NextResponse.json(
            { error: 'Cannot remove the last admin' },
            { status: 400 }
          )
        }
      }
    }

    // Check if service role key is available
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error('SUPABASE_SERVICE_ROLE_KEY is not configured')
      return NextResponse.json(
        { error: 'Server configuration error: Service role key not found' },
        { status: 500 }
      )
    }

    // Create service role client to bypass RLS for admin operations
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Update user role using service role client
    const { data, error } = await serviceSupabase
      .from('profiles')
      .update({ role: newRole })
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      console.error('Error updating user role:', error)
      return NextResponse.json(
        { error: 'Failed to update user role' },
        { status: 500 }
      )
    }

    // IMPORTANT: Remove role from auth metadata to prevent interference
    // We want the profiles table to be the ONLY source of truth
    try {
      const { data: userData } = await serviceSupabase.auth.admin.getUserById(userId)
      if (userData?.user) {
        const currentMetadata = userData.user.user_metadata || {}
        // Remove role from metadata
        delete currentMetadata.role
        
        await serviceSupabase.auth.admin.updateUserById(userId, {
          user_metadata: currentMetadata
        })
        console.log('Removed role from auth metadata - profiles table is now sole source')
      }
    } catch (metadataError) {
      console.warn('Could not clear role from metadata:', metadataError)
      // Don't fail the request, as the profile was updated successfully
    }

    return NextResponse.json({ 
      success: true, 
      user: data,
      message: `User role updated to ${newRole}`,
      requiresReauth: true // Signal that user may need to re-authenticate
    })
  } catch (error) {
    console.error('Error in update-role API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}