'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  ArrowLeft, 
  BarChart3, 
  Users, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  Filter, 
  Ticket, 
  QrCode, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Activity,
  Download,
  RefreshCw,
  TrendingDown,
  Award,
  MapPin
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface TicketAnalytics {
  event_id: string
  event_title?: string
  ticket_type: string
  total_tickets: number
  checked_in_tickets: number
  available_tickets: number
  cancelled_tickets: number
  scanned_tickets?: number
  unscanned_tickets?: number
  scan_count?: number
  first_scanned_at?: string
  last_scanned_at?: string
}

interface EventData {
  id: string
  title: string
  start_date: string
  venue: string
  status?: string
  price?: number
  max_attendees?: number
}

interface DashboardStats {
  totalEvents: number
  totalTickets: number
  totalRevenue: number
  totalCheckIns: number
  conversionRate: number
  averageTicketPrice: number
  upcomingEvents: number
  pastEvents: number
}

export default function EnhancedAnalyticsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [ticketAnalytics, setTicketAnalytics] = useState<TicketAnalytics[]>([])
  const [events, setEvents] = useState<EventData[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string>('all')
  const [selectedDateRange, setSelectedDateRange] = useState<string>('30days')
  const [stats, setStats] = useState<DashboardStats>({
    totalEvents: 0,
    totalTickets: 0,
    totalRevenue: 0,
    totalCheckIns: 0,
    conversionRate: 0,
    averageTicketPrice: 0,
    upcomingEvents: 0,
    pastEvents: 0
  })
  
  const supabase = createClient()

  useEffect(() => {
    checkAuth()
    loadAnalytics()
  }, [selectedEventId, selectedDateRange])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      router.push('/')
    }
  }

  const loadAnalytics = async () => {
    try {
      setLoading(true)

      // Load events
      const { data: eventsData } = await supabase
        .from('events')
        .select('*')
        .order('start_date', { ascending: false })

      const eventsWithDefaults = (eventsData || []).map(event => ({
        ...event,
        status: event.status || 'active',
        price: event.price || 0,
        max_attendees: event.max_attendees || 100
      }))
      
      setEvents(eventsWithDefaults)

      // Calculate date range
      const now = new Date()
      const dateRangeStart = new Date()
      
      switch(selectedDateRange) {
        case '7days':
          dateRangeStart.setDate(now.getDate() - 7)
          break
        case '30days':
          dateRangeStart.setDate(now.getDate() - 30)
          break
        case '90days':
          dateRangeStart.setDate(now.getDate() - 90)
          break
        case 'year':
          dateRangeStart.setFullYear(now.getFullYear() - 1)
          break
        default:
          dateRangeStart.setDate(now.getDate() - 30)
      }

      // Load tickets with event info
      let ticketsQuery = supabase
        .from('tickets')
        .select('*, events!inner(title, start_date, venue)')

      if (selectedEventId !== 'all') {
        ticketsQuery = ticketsQuery.eq('event_id', selectedEventId)
      }

      const { data: ticketsData } = await ticketsQuery

      // Process analytics data
      const analyticsMap = new Map<string, TicketAnalytics>()
      let totalTicketsCount = 0
      let totalCheckedIn = 0
      let totalRevenue = 0

      ticketsData?.forEach(ticket => {
        const key = `${ticket.event_id}-${ticket.ticket_type || 'general'}`
        
        if (!analyticsMap.has(key)) {
          analyticsMap.set(key, {
            event_id: ticket.event_id,
            event_title: ticket.events?.title,
            ticket_type: ticket.ticket_type || 'general',
            total_tickets: 0,
            checked_in_tickets: 0,
            available_tickets: 0,
            cancelled_tickets: 0,
            scanned_tickets: 0,
            unscanned_tickets: 0,
            scan_count: 0
          })
        }

        const analytics = analyticsMap.get(key)!
        analytics.total_tickets++
        totalTicketsCount++

        // Track ticket status
        switch (ticket.status) {
          case 'used':
            analytics.checked_in_tickets++
            totalCheckedIn++
            break
          case 'valid':
            analytics.available_tickets++
            break
          case 'cancelled':
            analytics.cancelled_tickets++
            break
        }

        // Track scan status
        if (ticket.scan_count && ticket.scan_count > 0) {
          analytics.scanned_tickets = (analytics.scanned_tickets || 0) + 1
          analytics.scan_count = (analytics.scan_count || 0) + ticket.scan_count
        } else {
          analytics.unscanned_tickets = (analytics.unscanned_tickets || 0) + 1
        }
      })

      setTicketAnalytics(Array.from(analyticsMap.values()))

      // Calculate revenue (simplified - would need actual payment data)
      const eventsRevenue = eventsWithDefaults.reduce((sum, event) => {
        const eventTickets = ticketsData?.filter(t => t.event_id === event.id).length || 0
        return sum + (eventTickets * (event.price || 0))
      }, 0)

      // Calculate stats
      const upcomingEvents = eventsWithDefaults.filter(e => new Date(e.start_date) > now).length
      const pastEvents = eventsWithDefaults.filter(e => new Date(e.start_date) <= now).length
      const conversionRate = totalTicketsCount > 0 ? (totalCheckedIn / totalTicketsCount) * 100 : 0
      const avgPrice = totalTicketsCount > 0 ? eventsRevenue / totalTicketsCount : 0

      setStats({
        totalEvents: eventsWithDefaults.length,
        totalTickets: totalTicketsCount,
        totalRevenue: eventsRevenue,
        totalCheckIns: totalCheckedIn,
        conversionRate,
        averageTicketPrice: avgPrice,
        upcomingEvents,
        pastEvents
      })

    } catch (error: any) {
      console.error('Error loading analytics:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    loadAnalytics()
  }

  const getTicketTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'Gold': 'bg-gradient-to-r from-yellow-400 to-yellow-600',
      'Silver': 'bg-gradient-to-r from-gray-300 to-gray-500',
      'Bronze': 'bg-gradient-to-r from-orange-400 to-orange-600',
      'general': 'bg-gradient-to-r from-blue-400 to-blue-600',
      'vip': 'bg-gradient-to-r from-purple-400 to-purple-600',
      'premium': 'bg-gradient-to-r from-indigo-400 to-indigo-600'
    }
    return colors[type] || 'bg-gradient-to-r from-gray-400 to-gray-600'
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#0b6d41] mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading analytics...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white shadow-lg sticky top-0 z-40 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-4">
              <Link href="/admin" className="text-3xl font-bold bg-gradient-to-r from-[#0b6d41] to-[#0a5835] bg-clip-text text-transparent">
                Analytics
              </Link>
              <div className="h-8 w-px bg-gray-300"></div>
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-[#0b6d41]" />
                <span className="text-sm font-medium text-gray-600">Real-time Dashboard</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRefresh}
                className={`p-2 rounded-lg hover:bg-gray-100 transition-colors ${refreshing ? 'animate-spin' : ''}`}
                disabled={refreshing}
              >
                <RefreshCw className="h-5 w-5 text-gray-600" />
              </button>
              <Link
                href="/admin"
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all hover:shadow-md"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Admin
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="mb-8 bg-white rounded-xl shadow-lg p-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">Event Filter</label>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0b6d41] focus:border-transparent transition-all"
              >
                <option value="all">All Events</option>
                {events.map(event => (
                  <option key={event.id} value={event.id}>
                    {event.title} - {new Date(event.start_date).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
              <select
                value={selectedDateRange}
                onChange={(e) => setSelectedDateRange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0b6d41] focus:border-transparent transition-all"
              >
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
                <option value="90days">Last 90 Days</option>
                <option value="year">Last Year</option>
                <option value="all">All Time</option>
              </select>
            </div>
            <div className="flex-1 min-w-[200px] flex items-end">
              <button className="w-full px-4 py-2 bg-[#0b6d41] text-white rounded-lg hover:bg-[#0a5835] transition-all shadow-md hover:shadow-lg">
                <Download className="h-4 w-4 inline mr-2" />
                Export Report
              </button>
            </div>
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Events */}
          <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-all transform hover:-translate-y-1">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
              <span className="text-sm font-medium text-green-600 bg-green-100 px-2 py-1 rounded">
                +{stats.upcomingEvents} upcoming
              </span>
            </div>
            <h3 className="text-3xl font-bold text-gray-900">{formatNumber(stats.totalEvents)}</h3>
            <p className="text-sm text-gray-600 mt-1">Total Events</p>
            <div className="mt-4 flex items-center text-xs text-gray-500">
              <Clock className="h-3 w-3 mr-1" />
              {stats.pastEvents} completed
            </div>
          </div>

          {/* Total Tickets */}
          <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-all transform hover:-translate-y-1">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Ticket className="h-6 w-6 text-purple-600" />
              </div>
              <span className="text-sm font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded">
                {stats.conversionRate.toFixed(1)}% used
              </span>
            </div>
            <h3 className="text-3xl font-bold text-gray-900">{formatNumber(stats.totalTickets)}</h3>
            <p className="text-sm text-gray-600 mt-1">Total Tickets Sold</p>
            <div className="mt-4 flex items-center text-xs text-gray-500">
              <CheckCircle className="h-3 w-3 mr-1" />
              {formatNumber(stats.totalCheckIns)} checked in
            </div>
          </div>

          {/* Total Revenue */}
          <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-all transform hover:-translate-y-1">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
              <span className="text-sm font-medium text-green-600 bg-green-100 px-2 py-1 rounded">
                <TrendingUp className="h-3 w-3 inline" />
              </span>
            </div>
            <h3 className="text-3xl font-bold text-gray-900">{formatCurrency(stats.totalRevenue)}</h3>
            <p className="text-sm text-gray-600 mt-1">Total Revenue</p>
            <div className="mt-4 flex items-center text-xs text-gray-500">
              <Award className="h-3 w-3 mr-1" />
              {formatCurrency(stats.averageTicketPrice)} avg ticket
            </div>
          </div>

          {/* Conversion Rate */}
          <div className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-all transform hover:-translate-y-1">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 bg-orange-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-orange-600" />
              </div>
              <span className={`text-sm font-medium px-2 py-1 rounded ${
                stats.conversionRate > 50 
                  ? 'text-green-600 bg-green-100' 
                  : 'text-orange-600 bg-orange-100'
              }`}>
                {stats.conversionRate > 50 ? 'Good' : 'Improve'}
              </span>
            </div>
            <h3 className="text-3xl font-bold text-gray-900">{stats.conversionRate.toFixed(1)}%</h3>
            <p className="text-sm text-gray-600 mt-1">Check-in Rate</p>
            <div className="mt-4 flex items-center text-xs text-gray-500">
              <Users className="h-3 w-3 mr-1" />
              {formatNumber(stats.totalCheckIns)} of {formatNumber(stats.totalTickets)}
            </div>
          </div>
        </div>

        {/* Ticket Analytics by Event and Type */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Ticket Distribution</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">
                {ticketAnalytics.length} ticket types across events
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {ticketAnalytics.map((analytics, index) => {
              const checkInRate = analytics.total_tickets > 0 
                ? (analytics.checked_in_tickets / analytics.total_tickets) * 100 
                : 0

              return (
                <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {analytics.event_title || events.find(e => e.id === analytics.event_id)?.title || 'Unknown Event'}
                      </h3>
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium text-white mt-1 ${getTicketTypeColor(analytics.ticket_type)}`}>
                        {analytics.ticket_type}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-gray-900">{analytics.total_tickets}</p>
                      <p className="text-xs text-gray-500">tickets</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Check-in Progress</span>
                      <span className="text-sm font-medium text-gray-900">{checkInRate.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all"
                        style={{ width: `${checkInRate}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4">
                    <div className="text-center p-2 bg-green-50 rounded">
                      <CheckCircle className="h-4 w-4 text-green-600 mx-auto mb-1" />
                      <p className="text-xs text-gray-600">Checked</p>
                      <p className="text-sm font-bold text-gray-900">{analytics.checked_in_tickets}</p>
                    </div>
                    <div className="text-center p-2 bg-blue-50 rounded">
                      <Clock className="h-4 w-4 text-blue-600 mx-auto mb-1" />
                      <p className="text-xs text-gray-600">Available</p>
                      <p className="text-sm font-bold text-gray-900">{analytics.available_tickets}</p>
                    </div>
                    <div className="text-center p-2 bg-red-50 rounded">
                      <XCircle className="h-4 w-4 text-red-600 mx-auto mb-1" />
                      <p className="text-xs text-gray-600">Cancelled</p>
                      <p className="text-sm font-bold text-gray-900">{analytics.cancelled_tickets}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {ticketAnalytics.length === 0 && (
            <div className="text-center py-12">
              <Ticket className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No ticket data available for the selected filters</p>
            </div>
          )}
        </div>

        {/* Events Overview */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Events Overview</h2>
            <span className="text-sm text-gray-500">{events.length} total events</span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Event
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Venue
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Capacity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {events.map((event) => {
                  const eventTickets = ticketAnalytics
                    .filter(a => a.event_id === event.id)
                    .reduce((sum, a) => sum + a.total_tickets, 0)
                  const capacity = event.max_attendees || 100
                  const utilizationRate = (eventTickets / capacity) * 100
                  const isUpcoming = new Date(event.start_date) > new Date()

                  return (
                    <tr key={event.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{event.title}</div>
                          <div className="text-xs text-gray-500">ID: {event.id.slice(0, 8)}...</div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(event.start_date).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900">
                          <MapPin className="h-3 w-3 mr-1 text-gray-400" />
                          {event.venue}
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          isUpcoming 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {isUpcoming ? 'Upcoming' : 'Past'}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm text-gray-900">
                            {eventTickets} / {capacity}
                          </div>
                          <div className="w-24 bg-gray-200 rounded-full h-1.5 mt-1">
                            <div 
                              className={`h-1.5 rounded-full ${
                                utilizationRate > 80 
                                  ? 'bg-red-500' 
                                  : utilizationRate > 50 
                                  ? 'bg-yellow-500' 
                                  : 'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(utilizationRate, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                        <Link
                          href={`/admin/events/${event.id}`}
                          className="text-[#0b6d41] hover:text-[#0a5835]"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {events.length === 0 && (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No events found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}