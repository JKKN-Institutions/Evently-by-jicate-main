import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import QRCode from 'qrcode'
import jsPDF from 'jspdf'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { ticket, template } = await request.json()
    
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket data is required' }, { status: 400 })
    }

    console.log('[DOWNLOAD] Creating PDF for ticket:', ticket.ticket_number)

    // Create a new PDF document
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    })

    // Set up the ticket design
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const margin = 15
    const contentWidth = pageWidth - (margin * 2)

    // Background color
    pdf.setFillColor(245, 247, 250)
    pdf.rect(0, 0, pageWidth, pageHeight, 'F')

    // Header with gradient effect (simulated with rectangles)
    const headerHeight = 40
    const primaryColor = template?.themeColor || '#0b6d41'
    const rgb = hexToRgb(primaryColor)
    
    pdf.setFillColor(rgb.r, rgb.g, rgb.b)
    pdf.rect(0, 0, pageWidth, headerHeight, 'F')

    // Title
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(24)
    pdf.setFont('helvetica', 'bold')
    const title = ticket.event_title || 'Event Ticket'
    pdf.text(title, pageWidth / 2, 25, { align: 'center' })

    // Ticket box
    const boxY = headerHeight + 15
    const boxHeight = 180
    pdf.setFillColor(255, 255, 255)
    pdf.setDrawColor(rgb.r, rgb.g, rgb.b)
    pdf.setLineWidth(0.5)
    pdf.roundedRect(margin, boxY, contentWidth, boxHeight, 5, 5, 'FD')

    // Ticket Number (prominent)
    pdf.setTextColor(rgb.r, rgb.g, rgb.b)
    pdf.setFontSize(12)
    pdf.setFont('helvetica', 'normal')
    pdf.text('TICKET NUMBER', pageWidth / 2, boxY + 15, { align: 'center' })
    
    pdf.setFontSize(20)
    pdf.setFont('helvetica', 'bold')
    pdf.text(ticket.ticket_number || 'N/A', pageWidth / 2, boxY + 25, { align: 'center' })

    // Divider line
    pdf.setDrawColor(220, 220, 220)
    pdf.setLineWidth(0.2)
    pdf.line(margin + 10, boxY + 35, pageWidth - margin - 10, boxY + 35)

    // Event Details
    let currentY = boxY + 50
    pdf.setTextColor(60, 60, 60)
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')

    const details = [
      { label: 'Event ID:', value: ticket.event_id },
      { label: 'Status:', value: ticket.status || 'Valid' },
      { label: 'Type:', value: ticket.ticket_type || 'General Admission' },
      { label: 'Generated:', value: new Date().toLocaleDateString() }
    ]

    details.forEach((detail, index) => {
      const x = margin + 20 + (index % 2) * (contentWidth / 2)
      const y = currentY + Math.floor(index / 2) * 15
      
      pdf.setFont('helvetica', 'bold')
      pdf.text(detail.label, x, y)
      pdf.setFont('helvetica', 'normal')
      pdf.text(detail.value, x + 25, y)
    })

    // QR Code
    currentY = boxY + 100
    try {
      const qrData = ticket.qr_code || ticket.ticket_number || `TICKET-${Date.now()}`
      const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
        width: 200,
        margin: 1,
        color: {
          dark: primaryColor,
          light: '#FFFFFF'
        }
      })
      
      const qrSize = 50
      const qrX = pageWidth / 2 - qrSize / 2
      pdf.addImage(qrCodeDataUrl, 'PNG', qrX, currentY, qrSize, qrSize)
      
      pdf.setFontSize(8)
      pdf.setTextColor(100, 100, 100)
      pdf.text('Scan for verification', pageWidth / 2, currentY + qrSize + 5, { align: 'center' })
    } catch (error) {
      console.error('Error generating QR code:', error)
    }

    // Footer information
    currentY = boxY + boxHeight + 10
    pdf.setFontSize(9)
    pdf.setTextColor(120, 120, 120)
    pdf.setFont('helvetica', 'normal')
    
    const footerText = [
      '• This ticket is valid for one-time entry only',
      '• Please carry a valid ID proof',
      '• Entry subject to security check',
      ticket.metadata?.note ? `• ${ticket.metadata.note}` : ''
    ].filter(Boolean)

    footerText.forEach((text, index) => {
      pdf.text(text, margin, currentY + (index * 5))
    })

    // Warning for simulated tickets
    if (ticket.status === 'simulated' || ticket.created_via === 'force-simulated') {
      pdf.setFontSize(8)
      pdf.setTextColor(255, 100, 0)
      pdf.setFont('helvetica', 'bold')
      pdf.text('TEST TICKET - Not for actual use', pageWidth / 2, pageHeight - 10, { align: 'center' })
    }

    // Watermark for enhanced tickets (simplified without GState)
    if (template?.enableWatermark) {
      pdf.setTextColor(230, 230, 230)
      pdf.setFontSize(60)
      pdf.setFont('helvetica', 'bold')
      // Add diagonal watermark text
      const centerX = pageWidth / 2
      const centerY = pageHeight / 2
      pdf.text('VALID', centerX - 30, centerY, { angle: 45 })
    }

    // Generate PDF
    const pdfOutput = pdf.output('datauristring')
    
    return NextResponse.json({
      success: true,
      pdf: pdfOutput,
      filename: `ticket-${ticket.ticket_number}.pdf`,
      message: 'Ticket PDF generated successfully'
    })

  } catch (error) {
    console.error('[DOWNLOAD] Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate ticket PDF', details: String(error) },
      { status: 500 }
    )
  }
}

// Helper function to convert hex to RGB
function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 11, g: 109, b: 65 } // Default green color
}