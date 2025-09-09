'use client'

import Link from 'next/link'
import { Calendar, MapPin, Users, Search, AlertCircle, X, Clock, Laptop, Music, Briefcase, Palette, Trophy, Utensils, GraduationCap, HeartHandshake, Film, Heart, Plane, Grid3X3, Plus, Layers, Tag, ChevronRight, ChevronDown, Share2, Check, Copy } from 'lucide-react'
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
  date?: string
  start_date?: string
  time: string
  venue: string
  location: string
  price: number
  max_attendees: number
  category: string
  image_url?: string
  organizer_id: string
  event_page_id?: string
  profiles?: {
    full_name: string
    email: string
  }
  attendees_count?: number
}

interface EventPage {
  id: string
  title: string
  description: string
  banner_image?: string
  location: string
  start_date: string
  end_date?: string
  event_count: number
  events: Event[]
}

type ViewMode = 'category' | 'page'

export default function EnhancedEventsPage() {
  const searchParams = useSearchParams()

  const [showMessage, setShowMessage] = useState(false)
  const [message, setMessage] = useState('')
  const [events, setEvents] = useState<Event[]>([])
  const [eventPages, setEventPages] = useState<EventPage[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedPage, setSelectedPage] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('category')
  const [user, setUser] = useState<any>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set())
  const [copiedPageId, setCopiedPageId] = useState<string | null>(null)
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
      const timeoutId = setTimeout(() => controller.abort(), 30000)
      
      try {
        const response = await fetch('/api/events?category=all&limit=50', {
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
          const directEvents = await fetchEventsDirectly()
          setEvents(directEvents)
        }
      } catch (fetchError: any) {
        const directEvents = await fetchEventsDirectly()
        setEvents(directEvents)
      }
    } catch (error) {
      console.error('Error fetching events:', error)
      setEvents([])
    } finally {
      setLoading(false)
    }
  }

  const fetchEventPages = async () => {
    try {
      console.log('Fetching event pages from API...')
      // Include all pages, even without events for now
      const response = await fetch('/api/event-pages/with-events?includeEmpty=true')
      if (response.ok) {
        const data = await response.json()
        console.log('Event pages received:', data.eventPages?.length || 0, 'pages')
        console.log('Event pages data:', data.eventPages)
        setEventPages(data.eventPages || [])
      } else {
        console.error('Failed to fetch event pages, status:', response.status)
        const error = await response.text()
        console.error('Error response:', error)
        setEventPages([])
      }
    } catch (error) {
      console.error('Error fetching event pages:', error)
      setEventPages([])
    }
  }

  useEffect(() => {
    fetchEvents()
    fetchEventPages()
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
      date: event.date || event.start_date,
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

  // Toggle page expansion
  const togglePageExpanded = (pageId: string) => {
    setExpandedPages(prev => {
      const newSet = new Set(prev)
      if (newSet.has(pageId)) {
        newSet.delete(pageId)
      } else {
        newSet.add(pageId)
      }
      return newSet
    })
  }

  // Copy page link to clipboard
  const copyPageLink = async (pageId: string, pageSlug?: string, e?: React.MouseEvent) => {
    // Prevent triggering the expand/collapse when clicking share button
    if (e) {
      e.stopPropagation()
    }

    try {
      // Generate the shareable link
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
      const pageUrl = pageSlug 
        ? `${baseUrl}/event-pages/${pageSlug}`
        : `${baseUrl}/admin/event-pages/${pageId}`
      
      // Copy to clipboard
      await navigator.clipboard.writeText(pageUrl)
      
      // Show success feedback
      setCopiedPageId(pageId)
      
      // Reset feedback after 2 seconds
      setTimeout(() => {
        setCopiedPageId(null)
      }, 2000)
      
      console.log('Page link copied:', pageUrl)
    } catch (error) {
      console.error('Failed to copy link:', error)
      alert('Failed to copy link. Please try again.')
    }
  }

  // Get event counts
  const eventCounts = useMemo(() => {
    const counts: { [key: string]: number } = { 
      total: enhancedEvents.length,
      pages: eventPages.length,
      pageEvents: eventPages.reduce((sum, page) => sum + page.event_count, 0)
    }
    categories.forEach(cat => {
      if (cat.value === 'all') {
        counts[cat.value] = enhancedEvents.length
      } else {
        counts[cat.value] = eventsByCategory[cat.value]?.length || 0
      }
    })
    return counts
  }, [eventsByCategory, enhancedEvents, eventPages])

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
          <div className="grid grid-cols-4 gap-3 max-w-3xl mx-auto">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
              <div className="text-2xl font-bold">{eventCounts.total}</div>
              <div className="text-xs text-white/80">Total Events</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
              <div className="text-2xl font-bold">{categories.length - 1}</div>
              <div className="text-xs text-white/80">Categories</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
              <div className="text-2xl font-bold">{eventCounts.pages}</div>
              <div className="text-xs text-white/80">Event Pages</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3">
              <div className="text-2xl font-bold">{enhancedEvents.filter(e => new Date(e.date || '') >= new Date()).length}</div>
              <div className="text-xs text-white/80">Upcoming</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6 lg:py-8">
        {/* View Mode Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => {
                  setViewMode('category')
                  setSelectedPage(null)
                }}
                className={`${
                  viewMode === 'category'
                    ? 'border-[#0b6d41] text-[#0b6d41]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
              >
                <Tag className="h-4 w-4" />
                Browse by Category
              </button>
              <button
                onClick={() => {
                  setViewMode('page')
                  setSelectedCategory('all')
                }}
                className={`${
                  viewMode === 'page'
                    ? 'border-[#0b6d41] text-[#0b6d41]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}
              >
                <Layers className="h-4 w-4" />
                Browse by Event Pages
                {eventCounts.pages > 0 && (
                  <span className="bg-[#0b6d41]/10 text-[#0b6d41] px-2 py-0.5 rounded-full text-xs font-semibold">
                    {eventCounts.pages}
                  </span>
                )}
              </button>
            </nav>
          </div>
        </div>

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
              className="text-blue-400 hover:text-blue-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder={viewMode === 'category' ? "Search events by name, venue, or location..." : "Search within event pages..."}
              className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0b6d41] focus:border-transparent text-gray-900 placeholder-gray-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Category View */}
        {viewMode === 'category' && (
          <>
            {/* Category Navigation */}
            <CategoryNavigation 
              categories={categories}
              selectedCategory={selectedCategory}
              onCategorySelect={setSelectedCategory}
              eventCounts={eventCounts}
            />

            {/* Events Display */}
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0b6d41]"></div>
              </div>
            ) : (
              <>
                {selectedCategory === 'all' ? (
                  <div className="space-y-12">
                    {categories.slice(1).map(category => {
                      const categoryEvents = eventsByCategory[category.value]?.filter(event =>
                        event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        event.description.toLowerCase().includes(searchTerm.toLowerCase())
                      ) || []
                      
                      if (categoryEvents.length === 0) return null
                      
                      return (
                        <CategorySection
                          key={category.value}
                          category={category}
                          events={categoryEvents}
                        />
                      )
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredEvents.map(event => (
                      <EventCardWithBanner key={event.id} event={event} />
                    ))}
                  </div>
                )}

                {filteredEvents.length === 0 && (
                  <div className="text-center py-12">
                    <div className="bg-gray-50 rounded-2xl p-12 max-w-md mx-auto">
                      <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-gray-900 mb-2">No Events Found</h3>
                      <p className="text-gray-600">
                        {searchTerm ? 
                          `No events matching "${searchTerm}" in this category.` : 
                          'No events available in this category yet.'}
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Page View */}
        {viewMode === 'page' && (
          <div className="space-y-8">
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0b6d41]"></div>
              </div>
            ) : eventPages.length === 0 ? (
              <div className="text-center py-12">
                <div className="bg-gray-50 rounded-2xl p-12 max-w-md mx-auto">
                  <Layers className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No Event Pages Available</h3>
                  <p className="text-gray-600">
                    There are no festival or multi-event pages available at the moment.
                  </p>
                </div>
              </div>
            ) : (
              eventPages
                .filter(page => 
                  searchTerm === '' || 
                  page.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  page.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  page.events.some(event => 
                    event.title.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                )
                .map(page => {
                  const isExpanded = expandedPages.has(page.id)
                  
                  return (
                  <div key={page.id} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100 transition-all">
                    {/* Page Header - Clickable */}
                    <div 
                      className="relative cursor-pointer group"
                      onClick={() => togglePageExpanded(page.id)}
                    >
                      {page.banner_image ? (
                        <img 
                          src={page.banner_image} 
                          alt={page.title}
                          className="w-full h-48 object-cover group-hover:brightness-110 transition-all"
                        />
                      ) : (
                        <div className="w-full h-48 bg-gradient-to-r from-[#0b6d41] to-[#15a862] group-hover:from-[#0a5d37] group-hover:to-[#129755] transition-all" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h2 className="text-2xl font-bold mb-2">{page.title}</h2>
                            <div className="flex items-center gap-4 text-sm">
                              <div className="flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                {page.location}
                              </div>
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                {formatDate(page.start_date)} {page.end_date && `- ${formatDate(page.end_date)}`}
                              </div>
                              <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full">
                                {page.event_count} Events
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {/* Share Button */}
                            <button
                              onClick={(e) => copyPageLink(page.id, page.slug, e)}
                              className="bg-white/20 backdrop-blur-sm p-2 rounded-full hover:bg-white/30 transition-all group/share"
                              title="Copy page link"
                            >
                              {copiedPageId === page.id ? (
                                <Check className="h-5 w-5 text-white" />
                              ) : (
                                <Share2 className="h-5 w-5 text-white group-hover/share:scale-110 transition-transform" />
                              )}
                            </button>
                            {/* Expand/Collapse Indicator */}
                            <div className="bg-white/20 backdrop-blur-sm p-2 rounded-full group-hover:bg-white/30 transition-all">
                              {isExpanded ? (
                                <ChevronDown className="h-6 w-6 text-white" />
                              ) : (
                                <ChevronRight className="h-6 w-6 text-white" />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Page Description - Always visible */}
                    {page.description && (
                      <div className="px-6 py-4 border-b border-gray-100">
                        <p className="text-gray-600">{page.description}</p>
                      </div>
                    )}

                    {/* Copy Success Message */}
                    {copiedPageId === page.id && (
                      <div className="px-6 py-3 bg-green-50 border-b border-green-100">
                        <div className="flex items-center gap-2 text-green-700">
                          <Check className="h-4 w-4" />
                          <p className="text-sm font-medium">Link copied to clipboard!</p>
                        </div>
                      </div>
                    )}

                    {/* Click to expand message when collapsed */}
                    {!isExpanded && (
                      <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-gray-600">
                            Click to view {page.event_count} events in this collection
                          </p>
                          <ChevronRight className="h-5 w-5 text-gray-400" />
                        </div>
                      </div>
                    )}

                    {/* Child Events - Only show when expanded */}
                    {isExpanded && (
                      <div 
                        className="p-6 border-t border-gray-100 bg-gray-50/50 animate-in slide-in-from-top duration-300"
                        style={{
                          animation: isExpanded ? 'slideDown 0.3s ease-out' : 'slideUp 0.3s ease-out'
                        }}
                      >
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                          <Calendar className="h-5 w-5 text-[#0b6d41]" />
                          Events in {page.title}
                        </h3>
                        {page.events && page.events.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {page.events.map((event: any) => (
                          <Link
                            key={event.id}
                            href={`/events/${event.id}`}
                            className="group bg-gray-50 rounded-xl p-4 hover:bg-white hover:shadow-md transition-all border border-transparent hover:border-gray-200"
                          >
                            {event.image_url && (
                              <img 
                                src={event.image_url}
                                alt={event.title}
                                className="w-full h-32 object-cover rounded-lg mb-3"
                              />
                            )}
                            <h4 className="font-semibold text-gray-900 group-hover:text-[#0b6d41] transition-colors mb-2">
                              {event.title}
                            </h4>
                            <div className="space-y-1 text-sm text-gray-600">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-3.5 w-3.5" />
                                {formatDate(event.start_date || event.date)}
                                {event.time && formatTime(event.time) && (
                                  <span>• {formatTime(event.time)}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <MapPin className="h-3.5 w-3.5" />
                                {event.venue}
                              </div>
                              {event.price > 0 ? (
                                <div className="font-semibold text-[#0b6d41]">
                                  {formatPrice(event.price)}
                                </div>
                              ) : (
                                <div className="font-semibold text-green-600">
                                  Free Event
                                </div>
                              )}
                            </div>
                            <div className="mt-3 flex items-center text-[#0b6d41] text-sm font-medium group-hover:gap-2 transition-all">
                              View Details
                              <ChevronRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                            </div>
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 bg-gray-50 rounded-lg">
                        <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No events scheduled yet for this page</p>
                        <p className="text-sm text-gray-400 mt-1">Check back later for updates</p>
                      </div>
                    )}
                      </div>
                    )}
                  </div>
                  )
                })
            )}
          </div>
        )}
      </div>

      {/* Quick Create Modal */}
      {showCreateModal && (
        <QuickEventCreateModal 
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            fetchEvents()
          }}
        />
      )}
    </div>
  )
}