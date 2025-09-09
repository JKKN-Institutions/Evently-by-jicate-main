'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Calendar, MapPin, Users, IndianRupee, Image as ImageIcon, LogIn, Upload, X, CheckCircle } from 'lucide-react'
import { eventFormSchema, type EventFormData, eventCategories } from '@/lib/validations/event'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import ImageUploadDropzone from '../../create/image-upload-dropzone'
import SeatConfiguration from '@/components/events/SeatConfiguration'
import type { SeatConfig } from '@/components/events/SeatConfiguration'
import SimpleTicketConfigurator, { type SimpleTicketConfig } from '@/components/events/simple-ticket-configurator'

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
  seat_config?: SeatConfig
  ticket_template?: SimpleTicketConfig
}

export default function EditEventPage() {
  const router = useRouter()
  const params = useParams()
  const eventId = params?.id as string
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [event, setEvent] = useState<Event | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [isUploading, setIsUploading] = useState(false)
  const [seatConfig, setSeatConfig] = useState<SeatConfig>({
    enabled: false,
    totalSeats: 100,
    layoutType: 'sequential'
  })
  const [enableTicketTemplate, setEnableTicketTemplate] = useState(false)
  const [ticketConfig, setTicketConfig] = useState<SimpleTicketConfig>({
    themeColor: '#3B82F6',
    organizerName: '',
    organizerContact: '',
    enableWatermark: false,
    terms: [
      'This ticket is valid for one-time entry only',
      'Please carry a valid government-issued ID proof',
      'Entry subject to security check'
    ]
  })
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset
  } = useForm<EventFormData>({
    resolver: zodResolver(eventFormSchema),
  })

  const watchedImageUrl = watch('image_url')
  const watchedPrice = watch('price')
  const supabase = useMemo(() => createClient(), [])

  const checkUserAndRole = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    
    // If no user, redirect to events page with login prompt
    if (!user) {
      router.push('/events?message=Please sign in to edit this event.')
      return
    }

    // Check if user has organizer or admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const userRole = profile?.role || 'user'
    
    if (userRole !== 'organizer' && userRole !== 'admin') {
      router.push('/profile/upgrade-to-organizer?message=You need to become an organizer to edit events.')
      return
    }
  }, [supabase, router])

  const fetchEvent = useCallback(async () => {
    if (!eventId) return

    try {
      const response = await fetch(`/api/events/${eventId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch event')
      }

      const { event } = await response.json()
      setEvent(event)

      // Check if user owns this event
      if (user && event.organizer_id !== user.id) {
        router.push('/events?message=You can only edit your own events.')
        return
      }

      // Populate form with existing event data
      reset({
        title: event.title,
        description: event.description,
        date: event.date,
        time: event.time,
        venue: event.venue,
        location: event.location,
        price: event.price,
        max_attendees: event.max_attendees,
        category: event.category,
        image_url: event.image_url || ''
      })

      // Set existing image preview if available
      if (event.image_url) {
        setImagePreview(event.image_url)
      }

      // Set existing seat config
      if (event.seat_config) {
        setSeatConfig(event.seat_config)
      }

      // Set existing ticket template config
      if (event.ticket_template) {
        setTicketConfig({
          themeColor: event.ticket_template.themeColor || '#3B82F6',
          organizerName: event.ticket_template.organizerName || '',
          organizerContact: event.ticket_template.organizerContact || '',
          enableWatermark: event.ticket_template.enableWatermark ?? false,
          terms: event.ticket_template.terms || [
            'This ticket is valid for one-time entry only',
            'Please carry a valid government-issued ID proof',
            'Entry subject to security check'
          ]
        })
        setEnableTicketTemplate(true)
      }

    } catch (error) {
      console.error('Error fetching event:', error)
      router.push('/events?message=Event not found or you do not have permission to edit it.')
    } finally {
      setLoading(false)
    }
  }, [eventId, user, supabase, reset, router])

  useEffect(() => {
    checkUserAndRole()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) {
        router.push('/events?message=Please sign in to edit this event.')
      } else {
        checkUserAndRole()
      }
    })

    return () => subscription.unsubscribe()
  }, [checkUserAndRole, supabase.auth, router])

  useEffect(() => {
    if (user) {
      fetchEvent()
    }
  }, [user, fetchEvent])

  const handleImageSelect = (file: File) => {
    setImageFile(file)
    const previewUrl = URL.createObjectURL(file)
    setImagePreview(previewUrl)
    
    // Clear any existing URL in the form
    setValue('image_url', '')
  }

  const handleImageRemove = () => {
    setImageFile(null)
    setImagePreview('')
    setValue('image_url', '')
    
    // Clean up object URL
    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview)
    }
  }

  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      setIsUploading(true)
      setUploadProgress(0)

      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      const filePath = fileName // Remove the bucket name from path

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + 10
        })
      }, 200)

      // Skip bucket check - proceed directly to upload
      // The bucket exists as confirmed by the user
      console.log('Uploading to event-images bucket...')

      const { error: uploadError } = await supabase.storage
        .from('event-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      clearInterval(progressInterval)

      if (uploadError) {
        console.error('Upload error:', uploadError)
        console.error('Upload details:', { filePath, fileSize: file.size, fileType: file.type })
        
        // Try with upsert true to overwrite if exists
        const { error: retryError } = await supabase.storage
          .from('event-images')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: true // Allow overwriting
          })
        
        if (retryError) {
          console.error('Retry upload error:', retryError)
          
          // Fall back to base64
          clearInterval(progressInterval)
          setUploadProgress(100)
          
          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onloadend = () => {
              const base64 = reader.result as string
              console.log('Using base64 fallback after upload failure')
              setTimeout(() => {
                setIsUploading(false)
                setUploadProgress(0)
              }, 500)
              resolve(base64)
            }
            reader.onerror = () => {
              setIsUploading(false)
              setUploadProgress(0)
              reject(new Error('Failed to read file'))
            }
            reader.readAsDataURL(file)
          })
        }
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('event-images')
        .getPublicUrl(filePath)

      setUploadProgress(100)
      
      setTimeout(() => {
        setIsUploading(false)
        setUploadProgress(0)
      }, 1000)

      return publicUrl
    } catch (error) {
      console.error('Error uploading image:', error)
      setIsUploading(false)
      setUploadProgress(0)
      throw error
    }
  }

  // Show loading state while checking authentication or fetching event
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0b6d41] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading event...</p>
        </div>
      </div>
    )
  }

  // Show login prompt if not authenticated
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <div className="max-w-md mx-auto text-center p-8 bg-white rounded-lg shadow-lg">
          <LogIn className="h-16 w-16 text-[#0b6d41] mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h2>
          <p className="text-gray-600 mb-6">Please sign in to edit this event.</p>
          <Link
            href="/events"
            className="inline-flex items-center px-6 py-3 bg-[#0b6d41] text-white font-semibold rounded-lg hover:bg-[#0a5d37] transition-colors"
          >
            Go to Events
          </Link>
        </div>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <div className="max-w-md mx-auto text-center p-8 bg-white rounded-lg shadow-lg">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Event Not Found</h2>
          <p className="text-gray-600 mb-6">The event you're trying to edit doesn't exist or you don't have permission to edit it.</p>
          <Link
            href="/organizer/my-events"
            className="inline-flex items-center px-6 py-3 bg-[#0b6d41] text-white font-semibold rounded-lg hover:bg-[#0a5d37] transition-colors"
          >
            Back to My Events
          </Link>
        </div>
      </div>
    )
  }

  const onSubmit = async (data: EventFormData) => {
    try {
      setIsSubmitting(true)
      
      let finalImageUrl = data.image_url

      // Upload image if file is selected
      if (imageFile) {
        try {
          const uploadedUrl = await uploadImage(imageFile)
          if (uploadedUrl) {
            finalImageUrl = uploadedUrl
          }
        } catch (uploadError) {
          console.error('Image upload failed:', uploadError)
          // Ask user if they want to continue without image
          const continueWithoutImage = confirm(
            'Image upload failed. Would you like to update the event without changing the image?'
          )
          if (!continueWithoutImage) {
            setIsSubmitting(false)
            return
          }
          // Continue with event update without changing image
          finalImageUrl = event.image_url
        }
      }

      // Only include ticket template if enabled
      let completeTicketTemplate = null
      if (enableTicketTemplate) {
        completeTicketTemplate = {
          ...ticketConfig,
          ticketTypes: [
            {
              name: 'General Admission',
              price: data.price || 0,
              color: ticketConfig.themeColor,
              description: 'Standard entry ticket'
            }
          ]
        }
      }

      const eventData = {
        ...data,
        image_url: finalImageUrl || null,
        seat_config: seatConfig, // Include seat configuration
        ticket_template: completeTicketTemplate // Include ticket template only if enabled
      }
      
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      })

      if (!response.ok) {
        const error = await response.json()
        if (response.status === 401) {
          alert('Please sign in to update this event')
          return
        } else if (response.status === 403) {
          alert('You do not have permission to edit this event')
          return
        }
        throw new Error(error.error || 'Failed to update event')
      }

      const { event: updatedEvent } = await response.json()
      router.push(`/events/${updatedEvent.id}?message=Event updated successfully!`)
    } catch (error) {
      console.error('Error updating event:', error)
      alert(error instanceof Error ? error.message : 'Failed to update event. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Modern Header */}
      <header className="bg-white/95 backdrop-blur-md shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-[#0b6d41] to-[#15a862] bg-clip-text text-transparent">
              Evently
            </Link>
            <Link
              href="/organizer/my-events"
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to My Events
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 border border-gray-100">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Edit Event</h1>
            <p className="text-gray-600">Update your event details and reach more people</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {/* Event Banner Image Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-4">
                <ImageIcon className="inline h-5 w-5 mr-2" />
                Event Banner Image
              </label>
              
              <ImageUploadDropzone 
                onImageSelect={handleImageSelect}
                imagePreview={imagePreview}
                onImageRemove={handleImageRemove}
                isUploading={isUploading}
                uploadProgress={uploadProgress}
              />
              
              {/* Alternative URL Input */}
              <div className="mt-4">
                <div className="text-center text-sm text-gray-500 mb-3">
                  <span className="bg-white px-2">OR</span>
                </div>
                <input
                  {...register('image_url')}
                  type="url"
                  placeholder="Enter image URL"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41] focus:border-transparent"
                  disabled={!!imageFile}
                />
                {errors.image_url && (
                  <p className="mt-2 text-sm text-red-600">{errors.image_url.message}</p>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Event Title */}
              <div className="md:col-span-2">
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                  Event Title *
                </label>
                <input
                  {...register('title')}
                  type="text"
                  id="title"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41] focus:border-transparent text-lg"
                  placeholder="Enter an engaging event title"
                />
                {errors.title && (
                  <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>
                )}
              </div>

              {/* Category */}
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                  Category *
                </label>
                <select
                  {...register('category')}
                  id="category"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41] focus:border-transparent"
                >
                  <option value="">Select a category</option>
                  {eventCategories.map((category) => (
                    <option key={category} value={category} className="capitalize">
                      {category}
                    </option>
                  ))}
                </select>
                {errors.category && (
                  <p className="mt-1 text-sm text-red-600">{errors.category.message}</p>
                )}
              </div>

              {/* Price */}
              <div>
                <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-2">
                  <IndianRupee className="inline h-4 w-4 mr-1" />
                  Ticket Price (INR) *
                </label>
                <input
                  {...register('price')}
                  type="number"
                  id="price"
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41] focus:border-transparent"
                  placeholder="0.00 (Free event)"
                />
                {errors.price && (
                  <p className="mt-1 text-sm text-red-600">{errors.price.message}</p>
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Event Description *
              </label>
              <textarea
                {...register('description')}
                id="description"
                rows={5}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41] focus:border-transparent"
                placeholder="Describe your event in detail - what attendees can expect, agenda, speakers, etc."
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
              )}
            </div>

            {/* Date and Time */}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
                  <Calendar className="inline h-4 w-4 mr-1" />
                  Event Date *
                </label>
                <input
                  {...register('date')}
                  type="date"
                  id="date"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41] focus:border-transparent"
                  min={new Date().toISOString().split('T')[0]}
                />
                {errors.date && (
                  <p className="mt-1 text-sm text-red-600">{errors.date.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="time" className="block text-sm font-medium text-gray-700 mb-2">
                  Event Time *
                </label>
                <input
                  {...register('time')}
                  type="time"
                  id="time"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41] focus:border-transparent"
                />
                {errors.time && (
                  <p className="mt-1 text-sm text-red-600">{errors.time.message}</p>
                )}
              </div>
            </div>

            {/* Venue and Location */}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="venue" className="block text-sm font-medium text-gray-700 mb-2">
                  Venue Name *
                </label>
                <input
                  {...register('venue')}
                  type="text"
                  id="venue"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41] focus:border-transparent"
                  placeholder="e.g., Convention Center, Online"
                />
                {errors.venue && (
                  <p className="mt-1 text-sm text-red-600">{errors.venue.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                  <MapPin className="inline h-4 w-4 mr-1" />
                  Location *
                </label>
                <input
                  {...register('location')}
                  type="text"
                  id="location"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41] focus:border-transparent"
                  placeholder="City, State or Online"
                />
                {errors.location && (
                  <p className="mt-1 text-sm text-red-600">{errors.location.message}</p>
                )}
              </div>
            </div>

            {/* Max Attendees */}
            <div>
              <label htmlFor="max_attendees" className="block text-sm font-medium text-gray-700 mb-2">
                <Users className="inline h-4 w-4 mr-1" />
                Maximum Attendees *
              </label>
              <input
                {...register('max_attendees')}
                type="number"
                id="max_attendees"
                min="1"
                max="10000"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41] focus:border-transparent"
                placeholder="100"
                onChange={(e) => {
                  // Update seat config when max attendees changes
                  const value = parseInt(e.target.value) || 100
                  if (seatConfig.enabled) {
                    setSeatConfig(prev => ({ ...prev, totalSeats: value }))
                  }
                }}
              />
              {errors.max_attendees && (
                <p className="mt-1 text-sm text-red-600">{errors.max_attendees.message}</p>
              )}
            </div>

            {/* Seat Configuration */}
            <div>
              <SeatConfiguration 
                value={seatConfig}
                onChange={setSeatConfig}
                basePrice={watchedPrice || 0}
              />
            </div>

            {/* Ticket Template Configuration - Optional */}
            <div>
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="p-4 border-b border-gray-200">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enableTicketTemplate}
                      onChange={(e) => setEnableTicketTemplate(e.target.checked)}
                      className="mr-3 h-4 w-4 text-[#0b6d41] rounded focus:ring-[#0b6d41]"
                    />
                    <span className="text-lg font-semibold text-gray-900">Enable Ticket Template Customization (Optional)</span>
                  </label>
                  <p className="text-sm text-gray-500 mt-1 ml-7">Customize the appearance and terms for your event tickets</p>
                </div>
                {enableTicketTemplate && (
                  <div className="p-1">
                    <SimpleTicketConfigurator
                      config={ticketConfig}
                      onChange={setTicketConfig}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-6 border-t border-gray-200">
              <button
                type="submit"
                disabled={isSubmitting || isUploading}
                className="w-full bg-gradient-to-r from-[#0b6d41] to-[#15a862] text-white py-4 px-6 rounded-lg font-semibold text-lg hover:from-[#0a5d37] to-[#138a56] focus:outline-none focus:ring-2 focus:ring-[#0b6d41] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02]"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Updating Event...
                  </span>
                ) : (
                  'Update Event'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}