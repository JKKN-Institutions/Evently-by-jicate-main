'use client'

import { useState, useEffect, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  BarChart3,
  TrendingUp,
  Users,
  Ticket,
  Shield,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  Download,
  Calendar,
  MapPin
} from 'lucide-react'
import Link from 'next/link'

interface ScanData {
  id: string
  ticket_id: string
  scan_time: string
  scan_status: string
  scanned_by: string
  scan_location?: string
  ticket?: {
    ticket_number: string
    seat_number?: string
    section?: string
  }
  scanner?: {
    full_name: string
    email: string
  }
}

interface HourlyStats {
  hour: string
  scans: number
}

export default function TicketDashboardPage({ 
  params 
}: { 
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = use(params)
  const [stats, setStats] = useState<any>(null)
  const [scanHistory, setScanHistory] = useState<ScanData[]>([])
  const [hourlyData, setHourlyData] = useState<HourlyStats[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const supabase = createClient()

  const fetchData = async () => {
    try {
      // Fetch event statistics
      const statsResponse = await fetch(`/api/tickets/verify?eventId=${eventId}`)
      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStats(statsData)
      }

      // Fetch scan history
      const { data: scans } = await supabase
        .from('ticket_scans')
        .select(`
          *,
          tickets (
            ticket_number,
            seat_number,
            section
          ),
          profiles!scanned_by (
            full_name,
            email
          )
        `)
        .eq('event_id', eventId)
        .order('scan_time', { ascending: false })
        .limit(100)

      if (scans) {
        setScanHistory(scans as any)
        
        // Calculate hourly data
        const hourlyMap = new Map<string, number>()
        const now = new Date()
        
        // Initialize last 24 hours
        for (let i = 23; i >= 0; i--) {
          const hour = new Date(now.getTime() - i * 60 * 60 * 1000)
          const hourKey = hour.getHours().toString().padStart(2, '0') + ':00'
          hourlyMap.set(hourKey, 0)
        }
        
        // Count scans per hour
        scans.forEach(scan => {
          const scanTime = new Date(scan.scan_time)
          const hourKey = scanTime.getHours().toString().padStart(2, '0') + ':00'
          hourlyMap.set(hourKey, (hourlyMap.get(hourKey) || 0) + 1)
        })
        
        setHourlyData(Array.from(hourlyMap.entries()).map(([hour, scans]) => ({ hour, scans })))
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    
    // Set up real-time subscription
    const channel = supabase
      .channel('dashboard-updates')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'ticket_scans',
          filter: `event_id=eq.${eventId}`
        },
        () => {
          fetchData()
        }
      )
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'tickets',
          filter: `event_id=eq.${eventId}`
        },
        () => {
          fetchData()
        }
      )
      .subscribe()

    // Auto-refresh every 10 seconds if enabled
    const interval = autoRefresh ? setInterval(fetchData, 10000) : null

    return () => {
      supabase.removeChannel(channel)
      if (interval) clearInterval(interval)
    }
  }, [eventId, autoRefresh])

  const exportData = () => {
    if (!scanHistory.length) return
    
    const csv = [
      ['Time', 'Ticket Number', 'Status', 'Seat', 'Section', 'Scanner'],
      ...scanHistory.map(scan => [
        new Date(scan.scan_time).toLocaleString(),
        scan.ticket?.ticket_number || '',
        scan.scan_status,
        scan.ticket?.seat_number || '',
        scan.ticket?.section || '',
        scan.scanner?.full_name || ''
      ])
    ].map(row => row.join(',')).join('\n')
    
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ticket-scans-${eventId}-${new Date().toISOString()}.csv`
    a.click()
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#0b6d41]"></div>
      </div>
    )
  }

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'success':
        return <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Success</span>
      case 'already_used':
        return <span className="px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-800">Already Used</span>
      case 'invalid':
        return <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">Invalid</span>
      case 'expired':
        return <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">Expired</span>
      default:
        return <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">{status}</span>
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href={`/verify/${eventId}`}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Verification Dashboard</h1>
                {stats && (
                  <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {new Date(stats.event_date).toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      {stats.event_venue}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  autoRefresh 
                    ? 'bg-green-100 text-green-700 border border-green-300' 
                    : 'bg-gray-100 text-gray-700 border border-gray-300'
                }`}
              >
                <RefreshCw className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
                Auto Refresh {autoRefresh ? 'ON' : 'OFF'}
              </button>
              <button
                onClick={exportData}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <Ticket className="h-8 w-8 text-blue-500" />
              <span className="text-2xl font-bold text-gray-900">{stats?.total_tickets || 0}</span>
            </div>
            <p className="text-sm text-gray-600">Total Tickets</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <span className="text-2xl font-bold text-green-600">{stats?.verified_tickets || 0}</span>
            </div>
            <p className="text-sm text-gray-600">Verified</p>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${((stats?.verified_tickets || 0) / (stats?.total_tickets || 1)) * 100}%` }}
              />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <Users className="h-8 w-8 text-blue-500" />
              <span className="text-2xl font-bold text-blue-600">{stats?.unverified_tickets || 0}</span>
            </div>
            <p className="text-sm text-gray-600">Pending</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <Activity className="h-8 w-8 text-purple-500" />
              <span className="text-2xl font-bold text-purple-600">{stats?.scans_last_hour || 0}</span>
            </div>
            <p className="text-sm text-gray-600">Last Hour</p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="h-8 w-8 text-orange-500" />
              <span className="text-2xl font-bold text-orange-600">{stats?.scans_today || 0}</span>
            </div>
            <p className="text-sm text-gray-600">Today</p>
          </div>
        </div>

        {/* Hourly Activity Chart */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Hourly Activity (Last 24 Hours)</h3>
          <div className="h-64 flex items-end space-x-1">
            {hourlyData.map((data, index) => (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div 
                  className="w-full bg-gradient-to-t from-[#0b6d41] to-[#15a862] rounded-t transition-all hover:opacity-80"
                  style={{ height: `${(data.scans / Math.max(...hourlyData.map(d => d.scans), 1)) * 200}px` }}
                  title={`${data.hour}: ${data.scans} scans`}
                />
                {index % 4 === 0 && (
                  <span className="text-xs text-gray-500 mt-1">{data.hour}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Recent Scan History */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Scan History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ticket</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Seat</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scanner</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {scanHistory.map((scan) => (
                  <tr key={scan.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(scan.scan_time).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      {scan.ticket?.ticket_number || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {scan.ticket?.seat_number ? (
                        <>
                          {scan.ticket.section && `${scan.ticket.section} - `}
                          Seat {scan.ticket.seat_number}
                        </>
                      ) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(scan.scan_status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {scan.scanner?.full_name || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}