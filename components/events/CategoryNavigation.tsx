'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { LucideIcon } from 'lucide-react'

interface Category {
  value: string
  label: string
  icon: LucideIcon | string
  count?: number
  description?: string
}

interface CategoryNavigationProps {
  categories: Category[]
  selectedCategory: string
  onCategoryChange: (category: string) => void
  eventCounts?: { [key: string]: number }
}

export default function CategoryNavigation({ 
  categories, 
  selectedCategory, 
  onCategoryChange,
  eventCounts = {}
}: CategoryNavigationProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showLeftArrow, setShowLeftArrow] = useState(false)
  const [showRightArrow, setShowRightArrow] = useState(false)

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
      setShowLeftArrow(scrollLeft > 0)
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 5)
    }
  }

  useEffect(() => {
    checkScroll()
    window.addEventListener('resize', checkScroll)
    return () => window.removeEventListener('resize', checkScroll)
  }, [categories])

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 200
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      })
      setTimeout(checkScroll, 300)
    }
  }

  return (
    <div className="relative bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Browse by Category</h2>
        <span className="text-sm text-gray-600">
          {eventCounts.total || 0} total events
        </span>
      </div>

      <div className="relative">
        {/* Left Arrow */}
        {showLeftArrow && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-white rounded-full shadow-lg hover:shadow-xl transition-all"
            aria-label="Scroll categories left"
          >
            <ChevronLeft className="h-5 w-5 text-gray-700" />
          </button>
        )}

        {/* Right Arrow */}
        {showRightArrow && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-white rounded-full shadow-lg hover:shadow-xl transition-all"
            aria-label="Scroll categories right"
          >
            <ChevronRight className="h-5 w-5 text-gray-700" />
          </button>
        )}

        {/* Categories Container */}
        <div 
          ref={scrollRef}
          onScroll={checkScroll}
          className="flex gap-3 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        >
          {categories.map((category) => {
            const isSelected = selectedCategory === category.value
            const count = eventCounts[category.value] || 0
            
            return (
              <button
                key={category.value}
                onClick={() => onCategoryChange(category.value)}
                className={`
                  flex-shrink-0 px-5 py-3 rounded-xl transition-all duration-300 transform hover:scale-105
                  ${isSelected 
                    ? 'bg-gradient-to-r from-[#0b6d41] to-[#15a862] text-white shadow-lg' 
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200'
                  }
                `}
              >
                <div className="flex items-center gap-2">
                  {typeof category.icon === 'string' ? (
                    <span className="text-xl">{category.icon}</span>
                  ) : (
                    <category.icon className={`h-5 w-5 ${isSelected ? 'text-white' : 'text-gray-700'}`} />
                  )}
                  <div className="text-left">
                    <p className={`font-semibold text-sm ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                      {category.label}
                    </p>
                    {count > 0 && (
                      <p className={`text-xs ${isSelected ? 'text-white/80' : 'text-gray-500'}`}>
                        {count} {count === 1 ? 'event' : 'events'}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Active Category Indicator */}
      {selectedCategory !== 'all' && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing <span className="font-semibold text-[#0b6d41]">
                {categories.find(c => c.value === selectedCategory)?.label}
              </span> events
            </p>
            <button
              onClick={() => onCategoryChange('all')}
              className="text-sm text-[#0b6d41] hover:text-[#0a5d37] font-medium"
            >
              Clear filter
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

