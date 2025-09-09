'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { QrCode, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function ScanPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // If there's an event ID in the URL, redirect to the proper scan page
    const eventId = searchParams.get('eventId')
    if (eventId) {
      router.push(`/events/${eventId}/scan`)
    }
  }, [router, searchParams])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <QrCode className="h-8 w-8 text-blue-600" />
          </div>
          
          <h1 className="text-2xl font-bold text-gray-900 mb-4">QR Code Scanner</h1>
          <p className="text-gray-600 mb-8">
            To scan tickets, please navigate to the specific event's scan page.
          </p>

          <div className="space-y-4">
            <Link
              href="/events"
              className="block w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Browse Events
            </Link>
            
            <Link
              href="/"
              className="flex items-center justify-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Link>
          </div>
        </div>

        <div className="mt-6 text-sm text-gray-500">
          <p>💡 Event organizers can access the scanner from their event dashboard</p>
        </div>
      </div>
    </div>
  )
}
