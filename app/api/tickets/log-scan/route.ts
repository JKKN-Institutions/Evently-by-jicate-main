import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { 
      ticketId, 
      ticketNumber, 
      scanType, 
      scanResult 
    } = await request.json()
    
    // Create verification log entry
    const logEntry = {
      ticket_id: ticketId,
      ticket_number: ticketNumber,
      scan_type: scanType || 'qr_scan',
      scan_result: scanResult || 'success',
      scanned_at: new Date().toISOString(),
      device_info: request.headers.get('user-agent') || 'Unknown',
      ip_address: request.headers.get('x-forwarded-for') || 'Unknown'
    }
    
    // Try to insert into verification_logs table if it exists
    const { error } = await supabaseAdmin
      .from('verification_logs')
      .insert(logEntry)
    
    if (!error) {
      console.log('📝 Scan logged to verification_logs')
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    // Silently fail - logging shouldn't break verification
    return NextResponse.json({ success: true })
  }
}