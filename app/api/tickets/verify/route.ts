import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    const body = await request.json()
    const { ticketNumber, eventId, location, deviceInfo } = body
    
    if (!ticketNumber || !eventId) {
      return NextResponse.json(
        { error: 'Ticket number and event ID are required' },
        { status: 400 }
      )
    }

    // Get user's IP address
    const ip = request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown'

    // Call the verify_ticket function
    const { data: result, error: verifyError } = await supabase
      .rpc('verify_ticket', {
        p_ticket_number: ticketNumber,
        p_event_id: eventId,
        p_scanner_id: user.id,
        p_location: location || null,
        p_device_info: deviceInfo || {
          userAgent: request.headers.get('user-agent'),
          timestamp: new Date().toISOString()
        },
        p_ip_address: ip
      })
    
    if (verifyError) {
      console.error('Verification error:', verifyError)
      return NextResponse.json(
        { error: 'Failed to verify ticket' },
        { status: 500 }
      )
    }

    // Return the verification result
    return NextResponse.json(result)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Get verification statistics
export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams
    const eventId = searchParams.get('eventId')
    
    if (!eventId) {
      return NextResponse.json(
        { error: 'Event ID is required' },
        { status: 400 }
      )
    }

    // Get event verification statistics
    const { data: stats, error: statsError } = await supabase
      .rpc('get_event_verification_stats', {
        p_event_id: eventId
      })
    
    if (statsError) {
      console.error('Stats error:', statsError)
      return NextResponse.json(
        { error: 'Failed to get statistics' },
        { status: 500 }
      )
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}