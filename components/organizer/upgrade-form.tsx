'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { User } from '@supabase/supabase-js'
import { Building2, MapPin, Phone, Mail, Globe, Users, FileText } from 'lucide-react'

interface OrganizerUpgradeFormProps {
  user: User
  currentProfile: {
    full_name?: string
    phone?: string
    bio?: string
    website?: string
    company_name?: string
    address?: string
    city?: string
    state?: string
    country?: string
    postal_code?: string
  }
}

export default function OrganizerUpgradeForm({ user, currentProfile }: OrganizerUpgradeFormProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    full_name: currentProfile?.full_name || '',
    company_name: '',
    company_description: '',
    company_website: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    country: '',
    experience_years: '',
    event_types: [] as string[],
    previous_events: '',
    social_media: {
      facebook: '',
      instagram: '',
      twitter: '',
      linkedin: ''
    }
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const router = useRouter()
  const supabase = createClient()

  const eventTypeOptions = [
    'Conferences', 'Workshops', 'Seminars', 'Concerts', 'Festivals', 
    'Sports Events', 'Corporate Events', 'Weddings', 'Parties', 
    'Exhibitions', 'Trade Shows', 'Networking Events'
  ]

  const handleEventTypeToggle = (eventType: string) => {
    setFormData(prev => ({
      ...prev,
      event_types: prev.event_types.includes(eventType)
        ? prev.event_types.filter(type => type !== eventType)
        : [...prev.event_types, eventType]
    }))
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.full_name.trim()) newErrors.full_name = 'Full name is required'
    if (!formData.company_name.trim()) newErrors.company_name = 'Company name is required'
    if (!formData.company_description.trim()) newErrors.company_description = 'Company description is required'
    if (!formData.phone.trim()) newErrors.phone = 'Phone number is required'
    if (!formData.address.trim()) newErrors.address = 'Address is required'
    if (!formData.city.trim()) newErrors.city = 'City is required'
    if (!formData.country.trim()) newErrors.country = 'Country is required'
    if (!formData.experience_years) newErrors.experience_years = 'Experience is required'
    if (formData.event_types.length === 0) newErrors.event_types = 'Select at least one event type'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setLoading(true)
    try {
      // Update profile to organizer role
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          role: 'organizer',
          full_name: formData.full_name
        })
        .eq('id', user.id)

      if (profileError) throw profileError

      // Create organizer profile
      const { error: organizerError } = await supabase
        .from('organizer_profiles')
        .insert({
          user_id: user.id,
          company_name: formData.company_name,
          company_description: formData.company_description,
          company_website: formData.company_website || null,
          phone: formData.phone,
          address: formData.address,
          city: formData.city,
          state: formData.state || null,
          country: formData.country,
          experience_years: parseInt(formData.experience_years),
          event_types: formData.event_types,
          previous_events: formData.previous_events || null,
          social_media: formData.social_media,
          status: 'pending' // Admin approval required
        })

      if (organizerError) throw organizerError

      // Success - redirect to organizer dashboard
      router.push('/organizer/dashboard?welcome=true')
    } catch (error) {
      console.error('Error upgrading to organizer:', error)
      setErrors({ submit: 'Failed to upgrade profile. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Personal Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Users className="h-5 w-5 text-[#0b6d41]" />
          Personal Information
        </h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Full Name *
          </label>
          <input
            type="text"
            value={formData.full_name}
            onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0b6d41] focus:border-transparent"
            placeholder="Your full name"
          />
          {errors.full_name && <p className="text-red-500 text-sm mt-1">{errors.full_name}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Phone Number *
          </label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0b6d41] focus:border-transparent"
            placeholder="+1 (555) 123-4567"
          />
          {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
        </div>
      </div>

      {/* Company Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Building2 className="h-5 w-5 text-[#0b6d41]" />
          Company Information
        </h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Company Name *
          </label>
          <input
            type="text"
            value={formData.company_name}
            onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0b6d41] focus:border-transparent"
            placeholder="Your company or organization name"
          />
          {errors.company_name && <p className="text-red-500 text-sm mt-1">{errors.company_name}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Company Description *
          </label>
          <textarea
            value={formData.company_description}
            onChange={(e) => setFormData(prev => ({ ...prev, company_description: e.target.value }))}
            rows={4}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0b6d41] focus:border-transparent"
            placeholder="Describe your company and what types of events you organize..."
          />
          {errors.company_description && <p className="text-red-500 text-sm mt-1">{errors.company_description}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Company Website
          </label>
          <input
            type="url"
            value={formData.company_website}
            onChange={(e) => setFormData(prev => ({ ...prev, company_website: e.target.value }))}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0b6d41] focus:border-transparent"
            placeholder="https://yourcompany.com"
          />
        </div>
      </div>

      {/* Address Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <MapPin className="h-5 w-5 text-[#0b6d41]" />
          Address Information
        </h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Address *
          </label>
          <input
            type="text"
            value={formData.address}
            onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0b6d41] focus:border-transparent"
            placeholder="Street address"
          />
          {errors.address && <p className="text-red-500 text-sm mt-1">{errors.address}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              City *
            </label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0b6d41] focus:border-transparent"
              placeholder="City"
            />
            {errors.city && <p className="text-red-500 text-sm mt-1">{errors.city}</p>}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              State/Province
            </label>
            <input
              type="text"
              value={formData.state}
              onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0b6d41] focus:border-transparent"
              placeholder="State/Province"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Country *
          </label>
          <input
            type="text"
            value={formData.country}
            onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0b6d41] focus:border-transparent"
            placeholder="Country"
          />
          {errors.country && <p className="text-red-500 text-sm mt-1">{errors.country}</p>}
        </div>
      </div>

      {/* Experience Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <FileText className="h-5 w-5 text-[#0b6d41]" />
          Experience & Expertise
        </h3>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Years of Experience *
          </label>
          <select
            value={formData.experience_years}
            onChange={(e) => setFormData(prev => ({ ...prev, experience_years: e.target.value }))}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0b6d41] focus:border-transparent"
          >
            <option value="">Select experience level</option>
            <option value="0">Just starting out</option>
            <option value="1">1-2 years</option>
            <option value="3">3-5 years</option>
            <option value="6">6-10 years</option>
            <option value="11">10+ years</option>
          </select>
          {errors.experience_years && <p className="text-red-500 text-sm mt-1">{errors.experience_years}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Event Types You Organize *
          </label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {eventTypeOptions.map((type) => (
              <label key={type} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.event_types.includes(type)}
                  onChange={() => handleEventTypeToggle(type)}
                  className="rounded border-gray-300 text-[#0b6d41] focus:ring-[#0b6d41]"
                />
                <span className="text-sm text-gray-700">{type}</span>
              </label>
            ))}
          </div>
          {errors.event_types && <p className="text-red-500 text-sm mt-1">{errors.event_types}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Previous Notable Events
          </label>
          <textarea
            value={formData.previous_events}
            onChange={(e) => setFormData(prev => ({ ...prev, previous_events: e.target.value }))}
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0b6d41] focus:border-transparent"
            placeholder="List some notable events you've organized (optional)..."
          />
        </div>
      </div>

      {errors.submit && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-600 text-sm">{errors.submit}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-gradient-to-r from-[#0b6d41] to-[#0f7a4a] text-white py-4 px-6 rounded-xl font-semibold hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Upgrading Profile...' : 'Become an Organizer'}
      </button>

      <p className="text-sm text-gray-500 text-center">
        Your organizer application will be reviewed by our team. You&apos;ll receive an email confirmation once approved.
      </p>
    </form>
  )
}
