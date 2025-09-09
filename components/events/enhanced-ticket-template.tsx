'use client'

import React, { useState } from 'react'
import { 
  Ticket, 
  Palette, 
  Settings, 
  Shield, 
  FileText, 
  Users, 
  Building2, 
  Phone, 
  Globe, 
  Instagram, 
  Twitter, 
  Facebook,
  Linkedin,
  QrCode,
  MapPin,
  Calendar,
  Clock,
  CreditCard,
  Info,
  Eye,
  EyeOff
} from 'lucide-react'

export interface TicketTemplate {
  // Event Branding
  eventName: string
  eventLogo?: string
  themeColor: string
  secondaryColor: string
  
  // Ticket Details
  ticketTypes: {
    name: string
    price: number
    color: string
    benefits?: string[]
  }[]
  includeQRCode: boolean
  includeBarcodeNumber: boolean
  seatAllocation: 'none' | 'zone' | 'specific'
  
  // Event Information
  eventDate: string
  eventTime: string
  venue: string
  location: string
  entryTime?: string
  gateDetails?: string
  
  // Attendee Information
  showAttendeeName: boolean
  showContactInfo: boolean
  showRegistrationId: boolean
  
  // Pricing & Terms
  currency: string
  showPrice: boolean
  refundPolicy: string
  ageRestriction?: string
  idProofRequired: boolean
  nonTransferable: boolean
  additionalTerms: string[]
  
  // Security & Verification
  enableWatermark: boolean
  enableHologram: boolean
  verificationMethod: 'qr' | 'barcode' | 'both'
  
  // Additional Info
  organizerName: string
  organizerContact: string
  organizerEmail?: string
  sponsorLogos?: string[]
  socialMedia: {
    website?: string
    instagram?: string
    twitter?: string
    facebook?: string
    linkedin?: string
  }
  
  // Layout
  layoutStyle: 'classic' | 'modern' | 'minimal' | 'premium'
}

interface EnhancedTicketTemplateProps {
  template: TicketTemplate
  onChange: (template: TicketTemplate) => void
  eventData?: {
    name?: string
    date?: string
    time?: string
    venue?: string
    location?: string
    price?: number
  }
}

export default function EnhancedTicketTemplate({ 
  template, 
  onChange,
  eventData 
}: EnhancedTicketTemplateProps) {
  const [activeTab, setActiveTab] = useState('branding')
  const [showPreview, setShowPreview] = useState(false)

  const updateTemplate = (field: keyof TicketTemplate | string, value: any) => {
    if (field.includes('.')) {
      const keys = field.split('.')
      const newTemplate = { ...template }
      let current: any = newTemplate
      
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]]
      }
      current[keys[keys.length - 1]] = value
      
      onChange(newTemplate)
    } else {
      onChange({
        ...template,
        [field]: value
      })
    }
  }

  const addTicketType = () => {
    onChange({
      ...template,
      ticketTypes: [
        ...template.ticketTypes,
        {
          name: 'New Ticket Type',
          price: 0,
          color: '#6B46C1',
          benefits: []
        }
      ]
    })
  }

  const updateTicketType = (index: number, field: string, value: any) => {
    const newTypes = [...template.ticketTypes]
    newTypes[index] = { ...newTypes[index], [field]: value }
    onChange({ ...template, ticketTypes: newTypes })
  }

  const removeTicketType = (index: number) => {
    onChange({
      ...template,
      ticketTypes: template.ticketTypes.filter((_, i) => i !== index)
    })
  }

  const tabs = [
    { id: 'branding', label: 'Branding', icon: Palette },
    { id: 'details', label: 'Ticket Details', icon: Ticket },
    { id: 'event', label: 'Event Info', icon: Calendar },
    { id: 'attendee', label: 'Attendee Info', icon: Users },
    { id: 'terms', label: 'Terms & Pricing', icon: FileText },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'additional', label: 'Additional Info', icon: Info },
    { id: 'layout', label: 'Layout', icon: Settings }
  ]

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex flex-wrap gap-2 pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-[#0b6d41] text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Preview Toggle */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {showPreview ? 'Hide' : 'Show'} Preview
        </button>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {/* Branding Tab */}
        {activeTab === 'branding' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold mb-4">Event Branding</h3>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Event Name Override (Optional)
                </label>
                <input
                  type="text"
                  value={template.eventName}
                  onChange={(e) => updateTemplate('eventName', e.target.value)}
                  placeholder={eventData?.name || "Use event name from form"}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Event Logo (Optional)
                </label>
                {!template.eventLogo ? (
                  <div>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-[#0b6d41] transition-colors">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) {
                            if (file.size > 2 * 1024 * 1024) {
                              alert('Logo size should be less than 2MB')
                              return
                            }
                            const reader = new FileReader()
                            reader.onload = (event) => {
                              updateTemplate('eventLogo', event.target?.result as string)
                            }
                            reader.readAsDataURL(file)
                          }
                        }}
                        className="hidden"
                        id="ticket-logo-upload"
                      />
                      <label htmlFor="ticket-logo-upload" className="cursor-pointer">
                        <Building2 className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">Click to upload logo</p>
                        <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 2MB</p>
                      </label>
                    </div>
                    <div className="mt-2 text-center">
                      <span className="text-xs text-gray-500">OR</span>
                    </div>
                    <input
                      type="url"
                      value={template.eventLogo || ''}
                      onChange={(e) => updateTemplate('eventLogo', e.target.value)}
                      placeholder="Enter logo URL (https://example.com/logo.png)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0b6d41] text-sm"
                    />
                  </div>
                ) : (
                  <div className="relative border border-gray-300 rounded-lg p-3">
                    <img
                      src={template.eventLogo}
                      alt="Logo preview"
                      className="h-16 mx-auto object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => updateTemplate('eventLogo', '')}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                    >
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Primary Theme Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={template.themeColor}
                    onChange={(e) => updateTemplate('themeColor', e.target.value)}
                    className="w-12 h-10 rounded border border-gray-300"
                  />
                  <input
                    type="text"
                    value={template.themeColor}
                    onChange={(e) => updateTemplate('themeColor', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Secondary Color
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={template.secondaryColor}
                    onChange={(e) => updateTemplate('secondaryColor', e.target.value)}
                    className="w-12 h-10 rounded border border-gray-300"
                  />
                  <input
                    type="text"
                    value={template.secondaryColor}
                    onChange={(e) => updateTemplate('secondaryColor', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Ticket Details Tab */}
        {activeTab === 'details' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold mb-4">Ticket Configuration</h3>
            
            {/* Ticket Types */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-gray-700">Ticket Types</label>
                <button
                  type="button"
                  onClick={addTicketType}
                  className="px-3 py-1 bg-[#0b6d41] text-white rounded-md hover:bg-[#0a5d37] text-sm"
                >
                  Add Ticket Type
                </button>
              </div>
              
              <div className="space-y-4">
                {template.ticketTypes.map((type, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="grid md:grid-cols-3 gap-4">
                      <input
                        type="text"
                        value={type.name}
                        onChange={(e) => updateTicketType(index, 'name', e.target.value)}
                        placeholder="Ticket type name"
                        className="px-3 py-2 border border-gray-300 rounded-md"
                      />
                      <input
                        type="number"
                        value={type.price}
                        onChange={(e) => updateTicketType(index, 'price', parseFloat(e.target.value) || 0)}
                        placeholder="Price"
                        className="px-3 py-2 border border-gray-300 rounded-md"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={type.color}
                          onChange={(e) => updateTicketType(index, 'color', e.target.value)}
                          className="w-10 h-10 rounded border"
                        />
                        <button
                          type="button"
                          onClick={() => removeTicketType(index)}
                          className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-md"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ticket Features */}
            <div className="space-y-4">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={template.includeQRCode}
                  onChange={(e) => updateTemplate('includeQRCode', e.target.checked)}
                  className="h-4 w-4 text-[#0b6d41] rounded"
                />
                <span className="text-sm font-medium">Include QR Code for scanning</span>
              </label>
              
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={template.includeBarcodeNumber}
                  onChange={(e) => updateTemplate('includeBarcodeNumber', e.target.checked)}
                  className="h-4 w-4 text-[#0b6d41] rounded"
                />
                <span className="text-sm font-medium">Include Barcode/Ticket Number</span>
              </label>
            </div>

            {/* Seat Allocation */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Seat Allocation Type
              </label>
              <select
                value={template.seatAllocation}
                onChange={(e) => updateTemplate('seatAllocation', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="none">No Seat Allocation</option>
                <option value="zone">Zone/Section Based</option>
                <option value="specific">Specific Seat Numbers</option>
              </select>
            </div>
          </div>
        )}

        {/* Event Info Tab */}
        {activeTab === 'event' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold mb-4">Event Information</h3>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Entry Time (Optional)
                </label>
                <input
                  type="text"
                  value={template.entryTime || ''}
                  onChange={(e) => updateTemplate('entryTime', e.target.value)}
                  placeholder="e.g., Gates open at 6:00 PM"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Gate/Entry Details (Optional)
                </label>
                <input
                  type="text"
                  value={template.gateDetails || ''}
                  onChange={(e) => updateTemplate('gateDetails', e.target.value)}
                  placeholder="e.g., Enter through Gate A"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
          </div>
        )}

        {/* Attendee Info Tab */}
        {activeTab === 'attendee' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold mb-4">Attendee Information Display</h3>
            
            <div className="space-y-4">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={template.showAttendeeName}
                  onChange={(e) => updateTemplate('showAttendeeName', e.target.checked)}
                  className="h-4 w-4 text-[#0b6d41] rounded"
                />
                <span className="text-sm font-medium">Show Attendee Name on Ticket</span>
              </label>
              
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={template.showContactInfo}
                  onChange={(e) => updateTemplate('showContactInfo', e.target.checked)}
                  className="h-4 w-4 text-[#0b6d41] rounded"
                />
                <span className="text-sm font-medium">Show Contact Information</span>
              </label>
              
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={template.showRegistrationId}
                  onChange={(e) => updateTemplate('showRegistrationId', e.target.checked)}
                  className="h-4 w-4 text-[#0b6d41] rounded"
                />
                <span className="text-sm font-medium">Show Registration/Order ID</span>
              </label>
            </div>
          </div>
        )}

        {/* Terms & Pricing Tab */}
        {activeTab === 'terms' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold mb-4">Terms & Pricing</h3>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Currency
                </label>
                <select
                  value={template.currency}
                  onChange={(e) => updateTemplate('currency', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                </select>
              </div>
              
              <div>
                <label className="flex items-center gap-3 mt-8">
                  <input
                    type="checkbox"
                    checked={template.showPrice}
                    onChange={(e) => updateTemplate('showPrice', e.target.checked)}
                    className="h-4 w-4 text-[#0b6d41] rounded"
                  />
                  <span className="text-sm font-medium">Show Price on Ticket</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Refund Policy
              </label>
              <select
                value={template.refundPolicy}
                onChange={(e) => updateTemplate('refundPolicy', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="no-refunds">No Refunds</option>
                <option value="7-days">Refundable within 7 days</option>
                <option value="24-hours">Refundable within 24 hours</option>
                <option value="custom">Custom Policy</option>
              </select>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Age Restriction (Optional)
                </label>
                <input
                  type="text"
                  value={template.ageRestriction || ''}
                  onChange={(e) => updateTemplate('ageRestriction', e.target.value)}
                  placeholder="e.g., 18+ only"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              
              <div className="space-y-3 mt-2">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={template.idProofRequired}
                    onChange={(e) => updateTemplate('idProofRequired', e.target.checked)}
                    className="h-4 w-4 text-[#0b6d41] rounded"
                  />
                  <span className="text-sm font-medium">ID Proof Required</span>
                </label>
                
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={template.nonTransferable}
                    onChange={(e) => updateTemplate('nonTransferable', e.target.checked)}
                    className="h-4 w-4 text-[#0b6d41] rounded"
                  />
                  <span className="text-sm font-medium">Non-Transferable Ticket</span>
                </label>
              </div>
            </div>

            {/* Additional Terms */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Terms & Conditions
              </label>
              <div className="space-y-2">
                {template.additionalTerms.map((term, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={term}
                      onChange={(e) => {
                        const newTerms = [...template.additionalTerms]
                        newTerms[index] = e.target.value
                        updateTemplate('additionalTerms', newTerms)
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="Enter term"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        updateTemplate('additionalTerms', template.additionalTerms.filter((_, i) => i !== index))
                      }}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-md"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => updateTemplate('additionalTerms', [...template.additionalTerms, ''])}
                  className="px-3 py-1 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm"
                >
                  Add Term
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold mb-4">Security & Verification</h3>
            
            <div className="space-y-4">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={template.enableWatermark}
                  onChange={(e) => updateTemplate('enableWatermark', e.target.checked)}
                  className="h-4 w-4 text-[#0b6d41] rounded"
                />
                <span className="text-sm font-medium">Enable Security Watermark</span>
              </label>
              
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={template.enableHologram}
                  onChange={(e) => updateTemplate('enableHologram', e.target.checked)}
                  className="h-4 w-4 text-[#0b6d41] rounded"
                />
                <span className="text-sm font-medium">Enable Hologram Effect (for printed tickets)</span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Verification Method
              </label>
              <select
                value={template.verificationMethod}
                onChange={(e) => updateTemplate('verificationMethod', e.target.value as 'qr' | 'barcode' | 'both')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="qr">QR Code Only</option>
                <option value="barcode">Barcode Only</option>
                <option value="both">Both QR & Barcode</option>
              </select>
            </div>
          </div>
        )}

        {/* Additional Info Tab */}
        {activeTab === 'additional' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold mb-4">Additional Information</h3>
            
            {/* Organizer Info */}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Organizer Name
                </label>
                <input
                  type="text"
                  value={template.organizerName}
                  onChange={(e) => updateTemplate('organizerName', e.target.value)}
                  placeholder="Your organization name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Contact Number
                </label>
                <input
                  type="tel"
                  value={template.organizerContact}
                  onChange={(e) => updateTemplate('organizerContact', e.target.value)}
                  placeholder="+91 9876543210"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={template.organizerEmail || ''}
                  onChange={(e) => updateTemplate('organizerEmail', e.target.value)}
                  placeholder="contact@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>

            {/* Social Media */}
            <div>
              <h4 className="text-md font-medium mb-3">Social Media Links</h4>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-gray-500" />
                  <input
                    type="url"
                    value={template.socialMedia.website || ''}
                    onChange={(e) => updateTemplate('socialMedia.website', e.target.value)}
                    placeholder="Website URL"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <Instagram className="h-4 w-4 text-gray-500" />
                  <input
                    type="text"
                    value={template.socialMedia.instagram || ''}
                    onChange={(e) => updateTemplate('socialMedia.instagram', e.target.value)}
                    placeholder="Instagram handle"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <Twitter className="h-4 w-4 text-gray-500" />
                  <input
                    type="text"
                    value={template.socialMedia.twitter || ''}
                    onChange={(e) => updateTemplate('socialMedia.twitter', e.target.value)}
                    placeholder="Twitter handle"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                
                <div className="flex items-center gap-2">
                  <Facebook className="h-4 w-4 text-gray-500" />
                  <input
                    type="text"
                    value={template.socialMedia.facebook || ''}
                    onChange={(e) => updateTemplate('socialMedia.facebook', e.target.value)}
                    placeholder="Facebook page"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Layout Tab */}
        {activeTab === 'layout' && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold mb-4">Ticket Layout Style</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {['classic', 'modern', 'minimal', 'premium'].map((style) => (
                <label
                  key={style}
                  className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    template.layoutStyle === style
                      ? 'border-[#0b6d41] bg-green-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="layoutStyle"
                    value={style}
                    checked={template.layoutStyle === style}
                    onChange={(e) => updateTemplate('layoutStyle', e.target.value as any)}
                    className="sr-only"
                  />
                  <div className="text-center">
                    <div className="w-full h-20 bg-gray-100 rounded mb-2 flex items-center justify-center">
                      <Ticket className="h-8 w-8 text-gray-400" />
                    </div>
                    <span className="text-sm font-medium capitalize">{style}</span>
                  </div>
                  {template.layoutStyle === style && (
                    <div className="absolute top-2 right-2 h-4 w-4 bg-[#0b6d41] rounded-full flex items-center justify-center">
                      <span className="text-white text-xs">✓</span>
                    </div>
                  )}
                </label>
              ))}
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Layout Descriptions:</strong><br />
                • <strong>Classic:</strong> Traditional ticket design with all information clearly laid out<br />
                • <strong>Modern:</strong> Clean, contemporary design with bold typography<br />
                • <strong>Minimal:</strong> Simple, elegant design focusing on essential information<br />
                • <strong>Premium:</strong> Luxurious design with decorative elements and enhanced styling
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Live Preview */}
      {showPreview && <TicketPreview template={template} eventData={eventData} />}
    </div>
  )
}

// Ticket Preview Component
function TicketPreview({ 
  template, 
  eventData 
}: { 
  template: TicketTemplate
  eventData?: any 
}) {
  const getLayoutClass = () => {
    switch (template.layoutStyle) {
      case 'modern': return 'font-sans'
      case 'minimal': return 'font-light'
      case 'premium': return 'font-serif'
      default: return ''
    }
  }

  return (
    <div className="mt-6 bg-gray-100 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">Ticket Preview</h3>
      
      <div className={`bg-white rounded-lg shadow-lg overflow-hidden max-w-2xl mx-auto ${getLayoutClass()}`}>
        {/* Header Section */}
        <div 
          className="p-6 text-white relative"
          style={{ backgroundColor: template.themeColor }}
        >
          {template.enableWatermark && (
            <div className="absolute inset-0 opacity-10 flex items-center justify-center text-6xl font-bold rotate-45">
              VALID
            </div>
          )}
          
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div>
                {template.eventLogo && (
                  <div className="w-16 h-16 bg-white rounded-lg mb-3 flex items-center justify-center">
                    <span className="text-gray-400 text-xs">Logo</span>
                  </div>
                )}
                <h1 className="text-2xl font-bold">
                  {template.eventName || eventData?.name || 'Event Name'}
                </h1>
                {template.ticketTypes[0] && (
                  <span 
                    className="inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium"
                    style={{ 
                      backgroundColor: template.ticketTypes[0].color,
                      opacity: 0.9 
                    }}
                  >
                    {template.ticketTypes[0].name}
                  </span>
                )}
              </div>
              
              {template.includeQRCode && (
                <div className="bg-white p-2 rounded-lg">
                  <QrCode className="h-16 w-16 text-gray-800" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-6 grid md:grid-cols-2 gap-6">
          {/* Left Column - Event Info */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-gray-700">
              <Calendar className="h-4 w-4" />
              <span className="font-medium">
                {eventData?.date || 'Event Date'}
              </span>
            </div>
            
            <div className="flex items-center gap-2 text-gray-700">
              <Clock className="h-4 w-4" />
              <span>
                {eventData?.time || 'Event Time'}
                {template.entryTime && ` • ${template.entryTime}`}
              </span>
            </div>
            
            <div className="flex items-center gap-2 text-gray-700">
              <MapPin className="h-4 w-4" />
              <div>
                <div className="font-medium">{eventData?.venue || 'Venue Name'}</div>
                <div className="text-sm text-gray-500">{eventData?.location || 'Location'}</div>
                {template.gateDetails && (
                  <div className="text-sm text-gray-500 mt-1">{template.gateDetails}</div>
                )}
              </div>
            </div>

            {template.seatAllocation !== 'none' && (
              <div className="pt-2 border-t border-gray-200">
                <div className="font-medium text-gray-700">
                  {template.seatAllocation === 'zone' ? 'Zone: General' : 'Seat: A-15'}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Attendee & Pricing */}
          <div className="space-y-4">
            {template.showAttendeeName && (
              <div>
                <div className="text-sm text-gray-500">Attendee Name</div>
                <div className="font-medium">John Doe</div>
              </div>
            )}
            
            {template.showRegistrationId && (
              <div>
                <div className="text-sm text-gray-500">Registration ID</div>
                <div className="font-mono">REG-2025-001234</div>
              </div>
            )}
            
            {template.showPrice && template.ticketTypes[0] && (
              <div>
                <div className="text-sm text-gray-500">Ticket Price</div>
                <div className="text-xl font-bold" style={{ color: template.themeColor }}>
                  {template.currency === 'INR' ? '₹' : template.currency === 'USD' ? '$' : ''}
                  {template.ticketTypes[0].price || 'FREE'}
                </div>
              </div>
            )}

            {template.includeBarcodeNumber && (
              <div className="pt-2">
                <div className="font-mono text-xs text-gray-500">
                  Ticket #: EVT-2025-0001234567
                </div>
                <div className="h-10 bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900 mt-1 rounded"></div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Section */}
        <div 
          className="px-6 py-4 border-t"
          style={{ borderColor: template.secondaryColor + '30' }}
        >
          <div className="grid md:grid-cols-2 gap-4 text-xs text-gray-600">
            {/* Terms */}
            <div>
              {template.additionalTerms.length > 0 && (
                <div className="space-y-1">
                  {template.additionalTerms.slice(0, 3).map((term, index) => (
                    <div key={index}>• {term}</div>
                  ))}
                  {template.idProofRequired && <div>• Valid ID proof required</div>}
                  {template.nonTransferable && <div>• This ticket is non-transferable</div>}
                  {template.ageRestriction && <div>• {template.ageRestriction}</div>}
                </div>
              )}
            </div>

            {/* Organizer Info */}
            <div className="text-right">
              {template.organizerName && (
                <div className="font-medium text-gray-700">{template.organizerName}</div>
              )}
              {template.organizerContact && (
                <div>{template.organizerContact}</div>
              )}
              {template.socialMedia.website && (
                <div className="text-blue-600">{template.socialMedia.website}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}