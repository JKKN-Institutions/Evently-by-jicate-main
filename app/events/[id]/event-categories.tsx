'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'

interface EventCategoriesProps {
  currentCategory: string
}

const categories = [
  { value: 'all', label: 'All Categories', icon: '🎯', color: 'bg-gray-100 hover:bg-gray-200 text-gray-800' },
  { value: 'technology', label: 'Technology', icon: '💻', color: 'bg-blue-100 hover:bg-blue-200 text-blue-800' },
  { value: 'music', label: 'Music', icon: '🎵', color: 'bg-purple-100 hover:bg-purple-200 text-purple-800' },
  { value: 'business', label: 'Business', icon: '💼', color: 'bg-amber-100 hover:bg-amber-200 text-amber-800' },
  { value: 'art', label: 'Art', icon: '🎨', color: 'bg-pink-100 hover:bg-pink-200 text-pink-800' },
  { value: 'sports', label: 'Sports', icon: '⚽', color: 'bg-green-100 hover:bg-green-200 text-green-800' },
  { value: 'food', label: 'Food', icon: '🍕', color: 'bg-orange-100 hover:bg-orange-200 text-orange-800' },
  { value: 'education', label: 'Education', icon: '📚', color: 'bg-indigo-100 hover:bg-indigo-200 text-indigo-800' },
  { value: 'community', label: 'Community', icon: '🤝', color: 'bg-teal-100 hover:bg-teal-200 text-teal-800' }
]

export default function EventCategories({ currentCategory }: EventCategoriesProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4">
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {categories.map((category) => (
                <div
                  key={category.value}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap animate-pulse bg-gray-200 h-10 w-24"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-4">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 -mb-2">
            {categories.map((category) => {
              const isActive = currentCategory.toLowerCase() === category.value
              const baseClasses = "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-200"
              
              if (isActive) {
                return (
                  <div
                    key={category.value}
                    className={`${baseClasses} bg-[#0b6d41] text-white shadow-sm`}
                    role="button"
                    tabIndex={0}
                    aria-label={`Current category: ${category.label}`}
                  >
                    <span>{category.icon}</span>
                    <span>{category.label}</span>
                  </div>
                )
              }

              return (
                <Link
                  key={category.value}
                  href={`/events?category=${category.value}`}
                  className={`${baseClasses} ${category.color} hover:shadow-sm transform hover:scale-105`}
                  role="button"
                  aria-label={`View ${category.label} events`}
                >
                  <span>{category.icon}</span>
                  <span>{category.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}