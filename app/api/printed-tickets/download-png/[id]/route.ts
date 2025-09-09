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

    // Get ticket with event information
    const { data: ticket, error: ticketError } = await supabase
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
      .eq('id', id)
      .single()

    if (ticketError || !ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    // Verify user owns the event or is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const userRole = profile?.role || 'user'
    const isOrganizer = ticket.events.organizer_id === user.id
    const isAdmin = userRole === 'admin'

    if (!isOrganizer && !isAdmin) {
      return NextResponse.json(
        { error: 'Not authorized to download this ticket' },
        { status: 403 }
      )
    }

    // Generate QR code as PNG buffer
    const qrOptions = {
      errorCorrectionLevel: 'H' as const,
      type: 'image/png' as const,
      quality: 0.92,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 512
    }

    // Use the encrypted QR code data from the ticket
    const qrBuffer = await QRCode.toBuffer(ticket.qr_code, qrOptions)

    // Return PNG file
    return new NextResponse(qrBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="${ticket.ticket_code}.png"`,
        'Content-Length': qrBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
    })

  } catch (error) {
    console.error('Error generating PNG QR code:', error)
    return NextResponse.json(
      { error: 'Failed to generate QR code' },
      { status: 500 }
    )
  }
}
