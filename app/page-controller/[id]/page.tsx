'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { useParams, useRouter } from 'next/navigation'
import { 
  Plus, Edit, Trash2, Users, Calendar, MapPin, Eye, UserCheck, 
  Shield, Clock, DollarSign, ArrowLeft, Settings, Upload, UserPlus,
  Activity, Ticket, TrendingUp
} from 'lucide-react'
import { EventPage, ChildEvent, EventControllerView } from '@/types/event-pages'
import { uploadEventImage } from '@/lib/supabase/storage-helper'
import Link from 'next/link'

export default function PageControllerManagement() {
  const { id } = useParams()
  const router = useRouter()
  const { profile, user } = useAuth()
  const [eventPage, setEventPage] = useState<EventPage | null>(null)
  const [childEvents, setChildEvents] = useState<ChildEvent[]>([])
  const [eventControllers, setEventControllers] = useState<EventControllerView[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateEventModal, setShowCreateEventModal] = useState(false)
  const [showAssignControllerModal, setShowAssignControllerModal] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<ChildEvent | null>(null)
  const [hasPermission, setHasPermission] = useState(false)
  const [stats, setStats] = useState({
    totalEvents: 0,
    upcomingEvents: 0,
    totalCapacity: 0,
    totalTicketsSold: 0
  })
  const supabase = createClient()

  useEffect(() => {
    if (!profile) return
    checkPermissionAndFetch()
  }, [id, profile])

  const checkPermissionAndFetch = async () => {
    if (!profile?.id) return

    try {
      // Check if user is page controller for this page
      const { data: permission } = await supabase.rpc('check_page_permission', {
        p_user_id: profile.id,
        p_page_id: id
      })

      if (permission === 'page_controller' || permission === 'admin') {
        setHasPermission(true)
        await Promise.all([
          fetchEventPage(),
          fetchChildEvents(),
          fetchEventControllers(),
          fetchStats()
        ])
      } else {
        // No permission - redirect back
        router.push('/page-controller')
      }
    } catch (error) {
      console.error('Error checking permissions:', error)
      router.push('/page-controller')
    } finally {
      setLoading(false)
    }
  }

  const fetchEventPage = async () => {
    try {
      const { data, error } = await supabase
        .from('event_pages')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      setEventPage(data)
    } catch (error) {
      console.error('Error fetching event page:', error)
    }
  }

  const fetchChildEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('event_page_id', id)
        .order('start_date', { ascending: true })

      if (error) throw error
      setChildEvents(data || [])
    } catch (error) {
      console.error('Error fetching child events:', error)
    }
  }

  const fetchEventControllers = async () => {
    try {
      const { data, error } = await supabase
        .from('event_controllers_view')
        .select('*')
        .eq('event_page_id', id)

      if (error) throw error
      setEventControllers(data || [])
    } catch (error) {
      console.error('Error fetching event controllers:', error)
    }
  }

  const fetchStats = async () => {
    try {
      const { data: events } = await supabase
        .from('events')
        .select('id, start_date, max_attendees')
        .eq('event_page_id', id)

      if (events) {
        const totalEvents = events.length
        const upcomingEvents = events.filter(e => new Date(e.start_date) >= new Date()).length
        const totalCapacity = events.reduce((sum, e) => sum + (e.max_attendees || 0), 0)

        // Fetch ticket stats
        const eventIds = events.map(e => e.id)
        const { data: tickets } = await supabase
          .from('tickets')
          .select('id')
          .in('event_id', eventIds)

        setStats({
          totalEvents,
          upcomingEvents,
          totalCapacity,
          totalTicketsSold: tickets?.length || 0
        })
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const getEventController = (eventId: string) => {
    return eventControllers.find(ec => ec.event_id === eventId)
  }

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return

    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId)

      if (error) throw error
      fetchChildEvents()
    } catch (error) {
      console.error('Error deleting event:', error)
      alert('Failed to delete event')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0b6d41]"></div>
      </div>
    )
  }

  if (!hasPermission) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <Shield className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-red-800 mb-2">Access Denied</h3>
          <p className="text-red-600">You don't have permission to manage this event page.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link 
          href="/page-controller" 
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{eventPage?.title}</h1>
            <p className="mt-2 text-gray-600">{eventPage?.description}</p>
            {eventPage?.location && (
              <div className="flex items-center gap-2 mt-2 text-gray-500">
                <MapPin className="h-4 w-4" />
                <span>{eventPage.location}</span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowCreateEventModal(true)}
              className="flex items-center gap-2 bg-[#0b6d41] text-white px-4 py-2 rounded-lg hover:bg-[#0a5d37] transition-colors"
            >
              <Plus className="h-5 w-5" />
              Add Event
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Events</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalEvents}</p>
            </div>
            <Calendar className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Upcoming</p>
              <p className="text-2xl font-bold text-gray-900">{stats.upcomingEvents}</p>
            </div>
            <Clock className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Capacity</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalCapacity.toLocaleString()}</p>
            </div>
            <Users className="h-8 w-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Tickets Sold</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalTicketsSold}</p>
            </div>
            <Ticket className="h-8 w-8 text-orange-500" />
          </div>
        </div>
      </div>

      {/* Child Events */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Child Events</h2>
          <span className="text-gray-500">{childEvents.length} events</span>
        </div>

        {childEvents.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Events Yet</h3>
            <p className="text-gray-600 mb-4">Start building your event page by adding child events</p>
            <button
              onClick={() => setShowCreateEventModal(true)}
              className="inline-flex items-center gap-2 bg-[#0b6d41] text-white px-4 py-2 rounded-lg hover:bg-[#0a5d37] transition-colors"
            >
              <Plus className="h-5 w-5" />
              Add First Event
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {childEvents.map((event) => {
              const controller = getEventController(event.id)
              const isUpcoming = new Date(event.start_date) >= new Date()
              
              return (
                <div key={event.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                  {/* Event Banner */}
                  <div className="h-48 overflow-hidden bg-gray-100">
                    <img 
                      src={event.image_url || `/api/events/${event.id}/image`} 
                      alt={event.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        if (!target.src.endsWith('/placeholder-event.svg')) {
                          target.src = '/placeholder-event.svg'
                        }
                      }}
                    />
                  </div>

                  <div className="p-5">
                    <h3 className="font-bold text-lg text-gray-900 mb-2">{event.title}</h3>
                    
                    {event.description && (
                      <p className="text-gray-600 text-sm mb-3 line-clamp-2">{event.description}</p>
                    )}

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-gray-500">
                        <Calendar className="h-4 w-4" />
                        <span>{new Date(event.start_date).toLocaleDateString()}</span>
                        {event.time && <span>at {event.time}</span>}
                      </div>
                      
                      <div className="flex items-center gap-2 text-gray-500">
                        <MapPin className="h-4 w-4" />
                        <span>{event.venue}</span>
                      </div>

                      {event.price > 0 && (
                        <div className="flex items-center gap-2 text-gray-500">
                          <DollarSign className="h-4 w-4" />
                          <span>₹{event.price}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-gray-500">
                        <Users className="h-4 w-4" />
                        <span>{event.max_attendees} capacity</span>
                      </div>
                    </div>

                    {/* Event Controller Badge */}
                    {controller ? (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-4 w-4 text-[#0b6d41]" />
                          <span className="text-sm text-gray-600">
                            Managed by <strong>{controller.controller_name}</strong>
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <button
                          onClick={() => {
                            setSelectedEvent(event)
                            setShowAssignControllerModal(true)
                          }}
                          className="flex items-center gap-2 text-sm text-[#0b6d41] hover:text-[#0a5d37] font-medium"
                        >
                          <UserPlus className="h-4 w-4" />
                          Assign Controller
                        </button>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 mt-4">
                      <Link
                        href={`/events/${event.id}`}
                        className="flex-1 text-center py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => {
                          setSelectedEvent(event)
                          setShowAssignControllerModal(true)
                        }}
                        className="flex-1 text-center py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                      >
                        {controller ? 'Reassign' : 'Assign'}
                      </button>
                      <button
                        onClick={() => handleDeleteEvent(event.id)}
                        className="px-3 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Event Controllers Section */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Event Controllers</h2>
          <span className="text-gray-500">{eventControllers.length} assigned</span>
        </div>

        {eventControllers.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border p-6 text-center">
            <UserCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No event controllers assigned yet</p>
            <p className="text-sm text-gray-500 mt-2">Assign controllers to individual events above</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Controller
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Event
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {eventControllers.map((controller) => (
                  <tr key={controller.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {controller.controller_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {controller.controller_email}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{controller.event_title}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-500">
                        {new Date(controller.assigned_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <Activity className="h-3 w-3" />
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Event Modal */}
      {showCreateEventModal && (
        <CreateChildEventModal
          eventPageId={id as string}
          onClose={() => setShowCreateEventModal(false)}
          onSuccess={() => {
            setShowCreateEventModal(false)
            fetchChildEvents()
            fetchStats()
          }}
        />
      )}

      {/* Assign Controller Modal */}
      {showAssignControllerModal && selectedEvent && (
        <AssignEventControllerModal
          event={selectedEvent}
          onClose={() => {
            setShowAssignControllerModal(false)
            setSelectedEvent(null)
          }}
          onSuccess={() => {
            setShowAssignControllerModal(false)
            setSelectedEvent(null)
            fetchEventControllers()
          }}
        />
      )}
    </div>
  )
}

// Create Child Event Modal Component
function CreateChildEventModal({ 
  eventPageId, 
  onClose, 
  onSuccess 
}: { 
  eventPageId: string
  onClose: () => void
  onSuccess: () => void 
}) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    time: '',
    venue: '',
    location: '',
    price: '',
    max_attendees: '',
    category: '',
    image_url: ''
  })
  const [loading, setLoading] = useState(false)
  const [uploadMode, setUploadMode] = useState<'url' | 'file'>('url')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const supabase = createClient()
  const { user } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      let finalImageUrl = formData.image_url

      // Handle file upload if needed
      if (selectedFile && uploadMode === 'file') {
        setUploading(true)
        const uploadResult = await uploadEventImage(selectedFile, 'child-event-' + Date.now())
        
        if (uploadResult.success && uploadResult.publicUrl) {
          finalImageUrl = uploadResult.publicUrl
        } else {
          console.warn('File upload failed, proceeding without image')
        }
        setUploading(false)
      }

      const { error } = await supabase
        .from('events')
        .insert({
          title: formData.title,
          description: formData.description,
          start_date: formData.date,
          time: formData.time,
          venue: formData.venue,
          location: formData.location,
          price: parseFloat(formData.price) || 0,
          max_attendees: parseInt(formData.max_attendees) || 100,
          category: formData.category || 'Other',
          image_url: finalImageUrl || null,
          event_page_id: eventPageId,
          organizer_id: user?.id,
          status: 'published',
          is_child_event: true
        })

      if (error) throw error
      onSuccess()
    } catch (error) {
      console.error('Error creating event:', error)
      alert('Failed to create event')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-4">Create Child Event</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Event Title *</label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                placeholder="e.g., Opening Concert"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                placeholder="Describe the event..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time *</label>
                <input
                  type="time"
                  required
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Venue *</label>
              <input
                type="text"
                required
                value={formData.venue}
                onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                placeholder="e.g., Main Stadium"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                placeholder="e.g., Coimbatore, Tamil Nadu"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                  placeholder="0 for free"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Max Attendees</label>
                <input
                  type="number"
                  min="1"
                  value={formData.max_attendees}
                  onChange={(e) => setFormData({ ...formData, max_attendees: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                  placeholder="100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
              >
                <option value="">Select category...</option>
                <option value="Music">Music</option>
                <option value="Sports">Sports</option>
                <option value="Food">Food</option>
                <option value="Art">Art</option>
                <option value="Workshop">Workshop</option>
                <option value="Exhibition">Exhibition</option>
                <option value="Conference">Conference</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Banner Image</label>
              
              {/* Upload Mode Toggle */}
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setUploadMode('url')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    uploadMode === 'url' 
                      ? 'bg-[#0b6d41] text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Image URL
                </button>
                <button
                  type="button"
                  onClick={() => setUploadMode('file')}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    uploadMode === 'file' 
                      ? 'bg-[#0b6d41] text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  <Upload className="h-4 w-4 inline mr-1" />
                  Upload File
                </button>
              </div>

              {/* URL Input */}
              {uploadMode === 'url' && (
                <div>
                  <input
                    type="url"
                    value={formData.image_url}
                    onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                    placeholder="https://example.com/image.jpg"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                  />
                </div>
              )}

              {/* File Upload */}
              {uploadMode === 'file' && (
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null
                      setSelectedFile(file)
                      if (file) setFormData({ ...formData, image_url: '' })
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41] file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-[#0b6d41] file:text-white hover:file:bg-[#0a5d37]"
                  />
                  {selectedFile && (
                    <p className="text-xs text-green-600 mt-1">
                      Selected: {selectedFile.name}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || uploading}
                className="flex-1 px-4 py-2 bg-[#0b6d41] text-white rounded-lg hover:bg-[#0a5d37] transition-colors disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : loading ? 'Creating...' : 'Create Event'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// Assign Event Controller Modal
function AssignEventControllerModal({ 
  event, 
  onClose, 
  onSuccess 
}: { 
  event: ChildEvent
  onClose: () => void
  onSuccess: () => void 
}) {
  const [users, setUsers] = useState<any[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const supabase = createClient()
  const { user } = useAuth()

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .order('full_name')

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const filteredUsers = users.filter(u => 
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleAssign = async () => {
    if (!selectedUserId) return
    setLoading(true)

    try {
      // Use RPC function that allows page controllers to assign
      const { data, error } = await supabase.rpc('assign_event_controller', {
        p_event_id: event.id,
        p_user_id: selectedUserId,
        p_assigned_by: user?.id
      })

      if (error) throw error
      
      if (data && !data.success) {
        throw new Error(data.error || 'Failed to assign controller')
      }
      
      onSuccess()
    } catch (error: any) {
      console.error('Error assigning controller:', error)
      alert(error.message || 'Failed to assign event controller')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">Assign Event Controller</h2>
          <p className="text-gray-600 mb-4">
            Assign a user to manage <strong>{event.title}</strong>
          </p>
          
          {/* Search Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search User</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41] mb-2"
            />
          </div>

          {/* User Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Select User</label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
              size={5}
            >
              <option value="">Choose a user...</option>
              {filteredUsers.map(user => (
                <option key={user.id} value={user.id}>
                  {user.full_name || user.email} ({user.email})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {filteredUsers.length} users found
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-blue-800">
              <strong>Event Controller Permissions:</strong>
            </p>
            <ul className="text-xs text-blue-700 mt-1 list-disc list-inside">
              <li>Manage event details and settings</li>
              <li>View and export attendee lists</li>
              <li>Scan and verify tickets</li>
              <li>View event analytics</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAssign}
              disabled={!selectedUserId || loading}
              className="flex-1 px-4 py-2 bg-[#0b6d41] text-white rounded-lg hover:bg-[#0a5d37] transition-colors disabled:opacity-50"
            >
              {loading ? 'Assigning...' : 'Assign Controller'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}