import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import QRCode from 'qrcode'
import { createCanvas, loadImage } from 'canvas'

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

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const { 
      templateId, 
      ticketData,
      eventId 
    } = await request.json()
    
    if (!templateId || !ticketData) {
      return NextResponse.json(
        { error: 'Template ID and ticket data are required' },
        { status: 400 }
      )
    }

    // Get the predefined template
    const { data: template, error: templateError } = await supabase
      .from('predefined_tickets')
      .select('*')
      .eq('id', templateId)
      .single()

    if (templateError || !template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      )
    }

    // Create ticket record in database
    const ticketNumber = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
    
    // Prepare QR code data with all necessary information for verification
    const qrCodeData = {
      ticketId: ticketNumber,
      ticketNumber: ticketNumber,
      eventId: eventId || ticketData.eventId,
      eventName: ticketData.eventName || 'Event',
      date: ticketData.date || new Date().toISOString(),
      venue: ticketData.venue || 'Venue',
      attendee: ticketData.attendeeName || 'Guest',
      email: ticketData.email || '',
      phone: ticketData.phone || '',
      seatNumber: ticketData.seatNumber || null,
      section: ticketData.section || null,
      ticketType: ticketData.ticketType || template.ticket_type || 'Bronze',
      status: 'valid',
      generatedAt: new Date().toISOString(),
      templateId: templateId,
      verificationCode: Math.random().toString(36).substr(2, 9).toUpperCase()
    }

    // Store ticket in database
    const { data: newTicket, error: ticketError } = await supabase
      .from('tickets')
      .insert({
        ticket_number: ticketNumber,
        event_id: eventId || null,
        status: 'valid',
        qr_code: JSON.stringify(qrCodeData),
        ticket_type: ticketData.ticketType || template.ticket_type || 'Bronze',
        metadata: {
          ...ticketData,
          templateId: templateId,
          generatedAt: new Date().toISOString(),
          generatedBy: user.id
        }
      })
      .select()
      .single()

    if (ticketError) {
      console.error('Error creating ticket:', ticketError)
      return NextResponse.json(
        { error: 'Failed to create ticket' },
        { status: 500 }
      )
    }

    // Generate QR code with high quality settings for better readability
    const qrDataUrl = await QRCode.toDataURL(JSON.stringify(qrCodeData), {
      errorCorrectionLevel: 'H', // Highest error correction
      type: 'image/png',
      quality: 1.0,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: template.qr_position?.size || 150
    })

    // Load template image and overlay QR code
    const canvas = createCanvas(800, 1200) // Standard ticket size
    const ctx = canvas.getContext('2d')

    try {
      // Load template image
      const templateImage = await loadImage(template.template_url)
      
      // Calculate dimensions to fit canvas
      const scale = Math.min(
        canvas.width / templateImage.width,
        canvas.height / templateImage.height
      )
      
      const scaledWidth = templateImage.width * scale
      const scaledHeight = templateImage.height * scale
      
      // Center the image
      const x = (canvas.width - scaledWidth) / 2
      const y = (canvas.height - scaledHeight) / 2
      
      // Draw template
      ctx.drawImage(templateImage, x, y, scaledWidth, scaledHeight)
      
      // Load and draw QR code
      const qrImage = await loadImage(qrDataUrl)
      const qrSize = template.qr_position?.size || 150
      const qrX = template.qr_position?.x || 50
      const qrY = template.qr_position?.y || 50
      
      // Add white background for QR code (improves readability)
      ctx.fillStyle = 'white'
      ctx.fillRect(qrX - 5, qrY - 5, qrSize + 10, qrSize + 10)
      
      // Draw QR code
      ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize)
      
      // Add ticket information text if positions are defined
      ctx.fillStyle = '#000000'
      ctx.font = 'bold 24px Arial'
      
      // Add ticket number
      if (ticketData.showTicketNumber !== false) {
        ctx.fillText(`Ticket: ${ticketNumber}`, 50, canvas.height - 100)
      }
      
      // Add attendee name
      if (ticketData.attendeeName) {
        ctx.font = '20px Arial'
        ctx.fillText(`Name: ${ticketData.attendeeName}`, 50, canvas.height - 70)
      }
      
      // Add event details
      if (ticketData.eventName) {
        ctx.fillText(`Event: ${ticketData.eventName}`, 50, canvas.height - 40)
      }
      
      // Convert canvas to buffer
      const buffer = canvas.toBuffer('image/png')
      const base64Image = `data:image/png;base64,${buffer.toString('base64')}`
      
      return NextResponse.json({
        success: true,
        ticket: {
          id: newTicket.id,
          ticketNumber: ticketNumber,
          qrCode: JSON.stringify(qrCodeData),
          imageUrl: base64Image,
          metadata: qrCodeData
        },
        message: 'Ticket generated successfully with predefined template'
      })
      
    } catch (imageError) {
      console.error('Error processing images:', imageError)
      
      // Fallback: Return just the QR code if template processing fails
      return NextResponse.json({
        success: true,
        ticket: {
          id: newTicket.id,
          ticketNumber: ticketNumber,
          qrCode: JSON.stringify(qrCodeData),
          qrCodeUrl: qrDataUrl,
          metadata: qrCodeData
        },
        message: 'Ticket generated (template processing failed, QR code only)',
        warning: 'Template image could not be processed'
      })
    }
    
  } catch (error) {
    console.error('Error generating ticket with template:', error)
    return NextResponse.json(
      { error: 'Failed to generate ticket' },
      { status: 500 }
    )
  }
}

// GET endpoint to retrieve ticket with template
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    const ticketId = searchParams.get('ticketId')
    
    if (!ticketId) {
      return NextResponse.json(
        { error: 'Ticket ID is required' },
        { status: 400 }
      )
    }

    // Get ticket
    const { data: ticket, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', ticketId)
      .single()

    if (error || !ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      )
    }

    // Parse QR code for verification
    let qrData = {}
    try {
      qrData = typeof ticket.qr_code === 'string' 
        ? JSON.parse(ticket.qr_code) 
        : ticket.qr_code
    } catch (e) {
      console.error('Error parsing QR code:', e)
    }

    return NextResponse.json({
      success: true,
      ticket: {
        id: ticket.id,
        ticketNumber: ticket.ticket_number,
        status: ticket.status,
        qrCode: ticket.qr_code,
        metadata: ticket.metadata,
        qrData: qrData
      }
    })
    
  } catch (error) {
    console.error('Error retrieving ticket:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve ticket' },
      { status: 500 }
    )
  }
}