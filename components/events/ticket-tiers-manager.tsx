'use client'

import { useState } from 'react'
import { Plus, Trash2, Edit2, Save, X, Sparkles, Medal, Trophy, Crown, Star, Diamond } from 'lucide-react'

export interface TicketTier {
  id: string
  name: string
  price: number
  quantity: number
  description: string
  perks: string[]
  earlyBirdPrice?: number
  icon?: string
  color?: string
  maxPerPerson?: number
  available: boolean
}

interface TicketTiersManagerProps {
  tiers: TicketTier[]
  onChange: (tiers: TicketTier[]) => void
  currency?: string
}

const DEFAULT_TIERS: Partial<TicketTier>[] = [
  {
    name: 'Platinum',
    icon: 'crown',
    color: 'bg-gradient-to-r from-purple-600 to-purple-800',
    description: 'Ultimate VIP experience with all exclusive benefits',
    perks: ['Front row seating', 'Meet & greet', 'Exclusive merchandise', 'VIP lounge access', 'Complimentary drinks']
  },
  {
    name: 'Golden',
    icon: 'trophy',
    color: 'bg-gradient-to-r from-yellow-500 to-yellow-700',
    description: 'Premium experience with special privileges',
    perks: ['Priority seating', 'Welcome gift', 'Access to VIP area', 'Free parking']
  },
  {
    name: 'Silver',
    icon: 'medal',
    color: 'bg-gradient-to-r from-gray-400 to-gray-600',
    description: 'Enhanced experience with added benefits',
    perks: ['Reserved seating', 'Event merchandise', 'Refreshments included']
  },
  {
    name: 'Bronze',
    icon: 'star',
    color: 'bg-gradient-to-r from-orange-600 to-orange-800',
    description: 'Standard access with basic amenities',
    perks: ['General admission', 'Event access', 'Basic refreshments']
  },
  {
    name: 'General',
    icon: 'sparkles',
    color: 'bg-gradient-to-r from-blue-500 to-blue-700',
    description: 'Regular entry ticket',
    perks: ['Event entry', 'Standing area']
  }
]

const TIER_ICONS = {
  crown: Crown,
  trophy: Trophy,
  medal: Medal,
  star: Star,
  sparkles: Sparkles,
  diamond: Diamond
}

export default function TicketTiersManager({ tiers, onChange, currency = '₹' }: TicketTiersManagerProps) {
  const [editingTier, setEditingTier] = useState<string | null>(null)
  const [tempTier, setTempTier] = useState<TicketTier | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newTier, setNewTier] = useState<Partial<TicketTier>>({
    name: '',
    price: 0,
    quantity: 100,
    description: '',
    perks: [],
    available: true,
    maxPerPerson: 5
  })
  const [newPerk, setNewPerk] = useState('')

  const addTier = () => {
    if (newTier.name && newTier.price !== undefined && newTier.quantity) {
      const tier: TicketTier = {
        id: Date.now().toString(),
        name: newTier.name,
        price: newTier.price,
        quantity: newTier.quantity,
        description: newTier.description || '',
        perks: newTier.perks || [],
        earlyBirdPrice: newTier.earlyBirdPrice,
        icon: newTier.icon,
        color: newTier.color,
        maxPerPerson: newTier.maxPerPerson,
        available: newTier.available !== undefined ? newTier.available : true
      }
      onChange([...tiers, tier])
      setNewTier({
        name: '',
        price: 0,
        quantity: 100,
        description: '',
        perks: [],
        available: true,
        maxPerPerson: 5
      })
      setShowAddForm(false)
      setNewPerk('')
    }
  }

  const updateTier = (id: string) => {
    if (tempTier) {
      onChange(tiers.map(tier => tier.id === id ? tempTier : tier))
      setEditingTier(null)
      setTempTier(null)
    }
  }

  const deleteTier = (id: string) => {
    onChange(tiers.filter(tier => tier.id !== id))
  }

  const startEditing = (tier: TicketTier) => {
    setEditingTier(tier.id)
    setTempTier({ ...tier })
  }

  const cancelEditing = () => {
    setEditingTier(null)
    setTempTier(null)
  }

  const addPerkToNew = () => {
    if (newPerk.trim()) {
      setNewTier(prev => ({
        ...prev,
        perks: [...(prev.perks || []), newPerk.trim()]
      }))
      setNewPerk('')
    }
  }

  const addPerkToTemp = (perk: string) => {
    if (perk.trim() && tempTier) {
      setTempTier({
        ...tempTier,
        perks: [...tempTier.perks, perk.trim()]
      })
    }
  }

  const removePerk = (tierSetter: any, index: number) => {
    tierSetter((prev: any) => ({
      ...prev,
      perks: prev.perks.filter((_: any, i: number) => i !== index)
    }))
  }

  const applyTemplate = (template: Partial<TicketTier>) => {
    setNewTier(prev => ({
      ...prev,
      ...template,
      perks: [...(template.perks || [])]
    }))
  }

  const IconComponent = (iconName: string) => {
    const Icon = TIER_ICONS[iconName as keyof typeof TIER_ICONS] || Sparkles
    return <Icon className="w-5 h-5" />
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Ticket Tiers & Pricing</h3>
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="px-4 py-2 bg-[#0b6d41] text-white rounded-lg hover:bg-[#0a5d37] transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Tier
        </button>
      </div>

      {/* Quick Templates */}
      {showAddForm && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-sm font-medium text-blue-900 mb-2">Quick Templates:</p>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_TIERS.map((template, index) => (
              <button
                key={index}
                type="button"
                onClick={() => applyTemplate(template)}
                className="px-3 py-1 bg-white border border-blue-300 rounded-md text-sm hover:bg-blue-100 transition-colors"
              >
                {template.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Add New Tier Form */}
      {showAddForm && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tier Name *</label>
              <input
                type="text"
                value={newTier.name}
                onChange={(e) => setNewTier({ ...newTier, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                placeholder="e.g., VIP, Premium, Standard"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Regular Price ({currency}) *</label>
              <input
                type="number"
                value={newTier.price}
                onChange={(e) => setNewTier({ ...newTier, price: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Early Bird Price ({currency})</label>
              <input
                type="number"
                value={newTier.earlyBirdPrice || ''}
                onChange={(e) => setNewTier({ ...newTier, earlyBirdPrice: e.target.value ? parseFloat(e.target.value) : undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                min="0"
                step="0.01"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity Available *</label>
              <input
                type="number"
                value={newTier.quantity}
                onChange={(e) => setNewTier({ ...newTier, quantity: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Per Person</label>
              <input
                type="number"
                value={newTier.maxPerPerson || 5}
                onChange={(e) => setNewTier({ ...newTier, maxPerPerson: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                min="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
              <select
                value={newTier.icon || ''}
                onChange={(e) => setNewTier({ ...newTier, icon: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
              >
                <option value="">None</option>
                <option value="crown">Crown</option>
                <option value="trophy">Trophy</option>
                <option value="medal">Medal</option>
                <option value="star">Star</option>
                <option value="sparkles">Sparkles</option>
                <option value="diamond">Diamond</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={newTier.description}
              onChange={(e) => setNewTier({ ...newTier, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
              rows={2}
              placeholder="Brief description of what this tier includes"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Perks & Benefits</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newPerk}
                onChange={(e) => setNewPerk(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addPerkToNew())}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                placeholder="Add a perk..."
              />
              <button
                type="button"
                onClick={addPerkToNew}
                className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Add
              </button>
            </div>
            {newTier.perks && newTier.perks.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {newTier.perks.map((perk, index) => (
                  <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm flex items-center gap-1">
                    {perk}
                    <button
                      type="button"
                      onClick={() => removePerk(setNewTier, index)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false)
                setNewTier({
                  name: '',
                  price: 0,
                  quantity: 100,
                  description: '',
                  perks: [],
                  available: true,
                  maxPerPerson: 5
                })
                setNewPerk('')
              }}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={addTier}
              disabled={!newTier.name || newTier.price === undefined || !newTier.quantity}
              className="px-4 py-2 bg-[#0b6d41] text-white rounded-lg hover:bg-[#0a5d37] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Tier
            </button>
          </div>
        </div>
      )}

      {/* Existing Tiers List */}
      <div className="space-y-3">
        {tiers.map((tier) => (
          <div key={tier.id} className={`border rounded-lg p-4 ${tier.color ? '' : 'bg-white'}`}>
            {editingTier === tier.id && tempTier ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={tempTier.name}
                    onChange={(e) => setTempTier({ ...tempTier, name: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <input
                    type="number"
                    value={tempTier.price}
                    onChange={(e) => setTempTier({ ...tempTier, price: parseFloat(e.target.value) })}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                    min="0"
                  />
                  <input
                    type="number"
                    value={tempTier.earlyBirdPrice || ''}
                    onChange={(e) => setTempTier({ ...tempTier, earlyBirdPrice: e.target.value ? parseFloat(e.target.value) : undefined })}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Early bird price"
                    min="0"
                  />
                  <input
                    type="number"
                    value={tempTier.quantity}
                    onChange={(e) => setTempTier({ ...tempTier, quantity: parseInt(e.target.value) })}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                    min="1"
                  />
                </div>
                <textarea
                  value={tempTier.description}
                  onChange={(e) => setTempTier({ ...tempTier, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={2}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => updateTier(tier.id)}
                    className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    <Save className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditing}
                    className="px-3 py-1 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {tier.icon && IconComponent(tier.icon)}
                    <h4 className="font-semibold text-lg">{tier.name}</h4>
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded-md text-sm">
                      {currency}{tier.price}
                    </span>
                    {tier.earlyBirdPrice && (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-md text-sm">
                        Early: {currency}{tier.earlyBirdPrice}
                      </span>
                    )}
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-sm">
                      {tier.quantity} tickets
                    </span>
                  </div>
                  {tier.description && (
                    <p className="text-gray-600 text-sm mb-2">{tier.description}</p>
                  )}
                  {tier.perks.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {tier.perks.map((perk, index) => (
                        <span key={index} className="px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs">
                          ✓ {perk}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 ml-4">
                  <button
                    type="button"
                    onClick={() => startEditing(tier)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteTier(tier.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {tiers.length === 0 && !showAddForm && (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <p className="text-gray-500 mb-3">No ticket tiers configured</p>
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-[#0b6d41] text-white rounded-lg hover:bg-[#0a5d37] transition-colors"
          >
            Create Your First Tier
          </button>
        </div>
      )}
    </div>
  )
}