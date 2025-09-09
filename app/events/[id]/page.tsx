'use client'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { ArrowLeft, Calendar, MapPin, Users, IndianRupee, Share2, Heart, Clock, Ticket, Globe, Edit, Trash2, Settings, Upload } from 'lucide-react'
import { formatDate, formatTime, formatPrice } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import EventImage from '@/components/events/event-image'
import BookingSection from './booking-section'
import SuggestedEvents from './suggested-events'
import EventCategories from './event-categories'
import DeleteEventButton from './delete-event-button'
import BulkUploadModal from '@/components/events/bulk-upload-modal'

export default function EventDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string }>
}) {
  const [event, setEvent] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [suggestedEvents, setSuggestedEvents] = useState<any[]>([])
  const [showBulkUpload, setShowBulkUpload] = useState(false)

  useEffect(() => {
    async function loadData() {
      const resolvedParams = await params
      const supabase = createClient()
      
      // Get event
      const { data: eventData, error } = await supabase
        .from('events')
        .select(`
          *,
          profiles!organizer_id (
            id,
            email,
            full_name
          )
        `)
        .eq('id', resolvedParams.id)
        .single()

      if (error || !eventData) {
        notFound()
      }

      setEvent(eventData)

      // Get current user
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      setUser(currentUser)

      // Get suggested events
      const { data: suggestedData } = await supabase
        .from('events')
        .select(`
          *,
          profiles!organizer_id (
            id,
            email,
            full_name
          )
        `)
        .eq('status', 'published')
        .eq('category', eventData.category)
        .neq('id', eventData.id)
        .order('created_at', { ascending: false })
        .limit(3)

      setSuggestedEvents(suggestedData || [])
      setLoading(false)
    }

    loadData()
  }, [params])

  const handleBulkUploadSuccess = () => {
    // Refresh the page or update event data
    window.location.reload()
  }

  if (loading || !event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-green-600 border-t-transparent"></div>
      </div>
    )
  }

  const isOwner = user?.id === event.organizer_id
  const isAdmin = user?.user_metadata?.role === 'admin'
  const availableSeats = event.max_attendees - event.current_attendees
  const isFullyBooked = availableSeats === 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Modern Header */}
      <header className="bg-white/95 backdrop-blur-md shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-[#0b6d41] to-[#15a862] bg-clip-text text-transparent">
              Evently
            </Link>
            <div className="flex items-center gap-2">
              {(isOwner || isAdmin) && (
                <>
                  <button
                    onClick={() => setShowBulkUpload(true)}
                    className="inline-flex items-center px-3 py-2 text-sm font-medium text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg transition-colors"
                    title="Bulk Upload Events"
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Bulk Upload</span>
                  </button>
                  <Link
                    href={`/events/${event.id}/edit`}
                    className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit Event"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Edit</span>
                  </Link>
                  <Link
                    href={`/events/${event.id}/dashboard`}
                    className="inline-flex items-center px-3 py-2 text-sm font-medium text-green-600 hover:text-green-800 hover:bg-green-50 rounded-lg transition-colors"
                    title="Event Dashboard"
                  >
                    <Settings className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Dashboard</span>
                  </Link>
                </>
              )}
              <Link
                href="/events"
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Events
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Event Categories Section */}
      <EventCategories currentCategory={event.category} />

      <div className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
        <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Hero Banner */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
              <div className="relative h-72 sm:h-96 lg:h-[28rem]">
                <EventImage 
                  imageUrl={event.image_url}
                  eventId={event.id}
                  title={event.title}
                />
                
                {/* Overlay with key info */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-6 left-6 right-6">
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <span className="inline-flex items-center bg-white/95 backdrop-blur-sm text-gray-900 px-3 py-1.5 rounded-full text-sm font-semibold capitalize">
                      {event.category}
                    </span>
                    {event.price === 0 && (
                      <span className="bg-green-500 text-white px-3 py-1.5 rounded-full text-sm font-bold">
                        FREE EVENT
                      </span>
                    )}
                  </div>
                </div>

                {/* Share Actions */}
                <div className="absolute top-6 right-6 flex gap-2">
                  <button 
                    className="p-3 bg-white/95 backdrop-blur-sm rounded-full hover:bg-white transition-colors shadow-sm"
                    aria-label="Share event"
                  >
                    <Share2 className="h-5 w-5 text-gray-700" />
                  </button>
                  <button 
                    className="p-3 bg-white/95 backdrop-blur-sm rounded-full hover:bg-white transition-colors shadow-sm"
                    aria-label="Add to favorites"
                  >
                    <Heart className="h-5 w-5 text-gray-700" />
                  </button>
                </div>
              </div>
            </div>

            {/* Event Title & Key Details */}
            <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 border border-gray-100">
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">{event.title}</h1>
              
              <div className="grid sm:grid-cols-3 gap-6 mb-8">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-50 p-2.5 rounded-xl">
                    <Calendar className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Date & Time</p>
                    <p className="font-semibold text-gray-900">{formatDate(event.date)}</p>
                    {event.time && formatTime(event.time) && (
                      <p className="text-sm text-gray-600 flex items-center mt-1">
                        <Clock className="h-4 w-4 mr-1" />
                        {formatTime(event.time)}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="bg-green-50 p-2.5 rounded-xl">
                    <MapPin className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Location</p>
                    <p className="font-semibold text-gray-900">{event.venue}</p>
                    <p className="text-sm text-gray-600">{event.location}</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="bg-purple-50 p-2.5 rounded-xl">
                    <Users className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 mb-1">Capacity</p>
                    <p className="font-semibold text-gray-900">{event.current_attendees}/{event.max_attendees}</p>
                    <p className="text-sm text-gray-600">{availableSeats} seats left</p>
                  </div>
                </div>
              </div>

              {/* Pricing */}
              <div className="bg-gradient-to-r from-[#0b6d41]/5 to-[#15a862]/5 rounded-xl p-6 border border-[#0b6d41]/10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Ticket Price</p>
                    {event.price === 0 ? (
                      <p className="text-3xl font-bold text-green-600">FREE</p>
                    ) : (
                      <p className="text-3xl font-bold text-[#0b6d41]">₹{formatPrice(event.price)}</p>
                    )}
                    <p className="text-sm text-gray-500">per person</p>
                  </div>
                  <div className="bg-[#0b6d41] p-3 rounded-full">
                    <Ticket className="h-6 w-6 text-white" />
                  </div>
                </div>
              </div>
            </div>

            {/* About Section */}
            <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 border border-gray-100">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <Globe className="h-6 w-6 mr-3 text-[#0b6d41]" />
                About this event
              </h2>
              <div className="prose max-w-none text-gray-700 leading-relaxed">
                <div className="whitespace-pre-line">
                  {event.description}
                </div>
              </div>
              
              {/* Organizer Info */}
              <div className="mt-8 pt-8 border-t border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Event Organizer</h3>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-[#0b6d41] to-[#15a862] rounded-full flex items-center justify-center">
                    <span className="text-white text-lg font-bold">
                      {event.profiles?.full_name?.charAt(0) || 'O'}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{event.profiles?.full_name || 'Event Organizer'}</p>
                    <p className="text-gray-600">{event.profiles?.email}</p>
                    <button className="mt-2 text-[#0b6d41] hover:text-[#0a5d37] font-medium text-sm transition-colors">
                      View Profile →
                    </button>
                  </div>
                </div>
              </div>

              {/* Owner Actions */}
              {(isOwner || isAdmin) && (
                <div className="mt-8 pt-8 border-t border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Event Management</h3>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => setShowBulkUpload(true)}
                      className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Bulk Upload Events
                    </button>
                    <Link
                      href={`/events/${event.id}/edit`}
                      className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Event
                    </Link>
                    <Link
                      href={`/events/${event.id}/dashboard`}
                      className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Event Dashboard
                    </Link>
                    <DeleteEventButton 
                      eventId={event.id} 
                      eventTitle={event.title}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Suggested Events */}
            <SuggestedEvents events={suggestedEvents} currentEventTitle={event.title} />
          </div>

          {/* Booking Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <BookingSection 
                event={event}
                availableSeats={availableSeats}
                isFullyBooked={isFullyBooked}
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Bulk Upload Modal */}
      <BulkUploadModal
        isOpen={showBulkUpload}
        onClose={() => setShowBulkUpload(false)}
        parentEventId={event.id}
        organizerId={event.organizer_id}
        onSuccess={handleBulkUploadSuccess}
      />
    </div>
  )
}