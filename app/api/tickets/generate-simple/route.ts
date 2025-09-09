import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateQRCode, generateTicketNumber } from '@/lib/qr-generator'
import { v4 as uuidv4 } from 'uuid'
import { createHash } from 'crypto'

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

    const { eventId, quantity = 1, template } = await request.json()
    
    if (!eventId || quantity < 1 || quantity > 10) {
      return NextResponse.json(
        { error: 'Invalid event ID or quantity' },
        { status: 400 }
      )
    }

    // Get event details
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single()

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      )
    }

    // Get user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, name')
      .eq('id', user.id)
      .single()

    const userName = profile?.name || user.email?.split('@')[0] || 'Guest'
    const generatedTickets = []

    console.log(`Generating ${quantity} simple tickets for event ${eventId}`)

    for (let i = 0; i < quantity; i++) {
      try {
        const ticketNumber = generateTicketNumber(eventId)
        const ticketId = uuidv4()
        
        // Generate QR code data - use simple ticket number (same as bulk generation)
        const qrData = ticketNumber
        
        // Generate QR hash for verification
        const qrHash = createHash('sha256').update(qrData).digest('hex')

        // Create a simple booking first (minimal data to avoid triggers)
        const { data: booking } = await supabase
          .from('bookings')
          .insert({
            event_id: eventId,
            user_id: user.id,
            quantity: 1,
            total_amount: 0,
            payment_status: 'completed',
            payment_id: `SIMPLE_${ticketNumber}`,
            user_name: userName,
            user_email: user.email || `${userName}@ticket.com`,
            user_phone: '0000000000'
          })
          .select()
          .single()

        if (!booking) {
          console.error(`Failed to create booking for ticket ${i + 1}`)
          continue
        }
        
        // Store QR code in qr_codes table for verification
        const { data: qrCode, error: qrError } = await supabase
          .from('qr_codes')
          .insert({
            qr_data: qrData,
            qr_hash: qrHash,
            qr_type: 'ticket',
            event_id: eventId,
            ticket_id: ticketId,
            is_active: true,
            description: `Simple ticket: ${ticketNumber}`,
            metadata: {
              ticketNumber: ticketNumber,
              generatedBy: user.id,
              mode: 'simple'
            }
          })
          .select()
          .single()
        
        if (qrError) {
          console.error(`Error creating QR code for ticket ${i + 1}:`, qrError)
          // Continue anyway, ticket might still work
        }

        // Create ticket with minimal required fields only
        const ticketData = {
          id: ticketId,
          booking_id: booking.id,
          event_id: eventId,
          ticket_number: ticketNumber,
          qr_code: qrData, // Store the actual QR data
          status: 'valid',

          ticket_type: template?.ticketType || 'Bronze'

        }

        // Try to insert the ticket directly
        const { data: ticket, error: ticketError } = await supabase
          .from('tickets')
          .insert(ticketData)
          .select()
          .single()

        if (ticketError) {
          console.error(`Error creating simple ticket ${i + 1}:`, ticketError)
          
          // If it's an RLS error on stats, the ticket might still be created
          if (ticketError.message?.includes('event_verification_stats')) {
            console.log('Stats RLS error - checking if ticket was created...')
            
            // Check if ticket was created anyway
            const { data: checkTicket } = await supabase
              .from('tickets')
              .select('*')
              .eq('ticket_number', ticketNumber)
              .single()
            
            if (checkTicket) {
              console.log(`Ticket ${i + 1} was created despite stats error`)
              
              // Update QR code with actual ticket ID if needed
              if (qrCode?.id && checkTicket.id) {
                await supabase
                  .from('qr_codes')
                  .update({ ticket_id: checkTicket.id })
                  .eq('id', qrCode.id)
              }
              
              // Try to update stats using the safe function
              await supabase.rpc('safe_update_event_stats', { p_event_id: eventId })
              
              generatedTickets.push({
                ...checkTicket,
                event_title: event.title,
                qr_data: qrData,
                qr_hash: qrHash
              })
            }
          } else {
            // Check if ticket was created anyway for other errors
            const { data: checkTicket } = await supabase
              .from('tickets')
              .select('*')
              .eq('ticket_number', ticketNumber)
              .single()
            
            if (checkTicket) {
              console.log(`Simple ticket ${i + 1} found after error`)
              
              // Update QR code with actual ticket ID if needed
              if (qrCode?.id && checkTicket.id) {
                await supabase
                  .from('qr_codes')
                  .update({ ticket_id: checkTicket.id })
                  .eq('id', qrCode.id)
              }
              
              generatedTickets.push({
                ...checkTicket,
                event_title: event.title,
                qr_data: qrData,
                qr_hash: qrHash
              })
            }
          }
        } else if (ticket) {
          console.log(`Simple ticket ${i + 1} created successfully`)
          
          // Update QR code with actual ticket ID
          if (qrCode?.id && ticket.id) {
            await supabase
              .from('qr_codes')
              .update({ ticket_id: ticket.id })
              .eq('id', qrCode.id)
          }
          
          // Try to update stats using the safe function
          await supabase.rpc('safe_update_event_stats', { p_event_id: eventId }).catch(err => {
            console.log('Stats update failed but ticket created:', err.message)
          })
          
          generatedTickets.push({
            ...ticket,
            event_title: event.title,
            qr_data: qrData,
            qr_hash: qrHash
          })
        }

      } catch (error) {
        console.error(`Unexpected error for ticket ${i + 1}:`, error)
        continue
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
      message: `Successfully generated ${generatedTickets.length} tickets (simple mode)`
    })

  } catch (error) {
    console.error('Error in simple ticket generation:', error)
    return NextResponse.json(
      { error: 'Failed to generate tickets' },
      { status: 500 }
    )
  }
}