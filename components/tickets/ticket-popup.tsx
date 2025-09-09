'use client'

import { useState, useEffect } from 'react'
import { X, Download, CheckCircle, Ticket, Calendar, Clock, MapPin, Sparkles, User, Mail, Phone } from 'lucide-react'
import confetti from 'canvas-confetti'

interface Ticket {
  id: string
  ticket_number: string
  status: string
  qr_code_image?: string
}

interface Event {
  id: string
  title: string
  date: string
  time: string
  venue: string
  location: string
  price: number
}

interface Booking {
  id: string
  user_name: string
  user_email: string
  user_phone?: string
  quantity: number
  total_amount: number
}

interface TicketPopupProps {
  isOpen: boolean
  onClose: () => void
  tickets: Ticket[]
  event: Event
  booking: Booking
}

export default function TicketPopup({ isOpen, onClose, tickets, event, booking }: TicketPopupProps) {
  const [currentTicketIndex, setCurrentTicketIndex] = useState(0)
  const [showSuccess, setShowSuccess] = useState(true)

  useEffect(() => {
    if (isOpen && showSuccess) {
      // Trigger confetti animation
      const duration = 3 * 1000
      const animationEnd = Date.now() + duration
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 }

      function randomInRange(min: number, max: number) {
        return Math.random() * (max - min) + min
      }

      const interval = setInterval(function() {
        const timeLeft = animationEnd - Date.now()

        if (timeLeft <= 0) {
          return clearInterval(interval)
        }

        const particleCount = 50 * (timeLeft / duration)
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
          colors: ['#ffde59', '#f5c842', '#0b6d41', '#15a862']
        })
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
          colors: ['#ffde59', '#f5c842', '#0b6d41', '#15a862']
        })
      }, 250)

      // Hide success message after 3 seconds
      setTimeout(() => setShowSuccess(false), 3000)

      return () => clearInterval(interval)
    }
  }, [isOpen, showSuccess])

  if (!isOpen || !tickets || tickets.length === 0) return null

  const currentTicket = tickets[currentTicketIndex]

  const downloadTicket = async (ticket: Ticket) => {
    try {
      // Use the new enhanced ticket template download API
      const response = await fetch('/api/tickets/download-with-template', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticketId: ticket.id,
          format: 'pdf'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to download ticket')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ticket-${ticket.ticket_number}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Error downloading ticket:', error)
      alert('Failed to download ticket. Please try again.')
    }
  }

  const downloadAllTickets = () => {
    tickets.forEach((ticket, index) => {
      setTimeout(() => downloadTicket(ticket), index * 500)
    })
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Success Banner */}
        {showSuccess && (
          <div className="absolute inset-x-0 top-0 z-20 bg-gradient-to-r from-green-500 to-green-600 text-white p-4 text-center animate-slide-down">
            <div className="flex items-center justify-center gap-2">
              <CheckCircle className="h-6 w-6" />
              <span className="font-bold text-lg">Payment Successful! Your tickets are ready!</span>
              <Sparkles className="h-6 w-6 animate-pulse" />
            </div>
          </div>
        )}

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-30 bg-white/90 backdrop-blur rounded-full p-2 shadow-lg hover:bg-white transition-all"
        >
          <X className="h-5 w-5 text-gray-700" />
        </button>

        <div className="overflow-y-auto max-h-[90vh]">
          {/* Header */}
          <div className="bg-gradient-to-br from-[#ffde59] via-[#f5c842] to-[#ffeb8f] p-8 text-center">
            <Ticket className="h-16 w-16 text-[#0b6d41] mx-auto mb-4 animate-bounce" />
            <h2 className="text-3xl font-bold text-[#0b6d41] mb-2">Your E-Tickets</h2>
            <p className="text-[#0b6d41]/80">
              {tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'} for {event.title}
            </p>
          </div>

          {/* Ticket Navigation (if multiple tickets) */}
          {tickets.length > 1 && (
            <div className="flex items-center justify-center gap-2 p-4 bg-gray-50">
              <button
                onClick={() => setCurrentTicketIndex(Math.max(0, currentTicketIndex - 1))}
                disabled={currentTicketIndex === 0}
                className="px-3 py-1 bg-gray-200 rounded-lg disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm font-medium px-4">
                Ticket {currentTicketIndex + 1} of {tickets.length}
              </span>
              <button
                onClick={() => setCurrentTicketIndex(Math.min(tickets.length - 1, currentTicketIndex + 1))}
                disabled={currentTicketIndex === tickets.length - 1}
                className="px-3 py-1 bg-gray-200 rounded-lg disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}

          {/* Ticket Content */}
          <div className="p-8">
            {/* QR Code */}
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6 mb-6">
              {currentTicket.qr_code_image ? (
                <img 
                  src={currentTicket.qr_code_image} 
                  alt="QR Code" 
                  className="w-64 h-64 mx-auto rounded-xl shadow-lg"
                />
              ) : (
                <div className="w-64 h-64 mx-auto bg-gray-200 rounded-xl flex items-center justify-center">
                  <Ticket className="h-16 w-16 text-gray-400" />
                </div>
              )}
              <p className="text-center mt-4 font-mono text-sm text-gray-600">
                {currentTicket.ticket_number}
              </p>
            </div>

            {/* Event Details */}
            <div className="space-y-4 mb-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">{event.title}</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <Calendar className="h-5 w-5 text-[#ffde59] mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-600">Date</p>
                    <p className="font-semibold">{formatDate(event.date)}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-[#ffde59] mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-600">Time</p>
                    <p className="font-semibold">{event.time}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-[#ffde59] mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-600">Venue</p>
                    <p className="font-semibold">{event.venue}</p>
                    <p className="text-sm text-gray-500">{event.location}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Ticket className="h-5 w-5 text-[#ffde59] mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-600">Ticket Type</p>
                    <p className="font-semibold">{currentTicket.ticket_type || 'General Admission'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Attendee Info */}
            <div className="border-t pt-6 mb-6">
              <h4 className="font-semibold text-gray-900 mb-3">Attendee Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">Name:</span>
                  <span className="font-medium">{booking.user_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">Email:</span>
                  <span className="font-medium">{booking.user_email}</span>
                </div>
                {booking.user_phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-600">Phone:</span>
                    <span className="font-medium">{booking.user_phone}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Important Notes */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
              <h4 className="font-semibold text-yellow-900 mb-2">Important Information</h4>
              <ul className="text-sm text-yellow-800 space-y-1">
                <li>• Please arrive 30 minutes before the event starts</li>
                <li>• Present this QR code at the entrance for scanning</li>
                <li>• This ticket is non-transferable and valid for one-time use only</li>
                <li>• Keep this ticket safe - screenshot or download for offline access</li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => downloadTicket(currentTicket)}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[#ffde59] to-[#f5c842] text-[#0b6d41] px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
              >
                <Download className="h-5 w-5" />
                Download This Ticket
              </button>
              
              {tickets.length > 1 && (
                <button
                  onClick={downloadAllTickets}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#0b6d41] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#0a5d37] transition-all"
                >
                  <Download className="h-5 w-5" />
                  Download All Tickets
                </button>
              )}
              
              <button
                onClick={onClose}
                className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}