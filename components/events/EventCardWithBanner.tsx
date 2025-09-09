'use client'

import { Calendar, MapPin, Clock, Users, Heart, Laptop, Music, Briefcase, Palette, Trophy, Utensils, GraduationCap, HeartHandshake, Film, Heart as HeartIcon, Plane, Grid3X3 } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

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
  profiles?: {
    full_name: string
    email: string
  }
  attendees_count?: number
}

interface EventCardWithBannerProps {
  event: Event
}

export default function EventCardWithBanner({ event }: EventCardWithBannerProps) {
  const [isLiked, setIsLiked] = useState(false)
  const [imageError, setImageError] = useState(false)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatTime = (timeString: string) => {
    return new Date(`1970-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatPrice = (price: number) => {
    return price === 0 ? 'FREE' : `₹${price.toLocaleString()}`
  }

  const getCategoryIcon = (category: string) => {
    const icons: { [key: string]: any } = {
      technology: Laptop,
      music: Music,
      business: Briefcase,
      art: Palette,
      sports: Trophy,
      food: Utensils,
      education: GraduationCap,
      community: HeartHandshake,
      health: HeartIcon,
      travel: Plane,
      entertainment: Film,
      default: Grid3X3
    }
    const IconComponent = icons[category.toLowerCase()] || icons.default
    return IconComponent
  }

  const spotsLeft = event.max_attendees - (event.attendees_count || 0)
  const isAlmostFull = spotsLeft < 10 && spotsLeft > 0
  const isSoldOut = spotsLeft <= 0

  return (
    <Link href={`/events/${event.id}`}>
      <div className="group relative bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden transform hover:-translate-y-1 cursor-pointer">
        {/* Banner Image Section */}
        <div className="relative h-56 overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200">
          {!imageError ? (
            <img
              src={(() => {
                // Filter out problematic external URLs
                if (event.image_url) {
                  const url = event.image_url.toLowerCase()
                  if (url.includes('placeholder') || url.includes('via.placeholder.com')) {
                    return `/api/events/${event.id}/image`
                  }
                  return event.image_url
                }
                return `/api/events/${event.id}/image`
              })()}
              alt={event.title}
              onError={() => setImageError(true)}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#0b6d41] to-[#15a862] flex items-center justify-center">
              {(() => {
                const Icon = getCategoryIcon(event.category)
                return <Icon className="h-16 w-16 text-white opacity-30" />
              })()}
            </div>
          )}
          
          {/* Overlay Gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          {/* Top Badges */}
          <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
            {/* Price Badge */}
            <div>
              {event.price === 0 && (
                <span className="inline-flex items-center px-3 py-1.5 bg-green-500 text-white text-xs font-bold rounded-full shadow-lg">
                  FREE EVENT
                </span>
              )}
            </div>
            
            {/* Category Badge */}
            <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-white/95 backdrop-blur-sm text-gray-900 text-xs font-semibold rounded-full shadow-sm capitalize">
              {(() => {
                const Icon = getCategoryIcon(event.category)
                return <Icon className="h-3 w-3" />
              })()}
              {event.category}
            </span>
          </div>

          {/* Like Button */}
          <button
            onClick={(e) => {
              e.preventDefault()
              setIsLiked(!isLiked)
            }}
            className="absolute bottom-4 right-4 p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:scale-110 transition-transform"
          >
            <Heart className={`h-5 w-5 ${isLiked ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
          </button>
        </div>

        {/* Content Section */}
        <div className="p-6">
          {/* Title and Price */}
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-xl font-bold text-gray-900 line-clamp-2 flex-1 group-hover:text-[#0b6d41] transition-colors">
              {event.title}
            </h3>
            <div className="ml-3 text-right">
              {event.price === 0 ? (
                <span className="text-lg font-bold text-green-600">FREE</span>
              ) : (
                <span className="text-xl font-bold text-[#0b6d41]">{formatPrice(event.price)}</span>
              )}
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-gray-600 line-clamp-2 mb-4">
            {event.description}
          </p>

          {/* Event Details */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center gap-3 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <div className="p-1.5 bg-blue-50 rounded-lg">
                  <Calendar className="h-4 w-4 text-blue-600" />
                </div>
                <span className="font-medium">{formatDate(event.date)}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <div className="p-1.5 bg-orange-50 rounded-lg">
                  <Clock className="h-4 w-4 text-orange-600" />
                </div>
                <span>{formatTime(event.time)}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <div className="p-1.5 bg-green-50 rounded-lg">
                <MapPin className="h-4 w-4 text-green-600" />
              </div>
              <span className="truncate font-medium">{event.venue}, {event.location}</span>
            </div>
          </div>

          {/* Availability Status */}
          <div className="mb-4">
            {isSoldOut ? (
              <div className="flex items-center gap-2 text-sm text-red-600 font-semibold">
                <div className="p-1.5 bg-red-50 rounded-lg">
                  <Users className="h-4 w-4" />
                </div>
                <span>SOLD OUT</span>
              </div>
            ) : isAlmostFull ? (
              <div className="flex items-center gap-2 text-sm text-orange-600 font-semibold">
                <div className="p-1.5 bg-orange-50 rounded-lg">
                  <Users className="h-4 w-4" />
                </div>
                <span>Only {spotsLeft} spots left!</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="p-1.5 bg-purple-50 rounded-lg">
                  <Users className="h-4 w-4 text-purple-600" />
                </div>
                <span>{spotsLeft} spots available</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button className="flex-1 py-2.5 px-4 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all text-sm">
              View Details
            </button>
            <button 
              className={`flex-1 py-2.5 px-4 rounded-xl font-semibold transition-all text-sm ${
                isSoldOut 
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-[#0b6d41] to-[#15a862] text-white hover:shadow-lg hover:scale-105'
              }`}
              disabled={isSoldOut}
            >
              {isSoldOut ? 'Sold Out' : 'Book Now'}
            </button>
          </div>

          {/* Footer */}
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-[#0b6d41] to-[#ffde59] rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">
                  {event.profiles?.full_name?.charAt(0) || 'O'}
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-500">Organized by</span>
                <p className="text-sm font-medium text-gray-700">
                  {event.profiles?.full_name || 'Event Organizer'}
                </p>
              </div>
            </div>
            {event.rating && (
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 text-yellow-500 fill-current" />
                <span className="text-sm font-semibold text-gray-700">{event.rating.toFixed(1)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}