import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// Create a service role client that bypasses RLS completely
const createServiceRoleClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  
  if (!supabaseServiceKey) {
    throw new Error('Service role key not configured')
  }
  
  return createServiceClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({
        error: 'Not authenticated',
        details: authError?.message || 'No user found'
      }, { status: 401 })
    }

    console.log('🚨 EMERGENCY: Checking user profile for:', user.email)

    // First try with regular client
    let regularProfile = null
    let regularError = null
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      
      regularProfile = data
      regularError = error
    } catch (e) {
      regularError = e
    }

    // Try with service role client
    let serviceProfile = null
    let serviceError = null
    
    try {
      const serviceClient = createServiceRoleClient()
      const { data, error } = await serviceClient
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      
      serviceProfile = data
      serviceError = error
    } catch (e) {
      serviceError = e
      console.error('Service client error:', e)
    }

    // Check if profile exists in service but not regular (RLS issue)
    if (!regularProfile && serviceProfile) {
      console.log('🚨 RLS ISSUE: Profile exists but not accessible via regular client')
    }

    // If no profile exists anywhere, create one
    if (!regularProfile && !serviceProfile) {
      console.log('🚨 MISSING PROFILE: Creating new profile via service client')
      
      try {
        const serviceClient = createServiceRoleClient()
        const { data: newProfile, error: createError } = await serviceClient
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email || '',
            full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User',
            role: 'user',
            avatar_url: user.user_metadata?.avatar_url || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single()

        if (createError) {
          throw createError
        }

        return NextResponse.json({
          message: 'Profile created via service client',
          action: 'created',
          profile: newProfile,
          debug: {
            regularError: regularError?.message,
            serviceError: serviceError?.message,
            user: {
              id: user.id,
              email: user.email
            }
          }
        })
      } catch (createErr) {
        return NextResponse.json({
          error: 'Failed to create profile',
          details: createErr instanceof Error ? createErr.message : String(createErr)
        }, { status: 500 })
      }
    }

    return NextResponse.json({
      message: 'Profile diagnosis complete',
      debug: {
        user: {
          id: user.id,
          email: user.email,
          created_at: user.created_at
        },
        regularClient: {
          profile: regularProfile,
          error: regularError?.message
        },
        serviceClient: {
          profile: serviceProfile,
          error: serviceError?.message
        },
        environment: {
          supabase_url: process.env.NEXT_PUBLIC_SUPABASE_URL,
          has_service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
          timestamp: new Date().toISOString()
        }
      }
    })

  } catch (error) {
    console.error('Emergency role fix error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, email, role } = body
    
    if (action === 'force_update_by_email') {
      if (!email || !role) {
        return NextResponse.json({
          error: 'Missing email or role'
        }, { status: 400 })
      }
      
      try {
        const serviceClient = createServiceRoleClient()
        
        // Update role directly via service client
        const { data: updatedProfile, error: updateError } = await serviceClient
          .from('profiles')
          .update({ 
            role,
            updated_at: new Date().toISOString()
          })
          .eq('email', email)
          .select()
          .single()

        if (updateError) {
          throw updateError
        }

        return NextResponse.json({
          message: `Role updated to ${role} for ${email}`,
          profile: updatedProfile
        })
      } catch (updateErr) {
        return NextResponse.json({
          error: 'Failed to update role',
          details: updateErr instanceof Error ? updateErr.message : String(updateErr)
        }, { status: 500 })
      }
    }

    return NextResponse.json({
      error: 'Invalid action'
    }, { status: 400 })
    
  } catch (error) {
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}