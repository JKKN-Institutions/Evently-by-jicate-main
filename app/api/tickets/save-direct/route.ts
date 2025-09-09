import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Direct Supabase client with service role key to bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function POST(request: NextRequest) {
  try {
    console.log('Direct ticket save - bypassing all RLS')
    
    const { 
      ticketNumber,
      eventId,
      attendeeName = 'Guest'
    } = await request.json()
    
    if (!ticketNumber) {
      return NextResponse.json(
        { error: 'Ticket number is required' },
        { status: 400 }
      )
    }

    // Generate QR URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const qrData = `${baseUrl}/verify/ticket/${ticketNumber}`
    
    console.log('Saving ticket:', ticketNumber)
    console.log('QR Data:', qrData)

    // First, check if we need a booking
    let bookingId = null
    
    // Get a valid user_id first (for foreign key constraint)
    let validUserId = null
    const { data: anyUser } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .limit(1)
      .single()
    
    if (anyUser) {
      validUserId = anyUser.id
      console.log('Using existing user:', validUserId)
    }
    
    // If we have an eventId, create a minimal booking
    if (eventId && eventId !== 'undefined' && eventId !== 'null' && validUserId) {
      // Check if event exists
      const { data: event } = await supabaseAdmin
        .from('events')
        .select('id')
        .eq('id', eventId)
        .single()
      
      if (event) {
        // Create booking with valid user_id
        const { data: booking, error: bookingError } = await supabaseAdmin
          .from('bookings')
          .insert({
            event_id: eventId,
            user_id: validUserId, // Use actual user from profiles
            user_name: attendeeName,
            user_email: 'ticket@system.local',
            user_phone: '0000000000',
            quantity: 1,
            total_amount: 0,
            payment_status: 'completed',
            payment_id: `DIRECT_${ticketNumber}`,
            booking_status: 'confirmed'
          })
          .select('id')
          .single()
        
        if (booking) {
          bookingId = booking.id
          console.log('Booking created:', bookingId)
        } else {
          console.log('Booking error:', bookingError)
        }
      }
    }

    // Get a valid event_id to use (for foreign key constraint)
    let validEventId = eventId
    if (!eventId || eventId === 'undefined' || eventId === 'null' || eventId === '') {
      // Get any existing event to use as default
      const { data: defaultEvent } = await supabaseAdmin
        .from('events')
        .select('id')
        .limit(1)
        .single()
      
      if (defaultEvent) {
        validEventId = defaultEvent.id
        console.log('Using default event:', validEventId)
      }
    }
    
    // If no booking created, use a default one or create a system booking
    if (!bookingId) {
      // Try to find any existing booking we can use
      const { data: existingBooking } = await supabaseAdmin
        .from('bookings')
        .select('id')
        .limit(1)
        .single()
      
      if (existingBooking) {
        bookingId = existingBooking.id
        console.log('Using existing booking:', bookingId)
      } else {
        // Create a system booking with valid user and event
        if (validUserId && validEventId) {
          const { data: systemBooking } = await supabaseAdmin
            .from('bookings')
            .insert({
              event_id: validEventId,
              user_id: validUserId,
              user_name: 'System',
              user_email: 'system@ticket.local',
              user_phone: '0000000000',
              quantity: 1,
              total_amount: 0,
              payment_status: 'completed',
              payment_id: 'SYSTEM_BOOKING',
              booking_status: 'confirmed'
            })
            .select('id')
            .single()
          
          if (systemBooking) {
            bookingId = systemBooking.id
            console.log('System booking created:', bookingId)
          }
        }
      }
    }
    
    // Ensure we have both booking and event IDs
    if (!bookingId || !validEventId) {
      return NextResponse.json({
        error: 'Cannot create ticket - no valid booking or event found',
        details: 'Database requires at least one booking and one event to exist'
      }, { status: 400 })
    }
    
    // Now save the ticket with service role (bypasses all RLS)
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('tickets')
      .insert({
        booking_id: bookingId,
        event_id: validEventId,
        ticket_number: ticketNumber,
        qr_code: qrData,
        status: 'valid',
        ticket_type: 'General',
        metadata: {
          savedVia: 'direct_api',
          attendeeName: attendeeName,
          savedAt: new Date().toISOString(),
          originalEventId: eventId || 'predefined'
        }
      })
      .select()
      .single()

    if (ticketError) {
      console.error('Ticket save error:', ticketError)
      
      return NextResponse.json({
        error: 'Failed to save ticket',
        details: ticketError.message,
        code: ticketError.code
      }, { status: 500 })
    }

    console.log('Ticket saved successfully:', ticket.id)

    // Verify it's in the database
    const { data: verification } = await supabaseAdmin
      .from('tickets')
      .select('id, ticket_number, qr_code')
      .eq('ticket_number', ticketNumber)
      .single()

    return NextResponse.json({
      success: true,
      ticket: ticket,
      verified: !!verification,
      message: `Ticket ${ticketNumber} saved to database`
    })

  } catch (error) {
    console.error('Direct save error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to save ticket',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}