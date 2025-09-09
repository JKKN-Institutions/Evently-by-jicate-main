'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Calendar, MapPin, Users, IndianRupee, Image as ImageIcon, LogIn, Upload, X, CheckCircle } from 'lucide-react'
import { eventFormSchema, type EventFormData, eventCategories } from '@/lib/validations/event'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import ImageUploadDropzone from './image-upload-dropzone'
import SeatConfiguration from '@/components/events/SeatConfiguration'
import type { SeatConfig } from '@/components/events/SeatConfiguration'
import EnhancedTicketTemplate, { type TicketTemplate } from '@/components/events/enhanced-ticket-template'
import { compressImage, validateImageFile } from '@/lib/image-utils'
import { BulkEventUpload } from '@/components/organizer/bulk-event-upload'
import TicketTypesManager, { type TicketType } from '@/components/events/ticket-types-manager'

export default function CreateEventPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [isUploading, setIsUploading] = useState(false)
  const submissionRef = useRef(false)
  const [seatConfig, setSeatConfig] = useState<SeatConfig>({
    enabled: false,
    totalSeats: 100,
    layoutType: 'sequential'
  })

  const [ticketGenerationType, setTicketGenerationType] = useState<'system' | 'predefined' | null>(null)
  const [enableTicketTemplate, setEnableTicketTemplate] = useState(false)
  const [predefinedTicketFile, setPredefinedTicketFile] = useState<File | null>(null)
  const [predefinedTicketPreview, setPredefinedTicketPreview] = useState<string>('')
  
  // Multi-ticket pricing state
  const [useMultiTicketPricing, setUseMultiTicketPricing] = useState(false)
  const [ticketTypes, setTicketTypes] = useState<TicketType[]>([])

  const [ticketTemplate, setTicketTemplate] = useState<TicketTemplate>({
    // Event Branding
    eventName: '',
    themeColor: '#0b6d41',
    secondaryColor: '#15a862',
    
    // Ticket Details
    ticketTypes: [
      {
        name: 'General Admission',
        price: 0,
        color: '#0b6d41',
        benefits: []
      }
    ],
    includeQRCode: true, // QR Code enabled by default
    includeBarcodeNumber: true,
    seatAllocation: 'none',
    
    // Event Information (will be filled from form)
    eventDate: '',
    eventTime: '',
    venue: '',
    location: '',
    entryTime: '',
    gateDetails: '',
    
    // Attendee Information
    showAttendeeName: true,
    showContactInfo: false,
    showRegistrationId: true,
    
    // Pricing & Terms
    currency: 'INR',
    showPrice: true,
    refundPolicy: 'no-refunds',
    idProofRequired: true,
    nonTransferable: true,
    additionalTerms: [
      'This ticket is valid for one-time entry only',
      'Please carry a valid government-issued ID proof',
      'Entry subject to security check'
    ],
    
    // Security & Verification
    enableWatermark: true,
    enableHologram: false,
    verificationMethod: 'qr',
    
    // Additional Info
    organizerName: '',
    organizerContact: '',
    organizerEmail: '',
    sponsorLogos: [],
    socialMedia: {
      website: '',
      instagram: '',
      twitter: '',
      facebook: '',
      linkedin: ''
    },
    
    // Layout
    layoutStyle: 'modern'
  })
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch
  } = useForm({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: '',
      description: '',
      date: '',
      time: '',
      venue: '',
      location: '',
      price: 0,
      max_attendees: 100,
      category: '',
      image_url: ''
    }
  })

  const watchedValues = watch()
  const watchedImageUrl = watchedValues.image_url
  const watchedPrice = watchedValues.price
  const supabase = useMemo(() => createClient(), [])

  const checkUserAndRole = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    setLoading(false)
    
    // If no user, redirect to events page with login prompt
    if (!user) {
      router.push('/events?message=Please sign in to create an event. Fill in your organizer details to get started.')
      return
    }

    // Check if user has organizer or admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    const userRole = (profile as { role: string } | null)?.role || 'user'
    
    if (userRole !== 'organizer' && userRole !== 'admin') {
      router.push('/profile/upgrade-to-organizer?message=You need to become an organizer to create events.')
      return
    }
  }, [supabase, router])

  useEffect(() => {
    checkUserAndRole()
    
    // Load saved draft if exists
    const savedDraft = localStorage.getItem('eventDraft')
    if (savedDraft) {
      try {
        const draftData = JSON.parse(savedDraft)
        const loadDraft = confirm('Found a saved draft. Would you like to load it?')
        if (loadDraft) {
          Object.keys(draftData).forEach(key => {
            setValue(key as any, draftData[key])
          })
        }
      } catch (error) {
        console.error('Failed to load draft:', error)
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) {
        router.push('/events?message=Please sign in to create an event. Fill in your organizer details to get started.')
      } else {
        checkUserAndRole()
      }
    })

    return () => subscription.unsubscribe()
  }, [checkUserAndRole, supabase.auth, router])

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

      // Validate image file
      const validation = validateImageFile(file)
      if (!validation.valid) {
        alert(validation.error)
        setIsUploading(false)
        return null
      }

      // Simulate progress for compression
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + 20
        })
      }, 100)

      // Compress image to reduce size
      console.log('Compressing image...')
      const compressed = await compressImage(file, 1200, 800, 0.8)
      
      clearInterval(progressInterval)
      setUploadProgress(100)
      
      // Store as base64 for database storage
      // Will be saved with the event data
      const dataUrl = `data:${compressed.mimeType};base64,${compressed.base64}`
      
      setTimeout(() => {
        setIsUploading(false)
        setUploadProgress(0)
      }, 500)
      
      console.log('Image compressed successfully, size:', compressed.size)
      return dataUrl
      
    } catch (error) {
      console.error('Error processing image:', error)
      setIsUploading(false)
      setUploadProgress(0)
      
      // Don't throw - allow event creation without image
      alert('Image processing failed. Event will be created without an image.')
      return null
    }
  }

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0b6d41] mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
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
          <p className="text-gray-600 mb-6">Please sign in to create an event. Fill in your organizer details to get started.</p>
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

  const onSubmit = async (data: EventFormData) => {
    // Prevent multiple submissions using ref
    if (submissionRef.current || isSubmitting) {
      console.log('Already submitting, ignoring duplicate submission')
      return
    }
    
    submissionRef.current = true
    console.log('Form submitted with data:', data)
    
    // Add confirmation before submitting
    const confirmSubmit = confirm(
      `Are you ready to create the event "${data.title}"?\n\n` +
      `Date: ${data.date}\n` +
      `Venue: ${data.venue}\n` +
      `Price: ${data.price ? `₹${data.price}` : 'Free'}\n\n` +
      'Click OK to create the event or Cancel to continue editing.'
    )
    
    if (!confirmSubmit) {
      submissionRef.current = false
      return // User wants to continue editing
    }
    
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
            'Image upload failed. Would you like to create the event without an image? You can add an image later by editing the event.'
          )
          if (!continueWithoutImage) {
            setIsSubmitting(false)
            return
          }
          // Continue with event creation without image
          finalImageUrl = null
        }
      }


      // Handle ticket configuration based on type
      let completeTicketTemplate = null
      let predefinedTicketUrl = null
      
      if (ticketGenerationType === 'system' && enableTicketTemplate) {
        // System-generated ticket template
        completeTicketTemplate = {
          ...ticketTemplate,
          eventName: data.title,

          eventDate: data.date,
          eventTime: data.time,
          venue: data.venue,
          location: data.location,

          includeQRCode: true,
          verificationMethod: 'qr' as const,

          ticketTypes: ticketTemplate.ticketTypes.map(type => ({
            ...type,
            price: type.name === 'General Admission' ? (data.price || 0) : type.price
          }))
        }

      } else if (ticketGenerationType === 'predefined' && predefinedTicketFile) {
        // Upload predefined ticket template
        try {
          const uploadedTicket = await uploadImage(predefinedTicketFile)
          if (uploadedTicket) {
            predefinedTicketUrl = uploadedTicket
          }
        } catch (error) {
          console.error('Failed to upload predefined ticket:', error)
          alert('Failed to upload predefined ticket template')
          setIsSubmitting(false)
          submissionRef.current = false
          return
        }

      }

      const eventData = {
        ...data,
        image_url: finalImageUrl || null,
        seat_config: seatConfig,
        ticket_generation_type: ticketGenerationType,
        ticket_template: completeTicketTemplate,
        predefined_ticket_url: predefinedTicketUrl,
        // Add ticket types data
        use_multi_ticket_pricing: useMultiTicketPricing,
        ticket_types: useMultiTicketPricing ? ticketTypes : []
      }
      
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventData),
      })

      if (!response.ok) {
        const error = await response.json()
        if (response.status === 401) {
          alert('Please sign in to create an event')
          return
        }
        throw new Error(error.error || 'Failed to create event')
      }

      const { event } = await response.json()
      router.push(`/events/${event.id}?message=Event created successfully!`)
    } catch (error) {
      console.error('Error creating event:', error)
      alert(error instanceof Error ? error.message : 'Failed to create event. Please check your connection and try again.')
    } finally {
      setIsSubmitting(false)
      submissionRef.current = false
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Modern Header */}
      <header className="bg-white/95 backdrop-blur-md shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
            <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-[#0b6d41] to-[#15a862] bg-clip-text text-transparent">
              Evently
            </Link>
              <div className="hidden sm:block h-6 w-px bg-gray-300"></div>
              <h1 className="text-lg font-semibold text-gray-900">
                <span className="hidden sm:inline">Create Event</span>
                <span className="sm:hidden">Create</span>
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <BulkEventUpload onUploadSuccess={() => router.push('/organizer/my-events')} />
              <Link
                href="/events"
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Events
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 border border-gray-100">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Event</h1>
            <p className="text-gray-600">Share your event with the world and bring people together</p>
          </div>

          <form 
            onSubmit={handleSubmit(onSubmit, (errors) => {
              console.log('Form validation errors:', errors)
              // Don't show alert for validation errors - let the inline error messages handle it
              // Only focus on the first error field
              const firstErrorField = Object.keys(errors)[0]
              if (firstErrorField) {
                const element = document.getElementById(firstErrorField)
                if (element) {
                  element.focus()
                  element.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }
              }
            })} 
            onKeyDown={(e) => {
              // Prevent form submission on Enter key except in textarea
              if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
                e.preventDefault()
              }
            }}
            className="space-y-8">
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

            </div>

            {/* Ticket Pricing Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Ticket Pricing Mode
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    {useMultiTicketPricing ? 'Multiple ticket types with different prices' : 'Single price for all tickets'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setUseMultiTicketPricing(!useMultiTicketPricing)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    useMultiTicketPricing ? 'bg-[#0b6d41]' : 'bg-gray-200'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    useMultiTicketPricing ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
              
              {useMultiTicketPricing ? (
                // Multi-ticket pricing component
                <TicketTypesManager
                  ticketTypes={ticketTypes}
                  onChange={setTicketTypes}
                  maxAttendees={watch('max_attendees') || 100}
                />
              ) : (
                // Single price field
                <div>
                  <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-2">
                    <IndianRupee className="inline h-4 w-4 mr-1" />
                    Ticket Price (INR)
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
              )}
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
                  Event Time <span className="text-gray-500 text-xs">(Optional)</span>
                </label>
                <input
                  {...register('time')}
                  type="time"
                  id="time"
                  placeholder="Leave blank if time not decided"
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


            {/* Ticket Generation Type Selection */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">🎟️ Ticket Generation Method</h3>
              <p className="text-sm text-gray-600 mb-4">Choose how you want to generate tickets for your event</p>
              
              <div className="space-y-3">
                {/* System Generated Tickets Option */}
                <label className="flex items-start p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                  style={{borderColor: ticketGenerationType === 'system' ? '#0b6d41' : '#e5e7eb'}}>
                  <input
                    type="radio"
                    name="ticketType"
                    value="system"
                    checked={ticketGenerationType === 'system'}
                    onChange={() => {
                      setTicketGenerationType('system')
                      setEnableTicketTemplate(true)
                      setPredefinedTicketFile(null)
                      setPredefinedTicketPreview('')
                    }}
                    className="mt-1 mr-3 text-[#0b6d41]"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">Enhanced System Generated Tickets</div>
                    <p className="text-sm text-gray-500 mt-1">
                      Use our advanced ticket generator with QR codes, security features, and professional design templates
                    </p>
                  </div>
                </label>

                {/* Predefined Tickets Option */}
                <label className="flex items-start p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                  style={{borderColor: ticketGenerationType === 'predefined' ? '#0b6d41' : '#e5e7eb'}}>
                  <input
                    type="radio"
                    name="ticketType"
                    value="predefined"
                    checked={ticketGenerationType === 'predefined'}
                    onChange={() => {
                      setTicketGenerationType('predefined')
                      setEnableTicketTemplate(false)
                    }}
                    className="mt-1 mr-3 text-[#0b6d41]"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">Upload Predefined Ticket Design</div>
                    <p className="text-sm text-gray-500 mt-1">
                      Upload your own pre-designed ticket template. We'll add QR codes automatically for verification
                    </p>
                  </div>
                </label>

                {/* No Tickets Option */}
                <label className="flex items-start p-4 border-2 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                  style={{borderColor: ticketGenerationType === null ? '#0b6d41' : '#e5e7eb'}}>
                  <input
                    type="radio"
                    name="ticketType"
                    value="none"
                    checked={ticketGenerationType === null}
                    onChange={() => {
                      setTicketGenerationType(null)
                      setEnableTicketTemplate(false)
                      setPredefinedTicketFile(null)
                      setPredefinedTicketPreview('')
                    }}
                    className="mt-1 mr-3 text-[#0b6d41]"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">No Ticket Generation</div>
                    <p className="text-sm text-gray-500 mt-1">
                      Handle tickets manually or use external ticketing system
                    </p>
                  </div>
                </label>
              </div>

              {/* Predefined Ticket Upload Section */}
              {ticketGenerationType === 'predefined' && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Upload Your Ticket Design
                  </label>
                  
                  {!predefinedTicketPreview ? (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                      <Upload className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            setPredefinedTicketFile(file)
                            const preview = URL.createObjectURL(file)
                            setPredefinedTicketPreview(preview)
                          }
                        }}
                        className="hidden"
                        id="predefined-ticket-upload"
                      />
                      <label htmlFor="predefined-ticket-upload" className="cursor-pointer">
                        <span className="text-[#0b6d41] hover:text-[#0a5d37] font-medium">
                          Click to upload
                        </span>
                        <span className="text-gray-500"> or drag and drop</span>
                      </label>
                      <p className="text-xs text-gray-500 mt-2">PNG, JPG up to 10MB</p>
                      <p className="text-xs text-gray-500 mt-1">We'll add QR codes to your design automatically</p>
                    </div>
                  ) : (
                    <div className="relative">
                      <img 
                        src={predefinedTicketPreview} 
                        alt="Ticket preview" 
                        className="w-full rounded-lg shadow-md"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setPredefinedTicketFile(null)
                          setPredefinedTicketPreview('')
                          if (predefinedTicketPreview.startsWith('blob:')) {
                            URL.revokeObjectURL(predefinedTicketPreview)
                          }
                        }}
                        className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-800">
                          <CheckCircle className="inline h-4 w-4 mr-1" />
                          QR codes will be automatically added to your ticket design for verification
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Enhanced Ticket Template Configuration - Only show for system tickets */}
            {ticketGenerationType === 'system' && (
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="p-1">
                  <EnhancedTicketTemplate
                    template={ticketTemplate}
                    onChange={setTicketTemplate}
                    eventData={{
                      name: watchedValues.title,
                      date: watchedValues.date,
                      time: watchedValues.time,
                      venue: watchedValues.venue,
                      location: watchedValues.location,
                      price: watchedValues.price
                    }}
                  />
                </div>
              </div>
            )}


            {/* Submit Buttons */}
            <div className="pt-6 border-t border-gray-200">
              <div className="flex gap-4">
                {/* Save Draft Button */}
                <button
                  type="button"
                  onClick={() => {
                    const formData = watch()
                    localStorage.setItem('eventDraft', JSON.stringify(formData))
                    alert('Event draft saved! You can continue editing later.')
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 py-4 px-6 rounded-lg font-semibold text-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 transition-all duration-200"
                >
                  Save Draft
                </button>
                
                {/* Create Event Button */}
                <button
                  type="submit"
                  disabled={isSubmitting || isUploading}
                  className="flex-1 bg-gradient-to-r from-[#0b6d41] to-[#15a862] text-white py-4 px-6 rounded-lg font-semibold text-lg hover:from-[#0a5d37] hover:to-[#138a56] focus:outline-none focus:ring-2 focus:ring-[#0b6d41] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02]"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Creating Event...
                    </span>
                  ) : (
                    'Create Event'
                  )}
                </button>
              </div>
              
              {/* Help Text */}
              <p className="mt-3 text-sm text-gray-500 text-center">
                💡 Tip: Press "Save Draft" to save your progress and continue later
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}