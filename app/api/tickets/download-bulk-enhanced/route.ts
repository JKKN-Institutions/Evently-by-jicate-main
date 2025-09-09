import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import JSZip from 'jszip'
import jsPDF from 'jspdf'

// Helper function to generate PDF for a ticket
async function generateTicketPDF(ticket: any, event: any, template: any) {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  // Set background color
  pdf.setFillColor(245, 245, 245)
  pdf.rect(0, 0, 210, 297, 'F')

  // Header with gradient effect (simulated)
  const primaryColor = template?.themeColor || '#0b6d41'
  const secondaryColor = template?.secondaryColor || '#15a862'
  
  // Convert hex to RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 11, g: 109, b: 65 }
  }

  const rgb = hexToRgb(primaryColor)
  pdf.setFillColor(rgb.r, rgb.g, rgb.b)
  pdf.rect(0, 0, 210, 60, 'F')

  // Event Title
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(24)
  pdf.setFont('helvetica', 'bold')
  pdf.text(event.title || 'Event', 105, 25, { align: 'center' })

  // Event Details
  pdf.setFontSize(12)
  pdf.setFont('helvetica', 'normal')
  pdf.text(`${event.date || ''} | ${event.time || ''}`, 105, 35, { align: 'center' })
  pdf.text(event.venue || '', 105, 42, { align: 'center' })

  // Ticket Info Box
  pdf.setFillColor(255, 255, 255)
  pdf.roundedRect(20, 70, 170, 100, 5, 5, 'F')
  
  // Ticket Number (prominent)
  pdf.setTextColor(rgb.r, rgb.g, rgb.b)
  pdf.setFontSize(10)
  pdf.text('TICKET NUMBER', 30, 85)
  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'bold')
  pdf.text(ticket.ticket_number || 'N/A', 30, 95)

  // Ticket Type and Level
  pdf.setTextColor(100, 100, 100)
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')
  pdf.text('TYPE', 30, 110)
  pdf.setTextColor(50, 50, 50)
  pdf.setFontSize(12)
  pdf.text(ticket.ticket_type || 'General', 30, 118)

  pdf.setTextColor(100, 100, 100)
  pdf.setFontSize(10)
  pdf.text('LEVEL', 30, 133)
  pdf.setTextColor(50, 50, 50)
  pdf.setFontSize(12)
  pdf.text(ticket.ticket_level || 'Standard', 30, 141)

  // Status Badge
  if (ticket.status === 'active') {
    pdf.setFillColor(16, 185, 129)
    pdf.roundedRect(150, 85, 30, 10, 2, 2, 'F')
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(8)
    pdf.text('ACTIVE', 165, 91, { align: 'center' })
  }

  // QR Code placeholder (you would need to generate actual QR code)
  if (template?.includeQRCode) {
    pdf.setDrawColor(200, 200, 200)
    pdf.rect(140, 105, 40, 40)
    pdf.setTextColor(150, 150, 150)
    pdf.setFontSize(8)
    pdf.text('QR CODE', 160, 125, { align: 'center' })
    pdf.setFontSize(6)
    pdf.text(ticket.qr_code || ticket.ticket_number || '', 160, 130, { align: 'center' })
  }

  // Footer
  pdf.setTextColor(100, 100, 100)
  pdf.setFontSize(8)
  pdf.text('Generated with Evently', 105, 280, { align: 'center' })
  pdf.text(new Date().toLocaleDateString(), 105, 285, { align: 'center' })

  return pdf.output('arraybuffer')
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { ticketIds, eventId, template } = await request.json()

    if (!ticketIds || ticketIds.length === 0) {
      return NextResponse.json({ error: 'No tickets selected' }, { status: 400 })
    }

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch tickets
    const { data: tickets, error: ticketsError } = await supabase
      .from('tickets')
      .select('*')
      .in('id', ticketIds)

    if (ticketsError || !tickets || tickets.length === 0) {
      return NextResponse.json({ error: 'Tickets not found' }, { status: 404 })
    }

    // Fetch event details
    const eventIdToUse = eventId || tickets[0].event_id
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventIdToUse)
      .single()

    if (eventError || !event) {
      console.error('Event fetch error:', eventError)
      // Use fallback event data
      const eventData = {
        title: 'Event',
        date: new Date().toLocaleDateString(),
        time: '',
        venue: '',
        location: ''
      }
    }

    // Create ZIP file
    const zip = new JSZip()
    
    // Generate PDF for each ticket
    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i]
      try {
        const pdfBuffer = await generateTicketPDF(
          ticket, 
          event || { title: 'Event' }, 
          template || {}
        )
        
        // Add PDF to ZIP
        const fileName = `ticket-${ticket.ticket_number || ticket.id}.pdf`
        zip.file(fileName, pdfBuffer)
      } catch (error) {
        console.error(`Error generating PDF for ticket ${ticket.id}:`, error)
      }
    }

    // Add a manifest file
    const manifest = {
      event: event?.title || 'Event',
      date: new Date().toISOString(),
      ticketCount: tickets.length,
      tickets: tickets.map(t => ({
        id: t.id,
        number: t.ticket_number,
        type: t.ticket_type,
        status: t.status
      }))
    }
    zip.file('manifest.json', JSON.stringify(manifest, null, 2))

    // Generate ZIP file as base64 first, then convert to buffer
    const zipBase64 = await zip.generateAsync({ 
      type: 'base64',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 }
    })
    
    // Convert base64 to buffer
    const zipBuffer = Buffer.from(zipBase64, 'base64')

    // Return ZIP file with proper headers
    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="tickets-${Date.now()}.zip"`,
        'Content-Length': zipBuffer.length.toString()
      }
    })

  } catch (error) {
    console.error('Bulk download error:', error)
    return NextResponse.json({
      error: 'Failed to generate bulk download',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}