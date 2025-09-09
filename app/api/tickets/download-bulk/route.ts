import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import QRCode from 'qrcode'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { tickets } = await req.json()

    if (!tickets || !Array.isArray(tickets) || tickets.length === 0) {
      return NextResponse.json({ error: 'No tickets provided' }, { status: 400 })
    }

    // Create a new PDF document
    const pdfDoc = await PDFDocument.create()
    
    // Process each ticket
    for (const ticket of tickets) {
      // Add a new page for each ticket
      const page = pdfDoc.addPage([595, 842]) // A4 size
      const { width, height } = page.getSize()
      
      // Load fonts
      const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
      const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
      
      // Draw ticket border
      page.drawRectangle({
        x: 50,
        y: height - 400,
        width: width - 100,
        height: 350,
        borderColor: rgb(0.96, 0.87, 0.35), // #ffde59 in RGB
        borderWidth: 2,
      })

      // Draw header background
      page.drawRectangle({
        x: 52,
        y: height - 150,
        width: width - 104,
        height: 98,
        color: rgb(0.96, 0.87, 0.35), // #ffde59
      })

      // Add event title
      page.drawText(ticket.event.title || 'Event', {
        x: 70,
        y: height - 120,
        size: 24,
        font: helveticaBold,
        color: rgb(0.043, 0.427, 0.255), // #0b6d41
      })

      // Add ticket details
      const details = [
        { label: 'Ticket #', value: ticket.ticket_number },
        { label: 'Date', value: new Date(ticket.event.date).toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })},
        { label: 'Time', value: ticket.event.time },
        { label: 'Venue', value: ticket.event.venue },
        { label: 'Location', value: ticket.event.location },
        { label: 'Status', value: ticket.status.toUpperCase() },
      ]

      let yPosition = height - 180
      for (const detail of details) {
        // Draw label
        page.drawText(`${detail.label}:`, {
          x: 70,
          y: yPosition,
          size: 12,
          font: helvetica,
          color: rgb(0.4, 0.4, 0.4),
        })

        // Draw value
        page.drawText(detail.value || 'N/A', {
          x: 200,
          y: yPosition,
          size: 12,
          font: helveticaBold,
          color: rgb(0.2, 0.2, 0.2),
        })

        yPosition -= 25
      }

      // Generate and add QR code
      if (ticket.id) {
        try {
          const qrCodeData = JSON.stringify({
            ticketId: ticket.id,
            ticketNumber: ticket.ticket_number,
            eventId: ticket.event.id,
            status: ticket.status
          })

          const qrCodeImage = await QRCode.toDataURL(qrCodeData, {
            width: 150,
            margin: 1,
            color: {
              dark: '#0b6d41',
              light: '#FFFFFF'
            }
          })

          // Convert base64 to buffer
          const qrImageData = qrCodeImage.split(',')[1]
          const qrImageBuffer = Buffer.from(qrImageData, 'base64')
          
          // Embed QR code in PDF
          const qrImage = await pdfDoc.embedPng(qrImageBuffer)
          page.drawImage(qrImage, {
            x: width - 220,
            y: height - 340,
            width: 150,
            height: 150,
          })
        } catch (qrError) {
          console.error('Error generating QR code:', qrError)
        }
      }

      // Add footer
      page.drawText('This ticket is valid for one admission only', {
        x: 70,
        y: height - 380,
        size: 10,
        font: helvetica,
        color: rgb(0.6, 0.6, 0.6),
      })

      // Add page break line if not last ticket
      if (tickets.indexOf(ticket) < tickets.length - 1) {
        page.drawLine({
          start: { x: 0, y: height - 420 },
          end: { x: width, y: height - 420 },
          thickness: 0.5,
          color: rgb(0.8, 0.8, 0.8),
        })
      }
    }

    // Serialize the PDF document to bytes
    const pdfBytes = await pdfDoc.save()

    // Return the PDF as a response
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="tickets-bulk-${Date.now()}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Error generating bulk tickets PDF:', error)
    return NextResponse.json(
      { error: 'Failed to generate bulk tickets PDF' },
      { status: 500 }
    )
  }
}