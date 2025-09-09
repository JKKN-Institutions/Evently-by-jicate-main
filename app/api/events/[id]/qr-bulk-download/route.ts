import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import QRCode from 'qrcode'
import JSZip from 'jszip'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get event details
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single()

    if (eventError || !event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      )
    }

    // Check authorization - must be event organizer or admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const userRole = profile?.role || 'user'
    const isOrganizer = event.organizer_id === user.id
    const isAdmin = userRole === 'admin'

    if (!isOrganizer && !isAdmin) {
      return NextResponse.json(
        { error: 'Not authorized to download QR codes for this event' },
        { status: 403 }
      )
    }

    // Get all tickets for this event
    const { data: tickets, error: ticketsError } = await supabase
      .from('tickets')
      .select(`
        *,
        bookings (
          user_name,
          user_email,
          user_phone
        )
      `)
      .eq('event_id', id)
      .eq('status', 'valid')
      .order('ticket_number')

    if (ticketsError) {
      return NextResponse.json(
        { error: 'Failed to fetch tickets' },
        { status: 500 }
      )
    }

    if (!tickets || tickets.length === 0) {
      return NextResponse.json(
        { error: 'No valid tickets found for this event' },
        { status: 404 }
      )
    }

    // Get format and size from query params
    const url = new URL(request.url)
    const format = url.searchParams.get('format') || 'png'
    const size = parseInt(url.searchParams.get('size') || '512')
    const includeDetails = url.searchParams.get('details') === 'true'

    const zip = new JSZip()
    const qrFolder = zip.folder('qr-codes')!
    
    // Generate QR codes for each ticket
    for (const ticket of tickets) {
      const validationUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/tickets/validate?ticket=${ticket.id}&code=${encodeURIComponent(ticket.qr_code)}`

      const qrOptions = {
        errorCorrectionLevel: 'H' as const,
        type: format === 'svg' ? 'svg' as const : 'image/png' as const,
        quality: 0.92,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: size
      }

      let qrData: string | Buffer
      let filename: string

      if (format === 'svg') {
        qrData = await QRCode.toString(validationUrl, { ...qrOptions, type: 'svg' })
        filename = `${ticket.ticket_number}.svg`
      } else {
        qrData = await QRCode.toBuffer(validationUrl, qrOptions)
        filename = `${ticket.ticket_number}.png`
      }

      qrFolder.file(filename, qrData)

      // Add ticket details if requested
      if (includeDetails) {
        const ticketInfo = {
          ticket_number: ticket.ticket_number,
          ticket_id: ticket.id,
          customer_name: ticket.bookings?.user_name,
          customer_email: ticket.bookings?.user_email,
          customer_phone: ticket.bookings?.user_phone,
          event_title: event.title,
          event_date: event.date,
          event_time: event.time,
          venue: event.venue,
          status: ticket.status,
          created_at: ticket.created_at
        }
        
        qrFolder.file(`${ticket.ticket_number}.json`, JSON.stringify(ticketInfo, null, 2))
      }
    }

    // Add event summary
    const eventSummary = {
      event_id: event.id,
      event_title: event.title,
      event_date: event.date,
      event_time: event.time,
      venue: event.venue,
      total_tickets: tickets.length,
      generated_at: new Date().toISOString(),
      generated_by: user.id,
      format: format,
      size: size
    }

    zip.file('event-summary.json', JSON.stringify(eventSummary, null, 2))

    // Generate ZIP file
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })

    const filename = `${event.title.replace(/[^a-zA-Z0-9]/g, '-')}-qr-codes.zip`

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    })

  } catch (error) {
    console.error('Error generating bulk QR codes:', error)
    return NextResponse.json(
      { error: 'Failed to generate QR codes' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { format = 'png', size = 512, includeDetails = false } = await request.json()
    
    // Redirect to GET with query params
    const url = new URL(request.url)
    url.searchParams.set('format', format)
    url.searchParams.set('size', size.toString())
    if (includeDetails) {
      url.searchParams.set('details', 'true')
    }
    
    return NextResponse.redirect(url.toString())
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    )
  }
}
