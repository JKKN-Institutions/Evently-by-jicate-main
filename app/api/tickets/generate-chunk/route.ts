import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import QRCode from 'qrcode'
import { generateTicketNumber } from '@/lib/qr-generator'
import crypto from 'crypto'
import sharp from 'sharp'
import { jsPDF } from 'jspdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30 // 30 seconds per chunk

interface ChunkRequest {
  eventId: string
  templateUrl: string
  qrPosition: { x: number; y: number; size: number }
  startIndex: number
  endIndex: number
  ticketType: 'Gold' | 'Silver' | 'Bronze'
  templateName: string
  namePrefix?: string
  sessionId: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: ChunkRequest = await request.json()
    const { 
      eventId, 
      templateUrl, 
      qrPosition, 
      startIndex,
      endIndex,
      ticketType = 'Bronze',
      templateName = 'Bulk Template',
      namePrefix = 'Guest',
      sessionId
    } = body

    const quantity = endIndex - startIndex

    if (!templateUrl || quantity < 1) {
      return NextResponse.json(
        { error: 'Invalid parameters' },
        { status: 400 }
      )
    }

    // Get event details if provided
    let eventDetails = null
    if (eventId) {
      const { data: event } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single()
      
      if (event) {
        eventDetails = event
      }
    }

    // Prepare template buffer
    let templateBuffer: Buffer | null = null
    
    if (templateUrl.startsWith('data:image')) {
      const base64Data = templateUrl.split(',')[1]
      if (base64Data) {
        templateBuffer = Buffer.from(base64Data, 'base64')
      }
    }

    if (!templateBuffer) {
      return NextResponse.json(
        { error: 'Invalid template format' },
        { status: 400 }
      )
    }

    // Generate tickets for this chunk
    const tickets = []
    const pdfBuffers = []
    
    console.log(`Processing chunk: tickets ${startIndex + 1} to ${endIndex}`)
    
    for (let i = startIndex; i < endIndex; i++) {
      try {
        const ticketNum = i + 1
        const ticketNumber = generateTicketNumber(eventId || 'BULK') + `-${String(ticketNum).padStart(4, '0')}`
        const ticketId = crypto.randomUUID()
        const bookingId = crypto.randomUUID()
        const attendeeName = `${namePrefix}-${String(ticketNum).padStart(4, '0')}`
        
        // Create ticket data
        const qrData = ticketNumber
        const qrHash = crypto.createHash('sha256').update(qrData).digest('hex')
        
        // Generate QR code
        const qrCodeBuffer = await QRCode.toBuffer(qrData, {
          errorCorrectionLevel: 'M',
          type: 'png',
          margin: 2,
          width: qrPosition.size * 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        })
        
        // Create white background for QR
        const whiteBackgroundSize = qrPosition.size + 10
        const whiteBackground = await sharp({
          create: {
            width: whiteBackgroundSize,
            height: whiteBackgroundSize,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 1 }
          }
        }).png().toBuffer()
        
        const resizedQrBuffer = await sharp(qrCodeBuffer)
          .resize(qrPosition.size, qrPosition.size)
          .png()
          .toBuffer()
        
        // Get template dimensions
        const templateMetadata = await sharp(templateBuffer).metadata()
        const templateWidth = templateMetadata.width || 1200
        const templateHeight = templateMetadata.height || 900
        
        // Fix QR position if outside bounds
        const safeQrPosition = {
          x: Math.min(Math.max(0, qrPosition.x), templateWidth - qrPosition.size),
          y: Math.min(Math.max(0, qrPosition.y), templateHeight - qrPosition.size),
          size: qrPosition.size
        }
        
        if (qrPosition.y >= templateHeight) {
          safeQrPosition.x = 50
          safeQrPosition.y = templateHeight - qrPosition.size - 50
        }
        
        // Composite QR on template
        const finalImageBuffer = await sharp(templateBuffer)
          .composite([
            {
              input: whiteBackground,
              left: safeQrPosition.x - 5,
              top: safeQrPosition.y - 5
            },
            {
              input: resizedQrBuffer,
              left: safeQrPosition.x,
              top: safeQrPosition.y
            }
          ])
          .png()
          .toBuffer()
        
        // Convert to PDF
        const pdf = new jsPDF({
          orientation: templateWidth > templateHeight ? 'landscape' : 'portrait',
          unit: 'px',
          format: [templateWidth, templateHeight]
        })
        
        const imageBase64 = `data:image/png;base64,${finalImageBuffer.toString('base64')}`
        pdf.addImage(imageBase64, 'PNG', 0, 0, templateWidth, templateHeight)
        
        // Add ticket number text
        try {
          pdf.setFont('helvetica', 'bold')
          pdf.setFillColor(255, 255, 255)
          pdf.rect(templateWidth - 250, templateHeight - 45, 230, 35, 'F')
          pdf.setDrawColor(0, 0, 0)
          pdf.setLineWidth(1)
          pdf.rect(templateWidth - 250, templateHeight - 45, 230, 35, 'S')
          pdf.setFontSize(16)
          pdf.setTextColor(0, 0, 0)
          pdf.text(`Ticket: ${ticketNumber}`, templateWidth - 25, templateHeight - 25, { align: 'right' })
        } catch (textError) {
          // Silent error handling
        }
        
        // Get PDF buffer
        const pdfBuffer = Buffer.from(pdf.output('arraybuffer'))
        
        pdfBuffers.push({
          filename: `ticket-${ticketNumber}.pdf`,
          buffer: pdfBuffer
        })
        
        // Save to database
        tickets.push({
          ticketId,
          bookingId,
          ticketNumber,
          attendeeName,
          qrData,
          qrHash
        })
        
      } catch (error: any) {
        console.error(`Error generating ticket ${i + 1}:`, error)
      }
    }
    
    // Save to database if needed
    if (tickets.length > 0) {
      try {
        const bookingsToInsert = tickets.map(t => ({
          id: t.bookingId,
          event_id: eventId || '00000000-0000-0000-0000-000000000000',
          user_id: user.id,
          user_email: user.email || 'bulk@ticket.com',
          user_name: t.attendeeName,
          user_phone: '+1234567890',
          quantity: 1,
          total_amount: 0,
          payment_status: 'completed',
          payment_id: `BULK_${t.ticketNumber}`,
          booking_status: 'confirmed'
        }))
        
        await supabase.from('bookings').insert(bookingsToInsert)
        
        const ticketsToInsert = tickets.map(t => ({
          id: t.ticketId,
          booking_id: t.bookingId,
          event_id: eventId || '00000000-0000-0000-0000-000000000000',
          ticket_number: t.ticketNumber,
          qr_code: t.qrData,
          status: 'valid',
          ticket_type: ticketType,
          metadata: {
            generatedBy: user.id,
            generatedAt: new Date().toISOString(),
            bulkGeneration: true,
            templateName: templateName,
            attendeeName: t.attendeeName,
            sessionId: sessionId,
            chunkIndex: `${startIndex}-${endIndex}`
          }
        }))
        
        await supabase.from('tickets').insert(ticketsToInsert)
        
      } catch (dbError: any) {
        console.error('Database error (non-fatal):', dbError?.message || dbError)
      }
    }
    
    return NextResponse.json({
      success: true,
      chunkIndex: `${startIndex}-${endIndex}`,
      ticketsGenerated: tickets.length,
      pdfBuffers: pdfBuffers.map(p => ({
        filename: p.filename,
        data: p.buffer.toString('base64')
      })),
      sessionId: sessionId
    })
    
  } catch (error: any) {
    console.error('Chunk generation error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to generate chunk',
        details: error?.message || 'Unknown error'
      },
      { status: 500 }
    )
  }
}