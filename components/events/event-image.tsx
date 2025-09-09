'use client'

import { useState } from 'react'

interface EventImageProps {
  imageUrl: string | null
  eventId: string
  title: string
}

export default function EventImage({ imageUrl, eventId, title }: EventImageProps) {
  const [imageError, setImageError] = useState(false)

  if (imageError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#0b6d41] via-[#15a862] to-[#ffde59]">
        <div className="text-center text-white">
          <svg className="h-20 w-20 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-lg font-medium">{title}</p>
          <p className="text-sm opacity-80 mt-1">Event Image</p>
        </div>
      </div>
    )
  }

  return (
    <img
      src={imageUrl || `/api/events/${eventId}/image`}
      alt={title}
      className="w-full h-full object-cover"
      onError={() => setImageError(true)}
    />
  )
}