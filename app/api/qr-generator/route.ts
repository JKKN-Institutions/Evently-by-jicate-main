import { NextRequest, NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { text, options = {}, storeInDb = true } = await request.json()
    
    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required and must be a string' },
        { status: 400 }
      )
    }

    // Check authentication if storing in database
    let currentUser = null
    if (storeInDb) {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return NextResponse.json(
          { error: 'Authentication required to store QR codes' },
          { status: 401 }
        )
      }
      currentUser = user
    }

    // Default options
    const defaultOptions = {
      errorCorrectionLevel: 'H' as const,
      type: 'image/png' as const,
      quality: 0.92,
      margin: 4,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: 512
    }

    // Merge with provided options
    const qrOptions = { ...defaultOptions, ...options }
    
    // Validate size limits
    if (qrOptions.width < 64 || qrOptions.width > 2048) {
      return NextResponse.json(
        { error: 'Width must be between 64 and 2048 pixels' },
        { status: 400 }
      )
    }

    // Generate QR code hash for database storage
    const qrHash = createHash('sha256').update(text).digest('hex')
    
    // Generate QR code
    const qrDataUrl = await QRCode.toDataURL(text, qrOptions)
    
    // Get base64 data for additional info
    const base64Data = qrDataUrl.split(',')[1]
    const buffer = Buffer.from(base64Data, 'base64')
    
    let qrCodeRecord = null
    
    // Store in database if requested
    if (storeInDb && currentUser) {
      try {
        // Check if QR code already exists
        const { data: existingQR } = await supabase
          .from('qr_codes')
          .select('id, created_at')
          .eq('qr_hash', qrHash)
          .single()
        
        if (existingQR) {
          qrCodeRecord = existingQR
        } else {
          // Create new QR code record
          const { data: newQR, error: qrError } = await supabase
            .from('qr_codes')
            .insert({
              qr_data: text,
              qr_hash: qrHash,
              qr_type: 'generic',
              description: `QR code generated via API`,
              created_by: currentUser.id,
              metadata: {
                options: qrOptions,
                generated_via: 'api',
                file_size: buffer.length
              }
            })
            .select('id, created_at')
            .single()
          
          if (qrError) {
            console.error('Error storing QR code:', qrError)
            // Don't fail the request if DB storage fails
          } else {
            qrCodeRecord = newQR
          }
        }
      } catch (error) {
        console.error('Database error:', error)
        // Continue without DB storage if there's an error
      }
    }
    
    return NextResponse.json({
      success: true,
      qrCode: qrDataUrl,
      qrCodeId: qrCodeRecord?.id || null,
      info: {
        text: text,
        format: 'PNG',
        size: qrOptions.width,
        errorCorrectionLevel: qrOptions.errorCorrectionLevel,
        dataLength: text.length,
        fileSize: buffer.length,
        qrHash: qrHash,
        storedInDb: qrCodeRecord !== null,
        generatedAt: new Date().toISOString(),
        ...(qrCodeRecord && { createdAt: qrCodeRecord.created_at })
      }
    })

  } catch (error) {
    console.error('QR generation error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to generate QR code',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const text = searchParams.get('text')
  const size = parseInt(searchParams.get('size') || '512')
  const format = searchParams.get('format') || 'png'
  
  if (!text) {
    return NextResponse.json(
      { error: 'Text parameter is required' },
      { status: 400 }
    )
  }

  try {
    const options = {
      errorCorrectionLevel: 'H' as const,
      type: 'image/png' as const,
      quality: 0.92,
      margin: 4,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      },
      width: Math.min(Math.max(size, 64), 2048) // Clamp between 64 and 2048
    }

    if (format === 'download') {
      // Return as downloadable file
      const buffer = await QRCode.toBuffer(text, options)
      
      const headers = new Headers()
      headers.set('Content-Type', 'image/png')
      headers.set('Content-Disposition', `attachment; filename="qr-code-${Date.now()}.png"`)
      headers.set('Content-Length', buffer.length.toString())
      
      return new NextResponse(buffer, { headers })
    } else {
      // Return as data URL
      const qrDataUrl = await QRCode.toDataURL(text, options)
      
      return NextResponse.json({
        success: true,
        qrCode: qrDataUrl,
        text: text,
        size: options.width
      })
    }

  } catch (error) {
    console.error('QR generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate QR code' },
      { status: 500 }
    )
  }
}