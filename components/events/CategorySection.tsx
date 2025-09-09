'use client'

import { ArrowRight, Calendar, LucideIcon } from 'lucide-react'
import EventCardWithBanner from './EventCardWithBanner'
import Link from 'next/link'

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
  attendees_count?: number
}

interface CategorySectionProps {
  category: {
    value: string
    label: string
    icon: LucideIcon | string
    description?: string
  }
  events: Event[]
  showViewAll?: boolean
  maxEvents?: number
}

export default function CategorySection({ 
  category, 
  events, 
  showViewAll = true,
  maxEvents = 3 
}: CategorySectionProps) {
  const displayEvents = maxEvents ? events.slice(0, maxEvents) : events
  const hasMoreEvents = events.length > displayEvents.length

  const getCategoryGradient = (categoryValue: string) => {
    const gradients: { [key: string]: string } = {
      technology: 'from-blue-50 to-indigo-50',
      music: 'from-purple-50 to-pink-50',
      business: 'from-gray-50 to-slate-50',
      art: 'from-rose-50 to-orange-50',
      sports: 'from-green-50 to-emerald-50',
      food: 'from-yellow-50 to-amber-50',
      education: 'from-cyan-50 to-blue-50',
      community: 'from-teal-50 to-green-50',
      health: 'from-red-50 to-pink-50',
      travel: 'from-sky-50 to-blue-50',
      entertainment: 'from-violet-50 to-purple-50',
      default: 'from-gray-50 to-gray-100'
    }
    return gradients[categoryValue.toLowerCase()] || gradients.default
  }

  if (events.length === 0) {
    return null
  }

  return (
    <section className="mb-12">
      {/* Category Header */}
      <div className={`bg-gradient-to-r ${getCategoryGradient(category.value)} rounded-2xl p-6 mb-6`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              {typeof category.icon === 'string' ? (
                <span className="text-3xl">{category.icon}</span>
              ) : (
                <category.icon className="h-8 w-8 text-gray-700" />
              )}
              <h2 className="text-2xl font-bold text-gray-900">{category.label}</h2>
              <span className="px-3 py-1 bg-white/80 backdrop-blur-sm text-gray-700 rounded-full text-sm font-semibold">
                {events.length} {events.length === 1 ? 'event' : 'events'}
              </span>
            </div>
            {category.description && (
              <p className="text-gray-600">{category.description}</p>
            )}
          </div>
          
          {showViewAll && hasMoreEvents && (
            <Link
              href={`/events?category=${category.value}`}
              className="flex items-center gap-2 px-5 py-2.5 bg-white text-[#0b6d41] rounded-xl font-semibold hover:shadow-lg transition-all group"
            >
              View All
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          )}
        </div>
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayEvents.map((event) => (
          <EventCardWithBanner key={event.id} event={event} />
        ))}
      </div>

      {/* View More Link for Mobile */}
      {showViewAll && hasMoreEvents && (
        <div className="mt-6 text-center lg:hidden">
          <Link
            href={`/events?category=${category.value}`}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-[#0b6d41] to-[#15a862] text-white rounded-xl font-semibold hover:shadow-lg transition-all"
          >
            View All {category.label} Events
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      )}

      {/* Empty State */}
      {events.length === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="h-10 w-10 text-gray-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            No {category.label} Events
          </h3>
          <p className="text-gray-600">
            Check back later for new {category.label.toLowerCase()} events!
          </p>
        </div>
      )}
    </section>
  )
}