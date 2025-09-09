import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateTicketPDF } from '@/lib/qr-generator'
import QRCode from 'qrcode'
import jsPDF from 'jspdf'

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

    const { ticketId, format = 'pdf' } = await request.json()
    
    if (!ticketId) {
      return NextResponse.json(
        { error: 'Ticket ID is required' },
        { status: 400 }
      )
    }

    // Get ticket with event and template information
    // First try to get ticket with booking information
    let { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select(`
        *,
        bookings (
          user_name,
          user_email,
          user_phone,
          user_id,
          events (
            id,
            title,
            date,
            time,
            venue,
            location,
            organizer_id,
            ticket_template
          )
        )
      `)
      .eq('id', ticketId)
      .single()

    // If ticket has no booking (e.g., from enhanced generator), get event directly
    let event = null
    if (ticket && !ticket.bookings) {
      const { data: eventData } = await supabase
        .from('events')
        .select('*')
        .eq('id', ticket.event_id)
        .single()
      
      event = eventData
    } else if (ticket?.bookings?.events) {
      event = ticket.bookings.events
    }

    if (ticketError || !ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    // Check authorization
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const userRole = profile?.role || 'user'
    const isOwner = ticket.bookings?.user_id === user.id || ticket.user_id === user.id
    const isOrganizer = event?.organizer_id === user.id
    const isAdmin = userRole === 'admin'

    if (!isOwner && !isOrganizer && !isAdmin) {
      return NextResponse.json(
        { error: 'Not authorized to download this ticket' },
        { status: 403 }
      )
    }

    if (!event) {
      return NextResponse.json(
        { error: 'Event information not found' },
        { status: 404 }
      )
    }

    // Get ticket template (use enhanced template if available, fallback to default)
    const ticketTemplate = event.ticket_template || {
      themeColor: '#0b6d41',
      secondaryColor: '#15a862',
      organizerName: 'Event Organizer',
      enableWatermark: true,
      includeQRCode: true,
      layoutStyle: 'modern'
    }

    // Generate QR code with proper data
    // Use ticket QR code if available, otherwise create one with complete ticket info
    const qrData = ticket.qr_code || JSON.stringify({
      ticketId: ticket.id,
      ticketNumber: ticket.ticket_number,
      eventId: event.id,
      eventName: event.title,
      date: event.date,
      venue: event.venue,
      seatNumber: ticket.seat_number || null,
      section: ticket.section || null,
      row: ticket.row_number || null,
      attendee: ticket.bookings?.user_name || ticket.metadata?.attendee_name || 'Guest',
      status: ticket.status || 'valid',
      timestamp: Date.now()
    })
    
    const qrDataUrl = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: ticketTemplate.themeColor || '#000000',
        light: '#FFFFFF'
      },
      width: 200
    })

    if (format === 'png') {
      // Return QR code as PNG
      const base64Data = qrDataUrl.split(',')[1]
      const buffer = Buffer.from(base64Data, 'base64')
      
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'image/png',
          'Content-Disposition': `attachment; filename="ticket-${ticket.ticket_number}.png"`
        }
      })
    }

    // Generate PDF with enhanced template - include ALL ticket parameters
    const ticketData = {
      ticketId: ticket.id,
      eventId: event.id,
      bookingId: ticket.booking_id || '',
      userId: ticket.bookings?.user_id || ticket.user_id || '',
      ticketNumber: ticket.ticket_number,
      ticketType: ticket.ticket_type || ticket.metadata?.ticket_type || 'General Admission',
      eventDate: event.date,
      attendeeName: ticket.bookings?.user_name || ticket.metadata?.attendee_name || ticket.metadata?.user_name || 'Ticket Holder',
      // Add seat information
      seatNumber: ticket.seat_number || ticket.metadata?.seat_number || null,
      rowNumber: ticket.row_number || ticket.metadata?.row_number || null,
      section: ticket.section || ticket.metadata?.section || null,
      zone: ticket.zone || ticket.metadata?.zone || null,
      gateNumber: ticket.gate_number || ticket.metadata?.gate_number || null,
      // Add additional ticket info
      status: ticket.status || 'valid',
      qrCode: ticket.qr_code || '',
      createdAt: ticket.created_at || new Date().toISOString(),
      // User contact info
      userEmail: ticket.bookings?.user_email || ticket.metadata?.user_email || '',
      userPhone: ticket.bookings?.user_phone || ticket.metadata?.user_phone || ''
    }

    const eventDetails = {
      title: event.title || 'Event Name',
      venue: event.venue || 'Event Venue',
      date: event.date || new Date().toISOString().split('T')[0],
      time: event.time || 'TBD',
      location: event.location || ''
    }



    // Generate HTML content with enhanced template
    const htmlContent = generateEnhancedTicketHTML(ticketData, eventDetails, qrDataUrl, ticketTemplate)

    // Convert HTML to PDF
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [200, 100] // Ticket size
    })

    // For now, we'll use a simplified approach
    // In a production environment, you'd want to use a proper HTML-to-PDF converter
    const pdfBuffer = await generatePDFFromHTML(htmlContent, ticketTemplate, ticketData, eventDetails, qrDataUrl)

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="ticket-${ticket.ticket_number}.pdf"`
      }
    })

  } catch (error) {
    console.error('Error downloading ticket with template:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to download ticket: ${errorMessage}` },
      { status: 500 }
    )
  }
}

function generateEnhancedTicketHTML(ticketData: any, eventDetails: any, qrCodeUrl: string, template: any) {
  const themeColor = template.themeColor || '#0b6d41'
  const secondaryColor = template.secondaryColor || '#15a862'
  const organizerName = template.organizerName || 'Event Organizer'
  const ticketType = template.ticketTypes?.[0] || { name: 'General Admission', price: 0, color: '#0b6d41' }
  
  // Get layout style classes
  const getLayoutClass = () => {
    switch (template.layoutStyle) {
      case 'modern': return 'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;'
      case 'minimal': return 'font-family: "Helvetica Neue", sans-serif; font-weight: 300;'
      case 'premium': return 'font-family: Georgia, serif;'
      default: return 'font-family: "Segoe UI", Tahoma, sans-serif;'
    }
  }
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        @page { size: A4; margin: 0; }
        body { 
          margin: 0; 
          ${getLayoutClass()}
          background: #f5f5f5;
          color: #333;
        }
        .ticket-container {
          max-width: 800px;
          margin: 20px auto;
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 20px 60px rgba(0,0,0,0.15);
        }
        .ticket-header {
          background: ${themeColor};
          padding: 32px 40px;
          position: relative;
          color: white;
          min-height: 120px;
        }
        ${template.enableWatermark ? `
        .watermark {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-45deg);
          font-size: 80px;
          font-weight: bold;
          opacity: 0.1;
          pointer-events: none;
        }
        ` : ''}
        .header-content {
          position: relative;
          z-index: 2;
        }
        .header-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
          gap: 32px;
        }
        .event-info {
          flex: 1;
        }
        ${template.eventLogo ? `
        .event-logo {
          width: 60px;
          height: 60px;
          background: white;
          border-radius: 8px;
          margin-bottom: 15px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        ` : ''}
        .event-title {
          font-size: 32px;
          font-weight: 700;
          margin: 0 0 12px 0;
          line-height: 1.2;
          letter-spacing: -0.02em;
        }
        .ticket-type-badge {
          display: inline-block;
          background: ${ticketType.color};
          padding: 8px 20px;
          border-radius: 24px;
          font-size: 14px;
          font-weight: 600;
          opacity: 0.95;
          letter-spacing: 0.02em;
        }
        .qr-container {
          background: white;
          padding: 12px;
          border-radius: 12px;
          display: inline-block;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          text-align: center;
        }
        .qr-code {
          width: 96px;
          height: 96px;
          display: block;
          margin: 0 auto;
        }
        .qr-ticket-number {
          margin-top: 8px;
          font-size: 11px;
          font-weight: 600;
          color: #333;
          font-family: 'Courier New', monospace;
          letter-spacing: 0.05em;
        }
        .ticket-body {
          padding: 40px;
        }
        .body-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 48px;
          align-items: start;
        }
        .info-section {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .info-row {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 4px 0;
        }
        .icon {
          width: 20px;
          height: 20px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          opacity: 0.8;
          margin-top: 2px;
          flex-shrink: 0;
        }
        .info-label {
          font-weight: 600;
          color: #666;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 4px;
        }
        .info-value {
          color: #1a1a1a;
          font-size: 15px;
          font-weight: 500;
          line-height: 1.4;
        }
        .venue-info {
          margin-top: 2px;
        }
        .venue-name {
          font-weight: 600;
          color: #1a1a1a;
          font-size: 15px;
          line-height: 1.3;
        }
        .venue-location {
          font-size: 13px;
          color: #666;
          margin-top: 4px;
          line-height: 1.4;
        }
        ${template.gateDetails ? `
        .gate-details {
          font-size: 13px;
          color: #666;
          margin-top: 2px;
        }
        ` : ''}
        .attendee-section {
          padding-top: 20px;
          border-top: 1px solid #e5e5e5;
          margin-top: 8px;
        }
        .attendee-name {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 600;
          margin-bottom: 6px;
        }
        .attendee-value {
          font-weight: 600;
          font-size: 16px;
          color: #1a1a1a;
          line-height: 1.3;
        }
        .registration-id {
          font-family: 'Courier New', monospace;
          font-size: 12px;
          color: #666;
          margin-top: 12px;
          padding: 8px 0;
          border-top: 1px solid #f0f0f0;
        }
        ${template.showPrice && ticketType.price ? `
        .price-section {
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid #e5e5e5;
        }
        .price-label {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 600;
          margin-bottom: 4px;
        }
        .price-value {
          font-size: 28px;
          font-weight: 700;
          color: ${themeColor};
          margin-top: 4px;
          line-height: 1.1;
        }
        ` : ''}
        ${template.includeBarcodeNumber ? `
        .barcode-section {
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid #e5e5e5;
        }
        .barcode-number {
          font-family: 'Courier New', monospace;
          font-size: 10px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 8px;
        }
        .barcode {
          height: 40px;
          background: repeating-linear-gradient(
            90deg,
            #000,
            #000 2px,
            #fff 2px,
            #fff 4px
          );
          border-radius: 2px;
        }
        ` : ''}
        .ticket-footer {
          background: #f8f8f8;
          padding: 24px 40px;
          border-top: 2px solid ${secondaryColor}30;
          margin-top: 8px;
        }
        .footer-content {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 32px;
        }
        .terms {
          flex: 1;
          font-size: 12px;
          color: #666;
          line-height: 1.6;
          max-width: 60%;
        }
        .terms-item {
          margin-bottom: 6px;
        }
        .organizer-info {
          text-align: right;
          font-size: 12px;
          color: #666;
          flex-shrink: 0;
          min-width: 35%;
        }
        .organizer-name {
          font-weight: 600;
          color: #333;
          margin-bottom: 6px;
          font-size: 13px;
        }
        .organizer-contact {
          font-size: 11px;
          line-height: 1.4;
        }
        ${template.socialMedia?.website ? `
        .organizer-website {
          color: #0066cc;
          font-size: 11px;
          margin-top: 3px;
        }
        ` : ''}
        
        /* Print-specific optimizations */
        @media print {
          body { 
            background: white; 
            -webkit-print-color-adjust: exact;
            color-adjust: exact;
          }
          .ticket-container {
            box-shadow: none;
            margin: 0;
            max-width: none;
            page-break-inside: avoid;
          }
          .ticket-header {
            -webkit-print-color-adjust: exact;
            color-adjust: exact;
          }
        }
        
        /* Responsive adjustments */
        @media (max-width: 768px) {
          .ticket-container {
            margin: 10px;
            border-radius: 8px;
          }
          .ticket-header {
            padding: 24px 20px;
          }
          .ticket-body {
            padding: 24px 20px;
          }
          .body-grid {
            grid-template-columns: 1fr;
            gap: 24px;
          }
          .header-top {
            flex-direction: column;
            gap: 20px;
            text-align: center;
          }
          .event-title {
            font-size: 24px;
          }
          .qr-code {
            width: 80px;
            height: 80px;
          }
          .footer-content {
            flex-direction: column;
            gap: 16px;
            text-align: left;
          }
          .organizer-info {
            text-align: left;
          }
        }
      </style>
    </head>
    <body>
      <div class="ticket-container">
        <div class="ticket-header">
          ${template.enableWatermark ? '<div class="watermark">VALID</div>' : ''}
          <div class="header-content">
            <div class="header-top">
              <div class="event-info">
                ${template.eventLogo ? `
                <div class="event-logo">
                  <img src="${template.eventLogo}" alt="Event Logo" style="width: 100%; height: 100%; object-fit: contain;">
                </div>
                ` : ''}
                <h1 class="event-title">${eventDetails.title}</h1>
                <span class="ticket-type-badge">${ticketType.name}</span>
              </div>
              ${template.includeQRCode ? `
              <div class="qr-container">
                <img src="${qrCodeUrl}" alt="QR Code" class="qr-code">
                <div class="qr-ticket-number">Ticket: ${ticketData.ticketNumber}</div>
              </div>
              ` : ''}
            </div>
          </div>
        </div>
        
        <div class="ticket-body">
          <div class="body-grid">
            <div class="info-section">
              <div class="info-row">
                <span class="icon">📅</span>
                <div>
                  <div class="info-value">${new Date(eventDetails.date).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}</div>
                </div>
              </div>
              
              <div class="info-row">
                <span class="icon">🕐</span>
                <div>
                  <div class="info-value">${eventDetails.time}${template.entryTime ? ` • ${template.entryTime}` : ''}</div>
                </div>
              </div>
              
              <div class="info-row">
                <span class="icon">📍</span>
                <div class="venue-info">
                  <div class="venue-name">${eventDetails.venue}</div>
                  ${eventDetails.location ? `<div class="venue-location">${eventDetails.location}</div>` : ''}
                  ${template.gateDetails ? `<div class="gate-details">${template.gateDetails}</div>` : ''}
                </div>
              </div>
              
              ${template.seatAllocation !== 'none' ? `
              <div class="info-row">
                <span class="icon">🎫</span>
                <div>
                  <div class="info-value">${template.seatAllocation === 'zone' ? 'Zone: General' : 'Seat: A-15'}</div>
                </div>
              </div>
              ` : ''}
            </div>
            
            <div class="info-section">
              ${template.showAttendeeName && ticketData.attendeeName && ticketData.attendeeName !== 'Guest' ? `
              <div class="attendee-section">
                <div class="attendee-name">Attendee Name</div>
                <div class="attendee-value">${ticketData.attendeeName}</div>
              </div>
              ` : ''}
              
              ${template.showRegistrationId ? `
              <div class="registration-id">
                Registration ID: ${ticketData.ticketNumber}
              </div>
              ` : ''}
              
              ${template.showPrice && ticketType.price ? `
              <div class="price-section">
                <div class="price-label">Ticket Price</div>
                <div class="price-value">
                  ${template.currency === 'INR' ? '₹' : template.currency === 'USD' ? '$' : ''}${ticketType.price}
                </div>
              </div>
              ` : ''}
              
              ${template.includeBarcodeNumber ? `
              <div class="barcode-section">
                <div class="barcode-number">Ticket #: ${ticketData.ticketNumber}</div>
                <div class="barcode"></div>
              </div>
              ` : ''}
            </div>
          </div>
        </div>
        
        <div class="ticket-footer">
          <div class="footer-content">
            <div class="terms">
              ${template.additionalTerms?.length > 0 ? template.additionalTerms.slice(0, 3).map(term => 
                `<div class="terms-item">• ${term}</div>`
              ).join('') : ''}
              ${template.idProofRequired ? '<div class="terms-item">• Valid ID proof required</div>' : ''}
              ${template.nonTransferable ? '<div class="terms-item">• This ticket is non-transferable</div>' : ''}
              ${template.ageRestriction ? `<div class="terms-item">• ${template.ageRestriction}</div>` : ''}
              ${template.refundPolicy ? `<div class="terms-item">• Refund Policy: ${template.refundPolicy}</div>` : ''}
            </div>
            
            <div class="organizer-info">
              <div class="organizer-name">${organizerName}</div>
              ${template.organizerContact ? `<div class="organizer-contact">${template.organizerContact}</div>` : ''}
              ${template.socialMedia?.website ? `<div class="organizer-website">${template.socialMedia.website}</div>` : ''}
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `
}

async function generatePDFFromHTML(htmlContent: string, template: any, ticketData?: any, eventDetails?: any, qrCodeDataUrl?: string): Promise<Buffer> {
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [210, 100] // Standard ticket size
  })
  
  // Extract actual data from parameters
  const ticketNumber = ticketData?.ticketNumber || ''
  const eventTitle = eventDetails?.title || ''
  const eventDate = eventDetails?.date ? new Date(eventDetails.date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }) : ''
  const eventTime = eventDetails?.time || ''
  const eventVenue = eventDetails?.venue || ''
  const eventLocation = eventDetails?.location || ''
  const attendeeName = ticketData?.attendeeName || ''
  const ticketType = ticketData?.ticketType || 'General Admission'
  
  // Set colors from template
  const themeColor = template.themeColor || '#0b6d41'
  const secondaryColor = template.secondaryColor || '#15a862'
  
  // Convert hex to RGB for jsPDF
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 11, g: 109, b: 65 }
  }
  
  const themeRgb = hexToRgb(themeColor)
  const secondaryRgb = hexToRgb(secondaryColor)
  
  // Draw header background with improved spacing
  pdf.setFillColor(themeRgb.r, themeRgb.g, themeRgb.b)
  pdf.rect(0, 0, 210, 38, 'F')
  
  // Add logo if available
  let titleStartX = 10
  if (template.eventLogo) {
    try {
      // Add white background for logo with improved spacing
      pdf.setFillColor(255, 255, 255)
      pdf.rect(10, 6, 28, 28, 'F')
      
      // Add logo image
      pdf.addImage(template.eventLogo, 'PNG', 12, 8, 24, 24)
      titleStartX = 44 // Move title to the right of logo with better spacing
    } catch (error) {
      console.error('Failed to add logo to PDF:', error)
    }
  }
  
  // Event title with improved typography
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(20)
  pdf.setFont('helvetica', 'bold')
  pdf.text(eventTitle.toUpperCase(), titleStartX, 16)
  
  // Ticket type badge with better positioning
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'normal')
  pdf.text(ticketType, titleStartX, 28)
  
  // Removed duplicate QR code from header - keeping only the larger one in body
  
  // Body section
  pdf.setTextColor(0, 0, 0)
  
  // Only show date if provided in template - improved spacing
  if (template.eventDate || eventDate) {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.text('EVENT DATE', 12, 50)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(11)
    pdf.text(eventDate, 12, 55)
  }
  
  // Only show time if provided in template - improved spacing
  if (template.eventTime || eventTime) {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.text('TIME', 12, 63)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(11)
    pdf.text(eventTime, 12, 68)
  }
  
  // Only show venue if provided in template - improved spacing
  if (template.venue || eventVenue) {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.text('VENUE', 85, 50)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(11)
    pdf.text(eventVenue, 85, 55)
  }
  
  // Only show location if provided - better positioning
  if (template.location || eventLocation) {
    pdf.setFontSize(9)
    pdf.text(eventLocation, 85, 60)
  }
  
  // Attendee info - improved spacing and positioning
  if (attendeeName && attendeeName !== 'Guest' && template?.showAttendeeName) {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.text('ATTENDEE', 85, 68)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(11)
    pdf.text(attendeeName, 85, 73)
  }
  
  // Entry time if configured - better spacing
  if (template.entryTime) {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    pdf.text('ENTRY TIME', 12, 76)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.text(template.entryTime, 12, 80)
  }
  
  // Gate details if configured - improved alignment
  if (template.gateDetails) {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    pdf.text('GATE INFO', 85, 76)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.text(template.gateDetails, 85, 80)
  }
  
  // Seat information - improved spacing and alignment
  if ((template.seatAllocation !== 'none' || ticketData?.seatNumber) && ticketData?.seatNumber) {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(9)
    pdf.text('SEAT', 145, 50)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    const seatInfo = [
      ticketData.section && `Section: ${ticketData.section}`,
      ticketData.rowNumber && `Row: ${ticketData.rowNumber}`,
      `Seat: ${ticketData.seatNumber}`
    ].filter(Boolean).join(', ')
    pdf.text(seatInfo, 145, 55)
  }
  
  // Show price if configured - better spacing
  if (template.showPrice && template.ticketTypes?.[0]) {
    const price = ticketData?.price || template.ticketTypes[0].price || 0
    if (price > 0) {
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(9)
      pdf.text('PRICE', 145, 63)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(12)
      const currencySymbol = template.currency === 'INR' ? '₹' : template.currency === 'USD' ? '$' : template.currency + ' '
      pdf.text(`${currencySymbol}${price}`, 145, 68)
    }
  }
  
  // Registration ID if configured to show - improved spacing
  if (template.showRegistrationId && ticketData?.ticketNumber) {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    pdf.text('REG ID', 145, 76)
    pdf.setFont('courier', 'normal')
    pdf.setFontSize(8)
    pdf.text(ticketData.ticketNumber.substring(0, 8), 145, 80)
  }
  
  // Add QR code in body (main QR code) - better positioning and size
  if (qrCodeDataUrl && template.includeQRCode !== false) {
    // Add QR code on the right side of the ticket body with improved spacing
    pdf.setFillColor(255, 255, 255)
    pdf.setDrawColor(220, 220, 220)
    pdf.rect(160, 48, 36, 36, 'FD')
    
    try {
      pdf.addImage(qrCodeDataUrl, 'PNG', 162, 50, 32, 32)
    } catch (error) {
      console.error('Failed to add QR code to PDF:', error)
      pdf.setTextColor(150, 150, 150)
      pdf.setFontSize(8)
      pdf.text('QR CODE', 172, 66)
    }
  }
  
  // Ticket number at bottom - improved spacing and positioning
  if (template.includeBarcodeNumber !== false) {
    pdf.setDrawColor(220, 220, 220)
    pdf.line(12, 84, 198, 84)
    
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(8)
    pdf.setTextColor(120, 120, 120)
    pdf.text('TICKET NUMBER', 12, 90)
    pdf.setFont('courier', 'normal')
    pdf.setFontSize(10)
    pdf.setTextColor(0, 0, 0)
    pdf.text(ticketNumber, 12, 95)
  }
  
  // Footer with terms and conditions - improved spacing
  let footerY = 90
  pdf.setFontSize(7)
  pdf.setTextColor(120, 120, 120)
  
  // Additional Terms first - better spacing
  if (template.additionalTerms && template.additionalTerms.length > 0) {
    pdf.setFont('helvetica', 'bold')
    pdf.text('TERMS & CONDITIONS:', 85, footerY)
    pdf.setFont('helvetica', 'normal')
    footerY += 4
    
    template.additionalTerms.slice(0, 2).forEach((term: string) => {
      if (footerY < 97) {
        pdf.text(`• ${term}`, 85, footerY)
        footerY += 3.5
      }
    })
  }
  
  // Standard terms - improved spacing
  if (template.nonTransferable && footerY < 97) {
    pdf.text('• This ticket is non-transferable', 85, footerY)
    footerY += 3.5
  }
  
  if (template.idProofRequired && footerY < 97) {
    pdf.text('• Valid ID proof required', 85, footerY)
    footerY += 3.5
  }
  
  if (template.ageRestriction && footerY < 97) {
    pdf.text(`• ${template.ageRestriction}`, 85, footerY)
    footerY += 3.5
  }
  
  if (template.refundPolicy && footerY < 97) {
    pdf.text(`• Refund: ${template.refundPolicy}`, 85, footerY)
  }
  
  // Organizer info on the left - better positioning
  if (template.organizerName) {
    pdf.setFontSize(8)
    pdf.setTextColor(120, 120, 120)
    pdf.text(`Organized by ${template.organizerName}`, 12, 95)
    
    if (template.organizerContact) {
      pdf.setFontSize(7)
      pdf.text(template.organizerContact, 12, 98)
    }
  }
  
  return Buffer.from(pdf.output('arraybuffer'))
}
