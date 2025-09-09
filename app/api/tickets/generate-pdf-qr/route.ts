import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import QRCode from 'qrcode'
import { jsPDF } from 'jspdf'
import sharp from 'sharp'
import { encryptTicketData, generateTicketNumber, TicketData } from '@/lib/qr-generator'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    console.log('Generate PDF ticket with QR API called')
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('Auth error:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    console.log('Request body received')
    
    const { 
      eventId, 
      attendeeName,
      templateUrl,
      qrPos
    } = body
    
    console.log('Template URL type:', typeof templateUrl)
    console.log('Template URL starts with:', templateUrl?.substring(0, 50))
    console.log('QR Position from client:', qrPos)
    
    // Default QR position - bottom left corner with proper spacing
    const DEFAULT_QR_POSITION = {
      x: 45,   // Position from left
      y: 1000, // Position from top (near bottom for ~1200px tall template)
      size: 130 // QR code size
    }
    
    // Use client position if provided and valid, otherwise use defaults
    const qrPosition = {
      x: (typeof qrPos?.x === 'number' && qrPos.x >= 0) ? qrPos.x : DEFAULT_QR_POSITION.x,
      y: (typeof qrPos?.y === 'number' && qrPos.y >= 0) ? qrPos.y : DEFAULT_QR_POSITION.y,
      size: (typeof qrPos?.size === 'number' && qrPos.size > 0) ? qrPos.size : DEFAULT_QR_POSITION.size
    }
    
    console.log('Using QR position:', qrPosition)
    console.log('Default position would be:', DEFAULT_QR_POSITION)

    if (!attendeeName || !templateUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: attendeeName and templateUrl are required' },
        { status: 400 }
      )
    }

    // Get event details if eventId is provided
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

    // Generate unique ticket number and IDs
    const ticketNumber = generateTicketNumber(eventId || 'PRED')
    const ticketId = crypto.randomUUID()
    const bookingId = crypto.randomUUID()
    
    // Prepare encrypted QR code data using standard format
    const ticketData: TicketData = {
      ticketId: ticketId,
      eventId: eventId || 'EVENT-001',
      bookingId: bookingId,
      userId: user.id,
      ticketNumber: ticketNumber,
      ticketType: 'General',
      eventDate: eventDetails?.date || new Date().toISOString()
    }
    
    // Encrypt the ticket data for QR code
    const encryptedQrData = await encryptTicketData(ticketData)

    console.log('Generating encrypted QR code for ticket:', ticketNumber)

    // Generate hash for the encrypted QR data
    const qrHash = crypto.createHash('sha256').update(encryptedQrData).digest('hex')
    
    try {
      const { data: qrCode, error: qrError } = await supabase
        .from('qr_codes')
        .insert({
          qr_data: encryptedQrData,
          qr_hash: qrHash,
          qr_type: 'ticket',
          event_id: eventId || null,
          ticket_id: ticketId,
          is_active: true,
          created_by: user.id,
          description: `Predefined ticket: ${ticketNumber}`,
          metadata: {
            attendeeName,
            ticketNumber,
            templateUsed: true,
            generatedAt: new Date().toISOString()
          }
        })
        .select()
        .single()

      if (qrError) {
        console.error('Error saving QR code:', qrError)
      } else {
        console.log('QR code saved to database with ID:', qrCode?.id)
      }

      // Create a booking first (required for tickets table)
      const { data: booking, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          id: bookingId,
          event_id: eventId || '00000000-0000-0000-0000-000000000000',
          user_id: user.id,
          user_email: user.email || 'predefined@ticket.com',
          user_name: attendeeName || 'Guest',
          user_phone: '+1234567890',
          quantity: 1,
          total_amount: 0,
          payment_status: 'completed',
          payment_id: `PRED_${ticketNumber}`,
          booking_status: 'confirmed'
        })
        .select()
        .single()

      if (bookingError) {
        console.error('Error creating booking:', bookingError)
      }

      // Save ticket to tickets table
      if (booking) {
        const { data: ticket, error: ticketError } = await supabase
          .from('tickets')
          .insert({
            id: ticketId,
            booking_id: booking.id,
            event_id: eventId || '00000000-0000-0000-0000-000000000000',
            ticket_number: ticketNumber,
            qr_code: encryptedQrData,
            status: 'valid',
            ticket_type: 'General',
            metadata: {
              generatedBy: user.id,
              generatedAt: new Date().toISOString(),
              templateUsed: true,
              attendeeName: attendeeName,
              qrCodeId: qrCode?.id,
              encrypted: true
            }
          })
          .select()
          .single()

        if (ticketError) {
          console.error('Error saving ticket to database:', ticketError)
        } else {
          console.log('Ticket saved to database with ID:', ticket?.id)
          
          // Update QR code with ticket ID
          if (qrCode?.id && ticket?.id) {
            await supabase
              .from('qr_codes')
              .update({ ticket_id: ticket.id })
              .eq('id', qrCode.id)
          }
        }
      }
    } catch (dbError) {
      console.error('Database error:', dbError)
      // Continue even if database save fails - we can still generate the PDF
    }

    // Generate QR code as buffer with encrypted data
    console.log('Creating QR code buffer with encrypted data...')
    const qrCodeBuffer = await QRCode.toBuffer(encryptedQrData, {
      errorCorrectionLevel: 'M', // Medium error correction for better balance
      type: 'png',
      margin: 2, // More margin for better scanning
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: (qrPosition.size || 150) * 2 // Higher resolution for better scanning
    })

    let finalImageBase64 = templateUrl // Default to original template
    
    try {
      console.log('Processing template image with Sharp...')
      console.log('Template URL length:', templateUrl?.length)
      
      // Check if templateUrl is base64, blob, or a regular URL
      if (!templateUrl || (!templateUrl.startsWith('data:image') && !templateUrl.startsWith('http') && !templateUrl.startsWith('blob:'))) {
        console.log('Invalid template URL format, falling back to client-side')
        throw new Error('Template URL is not a base64 image or valid URL')
      }
      
      // If it's a regular URL or blob URL, we need to handle it differently
      if (templateUrl.startsWith('http') || templateUrl.startsWith('blob:')) {
        console.log('Template is a URL (http or blob), not base64 - falling back to client-side')
        throw new Error('HTTP/Blob URLs not supported server-side, use client-side composition')
      }
      
      // Extract base64 data from template URL
      const base64Data = templateUrl.split(',')[1]
      if (!base64Data) {
        throw new Error('Invalid base64 data')
      }
      
      const templateBuffer = Buffer.from(base64Data, 'base64')
      
      // Get template image metadata
      const templateMetadata = await sharp(templateBuffer).metadata()
      console.log('Template dimensions:', templateMetadata.width, 'x', templateMetadata.height)
      
      // Get actual template dimensions
      const templateWidth = templateMetadata.width || 800
      const templateHeight = templateMetadata.height || 1200
      
      // Use the QR position as-is (it was set based on the actual template)
      // Only ensure it doesn't go outside bounds
      const adjustedQrPosition = {
        x: Math.max(0, Math.min(qrPosition.x, templateWidth - qrPosition.size - 10)),
        y: Math.max(0, Math.min(qrPosition.y, templateHeight - qrPosition.size - 10)),
        size: qrPosition.size
      }
      
      console.log('Template dimensions:', templateWidth, 'x', templateHeight)
      console.log('Original QR position from client:', qrPosition)
      console.log('Adjusted QR position (bounds checked):', adjustedQrPosition)
      
      // Create white background for QR code
      const whiteBackgroundSize = adjustedQrPosition.size + 10
      const whiteBackground = await sharp({
        create: {
          width: whiteBackgroundSize,
          height: whiteBackgroundSize,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        }
      }).png().toBuffer()
      
      // Use adjusted positions
      const qrX = adjustedQrPosition.x
      const qrY = adjustedQrPosition.y
      
      // Validate that QR will be visible
      if (qrX + qrPosition.size > (templateMetadata.width || 800)) {
        console.warn('QR extends beyond template width!')
      }
      if (qrY + qrPosition.size > (templateMetadata.height || 1200)) {
        console.warn('QR extends beyond template height!')
      }
      
      // Resize QR code buffer to exact size needed
      const resizedQrBuffer = await sharp(qrCodeBuffer)
        .resize(adjustedQrPosition.size, adjustedQrPosition.size)
        .png()
        .toBuffer()
      
      // Composite the images: Template + White Background + QR Code
      // Use exact positions without rounding to maintain precision
      const finalImageBuffer = await sharp(templateBuffer)
        .composite([
          {
            input: whiteBackground,
            left: qrX - 5,
            top: qrY - 5
          },
          {
            input: resizedQrBuffer,
            left: qrX,
            top: qrY
          }
        ])
        .png()
        .toBuffer()
      
      // Convert to base64
      finalImageBase64 = `data:image/png;base64,${finalImageBuffer.toString('base64')}`
      console.log('Successfully composited QR code onto template')
      
    } catch (error) {
      console.error('Error processing image with Sharp:', error)
      console.log('Falling back to client-side composition')
      
      // Fallback: Generate QR as data URL to merge client-side
      const qrDataUrl = await QRCode.toDataURL(encryptedQrData, {
        errorCorrectionLevel: 'M', // Medium - best for camera scanning
        type: 'image/png',
        quality: 1,
        margin: 4, // Larger margin for better camera detection
        width: Math.max((qrPosition.size || 150) * 4, 400), // Even higher resolution, minimum 400px
        scale: 10 // Higher scale for crisp definition
      })
      
      // Return both template and QR for client-side composition
      return NextResponse.json({
        success: true,
        ticket: {
          ticketNumber: ticketNumber,
          qrCode: encryptedQrData,
          templateUrl: templateUrl,
          qrDataUrl: qrDataUrl,
          qrPosition: qrPosition,
          needsClientComposition: true,
          metadata: {
            ticketId: ticketId,
            ticketNumber: ticketNumber,
            attendeeName: attendeeName || 'Guest'
          },
          dimensions: { width: 800, height: 1200 }
        },
        message: 'Ticket generated - client-side composition needed'
      })
    }

    // Get the actual image dimensions from Sharp
    let imageWidth = 800
    let imageHeight = 1200
    
    try {
      const base64Data = finalImageBase64.split(',')[1]
      const imgBuffer = Buffer.from(base64Data, 'base64')
      const metadata = await sharp(imgBuffer).metadata()
      imageWidth = metadata.width || 800
      imageHeight = metadata.height || 1200
      console.log('Final image dimensions:', imageWidth, 'x', imageHeight)
    } catch (metaError) {
      console.log('Could not get image metadata, using defaults:', metaError.message)
    }
    
    // Create PDF with the merged image
    console.log('Creating PDF with original dimensions...')
    
    try {
      // Convert pixels to mm (assuming 96 DPI)
      const pixelsToMm = (pixels: number) => (pixels * 25.4) / 96
      const pdfWidth = pixelsToMm(imageWidth)
      const pdfHeight = pixelsToMm(imageHeight)
      
      console.log('PDF dimensions in mm:', pdfWidth, 'x', pdfHeight)
      
      // Create PDF with custom size matching the image
      const pdf = new jsPDF({
        orientation: pdfWidth > pdfHeight ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [pdfWidth, pdfHeight]
      })
      
      // Add the image at original size
      pdf.addImage(finalImageBase64, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST')
      
      // Convert PDF to base64
      const pdfBase64 = pdf.output('datauristring')
      console.log('PDF generated successfully with original dimensions')
      
      return NextResponse.json({
        success: true,
        ticket: {
          ticketNumber: ticketNumber,
          qrCode: encryptedQrData,
          pdfUrl: pdfBase64,
          imageUrl: finalImageBase64,
          metadata: {
            ticketId: ticketId,
            ticketNumber: ticketNumber,
            attendeeName: attendeeName || 'Guest'
          },
          dimensions: { width: imageWidth, height: imageHeight }
        },
        message: `Ticket ${ticketNumber} generated successfully with QR code embedded`
      })
      
    } catch (pdfError) {
      console.error('PDF generation failed:', pdfError)
      
      // Return the image for client-side PDF generation
      return NextResponse.json({
        success: true,
        ticket: {
          ticketNumber: ticketNumber,
          qrCode: encryptedQrData,
          imageUrl: finalImageBase64,
          needsClientPDF: true,
          metadata: {
            ticketId: ticketId,
            ticketNumber: ticketNumber,
            attendeeName: attendeeName || 'Guest'
          },
          dimensions: { width: imageWidth, height: imageHeight }
        },
        message: 'Ticket generated - client PDF generation needed'
      })
    }

  } catch (error) {
    console.error('Error generating PDF ticket:', error)
    return NextResponse.json(
      { error: 'Failed to generate ticket: ' + (error.message || 'Unknown error') },
      { status: 500 }
    )
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, { 
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  })
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    error: 'Method not allowed. Use POST to generate PDF tickets.' 
  }, { status: 405 })
}