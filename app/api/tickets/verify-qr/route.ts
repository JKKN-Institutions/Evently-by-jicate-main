import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decryptQRData } from '@/lib/qr-code'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login to verify tickets' },
        { status: 401 }
      )
    }

    const { encryptedQRCode, eventId } = await request.json()
    
    if (!encryptedQRCode) {
      return NextResponse.json(
        { error: 'QR code data is required' },
        { status: 400 }
      )
    }

    // Decrypt QR code data
    const qrData = await decryptQRData(encryptedQRCode)
    
    if (!qrData) {
      return NextResponse.json(
        { error: 'Invalid QR code - Could not decrypt' },
        { status: 400 }
      )
    }

    // Retrieve ticket from database
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select(`
        *,
        bookings (
          *,
          events (
            *,
            organizer_id
          )
        )
      `)
      .eq('id', qrData.ticketId)
      .eq('ticket_number', qrData.ticketNumber)
      .single()

    if (ticketError || !ticket) {
      return NextResponse.json({
        success: false,
        message: 'Invalid ticket - Not found in system',
        scan_result: 'invalid'
      }, { status: 404 })
    }

    // Check if user is authorized to verify this ticket
    const isOrganizer = ticket.bookings.events.organizer_id === user.id
    
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
        message: 'You are not authorized to verify tickets for this event',
        scan_result: 'unauthorized'
      }, { status: 403 })
    }

    // Verify event ID matches (if provided)
    if (eventId && ticket.event_id !== eventId) {
      // Log the scan attempt
      await supabase.from('check_ins').insert({
        ticket_id: ticket.id,
        event_id: eventId,
        scanned_by: user.id,
        scan_result: 'wrong_event',
        device_info: {
          user_agent: request.headers.get('user-agent'),
          timestamp: new Date().toISOString()
        }
      })

      return NextResponse.json({
        success: false,
        message: 'This ticket is for a different event',
        scan_result: 'wrong_event',
        ticket_info: {
          event_name: ticket.bookings.events.title,
          correct_event_id: ticket.event_id
        }
      })
    }


    // Update scan count for the ticket
    await supabase
      .from('tickets')
      .update({
        scan_count: (ticket.scan_count || 0) + 1,
        first_scanned_at: ticket.first_scanned_at || new Date().toISOString(),
        last_scanned_at: new Date().toISOString()
      })
      .eq('id', ticket.id)

    // Check ticket status
    if (ticket.status === 'used') {
      // Log the scan attempt in both tables

      await supabase.from('check_ins').insert({
        ticket_id: ticket.id,
        event_id: ticket.event_id,
        scanned_by: user.id,
        scan_result: 'already_used',
        device_info: {
          user_agent: request.headers.get('user-agent'),
          timestamp: new Date().toISOString()
        }
      })

      
      await supabase.from('ticket_scan_logs').insert({
        ticket_id: ticket.id,
        ticket_number: ticket.ticket_number,
        event_id: ticket.event_id,
        scan_type: 'check_in',
        scan_result: 'already_used',
        scanned_by: user.id,
        device_info: {
          user_agent: request.headers.get('user-agent')
        }
      })


      return NextResponse.json({
        success: false,
        message: `Ticket already checked in at ${new Date(ticket.checked_in_at).toLocaleString()}`,
        scan_result: 'already_used',
        ticket_info: {
          ticket_number: ticket.ticket_number,
          checked_in_at: ticket.checked_in_at,
          checked_in_by: ticket.checked_in_by,
          attendee_name: ticket.metadata?.user_name
        }
      })
    }

    if (ticket.status === 'cancelled') {

      // Log the scan attempt in both tables
      await supabase.from('ticket_scan_logs').insert({
        ticket_id: ticket.id,
        ticket_number: ticket.ticket_number,
        event_id: ticket.event_id,
        scan_type: 'verification',
        scan_result: 'invalid',
        scanned_by: user.id,
        error_message: 'Ticket cancelled',
        device_info: {
          user_agent: request.headers.get('user-agent')
        }
      })
      

      await supabase.from('check_ins').insert({
        ticket_id: ticket.id,
        event_id: ticket.event_id,
        scanned_by: user.id,
        scan_result: 'invalid',
        device_info: {
          user_agent: request.headers.get('user-agent'),
          timestamp: new Date().toISOString()
        }
      })

      return NextResponse.json({
        success: false,
        message: 'This ticket has been cancelled',
        scan_result: 'cancelled'
      })
    }

    if (ticket.status === 'expired') {

      // Log the scan attempt in both tables
      await supabase.from('ticket_scan_logs').insert({
        ticket_id: ticket.id,
        ticket_number: ticket.ticket_number,
        event_id: ticket.event_id,
        scan_type: 'verification',
        scan_result: 'expired',
        scanned_by: user.id,
        device_info: {
          user_agent: request.headers.get('user-agent')
        }
      })
      

      await supabase.from('check_ins').insert({
        ticket_id: ticket.id,
        event_id: ticket.event_id,
        scanned_by: user.id,
        scan_result: 'expired',
        device_info: {
          user_agent: request.headers.get('user-agent'),
          timestamp: new Date().toISOString()
        }
      })

      return NextResponse.json({
        success: false,
        message: 'This ticket has expired',
        scan_result: 'expired'
      })
    }

    // Check event date (optional - warn if event hasn't started yet)
    const eventDate = new Date(ticket.bookings.events.date)
    const now = new Date()
    const hoursBefore = 4 // Allow check-in 4 hours before event
    const eventStartTime = new Date(eventDate.getTime() - (hoursBefore * 60 * 60 * 1000))
    
    if (now < eventStartTime) {
      const hoursUntilCheckIn = Math.ceil((eventStartTime.getTime() - now.getTime()) / (1000 * 60 * 60))
      
      return NextResponse.json({
        success: false,
        message: `Check-in opens ${hoursBefore} hours before the event. Please come back in ${hoursUntilCheckIn} hours.`,
        scan_result: 'too_early',
        ticket_info: {
          event_date: ticket.bookings.events.date,
          event_time: ticket.bookings.events.time,
          check_in_opens_at: eventStartTime.toISOString()
        }
      })
    }


    // Valid ticket - mark as used and update scan tracking

    const { error: updateError } = await supabase
      .from('tickets')
      .update({
        status: 'used',

        scan_count: (ticket.scan_count || 0) + 1,
        first_scanned_at: ticket.first_scanned_at || new Date().toISOString(),
        last_scanned_at: new Date().toISOString(),

        checked_in_at: new Date().toISOString(),
        checked_in_by: user.id
      })
      .eq('id', ticket.id)

    if (updateError) {
      return NextResponse.json({
        success: false,
        message: 'Failed to update ticket status',
        error: updateError.message
      }, { status: 500 })
    }


    // Log successful check-in in both tables for complete tracking

    await supabase.from('check_ins').insert({
      ticket_id: ticket.id,
      event_id: ticket.event_id,
      scanned_by: user.id,
      scan_result: 'success',
      device_info: {
        user_agent: request.headers.get('user-agent'),
        timestamp: new Date().toISOString()
      }
    })

    
    await supabase.from('ticket_scan_logs').insert({
      ticket_id: ticket.id,
      ticket_number: ticket.ticket_number,
      event_id: ticket.event_id,
      scan_type: 'check_in',
      scan_result: 'success',
      scanned_by: user.id,
      scanner_name: user.email || 'Admin',
      device_info: {
        user_agent: request.headers.get('user-agent'),
        timestamp: new Date().toISOString()
      }
    })


    return NextResponse.json({
      success: true,
      message: 'Check-in successful!',
      scan_result: 'success',
      ticket_info: {
        ticket_number: ticket.ticket_number,
        ticket_type: ticket.ticket_type,
        seat_number: ticket.seat_number,
        attendee_name: ticket.metadata?.user_name,
        attendee_email: ticket.metadata?.user_email,
        event_name: ticket.bookings.events.title,
        event_date: ticket.bookings.events.date,
        event_time: ticket.bookings.events.time,
        venue: ticket.bookings.events.venue
      }
    })

  } catch (error) {
    console.error('Error verifying ticket:', error)
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to verify ticket',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}