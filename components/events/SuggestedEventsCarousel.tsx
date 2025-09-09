'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react'
import EventCardWithBanner from './EventCardWithBanner'

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

interface SuggestedEventsCarouselProps {
  events: Event[]
  currentEventCategory?: string
  title?: string
  subtitle?: string
}

export default function SuggestedEventsCarousel({ 
  events, 
  currentEventCategory,
  title = "You May Also Like",
  subtitle = "Discover more amazing events based on your interests"
}: SuggestedEventsCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  // Filter and sort suggestions
  const suggestedEvents = events
    .filter(event => {
      // Prioritize same category events if currentEventCategory is provided
      if (currentEventCategory) {
        return event.category === currentEventCategory
      }
      return true
    })
    .sort((a, b) => {
      // Sort by date (upcoming first)
      return new Date(a.date).getTime() - new Date(b.date).getTime()
    })
    .slice(0, 10) // Limit to 10 suggestions

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
      setShowLeftArrow(scrollLeft > 10)
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10)
    }
  }

  useEffect(() => {
    checkScroll()
    window.addEventListener('resize', checkScroll)
    return () => window.removeEventListener('resize', checkScroll)
  }, [suggestedEvents])

  const scrollToIndex = (index: number) => {
    if (scrollRef.current) {
      const cardWidth = 350 // Approximate card width
      scrollRef.current.scrollTo({
        left: index * cardWidth,
        behavior: 'smooth'
      })
      setCurrentIndex(index)
      setTimeout(checkScroll, 300)
    }
  }

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const cardWidth = 350
      const currentScroll = scrollRef.current.scrollLeft
      const newIndex = direction === 'left' 
        ? Math.max(0, Math.floor(currentScroll / cardWidth) - 1)
        : Math.min(suggestedEvents.length - 1, Math.floor(currentScroll / cardWidth) + 1)
      
      scrollToIndex(newIndex)
    }
  }

  if (suggestedEvents.length === 0) {
    return null
  }

  return (
    <section className="py-12 bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#0b6d41]/10 to-[#15a862]/10 rounded-full mb-4">
            <Calendar className="h-5 w-5 text-[#0b6d41]" />
            <span className="text-sm font-semibold text-[#0b6d41]">Upcoming Events</span>
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-3">{title}</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">{subtitle}</p>
        </div>

        {/* Carousel Container */}
        <div className="relative">
          {/* Left Arrow */}
          {showLeftArrow && (
            <button
              onClick={() => scroll('left')}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-3 bg-white rounded-full shadow-xl hover:shadow-2xl transition-all hover:scale-110"
              aria-label="Previous events"
            >
              <ChevronLeft className="h-6 w-6 text-gray-700" />
            </button>
          )}

          {/* Right Arrow */}
          {showRightArrow && (
            <button
              onClick={() => scroll('right')}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-3 bg-white rounded-full shadow-xl hover:shadow-2xl transition-all hover:scale-110"
              aria-label="Next events"
            >
              <ChevronRight className="h-6 w-6 text-gray-700" />
            </button>
          )}

          {/* Events Carousel */}
          <div 
            ref={scrollRef}
            onScroll={checkScroll}
            className="flex gap-6 overflow-x-auto pb-4 px-12 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
          >
            {suggestedEvents.map((event, index) => (
              <div 
                key={event.id} 
                className="flex-shrink-0 w-[320px] lg:w-[350px]"
                style={{
                  opacity: 1,
                  transform: 'scale(1)',
                  transition: 'all 0.3s ease'
                }}
              >
                {/* Trending Badge */}
                {event.is_trending && index < 3 && (
                  <div className="mb-3 text-center">
                    <span className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold rounded-full">
                      <TrendingUp className="h-3 w-3" />
                      TOP PICK FOR YOU
                    </span>
                  </div>
                )}
                <EventCardWithBanner event={event} />
              </div>
            ))}
          </div>

          {/* Pagination Dots */}
          <div className="flex justify-center gap-2 mt-6">
            {Array.from({ length: Math.min(suggestedEvents.length, 5) }).map((_, index) => (
              <button
                key={index}
                onClick={() => scrollToIndex(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentIndex 
                    ? 'w-8 bg-[#0b6d41]' 
                    : 'bg-gray-300 hover:bg-gray-400'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-10 text-center">
          <p className="text-gray-600 mb-4">
            Want to see more personalized recommendations?
          </p>
          <button className="px-6 py-3 bg-gradient-to-r from-[#0b6d41] to-[#15a862] text-white rounded-xl font-semibold hover:shadow-lg transition-all">
            Explore All Events
          </button>
        </div>
      </div>
    </section>
  )
}

