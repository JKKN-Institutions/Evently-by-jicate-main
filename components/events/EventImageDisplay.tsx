'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'

interface EventImageDisplayProps {
  eventId: string
  eventTitle: string
  imageUrl?: string | null
  className?: string
  width?: number
  height?: number
}

export default function EventImageDisplay({
  eventId,
  eventTitle,
  imageUrl,
  className = '',
  width = 400,
  height = 200
}: EventImageDisplayProps) {
  const [imageSrc, setImageSrc] = useState<string>('/placeholder-event.svg')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    const loadImage = async () => {
      setLoading(true)
      setError(false)

      // Priority order for image sources:
      // 1. External URL (if provided)
      // 2. Placeholder (API endpoint not available)

      if (imageUrl) {
        if (imageUrl.startsWith('http')) {
          // External URL
          setImageSrc(imageUrl)
        } else if (imageUrl.startsWith('data:')) {
          // Data URL (base64)
          setImageSrc(imageUrl)
        } else {
          // Relative path or other format
          setImageSrc(imageUrl)
        }
      } else {
        // Use placeholder - API endpoint not available
        setError(true)
        setImageSrc('/placeholder-event.svg')
      }

      setLoading(false)
    }

    loadImage()
  }, [eventId, imageUrl])

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {loading && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse" />
      )}
      <img
        src={imageSrc}
        alt={eventTitle}
        width={width}
        height={height}
        className="w-full h-full object-cover"
        onError={() => {
          setError(true)
          setImageSrc('/event-placeholder.svg')
        }}
      />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-center text-gray-500">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="mt-1 text-xs">{eventTitle}</p>
          </div>
        </div>
      )}
    </div>
  )
}