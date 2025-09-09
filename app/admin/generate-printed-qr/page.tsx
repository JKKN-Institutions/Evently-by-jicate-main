'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { QrCode, Printer, Download, Plus, Trash2, CheckCircle, AlertCircle } from 'lucide-react'

interface PrintedTicket {
  id: string
  ticket_code: string
  qr_code: string
  event_id: string
  status: 'active' | 'used' | 'cancelled'
  created_at: string
  used_at?: string
  used_by?: string
  events?: {
    id: string
    title: string
    date: string
    venue: string
  }
}

export default function GeneratePrintedQRPage() {
  const [selectedEvent, setSelectedEvent] = useState('')
  const [events, setEvents] = useState<any[]>([])
  const [ticketQuantity, setTicketQuantity] = useState(1)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedTickets, setGeneratedTickets] = useState<PrintedTicket[]>([])
  const [existingTickets, setExistingTickets] = useState<PrintedTicket[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedTickets, setSelectedTickets] = useState<string[]>([])
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadingTickets, setDownloadingTickets] = useState<string[]>([])

  const supabase = createClient()

  // Load events on component mount
  useEffect(() => {
    loadEvents()
    loadExistingTickets()
  }, [])

  const loadEvents = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('events')
        .select('id, title, date, venue')
        .eq('organizer_id', user.id)
        .order('date', { ascending: true })

      if (error) throw error
      setEvents(data || [])
    } catch (error) {
      console.error('Error loading events:', error)
    }
  }

  const loadExistingTickets = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('printed_tickets')
        .select(`
          *,
          events!inner (
            id,
            title,
            date,
            venue
          )
        `)
        .order('created_at', { ascending: false })

      if (error) {
        // If table doesn't exist, just set empty array
        if (error.code === 'PGRST116' || error.message.includes('does not exist')) {
          console.warn('Printed tickets table does not exist yet. Please run the database schema.')
          setExistingTickets([])
          return
        }
        throw error
      }
      console.log('Loaded existing tickets:', data)
      setExistingTickets(data || [])
    } catch (error) {
      console.error('Error loading existing tickets:', error)
      setExistingTickets([]) // Set empty array on error
    } finally {
      setIsLoading(false)
    }
  }

  const generatePrintedTickets = async () => {
    if (!selectedEvent || ticketQuantity < 1) {
      alert('Please select an event and specify quantity')
      return
    }

    setIsGenerating(true)
    try {
      const response = await fetch('/api/printed-tickets/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event_id: selectedEvent,
          quantity: ticketQuantity
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate tickets')
      }

      const { tickets } = await response.json()
      setGeneratedTickets(tickets)
      await loadExistingTickets() // Refresh the list
      
      alert(`Successfully generated ${tickets.length} printed tickets!`)
    } catch (error) {
      console.error('Error generating tickets:', error)
      alert('Failed to generate tickets. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const downloadQRCodes = async (ticketIds?: string[]) => {
    const idsToDownload = ticketIds || generatedTickets.map(t => t.id)
    if (idsToDownload.length === 0) return

    try {
      setIsDownloading(true)
      
      // If multiple tickets, still use ZIP
      if (idsToDownload.length > 1) {
        const response = await fetch('/api/printed-tickets/download', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ticket_ids: idsToDownload,
            format: 'zip'
          })
        })

        if (!response.ok) throw new Error('Failed to download QR codes')

        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `printed-tickets-${new Date().toISOString().split('T')[0]}.zip`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        // Single ticket - download as PNG
        await downloadSingleTicketPNG(idsToDownload[0])
      }
    } catch (error) {
      console.error('Error downloading QR codes:', error)
      alert('Failed to download QR codes')
    } finally {
      setIsDownloading(false)
    }
  }

  const downloadSingleTicketPNG = async (ticketId: string) => {
    try {
      setDownloadingTickets(prev => [...prev, ticketId])
      const response = await fetch(`/api/printed-tickets/download-png/${ticketId}`, {
        method: 'GET'
      })

      if (!response.ok) throw new Error('Failed to download QR code')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      
      // Get ticket info for filename
      const ticket = existingTickets.find(t => t.id === ticketId) || generatedTickets.find(t => t.id === ticketId)
      const filename = ticket ? `${ticket.ticket_code}.png` : `ticket-${ticketId}.png`
      
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error downloading PNG:', error)
      alert('Failed to download QR code')
    } finally {
      setDownloadingTickets(prev => prev.filter(id => id !== ticketId))
    }
  }

  const downloadSingleTicket = async (ticketId: string) => {
    await downloadSingleTicketPNG(ticketId)
  }

  const downloadSelectedTickets = async () => {
    if (selectedTickets.length === 0) {
      alert('Please select tickets to download')
      return
    }
    
    if (selectedTickets.length === 1) {
      // Single ticket - download as PNG
      await downloadSingleTicketPNG(selectedTickets[0])
    } else {
      // Multiple tickets - download as ZIP
      await downloadQRCodes(selectedTickets)
    }
    setSelectedTickets([]) // Clear selection after download
  }

  const toggleTicketSelection = (ticketId: string) => {
    setSelectedTickets(prev => 
      prev.includes(ticketId) 
        ? prev.filter(id => id !== ticketId)
        : [...prev, ticketId]
    )
  }

  const selectAllTickets = () => {
    const activeTickets = existingTickets.filter(t => t.status === 'active')
    setSelectedTickets(activeTickets.map(t => t.id))
  }

  const clearSelection = () => {
    setSelectedTickets([])
  }

  const deleteTicket = async (ticketId: string) => {
    if (!confirm('Are you sure you want to delete this ticket?')) return

    try {
      const { error } = await supabase
        .from('printed_tickets')
        .delete()
        .eq('id', ticketId)

      if (error) throw error
      
      await loadExistingTickets()
      alert('Ticket deleted successfully')
    } catch (error) {
      console.error('Error deleting ticket:', error)
      alert('Failed to delete ticket')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Printer className="h-7 w-7 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Generate Printed Ticket QR Codes</h1>
              <p className="text-gray-600">Create QR codes for physical tickets that can be scanned at events</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Generation Form */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Generate New QR Codes
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Event
                </label>
                <select
                  value={selectedEvent}
                  onChange={(e) => setSelectedEvent(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Choose an event...</option>
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.title} - {new Date(event.date).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of Tickets
                </label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={ticketQuantity}
                  onChange={(e) => setTicketQuantity(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Enter quantity"
                />
              </div>

              <button
                onClick={generatePrintedTickets}
                disabled={isGenerating || !selectedEvent}
                className="w-full bg-purple-600 text-white py-3 px-4 rounded-md font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Generating...
                  </>
                ) : (
                  <>
                    <QrCode className="h-4 w-4" />
                    Generate QR Codes
                  </>
                )}
              </button>
            </div>

            {/* Generated Tickets Preview */}
            {generatedTickets.length > 0 && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-md">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-green-800">
                    ✅ Generated {generatedTickets.length} tickets
                  </h3>
                  <button
                    onClick={() => downloadQRCodes()}
                    disabled={isDownloading}
                    className="bg-green-600 text-white px-4 py-2 rounded-md text-sm hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    {isDownloading ? 'Downloading...' : generatedTickets.length === 1 ? 'Download PNG' : 'Download ZIP'}
                  </button>
                </div>
                <div className="text-sm text-green-700">
                  <p>Ticket codes: {generatedTickets.map(t => t.ticket_code).join(', ')}</p>
                </div>
              </div>
            )}
          </div>

          {/* Existing Tickets */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <QrCode className="h-5 w-5" />
                Existing Printed Tickets
              </h2>
              
              {existingTickets.length > 0 && (
                <div className="flex items-center gap-2">
                  {selectedTickets.length > 0 && (
                    <>
                      <span className="text-sm text-gray-600">
                        {selectedTickets.length} selected
                      </span>
                      <button
                        onClick={downloadSelectedTickets}
                        disabled={isDownloading}
                        className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
                      >
                        <Download className="h-3 w-3" />
                        {isDownloading ? 'Downloading...' : selectedTickets.length === 1 ? 'Download PNG' : 'Download ZIP'}
                      </button>
                      <button
                        onClick={clearSelection}
                        className="bg-gray-500 text-white px-3 py-1 rounded text-sm hover:bg-gray-600"
                      >
                        Clear
                      </button>
                    </>
                  )}
                  <button
                    onClick={selectedTickets.length === 0 ? selectAllTickets : clearSelection}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                  >
                    {selectedTickets.length === 0 ? 'Select All' : 'Clear All'}
                  </button>
                </div>
              )}
            </div>

            {isLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                <p className="text-gray-600 mt-2">Loading tickets...</p>
              </div>
            ) : existingTickets.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <QrCode className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No printed tickets generated yet</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {existingTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className={`p-3 border rounded-md transition-colors ${
                      selectedTickets.includes(ticket.id)
                        ? 'border-blue-500 bg-blue-50'
                        : ticket.status === 'used' 
                        ? 'bg-gray-50 border-gray-200' 
                        : ticket.status === 'cancelled'
                        ? 'bg-red-50 border-red-200'
                        : 'bg-white border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        {ticket.status === 'active' && (
                          <input
                            type="checkbox"
                            checked={selectedTickets.includes(ticket.id)}
                            onChange={() => toggleTicketSelection(ticket.id)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                        )}
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-sm font-semibold">
                              {ticket.ticket_code}
                            </span>
                            {ticket.status === 'used' ? (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            ) : ticket.status === 'cancelled' ? (
                              <AlertCircle className="h-4 w-4 text-red-500" />
                            ) : (
                              <QrCode className="h-4 w-4 text-blue-500" />
                            )}
                          </div>
                          <p className="text-sm text-gray-600">
                            {ticket.events?.title || 'Unknown Event'}
                          </p>
                          {ticket.events?.venue && (
                            <p className="text-xs text-gray-500">
                              📍 {ticket.events.venue}
                            </p>
                          )}
                          <p className="text-xs text-gray-500">
                            Created: {new Date(ticket.created_at).toLocaleString()}
                            {ticket.used_at && (
                              <span className="ml-2">
                                • Used: {new Date(ticket.used_at).toLocaleString()}
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {ticket.status === 'active' && (
                          <>
                            <button
                              onClick={() => downloadSingleTicket(ticket.id)}
                              disabled={downloadingTickets.includes(ticket.id)}
                              className="text-green-600 hover:text-green-700 p-1 disabled:opacity-50"
                              title="Download this ticket"
                            >
                              {downloadingTickets.includes(ticket.id) ? (
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600"></div>
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              onClick={() => deleteTicket(ticket.id)}
                              className="text-red-500 hover:text-red-700 p-1"
                              title="Delete ticket"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

            
      </div>
    </div>
  )
}
