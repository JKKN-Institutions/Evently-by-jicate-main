import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    // Check if service role key is available
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: 'Service role key not configured' },
        { status: 500 }
      )
    }

    const body = await request.json()
    const { email, role } = body

    if (!email || !role) {
      return NextResponse.json(
        { error: 'Email and role are required' },
        { status: 400 }
      )
    }

    // Create service role client
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

    // Step 1: Update the profile role directly
    const { data: profile, error: profileError } = await serviceSupabase
      .from('profiles')
      .update({ role })
      .eq('email', email)
      .select()
      .single()

    if (profileError) {
      console.error('Failed to update profile:', profileError)
      return NextResponse.json(
        { error: 'Failed to update profile role' },
        { status: 500 }
      )
    }

    // Step 2: Clear any role metadata from auth.users to prevent interference
    const { data: authUser } = await serviceSupabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single()

    if (authUser?.id) {
      // Remove role from metadata using raw SQL via RPC
      const { error: metadataError } = await serviceSupabase.rpc('exec_sql', {
        sql: `
          UPDATE auth.users 
          SET raw_user_meta_data = raw_user_meta_data - 'role'
          WHERE id = '${authUser.id}'::uuid;
        `
      })

      if (metadataError) {
        console.warn('Could not clear metadata (RPC might not exist):', metadataError)
        
        // Try using the admin API instead
        try {
          const { data: userData } = await serviceSupabase.auth.admin.getUserById(authUser.id)
          if (userData?.user) {
            const currentMetadata = userData.user.user_metadata || {}
            delete currentMetadata.role
            
            await serviceSupabase.auth.admin.updateUserById(authUser.id, {
              user_metadata: currentMetadata
            })
            console.log('Cleared role from auth metadata via admin API')
          }
        } catch (adminError) {
          console.warn('Could not clear metadata via admin API:', adminError)
        }
      }
    }

    // Step 3: Verify the update
    const { data: verifyProfile } = await serviceSupabase
      .from('profiles')
      .select('id, email, role')
      .eq('email', email)
      .single()

    return NextResponse.json({
      success: true,
      message: `Role forcefully updated to ${role}`,
      profile: verifyProfile,
      instructions: 'User should log out and log back in to see the changes'
    })

  } catch (error) {
    console.error('Error in force-fix-role:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}