import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import QRCode from 'qrcode'
import { generateTicketNumber, TicketData } from '@/lib/qr-generator'
import crypto from 'crypto'
import sharp from 'sharp'
import JSZip from 'jszip'
import { jsPDF } from 'jspdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 60 seconds max for Vercel

interface BulkTicketRequest {
  eventId: string
  templateUrl: string
  qrPosition: { x: number; y: number; size: number }
  quantity: number
  ticketType: 'Gold' | 'Silver' | 'Bronze'
  templateName: string
  batchSize?: number
  namePrefix?: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: BulkTicketRequest
    try {
      body = await request.json()
    } catch (jsonError) {
      return NextResponse.json({ 
        error: 'Invalid JSON in request body',
        details: 'Request body must be valid JSON'
      }, { status: 400 })
    }
    
    const { 
      eventId, 
      templateUrl, 
      qrPosition, 
      quantity, 
      ticketType = 'Bronze',
      templateName = 'Bulk Template',
      batchSize = 25,
      namePrefix = 'Guest'
    } = body

    if (!templateUrl || !quantity || quantity < 1) {
      return NextResponse.json(
        { error: 'Invalid parameters: templateUrl and quantity are required' },
        { status: 400 }
      )
    }

    // Increase maximum quantity limit for bulk operations
    const maxQuantity = 5000
    if (quantity > maxQuantity) {
      return NextResponse.json(
        { error: `Maximum ${maxQuantity} tickets per request` },
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

    // Generate tickets
    const tickets = []
    const errors = []
    const zip = new JSZip()
    const ticketsFolder = zip.folder('tickets')
    
    // Optimize batch size based on quantity
    let actualBatchSize: number
    if (quantity <= 100) {
      actualBatchSize = Math.min(batchSize, 10) // Small batches for small quantities
    } else if (quantity <= 500) {
      actualBatchSize = Math.min(batchSize, 25) // Medium batches for medium quantities
    } else {
      actualBatchSize = Math.min(batchSize, 50) // Larger batches for large quantities
    }
    
    const batches = Math.ceil(quantity / actualBatchSize)
    console.log(`Processing ${quantity} tickets in ${batches} batches of ${actualBatchSize} each`)
    
    for (let batch = 0; batch < batches; batch++) {
      const batchStart = batch * actualBatchSize
      const batchEnd = Math.min(batchStart + actualBatchSize, quantity)
      const batchTickets = []
      
      console.log(`Processing batch ${batch + 1}/${batches}`)
      
      for (let i = batchStart; i < batchEnd; i++) {
        try {
          const ticketNum = i + 1
          const ticketNumber = generateTicketNumber(eventId || 'BULK') + `-${String(ticketNum).padStart(4, '0')}`
          const ticketId = crypto.randomUUID()
          const bookingId = crypto.randomUUID()
          const attendeeName = `${namePrefix}-${String(ticketNum).padStart(4, '0')}`
          
          // Create ticket data - using simple ticket number for QR
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
          
          // Add to ZIP
          const pdfBuffer = Buffer.from(pdf.output('arraybuffer'))
          if (ticketsFolder) {
            ticketsFolder.file(`ticket-${ticketNumber}.pdf`, pdfBuffer)
          }
          
          // Save to database - only essential data for tracking
          batchTickets.push({
            ticketId,
            bookingId,
            ticketNumber,
            attendeeName,
            qrData,
            qrHash
          })
          
          tickets.push({
            ticketNumber,
            attendeeName,
            status: 'generated'
          })
          
        } catch (error: any) {
          errors.push({
            ticket: i + 1,
            error: error.message || 'Unknown error'
          })
        }
      }
      
      // Batch save to database with error handling
      if (batchTickets.length > 0) {
        try {
          console.log(`Saving batch ${batch + 1} with ${batchTickets.length} tickets to database...`)
          const bookingsToInsert = batchTickets.map(t => ({
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
          
          const { error: bookingError } = await supabase.from('bookings').insert(bookingsToInsert)
          if (bookingError) {
            console.error('Booking insert error (non-fatal):', bookingError)
          }
          
          const ticketsToInsert = batchTickets.map(t => ({
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
              attendeeName: t.attendeeName
            }
          }))
          
          const { error: ticketError } = await supabase.from('tickets').insert(ticketsToInsert)
          if (ticketError) {
            console.error('Ticket insert error (non-fatal):', ticketError)
          }
          
          const qrCodesToInsert = batchTickets.map(t => ({
            qr_data: t.qrData,
            qr_hash: t.qrHash,
            qr_type: 'ticket',
            event_id: eventId || null,
            ticket_id: t.ticketId,
            is_active: true,
            created_by: user.id,
            description: `Bulk ticket: ${t.ticketNumber}`,
            metadata: {
              attendeeName: t.attendeeName,
              ticketNumber: t.ticketNumber,
              bulkGeneration: true,
              batchNumber: batch + 1
            }
          }))
          
          const { error: qrError } = await supabase.from('qr_codes').insert(qrCodesToInsert)
          if (qrError) {
            console.error('QR insert error (non-fatal):', qrError)
          }
          
        } catch (dbError: any) {
          console.error('Database batch error (non-fatal):', dbError?.message || dbError)
          // Continue processing even if database save fails
        }
      }
      
      // Add minimal delay between batches for large quantities
      if (batch < batches - 1) {
        // Shorter delays for larger batches to stay within timeout
        const delayMs = quantity > 100 ? 50 : 100
        await new Promise(resolve => setTimeout(resolve, delayMs))
      }
    }
    
    // Generate ZIP file as buffer
    console.log('Creating ZIP file...')
    console.log(`ZIP contains ${tickets.length} tickets`)
    
    // Ensure we have content to ZIP
    if (tickets.length === 0) {
      console.error('No tickets to include in ZIP')
      return NextResponse.json(
        { 
          success: false,
          error: 'No tickets were generated',
          details: 'Unable to create ZIP file without content'
        },
        { status: 400 }
      )
    }
    
    let zipBuffer: Buffer
    try {
      zipBuffer = await zip.generateAsync({ 
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      })
    } catch (zipError: any) {
      console.error('ZIP generation error:', zipError)
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to create ZIP file',
          details: zipError?.message || 'ZIP generation failed'
        },
        { status: 500 }
      )
    }
    
    console.log(`Generated ${tickets.length} tickets, ZIP size: ${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB`)
    
    // Ensure ZIP buffer is valid
    if (!zipBuffer || zipBuffer.length === 0) {
      console.error('ZIP buffer is empty')
      return NextResponse.json(
        { 
          success: false,
          error: 'ZIP file is empty',
          details: 'Generated ZIP file has no content'
        },
        { status: 500 }
      )
    }
    
    // Return ZIP file as binary response with proper headers
    const response = new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="tickets-bulk-${Date.now()}.zip"`,
        'Content-Length': String(zipBuffer.length),
        'X-Generated-Count': String(tickets.length),
        'X-Failed-Count': String(errors.length),
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
    
    console.log('Sending ZIP response with headers:', {
      contentType: 'application/zip',
      contentLength: zipBuffer.length,
      generatedCount: tickets.length
    })
    
    return response
    
  } catch (error: any) {
    console.error('Bulk generation error:', error)
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to generate bulk tickets',
        details: error?.message || 'Unknown error'
      },
      { status: 500 }
    )
  }
}