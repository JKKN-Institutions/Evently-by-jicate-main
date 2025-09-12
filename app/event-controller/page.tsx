'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { Calendar, Users, MapPin, DollarSign, Eye, Edit, BarChart3, CheckCircle, Ticket, Clock, TrendingUp, UserCheck } from 'lucide-react'
import { ChildEvent, EventControllerView } from '@/types/event-pages'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface EventStats {
  eventId: string
  totalBookings: number
  totalRevenue: number
  availableTickets: number
  checkedInCount: number
}

export default function EventControllerDashboard() {
  const { user, profile, loading: authLoading } = useAuth()
  const router = useRouter()
  const [myEvents, setMyEvents] = useState<ChildEvent[]>([])
  const [eventStats, setEventStats] = useState<EventStats[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    // Wait for auth to load
    if (authLoading) {
      console.log('Waiting for auth to load...')
      return
    }
    
    const userId = profile?.id || user?.id
    if (!userId) {
      console.log('No user ID available')
      console.log('Profile:', profile)
      console.log('User:', user)
      setLoading(false)
      return
    }
    
    console.log('========================================')
    console.log('CURRENT USER DETAILS:')
    console.log('User ID:', userId)
    console.log('User Email:', profile?.email || user?.email)
    console.log('User Role:', profile?.role)
    console.log('========================================')
    fetchMyEvents()
  }, [profile, user, authLoading])

  const fetchMyEvents = async () => {
    const userId = profile?.id || user?.id
    if (!userId) {
      console.log('No userId available for fetching events')
      return
    }

    console.log('Fetching events for userId:', userId)
    console.log('User role:', profile?.role)

    try {
      let eventIds = []
      
      // If user is admin, fetch ALL events that have event controllers assigned
      if (profile?.role === 'admin') {
        console.log('User is admin - fetching ALL events with controllers...')
        
        // Get all event controller assignments
        const { data: allAssignments, error: allError } = await supabase
          .from('role_assignments')
          .select('*')
          .eq('role_type', 'event_controller')
          .eq('is_active', true)
        
        if (allError) {
          console.error('Error fetching all assignments:', allError)
          setMyEvents([])
          setLoading(false)
          return
        }
        
        console.log('All event controller assignments:', allAssignments)
        
        // For admin, show ALL events (not just ones with controllers)
        console.log('Fetching all events from events table...')
        
        // First try a simple count to test access
        const { count: eventCount, error: countError } = await supabase
          .from('events')
          .select('*', { count: 'exact', head: true })
        
        console.log('Event count test:', { count: eventCount, error: countError })
        
        // Now fetch the actual events
        let allEvents = null
        let eventsError = null
        
        // Try with ordering first
        const orderedResult = await supabase
          .from('events')
          .select('*')
          .order('start_date', { ascending: false })
        
        if (orderedResult.error) {
          console.log('Ordered query failed, trying without order...')
          // If ordering fails, try without it
          const simpleResult = await supabase
            .from('events')
            .select('*')
          
          allEvents = simpleResult.data
          eventsError = simpleResult.error
        } else {
          allEvents = orderedResult.data
          eventsError = orderedResult.error
        }
        
        console.log('Events query result:', { 
          data: allEvents, 
          error: eventsError,
          errorMessage: eventsError?.message,
          errorCode: eventsError?.code,
          errorDetails: eventsError?.details
        })
        
        if (eventsError) {
          console.error('Error fetching all events - Full error:', eventsError)
          console.error('Error message:', eventsError.message)
          console.error('Error code:', eventsError.code)
          console.error('Error details:', eventsError.details)
          
          // Try one more time with minimal query
          console.log('Attempting minimal query...')
          const { data: minimalEvents, error: minimalError } = await supabase
            .from('events')
            .select('id, title, date')
            .limit(10)
          
          if (minimalError) {
            console.error('Even minimal query failed:', minimalError)
            setMyEvents([])
            setLoading(false)
            return
          } else {
            console.log('Minimal query succeeded with events:', minimalEvents)
            setMyEvents(minimalEvents || [])
            setLoading(false)
            return
          }
        }
        
        console.log('All events for admin:', allEvents)
        setMyEvents(allEvents || [])
        setLoading(false)
        return
        
      } else {
        // For non-admin users, only show events they're assigned to
        console.log('Non-admin user - fetching assigned events only...')
        
        const { data: assignments, error: assignmentError } = await supabase
          .from('role_assignments')
          .select('*')
          .eq('user_id', userId)
          .eq('role_type', 'event_controller')
          .eq('is_active', true)
        
        console.log('Query result:', { assignments, assignmentError })
        
        if (assignmentError) {
          console.error('Error fetching role assignments:', assignmentError)
          setMyEvents([])
          setLoading(false)
          return
        }
        
        if (assignments && assignments.length > 0) {
          console.log('Found event controller assignments:', assignments)
          eventIds = assignments.map(a => a.event_id).filter(id => id !== null)
          console.log('Extracted event IDs:', eventIds)
        } else {
          console.log('No assignments found for user')
        }
        
        if (eventIds.length === 0) {
          console.log('No event controller assignments found')
          setMyEvents([])
          setLoading(false)
          return
        }
        
        // Fetch the actual event details
        const { data: events, error: eventsError } = await supabase
          .from('events')
          .select('*')
          .in('id', eventIds)
        
        if (eventsError) throw eventsError

        setMyEvents(events || [])
      }
      
      // Skip detailed stats for performance - load on demand
      console.log('Skipping detailed stats for initial load performance')
      setEventStats([])
    } catch (error) {
      console.error('Error fetching my events:', error)
    } finally {
      setLoading(false)
    }
  }

  const getEventStats = (eventId: string): EventStats => {
    return eventStats.find(s => s.eventId === eventId) || {
      eventId,
      totalBookings: 0,
      totalRevenue: 0,
      availableTickets: 0,
      checkedInCount: 0
    }
  }

  const isUpcoming = (date: string) => {
    return new Date(date) >= new Date()
  }

  const isPast = (date: string) => {
    return new Date(date) < new Date()
  }

  // Show loading state while auth or data is loading
  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0b6d41] mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading your events...</p>
        </div>
      </div>
    )
  }

  // Check if user is actually an event controller
  if (myEvents.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <UserCheck className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-yellow-800 mb-2">No Event Assignments</h3>
          <p className="text-yellow-600">You are not assigned as an Event Controller for any events.</p>
          <p className="text-yellow-600 mt-2">Contact an administrator or page controller to get assigned to an event.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Event Controller Dashboard</h1>
        <p className="mt-2 text-gray-600">
          {profile?.role === 'admin' 
            ? 'Manage all events across the platform'
            : 'Manage your assigned events and track their performance'}
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center gap-3">
            <Calendar className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600">Total Events</p>
              <p className="text-2xl font-bold text-gray-900">{myEvents.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center gap-3">
            <Clock className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">Upcoming</p>
              <p className="text-2xl font-bold text-gray-900">{myEvents.filter(e => isUpcoming(e.date)).length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-purple-600" />
            <div>
              <p className="text-sm text-gray-600">Total Bookings</p>
              <p className="text-2xl font-bold text-gray-900">{eventStats.reduce((sum, s) => sum + s.totalBookings, 0)}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">₹{eventStats.reduce((sum, s) => sum + s.totalRevenue, 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* My Events */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {profile?.role === 'admin' ? 'All Events' : 'My Events'}
        </h2>
        
        {myEvents.map((event) => {
          const stats = getEventStats(event.id)
          const eventIsUpcoming = isUpcoming(event.date)
          const eventIsPast = isPast(event.date)

          return (
            <div key={event.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              {/* Event Header */}
              <div className={`px-6 py-4 ${eventIsUpcoming ? 'bg-green-50 border-b border-green-200' : eventIsPast ? 'bg-gray-50 border-b border-gray-200' : 'bg-blue-50 border-b border-blue-200'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-bold text-gray-900">{event.title}</h3>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        eventIsUpcoming ? 'bg-green-100 text-green-800' :
                        eventIsPast ? 'bg-gray-100 text-gray-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {eventIsUpcoming ? 'Upcoming' : eventIsPast ? 'Past' : 'Today'}
                      </span>
                    </div>
                    <p className="text-gray-600 mt-1">{event.description}</p>
                    <div className="flex items-center gap-6 mt-3 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>{new Date(event.date).toLocaleDateString()} at {event.time}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        <span>{event.venue}</span>
                      </div>
                      {event.event_page && (
                        <div className="flex items-center gap-1">
                          <span className="text-[#0b6d41] font-medium">Part of: {event.event_page.title}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/events/${event.id}`}
                      className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      View
                    </Link>
                    <Link
                      href={`/events/${event.id}/edit`}
                      className="bg-[#0b6d41] text-white px-4 py-2 rounded-lg hover:bg-[#0a5d37] transition-colors flex items-center gap-2"
                    >
                      <Edit className="h-4 w-4" />
                      Edit
                    </Link>
                  </div>
                </div>
              </div>

              {/* Event Stats */}
              <div className="px-6 py-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <Ticket className="h-5 w-5 text-blue-600" />
                      <div>
                        <p className="text-sm text-blue-600">Bookings</p>
                        <p className="font-bold text-blue-900">{stats.totalBookings} / {event.max_attendees}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="text-sm text-green-600">Revenue</p>
                        <p className="font-bold text-green-900">₹{stats.totalRevenue.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-purple-600" />
                      <div>
                        <p className="text-sm text-purple-600">Available</p>
                        <p className="font-bold text-purple-900">{stats.availableTickets}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-orange-600" />
                      <div>
                        <p className="text-sm text-orange-600">Checked In</p>
                        <p className="font-bold text-orange-900">{stats.checkedInCount}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Event Actions */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/verify?event_id=${event.id}`}
                    className="flex items-center gap-2 bg-[#0b6d41] text-white px-3 py-2 rounded-lg hover:bg-[#0a5d37] transition-colors text-sm"
                  >
                    <CheckCircle className="h-4 w-4" />
                    Verify Tickets
                  </Link>
                  <Link
                    href={`/events/${event.id}/analytics`}
                    className="flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    <BarChart3 className="h-4 w-4" />
                    Analytics
                  </Link>
                  <Link
                    href={`/events/${event.id}/attendees`}
                    className="flex items-center gap-2 bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm"
                  >
                    <Users className="h-4 w-4" />
                    Attendees
                  </Link>
                  <Link
                    href={`/admin/enhanced-ticket-generator?event_id=${event.id}`}
                    className="flex items-center gap-2 bg-gray-600 text-white px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors text-sm"
                  >
                    <Ticket className="h-4 w-4" />
                    Generate Tickets
                  </Link>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div className="mt-8 bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/verify"
            className="flex items-center gap-3 p-4 bg-[#0b6d41] text-white rounded-lg hover:bg-[#0a5d37] transition-colors"
          >
            <CheckCircle className="h-8 w-8" />
            <div>
              <p className="font-semibold">Verify Tickets</p>
              <p className="text-sm text-green-100">Check-in attendees</p>
            </div>
          </Link>
          <Link
            href="/analytics"
            className="flex items-center gap-3 p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <BarChart3 className="h-8 w-8" />
            <div>
              <p className="font-semibold">View Analytics</p>
              <p className="text-sm text-blue-100">Event performance</p>
            </div>
          </Link>
          <Link
            href="/admin/enhanced-ticket-generator"
            className="flex items-center gap-3 p-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Ticket className="h-8 w-8" />
            <div>
              <p className="font-semibold">Generate Tickets</p>
              <p className="text-sm text-purple-100">Create event tickets</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}