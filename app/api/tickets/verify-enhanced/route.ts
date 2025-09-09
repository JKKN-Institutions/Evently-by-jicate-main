import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Authentication required',
          message: 'Please login to verify tickets' 
        },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { qrData, eventId } = body
    
    if (!qrData) {
      return NextResponse.json(
        { 
          success: false,
          error: 'QR code data is required',
          message: 'Invalid QR code' 
        },
        { status: 400 }
      )
    }

    // Parse QR data if it's a string
    let parsedQRData
    try {
      parsedQRData = typeof qrData === 'string' ? JSON.parse(qrData) : qrData
    } catch (error) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid QR code format',
          message: 'The QR code is not valid' 
        },
        { status: 400 }
      )
    }

    const { ticketNumber, verificationId } = parsedQRData

    if (!ticketNumber || !verificationId) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid QR code data',
          message: 'The QR code is missing required information' 
        },
        { status: 400 }
      )
    }

    // Get ticket from database with all related data
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select(`
        *,
        bookings (
          *,
          events (
            id,
            title,
            date,
            time,
            venue,
            organizer_id
          )
        ),
        events!tickets_event_id_fkey (
          id,
          title,
          date,
          time,
          venue,
          organizer_id
        )
      `)
      .eq('ticket_number', ticketNumber)
      .single()

    if (ticketError || !ticket) {
      // Log failed verification attempt
      await supabase.from('ticket_verifications').insert({
        ticket_number: ticketNumber,
        verification_id: verificationId,
        event_id: eventId,
        scanned_by: user.id,
        scan_result: 'invalid',
        scan_timestamp: new Date().toISOString(),
        device_info: {
          user_agent: request.headers.get('user-agent'),
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
        }
      })

      return NextResponse.json({
        success: false,
        message: '❌ Invalid Ticket',
        details: 'This ticket does not exist in our system',
        scan_result: 'invalid'
      }, { status: 404 })
    }

    // Verify the verification ID matches
    const storedVerificationId = ticket.metadata?.verificationId || 
                                 JSON.parse(ticket.qr_code || '{}').verificationId

    if (storedVerificationId !== verificationId) {
      // Log tampering attempt
      await supabase.from('ticket_verifications').insert({
        ticket_id: ticket.id,
        ticket_number: ticketNumber,
        verification_id: verificationId,
        event_id: ticket.event_id,
        scanned_by: user.id,
        scan_result: 'tampered',
        scan_timestamp: new Date().toISOString(),
        device_info: {
          user_agent: request.headers.get('user-agent'),
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
        }
      })

      return NextResponse.json({
        success: false,
        message: '⚠️ Security Alert',
        details: 'This QR code has been tampered with',
        scan_result: 'tampered'
      }, { status: 400 })
    }

    // Get event details - either from booking or direct association
    const eventDetails = ticket.bookings?.events || ticket.events || null
    
    // Check if user is authorized to verify this ticket
    const isOrganizer = eventDetails?.organizer_id === user.id
    
    // Check if user is event staff
    const { data: staffCheck } = await supabase
      .from('event_staff')
      .select('role, permissions')
      .eq('event_id', ticket.event_id)
      .eq('user_id', user.id)
      .single()
    
    const canVerify = isOrganizer || staffCheck?.permissions?.can_scan

    if (!canVerify) {
      return NextResponse.json({
        success: false,
        message: '🚫 Not Authorized',
        details: 'You are not authorized to verify tickets for this event',
        scan_result: 'unauthorized'
      }, { status: 403 })
    }

    // Check if event ID matches (if provided)
    if (eventId && ticket.event_id !== eventId) {
      await supabase.from('ticket_verifications').insert({
        ticket_id: ticket.id,
        ticket_number: ticketNumber,
        verification_id: verificationId,
        event_id: eventId,
        scanned_by: user.id,
        scan_result: 'wrong_event',
        scan_timestamp: new Date().toISOString(),
        device_info: {
          user_agent: request.headers.get('user-agent'),
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
        }
      })

      return NextResponse.json({
        success: false,
        message: '❌ Wrong Event',
        details: `This ticket is for "${eventDetails?.title || 'Unknown Event'}"`,
        scan_result: 'wrong_event',
        ticket_info: {
          correct_event: eventDetails?.title || 'Unknown Event',
          event_date: eventDetails?.date
        }
      })
    }

    // Check ticket status and handle different scenarios
    if (ticket.status === 'used') {
      // Get previous verification details
      const { data: previousVerification } = await supabase
        .from('ticket_verifications')
        .select('*')
        .eq('ticket_id', ticket.id)
        .eq('scan_result', 'success')
        .order('scan_timestamp', { ascending: false })
        .limit(1)
        .single()

      // Log duplicate scan attempt
      await supabase.from('ticket_verifications').insert({
        ticket_id: ticket.id,
        ticket_number: ticketNumber,
        verification_id: verificationId,
        event_id: ticket.event_id,
        scanned_by: user.id,
        scan_result: 'already_used',
        scan_timestamp: new Date().toISOString(),
        device_info: {
          user_agent: request.headers.get('user-agent'),
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
        }
      })

      const checkedInTime = previousVerification?.scan_timestamp || ticket.checked_in_at
      const formattedTime = checkedInTime ? 
        new Date(checkedInTime).toLocaleString('en-US', {
          dateStyle: 'short',
          timeStyle: 'short'
        }) : 'Unknown time'

      return NextResponse.json({
        success: false,
        message: '🔄 Ticket Already Verified',
        details: `This ticket was already checked in at ${formattedTime}`,
        scan_result: 'already_used',
        ticket_info: {
          ticket_number: ticket.ticket_number,
          checked_in_at: checkedInTime,
          seat_info: {
            seat_number: ticket.seat_number,
            row_number: ticket.row_number,
            section: ticket.section
          }
        }
      })
    }

    if (ticket.status === 'cancelled') {
      await supabase.from('ticket_verifications').insert({
        ticket_id: ticket.id,
        ticket_number: ticketNumber,
        verification_id: verificationId,
        event_id: ticket.event_id,
        scanned_by: user.id,
        scan_result: 'cancelled',
        scan_timestamp: new Date().toISOString(),
        device_info: {
          user_agent: request.headers.get('user-agent'),
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
        }
      })

      return NextResponse.json({
        success: false,
        message: '❌ Ticket Cancelled',
        details: 'This ticket has been cancelled and is no longer valid',
        scan_result: 'cancelled'
      })
    }

    // Check event timing if we have event details
    if (eventDetails?.date) {
      const eventDate = new Date(eventDetails.date)
      const now = new Date()
      const hoursBefore = 4 // Allow check-in 4 hours before event
      const eventStartTime = new Date(eventDate.getTime() - (hoursBefore * 60 * 60 * 1000))
      
      if (now < eventStartTime) {
        const hoursUntilCheckIn = Math.ceil((eventStartTime.getTime() - now.getTime()) / (1000 * 60 * 60))
        
        return NextResponse.json({
          success: false,
          message: '⏰ Too Early',
          details: `Check-in opens ${hoursBefore} hours before the event. Please come back in ${hoursUntilCheckIn} hours.`,
          scan_result: 'too_early',
          ticket_info: {
            event_date: eventDetails.date,
            event_time: eventDetails.time,
            check_in_opens_at: eventStartTime.toISOString()
          }
        })
      }
    }

    // Valid ticket - mark as used
    const { error: updateError } = await supabase
      .from('tickets')
      .update({
        status: 'used',
        checked_in_at: new Date().toISOString(),
        checked_in_by: user.id
      })
      .eq('id', ticket.id)

    if (updateError) {
      return NextResponse.json({
        success: false,
        message: '❌ Verification Failed',
        details: 'Failed to update ticket status. Please try again.',
        error: updateError.message
      }, { status: 500 })
    }

    // Log successful verification
    await supabase.from('ticket_verifications').insert({
      ticket_id: ticket.id,
      ticket_number: ticketNumber,
      verification_id: verificationId,
      event_id: ticket.event_id,
      scanned_by: user.id,
      scan_result: 'success',
      scan_timestamp: new Date().toISOString(),
      device_info: {
        user_agent: request.headers.get('user-agent'),
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
      }
    })

    // Update event stats
    await supabase.rpc('increment_event_checkins', {
      p_event_id: ticket.event_id
    })

    return NextResponse.json({
      success: true,
      message: '✅ Check-in Successful!',
      details: 'Welcome to the event!',
      scan_result: 'success',
      ticket_info: {
        ticket_number: ticket.ticket_number,
        ticket_type: ticket.ticket_type,
        event_name: eventDetails?.title || 'Predefined Ticket',
        event_date: eventDetails?.date,
        event_time: eventDetails?.time,
        venue: eventDetails?.venue,
        seat_info: ticket.seat_number ? {
          seat_number: ticket.seat_number,
          row_number: ticket.row_number,
          section: ticket.section
        } : null,
        attendee_info: {
          name: ticket.bookings?.user_name || ticket.metadata?.attendeeData?.name || 'Unknown',
          email: ticket.bookings?.user_email || ticket.metadata?.attendeeData?.email || 'Unknown'
        }
      }
    })

  } catch (error) {
    console.error('Error verifying ticket:', error)
    return NextResponse.json(
      { 
        success: false,
        message: '❌ Verification Error',
        details: 'An unexpected error occurred. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Get verification history for a ticket
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const ticketNumber = searchParams.get('ticketNumber')
    const eventId = searchParams.get('eventId')
    
    if (!ticketNumber && !eventId) {
      return NextResponse.json(
        { error: 'Ticket number or event ID is required' },
        { status: 400 }
      )
    }

    let query = supabase
      .from('ticket_verifications')
      .select(`
        *,
        tickets (
          ticket_number,
          ticket_type,
          status
        )
      `)
      .order('scan_timestamp', { ascending: false })

    if (ticketNumber) {
      query = query.eq('ticket_number', ticketNumber)
    }

    if (eventId) {
      query = query.eq('event_id', eventId)
    }

    const { data: verifications, error: queryError } = await query

    if (queryError) {
      return NextResponse.json(
        { error: 'Failed to fetch verification history' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      verifications: verifications || []
    })

  } catch (error) {
    console.error('Error fetching verification history:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}