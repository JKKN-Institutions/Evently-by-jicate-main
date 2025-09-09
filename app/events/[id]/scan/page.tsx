'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import { 
  ArrowLeft,
  BarChart3,
  Users,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react'
import Link from 'next/link'
import MobileQRScanner from '@/components/qr/mobile-qr-scanner'
import ClientTimeDisplay from '@/components/ui/client-time-display'

interface ScanResult {
  success: boolean
  message: string
  scan_result: 'success' | 'already_used' | 'invalid' | 'expired' | 'wrong_event' | 'cancelled'
  ticket_info?: {
    ticket_number: string
    customer_name: string
    customer_email?: string
    event_title?: string
    checked_in_at?: string
  }
}

interface EventData {
  id: string
  title: string
  date: string
  time: string
  venue: string
  location: string
}

export default function ScanTicketsPage() {
  const params = useParams()
  const router = useRouter()
  const eventId = params.id as string
  const [event, setEvent] = useState<EventData | null>(null)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([])
  const [stats, setStats] = useState({
    totalScanned: 0,
    successfulScans: 0,
    duplicateScans: 0,
    invalidScans: 0,
    totalTickets: 0,
    checkedInTickets: 0
  })
  const supabase = createClient()

  useEffect(() => {
    checkAuthorization()
    fetchEvent()
    loadTicketStats()
  }, [eventId])

  const checkAuthorization = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/signin')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role === 'admin' || profile?.role === 'organizer') {
        setIsAuthorized(true)
      } else {
        const { data: staffMember } = await supabase
          .from('event_staff')
          .select('*')
          .eq('event_id', eventId)
          .eq('user_id', user.id)
          .single()

        if (staffMember) {
          setIsAuthorized(true)
        } else {
          router.push('/events')
        }
      }
    } catch (error) {
      console.error('Authorization check failed:', error)
      router.push('/events')
    } finally {
      setLoading(false)
    }
  }

  const fetchEvent = async () => {
    try {
      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single()

      if (data) {
        setEvent(data)
      }
    } catch (error) {
      console.error('Error fetching event:', error)
    }
  }

  const loadTicketStats = async () => {
    try {
      const { data: tickets } = await supabase
        .from('tickets')
        .select('status')
        .eq('event_id', eventId)

      if (tickets) {
        setStats(prev => ({
          ...prev,
          totalTickets: tickets.length,
          checkedInTickets: tickets.filter(t => t.status === 'used').length
        }))
      }
    } catch (error) {
      console.error('Error loading ticket stats:', error)
    }
  }

  const handleScanResult = (result: ScanResult) => {
    setScanHistory(prev => [result, ...prev.slice(0, 9)]) // Keep last 10 scans
    
    // Update stats
    setStats(prev => ({
      ...prev,
      totalScanned: prev.totalScanned + 1,
      successfulScans: result.scan_result === 'success' ? prev.successfulScans + 1 : prev.successfulScans,
      duplicateScans: result.scan_result === 'already_used' ? prev.duplicateScans + 1 : prev.duplicateScans,
      invalidScans: ['invalid', 'expired', 'wrong_event', 'cancelled'].includes(result.scan_result) ? prev.invalidScans + 1 : prev.invalidScans,
      checkedInTickets: result.scan_result === 'success' ? prev.checkedInTickets + 1 : prev.checkedInTickets
    }))

    // Reload ticket stats to get accurate count
    loadTicketStats()
  }

  const getScanIcon = (result: ScanResult) => {
    switch (result.scan_result) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'already_used':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />
      default:
        return <XCircle className="h-5 w-5 text-red-500" />
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600 mb-6">You don't have permission to scan tickets for this event.</p>
          <Link
            href="/events"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Back to Events
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/events/${eventId}`}
                className="text-gray-500 hover:text-gray-700 flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{event?.title}</h1>
                <p className="text-sm text-gray-600">Ticket Scanner</p>
              </div>
            </div>
            <Link
              href={`/events/${eventId}/qr-codes`}
              className="text-blue-600 hover:text-blue-700 flex items-center gap-2 text-sm"
            >
              <BarChart3 className="h-4 w-4" />
              QR Management
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Scanner */}
          <div className="lg:col-span-2">
            <MobileQRScanner
              eventId={eventId}
              eventTitle={event?.title || 'Event'}
              onScanResult={handleScanResult}
            />
          </div>

          {/* Stats & History */}
          <div className="space-y-6">
            {/* Stats */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Scan Statistics</h3>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Tickets</span>
                  <span className="font-medium">{stats.totalTickets}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Checked In</span>
                  <span className="font-medium text-green-600">{stats.checkedInTickets}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Scans</span>
                  <span className="font-medium">{stats.totalScanned}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Successful</span>
                  <span className="font-medium text-green-600">{stats.successfulScans}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Duplicates</span>
                  <span className="font-medium text-yellow-600">{stats.duplicateScans}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Invalid</span>
                  <span className="font-medium text-red-600">{stats.invalidScans}</span>
                </div>
              </div>
            </div>

            {/* Recent Scans */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Scans</h3>
              {scanHistory.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No scans yet</p>
              ) : (
                <div className="space-y-3">
                  {scanHistory.map((scan, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      {getScanIcon(scan)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {scan.ticket_info?.ticket_number || 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-600 truncate">
                          {scan.ticket_info?.customer_name || scan.message}
                        </p>
                        <ClientTimeDisplay />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}