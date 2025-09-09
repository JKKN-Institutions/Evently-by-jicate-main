'use client'

import React, { useState } from 'react'
import { Palette, CreditCard, Settings } from 'lucide-react'

export interface SimpleTicketConfig {
  themeColor: string
  organizerName: string
  organizerContact: string
  enableWatermark: boolean
  terms: string[]
}

interface SimpleTicketConfiguratorProps {
  config: SimpleTicketConfig
  onChange: (config: SimpleTicketConfig) => void
}

export default function SimpleTicketConfigurator({ 
  config, 
  onChange 
}: SimpleTicketConfiguratorProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  const updateConfig = (field: keyof SimpleTicketConfig, value: any) => {
    onChange({
      ...config,
      [field]: value
    })
  }

  const addTerm = () => {
    onChange({
      ...config,
      terms: [...(config.terms || []), '']
    })
  }

  const updateTerm = (index: number, value: string) => {
    const newTerms = [...(config.terms || [])]
    newTerms[index] = value
    onChange({
      ...config,
      terms: newTerms
    })
  }

  const removeTerm = (index: number) => {
    onChange({
      ...config,
      terms: (config.terms || []).filter((_, i) => i !== index)
    })
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div 
        className="p-4 border-b border-gray-200 cursor-pointer flex items-center justify-between"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900">Ticket Customization</h3>
        </div>
        <button className="text-gray-500 hover:text-gray-700">
          {isExpanded ? '−' : '+'}
        </button>
      </div>

      {isExpanded && (
        <div className="p-6 space-y-6">
          {/* Theme Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Theme Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={config.themeColor}
                onChange={(e) => updateConfig('themeColor', e.target.value)}
                className="w-12 h-10 rounded border border-gray-300"
              />
              <span className="text-sm text-gray-600">{config.themeColor}</span>
            </div>
          </div>

          {/* Organizer Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Organizer Name
              </label>
              <input
                type="text"
                value={config.organizerName}
                onChange={(e) => updateConfig('organizerName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Your organization name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contact Information
              </label>
              <input
                type="text"
                value={config.organizerContact}
                onChange={(e) => updateConfig('organizerContact', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="Phone or email"
              />
            </div>
          </div>

          {/* Security */}
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={config.enableWatermark || false}
                onChange={(e) => updateConfig('enableWatermark', e.target.checked)}
                className="mr-2"
              />
              Enable security watermark on tickets
            </label>
          </div>

          {/* Terms */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Terms & Conditions
              </label>
              <button
                type="button"
                onClick={addTerm}
                className="px-3 py-1 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm"
              >
                Add Term
              </button>
            </div>
            <div className="space-y-2">
              {(config.terms || []).map((term, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={term}
                    onChange={(e) => updateTerm(index, e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter term or condition"
                  />
                  <button
                    type="button"
                    onClick={() => removeTerm(index)}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-md"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Preview:</strong> Your tickets will use the theme color "{config.themeColor}" 
              {config.organizerName && ` and show "${config.organizerName}" as the organizer`}.
              {config.enableWatermark && " Security watermarks will be added to prevent counterfeiting."}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
