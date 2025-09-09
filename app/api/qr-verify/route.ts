import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createHash } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { qrData, eventId = null, ticketId = null, deviceInfo = {} } = await request.json()
    
    if (!qrData || typeof qrData !== 'string') {
      return NextResponse.json(
        { error: 'QR data is required and must be a string' },
        { status: 400 }
      )
    }

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required for QR verification' },
        { status: 401 }
      )
    }

    // Get user profile to check permissions
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'organizer'].includes(profile.role)) {
      return NextResponse.json(
        { error: 'Only admins and organizers can verify QR codes' },
        { status: 403 }
      )
    }

    // Generate QR hash
    const qrHash = createHash('sha256').update(qrData).digest('hex')
    
    console.log('Verifying QR code:', { qrData: qrData.substring(0, 50) + '...', qrHash })

    // Check if QR code exists in database
    const { data: qrCode, error: qrError } = await supabase
      .from('qr_codes')
      .select('*')
      .eq('qr_hash', qrHash)
      .single()

    if (qrError || !qrCode) {
      // Record the failed scan attempt
      const { error: scanError } = await supabase
        .from('qr_scan_records')
        .insert({
          qr_code_id: null,
          qr_data_hash: qrHash,
          scan_result: 'invalid',
          scan_message: 'QR code not found in database',
          scanned_by: user.id,
          scanner_device_info: deviceInfo,
          event_id: eventId,
          ticket_id: ticketId,
          metadata: {
            attempted_qr_data: qrData.substring(0, 100), // Store partial data for debugging
            error_details: qrError?.message
          }
        })

      if (scanError) {
        console.error('Error recording failed scan:', scanError)
      }

      return NextResponse.json({
        success: false,
        result: 'invalid',
        message: 'Invalid QR code - not found in database',
        alreadyScanned: false,
        scanId: null
      })
    }

    // Check if QR code is active and not expired
    if (!qrCode.is_active) {
      const { error: scanError } = await supabase
        .from('qr_scan_records')
        .insert({
          qr_code_id: qrCode.id,
          qr_data_hash: qrHash,
          scan_result: 'invalid',
          scan_message: 'QR code is inactive',
          scanned_by: user.id,
          scanner_device_info: deviceInfo,
          event_id: eventId || qrCode.event_id,
          ticket_id: ticketId || qrCode.ticket_id
        })

      return NextResponse.json({
        success: false,
        result: 'invalid',
        message: 'QR code is inactive',
        alreadyScanned: false,
        scanId: null
      })
    }

    if (qrCode.expires_at && new Date(qrCode.expires_at) < new Date()) {
      const { error: scanError } = await supabase
        .from('qr_scan_records')
        .insert({
          qr_code_id: qrCode.id,
          qr_data_hash: qrHash,
          scan_result: 'expired',
          scan_message: 'QR code has expired',
          scanned_by: user.id,
          scanner_device_info: deviceInfo,
          event_id: eventId || qrCode.event_id,
          ticket_id: ticketId || qrCode.ticket_id
        })

      return NextResponse.json({
        success: false,
        result: 'expired',
        message: `QR code expired on ${new Date(qrCode.expires_at).toLocaleString()}`,
        alreadyScanned: false,
        scanId: null
      })
    }

    // Check if already scanned (for ticket QR codes)
    const { data: previousScans, error: scanCheckError } = await supabase
      .from('qr_scan_records')
      .select('*')
      .eq('qr_code_id', qrCode.id)
      .eq('scan_result', 'success')
      .order('created_at', { ascending: false })

    if (scanCheckError) {
      console.error('Error checking previous scans:', scanCheckError)
    }

    const isAlreadyScanned = previousScans && previousScans.length > 0
    const lastScan = isAlreadyScanned ? previousScans[0] : null

    let scanResult = 'success'
    let scanMessage = 'QR code verified successfully'

    // For ticket QR codes, check if already scanned
    if (qrCode.qr_type === 'ticket' && isAlreadyScanned) {
      scanResult = 'already_scanned'
      scanMessage = `Already scanned! This ticket was last scanned on ${new Date(lastScan.created_at).toLocaleString()}`
    }

    // For printed ticket QR codes, check if already used
    if (qrCode.qr_type === 'printed_ticket') {
      // Check printed ticket status
      const { data: printedTicket } = await supabase
        .from('printed_tickets')
        .select('status, used_at')
        .eq('id', qrCode.ticket_id)
        .single()

      if (printedTicket && printedTicket.status === 'used') {
        scanResult = 'already_scanned'
        scanMessage = `Already scanned! This printed ticket was used on ${new Date(printedTicket.used_at).toLocaleString()}`
      }
    }

    // Record the scan attempt
    const { data: scanRecord, error: recordError } = await supabase
      .from('qr_scan_records')
      .insert({
        qr_code_id: qrCode.id,
        qr_data_hash: qrHash,
        scan_result: scanResult,
        scan_message: scanMessage,
        scanned_by: user.id,
        scanner_device_info: deviceInfo,
        event_id: eventId || qrCode.event_id,
        ticket_id: ticketId || qrCode.ticket_id,
        metadata: {
          qr_type: qrCode.qr_type,
          previous_scan_count: previousScans?.length || 0
        }
      })
      .select()
      .single()

    if (recordError) {
      console.error('Error recording scan:', recordError)
      return NextResponse.json(
        { error: 'Failed to record scan attempt' },
        { status: 500 }
      )
    }

    // If this is a successful scan, update the appropriate ticket table
    if (scanResult === 'success' && qrCode.ticket_id) {
      if (qrCode.qr_type === 'ticket') {
        // Update regular ticket
        const { error: ticketUpdateError } = await supabase
          .from('tickets')
          .update({
            status: 'used',
            checked_in_at: new Date().toISOString(),
            metadata: {
              ...qrCode.metadata,
              last_scanned_at: new Date().toISOString(),
              scanned_by: user.id
            }
          })
          .eq('id', qrCode.ticket_id)

        if (ticketUpdateError) {
          console.error('Error updating ticket status:', ticketUpdateError)
        }
      } else if (qrCode.qr_type === 'printed_ticket') {
        // Update printed ticket
        const { error: printedTicketUpdateError } = await supabase
          .from('printed_tickets')
          .update({
            status: 'used',
            used_at: new Date().toISOString(),
            scanned_by: user.id
          })
          .eq('id', qrCode.ticket_id)

        if (printedTicketUpdateError) {
          console.error('Error updating printed ticket status:', printedTicketUpdateError)
        }

        // Also record in printed_ticket_scans table
        const { error: scanRecordError } = await supabase
          .from('printed_ticket_scans')
          .insert({
            printed_ticket_id: qrCode.ticket_id,
            event_id: qrCode.event_id,
            scanned_by: user.id,
            scan_result: 'success',
            device_info: deviceInfo
          })

        if (scanRecordError) {
          console.error('Error recording printed ticket scan:', scanRecordError)
        }
      }
    }

    // Prepare response data
    const responseData = {
      success: scanResult === 'success',
      result: scanResult,
      message: scanMessage,
      alreadyScanned: scanResult === 'already_scanned',
      scanId: scanRecord.id,
      qrCode: {
        id: qrCode.id,
        type: qrCode.qr_type,
        description: qrCode.description,
        createdAt: qrCode.created_at,
        eventId: qrCode.event_id,
        ticketId: qrCode.ticket_id
      },
      scanDetails: {
        scannedAt: scanRecord.created_at,
        scannedBy: user.id,
        scanCount: (previousScans?.length || 0) + (scanResult === 'success' ? 1 : 0)
      }
    }

    // Add previous scan info for already scanned cases
    if (lastScan) {
      responseData.previousScan = {
        scannedAt: lastScan.created_at,
        scannedBy: lastScan.scanned_by,
        scanMessage: lastScan.scan_message
      }
    }

    return NextResponse.json(responseData)

  } catch (error) {
    console.error('QR verification error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to verify QR code',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}