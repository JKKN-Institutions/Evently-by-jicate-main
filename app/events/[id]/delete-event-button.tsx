'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'

interface DeleteEventButtonProps {
  eventId: string
  eventTitle: string
}

export default function DeleteEventButton({ eventId, eventTitle }: DeleteEventButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    const confirmed = confirm(
      `Are you sure you want to delete "${eventTitle}"?\n\n` +
      'This will:\n' +
      '• Delete the event permanently\n' +
      '• Cancel all bookings\n' +
      '• Refund ticket purchases (if applicable)\n\n' +
      'This action cannot be undone.'
    )

    if (!confirmed) return

    try {
      setIsDeleting(true)
      
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (response.ok) {
        // Redirect to events page with success message
        router.push('/events?message=' + encodeURIComponent('Event deleted successfully'))
      } else {
        alert(data.error || 'Failed to delete event. Please try again.')
      }
    } catch (error) {
      console.error('Error deleting event:', error)
      alert('An error occurred while deleting the event. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
    >
      <Trash2 className="h-4 w-4 mr-2" />
      {isDeleting ? 'Deleting...' : 'Delete Event'}
    </button>
  )
}