import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import QRCode from 'qrcode'
import { jsPDF } from 'jspdf'
import sharp from 'sharp'
import { generateTicketNumber } from '@/lib/qr-generator'
import crypto from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(request: NextRequest) {
  try {
    console.log('Generate PDF ticket API - Simplified version')
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      eventId, 
      attendeeName,
      templateUrl,
      qrPos
    } = body
    
    if (!attendeeName || !templateUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: attendeeName and templateUrl' },
        { status: 400 }
      )
    }

    // Generate unique ticket number
    const ticketNumber = generateTicketNumber(eventId || 'PDF')
    const ticketId = crypto.randomUUID()
    
    // Use simple ticket number as QR data - much more readable!
    const qrData = ticketNumber
    
    console.log('Ticket Number:', ticketNumber)
    console.log('QR Data (simple):', qrData)

    // Save ticket using direct API that bypasses RLS
    try {
      // For predefined tickets without event, we'll use a default event from DB
      let actualEventId = eventId
      
      // If no event ID or invalid, get a default one
      if (!eventId || eventId === 'undefined' || eventId === 'null' || eventId === '') {
        const { data: defaultEvent } = await supabase
          .from('events')
          .select('id')
          .limit(1)
          .single()
        
        if (defaultEvent) {
          actualEventId = defaultEvent.id
          console.log('Using default event for ticket storage:', actualEventId)
        }
      }
      
      const saveResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/tickets/save-direct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketNumber,
          eventId: actualEventId,
          attendeeName,
          qrCode: qrData, // Save the encrypted QR data
          ticketType: body.ticketType || 'General'
        })
      })
      
      const saveResult = await saveResponse.json()
      if (saveResult.success) {
        console.log('Ticket saved to database via direct API')
      } else {
        console.log('Direct save failed:', saveResult.error)
      }
    } catch (dbError) {
      console.log('Database save skipped:', dbError)
      // Continue without database
    }

    // Generate QR code buffer with larger size
    const qrCodeBuffer = await QRCode.toBuffer(qrData, {
      errorCorrectionLevel: 'M',
      type: 'png',
      margin: 3,
      width: 400, // Larger for better quality
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    })
    
    console.log('QR Code generated, size:', qrCodeBuffer.length, 'bytes')

    let finalImageBase64 = templateUrl
    
    // Process template with QR code if it's base64
    if (templateUrl.startsWith('data:image')) {
      try {
        const base64Data = templateUrl.split(',')[1]
        const templateBuffer = Buffer.from(base64Data, 'base64')
        
        // Resize template to standard size 1200x900
        const standardWidth = 1200
        const standardHeight = 900
        
        // Resize template to standard dimensions
        const resizedTemplate = await sharp(templateBuffer)
          .resize(standardWidth, standardHeight, {
            fit: 'fill',
            position: 'center'
          })
          .toBuffer()
        
        const width = standardWidth
        const height = standardHeight
        
        // Use provided position or defaults (adjusted for 1200x900)
        // If position provided from client, use it; otherwise use defaults
        const qrPosition = {
          x: (qrPos?.x !== undefined && qrPos.x >= 0) ? qrPos.x : 850,  // Default: right side
          y: (qrPos?.y !== undefined && qrPos.y >= 0) ? qrPos.y : 600,  // Default: near bottom
          size: (qrPos?.size !== undefined && qrPos.size > 0) ? qrPos.size : 200 // Larger for scanning
        }
        
        console.log('QR Position:', qrPosition)
        
        // Add white background to QR with border
        const qrSize = qrPosition.size
        const padding = 15
        
        // Create white background square
        const whiteBg = await sharp({
          create: {
            width: qrSize + (padding * 2),
            height: qrSize + (padding * 2),
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 1 }
          }
        }).png().toBuffer()
        
        // Resize QR and composite on white background
        const resizedQR = await sharp(qrCodeBuffer)
          .resize(qrSize, qrSize, {
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 1 }
          })
          .toBuffer()
        
        const qrWithBg = await sharp(whiteBg)
          .composite([{
            input: resizedQR,
            left: padding,
            top: padding
          }])
          .toBuffer()
        
        console.log('QR with background created')
        
        // Ensure QR position is within bounds
        const finalX = Math.min(Math.max(0, qrPosition.x), standardWidth - qrPosition.size - 30)
        const finalY = Math.min(Math.max(0, qrPosition.y), standardHeight - qrPosition.size - 30)
        
        console.log('Final QR position:', finalX, finalY)
        
        // Create SVG text overlay for ticket number (no background, smaller font)
        const ticketNumberSvg = Buffer.from(`
          <svg width="${standardWidth}" height="60">
            <text x="${standardWidth/2}" y="20" font-family="Arial, sans-serif" font-size="11" fill="#333333" text-anchor="middle">
              Ticket Number
            </text>
            <text x="${standardWidth/2}" y="40" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#000000" text-anchor="middle">
              ${ticketNumber}
            </text>
          </svg>
        `)
        
        // Composite QR and ticket number on resized template
        const composite = await sharp(resizedTemplate)
          .composite([
            {
              input: qrWithBg,
              left: finalX,
              top: finalY
            },
            {
              input: ticketNumberSvg,
              left: 0,
              top: standardHeight - 60, // Position at bottom (adjusted for smaller height)
              blend: 'over'
            }
          ])
          .toBuffer()
        
        finalImageBase64 = `data:image/png;base64,${composite.toString('base64')}`
        console.log('QR code and ticket number added to template')
      } catch (err) {
        console.error('Template processing error:', err)
        // Use original template if processing fails
      }
    }

    // Generate PDF with custom size for 1200x900 image
    // Convert pixels to mm (assuming 96 DPI)
    const widthMM = (1200 / 96) * 25.4  // ~317mm
    const heightMM = (900 / 96) * 25.4   // ~238mm
    
    const pdf = new jsPDF({
      orientation: widthMM > heightMM ? 'landscape' : 'portrait',
      unit: 'mm',
      format: [widthMM, heightMM]
    })
    
    // Add the image to PDF filling the entire page
    if (finalImageBase64.startsWith('data:image')) {
      pdf.addImage(finalImageBase64, 'PNG', 0, 0, widthMM, heightMM)
    }
    
    // Add ticket info text (positioned for new size)
    pdf.setFontSize(8)
    pdf.text(`Ticket: ${ticketNumber}`, 10, heightMM - 10)
    
    const pdfBuffer = Buffer.from(pdf.output('arraybuffer'))
    const pdfBase64 = `data:application/pdf;base64,${pdfBuffer.toString('base64')}`
    
    console.log('PDF generated successfully')

    return NextResponse.json({
      success: true,
      ticket: {
        ticketNumber,
        qrData,
        imageWithQR: finalImageBase64,
        pdfData: pdfBase64
      },
      message: 'Ticket generated successfully'
    })

  } catch (error) {
    console.error('Error generating PDF ticket:', error)
    return NextResponse.json(
      { 
        error: 'Failed to generate ticket',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}