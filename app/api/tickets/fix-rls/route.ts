import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Try to disable RLS temporarily for event_verification_stats
    // This is a workaround for the RLS issue
    const fixes = []

    // Test if we can access the table
    const { error: testError } = await supabase
      .from('event_verification_stats')
      .select('*')
      .limit(1)

    if (testError) {
      fixes.push({
        step: 'Test table access',
        success: false,
        error: testError.message
      })
    } else {
      fixes.push({
        step: 'Test table access',
        success: true
      })
    }

    // Try to create a test entry to see if insert works
    const testEventId = 'test-' + Date.now()
    const { error: insertError } = await supabase
      .from('event_verification_stats')
      .insert({
        event_id: testEventId,
        total_tickets: 0,
        verified_tickets: 0,
        unverified_tickets: 0
      })

    if (insertError) {
      fixes.push({
        step: 'Test insert operation',
        success: false,
        error: insertError.message,
        note: 'This indicates RLS policies are blocking inserts'
      })
    } else {
      fixes.push({
        step: 'Test insert operation',
        success: true
      })

      // Clean up test entry
      await supabase
        .from('event_verification_stats')
        .delete()
        .eq('event_id', testEventId)
    }

    // Return diagnostic information
    return NextResponse.json({
      success: true,
      message: 'RLS diagnostic completed',
      fixes,
      recommendation: 'Apply the SQL migration in supabase/fix-verification-stats-rls.sql to fix RLS policies',
      sqlFile: '/supabase/fix-verification-stats-rls.sql'
    })

  } catch (error) {
    console.error('Error in RLS fix:', error)
    return NextResponse.json(
      { error: 'Failed to diagnose RLS issues' },
      { status: 500 }
    )
  }
}