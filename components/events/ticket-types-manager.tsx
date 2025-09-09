'use client'

import { useState } from 'react'
import { Plus, Trash2, Edit2, Save, X } from 'lucide-react'

export interface TicketType {
  name: string
  price: number
  quantity?: number
  description?: string
}

interface TicketTypesManagerProps {
  ticketTypes: TicketType[]
  onChange: (ticketTypes: TicketType[]) => void
  maxAttendees?: number
}

export default function TicketTypesManager({ 
  ticketTypes, 
  onChange,
  maxAttendees = 1000 
}: TicketTypesManagerProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [newTicket, setNewTicket] = useState<TicketType>({
    name: '',
    price: 0,
    quantity: 100,
    description: ''
  })

  // Predefined ticket types for quick addition
  const presetTypes = [
    { name: 'Gold', price: 500, description: 'Premium access with VIP benefits' },
    { name: 'Silver', price: 300, description: 'Reserved seating with perks' },
    { name: 'Bronze', price: 150, description: 'Standard admission' },
    { name: 'Early Bird', price: 100, description: 'Limited time discount' },
    { name: 'Student', price: 50, description: 'With valid student ID' }
  ]

  const addTicketType = () => {
    if (newTicket.name && newTicket.price >= 0) {
      onChange([...ticketTypes, { ...newTicket }])
      setNewTicket({ name: '', price: 0, quantity: 100, description: '' })
      setIsAdding(false)
    }
  }

  const updateTicketType = (index: number, updated: TicketType) => {
    const newTypes = [...ticketTypes]
    newTypes[index] = updated
    onChange(newTypes)
    setEditingIndex(null)
  }

  const removeTicketType = (index: number) => {
    onChange(ticketTypes.filter((_, i) => i !== index))
  }

  const addPresetType = (preset: typeof presetTypes[0]) => {
    const exists = ticketTypes.some(t => t.name.toLowerCase() === preset.name.toLowerCase())
    if (!exists) {
      onChange([...ticketTypes, { 
        ...preset, 
        quantity: Math.floor(maxAttendees / 3) 
      }])
    }
  }

  const totalQuantity = ticketTypes.reduce((sum, t) => sum + (t.quantity || 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Ticket Types & Pricing</h3>
          <p className="text-sm text-gray-600 mt-1">
            Create different ticket tiers with custom pricing
          </p>
        </div>
        
        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center px-3 py-2 bg-[#0b6d41] text-white rounded-lg hover:bg-[#0a5d37] text-sm"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Ticket Type
          </button>
        )}
      </div>

      {/* Quick Add Presets */}
      {ticketTypes.length === 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-700 mb-3">Quick add common ticket types:</p>
          <div className="flex flex-wrap gap-2">
            {presetTypes.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => addPresetType(preset)}
                className="px-3 py-1 bg-white border border-gray-300 rounded-full text-sm hover:bg-gray-100 transition-colors"
              >
                {preset.name} - ₹{preset.price}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Ticket Types List */}
      <div className="space-y-3">
        {ticketTypes.map((ticket, index) => (
          <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
            {editingIndex === index ? (
              // Edit Mode
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={ticket.name}
                    onChange={(e) => {
                      const newTypes = [...ticketTypes]
                      newTypes[index] = { ...ticket, name: e.target.value }
                      onChange(newTypes)
                    }}
                    placeholder="Ticket name"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                  />
                  <input
                    type="number"
                    value={ticket.price}
                    onChange={(e) => {
                      const newTypes = [...ticketTypes]
                      newTypes[index] = { ...ticket, price: parseFloat(e.target.value) || 0 }
                      onChange(newTypes)
                    }}
                    placeholder="Price"
                    min="0"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                  />
                  <input
                    type="number"
                    value={ticket.quantity}
                    onChange={(e) => {
                      const newTypes = [...ticketTypes]
                      newTypes[index] = { ...ticket, quantity: parseInt(e.target.value) || 0 }
                      onChange(newTypes)
                    }}
                    placeholder="Quantity"
                    min="1"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                  />
                </div>
                <input
                  type="text"
                  value={ticket.description || ''}
                  onChange={(e) => {
                    const newTypes = [...ticketTypes]
                    newTypes[index] = { ...ticket, description: e.target.value }
                    onChange(newTypes)
                  }}
                  placeholder="Description (optional)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingIndex(null)}
                    className="px-3 py-1 text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              // Display Mode
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      ticket.name === 'Gold' ? 'bg-yellow-100 text-yellow-800' :
                      ticket.name === 'Silver' ? 'bg-gray-100 text-gray-800' :
                      ticket.name === 'Bronze' ? 'bg-orange-100 text-orange-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {ticket.name}
                    </span>
                    <span className="font-semibold text-lg">₹{ticket.price}</span>
                    {ticket.quantity && (
                      <span className="text-sm text-gray-600">
                        ({ticket.quantity} tickets)
                      </span>
                    )}
                  </div>
                  {ticket.description && (
                    <p className="text-sm text-gray-600 mt-1">{ticket.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingIndex(index)}
                    className="p-2 text-gray-600 hover:text-[#0b6d41] transition-colors"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeTicketType(index)}
                    className="p-2 text-gray-600 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Add New Ticket Type Form */}
        {isAdding && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={newTicket.name}
                  onChange={(e) => setNewTicket({ ...newTicket, name: e.target.value })}
                  placeholder="Ticket type name"
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                />
                <input
                  type="number"
                  value={newTicket.price}
                  onChange={(e) => setNewTicket({ ...newTicket, price: parseFloat(e.target.value) || 0 })}
                  placeholder="Price (₹)"
                  min="0"
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                />
                <input
                  type="number"
                  value={newTicket.quantity}
                  onChange={(e) => setNewTicket({ ...newTicket, quantity: parseInt(e.target.value) || 0 })}
                  placeholder="Quantity"
                  min="1"
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                />
              </div>
              <input
                type="text"
                value={newTicket.description || ''}
                onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                placeholder="Description (optional)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdding(false)
                    setNewTicket({ name: '', price: 0, quantity: 100, description: '' })
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={addTicketType}
                  disabled={!newTicket.name || newTicket.price < 0}
                  className="px-4 py-2 bg-[#0b6d41] text-white rounded-lg hover:bg-[#0a5d37] disabled:opacity-50"
                >
                  Add Ticket Type
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Total Summary */}
      {ticketTypes.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">Total ticket types: {ticketTypes.length}</span>
            <span className="text-gray-600">
              Total capacity: {totalQuantity} / {maxAttendees} tickets
            </span>
          </div>
          {totalQuantity > maxAttendees && (
            <p className="text-red-600 text-sm mt-2">
              ⚠️ Total tickets exceed max attendees limit
            </p>
          )}
        </div>
      )}
    </div>
  )
}