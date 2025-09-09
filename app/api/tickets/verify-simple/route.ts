import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { decryptTicketDataSync } from '@/lib/qr-generator'

// Use service role for verification to bypass RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function POST(request: NextRequest) {
  try {
    const { qrData } = await request.json()
    
    // Terminal logging
    console.log('\n=========================================')
    console.log('🔍 QR VERIFICATION REQUEST')
    console.log('Time:', new Date().toISOString())
    console.log('QR Data:', qrData)
    console.log('=========================================')

    if (!qrData) {
      console.log('❌ ERROR: No QR data provided')
      return NextResponse.json(
        { success: false, message: 'No QR data provided' },
        { status: 400 }
      )
    }

    let ticket = null
    let ticketNumber = null

    // Handle different QR formats:
    // 1. Simple ticket number (like "3F6C-MEY2LDV3-AUWQ") - NEW FORMAT
    // 2. Encrypted format (starts with "EVTKT:") - OLD FORMAT  
    // 3. Direct QR match - LEGACY FORMAT

    if (qrData.startsWith('EVTKT:')) {
      console.log('🔐 Encrypted QR detected (legacy), attempting decryption...')
      try {
        const decryptedData = decryptTicketDataSync(qrData)
        if (decryptedData && decryptedData.ticketNumber) {
          ticketNumber = decryptedData.ticketNumber
          console.log('✅ Successfully decrypted legacy QR code')
          console.log('   Ticket Number:', ticketNumber)
        }
      } catch (decryptError) {
        console.log('❌ Failed to decrypt QR code:', decryptError.message)
      }
    } else if (qrData.match(/^[A-Z0-9]{4}-[A-Z0-9]+/)) {
      // Simple ticket number format (like your example: 3F6C-MEY2LDV3-AUWQ)
      ticketNumber = qrData.trim()
      console.log('📱 Simple ticket number detected:', ticketNumber)
    } else {
      // Try as direct ticket number anyway
      ticketNumber = qrData.trim()
      console.log('🔍 Treating QR data as ticket number:', ticketNumber)
    }

    // Search for ticket by ticket number
    console.log('📋 Searching for ticket by number:', ticketNumber)
    
    if (ticketNumber) {
      const { data: foundTicket, error: ticketError } = await supabaseAdmin
        .from('tickets')
        .select('*')
        .eq('ticket_number', ticketNumber)
        .single()
      
      if (!ticketError && foundTicket) {
        ticket = foundTicket
        console.log('✅ Found ticket by ticket number:', ticketNumber)
      }
    }
    
    if (!ticket && qrData) {
      // Fallback: Try direct QR code match for backwards compatibility
      console.log('📋 Trying direct QR code field match...')
      const { data: foundTicket, error } = await supabaseAdmin
        .from('tickets')
        .select('*')
        .eq('qr_code', qrData)
        .single()

      if (!error && foundTicket) {
        ticket = foundTicket
        console.log('✅ Found ticket by direct QR field match')
      }
    }

    if (!ticket) {
      console.log('❌ Ticket not found in primary table, checking qr_codes table...')
      // Try checking in qr_codes table as well
      const { data: qrCode } = await supabaseAdmin
        .from('qr_codes')
        .select('*')
        .eq('qr_data', qrData)
        .single()

      if (!qrCode) {
        console.log('❌ QR code not found anywhere')
        return NextResponse.json({
          success: false,
          message: 'TICKET NOT AVAILABLE\n\nQR code not recognized or may be invalid',
          status: 'invalid'
        })
      }

      // If found in qr_codes table, get the associated ticket
      const { data: ticketFromQR } = await supabaseAdmin
        .from('tickets')
        .select('*')
        .eq('id', qrCode.ticket_id)
        .single()

      if (!ticketFromQR) {
        return NextResponse.json({
          success: false,
          message: 'TICKET NOT AVAILABLE',
          status: 'invalid'
        })
      }

      ticket = ticketFromQR
    }

    // Check if ticket is already used or verified
    if (ticket.status === 'used' || ticket.is_verified === true) {
      const verifiedTime = ticket.verified_at ? new Date(ticket.verified_at).toLocaleString() : 'Unknown time'
      const scanCount = ticket.scan_count || 1
      
      console.log('\n⚠️  TICKET ALREADY SCANNED!')
      console.log('=========================================')
      console.log('   Ticket Number:', ticket.ticket_number)
      console.log('   Status:', ticket.status)
      console.log('   First scanned at:', verifiedTime)
      console.log('   Total scan attempts:', scanCount)
      console.log('   Ticket Type:', ticket.ticket_type)
      console.log('=========================================')
      console.log('❌ ENTRY DENIED - DUPLICATE SCAN\n')
      
      return NextResponse.json({
        success: false,
        message: `⚠️ TICKET ALREADY SCANNED!\n\nFirst used: ${verifiedTime}\nScan attempts: ${scanCount}`,
        status: 'used',
        verified_at: ticket.verified_at,
        scan_count: scanCount
      })
    }

    // Mark ticket as used and update scan history
    const scanTime = new Date().toISOString()
    const scanData = {
      scanned_at: scanTime,
      scanner: 'QR Camera Scanner',
      ip: request.headers.get('x-forwarded-for') || 'Unknown',
      user_agent: request.headers.get('user-agent') || 'Unknown'
    }
    
    // Prepare update data (verified_by can be null or UUID, not string)
    const updateData: any = {
      status: 'used',
      verified_at: scanTime,
      is_verified: true,
      scan_count: (ticket.scan_count || 0) + 1,
      first_scanned_at: ticket.first_scanned_at || scanTime,
      last_scanned_at: scanTime,
      scan_history: [...(ticket.scan_history || []), scanData]
    }
    
    // Don't set verified_by if it expects UUID (leave as null)
    // verified_by field expects UUID of user, not a string
    
    // Update ticket with scan information
    const { data: updatedTicket, error: updateError } = await supabaseAdmin
      .from('tickets')
      .update(updateData)
      .eq('id', ticket.id)
      .select()
      .single()
    
    if (updateError) {
      console.log('❌ ERROR updating ticket:', updateError.message)
      console.log('   Attempting simplified update...')
      
      // Try simplified update without verified_by
      const { error: retryError } = await supabaseAdmin
        .from('tickets')
        .update({
          status: 'used',
          verified_at: scanTime,
          is_verified: true
        })
        .eq('id', ticket.id)
      
      if (retryError) {
        console.log('❌ Simplified update also failed:', retryError.message)
      } else {
        console.log('✅ Ticket marked as used (simplified)')
      }
    } else {
      console.log('✅ Ticket updated successfully')
      console.log('   New status:', updatedTicket.status)
      console.log('   New scan count:', updatedTicket.scan_count)
    }
    
    // Log successful verification
    console.log('\n✅ TICKET VERIFIED SUCCESSFULLY!')
    console.log('=========================================')
    console.log('   Ticket Number:', ticket.ticket_number)
    console.log('   Ticket Type:', ticket.ticket_type || 'General')
    console.log('   Event ID:', ticket.event_id)
    console.log('   Verified at:', new Date(scanTime).toLocaleString())
    console.log('   Scan Count:', updatedTicket?.scan_count || 1)
    console.log('   Status Updated:', ticket.status, '->', 'used')
    console.log('=========================================')
    console.log('✓ ENTRY GRANTED\n')

    // Log the scan
    fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/tickets/log-scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticketId: ticket.id,
        ticketNumber: ticket.ticket_number,
        scanType: 'qr_scan',
        scanResult: 'success'
      })
    }).catch(() => {})
    
    return NextResponse.json({
      success: true,
      message: 'TICKET VERIFIED ✓',
      status: 'verified',
      ticket_number: ticket.ticket_number,
      ticket_type: ticket.ticket_type,
      verified_at: scanTime,
      scan_count: updatedTicket?.scan_count || 1
    })

  } catch (error) {
    console.log('❌ VERIFICATION ERROR:', error)
    console.log('=========================================\n')
    return NextResponse.json(
      { success: false, message: 'Verification failed' },
      { status: 500 }
    )
  }
}