import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import QRCode from 'qrcode'

export async function POST(req: NextRequest) {
  try {
    const { bookingId } = await req.json()
    
    if (!bookingId) {
      return NextResponse.json(
        { error: 'Booking ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Fetch booking details
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        events (
          *,
          profiles:organizer_id (
            full_name,
            email
          )
        )
      `)
      .eq('id', bookingId)
      .eq('user_id', user.id) // Ensure user owns this booking
      .single()

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      )
    }

    // Generate QR code
    const qrData = `${process.env.NEXT_PUBLIC_APP_URL}/verify/${bookingId}`
    const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
      width: 200,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      }
    })

    // Format ticket data
    const ticketData = {
      // Event Information
      eventName: booking.events.title,
      eventDate: new Date(booking.events.date).toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      eventTime: booking.events.time,
      venue: booking.events.venue,
      location: booking.events.location,
      
      // Ticket Information
      ticketNumber: `TKT-${booking.id.slice(0, 8).toUpperCase()}`,
      ticketType: booking.ticket_type || 'General',
      registrationId: `REG-${booking.id.slice(-8).toUpperCase()}`,
      
      // Attendee Information
      attendeeName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Guest',
      attendeeEmail: user.email,
      
      // Pricing
      price: booking.total_amount,
      paymentStatus: booking.payment_status,
      paymentId: booking.payment_id,
      
      // QR Code
      qrCode: qrCodeDataUrl,
      
      // Organizer
      organizerName: booking.events.profiles?.full_name || 'Event Organizer',
      organizerEmail: booking.events.profiles?.email,
      
      // Security
      verificationUrl: qrData
    }

    return NextResponse.json({ 
      success: true, 
      ticket: ticketData 
    })
  } catch (error) {
    console.error('Error generating ticket:', error)
    return NextResponse.json(
      { error: 'Failed to generate ticket' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const bookingId = searchParams.get('bookingId')
  
  if (!bookingId) {
    return NextResponse.json(
      { error: 'Booking ID is required' },
      { status: 400 }
    )
  }

  // Redirect to the ticket page
  return NextResponse.redirect(new URL(`/tickets/${bookingId}`, req.url))
}