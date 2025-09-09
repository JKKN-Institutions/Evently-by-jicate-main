import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const diagnostics = {
      user: {
        id: user.id,
        email: user.email
      },
      tests: []
    }

    // Test 1: Can we query tickets?
    const { data: tickets, error: ticketsError } = await supabase
      .from('tickets')
      .select('id')
      .limit(1)

    diagnostics.tests.push({
      name: 'Query tickets table',
      success: !ticketsError,
      error: ticketsError?.message
    })

    // Test 2: Can we query bookings?
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('id')
      .limit(1)

    diagnostics.tests.push({
      name: 'Query bookings table',
      success: !bookingsError,
      error: bookingsError?.message
    })

    // Test 3: Can we query events?
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id')
      .limit(1)

    diagnostics.tests.push({
      name: 'Query events table',
      success: !eventsError,
      error: eventsError?.message
    })

    // Test 4: Check if event_verification_stats exists
    const { data: stats, error: statsError } = await supabase
      .from('event_verification_stats')
      .select('event_id')
      .limit(1)

    diagnostics.tests.push({
      name: 'Query event_verification_stats table',
      success: !statsError,
      error: statsError?.message,
      note: 'This table has RLS issues'
    })

    // Test 5: Check user's role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    diagnostics.tests.push({
      name: 'Check user profile/role',
      success: !profileError,
      data: profile,
      error: profileError?.message
    })

    // Test 6: Try to get table structure info
    const { data: columns, error: columnsError } = await supabase
      .rpc('get_table_columns', { table_name: 'tickets' })
      .single()

    diagnostics.tests.push({
      name: 'Get tickets table structure',
      success: !columnsError,
      error: columnsError?.message,
      note: 'This might not exist'
    })

    return NextResponse.json({
      success: true,
      diagnostics: diagnostics,
      summary: {
        total_tests: diagnostics.tests.length,
        passed: diagnostics.tests.filter(t => t.success).length,
        failed: diagnostics.tests.filter(t => !t.success).length
      }
    })

  } catch (error) {
    console.error('Diagnostic error:', error)
    return NextResponse.json(
      { error: 'Diagnostic failed', details: error },
      { status: 500 }
    )
  }
}