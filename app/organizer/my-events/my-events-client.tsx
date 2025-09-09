'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, Calendar, IndianRupee, Eye, Edit, MoreHorizontal, Trash2 } from 'lucide-react'
import { formatDate, formatPrice } from '@/lib/utils'
import { BulkEventUpload } from '@/components/organizer/bulk-event-upload'

interface Event {
  id: string
  title: string
  description: string
  date: string
  time: string
  venue: string
  location: string
  price: number
  max_attendees: number
  current_attendees: number
  image_url: string | null
  category: string
  status: 'draft' | 'published' | 'cancelled'
  created_at: string
  bookings: any[]
  stats: {
    totalBookings: number
    totalRevenue: number
    totalAttendees: number
    pendingPayments: number
  }
}

interface MyEventsClientProps {
  events?: Event[]
}

export default function MyEventsClient({ events }: MyEventsClientProps) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('date')
  const [isDeletingEvent, setIsDeletingEvent] = useState<string | null>(null)

  const handleBulkUploadSuccess = () => {
    // Refresh the page to show new events
    router.refresh()
  }

  const handleDeleteEvent = async (eventId: string, eventTitle: string) => {
    const confirmed = confirm(
      `Are you sure you want to delete "${eventTitle}"?\n\n` +
      'This will:\n' +
      '• Delete the event permanently\n' +
      '• Cancel all bookings\n' +
      '• Refund ticket purchases (if applicable)\n\n' +
      'This action cannot be undone.'
    )

    if (!confirmed) return

    try {
      setIsDeletingEvent(eventId)
      
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (response.ok) {
        // Refresh the page to show updated list
        router.refresh()
        // Optionally show success message
        console.log(`Successfully deleted event: ${eventTitle}`)
      } else {
        // Show specific error message based on status code
        if (response.status === 409) {
          alert(
            'Cannot delete this event because it has related data (tickets, bookings, etc.).\n\n' +
            'This typically happens when:\n' +
            '• There are existing tickets or bookings\n' +
            '• The event has child/recurring events\n\n' +
            'Please contact support if you need assistance with deleting this event.'
          )
        } else {
          alert(data.error || 'Failed to delete event. Please try again.')
        }
      }
    } catch (error) {
      console.error('Error deleting event:', error)
      alert('An error occurred while deleting the event. Please try again.')
    } finally {
      setIsDeletingEvent(null)
    }
  }

  // Ensure events is always an array
  const safeEvents = events || []

  // Filter and sort events
  const filteredEvents = safeEvents
    .filter(event => {
      const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           event.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           event.location.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === 'all' || event.status === statusFilter
      return matchesSearch && matchesStatus
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.date).getTime() - new Date(a.date).getTime()
        case 'revenue':
          return b.stats.totalRevenue - a.stats.totalRevenue
        case 'attendees':
          return b.stats.totalAttendees - a.stats.totalAttendees
        case 'bookings':
          return b.stats.totalBookings - a.stats.totalBookings
        default:
          return 0
      }
    })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-green-100 text-green-800'
      case 'draft':
        return 'bg-yellow-100 text-yellow-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search events by name, description, or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0b6d41] focus:border-transparent"
              />
            </div>
          </div>
          
          <div className="flex gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0b6d41] focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="cancelled">Cancelled</option>
            </select>
            
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0b6d41] focus:border-transparent"
            >
              <option value="date">Sort by Date</option>
              <option value="revenue">Sort by Revenue</option>
              <option value="attendees">Sort by Attendees</option>
              <option value="bookings">Sort by Bookings</option>
            </select>
            
            <BulkEventUpload onUploadSuccess={handleBulkUploadSuccess} />
          </div>
        </div>
      </div>

      {/* Events List */}
      <div className="space-y-4">
        {filteredEvents.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No events found</h3>
            <p className="text-gray-600 mb-6">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search or filters'
                : 'Create your first event to get started'
              }
            </p>
            <Link
              href="/events/create"
              className="inline-flex items-center px-4 py-2 bg-[#0b6d41] text-white rounded-lg hover:bg-[#0a5d37] transition-colors"
            >
              Create Event
            </Link>
          </div>
        ) : (
          filteredEvents.map((event) => (
            <div key={event.id} className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{event.title}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(event.status)}`}>
                      {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                    </span>
                  </div>
                  
                  <p className="text-gray-600 mb-3 line-clamp-2">{event.description}</p>
                  
                  <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-4">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(event.date)} at {event.time}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span>📍</span>
                      <span>{event.location}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <IndianRupee className="w-4 h-4" />
                      <span>{formatPrice(event.price)}</span>
                    </div>
                  </div>

                  {/* Event Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className="text-center">
                      <p className="text-lg font-semibold text-gray-900">{event.stats.totalBookings}</p>
                      <p className="text-xs text-gray-600">Total Bookings</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold text-green-600">{formatPrice(event.stats.totalRevenue)}</p>
                      <p className="text-xs text-gray-600">Revenue</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold text-blue-600">{event.stats.totalAttendees}</p>
                      <p className="text-xs text-gray-600">Attendees</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold text-yellow-600">{event.stats.pendingPayments}</p>
                      <p className="text-xs text-gray-600">Pending</p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 ml-4">
                  <Link
                    href={`/events/${event.id}`}
                    className="p-2 text-gray-600 hover:text-[#0b6d41] hover:bg-gray-100 rounded-lg transition-colors"
                    title="View Event"
                  >
                    <Eye className="w-4 h-4" />
                  </Link>
                  <Link
                    href={`/events/${event.id}/edit`}
                    className="p-2 text-gray-600 hover:text-[#0b6d41] hover:bg-gray-100 rounded-lg transition-colors"
                    title="Edit Event"
                  >
                    <Edit className="w-4 h-4" />
                  </Link>
                  <Link
                    href={`/events/${event.id}/dashboard`}
                    className="p-2 text-gray-600 hover:text-[#0b6d41] hover:bg-gray-100 rounded-lg transition-colors"
                    title="Event Dashboard"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </Link>
                  <button
                    onClick={() => handleDeleteEvent(event.id, event.title)}
                    disabled={isDeletingEvent === event.id}
                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Delete Event"
                  >
                    {isDeletingEvent === event.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Payment Filter Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Analytics</h3>
        <div className="text-sm text-gray-600">
          <p>💡 <strong>Tip:</strong> Click on any event above to view detailed payment information and booking history.</p>
          <p className="mt-2">Use the &quot;Payments&quot; section in the sidebar to view all payment transactions across your events.</p>
        </div>
      </div>
    </div>
  )
}
