'use client'

import React, { useState } from 'react'
import { Armchair, Grid3x3, Hash, LayoutGrid, Info } from 'lucide-react'

export interface SeatConfig {
  enabled: boolean
  totalSeats: number
  layoutType: 'sequential' | 'rows' | 'sections'
  rowsCount?: number
  seatsPerRow?: number
  sections?: Array<{
    name: string
    seats: number
    price?: number
  }>
}

interface SeatConfigurationProps {
  value: SeatConfig
  onChange: (config: SeatConfig) => void
  basePrice?: number
}

export default function SeatConfiguration({ value, onChange, basePrice = 0 }: SeatConfigurationProps) {
  const [previewSeats, setPreviewSeats] = useState<string[]>([])

  const handleToggleSeatAllocation = (enabled: boolean) => {
    onChange({
      ...value,
      enabled,
      totalSeats: enabled ? (value.totalSeats || 50) : 0
    })
    
    if (enabled && value.totalSeats) {
      generateSeatPreview(value.totalSeats, value.layoutType)
    }
  }

  const handleLayoutTypeChange = (layoutType: SeatConfig['layoutType']) => {
    onChange({
      ...value,
      layoutType
    })
    
    if (value.enabled && value.totalSeats) {
      generateSeatPreview(value.totalSeats, layoutType)
    }
  }

  const handleTotalSeatsChange = (totalSeats: number) => {
    const newConfig = { ...value, totalSeats }
    
    // Auto-calculate rows and seats per row
    if (value.layoutType === 'rows') {
      const seatsPerRow = Math.ceil(Math.sqrt(totalSeats))
      const rowsCount = Math.ceil(totalSeats / seatsPerRow)
      newConfig.seatsPerRow = seatsPerRow
      newConfig.rowsCount = rowsCount
    }
    
    onChange(newConfig)
    
    if (value.enabled) {
      generateSeatPreview(totalSeats, value.layoutType)
    }
  }

  const generateSeatPreview = (total: number, layout: SeatConfig['layoutType']) => {
    const seats: string[] = []
    
    if (layout === 'sequential') {
      // Generate sequential seats: 1, 2, 3...
      for (let i = 1; i <= Math.min(total, 20); i++) {
        seats.push(i.toString())
      }
    } else if (layout === 'rows') {
      // Generate row-based seats: A1, A2, B1, B2...
      const seatsPerRow = Math.ceil(Math.sqrt(total))
      const rowsCount = Math.ceil(total / seatsPerRow)
      let generated = 0
      
      for (let row = 0; row < Math.min(rowsCount, 5); row++) {
        const rowLetter = String.fromCharCode(65 + row) // A, B, C...
        for (let seat = 1; seat <= seatsPerRow && generated < Math.min(total, 20); seat++) {
          seats.push(`${rowLetter}${seat}`)
          generated++
        }
      }
    }
    
    setPreviewSeats(seats)
  }

  const addSection = () => {
    const sections = value.sections || []
    onChange({
      ...value,
      sections: [
        ...sections,
        { name: `Section ${sections.length + 1}`, seats: 10, price: basePrice }
      ]
    })
  }

  const updateSection = (index: number, section: any) => {
    const sections = [...(value.sections || [])]
    sections[index] = section
    onChange({
      ...value,
      sections,
      totalSeats: sections.reduce((sum, s) => sum + s.seats, 0)
    })
  }

  const removeSection = (index: number) => {
    const sections = [...(value.sections || [])]
    sections.splice(index, 1)
    onChange({
      ...value,
      sections,
      totalSeats: sections.reduce((sum, s) => sum + s.seats, 0)
    })
  }

  return (
    <div className="space-y-6 p-6 bg-white rounded-lg border">
      {/* Enable/Disable Seat Allocation */}
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id="enable-seats"
          checked={value.enabled}
          onChange={(e) => handleToggleSeatAllocation(e.target.checked)}
          className="mt-1"
        />
        <label htmlFor="enable-seats" className="flex-1 cursor-pointer">
          <div className="font-semibold flex items-center gap-2">
            <Armchair className="h-5 w-5 text-indigo-600" />
            Enable Seat Allocation
          </div>
          <p className="text-sm text-gray-600 mt-1">
            Assign specific seat numbers to attendees. Each ticket will have a unique seat number.
          </p>
        </label>
      </div>

      {value.enabled && (
        <>
          {/* Layout Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Seat Layout Type
            </label>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => handleLayoutTypeChange('sequential')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  value.layoutType === 'sequential'
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Hash className="h-6 w-6 mx-auto mb-1 text-indigo-600" />
                <div className="text-sm font-medium">Sequential</div>
                <div className="text-xs text-gray-500">1, 2, 3, 4...</div>
              </button>

              <button
                type="button"
                onClick={() => handleLayoutTypeChange('rows')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  value.layoutType === 'rows'
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Grid3x3 className="h-6 w-6 mx-auto mb-1 text-indigo-600" />
                <div className="text-sm font-medium">Rows</div>
                <div className="text-xs text-gray-500">A1, A2, B1...</div>
              </button>

              <button
                type="button"
                onClick={() => handleLayoutTypeChange('sections')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  value.layoutType === 'sections'
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <LayoutGrid className="h-6 w-6 mx-auto mb-1 text-indigo-600" />
                <div className="text-sm font-medium">Sections</div>
                <div className="text-xs text-gray-500">VIP, General...</div>
              </button>
            </div>
          </div>

          {/* Configuration based on layout type */}
          {value.layoutType !== 'sections' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Total Number of Seats
              </label>
              <input
                type="number"
                min="1"
                max="10000"
                value={value.totalSeats || 50}
                onChange={(e) => handleTotalSeatsChange(parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="Enter total seats"
              />
              
              {value.layoutType === 'rows' && value.rowsCount && value.seatsPerRow && (
                <div className="mt-2 text-sm text-gray-600">
                  <Info className="h-4 w-4 inline mr-1" />
                  This will create {value.rowsCount} rows with {value.seatsPerRow} seats per row
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">
                  Configure Sections
                </label>
                <button
                  type="button"
                  onClick={addSection}
                  className="px-3 py-1 bg-indigo-500 text-white rounded text-sm hover:bg-indigo-600"
                >
                  + Add Section
                </button>
              </div>

              {value.sections?.map((section, index) => (
                <div key={index} className="flex gap-2 p-3 bg-gray-50 rounded-lg">
                  <input
                    type="text"
                    value={section.name}
                    onChange={(e) => updateSection(index, { ...section, name: e.target.value })}
                    className="flex-1 px-2 py-1 border rounded text-sm"
                    placeholder="Section name"
                  />
                  <input
                    type="number"
                    min="1"
                    value={section.seats}
                    onChange={(e) => updateSection(index, { ...section, seats: parseInt(e.target.value) || 0 })}
                    className="w-20 px-2 py-1 border rounded text-sm"
                    placeholder="Seats"
                  />
                  <input
                    type="number"
                    min="0"
                    value={section.price}
                    onChange={(e) => updateSection(index, { ...section, price: parseFloat(e.target.value) || 0 })}
                    className="w-24 px-2 py-1 border rounded text-sm"
                    placeholder="Price"
                  />
                  <button
                    type="button"
                    onClick={() => removeSection(index)}
                    className="px-2 py-1 text-red-500 hover:bg-red-50 rounded"
                  >
                    ×
                  </button>
                </div>
              ))}

              {value.sections && value.sections.length > 0 && (
                <div className="text-sm text-gray-600 mt-2">
                  Total seats: {value.sections.reduce((sum, s) => sum + s.seats, 0)}
                </div>
              )}
            </div>
          )}

          {/* Seat Preview */}
          {previewSeats.length > 0 && value.layoutType !== 'sections' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Seat Number Preview (showing first 20)
              </label>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex flex-wrap gap-2">
                  {previewSeats.map((seat, index) => (
                    <div
                      key={index}
                      className="px-3 py-1.5 bg-white border border-gray-300 rounded text-sm font-mono"
                    >
                      {seat}
                    </div>
                  ))}
                  {value.totalSeats > 20 && (
                    <div className="px-3 py-1.5 text-gray-500 text-sm">
                      ... and {value.totalSeats - 20} more
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Information Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
              <Info className="h-4 w-4" />
              How Seat Allocation Works
            </h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Seats are automatically assigned when tickets are booked</li>
              <li>• Each ticket will display its unique seat number</li>
              <li>• Seats are allocated in order (best available first)</li>
              <li>• Attendees can see their seat numbers on their tickets</li>
              {value.layoutType === 'sections' && (
                <li>• Different sections can have different pricing</li>
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}