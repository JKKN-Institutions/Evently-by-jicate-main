import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('=== CHECKING ALL TICKETS IN DATABASE ===')

    // 1. Check regular tickets
    const { data: tickets, error: ticketsError } = await supabase
      .from('tickets')
      .select('id, ticket_number, created_at, is_verified, status')
      .order('created_at', { ascending: false })
      .limit(10)

    console.log('Regular tickets:', {
      count: tickets?.length || 0,
      error: ticketsError?.message,
      sample: tickets?.slice(0, 3)
    })

    // 2. Count total tickets
    const { count: totalTickets } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })

    // 3. Count today's tickets
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const { count: todayTickets } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString())

    // 4. Count verified tickets
    const { count: verifiedTickets } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true })
      .eq('is_verified', true)

    // 5. Check predefined tickets
    const { data: predefined, count: predefinedCount } = await supabase
      .from('predefined_tickets')
      .select('*', { count: 'exact' })
      .limit(5)

    // 6. Check printed tickets
    const { data: printed, count: printedCount } = await supabase
      .from('printed_tickets')
      .select('*', { count: 'exact' })
      .limit(5)

    // 7. Check events
    const { data: events, count: eventsCount } = await supabase
      .from('events')
      .select('id, title, created_at')
      .order('created_at', { ascending: false })
      .limit(5)

    // 8. Check QR codes
    const { count: qrCount } = await supabase
      .from('qr_codes')
      .select('*', { count: 'exact', head: true })

    // 9. Check ticket scans
    const { count: scanCount } = await supabase
      .from('ticket_scans')
      .select('*', { count: 'exact', head: true })

    // 10. Get date range of tickets
    const { data: dateRange } = await supabase
      .from('tickets')
      .select('created_at')
      .order('created_at', { ascending: true })
      .limit(1)

    const { data: latestTicket } = await supabase
      .from('tickets')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)

    const summary = {
      database_status: 'connected',
      total_tickets: totalTickets || 0,
      today_tickets: todayTickets || 0,
      verified_tickets: verifiedTickets || 0,
      predefined_count: predefinedCount || 0,
      printed_count: printedCount || 0,
      events_count: eventsCount || 0,
      qr_codes_count: qrCount || 0,
      ticket_scans_count: scanCount || 0,
      date_range: {
        oldest_ticket: dateRange?.[0]?.created_at || null,
        newest_ticket: latestTicket?.[0]?.created_at || null,
        today: new Date().toISOString()
      },
      sample_data: {
        tickets: tickets?.slice(0, 3) || [],
        events: events?.slice(0, 3) || [],
        predefined: predefined?.slice(0, 2) || []
      }
    }

    console.log('Database summary:', summary)

    return NextResponse.json({
      success: true,
      ...summary,
      recommendation: totalTickets === 0 
        ? 'No tickets found. Please generate some tickets first.'
        : todayTickets === 0 
        ? 'No tickets created today. Try changing date range to "all" or "month" in analytics.'
        : 'Tickets found. Check if date filter is correct.'
    })

  } catch (error: any) {
    console.error('Error checking tickets:', error)
    return NextResponse.json(
      { error: 'Failed to check tickets', details: error.message },
      { status: 500 }
    )
  }
}