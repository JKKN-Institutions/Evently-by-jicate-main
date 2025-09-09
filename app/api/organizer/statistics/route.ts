import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is organizer or admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || (profile.role !== 'organizer' && profile.role !== 'admin')) {
      return NextResponse.json(
        { error: 'Forbidden: Organizer access required' },
        { status: 403 }
      )
    }

    // Get event ID from query params if provided
    const eventId = request.nextUrl.searchParams.get('eventId')

    // Base query for events
    let eventsQuery = supabase
      .from('events')
      .select('id, title, date, status, max_attendees, location, price')

    // If admin, can see all events; if organizer, only their events
    if (profile.role === 'organizer') {
      eventsQuery = eventsQuery.eq('organizer_id', user.id)
    }

    // If specific event requested
    if (eventId) {
      eventsQuery = eventsQuery.eq('id', eventId)
    }

    const { data: events, error: eventsError } = await eventsQuery

    if (eventsError) throw eventsError

    if (!events || events.length === 0) {
      return NextResponse.json({
        events: [],
        totalStats: {
          totalEvents: 0,
          totalTicketsGenerated: 0,
          totalTicketsScanned: 0,
          totalRevenue: 0,
          scanRate: 0,
          upcomingEvents: 0,
          pastEvents: 0
        }
      })
    }

    // Get detailed statistics for each event
    const eventIds = events.map(e => e.id)
    
    // Get all bookings for these events
    const { data: bookings, error: bookingsError } = await supabase
      .from('bookings')
      .select('*')
      .in('event_id', eventIds)

    if (bookingsError) throw bookingsError

    // Get ticket validation data
    const { data: validations, error: validationsError } = await supabase
      .from('ticket_validations')
      .select('*')
      .in('event_id', eventIds)

    if (validationsError) throw validationsError

    // Calculate statistics for each event
    const eventsWithStats = events.map(event => {
      const eventBookings = bookings?.filter(b => b.event_id === event.id) || []
      const eventValidations = validations?.filter(v => v.event_id === event.id) || []
      
      const totalTickets = eventBookings.length
      const paidTickets = eventBookings.filter(b => b.payment_status === 'paid').length
      const scannedTickets = eventValidations.filter(v => v.status === 'valid').length
      const pendingTickets = eventBookings.filter(b => b.payment_status === 'pending').length
      const cancelledTickets = eventBookings.filter(b => b.payment_status === 'cancelled').length
      
      const revenue = eventBookings
        .filter(b => b.payment_status === 'paid')
        .reduce((sum, b) => sum + (b.amount || 0), 0)

      const scanRate = totalTickets > 0 ? (scannedTickets / totalTickets) * 100 : 0
      const occupancyRate = event.max_attendees > 0 ? (totalTickets / event.max_attendees) * 100 : 0

      // Real-time status
      const isUpcoming = new Date(event.date) > new Date()
      const isToday = new Date(event.date).toDateString() === new Date().toDateString()
      const isPast = new Date(event.date) < new Date() && !isToday

      return {
        id: event.id,
        title: event.title,
        date: event.date,
        status: event.status,
        location: event.location,
        price: event.price,
        maxAttendees: event.max_attendees,
        statistics: {
          totalTickets,
          paidTickets,
          pendingTickets,
          cancelledTickets,
          scannedTickets,
          unscannedTickets: paidTickets - scannedTickets,
          revenue,
          scanRate: scanRate.toFixed(1),
          occupancyRate: occupancyRate.toFixed(1),
          availableSpots: event.max_attendees - totalTickets
        },
        timeStatus: {
          isUpcoming,
          isToday,
          isPast
        },
        // Recent scans (last 10)
        recentScans: eventValidations
          .sort((a, b) => new Date(b.validated_at).getTime() - new Date(a.validated_at).getTime())
          .slice(0, 10)
          .map(v => ({
            id: v.id,
            ticketId: v.ticket_id,
            validatedAt: v.validated_at,
            validatedBy: v.validated_by
          }))
      }
    })

    // Calculate total statistics
    const totalStats = {
      totalEvents: events.length,
      totalTicketsGenerated: bookings?.length || 0,
      totalTicketsScanned: validations?.filter(v => v.status === 'valid').length || 0,
      totalRevenue: bookings
        ?.filter(b => b.payment_status === 'paid')
        .reduce((sum, b) => sum + (b.amount || 0), 0) || 0,
      scanRate: bookings && bookings.length > 0 
        ? ((validations?.filter(v => v.status === 'valid').length || 0) / bookings.length) * 100
        : 0,
      upcomingEvents: eventsWithStats.filter(e => e.timeStatus.isUpcoming).length,
      todayEvents: eventsWithStats.filter(e => e.timeStatus.isToday).length,
      pastEvents: eventsWithStats.filter(e => e.timeStatus.isPast).length,
      activeEvents: events.filter(e => e.status === 'published').length
    }

    return NextResponse.json({
      events: eventsWithStats,
      totalStats,
      lastUpdated: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error fetching organizer statistics:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}