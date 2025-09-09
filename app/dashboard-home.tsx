'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { 
  Calendar, 
  Ticket, 
  TrendingUp, 
  Plus,
  ArrowRight,
  Clock,
  MapPin,
  Bell,
  Search,
  CreditCard
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatPrice } from '@/lib/utils'

interface DashboardStats {
  totalEvents: number
  myBookings: number
  upcomingEvents: number
  totalSpent: number
}

interface RecentEvent {
  id: string
  title: string
  date: string
  time: string
  venue: string
  image_url?: string
  price: number
  category?: string
}

interface RecentBooking {
  id: string
  event: {
    title: string
    date: string
    venue: string
    image_url?: string
  }
  quantity: number
  total_amount: number
  payment_status: string
}

export default function DashboardHome() {
  interface User {
    id: string
    email?: string
  }
  const [stats, setStats] = useState<DashboardStats>({
    totalEvents: 0,
    myBookings: 0,
    upcomingEvents: 0,
    totalSpent: 0
  })
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([])
  const [recentBookings, setRecentBookings] = useState<RecentBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [userRole, setUserRole] = useState<string>('user')

  const supabase = createClient()

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        console.log('🏠 Fetching dashboard data...')
        
        // Get session instead of user (faster)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError || !session) {
          console.log('📝 No session found')
          setLoading(false)
          return
        }
        
        const user = session.user
        console.log('👤 User:', user.email)
        setUser(user)

        if (user) {
          // Get user role (with maybeSingle to avoid errors)
          console.log('📋 Fetching user profile...')
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .maybeSingle()
          
          const userRole = profile?.role || 'user'
          console.log('🎭 User role:', userRole)
          setUserRole(userRole)

          // Fetch all data in parallel for better performance
          console.log('📊 Fetching dashboard data in parallel...')
          
          const [eventsResult, bookingsResult, recentEventsResult, recentBookingsResult] = await Promise.allSettled([
            // Get total events count
            supabase
              .from('events')
              .select('*', { count: 'exact', head: true }),
            
            // Get user bookings
            supabase
              .from('bookings')
              .select('total_amount')
              .eq('user_id', user.id),
            
            // Get recent events with category
            supabase
              .from('events')
              .select('id, title, date, time, venue, image_url, price, category')
              .eq('status', 'published')
              .order('created_at', { ascending: false })
              .limit(4),
            
            // Get recent bookings
            supabase
              .from('bookings')
              .select(`
                id,
                quantity,
                total_amount,
                payment_status,
                events (
                  title,
                  date,
                  venue,
                  image_url
                )
              `)
              .eq('user_id', user.id)
              .order('created_at', { ascending: false })
              .limit(3)
          ])

          // Process stats
          let totalEvents = 0
          let myBookings = 0
          let totalSpent = 0

          if (eventsResult.status === 'fulfilled') {
            totalEvents = eventsResult.value.count || 0
          }

          if (bookingsResult.status === 'fulfilled' && bookingsResult.value.data) {
            const bookingsData = bookingsResult.value.data
            myBookings = bookingsData.length
            totalSpent = bookingsData.reduce((sum, booking) => sum + (booking.total_amount || 0), 0)
          }

          setStats({
            totalEvents,
            myBookings,
            upcomingEvents: totalEvents,
            totalSpent
          })
          
          console.log('📊 Stats loaded:', { totalEvents, myBookings, totalSpent })

          // Process recent events
          if (recentEventsResult.status === 'fulfilled' && recentEventsResult.value.data) {
            setRecentEvents(recentEventsResult.value.data)
            console.log('📅 Recent events loaded:', recentEventsResult.value.data.length)
          } else {
            setRecentEvents([])
          }

          // Process recent bookings
          if (recentBookingsResult.status === 'fulfilled' && recentBookingsResult.value.data) {
            setRecentBookings(recentBookingsResult.value.data)
            console.log('🎫 Recent bookings loaded:', recentBookingsResult.value.data.length)
          } else {
            setRecentBookings([])
          }
        }
        
        console.log('✅ Dashboard data fetch completed')
      } catch (error) {
        console.error('❌ Dashboard fetch error:', error)
      } finally {
        setLoading(false)
      }
    }

    // Add timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      setLoading(false)
    }, 10000) // 10 second timeout for slower connections

    fetchDashboardData().finally(() => {
      clearTimeout(loadingTimeout)
    })
  }, [supabase])

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#0b6d41] mx-auto mb-1"></div>
          <p className="text-gray-600 text-xs">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-50">
      {/* Compact Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <div className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-medium text-gray-900">
                  {user ? `Welcome, ${user.email?.split('@')[0]}` : 'Welcome to Evently'}
                </h1>
                <p className="text-gray-600 text-sm mt-0.5">
                  {user ? 'Event dashboard' : 'Discover events'}
                </p>
                {userRole && userRole !== 'user' && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#0b6d41]/10 text-[#0b6d41] mt-1">
                    {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <button className="p-1.5 text-gray-400 hover:text-gray-600">
                  <Bell className="h-4 w-4" />
                </button>
                <button className="p-1.5 text-gray-400 hover:text-gray-600">
                  <Search className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Compact Quick Actions */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <Link
            href="/events"
            className="bg-white rounded-md p-3 hover:shadow-sm transition-shadow border border-gray-200 group"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#ffde59]/20 rounded-md flex items-center justify-center group-hover:bg-[#ffde59]/30 transition-colors">
                <Calendar className="h-4 w-4 text-[#0b6d41]" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900 text-sm">Browse Events</h3>
                <p className="text-xs text-gray-500">Find events</p>
              </div>
            </div>
          </Link>

          <Link
            href="/bookings"
            className="bg-white rounded-md p-3 hover:shadow-sm transition-shadow border border-gray-200 group"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-[#0b6d41]/10 rounded-md flex items-center justify-center group-hover:bg-[#0b6d41]/20 transition-colors">
                <Ticket className="h-4 w-4 text-[#0b6d41]" />
              </div>
              <div>
                <h3 className="font-medium text-gray-900 text-sm">My Bookings</h3>
                <p className="text-xs text-gray-500">View tickets</p>
              </div>
            </div>
          </Link>

          {(userRole === 'organizer' || userRole === 'admin') && (
            <Link
              href="/events/create"
              className="bg-white rounded-md p-3 hover:shadow-sm transition-shadow border border-gray-200 group"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#ffde59]/20 rounded-md flex items-center justify-center group-hover:bg-[#ffde59]/30 transition-colors">
                  <Plus className="h-4 w-4 text-[#0b6d41]" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 text-sm">Create Event</h3>
                  <p className="text-xs text-gray-500">Host event</p>
                </div>
              </div>
            </Link>
          )}

          {userRole === 'admin' && (
            <Link
              href="/admin/analytics"
              className="bg-white rounded-md p-3 hover:shadow-sm transition-shadow border border-gray-200 group"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-[#0b6d41]/10 rounded-md flex items-center justify-center group-hover:bg-[#0b6d41]/20 transition-colors">
                  <TrendingUp className="h-4 w-4 text-[#0b6d41]" />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 text-sm">Analytics</h3>
                  <p className="text-xs text-gray-500">View stats</p>
                </div>
              </div>
            </Link>
          )}
        </div>

        {/* Compact Stats Cards */}
        {user && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div className="bg-white rounded-md p-3 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600">Total Events</p>
                  <p className="text-lg font-semibold text-gray-900">{stats.totalEvents}</p>
                </div>
                <Calendar className="h-4 w-4 text-[#0b6d41]" />
              </div>
            </div>

            <div className="bg-white rounded-md p-3 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600">My Bookings</p>
                  <p className="text-lg font-semibold text-gray-900">{stats.myBookings}</p>
                </div>
                <Ticket className="h-4 w-4 text-[#0b6d41]" />
              </div>
            </div>

            <div className="bg-white rounded-md p-3 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600">Upcoming</p>
                  <p className="text-lg font-semibold text-gray-900">{stats.upcomingEvents}</p>
                </div>
                <Clock className="h-4 w-4 text-[#ffde59]" />
              </div>
            </div>

            <div className="bg-white rounded-md p-3 border border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-600">Total Spent</p>
                  <p className="text-lg font-semibold text-gray-900">₹{formatPrice(stats.totalSpent)}</p>
                </div>
                <CreditCard className="h-4 w-4 text-[#0b6d41]" />
              </div>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-4">
          {/* Compact Recent Events */}
          <div className="bg-white rounded-md border border-gray-200">
            <div className="p-3 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-gray-900">Recent Events</h2>
                <Link
                  href="/events"
                  className="text-[#0b6d41] hover:text-[#0a5d37] text-xs font-medium flex items-center gap-1"
                >
                  View all
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
            
            <div className="divide-y divide-gray-100">
              {recentEvents.length > 0 ? (
                recentEvents.map((event) => (
                  <Link
                    key={event.id}
                    href={`/events/${event.id}`}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors"
                  >
                    {/* Small image or icon */}
                    <div className="w-8 h-8 rounded-md overflow-hidden bg-[#ffde59]/10 flex-shrink-0">
                      {event.image_url ? (
                        <img
                          src={event.image_url}
                          alt={event.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Calendar className="h-4 w-4 text-[#0b6d41]" />
                        </div>
                      )}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate text-sm">
                        {event.title}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(event.date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {event.venue}
                        </span>
                      </div>
                    </div>
                    
                    {/* Price */}
                    <div className="text-right">
                      <p className="font-semibold text-[#0b6d41] text-sm">₹{formatPrice(event.price)}</p>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="p-6 text-center">
                  <Calendar className="h-6 w-6 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">No events available</p>
                </div>
              )}
            </div>
          </div>

          {/* Compact Recent Bookings */}
          {user && (
            <div className="bg-white rounded-md border border-gray-200">
              <div className="p-3 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h2 className="font-medium text-gray-900">My Recent Bookings</h2>
                  <Link
                    href="/bookings"
                    className="text-[#0b6d41] hover:text-[#0a5d37] text-xs font-medium flex items-center gap-1"
                  >
                    View all
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
              
              <div className="divide-y divide-gray-100">
                {recentBookings.length > 0 ? (
                  recentBookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="flex items-center gap-3 p-3"
                    >
                      {/* Small icon */}
                      <div className="w-8 h-8 rounded-md bg-[#0b6d41]/10 flex items-center justify-center flex-shrink-0">
                        <Ticket className="h-4 w-4 text-[#0b6d41]" />
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 truncate text-sm">
                          {booking.event?.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                          <span>{booking.quantity} ticket{booking.quantity > 1 ? 's' : ''}</span>
                          <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                            booking.payment_status === 'completed'
                              ? 'bg-green-100 text-green-700'
                              : booking.payment_status === 'pending'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {booking.payment_status}
                          </span>
                        </div>
                      </div>
                      
                      {/* Amount */}
                      <div className="text-right">
                        <p className="font-semibold text-gray-900 text-sm">₹{formatPrice(booking.total_amount)}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center">
                    <Ticket className="h-6 w-6 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm mb-2">No bookings yet</p>
                    <Link
                      href="/events"
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#0b6d41] text-white rounded-md hover:bg-[#0a5d37] transition-colors text-sm"
                    >
                      Browse Events
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}