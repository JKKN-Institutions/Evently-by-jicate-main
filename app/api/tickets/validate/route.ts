import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decryptTicketData, decryptTicketDataSync } from '@/lib/qr-generator'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user (must be event staff)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { qrCode, eventId } = await request.json()

    if (!qrCode || !eventId) {
      return NextResponse.json(
        { error: 'QR code and event ID are required' },
        { status: 400 }
      )
    }

    // Check if user is event staff
    const { data: staffMember } = await supabase
      .from('event_staff')
      .select('*')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .single()

    if (!staffMember) {
      return NextResponse.json(
        { error: 'You are not authorized to scan tickets for this event' },
        { status: 403 }
      )
    }

    // Try to decrypt QR code with both methods for compatibility
    let qrData = null
    let decryptionErrors = []
    
    // First try the qr-generator method (primary method used for ticket generation)
    try {
      // Try synchronous version first for better performance
      try {
        qrData = decryptTicketDataSync(qrCode)
        console.log('Successfully decrypted QR code using qr-generator sync method')
      } catch (syncError) {
        // Fall back to async version
        qrData = await decryptTicketData(qrCode)
        console.log('Successfully decrypted QR code using qr-generator async method')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      console.log('Failed with qr-generator method:', errorMessage)
      decryptionErrors.push(`qr-generator: ${errorMessage}`)
    }
    
    // If that fails, try the qr-code method (legacy compatibility)
    if (!qrData) {
      try {
        const { decryptQRData } = await import('@/lib/qr-code')
        const qrCodeData = await decryptQRData(qrCode)
        if (qrCodeData) {
          // Convert QRCodeData to TicketData format
          qrData = {
            ticketId: qrCodeData.ticketId,
            eventId: qrCodeData.eventId,
            bookingId: qrCodeData.bookingId,
            userId: '', // Will be filled from database
            ticketNumber: qrCodeData.ticketNumber,
            ticketType: 'general',
            eventDate: new Date().toISOString()
          }
          console.log('Successfully decrypted QR code using qr-code method')
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.log('Failed with qr-code method:', errorMessage)
        decryptionErrors.push(`qr-code: ${errorMessage}`)
      }
    }
    
    // Log all decryption attempts for debugging
    if (!qrData) {
      console.error('QR Code decryption failed with all methods:', {
        qrCodeLength: qrCode.length,
        qrCodePreview: qrCode.substring(0, 50) + '...',
        errors: decryptionErrors
      })
    }
    
    if (!qrData) {
      // Log invalid scan attempt
      await supabase
        .from('check_ins')
        .insert({
          event_id: eventId,
          scanned_by: user.id,
          scan_result: 'invalid',
          device_info: {
            user_agent: request.headers.get('user-agent'),
            timestamp: new Date().toISOString()
          }
        })

      return NextResponse.json({
        success: false,
        message: 'Invalid QR code',
        scan_result: 'invalid'
      })
    }

    // Find ticket
    const { data: ticket } = await supabase
      .from('tickets')
      .select(`
        *,
        bookings (
          user_name,
          user_email,
          user_phone,
          events (
            title,
            date,
            time,
            venue
          )
        )
      `)
      .eq('id', qrData.ticketId)
      .single()

    if (!ticket) {
      return NextResponse.json({
        success: false,
        message: 'Ticket not found',
        scan_result: 'invalid'
      })
    }

    // Check if ticket is for the correct event
    if (ticket.event_id !== eventId) {
      // Log wrong event scan
      await supabase
        .from('check_ins')
        .insert({
          ticket_id: ticket.id,
          event_id: eventId,
          scanned_by: user.id,
          scan_result: 'wrong_event'
        })

      return NextResponse.json({
        success: false,
        message: 'This ticket is for a different event',
        scan_result: 'wrong_event',
        ticket_info: {
          event_title: ticket.bookings?.events?.title
        }
      })
    }

    // Check ticket status
    if (ticket.status === 'used') {
      // Log duplicate scan
      await supabase
        .from('check_ins')
        .insert({
          ticket_id: ticket.id,
          event_id: eventId,
          scanned_by: user.id,
          scan_result: 'already_used'
        })

      return NextResponse.json({
        success: false,
        message: `Ticket already checked in at ${new Date(ticket.checked_in_at).toLocaleString()}`,
        scan_result: 'already_used',
        ticket_info: {
          ticket_number: ticket.ticket_number,
          checked_in_at: ticket.checked_in_at,
          customer_name: ticket.bookings?.user_name
        }
      })
    }

    if (ticket.status === 'cancelled') {
      return NextResponse.json({
        success: false,
        message: 'This ticket has been cancelled',
        scan_result: 'cancelled'
      })
    }

    // Valid ticket - update status
    const { error: updateError } = await supabase
      .from('tickets')
      .update({
        status: 'used',
        checked_in_at: new Date().toISOString(),
        checked_in_by: user.id
      })
      .eq('id', ticket.id)

    if (updateError) {
      console.error('Error updating ticket:', updateError)
      return NextResponse.json(
        { error: 'Failed to update ticket status' },
        { status: 500 }
      )
    }

    // Log successful check-in
    await supabase
      .from('check_ins')
      .insert({
        ticket_id: ticket.id,
        event_id: eventId,
        scanned_by: user.id,
        scan_result: 'success',
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
        customer_name: ticket.bookings?.user_name,
        customer_email: ticket.bookings?.user_email,
        event_title: ticket.bookings?.events?.title,
        seat_number: ticket.seat_number
      }
    })
  } catch (error) {
    console.error('Error validating ticket:', error)
    return NextResponse.json(
      { error: 'Failed to validate ticket' },
      { status: 500 }
    )
  }
}
