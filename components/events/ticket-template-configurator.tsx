'use client'

import React, { useState, useCallback } from 'react'
import { Upload, Eye, Palette, Settings, Users, CreditCard, Shield, Info } from 'lucide-react'

export interface TicketTemplateConfig {
  // Event Branding
  eventLogo?: string
  themeColor: string
  backgroundStyle: 'solid' | 'gradient' | 'pattern'
  
  // Ticket Types & Pricing
  ticketTypes: Array<{
    name: string
    price: number
    color: string
    description?: string
    maxQuantity?: number
  }>
  
  // Event Details Display
  showVenueDetails: boolean
  showEntryTime: boolean
  showGateNumber: boolean
  customVenueInfo?: string
  
  // Attendee Information
  collectAttendeeInfo: {
    name: boolean
    email: boolean
    phone: boolean
    idRequired: boolean
  }
  
  // Organizer Information
  organizerName: string
  organizerLogo?: string
  organizerContact?: string
  website?: string
  socialMedia?: {
    facebook?: string
    twitter?: string
    instagram?: string
  }
  
  // Sponsors
  sponsors: Array<{
    name: string
    logo?: string
    website?: string
  }>
  
  // Security Features
  enableWatermark: boolean
  enableHologram: boolean
  qrCodeStyle: 'standard' | 'branded' | 'custom'
  
  // Terms & Conditions
  terms: string[]
  ageRestriction?: string
  refundPolicy?: string
  transferPolicy: 'allowed' | 'restricted' | 'not-allowed'
  
  // Additional Features
  enableSeatSelection: boolean
  enableCheckIn: boolean
  customFields?: Array<{
    name: string
    type: 'text' | 'number' | 'select'
    required: boolean
    options?: string[]
  }>
}

interface TicketTemplateConfiguratorProps {
  config: TicketTemplateConfig
  onChange: (config: TicketTemplateConfig) => void
}

export default function TicketTemplateConfigurator({ 
  config, 
  onChange 
}: TicketTemplateConfiguratorProps) {
  const [activeTab, setActiveTab] = useState<'branding' | 'tickets' | 'details' | 'security' | 'terms'>('branding')
  const [showPreview, setShowPreview] = useState(false)

  const updateConfig = useCallback((updates: Partial<TicketTemplateConfig>) => {
    onChange({ ...config, ...updates })
  }, [config, onChange])

  const addTicketType = () => {
    const newType = {
      name: `Ticket Type ${config.ticketTypes.length + 1}`,
      price: 0,
      color: '#3B82F6',
      description: ''
    }
    updateConfig({
      ticketTypes: [...config.ticketTypes, newType]
    })
  }

  const updateTicketType = (index: number, updates: Partial<typeof config.ticketTypes[0]>) => {
    const updatedTypes = config.ticketTypes.map((type, i) => 
      i === index ? { ...type, ...updates } : type
    )
    updateConfig({ ticketTypes: updatedTypes })
  }

  const removeTicketType = (index: number) => {
    updateConfig({
      ticketTypes: config.ticketTypes.filter((_, i) => i !== index)
    })
  }

  const addSponsor = () => {
    updateConfig({
      sponsors: [...config.sponsors, { name: '', logo: '', website: '' }]
    })
  }

  const addTerm = () => {
    updateConfig({
      terms: [...config.terms, '']
    })
  }

  const tabs = [
    { id: 'branding', label: 'Branding', icon: Palette },
    { id: 'tickets', label: 'Ticket Types', icon: CreditCard },
    { id: 'details', label: 'Event Details', icon: Info },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'terms', label: 'Terms', icon: Settings },
  ] as const

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="border-b border-gray-200">
        <div className="flex items-center justify-between p-4">
          <h3 className="text-lg font-semibold text-gray-900">Ticket Template Configuration</h3>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Eye className="h-4 w-4" />
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>
        </div>
        
        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="p-6">
        {/* Branding Tab */}
        {activeTab === 'branding' && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Event Logo
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Upload event logo (optional)</p>
                <input type="file" accept="image/*" className="hidden" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Theme Color
              </label>
              <input
                type="color"
                value={config.themeColor}
                onChange={(e) => updateConfig({ themeColor: e.target.value })}
                className="w-20 h-10 rounded border border-gray-300"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Background Style
              </label>
              <select
                value={config.backgroundStyle}
                onChange={(e) => updateConfig({ backgroundStyle: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="solid">Solid Color</option>
                <option value="gradient">Gradient</option>
                <option value="pattern">Pattern</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Organizer Information
              </label>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Organizer Name"
                  value={config.organizerName}
                  onChange={(e) => updateConfig({ organizerName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
                <input
                  type="text"
                  placeholder="Contact Information"
                  value={config.organizerContact || ''}
                  onChange={(e) => updateConfig({ organizerContact: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
                <input
                  type="url"
                  placeholder="Website URL"
                  value={config.website || ''}
                  onChange={(e) => updateConfig({ website: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            </div>
          </div>
        )}

        {/* Ticket Types Tab */}
        {activeTab === 'tickets' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-medium text-gray-900">Ticket Types</h4>
              <button
                onClick={addTicketType}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Add Ticket Type
              </button>
            </div>

            <div className="space-y-4">
              {config.ticketTypes.map((ticket, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Ticket Name
                      </label>
                      <input
                        type="text"
                        value={ticket.name}
                        onChange={(e) => updateTicketType(index, { name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Price (INR)
                      </label>
                      <input
                        type="number"
                        value={ticket.price}
                        onChange={(e) => updateTicketType(index, { price: Number(e.target.value) })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Color
                      </label>
                      <input
                        type="color"
                        value={ticket.color}
                        onChange={(e) => updateTicketType(index, { color: e.target.value })}
                        className="w-20 h-10 rounded border border-gray-300"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={() => removeTicketType(index)}
                        className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-md"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={ticket.description || ''}
                      onChange={(e) => updateTicketType(index, { description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      rows={2}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Event Details Tab */}
        {activeTab === 'details' && (
          <div className="space-y-6">
            <div>
              <h4 className="text-lg font-medium text-gray-900 mb-4">Display Options</h4>
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={config.showVenueDetails}
                    onChange={(e) => updateConfig({ showVenueDetails: e.target.checked })}
                    className="mr-2"
                  />
                  Show detailed venue information
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={config.showEntryTime}
                    onChange={(e) => updateConfig({ showEntryTime: e.target.checked })}
                    className="mr-2"
                  />
                  Show entry time
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={config.showGateNumber}
                    onChange={(e) => updateConfig({ showGateNumber: e.target.checked })}
                    className="mr-2"
                  />
                  Show gate number
                </label>
              </div>
            </div>

            <div>
              <h4 className="text-lg font-medium text-gray-900 mb-4">Attendee Information</h4>
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={config.collectAttendeeInfo.name}
                    onChange={(e) => updateConfig({ 
                      collectAttendeeInfo: { ...config.collectAttendeeInfo, name: e.target.checked }
                    })}
                    className="mr-2"
                  />
                  Collect attendee name
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={config.collectAttendeeInfo.email}
                    onChange={(e) => updateConfig({ 
                      collectAttendeeInfo: { ...config.collectAttendeeInfo, email: e.target.checked }
                    })}
                    className="mr-2"
                  />
                  Collect email address
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={config.collectAttendeeInfo.phone}
                    onChange={(e) => updateConfig({ 
                      collectAttendeeInfo: { ...config.collectAttendeeInfo, phone: e.target.checked }
                    })}
                    className="mr-2"
                  />
                  Collect phone number
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={config.collectAttendeeInfo.idRequired}
                    onChange={(e) => updateConfig({ 
                      collectAttendeeInfo: { ...config.collectAttendeeInfo, idRequired: e.target.checked }
                    })}
                    className="mr-2"
                  />
                  Require ID proof at entry
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <div>
              <h4 className="text-lg font-medium text-gray-900 mb-4">Security Features</h4>
              <div className="space-y-3">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={config.enableWatermark}
                    onChange={(e) => updateConfig({ enableWatermark: e.target.checked })}
                    className="mr-2"
                  />
                  Enable watermark
                </label>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={config.enableHologram}
                    onChange={(e) => updateConfig({ enableHologram: e.target.checked })}
                    className="mr-2"
                  />
                  Enable hologram effect (printed tickets)
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                QR Code Style
              </label>
              <select
                value={config.qrCodeStyle}
                onChange={(e) => updateConfig({ qrCodeStyle: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="standard">Standard</option>
                <option value="branded">Branded</option>
                <option value="custom">Custom</option>
              </select>
            </div>
          </div>
        )}

        {/* Terms Tab */}
        {activeTab === 'terms' && (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-medium text-gray-900">Terms & Conditions</h4>
                <button
                  onClick={addTerm}
                  className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Add Term
                </button>
              </div>
              <div className="space-y-2">
                {config.terms.map((term, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={term}
                      onChange={(e) => {
                        const newTerms = [...config.terms]
                        newTerms[index] = e.target.value
                        updateConfig({ terms: newTerms })
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="Enter term or condition"
                    />
                    <button
                      onClick={() => {
                        const newTerms = config.terms.filter((_, i) => i !== index)
                        updateConfig({ terms: newTerms })
                      }}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-md"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transfer Policy
              </label>
              <select
                value={config.transferPolicy}
                onChange={(e) => updateConfig({ transferPolicy: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="allowed">Transfers Allowed</option>
                <option value="restricted">Restricted Transfers</option>
                <option value="not-allowed">No Transfers</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Age Restriction
              </label>
              <input
                type="text"
                value={config.ageRestriction || ''}
                onChange={(e) => updateConfig({ ageRestriction: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="e.g., 18+ only, All ages welcome"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Refund Policy
              </label>
              <textarea
                value={config.refundPolicy || ''}
                onChange={(e) => updateConfig({ refundPolicy: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows={3}
                placeholder="Describe your refund policy"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
