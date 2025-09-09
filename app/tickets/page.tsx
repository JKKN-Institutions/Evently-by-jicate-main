'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Ticket, Calendar, Clock, MapPin, Download, QrCode, ChevronRight, Filter, Shuffle, Search, X, DownloadCloud } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

interface TicketData {
  id: string
  ticket_number: string
  status: string
  qr_code_image?: string
  event: {
    id: string
    title: string
    date: string
    time: string
    venue: string
    location: string
    image_url: string
  }
  booking: {
    id: string
    user_name: string
    user_email: string
    total_amount: number
    quantity: number
  }
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<TicketData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTicket, setSelectedTicket] = useState<TicketData | null>(null)
  const [userRole, setUserRole] = useState<string>('user')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [filterDate, setFilterDate] = useState<string>('')
  const [filterVenue, setFilterVenue] = useState<string>('')
  const [isShuffled, setIsShuffled] = useState<boolean>(false)
  const [showFilters, setShowFilters] = useState<boolean>(false)
  const [downloadingAll, setDownloadingAll] = useState<boolean>(false)
  const [downloadMode, setDownloadMode] = useState<'single' | 'batch'>('single')
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'venue' | 'status'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const supabase = createClient()

  useEffect(() => {
    fetchTickets()
  }, [])

  const fetchTickets = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      // Get user role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      
      setUserRole(profile?.role || 'user')

      // For admin/organizer, fetch all tickets; for users, fetch only their tickets
      let bookingsQuery = supabase
        .from('bookings')
        .select(`
          id,
          user_name,
          user_email,
          total_amount,
          quantity,
          payment_status,
          user_id,
          events (
            id,
            title,
            date,
            time,
            venue,
            location,
            image_url,
            organizer_id
          )
        `)
        .eq('payment_status', 'completed')
        .order('created_at', { ascending: false })

      // Filter based on role
      if (profile?.role === 'admin') {
        // Admin sees all tickets
      } else if (profile?.role === 'organizer') {
        // Organizer sees tickets for their events
        const { data: organizerEvents } = await supabase
          .from('events')
          .select('id')
          .eq('organizer_id', user.id)
        
        if (organizerEvents && organizerEvents.length > 0) {
          const eventIds = organizerEvents.map(e => e.id)
          bookingsQuery = bookingsQuery.in('event_id', eventIds)
        }
      } else {
        // Regular users see only their tickets
        bookingsQuery = bookingsQuery.eq('user_id', user.id)
      }

      const { data: bookings } = await bookingsQuery

      if (bookings && bookings.length > 0) {
        const allTickets: TicketData[] = []
        
        for (const booking of bookings) {
          const response = await fetch('/api/tickets/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId: booking.id })
          })
          
          if (response.ok) {
            const { tickets: bookingTickets } = await response.json()
            if (bookingTickets) {
              allTickets.push(...bookingTickets.map((ticket: any) => ({
                ...ticket,
                event: booking.events,
                booking: {
                  id: booking.id,
                  user_name: booking.user_name,
                  user_email: booking.user_email,
                  total_amount: booking.total_amount,
                  quantity: booking.quantity
                }
              })))
            }
          }
        }
        
        setTickets(allTickets)
      }
    } catch (error) {
      console.error('Error fetching tickets:', error)
    } finally {
      setLoading(false)
    }
  }

  const downloadTicket = async (ticket: TicketData) => {
    try {
      // Use the enhanced ticket download API that includes the full ticket template
      const response = await fetch('/api/tickets/download-with-template', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticketId: ticket.id,
          format: 'pdf'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to download ticket')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `ticket-${ticket.ticket_number}.pdf`
      document.body.appendChild(link)
      link.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(link)
    } catch (error) {
      console.error('Error downloading ticket:', error)
      alert('Failed to download ticket. Please try again.')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const shuffleArray = <T,>(array: T[]): T[] => {
    const arr = [...array]
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }

  const applyFilters = () => {
    let filtered = tickets

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(t => t.status === filterStatus)
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(t => 
        t.event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.ticket_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.event.venue.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Date filter
    if (filterDate) {
      filtered = filtered.filter(t => t.event.date === filterDate)
    }

    // Venue filter
    if (filterVenue) {
      filtered = filtered.filter(t => 
        t.event.venue.toLowerCase().includes(filterVenue.toLowerCase())
      )
    }

    return filtered
  }

  const sortTickets = (tickets: TicketData[]) => {
    const sorted = [...tickets].sort((a, b) => {
      let compareValue = 0
      
      switch (sortBy) {
        case 'date':
          compareValue = new Date(a.event.date).getTime() - new Date(b.event.date).getTime()
          break
        case 'name':
          compareValue = a.event.title.localeCompare(b.event.title)
          break
        case 'venue':
          compareValue = a.event.venue.localeCompare(b.event.venue)
          break
        case 'status':
          compareValue = a.status.localeCompare(b.status)
          break
      }
      
      return sortOrder === 'asc' ? compareValue : -compareValue
    })
    
    return sorted
  }

  const filteredTickets = applyFilters()
  const sortedTickets = sortTickets(filteredTickets)
  const displayTickets = isShuffled ? shuffleArray(sortedTickets) : sortedTickets

  const downloadAllTickets = async () => {
    setDownloadingAll(true)
    try {
      const ticketsToDownload = filteredTickets.length > 0 ? filteredTickets : tickets
      
      if (downloadMode === 'single') {
        // Use bulk download API for single PDF
        const response = await fetch('/api/tickets/download-bulk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tickets: ticketsToDownload
          })
        })

        if (!response.ok) {
          throw new Error('Failed to download tickets')
        }

        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `all-tickets-${Date.now()}.pdf`
        document.body.appendChild(link)
        link.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(link)
        
        alert(`Successfully downloaded ${ticketsToDownload.length} tickets in a single PDF!`)
      } else {
        // Download individual tickets in batch
        let successCount = 0
        for (let i = 0; i < ticketsToDownload.length; i++) {
          try {
            const ticket = ticketsToDownload[i]
            await downloadTicket(ticket)
            successCount++
            // Add small delay between downloads
            await new Promise(resolve => setTimeout(resolve, 300))
          } catch (error) {
            console.error(`Failed to download ticket ${i + 1}:`, error)
          }
        }
        alert(`Downloaded ${successCount} of ${ticketsToDownload.length} tickets individually!`)
      }
    } catch (error) {
      console.error('Error downloading all tickets:', error)
      alert('Failed to download tickets. Please try again.')
    } finally {
      setDownloadingAll(false)
    }
  }

  const clearFilters = () => {
    setFilterStatus('all')
    setSearchTerm('')
    setFilterDate('')
    setFilterVenue('')
  }

  const getUniqueVenues = () => {
    const venues = [...new Set(tickets.map(t => t.event.venue))]
    return venues.sort()
  }

  const getUniqueDates = () => {
    const dates = [...new Set(tickets.map(t => t.event.date))]
    return dates.sort()
  }

  const getRoleBadge = () => {
    const badges = {
      admin: 'bg-purple-100 text-purple-800 border-purple-300',
      organizer: 'bg-blue-100 text-blue-800 border-blue-300',
      user: 'bg-gray-100 text-gray-800 border-gray-300'
    }
    const labels = {
      admin: 'Admin View',
      organizer: 'Organizer View',
      user: 'My Tickets'
    }
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${badges[userRole as keyof typeof badges]}`}>
        {labels[userRole as keyof typeof labels]}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#ffde59]"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
              <Ticket className="h-10 w-10 text-[#ffde59]" />
              {userRole === 'admin' ? 'All Tickets' : userRole === 'organizer' ? 'Event Tickets' : 'My Tickets'}
            </h1>
            {getRoleBadge()}
          </div>
          <p className="text-gray-600">
            {userRole === 'admin' 
              ? 'Manage all tickets across the platform' 
              : userRole === 'organizer' 
              ? 'View tickets for your events' 
              : 'View and manage your event tickets'}
          </p>
        </div>

        {/* Enhanced Filter and Actions Section */}
        {tickets.length > 0 && (
          <>
            {/* Search and Actions Bar */}
            <div className="mb-6 bg-white rounded-xl shadow-md p-4">
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Search Bar */}
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by event name, ticket number, or venue..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ffde59] focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-all"
                  >
                    <Filter className="h-4 w-4" />
                    Filters
                    {(filterStatus !== 'all' || filterDate || filterVenue) && (
                      <span className="bg-[#ffde59] text-[#0b6d41] px-2 py-0.5 rounded-full text-xs font-semibold">
                        Active
                      </span>
                    )}
                  </button>
                  
                  <button
                    onClick={() => setIsShuffled(!isShuffled)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                      isShuffled 
                        ? 'bg-[#ffde59] text-[#0b6d41]' 
                        : 'bg-white border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <Shuffle className="h-4 w-4" />
                    {isShuffled ? 'Shuffled' : 'Shuffle'}
                  </button>

                  <div className="flex items-center gap-2">
                    <select
                      value={downloadMode}
                      onChange={(e) => setDownloadMode(e.target.value as 'single' | 'batch')}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ffde59]"
                      disabled={downloadingAll}
                    >
                      <option value="single">Single PDF</option>
                      <option value="batch">Individual Files</option>
                    </select>
                    
                    <button
                      onClick={downloadAllTickets}
                      disabled={downloadingAll || filteredTickets.length === 0}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#ffde59] to-[#f5c842] text-[#0b6d41] rounded-lg font-semibold hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <DownloadCloud className="h-4 w-4" />
                      {downloadingAll ? `Downloading...` : `Download All (${filteredTickets.length})`}
                    </button>
                  </div>
                </div>
              </div>

              {/* Advanced Filters Panel */}
              {showFilters && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Status Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ffde59]"
                      >
                        <option value="all">All Status</option>
                        <option value="valid">Valid</option>
                        <option value="used">Used</option>
                      </select>
                    </div>

                    {/* Date Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Event Date</label>
                      <select
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ffde59]"
                      >
                        <option value="">All Dates</option>
                        {getUniqueDates().map(date => (
                          <option key={date} value={date}>
                            {new Date(date).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric', 
                              year: 'numeric' 
                            })}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Venue Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
                      <select
                        value={filterVenue}
                        onChange={(e) => setFilterVenue(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ffde59]"
                      >
                        <option value="">All Venues</option>
                        {getUniqueVenues().map(venue => (
                          <option key={venue} value={venue}>{venue}</option>
                        ))}
                      </select>
                    </div>

                    {/* Clear Filters */}
                    <div className="flex items-end">
                      <button
                        onClick={clearFilters}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all"
                      >
                        <X className="h-4 w-4" />
                        Clear Filters
                      </button>
                    </div>
                  </div>

                  {/* Sorting Options */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex flex-wrap items-center gap-4">
                      <span className="text-sm font-medium text-gray-700">Sort by:</span>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as 'date' | 'name' | 'venue' | 'status')}
                        className="px-3 py-1 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ffde59] text-sm"
                      >
                        <option value="date">Event Date</option>
                        <option value="name">Event Name</option>
                        <option value="venue">Venue</option>
                        <option value="status">Status</option>
                      </select>
                      <button
                        onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                        className="flex items-center gap-1 px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 transition-all text-sm"
                      >
                        {sortOrder === 'asc' ? '↑' : '↓'}
                        {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="text-sm text-gray-600">Total Tickets</p>
                <p className="text-2xl font-bold text-gray-900">{tickets.length}</p>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="text-sm text-gray-600">Valid Tickets</p>
                <p className="text-2xl font-bold text-green-600">{tickets.filter(t => t.status === 'valid').length}</p>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="text-sm text-gray-600">Used Tickets</p>
                <p className="text-2xl font-bold text-gray-600">{tickets.filter(t => t.status === 'used').length}</p>
              </div>
              <div className="bg-white rounded-lg p-4 shadow-sm">
                <p className="text-sm text-gray-600">Filtered Results</p>
                <p className="text-2xl font-bold text-[#ffde59]">{filteredTickets.length}</p>
              </div>
            </div>
          </>
        )}

        {tickets.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <QrCode className="h-24 w-24 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">No tickets yet</h2>
            <p className="text-gray-600 mb-6">Your purchased tickets will appear here</p>
            <Link
              href="/events"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#ffde59] to-[#f5c842] text-[#0b6d41] px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
            >
              Browse Events
              <ChevronRight className="h-5 w-5" />
            </Link>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center">
            <Filter className="h-24 w-24 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">No tickets match your filters</h2>
            <p className="text-gray-600 mb-6">Try adjusting your search criteria or clearing filters</p>
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#ffde59] to-[#f5c842] text-[#0b6d41] px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
            >
              <X className="h-5 w-5" />
              Clear All Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayTickets.map((ticket) => (
              <div
                key={ticket.id}
                className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-2xl transition-all cursor-pointer"
                onClick={() => setSelectedTicket(ticket)}
              >
                <div className="relative h-48">
                  {ticket.event.image_url ? (
                    <Image
                      src={ticket.event.image_url}
                      alt={ticket.event.title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#ffde59] to-[#f5c842] flex items-center justify-center">
                      <Ticket className="h-16 w-16 text-white/50" />
                    </div>
                  )}
                  <div className="absolute top-4 right-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      ticket.status === 'valid' 
                        ? 'bg-green-500 text-white' 
                        : ticket.status === 'used'
                        ? 'bg-gray-500 text-white'
                        : 'bg-red-500 text-white'
                    }`}>
                      {ticket.status.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{ticket.event.title}</h3>
                  
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-[#ffde59]" />
                      <span>{formatDate(ticket.event.date)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-[#ffde59]" />
                      <span>{ticket.event.time}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-[#ffde59]" />
                      <span>{ticket.event.venue}</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-500 font-mono">#{ticket.ticket_number}</p>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      downloadTicket(ticket)
                    }}
                    className="mt-4 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#ffde59] to-[#f5c842] text-[#0b6d41] px-4 py-2 rounded-lg font-semibold hover:shadow-md transition-all"
                  >
                    <Download className="h-4 w-4" />
                    Download Ticket
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedTicket && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setSelectedTicket(null)}
          >
            <div 
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
                {selectedTicket.event.title}
              </h2>
              
              {selectedTicket.qr_code_image && (
                <div className="mb-6 bg-gradient-to-br from-[#ffde59]/10 to-[#f5c842]/10 p-6 rounded-2xl">
                  <img 
                    src={selectedTicket.qr_code_image} 
                    alt="QR Code" 
                    className="w-full max-w-[300px] mx-auto"
                  />
                </div>
              )}

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Ticket Number:</span>
                  <span className="font-mono font-semibold">{selectedTicket.ticket_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Date:</span>
                  <span className="font-semibold">{formatDate(selectedTicket.event.date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Time:</span>
                  <span className="font-semibold">{selectedTicket.event.time}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Venue:</span>
                  <span className="font-semibold">{selectedTicket.event.venue}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className={`font-semibold ${
                    selectedTicket.status === 'valid' ? 'text-green-600' : 'text-gray-600'
                  }`}>
                    {selectedTicket.status.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => downloadTicket(selectedTicket)}
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[#ffde59] to-[#f5c842] text-[#0b6d41] px-4 py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
                >
                  <Download className="h-5 w-5" />
                  Download
                </button>
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}