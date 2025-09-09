import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, Users, Ticket, CheckCircle, XCircle, Clock, TrendingUp } from 'lucide-react'
import { formatDate, formatTime } from '@/lib/utils'

async function getEventDashboardData(eventId: string) {
  const supabase = await createClient()
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Check if user is event organizer
  const { data: event } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single()

  if (!event || event.organizer_id !== user.id) {
    return null
  }

  // Get tickets data
  const { data: tickets } = await supabase
    .from('tickets')
    .select(`
      *,
      bookings (
        user_name,
        user_email,
        quantity,
        total_amount
      )
    `)
    .eq('event_id', eventId)

  // Get check-ins data
  const { data: checkIns } = await supabase
    .from('check_ins')
    .select(`
      *,
      profiles!scanned_by (
        full_name,
        email
      )
    `)
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })
    .limit(20)

  // Calculate stats
  const stats = {
    totalTickets: tickets?.length || 0,
    checkedIn: tickets?.filter(t => t.status === 'used').length || 0,
    pending: tickets?.filter(t => t.status === 'valid').length || 0,
    revenue: tickets?.reduce((sum, t) => sum + (t.bookings?.total_amount || 0), 0) || 0,
    checkInRate: 0
  }
  
  stats.checkInRate = stats.totalTickets > 0 
    ? Math.round((stats.checkedIn / stats.totalTickets) * 100) 
    : 0

  // Group check-ins by hour for chart
  const checkInsByHour = new Map<string, number>()
  tickets?.filter(t => t.checked_in_at).forEach(ticket => {
    const hour = new Date(ticket.checked_in_at).getHours()
    const key = `${hour}:00`
    checkInsByHour.set(key, (checkInsByHour.get(key) || 0) + 1)
  })

  return {
    event,
    stats,
    recentCheckIns: checkIns || [],
    checkInsByHour: Array.from(checkInsByHour.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }
}

export default async function EventDashboardPage({ 
  params 
}: { 
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getEventDashboardData(id)

  if (!data) {
    notFound()
  }

  const { event, stats, recentCheckIns, checkInsByHour } = data

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="text-2xl font-bold text-gray-900">
              Event Dashboard
            </Link>
            <Link
              href={`/events/${id}/scan`}
              className="bg-[#0b6d41] text-white hover:bg-[#0a5d37] px-4 py-2 rounded-md text-sm font-medium"
            >
              Open Scanner
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <Link
          href={`/events/${id}`}
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Event
        </Link>

        {/* Event Info */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold mb-2">{event.title}</h1>
          <p className="text-gray-600">
            {formatDate(event.date)}{event.time && formatTime(event.time) ? ` at ${formatTime(event.time)}` : ''} • {event.venue}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Tickets</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalTickets}</p>
              </div>
              <Ticket className="h-8 w-8 text-[#0b6d41]" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Checked In</p>
                <p className="text-2xl font-bold text-[#0b6d41]">{stats.checkedIn}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-[#0b6d41]" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-[#ffde59]">{stats.pending}</p>
              </div>
              <Clock className="h-8 w-8 text-[#ffde59]" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Check-in Rate</p>
                <p className="text-2xl font-bold text-[#0b6d41]">{stats.checkInRate}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-[#0b6d41]" />
            </div>
          </div>
        </div>

        {/* Check-in Progress */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Check-in Progress</h2>
          <div className="relative">
            <div className="bg-gray-200 rounded-full h-8 overflow-hidden">
              <div
                className="bg-gradient-to-r from-[#0b6d41] to-[#ffde59] h-full transition-all duration-500 flex items-center justify-end pr-4"
                style={{ width: `${stats.checkInRate}%` }}
              >
                <span className="text-white text-sm font-semibold">
                  {stats.checkedIn} / {stats.totalTickets}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Check-ins */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold">Recent Check-ins</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {recentCheckIns.length === 0 ? (
              <p className="text-center py-8 text-gray-500">No check-ins yet</p>
            ) : (
              recentCheckIns.map((checkIn) => (
                <div key={checkIn.id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {checkIn.scan_result === 'success' ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <div>
                        <p className="text-sm font-medium">
                          {checkIn.scan_result === 'success' ? 'Successful check-in' : `Failed: ${checkIn.scan_result}`}
                        </p>
                        <p className="text-xs text-gray-500">
                          Scanned by {checkIn.profiles?.full_name || checkIn.profiles?.email}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm text-gray-500">
                      {new Date(checkIn.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
