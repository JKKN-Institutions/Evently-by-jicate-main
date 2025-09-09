'use client'

import Link from 'next/link'
import { Calendar, MapPin, IndianRupee, Users } from 'lucide-react'
import { formatDate, formatTime, formatPrice } from '@/lib/utils'

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
  category: string
  image_url?: string
  organizer_id: string
  profiles?: {
    full_name: string
    email: string
  }
}

interface SuggestedEventsProps {
  events: Event[]
  currentEventTitle: string
}

export default function SuggestedEvents({ events, currentEventTitle }: SuggestedEventsProps) {
  if (!events || events.length === 0) {
    return null
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 border border-gray-100">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Similar Events You Might Like</h2>
        <p className="text-gray-600">More events in the same category as &quot;{currentEventTitle}&quot;</p>
      </div>
      
      <div className="space-y-4">
        {events.map((event) => (
          <Link
            key={event.id}
            href={`/events/${event.id}`}
            className="group block"
          >
            <div className="bg-gray-50 hover:bg-gray-100 rounded-xl p-4 transition-all duration-300 hover:shadow-md border border-transparent hover:border-gray-200">
              <div className="flex gap-4">
                {/* Event Image */}
                <div className="flex-shrink-0 w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden bg-gray-100">
                  <img
                    src={event.image_url || `/api/events/${event.id}/image`}
                    alt={event.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      if (target.src !== '/placeholder-event.svg') {
                        target.onerror = null
                        target.src = '/placeholder-event.svg'
                      } else {
                        target.style.display = 'none'
                        const fallback = target.nextElementSibling as HTMLElement
                        if (fallback) fallback.style.display = 'flex'
                      }
                    }}
                  />
                  <div className="w-full h-full bg-gradient-to-br from-[#0b6d41] to-[#15a862] items-center justify-center hidden">
                    <Calendar className="h-8 w-8 text-white" />
                  </div>
                </div>
                
                {/* Event Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 group-hover:text-[#0b6d41] transition-colors line-clamp-1">
                      {event.title}
                    </h3>
                    <div className="ml-2 flex-shrink-0">
                      {event.price === 0 ? (
                        <span className="text-sm font-bold text-green-600">FREE</span>
                      ) : (
                        <span className="text-sm font-bold text-[#0b6d41]">₹{formatPrice(event.price)}</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{formatDate(event.date)}{event.time && formatTime(event.time) ? ` at ${formatTime(event.time)}` : ''}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">{event.venue}, {event.location}</span>
                    </div>
                  </div>
                  
                  {/* Category */}
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Users className="h-4 w-4" />
                      <span>{event.max_attendees} spots</span>
                    </div>
                    <span className="inline-flex items-center text-xs font-medium text-[#0b6d41] bg-[#0b6d41]/10 px-2 py-1 rounded-full capitalize">
                      {event.category}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
      
      {/* View All Events Link */}
      <div className="mt-6 pt-6 border-t border-gray-200 text-center">
        <Link
          href="/events"
          className="inline-flex items-center px-6 py-3 bg-[#0b6d41] text-white font-semibold rounded-lg hover:bg-[#0a5d37] transition-colors"
        >
          Explore All Events
        </Link>
      </div>
    </div>
  )
}