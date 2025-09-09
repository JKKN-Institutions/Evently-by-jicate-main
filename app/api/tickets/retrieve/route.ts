import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateQRCodeDataURL } from '@/lib/qr-code'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const bookingId = searchParams.get('bookingId')
    const ticketId = searchParams.get('ticketId')
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Retrieve single ticket by ID
    if (ticketId) {
      const { data: ticket, error } = await supabase
        .from('tickets')
        .select(`
          *,
          bookings (
            *,
            events (
              *,
              ticket_template
            )
          )
        `)
        .eq('id', ticketId)
        .single()

      if (error || !ticket) {
        return NextResponse.json(
          { error: 'Ticket not found' },
          { status: 404 }
        )
      }

      // Verify user owns this ticket
      if (ticket.bookings.user_id !== user.id) {
        return NextResponse.json(
          { error: 'Unauthorized access to this ticket' },
          { status: 403 }
        )
      }

      // Generate QR code image from stored encrypted data
      const qrCodeImage = await generateQRCodeDataURL(ticket.qr_code)

      return NextResponse.json({
        ticket: {
          ...ticket,
          qr_code_image: qrCodeImage,
          event: ticket.bookings.events,
          ticket_template: ticket.bookings.events.ticket_template
        }
      })
    }

    // Retrieve all tickets for a booking
    if (bookingId) {
      const { data: tickets, error } = await supabase
        .from('tickets')
        .select(`
          *,
          bookings (
            *,
            events (
              *,
              ticket_template
            )
          )
        `)
        .eq('booking_id', bookingId)

      if (error) {
        return NextResponse.json(
          { error: 'Failed to retrieve tickets' },
          { status: 500 }
        )
      }

      if (!tickets || tickets.length === 0) {
        return NextResponse.json(
          { error: 'No tickets found for this booking' },
          { status: 404 }
        )
      }

      // Verify user owns these tickets
      if (tickets[0].bookings.user_id !== user.id) {
        return NextResponse.json(
          { error: 'Unauthorized access to these tickets' },
          { status: 403 }
        )
      }

      // Generate QR code images for all tickets
      const ticketsWithQR = await Promise.all(
        tickets.map(async (ticket) => {
          const qrCodeImage = await generateQRCodeDataURL(ticket.qr_code)
          return {
            ...ticket,
            qr_code_image: qrCodeImage,
            event: ticket.bookings.events,
            ticket_template: ticket.bookings.events.ticket_template
          }
        })
      )

      return NextResponse.json({
        tickets: ticketsWithQR
      })
    }

    // Retrieve all tickets for the user
    const { data: userTickets, error: userTicketsError } = await supabase
      .from('tickets')
      .select(`
        *,
        bookings (
          *,
          events (
            *,
            ticket_template
          )
        )
      `)
      .eq('bookings.user_id', user.id)
      .order('created_at', { ascending: false })

    if (userTicketsError) {
      return NextResponse.json(
        { error: 'Failed to retrieve tickets' },
        { status: 500 }
      )
    }

    // Generate QR code images for all user tickets
    const userTicketsWithQR = await Promise.all(
      (userTickets || []).map(async (ticket) => {
        const qrCodeImage = await generateQRCodeDataURL(ticket.qr_code)
        return {
          ...ticket,
          qr_code_image: qrCodeImage,
          event: ticket.bookings.events,
          ticket_template: ticket.bookings.events.ticket_template
        }
      })
    )

    return NextResponse.json({
      tickets: userTicketsWithQR
    })

  } catch (error) {
    console.error('Error retrieving tickets:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve tickets' },
      { status: 500 }
    )
  }
}