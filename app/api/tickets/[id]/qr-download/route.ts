import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import QRCode from 'qrcode'

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

    // Get ticket with booking and event details
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select(`
        *,
        bookings (
          id,
          user_id,
          user_name,
          user_email,
          events (
            id,
            title,
            date,
            time,
            venue,
            organizer_id
          )
        )
      `)
      .eq('id', id)
      .single()

    if (ticketError || !ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    // Check authorization - user owns the ticket OR is the event organizer OR is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const userRole = profile?.role || 'user'
    const isOwner = ticket.bookings?.user_id === user.id
    const isOrganizer = ticket.bookings?.events?.organizer_id === user.id
    const isAdmin = userRole === 'admin'

    if (!isOwner && !isOrganizer && !isAdmin) {
      return NextResponse.json(
        { error: 'Not authorized to download this QR code' },
        { status: 403 }
      )
    }

    // Get format from query params (default to PNG)
    const url = new URL(request.url)
    const format = url.searchParams.get('format') || 'png'
    const size = parseInt(url.searchParams.get('size') || '512')

    // Generate QR code with ticket validation URL
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
    let contentType: string
    let filename: string

    if (format === 'svg') {
      qrData = await QRCode.toString(validationUrl, { ...qrOptions, type: 'svg' })
      contentType = 'image/svg+xml'
      filename = `ticket-${ticket.ticket_number}-qr.svg`
    } else {
      qrData = await QRCode.toBuffer(validationUrl, qrOptions)
      contentType = 'image/png'
      filename = `ticket-${ticket.ticket_number}-qr.png`
    }

    // Return the QR code file
    return new NextResponse(qrData, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
      },
    })

  } catch (error) {
    console.error('Error generating QR code download:', error)
    return NextResponse.json(
      { error: 'Failed to generate QR code' },
      { status: 500 }
    )
  }
}

// Also support POST for bulk operations
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { format = 'png', size = 512 } = await request.json()
    
    // Redirect to GET with query params
    const url = new URL(request.url)
    url.searchParams.set('format', format)
    url.searchParams.set('size', size.toString())
    
    return NextResponse.redirect(url.toString().replace('/qr-download', '/qr-download'))
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    )
  }
}
