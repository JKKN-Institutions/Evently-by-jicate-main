import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateQRCode, generateTicketNumber, TicketData } from '@/lib/qr-generator'
import { encryptQRData, generateQRCodeDataURL, QRCodeData } from '@/lib/qr-code'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user profile with role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()
    
    const userRole = profile?.role || 'user'
    const userName = profile?.full_name || 'Guest'

    const { bookingId } = await request.json()
    
    if (!bookingId) {
      return NextResponse.json(
        { error: 'Booking ID is required' },
        { status: 400 }
      )
    }

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        *,
        events (
          *,
          ticket_template
        ),
        booking_seats (
          seat_id,
          attendee_name,
          attendee_email,
          event_seats (
            seat_number,
            row_number,
            section,
            seat_type,
            zone
          )
        )
      `)
      .eq('id', bookingId)
      .eq('user_id', user.id)
      .single()

    if (bookingError || !booking) {
      return NextResponse.json(
        { error: 'Booking not found' },
        { status: 404 }
      )
    }

    if (booking.payment_status !== 'completed') {
      return NextResponse.json(
        { error: 'Payment not completed for this booking' },
        { status: 400 }
      )
    }

    const { data: existingTickets, error: ticketsError } = await supabase
      .from('tickets')
      .select('*')
      .eq('booking_id', bookingId)

    if (existingTickets && existingTickets.length > 0) {
      // Regenerate QR codes for existing tickets with proper encryption
      const ticketsWithQR = await Promise.all(
        existingTickets.map(async (ticket) => {
          // Create QR data with encryption
          const qrData: QRCodeData = {
            ticketId: ticket.id,
            eventId: ticket.event_id,
            bookingId: ticket.booking_id,
            ticketNumber: ticket.ticket_number,
            timestamp: Date.now()
          }
          
          // Encrypt QR data
          const encryptedData = await encryptQRData(qrData)
          const qrCodeImage = await generateQRCodeDataURL(encryptedData)
          
          return {
            ...ticket,
            qr_code_image: qrCodeImage,
            event: booking.events,
            encrypted_qr: encryptedData
          }
        })
      )
      
      return NextResponse.json({ 
        tickets: ticketsWithQR,
        message: 'Tickets already exist for this booking' 
      })
    }

    // Generate new tickets
    const tickets = []
    const ticketTemplate = booking.events.ticket_template || {}
    const allocatedSeats = booking.booking_seats || []
    
    for (let i = 0; i < booking.quantity; i++) {
      const ticketNumber = generateTicketNumber(booking.event_id)
      const ticketId = crypto.randomUUID()
      
      // Get seat information if available
      const seatInfo = allocatedSeats[i]
      const seatNumber = seatInfo?.event_seats?.seat_number || 
                        (ticketTemplate.seatAllocation === 'specific' ? `${i + 1}` : null)
      const rowNumber = seatInfo?.event_seats?.row_number || null
      const section = seatInfo?.event_seats?.section || null
      const zone = seatInfo?.event_seats?.zone || null
      
      // Create QR code data with seat information
      const qrData: QRCodeData = {
        ticketId: ticketId,
        eventId: booking.event_id,
        bookingId: bookingId,
        ticketNumber: ticketNumber,
        seatNumber: seatNumber,
        section: section,
        row: rowNumber,
        timestamp: Date.now()
      }
      
      // Encrypt QR data
      const encryptedQRData = await encryptQRData(qrData)
      const qrCodeImage = await generateQRCodeDataURL(encryptedQRData)
      
      // Determine ticket type (from template or default)
      const ticketType = ticketTemplate.ticketTypes?.[0]?.name || 'General Admission'
      
      // Create comprehensive metadata including template data
      const metadata = {
        // User information
        user_name: booking.user_name || userName,
        user_email: booking.user_email || user.email,
        user_phone: booking.user_phone || '',
        user_role: userRole,
        
        // Seat information
        seat_number: seatNumber,
        row_number: rowNumber,
        section: section,
        zone: zone,
        seat_id: seatInfo?.seat_id || null,
        
        // Event information
        event_title: booking.events.title,
        event_date: booking.events.date,
        event_time: booking.events.time,
        venue: booking.events.venue,
        location: booking.events.location,
        
        // Ticket template information
        theme_color: ticketTemplate.themeColor || '#0b6d41',
        secondary_color: ticketTemplate.secondaryColor || '#15a862',
        layout_style: ticketTemplate.layoutStyle || 'modern',
        
        // Security features
        watermark_enabled: ticketTemplate.enableWatermark || true,
        hologram_enabled: ticketTemplate.enableHologram || false,
        verification_method: ticketTemplate.verificationMethod || 'qr',
        
        // Pricing information
        price: booking.events.price || 0,
        currency: ticketTemplate.currency || 'INR',
        payment_status: booking.payment_status,
        
        // Terms and conditions
        refund_policy: ticketTemplate.refundPolicy || 'no-refunds',
        age_restriction: ticketTemplate.ageRestriction || null,
        id_proof_required: ticketTemplate.idProofRequired || true,
        non_transferable: ticketTemplate.nonTransferable || true,
        additional_terms: ticketTemplate.additionalTerms || [],
        
        // Organization information
        organizer_name: ticketTemplate.organizerName || booking.events.organizer_name || '',
        organizer_contact: ticketTemplate.organizerContact || '',
        organizer_email: ticketTemplate.organizerEmail || '',
        
        // Social media
        social_media: ticketTemplate.socialMedia || {},
        
        // Generation information
        generated_at: new Date().toISOString(),
        generated_by: user.id,
        qr_encrypted: encryptedQRData
      }
      
      const { data: newTicket, error: ticketError } = await supabase
        .from('tickets')
        .insert({
          id: ticketId,
          booking_id: bookingId,
          event_id: booking.event_id,
          ticket_number: ticketNumber,
          qr_code: encryptedQRData, // Store encrypted QR data
          status: 'valid',
          ticket_type: ticketType,
          seat_number: seatNumber,
          row_number: rowNumber,
          section: section,
          zone: zone,
          metadata: metadata
        })
        .select()
        .single()

      if (ticketError) {
        console.error('Error creating ticket:', ticketError)
        continue
      }

      tickets.push({
        ...newTicket,
        qr_code_image: qrCodeImage,
        event: booking.events,
        ticket_template: ticketTemplate
      })
    }

    return NextResponse.json({ 
      tickets,
      message: 'Tickets generated successfully' 
    })

  } catch (error) {
    console.error('Error generating tickets:', error)
    return NextResponse.json(
      { error: 'Failed to generate tickets' },
      { status: 500 }
    )
  }
}