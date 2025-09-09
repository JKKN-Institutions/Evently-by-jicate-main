import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import QRCode from 'qrcode'
import jsPDF from 'jspdf'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { ticket, template, event } = await request.json()
    
    if (!ticket) {
      return NextResponse.json({ error: 'Ticket data is required' }, { status: 400 })
    }

    console.log('[ENHANCED-PDF] Creating enhanced ticket PDF:', ticket.ticket_number)

    // Create PDF with exact dimensions of a ticket
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [210, 100] // Ticket size: 210mm x 100mm
    })

    const pageWidth = 210
    const pageHeight = 100
    
    // Get colors from template
    const primaryColor = template?.themeColor || '#0b6d41'
    const secondaryColor = template?.secondaryColor || '#15a862'
    const rgb1 = hexToRgb(primaryColor)
    const rgb2 = hexToRgb(secondaryColor)

    // EXACT TICKET DESIGN FROM YOUR PDF REFERENCE
    
    // 1. Green background on left side (matching your PDF)
    pdf.setFillColor(rgb1.r, rgb1.g, rgb1.b)
    pdf.rect(0, 0, 85, pageHeight, 'F')
    
    // 2. White area on right side
    pdf.setFillColor(255, 255, 255)
    pdf.rect(85, 0, pageWidth - 85, pageHeight, 'F')

    // 3. Event Logo or Event Name on green background (left side)
    let titleY = 40
    
    // Check if event logo exists and add it
    if (template?.eventLogo) {
      try {
        // Add event logo at the top
        const logoSize = 25
        const logoX = 30
        const logoY = 15
        
        // White circle background for logo
        pdf.setFillColor(255, 255, 255)
        pdf.circle(logoX + logoSize/2, logoY + logoSize/2, logoSize/2 + 2, 'F')
        
        // Add logo (if base64)
        if (template.eventLogo.startsWith('data:image')) {
          pdf.addImage(template.eventLogo, 'PNG', logoX, logoY, logoSize, logoSize)
        }
        
        titleY = logoY + logoSize + 10 // Position title below logo
      } catch (error) {
        console.error('Error adding logo:', error)
      }
    }
    
    // Event Name
    pdf.setTextColor(255, 255, 255)
    pdf.setFontSize(20)
    pdf.setFont('helvetica', 'bold')
    const eventTitle = template?.eventName || event?.title || ticket.event_title || 'Event'
    
    // Wrap long titles with better spacing
    const titleLines = pdf.splitTextToSize(eventTitle.toUpperCase(), 75)
    titleLines.forEach((line: string) => {
      pdf.text(line, 42, titleY, { align: 'center' })
      titleY += 8
    })

    // Ticket type below event name
    pdf.setFontSize(13)
    pdf.setFont('helvetica', 'normal')
    const ticketType = template?.ticketTypes?.[0]?.name || ticket.ticket_type || 'General'
    pdf.text(ticketType, 42, titleY + 8, { align: 'center' })

    // 4. Main ticket details on right side (white area)
    // Define clear layout zones to prevent overlapping
    
    // Layout zones:
    // Zone 1 (Left): X=92 to X=135 - Date, Time, Seat info
    // Zone 2 (Middle): X=140 to X=165 - Venue, Location  
    // Zone 3 (Right): X=170 to X=200 - QR Code area
    
    const leftCol = 92      // Start of left column
    const middleCol = 138   // Start of middle column (moved left to avoid QR)
    const qrZoneStart = 168 // QR zone boundary
    
    let currentY = 12       // Starting Y position (higher up)

    // EVENT DATE (Left column)
    pdf.setTextColor(40, 40, 40)
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'bold')
    pdf.text('EVENT DATE', leftCol, currentY)
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'normal')
    
    // Format date properly
    const eventDate = template?.eventDate || event?.date || 'TBD'
    let formattedDate = eventDate
    if (eventDate && eventDate !== 'TBD') {
      const date = new Date(eventDate)
      const options: Intl.DateTimeFormatOptions = { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric' 
      }
      formattedDate = date.toLocaleDateString('en-US', options)
    }
    // Limit date width to prevent overlap
    const dateLines = pdf.splitTextToSize(formattedDate, 40)
    dateLines.forEach((line: string, idx: number) => {
      pdf.text(line, leftCol, currentY + 4 + (idx * 3))
    })

    currentY += 12

    // TIME (Left column)
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'bold')
    pdf.text('TIME', leftCol, currentY)
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'normal')
    
    // Format time properly
    const eventTime = template?.eventTime || event?.time || 'TBD'
    const formattedTime = eventTime !== 'TBD' ? eventTime : eventTime
    pdf.text(formattedTime, leftCol, currentY + 4)
    
    currentY += 12
    
    // SEAT INFORMATION (Left column)
    if (ticket.seatNumber || ticket.rowNumber || ticket.section) {
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'bold')
      pdf.text('SEAT INFO', leftCol, currentY)
      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'normal')
      
      // Format seat info in compact way
      let seatInfo = []
      if (ticket.section && ticket.section !== 'General') {
        seatInfo.push(`Sec: ${ticket.section}`)
      }
      if (ticket.rowNumber) {
        seatInfo.push(`Row: ${ticket.rowNumber}`)
      }
      if (ticket.seatNumber) {
        seatInfo.push(`Seat: ${ticket.seatNumber}`)
      }
      
      // Display seat info line by line
      seatInfo.forEach((info, index) => {
        pdf.text(info, leftCol, currentY + 4 + (index * 3))
      })
      currentY += 4 + (seatInfo.length * 3) + 4
    } else {
      // General Admission
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'bold')
      pdf.text('ADMISSION', leftCol, currentY)
      pdf.setFontSize(9)
      pdf.setFont('helvetica', 'normal')
      pdf.text('General', leftCol, currentY + 4)
      currentY += 12
    }

    // VENUE (Middle column - carefully positioned)
    let venueY = 12
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'bold')
    pdf.text('VENUE', middleCol, venueY)
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'normal')
    const venue = template?.venue || event?.venue || 'TBD'
    // Wrap venue text - limit to prevent QR overlap
    const maxVenueWidth = qrZoneStart - middleCol - 3 // Leave 3mm gap before QR zone
    const venueLines = pdf.splitTextToSize(venue, maxVenueWidth)
    venueLines.slice(0, 2).forEach((line: string, index: number) => { // Max 2 lines
      pdf.text(line, middleCol, venueY + 4 + (index * 3))
    })
    
    // LOCATION (Middle column - below venue)
    venueY = venueY + 4 + (Math.min(venueLines.length, 2) * 3) + 4
    const location = template?.location || event?.location || ''
    if (location && venueY < 40) { // Only show if there's space
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'bold')
      pdf.text('LOCATION', middleCol, venueY)
      pdf.setFontSize(8)
      pdf.setFont('helvetica', 'normal')
      const locationLines = pdf.splitTextToSize(location, maxVenueWidth)
      locationLines.slice(0, 2).forEach((line: string, index: number) => { // Max 2 lines
        pdf.text(line, middleCol, venueY + 4 + (index * 3))
      })
    }

    // 5. QR Code (Right side - fixed position)
    const qrSize = 26  // Slightly smaller for better fit
    const qrX = 173    // Positioned in right zone
    const qrY = 12     // Aligned with top content
    
    // 6. TICKET NUMBER (Bottom left - clear of other elements)
    const ticketY = Math.max(currentY + 5, 50) // Position below other left column items
    
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'bold')
    pdf.text('TICKET NUMBER', leftCol, ticketY)
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'normal')
    const ticketNumber = ticket.ticket_number || `TKT-${generateRandomId()}-${Date.now()}-${generateRandomId()}`
    // Split ticket number if too long
    const ticketNumLines = pdf.splitTextToSize(ticketNumber, 45)
    ticketNumLines.forEach((line: string, idx: number) => {
      pdf.text(line, leftCol, ticketY + 4 + (idx * 3))
    })

    // REG ID (Below QR code)
    const regIdY = qrY + qrSize + 3
    pdf.setTextColor(40, 40, 40)
    pdf.setFontSize(7)
    pdf.setFont('helvetica', 'normal')
    pdf.text('REG ID', qrX + qrSize/2, regIdY, { align: 'center' })
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(rgb1.r, rgb1.g, rgb1.b)
    // Generate short REG ID
    const regId = `REG-${ticket.ticket_number?.slice(-8) || generateRandomId()}`
    pdf.text(regId, qrX + qrSize/2, regIdY + 4, { align: 'center' })
    
    // Simple underline for REG ID
    pdf.setDrawColor(rgb1.r, rgb1.g, rgb1.b)
    pdf.setLineWidth(0.3)
    const regIdWidth = pdf.getTextWidth(regId)
    pdf.line(qrX + qrSize/2 - regIdWidth/2, regIdY + 5, qrX + qrSize/2 + regIdWidth/2, regIdY + 5)
    
    pdf.setTextColor(40, 40, 40)
    
    // Add separator line above Terms & Conditions (dynamic position)
    const separatorY = Math.max(ticketY + 12, regIdY + 10, 65)
    pdf.setDrawColor(200, 200, 200)
    pdf.setLineWidth(0.2)
    pdf.line(leftCol, separatorY, 200, separatorY)

    // 7. Generate QR Code (Right zone)
    
    // White background for QR code with padding
    pdf.setFillColor(255, 255, 255)
    pdf.rect(qrX - 3, qrY - 3, qrSize + 6, qrSize + 6, 'F')
    
    // Add subtle border around QR code
    pdf.setDrawColor(220, 220, 220)
    pdf.setLineWidth(0.3)
    pdf.rect(qrX - 2, qrY - 2, qrSize + 4, qrSize + 4, 'S')
    
    try {
      // Use the QR data from ticket which includes verification ID
      let qrData = ticket.qr_data || ticket.qr_code
      
      // Parse if it's a string to ensure verification ID exists
      if (typeof qrData === 'string') {
        try {
          const parsed = JSON.parse(qrData)
          // Ensure verification ID exists
          if (!parsed.verificationId) {
            parsed.verificationId = ticket.metadata?.verificationId || crypto.randomUUID()
          }
          qrData = JSON.stringify(parsed)
        } catch (e) {
          // If parsing fails, create new QR data with verification ID
          qrData = JSON.stringify({
            type: 'ticket',
            ticketNumber: ticket.ticket_number,
            eventId: ticket.event_id || event?.id,
            bookingId: ticket.booking_id,
            verificationId: ticket.metadata?.verificationId || crypto.randomUUID(),
            timestamp: Date.now(),
            seatInfo: ticket.seatNumber ? {
              seat: ticket.seatNumber,
              row: ticket.rowNumber,
              section: ticket.section
            } : null
          })
        }
      }
      
      const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
        width: 400,
        margin: 1,
        color: {
          dark: '#000000', // Black for better scanning
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'H' // High error correction for better scanning
      })
      pdf.addImage(qrCodeDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)
    } catch (error) {
      console.error('Error generating QR code:', error)
    }

    // 8. Terms & Conditions (Below separator, dynamic position)
    const termsStartY = separatorY + 4
    pdf.setTextColor(80, 80, 80)
    pdf.setFontSize(7)
    pdf.setFont('helvetica', 'bold')
    pdf.text('TERMS & CONDITIONS:', leftCol, termsStartY)
    
    pdf.setFontSize(6)
    pdf.setFont('helvetica', 'normal')
    let termsY = termsStartY + 3
    
    // Use template terms or default terms
    const terms = template?.additionalTerms || [
      'This ticket is valid for one-time entry only',
      'Please carry a valid government-issued ID proof'
    ]
    
    terms.slice(0, 2).forEach((term: string) => {
      if (term && termsY < 88) { // Ensure we don't go too low
        const termLines = pdf.splitTextToSize(`• ${term}`, 100)
        termLines.forEach((line: string) => {
          if (termsY < 88) {
            pdf.text(line, leftCol, termsY)
            termsY += 2.5
          }
        })
      }
    })

    // 9. Organizer info (Bottom right corner if space available)
    if ((template?.organizerName || template?.organizerContact) && termsY < 85) {
      pdf.setTextColor(60, 60, 60)
      pdf.setFontSize(6)
      pdf.setFont('helvetica', 'normal')
      
      const organizerY = Math.max(termsY + 2, 85)
      
      if (template?.organizerName) {
        const orgText = `Organized by ${template.organizerName}`
        const orgLines = pdf.splitTextToSize(orgText, 60)
        pdf.text(orgLines[0], middleCol, organizerY)
      }
      
      if (template?.organizerContact) {
        const contactLines = pdf.splitTextToSize(template.organizerContact, 60)
        pdf.text(contactLines[0], middleCol, organizerY + 2.5)
      }
    }

    // 10. Add subtle decorative elements
    // Additional design accent line at the very bottom
    pdf.setDrawColor(rgb2.r, rgb2.g, rgb2.b)
    pdf.setLineWidth(0.2)
    pdf.line(leftCol, 90, 200, 90)

    // Generate PDF
    const pdfOutput = pdf.output('datauristring')
    
    return NextResponse.json({
      success: true,
      pdf: pdfOutput,
      filename: `enhanced-ticket-${ticket.ticket_number || generateRandomId()}.pdf`,
      message: 'Enhanced ticket PDF generated successfully'
    })

  } catch (error) {
    console.error('[ENHANCED-PDF] Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate enhanced ticket PDF', details: String(error) },
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

// Helper function to generate random ID
function generateRandomId() {
  return Math.random().toString(36).substring(2, 8)
}