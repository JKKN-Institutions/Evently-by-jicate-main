'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { 
  ArrowLeft, 
  Upload, 
  Eye, 
  Trash2, 
  Plus, 
  QrCode, 
  Image as ImageIcon, 
  Ticket, 
  X, 
  Loader2,
  Save,
  Edit,
  Check,
  AlertCircle,
  Layers,
  Tag
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface CustomTicketType {
  id: string
  name: string
  level: 'Gold' | 'Silver' | 'Bronze' | 'Platinum' | 'Standard'
  color: string
  price?: number
  benefits?: string[]
}

interface PredefinedTicket {
  id: string
  name: string
  description: string
  template_url: string
  qr_position: {
    x: number
    y: number
    size: number
  }
  ticket_type: string // Now accepts custom types
  ticket_level: 'Gold' | 'Silver' | 'Bronze' | 'Platinum' | 'Standard'
  event_id: string
  event_name?: string
  event_category?: string
  created_at: string
}

interface Event {
  id: string
  title: string
  category: string
  start_date: string
  venue: string
}

// Predefined ticket types with customization
const DEFAULT_TICKET_TYPES: CustomTicketType[] = [
  { id: '1', name: 'VIP Access', level: 'Gold', color: 'from-yellow-400 to-yellow-600', price: 500 },
  { id: '2', name: 'Premium', level: 'Silver', color: 'from-gray-300 to-gray-500', price: 300 },
  { id: '3', name: 'General Admission', level: 'Bronze', color: 'from-orange-400 to-orange-600', price: 100 },
  { id: '4', name: 'Early Bird', level: 'Standard', color: 'from-blue-400 to-blue-600', price: 80 },
  { id: '5', name: 'Student', level: 'Standard', color: 'from-green-400 to-green-600', price: 50 },
]

// Predefined categories
const EVENT_CATEGORIES = [
  'Music & Concerts',
  'Sports & Fitness', 
  'Technology & Innovation',
  'Business & Networking',
  'Arts & Culture',
  'Education & Workshops',
  'Food & Dining',
  'Entertainment',
  'Community & Social',
  'Health & Wellness'
]

export default function PredefinedTicketsV2Page() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const eventIdFromUrl = searchParams.get('event_id')
  
  const [tickets, setTickets] = useState<PredefinedTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [customTicketTypes, setCustomTicketTypes] = useState<CustomTicketType[]>(DEFAULT_TICKET_TYPES)
  const [showAddTicketType, setShowAddTicketType] = useState(false)
  const [newTicketType, setNewTicketType] = useState({
    name: '',
    level: 'Bronze' as any,
    price: 0
  })
  
  // Form states
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [ticketName, setTicketName] = useState('')
  const [ticketDescription, setTicketDescription] = useState('')
  const [selectedTicketType, setSelectedTicketType] = useState<CustomTicketType | null>(null)
  const [qrPosition, setQrPosition] = useState({ x: 550, y: 950, size: 180 })
  const [uploading, setUploading] = useState(false)
  
  const supabase = createClient()

  useEffect(() => {
    checkAuth()
    loadEvents()
    if (eventIdFromUrl) {
      loadEventDetails(eventIdFromUrl)
    } else {
      setLoading(false) // Stop loading if no event selected
    }
  }, [eventIdFromUrl])

  useEffect(() => {
    if (selectedEvent) {
      loadTickets()
    }
  }, [selectedEvent])

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

  const loadEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('id, title, category, start_date, venue')
        .order('start_date', { ascending: false })

      if (error) {
        console.error('Error loading events:', error)
      } else if (data) {
        setEvents(data)
      }
    } catch (err) {
      console.error('Failed to load events:', err)
    }
  }

  const loadEventDetails = async (eventId: string) => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single()

      if (error) {
        console.error('Error loading event details:', error)
        setLoading(false)
      } else if (data) {
        setSelectedEvent(data)
      }
    } catch (err) {
      console.error('Failed to load event details:', err)
      setLoading(false)
    }
  }

  const loadTickets = async () => {
    if (!selectedEvent) {
      setLoading(false)
      return
    }
    
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('predefined_tickets')
        .select('*')
        .eq('event_id', selectedEvent.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading tickets:', error)
        setTickets([])
      } else if (data) {
        setTickets(data)
      }
    } catch (err) {
      console.error('Failed to load tickets:', err)
      setTickets([])
    } finally {
      setLoading(false)
    }
  }

  const handleAddCustomTicketType = () => {
    if (!newTicketType.name) return

    const newType: CustomTicketType = {
      id: Date.now().toString(),
      name: newTicketType.name,
      level: newTicketType.level,
      color: getColorForLevel(newTicketType.level),
      price: newTicketType.price
    }

    setCustomTicketTypes([...customTicketTypes, newType])
    setNewTicketType({ name: '', level: 'Bronze', price: 0 })
    setShowAddTicketType(false)
  }

  const getColorForLevel = (level: string) => {
    switch (level) {
      case 'Gold': return 'from-yellow-400 to-yellow-600'
      case 'Silver': return 'from-gray-300 to-gray-500'
      case 'Bronze': return 'from-orange-400 to-orange-600'
      case 'Platinum': return 'from-purple-400 to-purple-600'
      default: return 'from-blue-400 to-blue-600'
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile || !ticketName || !selectedEvent || !selectedTicketType) {
      alert('Please fill all required fields')
      return
    }

    setUploading(true)
    try {
      // Convert file to base64
      const reader = new FileReader()
      reader.onloadend = async () => {
        const base64 = reader.result as string

        // Save to database
        const { error } = await supabase
          .from('predefined_tickets')
          .insert({
            name: ticketName,
            description: ticketDescription,
            template_url: base64,
            qr_position: qrPosition,
            ticket_type: selectedTicketType.name,
            ticket_level: selectedTicketType.level,
            event_id: selectedEvent.id
          })

        if (error) {
          console.error('Error saving ticket:', error)
          alert('Error saving ticket template')
        } else {
          alert('Ticket template saved successfully!')
          setShowUploadForm(false)
          resetForm()
          loadTickets()
        }
        setUploading(false)
      }
      reader.readAsDataURL(selectedFile)
    } catch (error) {
      console.error('Error:', error)
      alert('Error uploading template')
      setUploading(false)
    }
  }

  const resetForm = () => {
    setSelectedFile(null)
    setPreviewUrl('')
    setTicketName('')
    setTicketDescription('')
    setSelectedTicketType(null)
    setQrPosition({ x: 550, y: 950, size: 180 })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this ticket template?')) return

    const { error } = await supabase
      .from('predefined_tickets')
      .delete()
      .eq('id', id)

    if (!error) {
      loadTickets()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#0b6d41]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/admin" className="text-2xl font-bold text-[#0b6d41]">
                Predefined Tickets
              </Link>
              {selectedEvent && (
                <>
                  <div className="h-6 w-px bg-gray-300"></div>
                  <div className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">{selectedEvent.title}</span>
                    <span className="px-2 py-0.5 bg-[#0b6d41]/10 text-[#0b6d41] text-xs rounded-full">
                      {selectedEvent.category}
                    </span>
                  </div>
                </>
              )}
            </div>
            <Link
              href="/admin"
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-gray-700 to-gray-800 rounded-lg hover:from-gray-800 hover:to-gray-900 transition-all shadow-md"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Event Selection if not from URL */}
        {!selectedEvent && (
          <div className="mb-8 bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Select Event</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {events.map(event => (
                <button
                  key={event.id}
                  onClick={() => setSelectedEvent(event)}
                  className="p-4 border-2 border-gray-200 rounded-lg hover:border-[#0b6d41] hover:shadow-md transition-all text-left"
                >
                  <div className="font-semibold">{event.title}</div>
                  <div className="text-sm text-gray-500 mt-1">{event.category}</div>
                  <div className="text-xs text-gray-400 mt-2">
                    {new Date(event.start_date).toLocaleDateString()} • {event.venue}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedEvent && (
          <>
            {/* Custom Ticket Types Section */}
            <div className="mb-8 bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Ticket Types</h2>
                <button
                  onClick={() => setShowAddTicketType(true)}
                  className="inline-flex items-center px-3 py-1.5 text-sm bg-[#0b6d41] text-white rounded-lg hover:bg-[#0a5835] transition-all"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Custom Type
                </button>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                {customTicketTypes.map(type => (
                  <div
                    key={type.id}
                    className={`p-3 rounded-lg bg-gradient-to-r ${type.color} text-white text-center`}
                  >
                    <div className="font-bold">{type.name}</div>
                    <div className="text-xs opacity-90">{type.level}</div>
                    {type.price && <div className="text-sm mt-1">${type.price}</div>}
                  </div>
                ))}
              </div>

              {/* Add Custom Type Modal */}
              {showAddTicketType && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg p-6 max-w-md w-full">
                    <h3 className="text-lg font-semibold mb-4">Add Custom Ticket Type</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">Type Name</label>
                        <input
                          type="text"
                          value={newTicketType.name}
                          onChange={(e) => setNewTicketType({...newTicketType, name: e.target.value})}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#0b6d41]"
                          placeholder="e.g., VIP Access, Student Pass"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Level</label>
                        <select
                          value={newTicketType.level}
                          onChange={(e) => setNewTicketType({...newTicketType, level: e.target.value as any})}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#0b6d41]"
                        >
                          <option value="Platinum">Platinum</option>
                          <option value="Gold">Gold</option>
                          <option value="Silver">Silver</option>
                          <option value="Bronze">Bronze</option>
                          <option value="Standard">Standard</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">Price (Optional)</label>
                        <input
                          type="number"
                          value={newTicketType.price}
                          onChange={(e) => setNewTicketType({...newTicketType, price: Number(e.target.value)})}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#0b6d41]"
                          placeholder="0"
                        />
                      </div>
                    </div>
                    <div className="flex gap-3 mt-6">
                      <button
                        onClick={handleAddCustomTicketType}
                        className="flex-1 px-4 py-2 bg-[#0b6d41] text-white rounded-lg hover:bg-[#0a5835]"
                      >
                        Add Type
                      </button>
                      <button
                        onClick={() => setShowAddTicketType(false)}
                        className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="mb-8 flex gap-4">
              <button
                onClick={() => setShowUploadForm(true)}
                className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-[#0b6d41] to-[#0a5835] text-white rounded-lg hover:shadow-lg transition-all"
              >
                <Upload className="h-5 w-5 mr-2" />
                Upload New Template
              </button>
            </div>

            {/* Upload Form */}
            {showUploadForm && (
              <div className="mb-8 bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold">Upload Ticket Template</h2>
                  <button
                    onClick={() => {
                      setShowUploadForm(false)
                      resetForm()
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Template Name *</label>
                      <input
                        type="text"
                        value={ticketName}
                        onChange={(e) => setTicketName(e.target.value)}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#0b6d41]"
                        placeholder="e.g., Premium Concert Ticket"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Description</label>
                      <textarea
                        value={ticketDescription}
                        onChange={(e) => setTicketDescription(e.target.value)}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#0b6d41]"
                        rows={3}
                        placeholder="Brief description of the ticket template"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Ticket Type *</label>
                      <select
                        value={selectedTicketType?.id || ''}
                        onChange={(e) => {
                          const type = customTicketTypes.find(t => t.id === e.target.value)
                          setSelectedTicketType(type || null)
                        }}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#0b6d41]"
                      >
                        <option value="">Select a ticket type</option>
                        {customTicketTypes.map(type => (
                          <option key={type.id} value={type.id}>
                            {type.name} ({type.level})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Upload Template Image *</label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#0b6d41]"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">QR Code Position</label>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-xs">X</label>
                          <input
                            type="number"
                            value={qrPosition.x}
                            onChange={(e) => setQrPosition({...qrPosition, x: Number(e.target.value)})}
                            className="w-full px-2 py-1 border rounded"
                          />
                        </div>
                        <div>
                          <label className="text-xs">Y</label>
                          <input
                            type="number"
                            value={qrPosition.y}
                            onChange={(e) => setQrPosition({...qrPosition, y: Number(e.target.value)})}
                            className="w-full px-2 py-1 border rounded"
                          />
                        </div>
                        <div>
                          <label className="text-xs">Size</label>
                          <input
                            type="number"
                            value={qrPosition.size}
                            onChange={(e) => setQrPosition({...qrPosition, size: Number(e.target.value)})}
                            className="w-full px-2 py-1 border rounded"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    {previewUrl && (
                      <div>
                        <label className="block text-sm font-medium mb-2">Preview</label>
                        <div className="relative border rounded-lg overflow-hidden">
                          <img src={previewUrl} alt="Template preview" className="w-full" />
                          <div 
                            className="absolute border-2 border-red-500"
                            style={{
                              left: `${qrPosition.x / 10}%`,
                              top: `${qrPosition.y / 10}%`,
                              width: `${qrPosition.size / 10}%`,
                              height: `${qrPosition.size / 10}%`
                            }}
                          >
                            <div className="w-full h-full bg-black/20 flex items-center justify-center">
                              <QrCode className="h-8 w-8 text-white" />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowUploadForm(false)
                      resetForm()
                    }}
                    className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={uploading || !selectedFile || !ticketName || !selectedTicketType}
                    className="px-6 py-2 bg-[#0b6d41] text-white rounded-lg hover:bg-[#0a5835] disabled:opacity-50"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 inline mr-2" />
                        Save Template
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Tickets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tickets.map(ticket => (
                <div key={ticket.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-all">
                  <div className="aspect-[3/4] relative overflow-hidden rounded-t-lg">
                    <img
                      src={ticket.template_url}
                      alt={ticket.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2">
                      <span className={`px-3 py-1 bg-gradient-to-r ${
                        ticket.ticket_level === 'Gold' ? 'from-yellow-400 to-yellow-600' :
                        ticket.ticket_level === 'Silver' ? 'from-gray-300 to-gray-500' :
                        ticket.ticket_level === 'Bronze' ? 'from-orange-400 to-orange-600' :
                        ticket.ticket_level === 'Platinum' ? 'from-purple-400 to-purple-600' :
                        'from-blue-400 to-blue-600'
                      } text-white text-xs font-bold rounded-full shadow-md`}>
                        {ticket.ticket_type}
                      </span>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-lg mb-1">{ticket.name}</h3>
                    <p className="text-sm text-gray-600 mb-3">{ticket.description}</p>
                    <div className="flex justify-between items-center">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {/* Preview logic */}}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(ticket.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {tickets.length === 0 && (
              <div className="text-center py-12 bg-white rounded-lg">
                <Ticket className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No predefined tickets yet</p>
                <p className="text-sm text-gray-400 mt-2">Upload a template to get started</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}