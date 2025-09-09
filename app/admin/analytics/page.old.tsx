'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, BarChart3, Users, Calendar, DollarSign, TrendingUp, Filter, Ticket, QrCode, Eye, CheckCircle, XCircle, Clock, Activity } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface TicketAnalytics {
  event_id: string
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

interface ScanMetrics {
  total_generated: number
  total_scanned: number
  total_unscanned: number
  total_checked_in: number
  scan_rate: number
  check_in_rate: number
  avg_scans_per_ticket: number
  recent_scans: RecentScan[]
}

interface RecentScan {
  ticket_number: string
  scan_type: string
  scan_result: string
  created_at: string
  scanner_name?: string
}

interface EventData {
  id: string
  title: string
  start_date: string
  venue: string
}

export default function AdminAnalyticsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [ticketAnalytics, setTicketAnalytics] = useState<TicketAnalytics[]>([])
  const [scanMetrics, setScanMetrics] = useState<ScanMetrics>({
    total_generated: 0,
    total_scanned: 0,
    total_unscanned: 0,
    total_checked_in: 0,
    scan_rate: 0,
    check_in_rate: 0,
    avg_scans_per_ticket: 0,
    recent_scans: []
  })
  const [events, setEvents] = useState<EventData[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string>('all')
  const [selectedTicketType, setSelectedTicketType] = useState<string>('all')
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [recentScans, setRecentScans] = useState<RecentScan[]>([])
  const supabase = createClient()

  useEffect(() => {
    checkAuth()
    loadAnalytics()
  }, [selectedEventId, selectedTicketType])

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
      const { data: eventsData, error: eventsError } = await supabase
        .from('events')
        .select('id, title, start_date, venue')
        .order('start_date', { ascending: false })

      if (eventsError) {
        console.error('Error loading events:', eventsError)
        throw eventsError
      }
      setEvents(eventsData || [])

      // Build query for ticket analytics with scan data
      let analyticsQuery = supabase
        .from('tickets')
        .select('event_id, ticket_type, status, scan_count, first_scanned_at, last_scanned_at')

      if (selectedEventId !== 'all') {
        analyticsQuery = analyticsQuery.eq('event_id', selectedEventId)
      }

      const { data: ticketsData, error: ticketsError } = await analyticsQuery

      if (ticketsError) {
        console.error('Error loading tickets:', ticketsError)
        throw ticketsError
      }

      console.log('Tickets loaded:', {
        count: ticketsData?.length || 0,
        selectedEventId,
        selectedTicketType,
        sample: ticketsData?.slice(0, 2)
      })

      // Process analytics data with scan metrics
      const analyticsMap = new Map<string, TicketAnalytics>()
      let totalGenerated = 0
      let totalScanned = 0
      let totalUnscanned = 0
      let totalCheckedIn = 0
      let totalScanCount = 0

      ticketsData?.forEach(ticket => {
        const key = `${ticket.event_id}-${ticket.ticket_type}`
        
        if (!analyticsMap.has(key)) {
          analyticsMap.set(key, {
            event_id: ticket.event_id,
            ticket_type: ticket.ticket_type || 'Bronze',
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
        totalGenerated++

        // Track scan status
        if (ticket.scan_count && ticket.scan_count > 0) {
          analytics.scanned_tickets = (analytics.scanned_tickets || 0) + 1
          analytics.scan_count = (analytics.scan_count || 0) + ticket.scan_count
          totalScanned++
          totalScanCount += ticket.scan_count
        } else {
          analytics.unscanned_tickets = (analytics.unscanned_tickets || 0) + 1
          totalUnscanned++
        }

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

        // Update scan timestamps
        if (ticket.first_scanned_at && (!analytics.first_scanned_at || ticket.first_scanned_at < analytics.first_scanned_at)) {
          analytics.first_scanned_at = ticket.first_scanned_at
        }
        if (ticket.last_scanned_at && (!analytics.last_scanned_at || ticket.last_scanned_at > analytics.last_scanned_at)) {
          analytics.last_scanned_at = ticket.last_scanned_at
        }
      })

      // Filter by ticket type if needed
      let filteredAnalytics = Array.from(analyticsMap.values())
      
      if (selectedTicketType !== 'all') {
        filteredAnalytics = filteredAnalytics.filter(a => a.ticket_type === selectedTicketType)
      }

      setTicketAnalytics(filteredAnalytics)

      // Calculate scan metrics
      const scanRate = totalGenerated > 0 ? (totalScanned / totalGenerated) * 100 : 0
      const checkInRate = totalGenerated > 0 ? (totalCheckedIn / totalGenerated) * 100 : 0
      const avgScansPerTicket = totalScanned > 0 ? totalScanCount / totalScanned : 0

      setScanMetrics({
        total_generated: totalGenerated,
        total_scanned: totalScanned,
        total_unscanned: totalUnscanned,
        total_checked_in: totalCheckedIn,
        scan_rate: scanRate,
        check_in_rate: checkInRate,
        avg_scans_per_ticket: avgScansPerTicket,
        recent_scans: []
      })

      // Load recent scan logs
      let scanLogsQuery = supabase
        .from('ticket_scan_logs')
        .select('ticket_number, scan_type, scan_result, created_at, scanner_name')
        .order('created_at', { ascending: false })
        .limit(10)

      if (selectedEventId !== 'all') {
        scanLogsQuery = scanLogsQuery.eq('event_id', selectedEventId)
      }

      const { data: scanLogs } = await scanLogsQuery
      if (scanLogs) {
        setRecentScans(scanLogs)
      }

      // Load revenue data
      let revenueQuery = supabase
        .from('payments')
        .select('amount')
        .eq('status', 'captured')

      if (selectedEventId !== 'all') {
        revenueQuery = revenueQuery.eq('event_id', selectedEventId)
      }

      const { data: paymentsData, error: paymentsError } = await revenueQuery

      if (!paymentsError && paymentsData) {
        const revenue = paymentsData.reduce((sum, payment) => sum + (payment.amount || 0), 0)
        setTotalRevenue(revenue / 100) // Convert from cents to dollars
      }

    } catch (error: any) {
      console.error('Error loading analytics:', {
        message: error?.message || 'Unknown error',
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        error
      })
      // Don't throw, just log the error and continue
    } finally {
      setLoading(false)
    }
  }

  const getTicketTypeColor = (type: string) => {
    switch (type) {
      case 'Gold':
        return 'bg-yellow-500 text-yellow-900'
      case 'Silver':
        return 'bg-gray-300 text-gray-900'
      case 'Bronze':
        return 'bg-orange-600 text-orange-100'
      default:
        return 'bg-blue-500 text-white'
    }
  }

  const getScanStatusColor = (result: string) => {
    switch (result) {
      case 'success':
        return 'text-green-600'
      case 'already_used':
        return 'text-yellow-600'
      case 'invalid':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0b6d41]"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/admin" className="text-2xl font-bold text-[#0b6d41]">
                Admin
              </Link>
              <div className="h-6 w-px bg-gray-300"></div>
              <h1 className="text-lg font-semibold text-gray-900">Ticket Analytics & QR Tracking</h1>
            </div>
            <Link
              href="/admin"
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Admin
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold">Filters</h2>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Event
              </label>
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
              >
                <option value="all">All Events</option>
                {events.map(event => (
                  <option key={event.id} value={event.id}>
                    {event.title} - {new Date(event.start_date).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ticket Type
              </label>
              <select
                value={selectedTicketType}
                onChange={(e) => setSelectedTicketType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
              >
                <option value="all">All Types</option>
                <option value="Gold">Gold</option>
                <option value="Silver">Silver</option>
                <option value="Bronze">Bronze</option>
              </select>
            </div>
          </div>
        </div>

        {/* QR Scan Metrics Cards */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <QrCode className="h-5 w-5 mr-2 text-[#0b6d41]" />
            QR Code Scan Metrics
          </h2>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Generated</p>
                  <p className="text-2xl font-bold text-gray-900">{scanMetrics.total_generated}</p>
                  <p className="text-xs text-gray-500 mt-1">All tickets created</p>
                </div>
                <Ticket className="h-8 w-8 text-blue-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Scanned Tickets</p>
                  <p className="text-2xl font-bold text-green-600">{scanMetrics.total_scanned}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {scanMetrics.scan_rate.toFixed(1)}% scan rate
                  </p>
                </div>
                <Eye className="h-8 w-8 text-green-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Unscanned</p>
                  <p className="text-2xl font-bold text-amber-600">{scanMetrics.total_unscanned}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Never scanned
                  </p>
                </div>
                <XCircle className="h-8 w-8 text-amber-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Checked In</p>
                  <p className="text-2xl font-bold text-purple-600">{scanMetrics.total_checked_in}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {scanMetrics.check_in_rate.toFixed(1)}% check-in rate
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-purple-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">${totalRevenue.toFixed(2)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Avg Scans/Ticket</p>
                <p className="text-2xl font-bold text-gray-900">
                  {scanMetrics.avg_scans_per_ticket.toFixed(1)}
                </p>
              </div>
              <Activity className="h-8 w-8 text-indigo-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Scan Success Rate</p>
                <p className="text-2xl font-bold text-gray-900">
                  {scanMetrics.scan_rate > 0 ? `${scanMetrics.scan_rate.toFixed(1)}%` : '0%'}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-500" />
            </div>
          </div>
        </div>

        {/* Recent Scans */}
        {recentScans.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold flex items-center">
                <Clock className="h-5 w-5 mr-2 text-gray-500" />
                Recent QR Scans
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {recentScans.slice(0, 5).map((scan, index) => (
                  <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div className="flex items-center gap-3">
                      <QrCode className={`h-4 w-4 ${getScanStatusColor(scan.scan_result)}`} />
                      <div>
                        <p className="text-sm font-medium">{scan.ticket_number}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(scan.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-medium ${getScanStatusColor(scan.scan_result)}`}>
                        {scan.scan_result === 'success' ? 'Valid' : 
                         scan.scan_result === 'already_used' ? 'Already Used' : 
                         'Invalid'}
                      </span>
                      {scan.scanner_name && (
                        <p className="text-xs text-gray-500">{scan.scanner_name}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Detailed Analytics Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Detailed Ticket Analytics</h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Event
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Scanned
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unscanned
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Checked In
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Scan Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Scan
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {ticketAnalytics.map((analytics, index) => {
                  const event = events.find(e => e.id === analytics.event_id)
                  const scanRate = analytics.total_tickets > 0 
                    ? ((analytics.scanned_tickets || 0) / analytics.total_tickets * 100).toFixed(1)
                    : '0'
                  
                  return (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {event?.title || 'Unknown Event'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {event?.venue}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${getTicketTypeColor(analytics.ticket_type)}`}>
                          {analytics.ticket_type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {analytics.total_tickets}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-green-600">
                          {analytics.scanned_tickets || 0}
                        </span>
                        {analytics.scan_count && analytics.scan_count > (analytics.scanned_tickets || 0) && (
                          <span className="text-xs text-gray-500 ml-1">
                            ({analytics.scan_count} scans)
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-amber-600">
                        {analytics.unscanned_tickets || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-purple-600">
                        {analytics.checked_in_tickets}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-1 bg-gray-200 rounded-full h-2 mr-2">
                            <div 
                              className="bg-green-500 h-2 rounded-full"
                              style={{ width: `${scanRate}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-900">{scanRate}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {analytics.last_scanned_at 
                          ? new Date(analytics.last_scanned_at).toLocaleDateString()
                          : 'Never'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            
            {ticketAnalytics.length === 0 && (
              <div className="text-center py-12">
                <Ticket className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">No ticket data available for the selected filters</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}