import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    console.log('=== TESTING TICKET DATA ACCESS ===')

    // Test 1: Direct count of tickets
    const { count: ticketCount, error: countError } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })

    console.log('Ticket count:', { ticketCount, countError })

    // Test 2: Get first 5 tickets
    const { data: tickets, error: ticketsError } = await supabase
      .from('tickets')
      .select('*')
      .limit(5)

    console.log('Sample tickets:', { 
      count: tickets?.length || 0, 
      error: ticketsError,
      data: tickets 
    })

    // Test 3: Check events
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, title')
      .limit(5)

    console.log('Sample events:', { 
      count: events?.length || 0,
      error: eventsError,
      data: events 
    })

    // Test 4: Check bookings
    const { count: bookingCount } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })

    console.log('Booking count:', bookingCount)

    // Test 5: Check if RLS is blocking
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .limit(1)
      .single()

    console.log('User profile check:', profile)

    return NextResponse.json({
      success: true,
      data: {
        ticket_count: ticketCount || 0,
        sample_tickets: tickets || [],
        event_count: events?.length || 0,
        sample_events: events || [],
        booking_count: bookingCount || 0,
        user_role: profile?.role || 'unknown',
        errors: {
          tickets: ticketsError?.message,
          events: eventsError?.message
        }
      },
      message: ticketCount === 0 
        ? 'No tickets in database. Generate some tickets first!' 
        : `Found ${ticketCount} tickets in database`
    })

  } catch (error: any) {
    console.error('Test error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to test ticket data', 
        details: error.message,
        hint: 'Check Supabase connection and RLS policies'
      },
      { status: 500 }
    )
  }
}