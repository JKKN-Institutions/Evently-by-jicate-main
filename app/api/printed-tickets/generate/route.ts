import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { encryptTicketDataSync, encryptTicketData } from '@/lib/qr-generator'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { event_id, quantity } = await request.json()
    
    if (!event_id || !quantity || quantity < 1 || quantity > 1000) {
      return NextResponse.json(
        { error: 'Invalid event ID or quantity (1-1000)' },
        { status: 400 }
      )
    }

    // Verify user owns the event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('id, title, date, organizer_id')
      .eq('id', event_id)
      .eq('organizer_id', user.id)
      .single()

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found or access denied' },
        { status: 404 }
      )
    }

    const generatedTickets = []

    // Generate the specified number of tickets
    for (let i = 0; i < quantity; i++) {
      try {
        // Generate event-based ticket code
        let ticketCode: string
        
        try {
          // Try to use the database function first
          const { data: ticketCodeResult, error: codeError } = await supabase
            .rpc('generate_printed_ticket_code', { event_id_param: event_id })

          if (codeError) {
            throw new Error('Database function failed')
          }
          ticketCode = ticketCodeResult
        } catch (dbError) {
          // Fallback to manual generation with event name
          const eventPrefix = event.title
            .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters
            .split(' ')
            .map(word => word.substring(0, 3).toUpperCase()) // Take first 3 chars of each word
            .join('')
            .substring(0, 6) // Limit to 6 characters max
          
          // Get current count of printed tickets for this event
          const { data: existingTickets } = await supabase
            .from('printed_tickets')
            .select('id')
            .eq('event_id', event_id)
          
          const ticketNumber = (existingTickets?.length || 0) + i + 1
          ticketCode = `${eventPrefix}-${ticketNumber.toString().padStart(3, '0')}`
        }

        // Create unique QR data for printed ticket
        const qrData = {
          type: 'printed_ticket',
          ticketCode: ticketCode,
          eventId: event_id,
          eventTitle: event.title,
          generatedAt: new Date().toISOString(),
          generatedBy: user.id,
          // Add unique identifier to prevent duplication
          uniqueId: crypto.randomUUID()
        }

        // Encrypt the QR data
        let encryptedQR: string
        try {
          // Try synchronous encryption first
          encryptedQR = encryptTicketDataSync({
            ticketId: crypto.randomUUID(),
            eventId: event_id,
            bookingId: '', // Not applicable for printed tickets
            userId: user.id,
            ticketNumber: ticketCode,
            ticketType: 'printed',
            eventDate: event.date || new Date().toISOString()
          })
        } catch (syncError) {
          // Fallback to async encryption
          encryptedQR = await encryptTicketData({
            ticketId: crypto.randomUUID(),
            eventId: event_id,
            bookingId: '', // Not applicable for printed tickets
            userId: user.id,
            ticketNumber: ticketCode,
            ticketType: 'printed',
            eventDate: event.date || new Date().toISOString()
          })
        }

        // Insert into database
        const { data: printedTicket, error: insertError } = await supabase
          .from('printed_tickets')
          .insert({
            ticket_code: ticketCode,
            qr_code: encryptedQR,
            event_id: event_id,
            status: 'active',
            metadata: {
              generated_by: user.id,
              generated_at: new Date().toISOString(),
              event_title: event.title,
              batch_id: crypto.randomUUID() // For grouping tickets generated together
            }
          })
          .select()
          .single()

        if (insertError) {
          console.error('Error inserting printed ticket:', insertError)
          continue // Skip this ticket and continue with others
        }

        // Also create entry in qr_codes table for main QR verification API
        const qrHash = require('crypto').createHash('sha256').update(encryptedQR).digest('hex')
        
        const { error: qrCodeError } = await supabase
          .from('qr_codes')
          .insert({
            qr_hash: qrHash,
            qr_data: encryptedQR,
            qr_type: 'printed_ticket',
            event_id: event_id,
            ticket_id: printedTicket.id, // Link to printed ticket
            is_active: true,
            description: `Printed ticket: ${ticketCode}`,
            metadata: {
              ticket_code: ticketCode,
              event_title: event.title,
              generated_by: user.id,
              printed_ticket_id: printedTicket.id
            }
          })

        if (qrCodeError) {
          console.error('Error creating QR code entry:', qrCodeError)
          // Don't fail the ticket generation if QR code entry fails
        }

        generatedTickets.push({
          ...printedTicket,
          event_title: event.title,
          qr_data_url: await generateQRCodeDataURL(encryptedQR)
        })

      } catch (ticketError) {
        console.error(`Error generating ticket ${i + 1}:`, ticketError)
        continue // Skip this ticket and continue with others
      }
    }

    if (generatedTickets.length === 0) {
      return NextResponse.json(
        { error: 'Failed to generate any tickets' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      tickets: generatedTickets,
      message: `Successfully generated ${generatedTickets.length} printed tickets`
    })

  } catch (error) {
    console.error('Error generating printed tickets:', error)
    return NextResponse.json(
      { error: 'Failed to generate printed tickets' },
      { status: 500 }
    )
  }
}

// Helper function to generate QR code data URL
async function generateQRCodeDataURL(data: string): Promise<string> {
  try {
    const QRCode = (await import('qrcode')).default
    return await QRCode.toDataURL(data, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'H'
    })
  } catch (error) {
    console.error('Error generating QR code data URL:', error)
    return ''
  }
}
