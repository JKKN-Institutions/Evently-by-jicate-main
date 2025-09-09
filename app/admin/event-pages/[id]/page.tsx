'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { useParams, useRouter } from 'next/navigation'
import { Plus, Edit, Trash2, Users, Calendar, MapPin, Eye, UserCheck, Shield, Clock, DollarSign, ArrowLeft, Settings, Upload } from 'lucide-react'
import { EventPage, ChildEvent, EventControllerView } from '@/types/event-pages'
import { uploadEventImage } from '@/lib/supabase/storage-helper'
import Link from 'next/link'
import { BulkEventUpload } from '@/components/organizer/bulk-event-upload'
import TicketTiersManager, { TicketTier } from '@/components/events/ticket-tiers-manager'

export default function EventPageDetails() {
  const { id } = useParams()
  const router = useRouter()
  const { profile } = useAuth()
  const [eventPage, setEventPage] = useState<EventPage | null>(null)
  const [childEvents, setChildEvents] = useState<ChildEvent[]>([])
  const [eventControllers, setEventControllers] = useState<EventControllerView[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateEventModal, setShowCreateEventModal] = useState(false)
  const [showAssignControllerModal, setShowAssignControllerModal] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<ChildEvent | null>(null)
  const [userPermission, setUserPermission] = useState<'admin' | 'page_controller' | 'none'>('none')
  const supabase = useMemo(() => createClient(), [])
  const hasFetchedRef = useRef(false)

  useEffect(() => {
    // Prevent multiple fetches
    if (!profile || hasFetchedRef.current) return
    
    hasFetchedRef.current = true
    
    const loadData = async () => {
      setLoading(true)
      await Promise.all([
        fetchEventPage(),
        fetchChildEvents(),
        fetchEventControllers(),
        checkPermissions()
      ])
      setLoading(false)
    }
    
    loadData()
  }, [id, profile?.id]) // Only depend on profile.id, not the entire profile object

  const checkPermissions = async () => {
    if (!profile?.id) return

    try {
      const { data } = await supabase.rpc('check_page_permission', {
        p_user_id: profile.id,
        p_page_id: id
      })
      setUserPermission(data || 'none')
    } catch (error) {
      console.error('Error checking permissions:', error)
    }
  }

  const fetchEventPage = async () => {
    try {
      const { data, error } = await supabase
        .from('event_pages')
        .select(`
          *,
          profiles:created_by(full_name)
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      setEventPage(data)
    } catch (error) {
      console.error('Error fetching event page:', error)
      router.push('/admin/event-pages')
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
      setChildEvents([])
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

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event?')) return

    try {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId)

      if (error) throw error
      fetchChildEvents()
      fetchEventControllers()
    } catch (error) {
      console.error('Error deleting event:', error)
      alert('Failed to delete event')
    }
  }

  const getEventController = (eventId: string) => {
    return eventControllers.find(ec => ec.event_id === eventId)
  }

  if (loading || !eventPage) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0b6d41]"></div>
      </div>
    )
  }

  // Check if user has permission to view this page
  if (userPermission === 'none' && profile?.role !== 'admin') {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <Shield className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-red-800 mb-2">Access Denied</h3>
          <p className="text-red-600">You don't have permission to view this event page.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        {/* Banner Image */}
        {eventPage.banner_image && (
          <div className="mb-6 rounded-lg overflow-hidden">
            <img 
              src={eventPage.banner_image} 
              alt={eventPage.title}
              className="w-full h-64 object-cover"
            />
          </div>
        )}
        
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => router.back()}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">{eventPage.title}</h1>
            <p className="text-gray-600 mt-1">{eventPage.description}</p>
          </div>
          {(userPermission === 'admin' || userPermission === 'page_controller') && (
            <div className="flex gap-2">
              <Link
                href={`/admin/event-pages/${id}/edit`}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Settings className="h-5 w-5" />
                Edit Page
              </Link>
              <BulkEventUploadForPage 
                eventPageId={id as string}
                onUploadSuccess={() => {
                  fetchChildEvents()
                  fetchEventControllers()
                }}
              />
              <button
                onClick={() => setShowCreateEventModal(true)}
                className="flex items-center gap-2 bg-[#0b6d41] text-white px-4 py-2 rounded-lg hover:bg-[#0a5d37] transition-colors"
              >
                <Plus className="h-5 w-5" />
                Add Event
              </button>
            </div>
          )}
        </div>

        {/* Event Page Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center gap-3 mb-3">
              <MapPin className="h-5 w-5 text-gray-400" />
              <span className="font-medium">Location</span>
            </div>
            <p className="text-gray-900">{eventPage.location || 'Not specified'}</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center gap-3 mb-3">
              <Calendar className="h-5 w-5 text-gray-400" />
              <span className="font-medium">Duration</span>
            </div>
            <p className="text-gray-900">
              {eventPage.start_date && eventPage.end_date ? (
                `${new Date(eventPage.start_date).toLocaleDateString()} - ${new Date(eventPage.end_date).toLocaleDateString()}`
              ) : (
                'Dates not set'
              )}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center gap-3 mb-3">
              <Users className="h-5 w-5 text-gray-400" />
              <span className="font-medium">Events</span>
            </div>
            <p className="text-gray-900">{childEvents.length} child events</p>
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
            <p className="text-gray-600 mb-4">Start building your festival by adding child events</p>
            {(userPermission === 'admin' || userPermission === 'page_controller') && (
              <button
                onClick={() => setShowCreateEventModal(true)}
                className="inline-flex items-center gap-2 bg-[#0b6d41] text-white px-4 py-2 rounded-lg hover:bg-[#0a5d37] transition-colors"
              >
                <Plus className="h-5 w-5" />
                Add First Event
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {childEvents.map((event) => {
              const controller = getEventController(event.id)
              return (
                <div key={event.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                  {/* Event Banner Image */}
                  <div className="h-48 overflow-hidden bg-gray-100">
                    <img 
                      src={event.image_url || `/api/events/${event.id}/image`} 
                      alt={event.title}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        if (!target.src.endsWith('/placeholder-event.svg')) {
                          target.src = '/placeholder-event.svg'
                        }
                      }}
                    />
                  </div>
                  
                  <div className="p-6">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{event.title}</h3>
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                      {event.description || 'No description provided'}
                    </p>

                    {/* Event Details */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar className="h-4 w-4" />
                        {new Date(event.start_date || event.date).toLocaleDateString()} at {event.time}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <MapPin className="h-4 w-4" />
                        {event.venue}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <DollarSign className="h-4 w-4" />
                        ₹{event.price}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Users className="h-4 w-4" />
                        Max {event.max_attendees} attendees
                      </div>
                    </div>

                    {/* Event Controller */}
                    <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Event Controller:</span>
                        {controller ? (
                          <div className="flex items-center gap-2">
                            <UserCheck className="h-4 w-4 text-[#0b6d41]" />
                            <span className="text-sm font-medium">{controller.controller_name}</span>
                            {(userPermission === 'admin' || userPermission === 'page_controller') && (
                              <button
                                onClick={() => {
                                  setSelectedEvent(event)
                                  setShowAssignControllerModal(true)
                                }}
                                className="ml-2 text-xs text-blue-600 hover:text-blue-700"
                                title="Change controller"
                              >
                                <Edit className="h-3 w-3 inline" />
                              </button>
                            )}
                          </div>
                        ) : (
                          (userPermission === 'admin' || userPermission === 'page_controller') && (
                            <button
                              onClick={() => {
                                setSelectedEvent(event)
                                setShowAssignControllerModal(true)
                              }}
                              className="text-sm text-[#0b6d41] hover:underline"
                            >
                              Assign Controller
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Link
                        href={`/events/${event.id}`}
                        className="flex-1 flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        <Eye className="h-4 w-4" />
                        View
                      </Link>
                      {(userPermission === 'admin' || userPermission === 'page_controller') && (
                        <>
                          <button
                            onClick={() => router.push(`/events/${event.id}/edit`)}
                            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            <Edit className="h-4 w-4" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteEvent(event.id)}
                            className="flex items-center justify-center bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
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
          }}
        />
      )}

      {/* Assign Event Controller Modal */}
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

// Bulk Upload Wrapper for Event Pages
function BulkEventUploadForPage({ 
  eventPageId, 
  onUploadSuccess 
}: { 
  eventPageId: string
  onUploadSuccess: () => void 
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [dragActive, setDragActive] = useState(false)
  const { user } = useAuth()
  const supabase = createClient()

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const handleFileSelect = (selectedFile: File) => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ]
    
    if (!validTypes.includes(selectedFile.type) && 
        !selectedFile.name.match(/\.(xlsx|xls|csv)$/i)) {
      setResult({
        success: false,
        message: 'Please upload an Excel (.xlsx, .xls) or CSV (.csv) file'
      })
      return
    }
    
    setFile(selectedFile)
    setResult(null)
  }

  const handleUpload = async () => {
    if (!file || !user) return

    setUploading(true)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('event_page_id', eventPageId)

      const response = await fetch('/api/event-pages/bulk-upload-child-events', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()
      
      if (response.ok || response.status === 207) {
        setResult(data)
        if ((data.success === true || data.success === 'partial') && data.successCount > 0 && onUploadSuccess) {
          onUploadSuccess()
        }
      } else {
        setResult({
          success: false,
          message: data.error || 'Upload failed',
          validationErrors: data.validationErrors
        })
      }
    } catch (error) {
      setResult({
        success: false,
        message: 'Failed to upload file. Please try again.'
      })
    } finally {
      setUploading(false)
    }
  }

  const downloadTemplate = async () => {
    try {
      const response = await fetch('/api/event-pages/bulk-upload-child-events?event_page_id=' + eventPageId, {
        method: 'GET'
      })
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'child-events-template.xlsx'
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Failed to download template:', error)
    }
  }

  const reset = () => {
    setFile(null)
    setResult(null)
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
      >
        <Upload className="w-4 h-4" />
        Bulk Upload
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Bulk Upload Child Events</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Upload multiple child events for this event page
                </p>
              </div>
              <button
                onClick={() => {
                  setIsOpen(false)
                  reset()
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                ×
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <h3 className="font-medium text-blue-900">Download Template</h3>
                    <p className="text-sm text-blue-700 mt-1">
                      Start with our Excel template for child events
                    </p>
                    <button
                      onClick={downloadTemplate}
                      className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      Download Template
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload File
                </label>
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => e.target.files && handleFileSelect(e.target.files[0])}
                    className="hidden"
                    id="file-upload"
                  />
                  
                  {file ? (
                    <div className="space-y-2">
                      <p className="font-medium text-gray-900">{file.name}</p>
                      <p className="text-sm text-gray-600">
                        {(file.size / 1024).toFixed(2)} KB
                      </p>
                      <button
                        onClick={reset}
                        className="text-sm text-red-600 hover:text-red-700"
                      >
                        Remove file
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                      <label
                        htmlFor="file-upload"
                        className="cursor-pointer"
                      >
                        <span className="text-blue-600 hover:text-blue-700 font-medium">
                          Click to upload
                        </span>
                        <span className="text-gray-600"> or drag and drop</span>
                      </label>
                      <p className="text-sm text-gray-500 mt-2">
                        Excel (.xlsx, .xls) or CSV files only
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Required Fields:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• title: Event name</li>
                  <li>• date: Format: YYYY-MM-DD</li>
                  <li>• time: Format: HH:MM</li>
                  <li>• venue: Venue name</li>
                </ul>
                <h4 className="font-medium text-gray-900 mt-3 mb-2">Optional Fields:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• description: Event details</li>
                  <li>• location: Full address</li>
                  <li>• category: Music, Sports, Food, etc.</li>
                  <li>• price: Ticket price (default: 0)</li>
                  <li>• max_attendees: Maximum capacity (default: 100)</li>
                </ul>
              </div>

              {result && (
                <div className={`rounded-lg p-4 ${
                  result.success === true ? 'bg-green-50 border border-green-200' : 
                  result.success === 'partial' ? 'bg-yellow-50 border border-yellow-200' :
                  'bg-red-50 border border-red-200'
                }`}>
                  <p className={`font-medium ${
                    result.success === true ? 'text-green-900' : 
                    result.success === 'partial' ? 'text-yellow-900' :
                    'text-red-900'
                  }`}>
                    {result.message}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setIsOpen(false)
                    reset()
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!file || uploading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {uploading ? 'Uploading...' : 'Upload Events'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// Create Child Event Modal
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
    end_date: '',
    time: '',
    end_time: '',
    venue: '',
    location: '',
    price: '',
    max_attendees: '',
    category: '',
    image_url: '',
    registration_required: false,
    registration_deadline: '',
    event_type: 'in-person',
    meeting_link: '',
    tags: '',
    speaker_info: '',
    agenda: '',
    sponsors: '',
    contact_email: '',
    contact_phone: '',
    min_attendees: '',
    early_bird_price: '',
    early_bird_deadline: '',
    refund_policy: '',
    parking_info: '',
    accessibility_info: '',
    dress_code: '',
    age_restriction: '',
    prerequisites: '',
    materials_provided: '',
    recording_available: false,
    certificate_provided: false,
    language: 'English',
    difficulty_level: 'beginner'
  })
  const [ticketTiers, setTicketTiers] = useState<TicketTier[]>([])
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

      // Handle file upload if a file is selected
      if (selectedFile && uploadMode === 'file') {
        setUploading(true)
        const uploadResult = await uploadEventImage(selectedFile, 'child-event-' + Date.now())
        
        if (uploadResult.success && uploadResult.publicUrl) {
          finalImageUrl = uploadResult.publicUrl
        } else {
          console.warn('File upload failed, proceeding without image:', uploadResult.error)
        }
        setUploading(false)
      }
      // Create the event first
      const { data: newEvent, error: eventError } = await supabase
        .from('events')
        .insert({
          title: formData.title,
          description: formData.description,
          start_date: formData.date,
          end_date: formData.end_date || null,
          time: formData.time,
          end_time: formData.end_time || null,
          venue: formData.venue,
          location: formData.location,
          price: ticketTiers.length > 0 ? Math.min(...ticketTiers.map(t => t.price)) : parseFloat(formData.price) || 0,
          max_attendees: parseInt(formData.max_attendees) || 100,
          min_attendees: parseInt(formData.min_attendees) || null,
          category: formData.category || 'Other',
          image_url: finalImageUrl || null,
          event_page_id: eventPageId,
          organizer_id: user?.id,
          status: 'published',
          event_type: formData.event_type,
          meeting_link: formData.meeting_link || null,
          tags: formData.tags || null,
          speaker_info: formData.speaker_info || null,
          agenda: formData.agenda || null,
          sponsors: formData.sponsors || null,
          contact_email: formData.contact_email || null,
          contact_phone: formData.contact_phone || null,
          registration_required: formData.registration_required,
          registration_deadline: formData.registration_deadline || null,
          refund_policy: formData.refund_policy || null,
          parking_info: formData.parking_info || null,
          accessibility_info: formData.accessibility_info || null,
          dress_code: formData.dress_code || null,
          age_restriction: formData.age_restriction || null,
          prerequisites: formData.prerequisites || null,
          materials_provided: formData.materials_provided || null,
          recording_available: formData.recording_available,
          certificate_provided: formData.certificate_provided,
          language: formData.language || 'English',
          difficulty_level: formData.difficulty_level || null,
          // Store ticket tiers as JSON
          ticket_tiers: ticketTiers.length > 0 ? JSON.stringify(ticketTiers) : null
        })
        .select()
        .single()

      if (eventError) throw eventError

      // If ticket tiers are defined, create them in a separate table
      if (ticketTiers.length > 0 && newEvent) {
        const tiersToInsert = ticketTiers.map(tier => ({
          event_id: newEvent.id,
          name: tier.name,
          price: tier.price,
          early_bird_price: tier.earlyBirdPrice || null,
          quantity: tier.quantity,
          max_per_person: tier.maxPerPerson || 5,
          description: tier.description,
          perks: tier.perks,
          icon: tier.icon || null,
          color: tier.color || null,
          available: tier.available
        }))

        const { error: tiersError } = await supabase
          .from('event_ticket_tiers')
          .insert(tiersToInsert)

        if (tiersError) {
          console.error('Error creating ticket tiers:', tiersError)
          // Don't fail the whole operation if tiers fail
        }
      }

      onSuccess()
    } catch (error) {
      console.error('Error creating child event:')
      console.error('- Type:', typeof error)
      console.error('- Constructor:', error?.constructor?.name)
      console.error('- Message:', error instanceof Error ? error.message : 'No message')
      console.error('- String representation:', String(error))
      console.error('- JSON stringify attempt:', (() => {
        try { 
          return JSON.stringify(error, Object.getOwnPropertyNames(error)) 
        } catch (e) { 
          return 'Cannot stringify: ' + String(e) 
        }
      })())
      console.error('- Raw error object:', error)
      
      // Try to extract Supabase specific error info
      if (error && typeof error === 'object') {
        console.error('- Object keys:', Object.keys(error))
        console.error('- All properties:', Object.getOwnPropertyNames(error))
        if ('code' in error) console.error('- Error code:', error.code)
        if ('details' in error) console.error('- Error details:', error.details)
        if ('hint' in error) console.error('- Error hint:', error.hint)
        if ('message' in error) console.error('- Error message prop:', error.message)
      }
      alert('Failed to create event')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Create Child Event</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Information */}
          <div className="border-b pb-4">
            <h3 className="text-lg font-semibold mb-3">Basic Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Event Title *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                />
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
                  <option value="Conference">Conference</option>
                  <option value="Seminar">Seminar</option>
                  <option value="Webinar">Webinar</option>
                  <option value="Exhibition">Exhibition</option>
                  <option value="Festival">Festival</option>
                  <option value="Networking">Networking</option>
                  <option value="Training">Training</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Event Type</label>
                  <select
                    value={formData.event_type}
                    onChange={(e) => setFormData({ ...formData, event_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                  >
                    <option value="in-person">In-Person</option>
                    <option value="virtual">Virtual</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
                  <input
                    type="text"
                    value={formData.language}
                    onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                    placeholder="English"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Date & Time Information */}
          <div className="border-b pb-4">
            <h3 className="text-lg font-semibold mb-3">Date & Time</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Time *</label>
                <input
                  type="time"
                  required
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                <input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                />
              </div>
            </div>
          </div>

          {/* Location Information */}
          <div className="border-b pb-4">
            <h3 className="text-lg font-semibold mb-3">Location</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Venue *</label>
                <input
                  type="text"
                  required
                  value={formData.venue}
                  onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Address</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                />
              </div>
              {formData.event_type !== 'in-person' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Meeting Link</label>
                  <input
                    type="url"
                    value={formData.meeting_link}
                    onChange={(e) => setFormData({ ...formData, meeting_link: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                    placeholder="https://meet.google.com/..."
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Parking Info</label>
                  <input
                    type="text"
                    value={formData.parking_info}
                    onChange={(e) => setFormData({ ...formData, parking_info: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Accessibility Info</label>
                  <input
                    type="text"
                    value={formData.accessibility_info}
                    onChange={(e) => setFormData({ ...formData, accessibility_info: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Ticket Tiers & Pricing */}
          <div className="border-b pb-4">
            <TicketTiersManager 
              tiers={ticketTiers}
              onChange={setTicketTiers}
              currency="₹"
            />
          </div>

          {/* General Capacity & Registration */}
          <div className="border-b pb-4">
            <h3 className="text-lg font-semibold mb-3">General Capacity & Registration</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Max Attendees</label>
                <input
                  type="number"
                  min="1"
                  value={formData.max_attendees}
                  onChange={(e) => setFormData({ ...formData, max_attendees: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                  placeholder="Overall capacity limit"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Attendees</label>
                <input
                  type="number"
                  min="0"
                  value={formData.min_attendees}
                  onChange={(e) => setFormData({ ...formData, min_attendees: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                  placeholder="Minimum required"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Registration Deadline</label>
                <input
                  type="date"
                  value={formData.registration_deadline}
                  onChange={(e) => setFormData({ ...formData, registration_deadline: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Refund Policy</label>
                <select
                  value={formData.refund_policy}
                  onChange={(e) => setFormData({ ...formData, refund_policy: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                >
                  <option value="">Select policy...</option>
                  <option value="full-refund-7-days">Full refund up to 7 days before</option>
                  <option value="full-refund-48-hours">Full refund up to 48 hours before</option>
                  <option value="partial-refund">50% refund up to 24 hours before</option>
                  <option value="no-refund">No refunds</option>
                  <option value="custom">Custom policy</option>
                </select>
              </div>
            </div>
            {formData.refund_policy === 'custom' && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Custom Refund Policy</label>
                <textarea
                  value={formData.refund_policy}
                  onChange={(e) => setFormData({ ...formData, refund_policy: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                  placeholder="Describe your refund policy..."
                />
              </div>
            )}
          </div>

          {/* Event Details */}
          <div className="border-b pb-4">
            <h3 className="text-lg font-semibold mb-3">Event Details</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Speaker/Host Information</label>
                <textarea
                  value={formData.speaker_info}
                  onChange={(e) => setFormData({ ...formData, speaker_info: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Agenda</label>
                <textarea
                  value={formData.agenda}
                  onChange={(e) => setFormData({ ...formData, agenda: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sponsors</label>
                <input
                  type="text"
                  value={formData.sponsors}
                  onChange={(e) => setFormData({ ...formData, sponsors: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                  placeholder="Comma-separated sponsor names"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                  placeholder="Comma-separated tags"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty Level</label>
                  <select
                    value={formData.difficulty_level}
                    onChange={(e) => setFormData({ ...formData, difficulty_level: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                    <option value="all-levels">All Levels</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dress Code</label>
                  <input
                    type="text"
                    value={formData.dress_code}
                    onChange={(e) => setFormData({ ...formData, dress_code: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Requirements & Restrictions */}
          <div className="border-b pb-4">
            <h3 className="text-lg font-semibold mb-3">Requirements & Restrictions</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Age Restriction</label>
                <input
                  type="text"
                  value={formData.age_restriction}
                  onChange={(e) => setFormData({ ...formData, age_restriction: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                  placeholder="e.g., 18+"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prerequisites</label>
                <textarea
                  value={formData.prerequisites}
                  onChange={(e) => setFormData({ ...formData, prerequisites: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Materials Provided</label>
                <textarea
                  value={formData.materials_provided}
                  onChange={(e) => setFormData({ ...formData, materials_provided: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="border-b pb-4">
            <h3 className="text-lg font-semibold mb-3">Contact Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Email</label>
                <input
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
                <input
                  type="tel"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                />
              </div>
            </div>
          </div>

          {/* Additional Options */}
          <div className="border-b pb-4">
            <h3 className="text-lg font-semibold mb-3">Additional Options</h3>
            <div className="space-y-3">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="registration_required"
                  checked={formData.registration_required}
                  onChange={(e) => setFormData({ ...formData, registration_required: e.target.checked })}
                  className="h-4 w-4 text-[#0b6d41] focus:ring-[#0b6d41] border-gray-300 rounded"
                />
                <label htmlFor="registration_required" className="ml-2 text-sm text-gray-700">
                  Registration Required
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="recording_available"
                  checked={formData.recording_available}
                  onChange={(e) => setFormData({ ...formData, recording_available: e.target.checked })}
                  className="h-4 w-4 text-[#0b6d41] focus:ring-[#0b6d41] border-gray-300 rounded"
                />
                <label htmlFor="recording_available" className="ml-2 text-sm text-gray-700">
                  Recording Will Be Available
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="certificate_provided"
                  checked={formData.certificate_provided}
                  onChange={(e) => setFormData({ ...formData, certificate_provided: e.target.checked })}
                  className="h-4 w-4 text-[#0b6d41] focus:ring-[#0b6d41] border-gray-300 rounded"
                />
                <label htmlFor="certificate_provided" className="ml-2 text-sm text-gray-700">
                  Certificate Provided
                </label>
              </div>
            </div>
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
                URL
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
                Upload
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
                <p className="text-xs text-gray-500 mt-1">Enter an image URL</p>
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
                    // Clear URL when file is selected
                    if (file) setFormData({ ...formData, image_url: '' })
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41] file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-[#0b6d41] file:text-white hover:file:bg-[#0a5d37]"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Upload an image file (JPG, PNG, WebP) - will be stored in Supabase Storage
                </p>
                {selectedFile && (
                  <p className="text-xs text-green-600 mt-1">
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>
            )}
            
            {/* Image Preview */}
            {(formData.image_url || selectedFile) && (
              <div className="mt-3 rounded-lg overflow-hidden border border-gray-200">
                <img 
                  src={selectedFile ? URL.createObjectURL(selectedFile) : formData.image_url} 
                  alt="Banner preview"
                  className="w-full h-32 object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
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
              {uploading ? 'Uploading Image...' : loading ? 'Creating Event...' : 'Create Event'}
            </button>
          </div>
        </form>
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
  const [currentController, setCurrentController] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const { user } = useAuth()

  useEffect(() => {
    fetchUsers()
    fetchCurrentController()
  }, [])

  const fetchCurrentController = async () => {
    try {
      const { data, error } = await supabase
        .from('event_controllers')
        .select('*, profiles(id, email, full_name)')
        .eq('event_id', event.id)
        .single()

      if (data && !error) {
        setCurrentController(data)
        setSelectedUserId(data.controller_id)
      }
    } catch (error) {
      console.log('No current controller assigned')
    }
  }

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

  const handleAssign = async () => {
    if (!selectedUserId) return
    setLoading(true)

    try {
      // If there's a current controller and we're changing to a different user
      if (currentController && selectedUserId !== currentController.controller_id) {
        // First remove the current controller
        const { error: removeError } = await supabase
          .from('event_controllers')
          .delete()
          .eq('event_id', event.id)

        if (removeError) throw removeError
      }

      // Only assign if we're not removing (selectedUserId is not empty)
      if (selectedUserId && selectedUserId !== currentController?.controller_id) {
        const { data, error } = await supabase.rpc('assign_event_controller', {
          p_event_id: event.id,
          p_user_id: selectedUserId,
          p_assigned_by: user?.id
        })

        if (error) throw error
        if (!data.success) throw new Error(data.error)
      }
      
      onSuccess()
    } catch (error) {
      console.error('Error updating controller:', error)
      alert('Failed to update event controller')
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async () => {
    if (!currentController) return
    
    if (!confirm('Are you sure you want to remove the current event controller?')) return
    
    setLoading(true)
    try {
      const { error } = await supabase
        .from('event_controllers')
        .delete()
        .eq('event_id', event.id)

      if (error) throw error
      onSuccess()
    } catch (error) {
      console.error('Error removing controller:', error)
      alert('Failed to remove event controller')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">
          {currentController ? 'Update Event Controller' : 'Assign Event Controller'}
        </h2>
        <p className="text-gray-600 mb-4">
          {currentController ? 'Change' : 'Assign'} the Event Controller for <strong>{event.title}</strong>
        </p>
        
        {currentController && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              Current Controller: <strong>{currentController.profiles?.full_name || currentController.profiles?.email}</strong>
            </p>
          </div>
        )}
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Select User</label>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
          >
            <option value="">Choose a user...</option>
            {users.map(user => (
              <option key={user.id} value={user.id}>
                {user.full_name || user.email}
                {user.id === currentController?.controller_id && ' (Current)'}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3">
          {currentController && (
            <button
              onClick={handleRemove}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Remove
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={!selectedUserId || loading || selectedUserId === currentController?.controller_id}
            className="flex-1 px-4 py-2 bg-[#0b6d41] text-white rounded-lg hover:bg-[#0a5d37] transition-colors disabled:opacity-50"
          >
            {loading ? 'Updating...' : currentController ? 'Update Controller' : 'Assign Controller'}
          </button>
        </div>
      </div>
    </div>
  )
}