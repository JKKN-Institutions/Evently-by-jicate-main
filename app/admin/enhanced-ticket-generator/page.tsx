'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { isAdminEmail } from '@/lib/config/admin-emails'
import { 
  Ticket, 
  Download, 
  Trash2, 
  Plus, 
  QrCode, 
  FileText,
  Users,
  Calendar,
  MapPin,
  Clock,
  Building2,
  Globe,
  Instagram,
  Twitter,
  Facebook,
  Linkedin,
  Shield,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  X,
  Filter,
  Search,
  ChevronDown
} from 'lucide-react'

interface Event {
  id: string
  title: string
  date: string
  time: string
  venue: string
  organizer_id: string
  category: string
  ticket_template?: any
}

export default function EnhancedTicketGeneratorPage() {
  const { user, profile, loading: authLoading } = useAuth()
  
  // Derive effective role - same logic as professional-sidebar
  const effectiveRole = profile?.role || (user?.email && isAdminEmail(user.email) ? 'admin' : 'user')
  const isAdmin = effectiveRole === 'admin'
  const [selectedEvent, setSelectedEvent] = useState('')
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingTickets, setLoadingTickets] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [ticketQuantity, setTicketQuantity] = useState(1)
  const [autoDownload, setAutoDownload] = useState(true)
  const [generatedTickets, setGeneratedTickets] = useState<any[]>([])
  const [selectedTickets, setSelectedTickets] = useState<string[]>([])
  const [downloadingTickets, setDownloadingTickets] = useState<string[]>([])
  const [isDownloading, setIsDownloading] = useState(false)
  const [activeTab, setActiveTab] = useState('generate')
  
  // Filter states
  const [categoryFilter, setCategoryFilter] = useState('')
  const [eventFilter, setEventFilter] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const [ticketTemplate] = useState({
    themeColor: '#0b6d41',
    secondaryColor: '#15a862',
    includeQRCode: true,
    enableWatermark: true,
    showAttendeeName: true,
    showRegistrationId: true,
    layoutStyle: 'modern',
    organizerName: 'Event Organizer'
  })

  const supabase = createClient()

  useEffect(() => {
    if (authLoading) return
    if (!isAdmin) return
    fetchEvents()
    fetchGeneratedTickets()
  }, [authLoading, isAdmin])

  const fetchGeneratedTickets = async () => {
    try {
      setLoadingTickets(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get user role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      // Fetch enhanced tickets (tickets with ticket_type = 'enhanced' or from metadata)
      let query = supabase
        .from('tickets')
        .select(`
          *,
          events (
            id,
            title,
            date,
            time,
            venue,
            category
          )
        `)
        .or('ticket_type.eq.enhanced,ticket_type.eq.Enhanced')
        .order('created_at', { ascending: false })

      // If not admin, only show tickets from user's events
      if (profile?.role !== 'admin') {
        const { data: userEvents } = await supabase
          .from('events')
          .select('id')
          .eq('organizer_id', user.id)
        
        if (userEvents && userEvents.length > 0) {
          const eventIds = userEvents.map(e => e.id)
          query = query.in('event_id', eventIds)
        }
      }

      const { data: tickets, error } = await query

      if (error) {
        console.error('Error fetching generated tickets:', error)
        return
      }

      // Transform tickets to match the expected format
      const transformedTickets = tickets?.map(ticket => ({
        ...ticket,
        event_title: ticket.events?.title || ticket.metadata?.event_title || 'Unknown Event',
        event_category: ticket.events?.category || 'Uncategorized'
      })) || []

      setGeneratedTickets(transformedTickets)
      console.log(`Loaded ${transformedTickets.length} tickets from database`)
    } catch (error) {
      console.error('Error fetching generated tickets:', error)
    } finally {
      setLoadingTickets(false)
    }
  }

  const fetchEvents = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get user role
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      let query = supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false })

      // If not admin, only show user's events
      if (profile?.role !== 'admin') {
        query = query.eq('organizer_id', user.id)
      }

      const { data: eventsData, error } = await query

      if (error) {
        console.error('Error fetching events:', error)
        return
      }

      setEvents(eventsData || [])
    } catch (error) {
      console.error('Error fetching events:', error)
    } finally {
      setLoading(false)
    }
  }

  // Get unique categories from tickets
  const getUniqueCategories = () => {
    const categories = generatedTickets.map(ticket => ticket.event_category).filter(Boolean)
    return [...new Set(categories)].sort()
  }

  // Get unique events from tickets
  const getUniqueEvents = () => {
    const events = generatedTickets.map(ticket => ticket.event_title).filter(Boolean)
    return [...new Set(events)].sort()
  }

  // Filter tickets based on current filters
  const getFilteredTickets = () => {
    return generatedTickets.filter(ticket => {
      const matchesCategory = !categoryFilter || ticket.event_category === categoryFilter
      const matchesEvent = !eventFilter || ticket.event_title === eventFilter
      const matchesSearch = !searchTerm || 
        ticket.ticket_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.event_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ticket.event_category?.toLowerCase().includes(searchTerm.toLowerCase())
      
      return matchesCategory && matchesEvent && matchesSearch
    })
  }

  // Clear all filters
  const clearFilters = () => {
    setCategoryFilter('')
    setEventFilter('')
    setSearchTerm('')
  }

  // Get filtered tickets count
  const filteredTickets = getFilteredTickets()

  const generateEnhancedTickets = async () => {
    if (!selectedEvent || ticketQuantity < 1) {
      alert('Please select an event and specify quantity')
      return
    }

    setGenerating(true)
    let result = null
    
    try {
      // Get the selected event and use its ticket_template if available
      const selectedEventData = events.find(e => e.id === selectedEvent)
      const finalTemplate = selectedEventData?.ticket_template || ticketTemplate
      
      // Use force generation as primary method due to database constraints
      console.log('Using force generation method due to database constraints...')
      console.log('Using template:', finalTemplate)
      const response = await fetch('/api/tickets/generate-force', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId: selectedEvent,
          quantity: ticketQuantity,
          template: finalTemplate
        })
      })

      if (response.ok) {
        result = await response.json()
        console.log(`Force generation successful: ${result.tickets?.length || 0} tickets`)
        if (result.note) {
          console.info('Note:', result.note)
        }
      } else {
        const errorData = await response.json().catch(() => null)
        console.error('Force generation failed:', errorData)
        
        // If enhanced generation fails, try simple generation
        console.log('Falling back to simple ticket generation...')
        const simpleResponse = await fetch('/api/tickets/generate-simple', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            eventId: selectedEvent,
            quantity: ticketQuantity,
            template: finalTemplate
          })
        })
        
        if (simpleResponse.ok) {
          result = await simpleResponse.json()
          console.log(`Simple generation successful: ${result.tickets?.length || 0} tickets`)
        } else {
          console.error('Simple generation also failed, trying bypass method...')
          
          // Last resort: bypass method
          const bypassResponse = await fetch('/api/tickets/generate-bypass', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              eventId: selectedEvent,
              quantity: ticketQuantity
            })
          })
          
          if (bypassResponse.ok) {
            result = await bypassResponse.json()
            console.log(`Bypass generation successful: ${result.tickets?.length || 0} tickets`)
            if (result.warning) {
              console.warn('Bypass warning:', result.warning)
            }
          } else {
            throw new Error('All ticket generation methods failed')
          }
        }
      }
      
      if (result && result.tickets && result.tickets.length > 0) {
        // Refresh the tickets list to get the latest from database
        await fetchGeneratedTickets()
        
        console.log(`Generated ${result.tickets.length} tickets`)
        
        // Automatically download all generated tickets if auto-download is enabled
        if (autoDownload) {
          console.log('Starting automatic download...')
          
          // Use bulk ZIP download for 2 or more tickets
          if (result.tickets.length >= 2) {
            console.log('Using bulk ZIP download for', result.tickets.length, 'generated tickets')
            
            const ticketIds = result.tickets.map((t: any) => t.id)
            // Use chunked download for large quantities
            const endpoint = result.tickets.length > 100 
              ? '/api/tickets/download-bulk-chunked' 
              : '/api/tickets/download-bulk-enhanced'
            
            console.log(`Using ${result.tickets.length > 100 ? 'chunked' : 'standard'} bulk download`)
            
            const response = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                ticketIds: ticketIds,
                eventId: selectedEvent,
                template: finalTemplate
              })
            })

            if (response.ok) {
              const blob = await response.blob()
              const url = window.URL.createObjectURL(blob)
              const a = document.createElement('a')
              a.href = url
              a.download = `generated-tickets-${Date.now()}.zip`
              document.body.appendChild(a)
              a.click()
              window.URL.revokeObjectURL(url)
              document.body.removeChild(a)
              
              alert(`✅ Generated and downloaded ${result.tickets.length} tickets as ZIP file!`)
            } else {
              console.error('Bulk download failed, falling back to individual downloads')
              // Fallback to individual downloads
              for (let i = 0; i < result.tickets.length; i++) {
                const ticket = result.tickets[i]
                await downloadTicket(ticket.id, ticket, ticket.template || finalTemplate)
                if (i < result.tickets.length - 1) {
                  await new Promise(resolve => setTimeout(resolve, 500))
                }
              }
              alert(`✅ Generated and downloaded ${result.tickets.length} tickets successfully!`)
            }
          } else {
            // For fewer tickets, download individually
            for (let i = 0; i < result.tickets.length; i++) {
              const ticket = result.tickets[i]
              await downloadTicket(ticket.id, ticket, ticket.template || finalTemplate)
              if (i < result.tickets.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500))
              }
            }
            alert(`✅ Generated and downloaded ${result.tickets.length} tickets successfully!`)
          }
        } else {
          alert(`✅ Generated ${result.tickets.length} tickets successfully! You can download them from the Generated Tickets tab.`)
        }
      } else {
        alert('⚠️ No tickets were generated. Please check the console for details.')
      }
    } catch (error) {
      console.error('Error generating tickets:', error)
      alert('Failed to generate tickets. Please check the console and try again.')
    } finally {
      setGenerating(false)
    }
  }

  const downloadTicket = async (ticketId: string, ticketData?: any, template?: any) => {
    try {
      setDownloadingTickets(prev => [...prev, ticketId])
      
      // Always use enhanced PDF download for better design
      if (ticketData) {
        console.log('Using enhanced PDF download for ticket:', ticketId)
        
        // Get event details for the ticket
        const eventDetails = events?.find(e => e.id === ticketData.event_id)
        const eventTemplate = eventDetails?.ticket_template
        
        // Build complete event details
        const completeEventDetails = {
          title: eventDetails?.title || ticketData.event_title,
          date: eventDetails?.date || eventTemplate?.eventDate || ticketTemplate?.eventDate,
          time: eventDetails?.time || eventTemplate?.eventTime || ticketTemplate?.eventTime,
          venue: eventDetails?.venue || eventTemplate?.venue || ticketTemplate?.venue,
          location: eventDetails?.location || eventTemplate?.location || ticketTemplate?.location
        }
        
        // Use the event's template if available, otherwise use the passed template or default template
        const finalTemplate = eventTemplate || template || ticketTemplate
        
        const response = await fetch('/api/tickets/download-enhanced-pdf', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ticket: ticketData,
            template: finalTemplate,
            event: completeEventDetails
          })
        })
        
        if (!response.ok) {
          throw new Error('Failed to generate PDF')
        }
        
        const data = await response.json()
        
        // Convert data URI to blob and download
        const pdfData = data.pdf.split(',')[1]
        const byteCharacters = atob(pdfData)
        const byteNumbers = new Array(byteCharacters.length)
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i)
        }
        const byteArray = new Uint8Array(byteNumbers)
        const blob = new Blob([byteArray], { type: 'application/pdf' })
        
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = data.filename || `ticket-${ticketId}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        a.remove()
        
        console.log('Downloaded simulated ticket:', ticketId)
        return
      }
      
      // For real tickets, try the regular download
      const response = await fetch('/api/tickets/download-with-template', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticketId: ticketId,
          format: 'pdf'
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = 'Failed to download ticket'
        try {
          const errorData = JSON.parse(errorText)
          errorMessage = errorData.error || errorMessage
        } catch {
          // If response is not JSON, use the text
          if (errorText) {
            errorMessage = errorText
          }
        }
        console.error('Download error details:', {
          status: response.status,
          statusText: response.statusText,
          error: errorMessage
        })
        throw new Error(`${errorMessage} (Status: ${response.status})`)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `enhanced-ticket-${ticketId}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error downloading ticket:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to download ticket'
      alert(errorMessage)
    } finally {
      setDownloadingTickets(prev => prev.filter(id => id !== ticketId))
    }
  }

  const downloadSelectedTickets = async () => {
    if (selectedTickets.length === 0) {
      alert('Please select tickets to download')
      return
    }

    setIsDownloading(true)
    try {
      // If 2 or more tickets, use bulk ZIP download
      if (selectedTickets.length >= 2) {
        console.log('Using bulk ZIP download for', selectedTickets.length, 'tickets')
        
        // Get the first selected ticket to find the event
        const firstTicket = generatedTickets.find(t => t.id === selectedTickets[0])
        const eventId = firstTicket?.event_id
        
        // Use chunked download for large quantities
        const endpoint = selectedTickets.length > 100 
          ? '/api/tickets/download-bulk-chunked' 
          : '/api/tickets/download-bulk-enhanced'
        
        console.log(`Using ${selectedTickets.length > 100 ? 'chunked' : 'standard'} bulk download for ${selectedTickets.length} tickets`)
        
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ticketIds: selectedTickets,
            eventId: eventId,
            template: ticketTemplate
          })
        })

        if (!response.ok) {
          throw new Error('Failed to download tickets as ZIP')
        }

        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `tickets-bulk-${Date.now()}.zip`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        
        alert(`✅ Downloaded ${selectedTickets.length} tickets as ZIP file`)
      } else {
        // For fewer tickets, download individually
        for (const ticketId of selectedTickets) {
          await downloadTicket(ticketId)
          // Small delay between downloads
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }
      setSelectedTickets([])
    } catch (error) {
      console.error('Error downloading tickets:', error)
      alert('Failed to download some tickets')
    } finally {
      setIsDownloading(false)
    }
  }

  const deleteTicket = async (ticketId: string) => {
    if (!confirm('Are you sure you want to delete this ticket?')) return

    try {
      // Delete from database
      const { error } = await supabase
        .from('tickets')
        .delete()
        .eq('id', ticketId)

      if (error) {
        throw error
      }

      // Update local state
      setGeneratedTickets(prev => prev.filter(ticket => ticket.id !== ticketId))
      setSelectedTickets(prev => prev.filter(id => id !== ticketId))
      
      console.log('Ticket deleted successfully')
    } catch (error) {
      console.error('Error deleting ticket:', error)
      alert('Failed to delete ticket')
    }
  }

  const toggleTicketSelection = (ticketId: string) => {
    setSelectedTickets(prev => 
      prev.includes(ticketId) 
        ? prev.filter(id => id !== ticketId)
        : [...prev, ticketId]
    )
  }

  const selectAllTickets = () => {
    const filteredTicketIds = filteredTickets.map(ticket => ticket.id)
    setSelectedTickets(filteredTicketIds)
  }

  const clearSelection = () => {
    setSelectedTickets([])
  }





  const tabs = [
    { id: 'generate', label: 'Generate Tickets', icon: Plus },
    { id: 'tickets', label: 'Generated Tickets', icon: Ticket }
  ]

  if (authLoading || !isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0b6d41] mx-auto"></div>
          <p className="mt-4 text-gray-600">{authLoading ? 'Checking permissions...' : 'Admin access required'}</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0b6d41] mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading events...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-[#ffde59] to-[#f5c842] rounded-lg">
                <Ticket className="h-6 w-6 text-[#0b6d41]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Enhanced Ticket Generator
                </h1>
                <p className="text-gray-600">
                  Create professional tickets with custom branding and QR codes
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="mb-8">
          <nav className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-[#0b6d41] text-white'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Generate Tickets Tab */}
        {activeTab === 'generate' && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Generate Enhanced Tickets
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Event Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Event
                </label>
                <select
                  value={selectedEvent}
                  onChange={(e) => setSelectedEvent(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0b6d41] focus:border-[#0b6d41]"
                >
                  <option value="">Choose an event...</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.title} - {new Date(event.date).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Tickets
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={ticketQuantity}
                  onChange={(e) => setTicketQuantity(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0b6d41] focus:border-[#0b6d41]"
                />
              </div>
            </div>

            {/* Auto-download option */}
            <div className="mt-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={autoDownload}
                  onChange={(e) => setAutoDownload(e.target.checked)}
                  className="mr-2 h-4 w-4 text-[#0b6d41] rounded focus:ring-[#0b6d41]"
                />
                <span className="text-sm text-gray-700">
                  Automatically download tickets after generation
                </span>
              </label>
            </div>

            {/* Generate Button */}
            <div className="mt-6">
              <button
                onClick={generateEnhancedTickets}
                disabled={generating || !selectedEvent}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#0b6d41] to-[#15a862] text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
              >
                {generating ? (
                  <>
                    {/* Ticket Machine Animation */}
                    <div className="flex items-center gap-3">
                      {/* Machine Body */}
                      <div className="relative">
                        <div className="w-8 h-6 bg-gray-300 rounded border-2 border-gray-400 relative overflow-hidden">
                          {/* Machine slot */}
                          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-4 h-1 bg-gray-600 rounded-sm"></div>
                          {/* Blinking light */}
                          <div className="absolute top-1 left-1 w-1 h-1 bg-green-400 rounded-full animate-pulse"></div>
                        </div>
                        {/* Ticket coming out */}
                        <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2">
                          <div className="ticket-printing w-3 h-8 bg-white border border-gray-300 rounded-sm shadow-sm"></div>
                        </div>
                      </div>
                      
                      {/* Processing dots */}
                      <div className="flex gap-1">
                        <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-1 h-1 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                    <span className="ml-2">{autoDownload ? 'Printing & Downloading...' : 'Printing Tickets...'}</span>
                  </>
                ) : (
                  <>
                    {autoDownload ? <Download className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                    {autoDownload ? 'Generate & Download Tickets' : 'Generate Tickets'}
                  </>
                )}
              </button>
            </div>

            {/* Add CSS for ticket printing animation */}
            <style jsx>{`
              .ticket-printing {
                animation: printTicket 2s infinite ease-in-out;
              }
              
              .mini-ticket-printing {
                animation: printMiniTicket 1.5s infinite ease-in-out;
              }
              
              .bulk-tickets-printing {
                animation: printBulkTickets 1.8s infinite ease-in-out;
              }
              
              @keyframes printTicket {
                0% {
                  transform: translateY(0) scale(1);
                  opacity: 0.3;
                }
                25% {
                  transform: translateY(-2px) scale(1.05);
                  opacity: 0.6;
                }
                50% {
                  transform: translateY(-4px) scale(1.1);
                  opacity: 1;
                }
                75% {
                  transform: translateY(-6px) scale(1.05);
                  opacity: 0.8;
                }
                100% {
                  transform: translateY(-8px) scale(1);
                  opacity: 0.4;
                }
              }
              
              @keyframes printMiniTicket {
                0% {
                  transform: translateY(0) scale(1);
                  opacity: 0.4;
                }
                50% {
                  transform: translateY(-1px) scale(1.1);
                  opacity: 1;
                }
                100% {
                  transform: translateY(-2px) scale(1);
                  opacity: 0.6;
                }
              }
              
              @keyframes printBulkTickets {
                0% {
                  transform: translateY(0) scale(1);
                  opacity: 0.5;
                }
                20% {
                  transform: translateY(-1px) scale(1.05);
                  opacity: 0.7;
                }
                40% {
                  transform: translateY(-2px) scale(1.1);
                  opacity: 1;
                }
                60% {
                  transform: translateY(-3px) scale(1.05);
                  opacity: 0.9;
                }
                80% {
                  transform: translateY(-4px) scale(1.02);
                  opacity: 0.7;
                }
                100% {
                  transform: translateY(-5px) scale(1);
                  opacity: 0.5;
                }
              }
            `}</style>
          </div>
        )}

        {/* Generated Tickets Tab */}

        {activeTab === 'tickets' && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Generated Tickets ({filteredTickets.length} of {generatedTickets.length})
                </h2>
                {(categoryFilter || eventFilter || searchTerm) && (
                  <p className="text-sm text-gray-500 mt-1">
                    Filtered by: {[
                      categoryFilter && `Category: ${categoryFilter}`,
                      eventFilter && `Event: ${eventFilter}`,
                      searchTerm && `Search: "${searchTerm}"`
                    ].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`px-3 py-2 text-sm rounded-lg flex items-center gap-2 ${
                    showFilters || categoryFilter || eventFilter || searchTerm
                      ? 'bg-[#0b6d41] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Filter className="h-4 w-4" />
                  Filters
                </button>
                <button
                  onClick={selectAllTickets}
                  className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Select All {filteredTickets.length !== generatedTickets.length ? `(${filteredTickets.length})` : ''}
                </button>
                <button
                  onClick={clearSelection}
                  className="px-3 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Clear
                </button>
                {selectedTickets.length > 0 && (
                  <button
                    onClick={downloadSelectedTickets}
                    disabled={isDownloading}
                    className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isDownloading ? (
                      <>
                        <div className="bulk-printer relative">
                          <div className="w-4 h-3 bg-white bg-opacity-20 rounded border border-white border-opacity-30 relative overflow-hidden">
                            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-2 h-0.5 bg-white bg-opacity-60 rounded-sm"></div>
                            <div className="absolute top-0.5 left-0.5 w-0.5 h-0.5 bg-green-300 rounded-full animate-pulse"></div>
                          </div>
                          <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2">
                            <div className="bulk-tickets-printing w-2 h-4 bg-white bg-opacity-90 border border-gray-300 rounded-sm"></div>
                          </div>
                        </div>
                        Printing {selectedTickets.length}...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        Download {selectedTickets.length}
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Filter Panel */}
            {showFilters && (
              <div className="bg-gray-50 rounded-lg p-4 mb-6 border">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Search */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Search Tickets
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search by ticket number, event, or category..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-[#0b6d41] focus:border-[#0b6d41]"
                      />
                    </div>
                  </div>

                  {/* Category Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Filter by Category
                    </label>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#0b6d41] focus:border-[#0b6d41]"
                    >
                      <option value="">All Categories</option>
                      {getUniqueCategories().map((category) => (
                        <option key={category} value={category}>
                          {category}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Event Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Filter by Event
                    </label>
                    <select
                      value={eventFilter}
                      onChange={(e) => setEventFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-[#0b6d41] focus:border-[#0b6d41]"
                    >
                      <option value="">All Events</option>
                      {getUniqueEvents().map((event) => (
                        <option key={event} value={event}>
                          {event}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Clear Filters Button */}
                {(categoryFilter || eventFilter || searchTerm) && (
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={clearFilters}
                      className="px-4 py-2 text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600 flex items-center gap-2"
                    >
                      <X className="h-4 w-4" />
                      Clear All Filters
                    </button>
                  </div>
                )}
              </div>
            )}

            {loadingTickets ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0b6d41] mx-auto mb-4"></div>
                <p className="text-gray-500">Loading tickets...</p>
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="text-center py-12">
                {generatedTickets.length === 0 ? (
                  <>
                    <Ticket className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No tickets generated yet</p>
                    <p className="text-sm text-gray-400">Generate some tickets to see them here</p>
                  </>
                ) : (
                  <>
                    <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No tickets match your filters</p>
                    <p className="text-sm text-gray-400">Try adjusting your search criteria</p>
                    <button
                      onClick={clearFilters}
                      className="mt-4 px-4 py-2 text-sm bg-[#0b6d41] text-white rounded-lg hover:bg-[#0a5a35]"
                    >
                      Clear Filters
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedTickets.includes(ticket.id)}
                          onChange={() => toggleTicketSelection(ticket.id)}
                          className="h-4 w-4 text-[#0b6d41] rounded focus:ring-[#0b6d41]"
                        />
                        <QrCode className="h-4 w-4 text-[#0b6d41]" />
                        <span className="font-mono text-sm text-gray-600">
                          {ticket.ticket_number}
                        </span>
                      </div>
                      
                      <div className="flex gap-1">
                        <button
                          onClick={() => downloadTicket(ticket.id)}
                          disabled={downloadingTickets.includes(ticket.id)}
                          className="p-1 text-green-600 hover:text-green-700 disabled:opacity-50 relative"
                          title={downloadingTickets.includes(ticket.id) ? 'Downloading...' : 'Download ticket'}
                        >
                          {downloadingTickets.includes(ticket.id) ? (
                            <div className="flex items-center justify-center">
                              <div className="mini-printer relative">
                                <div className="w-3 h-2 bg-green-600 rounded-sm border border-green-700 relative overflow-hidden">
                                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-0.5 bg-green-800 rounded-sm"></div>
                                </div>
                                <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2">
                                  <div className="mini-ticket-printing w-1 h-3 bg-white border border-gray-300 rounded-sm"></div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => deleteTicket(ticket.id)}
                          className="p-1 text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">
                          {ticket.event_title || 'Event Title'}
                        </p>
                        <p className="text-xs text-gray-500">
                          Generated: {new Date(ticket.created_at).toLocaleString()}
                        </p>
                      </div>
                      
                      {/* Category Badge */}
                      {ticket.event_category && (
                        <div className="flex items-center gap-1">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[#0b6d41] text-white">
                            {ticket.event_category}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

