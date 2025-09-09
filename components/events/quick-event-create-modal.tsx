'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { X, Upload, Calendar, MapPin, Users, IndianRupee, FileUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { eventCategories } from '@/lib/validations/event'
import TicketTiersManager, { TicketTier } from '@/components/events/ticket-tiers-manager'

interface QuickEventCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export default function QuickEventCreateModal({ isOpen, onClose, onSuccess }: QuickEventCreateModalProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [bulkFile, setBulkFile] = useState<File | null>(null)
  const bulkInputRef = useRef<HTMLInputElement>(null)
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    date: '',
    time: '',
    venue: '',
    location: '',
    price: 0,
    max_attendees: 100,
    useTicketTiers: false
  })
  
  const [ticketTiers, setTicketTiers] = useState<TicketTier[]>([])
  const [errors, setErrors] = useState<any>({})

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'price' || name === 'max_attendees' ? Number(value) : value
    }))
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev: any) => ({ ...prev, [name]: '' }))
    }
  }

  const validateForm = () => {
    const newErrors: any = {}
    
    // Only title and description are required
    if (!formData.title.trim()) {
      newErrors.title = 'Event title is required'
    }
    if (!formData.description.trim()) {
      newErrors.description = 'Event description is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleBulkUpload = async () => {
    if (!bulkFile) return

    const formData = new FormData()
    formData.append('file', bulkFile)

    try {
      setIsSubmitting(true)
      const response = await fetch('/api/events/bulk-upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Bulk upload failed')
      }

      const result = await response.json()
      alert(`Successfully uploaded ${result.success} events`)
      onClose()
      if (onSuccess) onSuccess()
      router.refresh()
    } catch (error) {
      console.error('Bulk upload error:', error)
      alert('Failed to upload events. Please check your file format.')
    } finally {
      setIsSubmitting(false)
      setBulkFile(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        alert('Please sign in to create an event')
        router.push('/auth/login')
        return
      }

      // Set default values for optional fields
      const eventData = {
        ...formData,
        date: formData.date || new Date().toISOString().split('T')[0],
        venue: formData.venue || 'TBA',
        location: formData.location || 'TBA',
        category: formData.category || 'community',
        // Add bulk ticket generation flag
        enable_bulk_tickets: true
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
        throw new Error(error.error || 'Failed to create event')
      }

      const { event } = await response.json()
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        category: '',
        date: '',
        time: '',
        venue: '',
        location: '',
        price: 0,
        max_attendees: 100
      })
      
      onClose()
      if (onSuccess) onSuccess()
      
      // Navigate to the created event
      router.push(`/events/${event.id}?message=Event created successfully!`)
    } catch (error) {
      console.error('Error creating event:', error)
      alert(error instanceof Error ? error.message : 'Failed to create event')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Quick Event Creation
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Bulk Upload Section */}
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-blue-900 flex items-center">
                  <FileUp className="h-5 w-5 mr-2" />
                  Bulk Upload Option
                </h4>
                {bulkFile && (
                  <button
                    onClick={() => setBulkFile(null)}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Remove file
                  </button>
                )}
              </div>
              <p className="text-sm text-blue-700 mb-3">
                Upload multiple events at once using a CSV file
              </p>
              <input
                ref={bulkInputRef}
                type="file"
                accept=".csv"
                onChange={(e) => setBulkFile(e.target.files?.[0] || null)}
                className="hidden"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => bulkInputRef.current?.click()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                  {bulkFile ? bulkFile.name : 'Choose CSV File'}
                </button>
                {bulkFile && (
                  <button
                    type="button"
                    onClick={handleBulkUpload}
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50"
                  >
                    {isSubmitting ? 'Uploading...' : 'Upload Events'}
                  </button>
                )}
              </div>
              <p className="text-xs text-blue-600 mt-2">
                CSV format: title, description, date, venue, location, price, capacity, category
              </p>
            </div>

            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">OR create single event</span>
              </div>
            </div>

            {/* Event Creation Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Required Fields */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Event Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                  placeholder="Enter event title"
                />
                {errors.title && (
                  <p className="mt-1 text-sm text-red-600">{errors.title}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                  placeholder="Describe your event"
                />
                {errors.description && (
                  <p className="mt-1 text-sm text-red-600">{errors.description}</p>
                )}
              </div>

              {/* Optional Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category <span className="text-xs text-gray-500">(Optional)</span>
                  </label>
                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                  >
                    <option value="">Select category</option>
                    {eventCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Calendar className="inline h-4 w-4 mr-1" />
                    Date <span className="text-xs text-gray-500">(Optional)</span>
                  </label>
                  <input
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Time <span className="text-xs text-gray-500">(Optional)</span>
                  </label>
                  <input
                    type="time"
                    name="time"
                    value={formData.time}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <MapPin className="inline h-4 w-4 mr-1" />
                    Venue <span className="text-xs text-gray-500">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    name="venue"
                    value={formData.venue}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                    placeholder="Venue name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location <span className="text-xs text-gray-500">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    name="location"
                    value={formData.location}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                    placeholder="City, State"
                  />
                </div>

              </div>

              {/* Pricing Configuration */}
              <div className="border-t pt-4 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-gray-700">
                    Use Tiered Ticket Pricing
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, useTicketTiers: !prev.useTicketTiers }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      formData.useTicketTiers ? 'bg-[#0b6d41]' : 'bg-gray-200'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      formData.useTicketTiers ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>

                {formData.useTicketTiers ? (
                  <div className="mt-4">
                    <TicketTiersManager 
                      tiers={ticketTiers}
                      onChange={setTicketTiers}
                      currency="₹"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <IndianRupee className="inline h-4 w-4 mr-1" />
                        Single Price <span className="text-xs text-gray-500">(Optional)</span>
                      </label>
                      <input
                        type="number"
                        name="price"
                        value={formData.price}
                        onChange={handleChange}
                        min="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Users className="inline h-4 w-4 mr-1" />
                        Total Capacity
                      </label>
                      <input
                        type="number"
                        name="max_attendees"
                        value={formData.max_attendees}
                        onChange={handleChange}
                        min="1"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                        placeholder="100"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-5 sm:mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 inline-flex justify-center rounded-lg border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0b6d41]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-[#0b6d41] text-base font-medium text-white hover:bg-[#0a5d37] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0b6d41] disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}