import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Calendar, MapPin, Clock, Users, IndianRupee, ChevronLeft, Share2, Heart } from 'lucide-react'
import { formatDate, formatTime, formatPrice } from '@/lib/utils'

interface PageProps {
  params: Promise<{
    slug: string
  }>
}

export default async function PublicEventPage({ params }: PageProps) {
  const { slug } = await params
  const supabase = await createClient()

  // Fetch the event page by slug
  const { data: eventPage, error: pageError } = await supabase
    .from('event_pages')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .single()

  if (pageError || !eventPage) {
    notFound()
  }

  // Fetch all events for this page
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('*')
    .eq('event_page_id', eventPage.id)
    .eq('status', 'published')
    .order('start_date', { ascending: true })

  const pageEvents = events || []

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Banner */}
      <div className="relative">
        {eventPage.banner_image ? (
          <img 
            src={eventPage.banner_image}
            alt={eventPage.title}
            className="w-full h-64 sm:h-80 md:h-96 object-cover"
          />
        ) : (
          <div className="w-full h-64 sm:h-80 md:h-96 bg-gradient-to-r from-[#0b6d41] to-[#15a862]" />
        )}
        
        {/* Overlay with Page Info */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent">
          <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8 max-w-7xl mx-auto">
            <Link 
              href="/events"
              className="inline-flex items-center gap-2 text-white/80 hover:text-white transition-colors mb-4"
            >
              <ChevronLeft className="h-4 w-4" />
              Back to Events
            </Link>
            
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4">
              {eventPage.title}
            </h1>
            
            <div className="flex flex-wrap items-center gap-4 text-white/90">
              {eventPage.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  <span>{eventPage.location}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                <span>
                  {formatDate(eventPage.start_date)}
                  {eventPage.end_date && ` - ${formatDate(eventPage.end_date)}`}
                </span>
              </div>
              <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
                {pageEvents.length} Event{pageEvents.length !== 1 ? 's' : ''}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Description */}
        {eventPage.description && (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-3">About this Event Collection</h2>
            <p className="text-gray-600 whitespace-pre-wrap">{eventPage.description}</p>
          </div>
        )}

        {/* Events Grid */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {pageEvents.length > 0 ? 'All Events' : 'No Events Scheduled Yet'}
          </h2>
          
          {pageEvents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pageEvents.map((event) => (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="group bg-white rounded-xl shadow-sm overflow-hidden hover:shadow-lg transition-all"
                >
                  {event.image_url && (
                    <div className="aspect-video relative overflow-hidden">
                      <img 
                        src={event.image_url}
                        alt={event.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                  
                  <div className="p-5">
                    <h3 className="font-semibold text-lg text-gray-900 group-hover:text-[#0b6d41] transition-colors mb-2">
                      {event.title}
                    </h3>
                    
                    {event.description && (
                      <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                        {event.description}
                      </p>
                    )}
                    
                    <div className="space-y-2 text-sm text-gray-500">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(event.start_date)}</span>
                        {event.time && formatTime(event.time) && (
                          <>
                            <Clock className="h-4 w-4 ml-2" />
                            <span>{formatTime(event.time)}</span>
                          </>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span className="truncate">{event.venue}</span>
                      </div>
                      
                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          <span>{event.max_attendees} seats</span>
                        </div>
                        
                        {event.price > 0 ? (
                          <span className="font-semibold text-[#0b6d41]">
                            {formatPrice(event.price)}
                          </span>
                        ) : (
                          <span className="font-semibold text-green-600">
                            Free
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-xl">
              <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-xl text-gray-600 mb-2">No events scheduled yet</p>
              <p className="text-gray-500">Check back later for updates</p>
            </div>
          )}
        </div>

        {/* Share Section */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Share this Event Collection</h3>
          <div className="flex gap-3">
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href)
                alert('Link copied to clipboard!')
              }}
              className="flex items-center gap-2 px-4 py-2 bg-[#0b6d41] text-white rounded-lg hover:bg-[#0a5d37] transition-colors"
            >
              <Share2 className="h-5 w-5" />
              Copy Link
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Generate metadata for SEO
export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params
  const supabase = await createClient()
  
  const { data: eventPage } = await supabase
    .from('event_pages')
    .select('title, description')
    .eq('slug', slug)
    .single()

  if (!eventPage) {
    return {
      title: 'Event Page Not Found',
    }
  }

  return {
    title: `${eventPage.title} | Evently`,
    description: eventPage.description || `View all events in ${eventPage.title}`,
  }
}