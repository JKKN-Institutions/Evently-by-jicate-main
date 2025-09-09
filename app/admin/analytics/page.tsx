'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  ArrowLeft, 
  ChevronRight,
  ChevronDown,
  Ticket,
  QrCode,
  CheckCircle,
  XCircle,
  RefreshCw,
  Filter,
  Layers,
  Award
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface TicketData {
  total: number
  scanned: number
  unscanned: number
}

interface TicketLevel {
  level: 'Gold' | 'Silver' | 'Bronze'
  data: TicketData
}

interface TicketType {
  typeName: string
  levels: TicketLevel[]
}

interface Event {
  id: string
  title: string
  ticketTypes: TicketType[]
}

interface Category {
  name: string
  events: Event[]
  totalTickets: number
  totalScanned: number
  totalUnscanned: number
}

export default function SimplifiedAnalyticsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set())
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const supabase = createClient()

  useEffect(() => {
    checkAuth()
    loadAnalytics()
  }, [selectedCategory])

  useEffect(() => {
    // Load all unique categories on mount
    loadAllCategories()
  }, [])

  const loadAllCategories = async () => {
    try {
      const { data: events } = await supabase
        .from('events')
        .select('category')
        .limit(1000)
      
      if (events) {
        const uniqueCategories = [...new Set(events.map(e => e.category).filter(Boolean))]
        console.log('Unique categories found:', uniqueCategories)
      }
    } catch (error) {
      console.error('Error loading categories:', error)
    }
  }

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      router.push('/')
    }
  }

  const loadAnalytics = async () => {
    try {
      setLoading(true)
      console.log('Loading analytics data...')

      // Load ALL events with their categories (no limit)
      let eventsQuery = supabase
        .from('events')
        .select('id, title, category, start_date')
        .order('category', { ascending: true })
        .order('title', { ascending: true })
        .limit(1000) // Explicitly set high limit

      if (selectedCategory !== 'all') {
        eventsQuery = eventsQuery.eq('category', selectedCategory)
      }

      const { data: eventsData, error: eventsError } = await eventsQuery
      if (eventsError) throw eventsError
      console.log(`Loaded ${eventsData?.length || 0} events`)

      // Load ALL tickets with pagination to handle large datasets
      const ticketsPerPage = 1000
      let allTickets: any[] = []
      let hasMore = true
      let offset = 0
      
      console.log('Starting to load tickets...')
      while (hasMore) {
        const { data: ticketsData, error: ticketsError } = await supabase
          .from('tickets')
          .select('event_id, ticket_type, status, scan_count')
          .range(offset, offset + ticketsPerPage - 1)
        
        if (ticketsError) {
          console.error('Error loading tickets:', ticketsError)
          throw ticketsError
        }
        
        if (ticketsData && ticketsData.length > 0) {
          allTickets = [...allTickets, ...ticketsData]
          console.log(`Loaded ${ticketsData.length} tickets (total: ${allTickets.length})`)
          hasMore = ticketsData.length === ticketsPerPage
          offset += ticketsPerPage
        } else {
          hasMore = false
        }
      }
      
      const ticketsData = allTickets
      console.log(`Total tickets loaded: ${ticketsData.length}`)

      // Load ALL predefined ticket templates (ticket_level field doesn't exist in table)
      const { data: predefinedData, error: predefinedError } = await supabase
        .from('predefined_tickets')
        .select('event_id, ticket_type, name')
        .limit(1000)
      
      if (predefinedError) {
        console.error('Error loading predefined tickets:', predefinedError)
      }
      console.log(`Loaded ${predefinedData?.length || 0} predefined ticket templates`)

      // Process data into hierarchical structure
      const categoryMap = new Map<string, Category>()

      eventsData?.forEach(event => {
        const categoryName = event.category || 'Uncategorized'
        
        if (!categoryMap.has(categoryName)) {
          categoryMap.set(categoryName, {
            name: categoryName,
            events: [],
            totalTickets: 0,
            totalScanned: 0,
            totalUnscanned: 0
          })
        }

        const category = categoryMap.get(categoryName)!
        
        // Get tickets for this event
        const eventTickets = ticketsData?.filter(t => t.event_id === event.id) || []
        
        // Group tickets by type and level
        const ticketTypeMap = new Map<string, Map<string, TicketData>>()
        
        eventTickets.forEach(ticket => {
          const ticketType = ticket.ticket_type || 'General'
          
          // Determine ticket level from predefined templates or analyze the ticket type name
          let level: 'Gold' | 'Silver' | 'Bronze' = 'Bronze' // Default
          
          // Analyze ticket type name to determine level
          const typeLower = ticketType.toLowerCase()
          
          // Check predefined templates for name hints
          const predefined = predefinedData?.find(p => 
            p.event_id === event.id && p.ticket_type === ticketType
          )
          
          // Determine level based on ticket type name or predefined name
          const nameToCheck = (predefined?.name || ticketType).toLowerCase()
          
          if (nameToCheck.includes('gold') || nameToCheck.includes('vip') || nameToCheck.includes('platinum') || nameToCheck.includes('premium vip')) {
            level = 'Gold'
          } else if (nameToCheck.includes('silver') || nameToCheck.includes('premium') || nameToCheck.includes('plus')) {
            level = 'Silver'
          } else {
            // Default everything else to Bronze
            level = 'Bronze'
          }
          
          if (!ticketTypeMap.has(ticketType)) {
            ticketTypeMap.set(ticketType, new Map())
          }
          
          const typeMap = ticketTypeMap.get(ticketType)!
          if (!typeMap.has(level)) {
            typeMap.set(level, { total: 0, scanned: 0, unscanned: 0 })
          }
          
          const levelData = typeMap.get(level)!
          levelData.total++
          
          // Check if ticket is scanned
          if (ticket.scan_count && ticket.scan_count > 0) {
            levelData.scanned++
          } else {
            levelData.unscanned++
          }
          
          // Update category totals
          category.totalTickets++
          if (ticket.scan_count && ticket.scan_count > 0) {
            category.totalScanned++
          } else {
            category.totalUnscanned++
          }
        })
        
        // Convert maps to array structure
        const ticketTypes: TicketType[] = Array.from(ticketTypeMap.entries()).map(([typeName, levelMap]) => ({
          typeName,
          levels: Array.from(levelMap.entries()).map(([level, data]) => ({
            level: level as 'Gold' | 'Silver' | 'Bronze',
            data
          })).sort((a, b) => {
            // Sort levels: Gold -> Silver -> Bronze
            const order = { 'Gold': 0, 'Silver': 1, 'Bronze': 2 }
            return order[a.level] - order[b.level]
          })
        }))
        
        category.events.push({
          id: event.id,
          title: event.title,
          ticketTypes
        })
      })

      const finalCategories = Array.from(categoryMap.values())
      console.log(`Processed ${finalCategories.length} categories with ${finalCategories.reduce((sum, cat) => sum + cat.events.length, 0)} events`)
      setCategories(finalCategories)

    } catch (error: any) {
      console.error('Error loading analytics:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = () => {
    setRefreshing(true)
    loadAnalytics()
  }

  const toggleCategory = (categoryName: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(categoryName)) {
      newExpanded.delete(categoryName)
    } else {
      newExpanded.add(categoryName)
    }
    setExpandedCategories(newExpanded)
  }

  const toggleEvent = (eventId: string) => {
    const newExpanded = new Set(expandedEvents)
    if (newExpanded.has(eventId)) {
      newExpanded.delete(eventId)
    } else {
      newExpanded.add(eventId)
    }
    setExpandedEvents(newExpanded)
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'Gold':
        return 'bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-600 text-white shadow-xl border-2 border-yellow-300'
      case 'Silver':
        return 'bg-gradient-to-br from-gray-300 via-gray-400 to-gray-500 text-white shadow-xl border-2 border-gray-300'
      case 'Bronze':
        return 'bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 text-white shadow-xl border-2 border-orange-300'
      default:
        return 'bg-gradient-to-br from-gray-200 to-gray-300 text-gray-700 shadow-lg border-2 border-gray-200'
    }
  }

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'Gold':
        return '🏆'
      case 'Silver':
        return '🥈'
      case 'Bronze':
        return '🥉'
      default:
        return '🎫'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-[#0b6d41] mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading analytics...</p>
        </div>
      </div>
    )
  }

  // Calculate grand totals
  const grandTotal = categories.reduce((sum, cat) => sum + cat.totalTickets, 0)
  const grandScanned = categories.reduce((sum, cat) => sum + cat.totalScanned, 0)
  const grandUnscanned = categories.reduce((sum, cat) => sum + cat.totalUnscanned, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/admin" className="text-2xl font-bold text-[#0b6d41]">
                Ticket Analytics
              </Link>
              <div className="h-6 w-px bg-gray-300"></div>
              <span className="text-sm text-gray-600">Category → Event → Ticket Type → Level</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleRefresh}
                className={`inline-flex items-center px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 ${refreshing ? 'animate-spin' : ''}`}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? '' : 'mr-2'}`} />
                {!refreshing && 'Refresh'}
              </button>
              <Link
                href="/admin"
                className="inline-flex items-center px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-gray-700 to-gray-800 rounded-xl hover:from-gray-800 hover:to-gray-900 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Admin
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Filter */}
        <div className="mb-6 bg-gradient-to-r from-white to-gray-50 rounded-2xl shadow-lg p-6 border border-gray-100">
          <div className="flex items-center gap-4">
            <div className="p-2.5 bg-gradient-to-r from-[#0b6d41] to-[#0a5835] rounded-xl shadow-md">
              <Filter className="h-5 w-5 text-white" />
            </div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="flex-1 px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0b6d41] focus:border-[#0b6d41] transition-all text-gray-700 font-medium shadow-sm hover:shadow-md"
            >
              <option value="all">🎯 All Categories</option>
              {Array.from(new Set(categories.map(c => c.name))).sort().map(catName => (
                <option key={catName} value={catName}>📁 {catName}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Grand Total Summary */}
        <div className="mb-6 grid grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-all">
            <div className="flex items-center justify-between mb-3">
              <Ticket className="h-8 w-8 opacity-80" />
              <span className="text-xs bg-white/20 px-2 py-1 rounded-full">Total</span>
            </div>
            <div className="text-4xl font-bold mb-2">{grandTotal.toLocaleString()}</div>
            <div className="text-sm opacity-90">Total Tickets Created</div>
            <div className="mt-3 pt-3 border-t border-white/20">
              <div className="text-xs opacity-80">Across all events</div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-all">
            <div className="flex items-center justify-between mb-3">
              <CheckCircle className="h-8 w-8 opacity-80" />
              <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
                {grandTotal > 0 ? `${Math.round((grandScanned/grandTotal)*100)}%` : '0%'}
              </span>
            </div>
            <div className="text-4xl font-bold mb-2">{grandScanned.toLocaleString()}</div>
            <div className="text-sm opacity-90">Tickets Scanned</div>
            <div className="mt-3 pt-3 border-t border-white/20">
              <div className="text-xs opacity-80">Successfully verified</div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl shadow-xl p-6 text-white transform hover:scale-105 transition-all">
            <div className="flex items-center justify-between mb-3">
              <XCircle className="h-8 w-8 opacity-80" />
              <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
                {grandTotal > 0 ? `${Math.round((grandUnscanned/grandTotal)*100)}%` : '0%'}
              </span>
            </div>
            <div className="text-4xl font-bold mb-2">{grandUnscanned.toLocaleString()}</div>
            <div className="text-sm opacity-90">Tickets Unscanned</div>
            <div className="mt-3 pt-3 border-t border-white/20">
              <div className="text-xs opacity-80">Yet to be verified</div>
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="space-y-4">
          {categories.map(category => (
            <div key={category.name} className="bg-white rounded-lg shadow overflow-hidden">
              {/* Category Header */}
              <div
                className="px-6 py-5 bg-gradient-to-r from-[#0b6d41]/10 to-[#0b6d41]/5 cursor-pointer hover:from-[#0b6d41]/20 hover:to-[#0b6d41]/10 transition-all border-b-2 border-[#0b6d41]/20"
                onClick={() => toggleCategory(category.name)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 bg-white rounded-lg shadow-sm">
                      {expandedCategories.has(category.name) ? (
                        <ChevronDown className="h-5 w-5 text-[#0b6d41]" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-[#0b6d41]" />
                      )}
                    </div>
                    <div className="p-2 bg-gradient-to-r from-[#0b6d41] to-[#0a5835] rounded-lg shadow-md">
                      <Layers className="h-5 w-5 text-white" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">{category.name}</h2>
                    <span className="px-3 py-1 bg-[#0b6d41]/10 text-[#0b6d41] text-sm font-medium rounded-full">
                      {category.events.length} events
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="px-4 py-2 bg-blue-50 rounded-xl border border-blue-200">
                      <span className="text-xs text-blue-600 font-medium">TOTAL</span>
                      <div className="text-lg font-bold text-blue-700">{category.totalTickets}</div>
                    </div>
                    <div className="px-4 py-2 bg-green-50 rounded-xl border border-green-200">
                      <span className="text-xs text-green-600 font-medium">SCANNED</span>
                      <div className="text-lg font-bold text-green-700">{category.totalScanned}</div>
                    </div>
                    <div className="px-4 py-2 bg-orange-50 rounded-xl border border-orange-200">
                      <span className="text-xs text-orange-600 font-medium">PENDING</span>
                      <div className="text-lg font-bold text-orange-700">{category.totalUnscanned}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Events */}
              {expandedCategories.has(category.name) && (
                <div className="border-t border-gray-200">
                  {category.events.map(event => (
                    <div key={event.id} className="border-b border-gray-100 last:border-b-0">
                      {/* Event Header */}
                      <div
                        className="px-8 py-4 bg-gradient-to-r from-gray-50 to-white cursor-pointer hover:from-gray-100 hover:to-gray-50 transition-all border-l-4 border-[#0b6d41]/30 hover:border-[#0b6d41]/60"
                        onClick={() => toggleEvent(event.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-1 bg-white rounded shadow-sm">
                              {expandedEvents.has(event.id) ? (
                                <ChevronDown className="h-4 w-4 text-[#0b6d41]" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-[#0b6d41]" />
                              )}
                            </div>
                            <span className="font-semibold text-gray-900 text-lg">{event.title}</span>
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                              {event.ticketTypes.length} types
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Ticket className="h-4 w-4 text-gray-400" />
                            <span className="text-sm font-bold text-gray-700">
                              {event.ticketTypes.map(type => 
                                type.levels.reduce((sum, level) => sum + level.data.total, 0)
                              ).reduce((a, b) => a + b, 0)} tickets
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Ticket Types and Levels */}
                      {expandedEvents.has(event.id) && (
                        <div className="px-10 py-4 bg-white">
                          {event.ticketTypes.length > 0 ? (
                            <div className="space-y-4">
                              {event.ticketTypes.map((ticketType, idx) => (
                                <div key={idx} className="bg-gradient-to-r from-gray-50 to-white border-2 border-gray-200 rounded-2xl p-5 shadow-md hover:shadow-lg transition-all">
                                  <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 bg-purple-100 rounded-lg">
                                      <Ticket className="h-5 w-5 text-purple-600" />
                                    </div>
                                    <span className="font-bold text-gray-900 text-lg">
                                      {ticketType.typeName}
                                    </span>
                                  </div>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {ticketType.levels.map((level, levelIdx) => (
                                      <div 
                                        key={levelIdx} 
                                        className={`rounded-2xl p-4 transform hover:scale-105 transition-all ${getLevelColor(level.level)}`}
                                      >
                                        <div className="flex items-center justify-between mb-2">
                                          <div className="flex items-center gap-2">
                                            <span className="text-lg">{getLevelIcon(level.level)}</span>
                                            <span className="font-bold">{level.level}</span>
                                          </div>
                                          <Award className="h-4 w-4 opacity-50" />
                                        </div>
                                        
                                        <div className="space-y-1 text-sm">
                                          <div className="flex justify-between">
                                            <span className="opacity-90">Total:</span>
                                            <span className="font-bold">{level.data.total}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="opacity-90">Scanned:</span>
                                            <span className="font-bold">{level.data.scanned}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="opacity-90">Unscanned:</span>
                                            <span className="font-bold">{level.data.unscanned}</span>
                                          </div>
                                        </div>

                                        {/* Progress bar */}
                                        <div className="mt-2">
                                          <div className="w-full bg-white/20 rounded-full h-1.5">
                                            <div 
                                              className="bg-white/70 h-1.5 rounded-full transition-all"
                                              style={{ 
                                                width: `${level.data.total > 0 
                                                  ? (level.data.scanned / level.data.total) * 100 
                                                  : 0}%` 
                                              }}
                                            />
                                          </div>
                                          <div className="text-xs mt-1 text-center opacity-90">
                                            {level.data.total > 0 
                                              ? `${Math.round((level.data.scanned / level.data.total) * 100)}% scanned`
                                              : 'No tickets'}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-8 text-gray-500">
                              <Ticket className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p>No tickets created for this event yet</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {categories.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <Layers className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No data available</p>
          </div>
        )}
      </div>
    </div>
  )
}