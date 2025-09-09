'use client'

import { useState, useEffect } from 'react'
import { 
  BarChart3, 
  Users, 
  Ticket, 
  TrendingUp, 
  Clock, 
  DollarSign,
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  QrCode,
  Scan
} from 'lucide-react'

interface EventStatistics {
  id: string
  title: string
  date: string
  status: string
  location: string
  price: number
  maxAttendees: number
  statistics: {
    totalTickets: number
    paidTickets: number
    pendingTickets: number
    cancelledTickets: number
    scannedTickets: number
    unscannedTickets: number
    revenue: number
    scanRate: string
    occupancyRate: string
    availableSpots: number
  }
  timeStatus: {
    isUpcoming: boolean
    isToday: boolean
    isPast: boolean
  }
  recentScans: Array<{
    id: string
    ticketId: string
    validatedAt: string
    validatedBy: string
  }>
}

interface TotalStats {
  totalEvents: number
  totalTicketsGenerated: number
  totalTicketsScanned: number
  totalRevenue: number
  scanRate: number
  upcomingEvents: number
  todayEvents: number
  pastEvents: number
  activeEvents: number
}

interface RealTimeStatisticsProps {
  eventId?: string
  autoRefresh?: boolean
  refreshInterval?: number
}

export function RealTimeStatistics({ 
  eventId, 
  autoRefresh = true, 
  refreshInterval = 30000 // 30 seconds
}: RealTimeStatisticsProps) {
  const [events, setEvents] = useState<EventStatistics[]>([])
  const [totalStats, setTotalStats] = useState<TotalStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [selectedEvent, setSelectedEvent] = useState<string | null>(eventId || null)

  const fetchStatistics = async () => {
    try {
      const url = eventId 
        ? `/api/organizer/statistics?eventId=${eventId}`
        : '/api/organizer/statistics'
        
      const response = await fetch(url)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch statistics')
      }

      setEvents(data.events)
      setTotalStats(data.totalStats)
      setLastUpdated(new Date(data.lastUpdated))
      setError(null)
    } catch (err) {
      console.error('Error fetching statistics:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch statistics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStatistics()

    if (autoRefresh) {
      const interval = setInterval(fetchStatistics, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [eventId, autoRefresh, refreshInterval])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0
    }).format(amount)
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg p-6 shadow">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center gap-2 text-red-700">
          <AlertCircle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      </div>
    )
  }

  const currentEvent = selectedEvent 
    ? events.find(e => e.id === selectedEvent)
    : events[0]

  return (
    <div className="space-y-6">
      {/* Header with Refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Real-Time Statistics</h2>
          <p className="text-sm text-gray-500">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={fetchStatistics}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Overall Statistics */}
      {totalStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm">Total Events</p>
                <p className="text-3xl font-bold">{totalStats.totalEvents}</p>
                <p className="text-blue-100 text-xs mt-1">
                  {totalStats.activeEvents} active
                </p>
              </div>
              <BarChart3 className="h-10 w-10 text-blue-200" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm">Total Revenue</p>
                <p className="text-3xl font-bold">{formatCurrency(totalStats.totalRevenue)}</p>
                <p className="text-green-100 text-xs mt-1">
                  All paid tickets
                </p>
              </div>
              <DollarSign className="h-10 w-10 text-green-200" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm">Tickets Generated</p>
                <p className="text-3xl font-bold">{totalStats.totalTicketsGenerated}</p>
                <p className="text-purple-100 text-xs mt-1">
                  {totalStats.totalTicketsScanned} scanned
                </p>
              </div>
              <Ticket className="h-10 w-10 text-purple-200" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm">Scan Rate</p>
                <p className="text-3xl font-bold">{totalStats.scanRate.toFixed(1)}%</p>
                <p className="text-orange-100 text-xs mt-1">
                  Overall attendance
                </p>
              </div>
              <QrCode className="h-10 w-10 text-orange-200" />
            </div>
          </div>
        </div>
      )}

      {/* Event Selector if multiple events */}
      {events.length > 1 && (
        <div className="bg-white rounded-lg shadow p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Event
          </label>
          <select
            value={selectedEvent || ''}
            onChange={(e) => setSelectedEvent(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {events.map(event => (
              <option key={event.id} value={event.id}>
                {event.title} - {new Date(event.date).toLocaleDateString()}
                {event.timeStatus.isToday && ' (TODAY)'}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Detailed Event Statistics */}
      {currentEvent && (
        <div className="space-y-6">
          {/* Event Header */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">{currentEvent.title}</h3>
                <p className="text-gray-500">
                  {new Date(currentEvent.date).toLocaleDateString()} • {currentEvent.location}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {currentEvent.timeStatus.isToday && (
                  <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium flex items-center gap-1">
                    <Activity className="h-3 w-3" />
                    Live Now
                  </span>
                )}
                {currentEvent.timeStatus.isUpcoming && !currentEvent.timeStatus.isToday && (
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                    Upcoming
                  </span>
                )}
                {currentEvent.timeStatus.isPast && (
                  <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">
                    Past Event
                  </span>
                )}
              </div>
            </div>

            {/* Ticket Statistics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-gray-600 mb-1">
                  <Ticket className="h-4 w-4" />
                  <span className="text-sm">Total Tickets</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {currentEvent.statistics.totalTickets}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {currentEvent.statistics.availableSpots} spots left
                </p>
              </div>

              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-600 mb-1">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm">Paid</span>
                </div>
                <p className="text-2xl font-bold text-green-900">
                  {currentEvent.statistics.paidTickets}
                </p>
                <p className="text-xs text-green-600 mt-1">
                  {formatCurrency(currentEvent.statistics.revenue)}
                </p>
              </div>

              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-blue-600 mb-1">
                  <Scan className="h-4 w-4" />
                  <span className="text-sm">Scanned</span>
                </div>
                <p className="text-2xl font-bold text-blue-900">
                  {currentEvent.statistics.scannedTickets}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  {currentEvent.statistics.scanRate}% scan rate
                </p>
              </div>

              <div className="bg-yellow-50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-yellow-600 mb-1">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm">Pending</span>
                </div>
                <p className="text-2xl font-bold text-yellow-900">
                  {currentEvent.statistics.pendingTickets}
                </p>
                <p className="text-xs text-yellow-600 mt-1">
                  Awaiting payment
                </p>
              </div>
            </div>

            {/* Progress Bars */}
            <div className="mt-6 space-y-4">
              <div>
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Occupancy Rate</span>
                  <span>{currentEvent.statistics.occupancyRate}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${currentEvent.statistics.occupancyRate}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm text-gray-600 mb-1">
                  <span>Check-in Progress</span>
                  <span>{currentEvent.statistics.scanRate}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${currentEvent.statistics.scanRate}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Recent Scans */}
          {currentEvent.recentScans.length > 0 && (
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Activity className="h-5 w-5 text-green-500" />
                  Recent Check-ins
                </h3>
              </div>
              <div className="divide-y divide-gray-200">
                {currentEvent.recentScans.map((scan) => (
                  <div key={scan.id} className="px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Ticket #{scan.ticketId.slice(-8).toUpperCase()}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatTime(scan.validatedAt)}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">
                      Just now
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* No Events Message */}
      {events.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Events Found</h3>
          <p className="text-gray-500">Create your first event to see statistics here.</p>
        </div>
      )}
    </div>
  )
}