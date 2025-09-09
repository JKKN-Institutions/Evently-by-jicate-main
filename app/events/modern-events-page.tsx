'use client'

import Link from 'next/link'
import { Calendar, MapPin, Users, Search, AlertCircle, X, Clock, Laptop, Music, Briefcase, Palette, Trophy, Utensils, GraduationCap, HeartHandshake, Film, Heart, Plane, Grid3X3, Plus } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

import { formatDate, formatTime, formatPrice } from '@/lib/utils'
import EventCardWithBanner from '@/components/events/EventCardWithBanner'
import { fetchEventsDirectly, filterEventsByCategory, searchEvents } from '@/lib/events-helper'
import CategoryNavigation from '@/components/events/CategoryNavigation'
import CategorySection from '@/components/events/CategorySection'
import SuggestedEventsCarousel from '@/components/events/SuggestedEventsCarousel'
import QuickEventCreateModal from '@/components/events/quick-event-create-modal'

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

export default function ModernEventsPage() {
  const searchParams = useSearchParams()

  const [showMessage, setShowMessage] = useState(false)
  const [message, setMessage] = useState('')
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [user, setUser] = useState<any>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
      } catch (error) {
        console.error('Error checking user:', error)
        setUser(null)
      }
    }

    checkUser()

    // Check for messages from URL params
    const messageParam = searchParams.get('message')
    if (messageParam) {
      setMessage(decodeURIComponent(messageParam))
      setShowMessage(true)
    }
  }, [searchParams, supabase])

  const fetchEvents = async () => {
    try {
      setLoading(true)
      
      // Add timeout to prevent hanging requests
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout (increased)
      
      try {
        const response = await fetch('/api/events?category=all&limit=20', { // Reduced limit for faster loading
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json'
          }
        })
        
        clearTimeout(timeoutId)
        
        if (response.ok) {
          const data = await response.json()
          setEvents(data.events || [])
        } else {
          // Try to get error details from response
          try {
            const errorData = await response.json()
            console.error('Failed to fetch events:', errorData)
            // Use events from error response if available
            setEvents(errorData.events || [])
          } catch {
            console.error('Failed to fetch events - status:', response.status)
            setEvents([])
          }
        }
      } catch (fetchError: any) {
        if (fetchError.name === 'AbortError') {
          console.error('Request timed out - fetching events took too long')
          console.log('Attempting direct Supabase query...')
          // Try direct Supabase query as fallback
          const directEvents = await fetchEventsDirectly()
          setEvents(directEvents)
        } else {
          console.error('Network error fetching events:', fetchError)
          // Try direct query as fallback
          const directEvents = await fetchEventsDirectly()
          setEvents(directEvents)
        }
      }
    } catch (error) {
      console.error('Error fetching events:', error)
      setEvents([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [])

  const categories = [
    { value: 'all', label: 'All Events', icon: Grid3X3, description: 'Browse all available events' },
    { value: 'technology', label: 'Technology', icon: Laptop, description: 'Tech talks, hackathons, and workshops' },
    { value: 'music', label: 'Music', icon: Music, description: 'Concerts, festivals, and live performances' },
    { value: 'business', label: 'Business', icon: Briefcase, description: 'Networking, conferences, and seminars' },
    { value: 'art', label: 'Art & Culture', icon: Palette, description: 'Exhibitions, galleries, and creative workshops' },
    { value: 'sports', label: 'Sports & Fitness', icon: Trophy, description: 'Games, tournaments, and fitness events' },
    { value: 'food', label: 'Food & Drink', icon: Utensils, description: 'Food festivals, tastings, and culinary events' },
    { value: 'education', label: 'Education', icon: GraduationCap, description: 'Courses, workshops, and learning sessions' },
    { value: 'community', label: 'Community', icon: HeartHandshake, description: 'Local meetups and social gatherings' },
    { value: 'entertainment', label: 'Entertainment', icon: Film, description: 'Shows, movies, and fun activities' },
    { value: 'health', label: 'Health & Wellness', icon: Heart, description: 'Wellness workshops and health seminars' },
    { value: 'travel', label: 'Travel & Adventure', icon: Plane, description: 'Travel meetups and adventure activities' }
  ]

  // Add attendee count to events
  const enhancedEvents = useMemo(() => {
    return events.map(event => ({
      ...event,
      attendees_count: Math.floor(Math.random() * event.max_attendees)
    }))
  }, [events])

  const filteredEvents = enhancedEvents.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.venue.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.location.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesCategory = selectedCategory === 'all' || 
                           event.category.toLowerCase() === selectedCategory.toLowerCase()
    
    return matchesSearch && matchesCategory
  })

  // Group events by category
  const eventsByCategory = useMemo(() => {
    const grouped: { [key: string]: Event[] } = {}
    
    categories.forEach(cat => {
      if (cat.value !== 'all') {
        grouped[cat.value] = enhancedEvents.filter(event => 
          event.category.toLowerCase() === cat.value.toLowerCase()
        )
      }
    })
    
    return grouped
  }, [enhancedEvents])

  // Get event counts by category
  const eventCounts = useMemo(() => {
    const counts: { [key: string]: number } = { total: enhancedEvents.length }
    categories.forEach(cat => {
      if (cat.value === 'all') {
        counts[cat.value] = enhancedEvents.length
      } else {
        counts[cat.value] = eventsByCategory[cat.value]?.length || 0
      }
    })
    return counts
  }, [eventsByCategory, enhancedEvents])

  // Get suggested events (for carousel)
  const suggestedEvents = useMemo(() => {
    return enhancedEvents.slice(0, 10)
  }, [enhancedEvents])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 relative">
      {/* Hero Section - Compact */}
      <div className="bg-gradient-to-r from-[#0b6d41] via-[#15a862] to-[#0b6d41] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-start mb-6">
            <div className="flex-1 text-center">
              <h1 className="text-3xl sm:text-4xl font-bold mb-3">Discover Amazing Events</h1>
              <p className="text-lg text-white/90 max-w-2xl mx-auto">
                Find and book the best events happening near you. From concerts to workshops, we've got you covered.
              </p>
            </div>
            {user && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-white text-[#0b6d41] px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors font-semibold flex items-center gap-2 ml-4"
              >
                <Plus className="h-5 w-5" />
                <span className="hidden sm:inline">Create Event</span>
              </button>
            )}
          </div>
            
            {/* Quick Stats - Compact */}
            <div className="grid grid-cols-3 gap-3 max-w-2xl mx-auto">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
                <div className="text-2xl font-bold">{eventCounts.total}</div>
                <div className="text-xs text-white/80">Total Events</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
                <div className="text-2xl font-bold">{categories.length - 1}</div>
                <div className="text-xs text-white/80">Categories</div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
                <div className="text-2xl font-bold">{enhancedEvents.filter(e => new Date(e.date) >= new Date()).length}</div>
                <div className="text-xs text-white/80">Upcoming</div>
              </div>
            </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 lg:py-8">
        {/* Message Alert */}
        {showMessage && (
          <div className="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6 flex items-start justify-between shadow-sm">
            <div className="flex items-start gap-4">
              <div className="bg-blue-100 rounded-full p-2">
                <AlertCircle className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">Information</h3>
                <p className="text-blue-800">{message}</p>
              </div>
            </div>
            <button
              onClick={() => setShowMessage(false)}
              className="text-blue-600 hover:text-blue-800 p-1 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Search Bar - Compact */}
        <div className="-mt-4 mb-6">
          <div className="bg-white rounded-xl shadow-md border border-gray-100 p-4">
            <div className="flex flex-col lg:flex-row gap-3">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <input
                    type="text"
                    placeholder="Search events by name, venue, or location..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 text-base border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0b6d41] focus:border-transparent bg-gray-50 transition-all"
                  />
                </div>
              </div>
              <button className="px-6 py-3 bg-gradient-to-r from-[#0b6d41] to-[#15a862] text-white rounded-lg font-semibold hover:shadow-md transition-all">
                Search Events
              </button>
            </div>
            
            {searchTerm && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    Found <span className="font-bold text-[#0b6d41]">{filteredEvents.length}</span> results for "{searchTerm}"
                  </span>
                  <button
                    onClick={() => setSearchTerm('')}
                    className="text-sm text-[#0b6d41] hover:text-[#0a5d37] font-medium"
                  >
                    Clear search
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Category Navigation */}
        <CategoryNavigation
          categories={categories}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          eventCounts={eventCounts}
        />

        {/* Main Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm overflow-hidden animate-pulse border border-gray-100">
                <div className="h-56 bg-gray-200"></div>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="h-6 bg-gray-200 rounded-full w-20"></div>
                    <div className="h-6 bg-gray-200 rounded w-16"></div>
                  </div>
                  <div className="h-6 bg-gray-200 rounded mb-3"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3 mb-4"></div>
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-20">
            <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 max-w-lg mx-auto">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Calendar className="h-10 w-10 text-gray-400" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-4">No events found</h3>
              <p className="text-gray-600 mb-6">
                {searchTerm || selectedCategory !== 'all' 
                  ? 'Try adjusting your search criteria or browse all categories.'
                  : 'Check back later for new events or create your own!'}
              </p>
              <div className="flex gap-4 justify-center">
                {(searchTerm || selectedCategory !== 'all') && (
                  <button
                    onClick={() => {
                      setSearchTerm('')
                      setSelectedCategory('all')
                    }}
                    className="bg-gray-200 text-gray-800 px-6 py-3 rounded-xl hover:bg-gray-300 transition-colors font-medium"
                  >
                    Show all events
                  </button>
                )}
                {!searchTerm && selectedCategory === 'all' && user && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="bg-[#0b6d41] text-white px-6 py-3 rounded-xl hover:bg-[#0a5d37] transition-colors font-medium inline-block"
                  >
                    Create your first event
                  </button>
                )}
                {!searchTerm && selectedCategory === 'all' && !user && (
                  <Link
                    href="/login"
                    className="bg-[#0b6d41] text-white px-6 py-3 rounded-xl hover:bg-[#0a5d37] transition-colors font-medium inline-block"
                  >
                    Sign in to create event
                  </Link>
                )}
              </div>
            </div>
          </div>
        ) : searchTerm ? (
          // Show search results
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Search Results</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredEvents.map((event) => (
                <EventCardWithBanner key={event.id} event={event} />
              ))}
            </div>
          </div>
        ) : selectedCategory !== 'all' ? (
          // Show events for selected category
          <CategorySection
            category={categories.find(c => c.value === selectedCategory)!}
            events={filteredEvents}
            showViewAll={false}
          />
        ) : (
          // Show events by category
          <div>
            {/* Events by Category */}
            {categories
              .filter(cat => cat.value !== 'all' && eventsByCategory[cat.value]?.length > 0)
              .map(category => (
                <CategorySection
                  key={category.value}
                  category={category}
                  events={eventsByCategory[category.value]}
                  maxEvents={3}
                />
              ))
            }
          </div>
        )}
      </div>

      {/* Suggested Events Carousel */}
      {!searchTerm && selectedCategory === 'all' && suggestedEvents.length > 0 && (
        <SuggestedEventsCarousel 
          events={suggestedEvents}
          title="Upcoming Events"
          subtitle="Don't miss these exciting upcoming events"
        />
      )}

      {/* Floating Action Button for Mobile */}
      {user && (
        <button
          onClick={() => setShowCreateModal(true)}
          className="fixed bottom-6 right-6 z-50 bg-[#0b6d41] text-white w-14 h-14 rounded-full shadow-lg hover:bg-[#0a5d37] transition-all hover:shadow-xl flex items-center justify-center sm:hidden"
          title="Create Event"
        >
          <Plus className="h-7 w-7" />
        </button>
      )}

      {/* Quick Event Create Modal */}
      <QuickEventCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          fetchEvents() // Refresh events list after creation
        }}
      />
    </div>
  )
}
