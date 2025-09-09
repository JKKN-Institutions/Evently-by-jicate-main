'use client'

import { useState, useEffect, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  QrCode, 
  Search, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  BarChart3,
  Users,
  Ticket,
  Shield,
  Activity,
  Clock,
  TrendingUp
} from 'lucide-react'
import Link from 'next/link'

interface VerificationResult {
  success: boolean
  status: 'success' | 'already_used' | 'invalid' | 'expired'
  message: string
  verified_at?: string
  verified_by?: string
  scan_id?: string
  ticket_info?: {
    ticket_number: string
    event_title: string
    event_date: string
    seat_number?: string
    section?: string
    row_number?: string
    verified_time?: string
  }
}

interface EventStats {
  event_id: string
  event_title: string
  event_date: string
  event_venue: string
  total_tickets: number
  verified_tickets: number
  unverified_tickets: number
  invalid_attempts: number
  scans_last_hour: number
  scans_today: number
  last_scan_time: string
  recent_scans: Array<{
    time: string
    status: string
    ticket_number?: string
  }>
}

export default function EventVerificationPage({ 
  params 
}: { 
  params: Promise<{ eventId: string }>
}) {
  const { eventId } = use(params)
  const [ticketInput, setTicketInput] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [result, setResult] = useState<VerificationResult | null>(null)
  const [stats, setStats] = useState<EventStats | null>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  const supabase = createClient()

  // Fetch event statistics
  const fetchStats = async () => {
    try {
      const response = await fetch(`/api/tickets/verify?eventId=${eventId}`)
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setIsLoadingStats(false)
    }
  }

  // Set up real-time subscription
  useEffect(() => {
    fetchStats()
    
    // Subscribe to real-time changes
    const channel = supabase
      .channel('event-verification')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'tickets',
          filter: `event_id=eq.${eventId}`
        },
        () => {
          // Refresh stats when tickets change
          fetchStats()
        }
      )
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'ticket_scans',
          filter: `event_id=eq.${eventId}`
        },
        () => {
          // Refresh stats when new scans happen
          fetchStats()
        }
      )
      .subscribe()

    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [eventId])

  const handleVerify = async () => {
    if (!ticketInput.trim()) {
      setResult({
        success: false,
        status: 'invalid',
        message: 'Please enter or scan a ticket number'
      })
      return
    }

    setIsVerifying(true)
    setResult(null)

    try {
      // Extract ticket number from QR code if it's QR data
      let ticketNumber = ticketInput.trim()
      
      // If it looks like QR data, try to parse it
      if (ticketNumber.startsWith('{') || ticketNumber.includes('TICKET:')) {
        try {
          if (ticketNumber.includes('TICKET:')) {
            ticketNumber = ticketNumber.split('TICKET:')[1].split(',')[0]
          } else {
            const qrData = JSON.parse(ticketNumber)
            ticketNumber = qrData.ticketNumber || qrData.ticket_number || ticketNumber
          }
        } catch {
          // If parsing fails, use as is
        }
      }

      const response = await fetch('/api/tickets/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticketNumber,
          eventId,
          location: 'Event Entrance',
          deviceInfo: {
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString(),
            page: 'event-verification'
          }
        })
      })

      const result = await response.json()
      
      if (response.ok) {
        setResult(result)
        
        // Clear input on successful verification
        if (result.success) {
          setTimeout(() => {
            setTicketInput('')
            setResult(null)
          }, 5000)
        }
        
        // Refresh stats after verification
        fetchStats()
      } else {
        setResult({
          success: false,
          status: 'invalid',
          message: result.error || 'Verification failed'
        })
      }
    } catch (error) {
      console.error('Verification error:', error)
      setResult({
        success: false,
        status: 'invalid',
        message: 'Failed to verify ticket. Please try again.'
      })
    } finally {
      setIsVerifying(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'success': return 'text-green-600 bg-green-50 border-green-200'
      case 'already_used': return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'invalid': return 'text-red-600 bg-red-50 border-red-200'
      case 'expired': return 'text-gray-600 bg-gray-50 border-gray-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'success': return <CheckCircle className="h-12 w-12 text-green-500" />
      case 'already_used': return <Shield className="h-12 w-12 text-orange-500" />
      case 'invalid': return <XCircle className="h-12 w-12 text-red-500" />
      case 'expired': return <Clock className="h-12 w-12 text-gray-500" />
      default: return <AlertCircle className="h-12 w-12 text-gray-500" />
    }
  }

  const getProgressPercentage = () => {
    if (!stats || stats.total_tickets === 0) return 0
    return Math.round((stats.verified_tickets / stats.total_tickets) * 100)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Shield className="h-8 w-8 text-[#0b6d41]" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Ticket Verification</h1>
                {stats && (
                  <p className="text-sm text-gray-600">{stats.event_title}</p>
                )}
              </div>
            </div>
            <Link
              href={`/verify/${eventId}/dashboard`}
              className="flex items-center gap-2 px-4 py-2 bg-[#0b6d41] text-white rounded-lg hover:bg-[#15a862] transition-colors"
            >
              <BarChart3 className="h-5 w-5" />
              Dashboard
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Real-time Stats Cards */}
        {!isLoadingStats && stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Tickets</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total_tickets}</p>
                </div>
                <Ticket className="h-10 w-10 text-gray-400" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6 border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">Verified</p>
                  <p className="text-3xl font-bold text-green-600 mt-1">{stats.verified_tickets}</p>
                  <p className="text-xs text-gray-500 mt-1">{getProgressPercentage()}% complete</p>
                </div>
                <CheckCircle className="h-10 w-10 text-green-400" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6 border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Unverified</p>
                  <p className="text-3xl font-bold text-blue-600 mt-1">{stats.unverified_tickets}</p>
                </div>
                <Users className="h-10 w-10 text-blue-400" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6 border border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600">Last Hour</p>
                  <p className="text-3xl font-bold text-purple-600 mt-1">{stats.scans_last_hour}</p>
                  <p className="text-xs text-gray-500 mt-1">scans</p>
                </div>
                <Activity className="h-10 w-10 text-purple-400" />
              </div>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        {stats && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-700">Verification Progress</h3>
              <span className="text-sm text-gray-600">{getProgressPercentage()}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-[#0b6d41] to-[#15a862] h-3 rounded-full transition-all duration-500"
                style={{ width: `${getProgressPercentage()}%` }}
              />
            </div>
          </div>
        )}

        {/* Scanner Section */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="text-center mb-6">
            <QrCode className="h-16 w-16 text-[#0b6d41] mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900">Scan or Enter Ticket</h2>
            <p className="text-gray-600 mt-2">Scan QR code or enter ticket number manually</p>
          </div>

          <div className="max-w-md mx-auto">
            <div className="flex gap-2">
              <input
                type="text"
                value={ticketInput}
                onChange={(e) => setTicketInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleVerify()}
                placeholder="Scan QR or enter ticket number..."
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41] text-lg"
                disabled={isVerifying}
                autoFocus
              />
              <button
                onClick={handleVerify}
                disabled={isVerifying}
                className="px-6 py-3 bg-[#0b6d41] text-white rounded-lg hover:bg-[#15a862] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isVerifying ? (
                  <>
                    <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Search className="h-5 w-5" />
                    Verify
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Verification Result */}
          {result && (
            <div className={`mt-6 p-6 rounded-lg border-2 ${getStatusColor(result.status)}`}>
              <div className="flex items-start space-x-4">
                {getStatusIcon(result.status)}
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2">
                    {result.status === 'success' && 'Ticket Verified Successfully!'}
                    {result.status === 'already_used' && 'Ticket Already Verified!'}
                    {result.status === 'invalid' && 'Invalid Ticket!'}
                    {result.status === 'expired' && 'Expired Ticket!'}
                  </h3>
                  <p className="text-sm mb-3">{result.message}</p>
                  
                  {result.ticket_info && (
                    <div className="mt-4 p-4 bg-white/50 rounded-lg">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="font-medium">Ticket:</span> {result.ticket_info.ticket_number}
                        </div>
                        <div>
                          <span className="font-medium">Event:</span> {result.ticket_info.event_title}
                        </div>
                        {result.ticket_info.seat_number && (
                          <div>
                            <span className="font-medium">Seat:</span> {result.ticket_info.seat_number}
                          </div>
                        )}
                        {result.ticket_info.section && (
                          <div>
                            <span className="font-medium">Section:</span> {result.ticket_info.section}
                          </div>
                        )}
                        {result.verified_at && (
                          <div className="col-span-2">
                            <span className="font-medium">Previously verified:</span>{' '}
                            {new Date(result.verified_at).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Recent Scans */}
        {stats && stats.recent_scans && stats.recent_scans.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-600" />
              Recent Scans
            </h3>
            <div className="space-y-2">
              {stats.recent_scans.map((scan, index) => (
                <div key={index} className="flex items-center justify-between py-2 px-3 rounded-lg bg-gray-50">
                  <div className="flex items-center gap-3">
                    {scan.status === 'success' ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : scan.status === 'already_used' ? (
                      <Shield className="h-4 w-4 text-orange-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-sm font-medium">
                      {scan.ticket_number || 'Unknown ticket'}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(scan.time).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}