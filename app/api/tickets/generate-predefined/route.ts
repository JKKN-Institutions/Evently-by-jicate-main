import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import QRCode from 'qrcode'
import { createHash } from 'crypto'
import { generateTicketNumber, encryptTicketData, type TicketData } from '@/lib/qr-generator'

export async function POST(request: NextRequest) {
  try {
    console.log('Generate predefined ticket API called')
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('Auth error:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    console.log('Request body:', body)
    
    const { 
      eventId, 
      attendeeData, 
      predefinedTicketUrl,
      qrPosition = { x: 50, y: 50, size: 100 }
    } = body

    if (!attendeeData || !predefinedTicketUrl) {
      console.error('Missing required fields:', { attendeeData: !!attendeeData, predefinedTicketUrl: !!predefinedTicketUrl })
      return NextResponse.json(
        { error: 'Missing required fields: attendeeData and predefinedTicketUrl are required' },
        { status: 400 }
      )
    }

    // Get event details if eventId is provided and valid
    let event = null
    if (eventId && !eventId.startsWith('EVT-')) {
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single()

      if (eventError) {
        console.log('Event not found, proceeding without event:', eventError)
      } else {
        event = eventData
      }
    }
    
    // Use default event data if no event found
    if (!event) {
      event = {
        id: eventId,
        title: 'Event',
        date: new Date().toISOString(),
        venue: 'Venue',
        price: 0
      }
    }

    // Generate tickets with QR codes
    const tickets = []
    
    for (const attendee of attendeeData) {
      // Generate unique ticket number using the standard format
      const ticketNumber = generateTicketNumber(eventId || 'PRED')
      const ticketId = `PRED-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      // Create structured ticket data for verification
      const ticketData: TicketData = {
        ticketId,
        eventId: eventId || 'predefined-event',
        bookingId: `PRED-${Date.now()}`,
        userId: user.id,
        ticketNumber,
        ticketType: attendee.ticketType || 'Bronze',
        eventDate: event.date,
        validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year validity
      }
      
      // Generate encrypted QR data for verification
      const encryptedQrData = await encryptTicketData(ticketData)
      
      // Create QR data for enhanced verification (compatible with verify-enhanced)
      const enhancedQrData = {
        ticketNumber,
        verificationId: createHash('sha256').update(`${ticketNumber}-${ticketId}-${user.id}`).digest('hex')
      }
      
      // Generate QR code buffer with encrypted data
      const qrCodeBuffer = await QRCode.toBuffer(encryptedQrData, {
        width: qrPosition.size,
        margin: 0,
        errorCorrectionLevel: 'H'
      })
      
      // Also generate a simpler QR for basic verification
      const simpleQrHash = createHash('sha256').update(encryptedQrData).digest('hex')

      // Process the predefined ticket template
      let ticketImageUrl = predefinedTicketUrl
      
      // If the template is a base64 image, overlay the QR code
      if (predefinedTicketUrl.startsWith('data:image')) {
        try {
          // Dynamic import of sharp to avoid build issues
          const sharp = (await import('sharp')).default
          
          // Extract base64 data
          const base64Data = predefinedTicketUrl.split(',')[1]
          const templateBuffer = Buffer.from(base64Data, 'base64')
          
          // Overlay QR code on template using sharp
          const compositeImage = await sharp(templateBuffer)
            .composite([
              {
                input: qrCodeBuffer,
                left: qrPosition.x,
                top: qrPosition.y
              }
            ])
            .toBuffer()
          
          // Convert back to base64
          const base64Result = compositeImage.toString('base64')
          ticketImageUrl = `data:image/png;base64,${base64Result}`
        } catch (error) {
          console.error('Error overlaying QR code:', error)
          // Fall back to template without QR if processing fails
        }
      }

      // Create a dummy booking for predefined tickets to satisfy foreign key constraints
      const { data: dummyBooking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          event_id: eventId === 'EVT-' || !eventId ? null : eventId,
          user_id: user.id,
          user_name: attendee.name,
          user_email: attendee.email || `${attendee.name.toLowerCase().replace(/\s+/g, '.')}@predefined.local`,
          booking_number: `PRED-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          total_amount: 0, // Free predefined ticket
          payment_status: 'completed',
          booking_status: 'confirmed',
          metadata: {
            type: 'predefined_ticket',
            generatedBy: user.id,
            attendeeData: attendee
          }
        })
        .select()
        .single()

      if (bookingError) {
        console.error('Error creating dummy booking:', bookingError)
        // Try to continue without booking if there's an error
      }

      const bookingId = dummyBooking?.id || ticketData.bookingId

      // Save ticket to tickets table for verification compatibility
      const { data: ticketRecord, error: ticketError } = await supabase
        .from('tickets')
        .insert({
          ticket_number: ticketNumber,
          event_id: eventId === 'EVT-' || !eventId ? null : eventId,
          booking_id: bookingId,
          ticket_type: attendee.ticketType || 'Bronze',
          status: 'valid',
          qr_code: JSON.stringify(enhancedQrData), // Store enhanced QR data for verify-enhanced
          metadata: {
            ticketGenerationType: 'predefined',
            encryptedQrData,
            ticketData,
            attendeeData: attendee,
            bookingId: bookingId,
            generatedAt: new Date().toISOString(),
            generatedBy: user.id,
            verificationId: enhancedQrData.verificationId
          }
        })
        .select()
        .single()

      if (ticketError) {
        console.error('Error creating main ticket:', ticketError)
        continue
      }

      // Also save to predefined_tickets table for UI compatibility
      const { data: predefinedTicket, error: predefinedError } = await supabase
        .from('predefined_tickets')
        .insert({
          name: attendee.name,
          description: `Predefined ticket for ${attendee.name}`,
          template_url: ticketImageUrl,
          qr_position: qrPosition,
          ticket_type: attendee.ticketType || 'Bronze',
          event_id: eventId === 'EVT-' || !eventId ? null : eventId,
          metadata: {
            ticketGenerationType: 'predefined',
            ticketId: ticketRecord.id,
            ticketNumber,
            attendeeData: attendee,
            generatedAt: new Date().toISOString(),
            generatedBy: user.id
          }
        })
        .select()
        .single()

      if (predefinedError) {
        console.error('Error creating predefined ticket:', predefinedError)
      }

      // Store QR code in qr_codes table for basic verification
      const { error: qrError } = await supabase
        .from('qr_codes')
        .insert({
          qr_hash: simpleQrHash,
          qr_data: encryptedQrData,
          qr_type: 'ticket',
          event_id: eventId === 'EVT-' || !eventId ? null : eventId,
          ticket_id: ticketRecord.id,
          description: `QR code for predefined ticket ${ticketNumber}`,
          is_active: true,
          expires_at: ticketData.validUntil,
          metadata: {
            ticketNumber,
            attendeeName: attendee.name,
            ticketType: attendee.ticketType || 'Bronze'
          }
        })

      if (qrError) {
        console.error('Error storing QR code:', qrError)
      }

      tickets.push({
        id: ticketRecord.id,
        predefined_id: predefinedTicket?.id,
        ticket_number: ticketNumber,
        ticketUrl: ticketImageUrl,
        attendee_name: attendee.name,
        attendee_email: attendee.email,
        ticket_type: attendee.ticketType || 'Bronze',
        status: 'valid',
        qrData: encryptedQrData,
        qr_code: JSON.stringify(enhancedQrData),
        verificationId: enhancedQrData.verificationId,
        metadata: {
          ticketGenerationType: 'predefined',
          canVerifyWith: ['qr-verify', 'verify-enhanced'],
          qrHash: simpleQrHash
        }
      })
    }

    return NextResponse.json({
      success: true,
      tickets,
      message: `Generated ${tickets.length} tickets with predefined template`
    })

  } catch (error) {
    console.error('Error generating predefined tickets:', error)
    return NextResponse.json(
      { error: 'Failed to generate tickets' },
      { status: 500 }
    )
  }
}

// GET endpoint to retrieve predefined ticket for an event
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const eventId = searchParams.get('eventId')
    const ticketId = searchParams.get('ticketId')

    if (!eventId && !ticketId) {
      return NextResponse.json(
        { error: 'Event ID or Ticket ID required' },
        { status: 400 }
      )
    }

    let query = supabase
      .from('predefined_tickets')
      .select('*')
      
    if (ticketId) {
      query = query.eq('metadata->>ticketId', ticketId)
    } else {
      query = query.eq('event_id', eventId)
    }

    const { data: tickets, error } = await query

    if (error) {
      console.error('Error fetching tickets:', error)
      return NextResponse.json(
        { error: 'Failed to fetch tickets' },
        { status: 500 }
      )
    }

    return NextResponse.json({ tickets })

  } catch (error) {
    console.error('Error in GET tickets:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}