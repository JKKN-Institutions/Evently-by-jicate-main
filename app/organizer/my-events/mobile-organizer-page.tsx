import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Calendar, Users, TrendingUp, Plus, Search, Filter, BarChart3, Eye } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import MyEventsClient from './my-events-client'

async function getOrganizerData() {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    redirect('/events')
  }

  // Check if user is organizer or admin
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile || (profile.role !== 'organizer' && profile.role !== 'admin')) {
    redirect('/profile/upgrade-to-organizer')
  }

  // Get organizer's events with booking and payment data
  const { data: events, error } = await supabase
    .from('events')
    .select(`
      *,
      bookings (
        id,
        quantity,
        total_amount,
        payment_status,
        created_at
      )
    `)
    .eq('organizer_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching events:', error)
    return { events: [], user }
  }

  // Calculate stats for each event
  const eventsWithStats = events?.map(event => {
    const bookings = event.bookings || []
    const totalBookings = bookings.length
    const totalRevenue = bookings
      .filter(booking => booking.payment_status === 'completed')
      .reduce((sum, booking) => sum + booking.total_amount, 0)
    const totalAttendees = bookings
      .filter(booking => booking.payment_status === 'completed')
      .reduce((sum, booking) => sum + booking.quantity, 0)
    const pendingPayments = bookings.filter(booking => booking.payment_status === 'pending').length

    return {
      ...event,
      stats: {
        totalBookings,
        totalRevenue,
        totalAttendees,
        pendingPayments
      }
    }
  }) || []

  return { events: eventsWithStats, user }
}

export default async function MobileOrganizerPage() {
  const { events, user } = await getOrganizerData()

  // Calculate overall stats
  const totalEvents = events.length
  const totalRevenue = events.reduce((sum, event) => sum + event.stats.totalRevenue, 0)
  const totalAttendees = events.reduce((sum, event) => sum + event.stats.totalAttendees, 0)
  const activeEvents = events.filter(event => event.status === 'published').length

  const stats = {
    totalEvents,
    totalRevenue,
    totalAttendees,
    activeEvents
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="bg-white shadow-sm border-b lg:hidden">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-900">My Events</h1>
              <p className="text-sm text-gray-600">Manage your events</p>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <Search className="h-5 w-5" />
              </button>
              <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <Filter className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Header */}
      <div className="bg-white shadow-sm border-b hidden lg:block">
        <div className="px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">My Events Dashboard</h1>
              <p className="text-gray-600 mt-2">Manage and track your event performance</p>
            </div>
            <div className="flex items-center gap-4">
              <button className="flex items-center gap-2 px-4 py-2 bg-[#0b6d41] text-white rounded-xl hover:bg-[#0a5d37] transition-colors">
                <Plus className="h-4 w-4" />
                Create Event
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 lg:p-6 max-w-7xl mx-auto">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6 mb-6 lg:mb-8">
          <div className="bg-white rounded-2xl p-4 lg:p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs lg:text-sm font-medium text-gray-600">Total Events</p>
                <p className="text-xl lg:text-3xl font-bold text-gray-900 mt-1 lg:mt-2">{stats.totalEvents}</p>
              </div>
              <div className="bg-[#0b6d41]/10 p-2 lg:p-2.5 rounded-xl">
                <Calendar className="h-5 w-5 lg:h-6 lg:w-6 text-[#0b6d41]" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 lg:p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs lg:text-sm font-medium text-gray-600">Active Events</p>
                <p className="text-xl lg:text-3xl font-bold text-gray-900 mt-1 lg:mt-2">{stats.activeEvents}</p>
              </div>
              <div className="bg-green-600/10 p-2 lg:p-2.5 rounded-xl">
                <Eye className="h-5 w-5 lg:h-6 lg:w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 lg:p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs lg:text-sm font-medium text-gray-600">Total Attendees</p>
                <p className="text-xl lg:text-3xl font-bold text-gray-900 mt-1 lg:mt-2">{stats.totalAttendees}</p>
              </div>
              <div className="bg-blue-600/10 p-2 lg:p-2.5 rounded-xl">
                <Users className="h-5 w-5 lg:h-6 lg:w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 lg:p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs lg:text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-lg lg:text-2xl font-bold text-gray-900 mt-1 lg:mt-2">₹{formatPrice(stats.totalRevenue)}</p>
              </div>
              <div className="bg-purple-600/10 p-2 lg:p-2.5 rounded-xl">
                <TrendingUp className="h-5 w-5 lg:h-6 lg:w-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions - Mobile Only */}
        <div className="grid grid-cols-2 gap-3 mb-6 lg:hidden">
          <button className="bg-[#0b6d41] text-white rounded-2xl p-4 flex items-center justify-center gap-2 font-semibold">
            <Plus className="h-5 w-5" />
            Create Event
          </button>
          <button className="bg-white border border-gray-200 text-gray-700 rounded-2xl p-4 flex items-center justify-center gap-2 font-semibold">
            <BarChart3 className="h-5 w-5" />
            Analytics
          </button>
        </div>

        {/* Events List */}
        {events.length === 0 ? (
          <div className="text-center py-20">
            <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 max-w-lg mx-auto">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Calendar className="h-10 w-10 text-gray-400" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-4">No events yet</h3>
              <p className="text-gray-600 mb-8">
                Create your first event to start building your audience and generating revenue.
              </p>
              <button className="bg-[#0b6d41] text-white px-8 py-4 rounded-xl hover:bg-[#0a5d37] transition-colors font-semibold inline-flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Create Your First Event
              </button>
            </div>
          </div>
        ) : (
          <MyEventsClient events={events} />
        )}
      </div>
    </div>
  )
}
