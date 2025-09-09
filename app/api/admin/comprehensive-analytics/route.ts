import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    console.log('=== COMPREHENSIVE ANALYTICS API CALL ===')
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('Auth error:', authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const dateRange = searchParams.get('dateRange') || 'today'
    
    // Build date filter
    let dateFilter = new Date()
    if (dateRange === 'today') {
      dateFilter.setHours(0, 0, 0, 0)
    } else if (dateRange === 'week') {
      dateFilter.setDate(dateFilter.getDate() - 7)
    } else if (dateRange === 'month') {
      dateFilter.setMonth(dateFilter.getMonth() - 1)
    } else {
      dateFilter = new Date('2020-01-01')
    }

    console.log('Date filter:', { dateRange, dateFilter: dateFilter.toISOString() })

    // Track all data sources and results
    const dataSources = {
      tickets: { data: [], error: null, count: 0 },
      predefinedTickets: { data: [], error: null, count: 0 },
      printedTickets: { data: [], error: null, count: 0 },
      qrCodes: { data: [], error: null, count: 0 },
      qrScanRecords: { data: [], error: null, count: 0 },
      ticketScans: { data: [], error: null, count: 0 }
    }

    // Fetch all data sources in parallel
    const dataPromises = [
      // 1. Regular tickets
      supabase
        .from('tickets')
        .select(`
          *,
          bookings (
            id, user_name, user_email, booking_number, total_amount, payment_status
          ),
          events (
            id, title, date, start_date, category, venue
          )
        `)
        .gte('created_at', dateRange !== 'all' ? dateFilter.toISOString() : '2020-01-01'),

      // 2. Predefined tickets
      supabase
        .from('predefined_tickets')
        .select(`
          *,
          events (
            id, title, date, start_date, category, venue
          )
        `)
        .gte('created_at', dateRange !== 'all' ? dateFilter.toISOString() : '2020-01-01'),

      // 3. Printed tickets
      supabase
        .from('printed_tickets')
        .select(`
          *,
          events (
            id, title, date, start_date, category, venue
          )
        `)
        .gte('created_at', dateRange !== 'all' ? dateFilter.toISOString() : '2020-01-01'),

      // 4. QR codes
      supabase
        .from('qr_codes')
        .select('*')
        .gte('created_at', dateRange !== 'all' ? dateFilter.toISOString() : '2020-01-01'),

      // 5. QR scan records
      supabase
        .from('qr_scan_records')
        .select('*')
        .gte('created_at', dateRange !== 'all' ? dateFilter.toISOString() : '2020-01-01'),

      // 6. Ticket scans
      supabase
        .from('ticket_scans')
        .select('*')
        .gte('created_at', dateRange !== 'all' ? dateFilter.toISOString() : '2020-01-01')
    ]

    console.log('Fetching data from all sources...')
    const results = await Promise.allSettled(dataPromises)

    // Process results
    const [ticketsResult, predefinedResult, printedResult, qrCodesResult, qrScanResult, ticketScansResult] = results

    // Store results
    if (ticketsResult.status === 'fulfilled') {
      dataSources.tickets.data = ticketsResult.value.data || []
      dataSources.tickets.error = ticketsResult.value.error
      dataSources.tickets.count = ticketsResult.value.data?.length || 0
    } else {
      dataSources.tickets.error = ticketsResult.reason
    }

    if (predefinedResult.status === 'fulfilled') {
      dataSources.predefinedTickets.data = predefinedResult.value.data || []
      dataSources.predefinedTickets.error = predefinedResult.value.error
      dataSources.predefinedTickets.count = predefinedResult.value.data?.length || 0
    } else {
      dataSources.predefinedTickets.error = predefinedResult.reason
    }

    if (printedResult.status === 'fulfilled') {
      dataSources.printedTickets.data = printedResult.value.data || []
      dataSources.printedTickets.error = printedResult.value.error
      dataSources.printedTickets.count = printedResult.value.data?.length || 0
    } else {
      dataSources.printedTickets.error = printedResult.reason
    }

    if (qrCodesResult.status === 'fulfilled') {
      dataSources.qrCodes.data = qrCodesResult.value.data || []
      dataSources.qrCodes.error = qrCodesResult.value.error
      dataSources.qrCodes.count = qrCodesResult.value.data?.length || 0
    } else {
      dataSources.qrCodes.error = qrCodesResult.reason
    }

    if (qrScanResult.status === 'fulfilled') {
      dataSources.qrScanRecords.data = qrScanResult.value.data || []
      dataSources.qrScanRecords.error = qrScanResult.value.error
      dataSources.qrScanRecords.count = qrScanResult.value.data?.length || 0
    } else {
      dataSources.qrScanRecords.error = qrScanResult.reason
    }

    if (ticketScansResult.status === 'fulfilled') {
      dataSources.ticketScans.data = ticketScansResult.value.data || []
      dataSources.ticketScans.error = ticketScansResult.value.error
      dataSources.ticketScans.count = ticketScansResult.value.data?.length || 0
    } else {
      dataSources.ticketScans.error = ticketScansResult.reason
    }

    console.log('Data retrieval results:', {
      tickets: dataSources.tickets.count,
      predefinedTickets: dataSources.predefinedTickets.count,
      printedTickets: dataSources.printedTickets.count,
      qrCodes: dataSources.qrCodes.count,
      qrScanRecords: dataSources.qrScanRecords.count,
      ticketScans: dataSources.ticketScans.count
    })

    // Normalize all ticket data
    const allTicketRecords = []

    // Add regular tickets
    dataSources.tickets.data.forEach(ticket => {
      allTicketRecords.push({
        id: ticket.id,
        source: 'regular_ticket',
        ticketNumber: ticket.ticket_number,
        ticketType: ticket.ticket_type || 'Bronze',
        status: ticket.status || 'valid',
        createdAt: ticket.created_at,
        checkedInAt: ticket.checked_in_at,
        isVerified: ticket.is_verified || false,
        eventId: ticket.event_id,
        eventName: ticket.events?.title || 'Unknown Event',
        eventDate: ticket.events?.date || ticket.events?.start_date,
        eventCategory: ticket.events?.category || 'General',
        attendeeName: ticket.bookings?.user_name || ticket.metadata?.attendeeData?.name || 'Unknown',
        attendeeEmail: ticket.bookings?.user_email || ticket.metadata?.attendeeData?.email || 'Unknown',
        amountPaid: ticket.bookings?.total_amount || 0,
        paymentStatus: ticket.bookings?.payment_status,
        isScanned: ticket.status === 'used' || !!ticket.checked_in_at || ticket.is_verified,
        metadata: ticket.metadata || {}
      })
    })

    // Add predefined tickets (templates)
    dataSources.predefinedTickets.data.forEach(template => {
      allTicketRecords.push({
        id: `predefined-${template.id}`,
        source: 'predefined_template',
        ticketNumber: `TEMPLATE-${template.id}`,
        ticketType: template.ticket_type || 'Bronze',
        status: 'template',
        createdAt: template.created_at,
        checkedInAt: null,
        isVerified: false,
        eventId: template.event_id,
        eventName: template.events?.title || 'No Event Linked',
        eventDate: template.events?.date || template.events?.start_date,
        eventCategory: template.events?.category || 'General',
        attendeeName: template.name,
        attendeeEmail: 'template@predefined.local',
        amountPaid: 0,
        paymentStatus: 'template',
        isScanned: false,
        metadata: template.metadata || { templateId: template.id }
      })
    })

    // Add printed tickets
    dataSources.printedTickets.data.forEach(printed => {
      allTicketRecords.push({
        id: printed.id,
        source: 'printed_ticket',
        ticketNumber: printed.ticket_code,
        ticketType: printed.ticket_type || 'Bronze',
        status: printed.status || 'valid',
        createdAt: printed.created_at,
        checkedInAt: printed.scanned_at,
        isVerified: !!printed.scanned_at,
        eventId: printed.event_id,
        eventName: printed.events?.title || 'Unknown Event',
        eventDate: printed.events?.date || printed.events?.start_date,
        eventCategory: printed.events?.category || 'General',
        attendeeName: printed.attendee_name || 'Printed Ticket Holder',
        attendeeEmail: 'printed@ticket.local',
        amountPaid: printed.price || 0,
        paymentStatus: 'paid',
        isScanned: !!printed.scanned_at,
        metadata: printed.metadata || {}
      })
    })

    console.log('Normalized ticket records:', allTicketRecords.length)

    // Calculate comprehensive statistics
    const totalCreated = allTicketRecords.length
    const scannedTickets = allTicketRecords.filter(t => t.isScanned)
    const totalScanned = scannedTickets.length
    const totalNotScanned = totalCreated - totalScanned
    const scanRate = totalCreated > 0 ? (totalScanned / totalCreated * 100) : 0

    // Recent scans
    const recentScans = scannedTickets
      .filter(t => t.checkedInAt)
      .sort((a, b) => new Date(b.checkedInAt).getTime() - new Date(a.checkedInAt).getTime())
      .slice(0, 15)
      .map(ticket => ({
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        eventName: ticket.eventName,
        attendeeName: ticket.attendeeName,
        scannedAt: ticket.checkedInAt,
        ticketType: ticket.ticketType,
        source: ticket.source
      }))

    // Event statistics
    const eventStatsMap = new Map()
    allTicketRecords.forEach(ticket => {
      const eventKey = ticket.eventId || 'no-event'
      const eventName = ticket.eventName || 'No Event'
      
      if (!eventStatsMap.has(eventKey)) {
        eventStatsMap.set(eventKey, {
          event: eventName,
          eventId: ticket.eventId,
          created: 0,
          scanned: 0,
          notScanned: 0
        })
      }
      
      const eventStat = eventStatsMap.get(eventKey)
      eventStat.created++
      
      if (ticket.isScanned) {
        eventStat.scanned++
      } else {
        eventStat.notScanned++
      }
    })
    const eventStats = Array.from(eventStatsMap.values())

    // Ticket type statistics
    const ticketTypeStatsMap = new Map()
    allTicketRecords.forEach(ticket => {
      const type = ticket.ticketType || 'Bronze'
      
      if (!ticketTypeStatsMap.has(type)) {
        ticketTypeStatsMap.set(type, {
          type,
          created: 0,
          scanned: 0,
          notScanned: 0,
          scanRate: 0
        })
      }
      
      const typeStat = ticketTypeStatsMap.get(type)
      typeStat.created++
      
      if (ticket.isScanned) {
        typeStat.scanned++
      } else {
        typeStat.notScanned++
      }
    })
    
    ticketTypeStatsMap.forEach(stat => {
      stat.scanRate = stat.created > 0 ? (stat.scanned / stat.created * 100) : 0
    })
    const ticketTypeStats = Array.from(ticketTypeStatsMap.values())

    // System statistics
    const systemStats = {
      totalTables: Object.keys(dataSources).length,
      dataSourceCounts: Object.entries(dataSources).reduce((acc, [name, source]) => {
        acc[name] = { count: source.count, hasError: !!source.error }
        return acc
      }, {}),
      totalQRCodes: dataSources.qrCodes.count,
      totalScanRecords: dataSources.qrScanRecords.count + dataSources.ticketScans.count,
      uniqueEvents: new Set(allTicketRecords.map(t => t.eventId).filter(Boolean)).size,
      sourceBreakdown: {
        regular: allTicketRecords.filter(t => t.source === 'regular_ticket').length,
        predefined: allTicketRecords.filter(t => t.source === 'predefined_template').length,
        printed: allTicketRecords.filter(t => t.source === 'printed_ticket').length
      }
    }

    const analytics = {
      success: true,
      totalCreated,
      totalScanned,
      totalNotScanned,
      scanRate,
      recentScans,
      eventStats,
      ticketTypeStats,
      systemStats,
      dataSources: Object.entries(dataSources).map(([name, source]) => ({
        name,
        count: source.count,
        hasError: !!source.error,
        error: source.error?.message || null
      })),
      generatedAt: new Date().toISOString()
    }

    console.log('Comprehensive analytics generated:', {
      totalCreated,
      totalScanned,
      scanRate: scanRate.toFixed(2),
      sources: systemStats.sourceBreakdown
    })

    return NextResponse.json(analytics)

  } catch (error) {
    console.error('Error in comprehensive analytics API:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch comprehensive analytics',
      details: error.message
    }, { status: 500 })
  }
}