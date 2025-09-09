import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import JSZip from 'jszip'

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

    const { ticket_ids } = await request.json()
    
    if (!ticket_ids || !Array.isArray(ticket_ids) || ticket_ids.length === 0) {
      return NextResponse.json(
        { error: 'Invalid ticket IDs' },
        { status: 400 }
      )
    }

    // Get tickets with event information
    const { data: tickets, error: ticketsError } = await supabase
      .from('printed_tickets')
      .select(`
        *,
        events!inner (
          id,
          title,
          date,
          venue,
          organizer_id
        )
      `)
      .in('id', ticket_ids)

    if (ticketsError || !tickets) {
      return NextResponse.json(
        { error: 'Failed to fetch tickets' },
        { status: 500 }
      )
    }

    // Verify user owns all the events
    const unauthorizedTickets = tickets.filter(
      ticket => ticket.events?.organizer_id !== user.id
    )

    if (unauthorizedTickets.length > 0) {
      return NextResponse.json(
        { error: 'Access denied to some tickets' },
        { status: 403 }
      )
    }

    // Create ZIP file with QR codes
    const zip = new JSZip()
    
    for (const ticket of tickets) {
      try {
        // Generate QR code image
        const qrDataUrl = await generateQRCodeDataURL(ticket.qr_code)
        
        if (qrDataUrl) {
          // Convert data URL to buffer
          const base64Data = qrDataUrl.split(',')[1]
          const buffer = Buffer.from(base64Data, 'base64')
          
          // Add to ZIP with descriptive filename
          const filename = `${ticket.ticket_code}_${ticket.events?.title?.replace(/[^a-zA-Z0-9]/g, '_')}.png`
          zip.file(filename, buffer)
          
          // Also create a text file with ticket details
          const ticketInfo = `
Ticket Code: ${ticket.ticket_code}
Event: ${ticket.events?.title}
Date: ${ticket.events?.date ? new Date(ticket.events.date).toLocaleDateString() : 'TBD'}
Venue: ${ticket.events?.venue || 'TBD'}
Status: ${ticket.status}
Generated: ${new Date(ticket.created_at).toLocaleString()}

QR Code Data: ${ticket.qr_code}

Instructions:
1. Print this QR code on your physical tickets
2. Use the Ticket Verifier page to scan during the event
3. Each QR code can only be used once
          `.trim()
          
          zip.file(`${ticket.ticket_code}_info.txt`, ticketInfo)
        }
      } catch (error) {
        console.error(`Error processing ticket ${ticket.ticket_code}:`, error)
        // Continue with other tickets
      }
    }

    // Generate ZIP buffer
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })
    
    // Return ZIP file
    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="printed-tickets-${new Date().toISOString().split('T')[0]}.zip"`
      }
    })

  } catch (error) {
    console.error('Error downloading printed tickets:', error)
    return NextResponse.json(
      { error: 'Failed to download tickets' },
      { status: 500 }
    )
  }
}

// Helper function to generate QR code data URL
async function generateQRCodeDataURL(data: string): Promise<string> {
  try {
    const QRCode = (await import('qrcode')).default
    return await QRCode.toDataURL(data, {
      width: 512,
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
