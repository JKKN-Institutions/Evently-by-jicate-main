'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import TicketTemplate, { TicketData } from '@/components/tickets/TicketTemplate'
import { Download, Printer, Share2, Eye, Mail, MessageCircle, QrCode } from 'lucide-react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

export default function TicketPage() {
  const params = useParams()
  const ticketId = params.id as string
  const [ticketData, setTicketData] = useState<TicketData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [variant, setVariant] = useState<'standard' | 'vip' | 'premium'>('standard')
  const [size, setSize] = useState<'full' | 'compact'>('full')
  const [hasQREnabled, setHasQREnabled] = useState(false)
  const ticketRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchTicketData()
  }, [ticketId])

  const fetchTicketData = async () => {
    try {
      setLoading(true)
      
      // First check if ticketId is a ticket number or booking ID
      let booking = null
      let isTicketNumber = ticketId.startsWith('EVT') || ticketId.includes('-')
      
      if (isTicketNumber) {
        // If it's a ticket number, first get the ticket to find the booking ID
        const { data: ticket, error: ticketError } = await supabase
          .from('tickets')
          .select('booking_id, ticket_number')
          .eq('ticket_number', ticketId)
          .single()
        
        if (ticketError || !ticket) {
          throw new Error('Ticket not found')
        }
        
        // Now fetch the booking with the correct booking ID
        const { data: bookingData, error: bookingError } = await supabase
          .from('bookings')
          .select(`
            *,
            events (
              *,
              ticket_template,
              profiles:organizer_id (
                full_name,
                email
              )
            ),
            booking_seats (
              seat_id,
              attendee_name,
              attendee_email,
              event_seats (
                seat_number,
                row_number,
                section,
                seat_type
              )
            )
          `)
          .eq('id', ticket.booking_id)
          .single()
        
        booking = bookingData
        if (bookingError || !booking) {
          throw new Error('Booking not found')
        }
      } else {
        // If it's a booking ID, fetch directly
        const { data: bookingData, error: bookingError } = await supabase
          .from('bookings')
          .select(`
            *,
            events (
              *,
              ticket_template,
              profiles:organizer_id (
                full_name,
                email
              )
            ),
            booking_seats (
              seat_id,
              attendee_name,
              attendee_email,
              event_seats (
                seat_number,
                row_number,
                section,
                seat_type
              )
            )
          `)
          .eq('id', ticketId)
          .single()

        booking = bookingData
        if (bookingError || !booking) {
          throw new Error('Ticket not found')
        }
      }
      
      // Get seat information if available
      const seats = booking.booking_seats?.map((bs: any) => ({
        seat_number: bs.event_seats?.seat_number,
        row_number: bs.event_seats?.row_number,
        section: bs.event_seats?.section,
        attendee_name: bs.attendee_name
      })) || []

      // Check if event has ticket template with QR enabled
      const hasTicketTemplate = booking.events.ticket_template && booking.events.ticket_template.includeQRCode
      setHasQREnabled(hasTicketTemplate)
      
      // Determine ticket type based on price or other factors
      const ticketType = booking.total_amount > 5000 ? 'VIP' : 
                        booking.total_amount > 2000 ? 'Premium' : 
                        booking.quantity > 3 ? 'Group' : 'General'

      // Generate unique QR data for the ticket
      const qrDataContent = {
        ticketId: ticketId,
        eventId: booking.events.id,
        eventName: booking.events.title,
        attendeeName: booking.attendee_name || booking.user_name || 'Guest',
        ticketNumber: `TKT-${booking.id.slice(0, 8).toUpperCase()}`,
        validationUrl: `${window.location.origin}/verify/${ticketId}`
      }

      // Format ticket data according to our template interface
      const formattedTicket: TicketData = {
        // Event Information
        eventName: booking.events.title,
        eventLogo: booking.events.image_url || '/logo.png',
        eventDate: new Date(booking.events.date).toLocaleDateString('en-IN', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        eventTime: booking.events.time,
        venue: booking.events.venue,
        venueAddress: booking.events.location,
        hallRoom: booking.events.hall || undefined,
        
        // Ticket Information with seat allocation
        ticketNumber: `TKT-${booking.id.slice(0, 8).toUpperCase()}`,
        ticketType: ticketType as any,
        seatNumber: seats.length > 0 ? seats.map((s: any) => s.seat_number).join(', ') : undefined,
        zone: seats.length > 0 && seats[0].section ? seats[0].section : undefined,
        category: booking.category || undefined,
        gateNumber: booking.gate || undefined,
        entryTime: booking.entry_time || undefined,
        
        // Attendee Information
        attendeeName: booking.attendee_name || booking.user_name || 'Guest',
        attendeeEmail: booking.attendee_email || booking.user_email,
        attendeePhone: booking.attendee_phone,
        registrationId: `REG-${booking.id.slice(-8).toUpperCase()}`,
        
        // Pricing Information
        price: booking.total_amount || 'Free',
        currency: '₹',
        paymentStatus: booking.payment_status === 'completed' ? 'Paid' : 
                       booking.payment_status === 'pending' ? 'Pending' : 'Complimentary',
        paymentId: booking.payment_id || undefined,
        
        // Organization Information
        organizerName: booking.events.profiles?.full_name || 'Event Organizer',
        organizerLogo: '/organizer-logo.png',
        organizerContact: booking.events.profiles?.email,
        sponsors: [
          { name: 'JKKN Institutions', logo: '/jkkn-logo.png' },
          { name: 'Tech Partners', logo: '/tech-logo.png' }
        ],
        
        // Additional Information
        website: 'www.evently.com',
        socialMedia: {
          facebook: '@evently',
          twitter: '@evently',
          instagram: '@evently_official'
        },
        
        // Security - Enhanced QR data with ticket template support
        qrData: hasTicketTemplate ? JSON.stringify(qrDataContent) : `${window.location.origin}/verify/${ticketId}`,
        watermark: true,
        hologram: ticketType === 'VIP' || ticketType === 'Premium',
        
        // Terms & Conditions
        terms: [
          'This ticket is non-refundable and non-transferable',
          'Valid ID proof required for entry',
          'Gates open 30 minutes before event time',
          'No outside food or beverages allowed',
          'Management reserves all rights of admission'
        ],
        ageRestriction: booking.events.age_restriction || undefined,
        idRequired: true,
        nonTransferable: true
      }

      setTicketData(formattedTicket)
      
      // Set variant based on ticket type
      if (ticketType === 'VIP') setVariant('vip')
      else if (ticketType === 'Premium') setVariant('premium')
      
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadPDF = async () => {
    if (!ticketRef.current) return

    try {
      const canvas = await html2canvas(ticketRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      })
      
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: size === 'full' ? 'landscape' : 'portrait',
        unit: 'mm',
        format: size === 'full' ? 'a4' : [100, 150]
      })
      
      const imgWidth = pdf.internal.pageSize.getWidth()
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight)
      pdf.save(`ticket-${ticketId}.pdf`)
    } catch (err) {
      console.error('Error generating PDF:', err)
    }
  }

  const handleDownloadImage = async () => {
    if (!ticketRef.current) return

    try {
      const canvas = await html2canvas(ticketRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      })
      
      const link = document.createElement('a')
      link.download = `ticket-${ticketId}.png`
      link.href = canvas.toDataURL()
      link.click()
    } catch (err) {
      console.error('Error generating image:', err)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Ticket for ${ticketData?.eventName}`,
          text: `Here's my ticket for ${ticketData?.eventName} on ${ticketData?.eventDate}`,
          url: window.location.href
        })
      } catch (err) {
        console.error('Error sharing:', err)
      }
    }
  }

  const handleEmailTicket = () => {
    const subject = encodeURIComponent(`Your ticket for ${ticketData?.eventName}`)
    const body = encodeURIComponent(`
      Hello ${ticketData?.attendeeName},
      
      Your ticket for ${ticketData?.eventName} is ready!
      
      Event Details:
      Date: ${ticketData?.eventDate}
      Time: ${ticketData?.eventTime}
      Venue: ${ticketData?.venue}
      
      Ticket Number: ${ticketData?.ticketNumber}
      
      View your ticket: ${window.location.href}
      
      See you at the event!
    `)
    window.open(`mailto:${ticketData?.attendeeEmail}?subject=${subject}&body=${body}`)
  }

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(`
      🎟️ My ticket for *${ticketData?.eventName}*
      📅 ${ticketData?.eventDate}
      ⏰ ${ticketData?.eventTime}
      📍 ${ticketData?.venue}
      
      Ticket: ${window.location.href}
    `)
    window.open(`https://wa.me/?text=${text}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading ticket...</p>
        </div>
      </div>
    )
  }

  if (error || !ticketData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 text-xl">⚠️ {error || 'Ticket not found'}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header Controls */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-gray-900">Your Ticket</h1>
              {hasQREnabled && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                  <QrCode className="h-4 w-4" />
                  QR Enabled
                </span>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => setVariant('standard')}
                  className={`px-3 py-1 rounded ${variant === 'standard' ? 'bg-indigo-500 text-white' : 'bg-gray-200'}`}
                >
                  Standard
                </button>
                <button
                  onClick={() => setVariant('vip')}
                  className={`px-3 py-1 rounded ${variant === 'vip' ? 'bg-yellow-500 text-white' : 'bg-gray-200'}`}
                >
                  VIP
                </button>
                <button
                  onClick={() => setVariant('premium')}
                  className={`px-3 py-1 rounded ${variant === 'premium' ? 'bg-purple-500 text-white' : 'bg-gray-200'}`}
                >
                  Premium
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSize('full')}
                  className={`px-3 py-1 rounded ${size === 'full' ? 'bg-indigo-500 text-white' : 'bg-gray-200'}`}
                >
                  Full Size
                </button>
                <button
                  onClick={() => setSize('compact')}
                  className={`px-3 py-1 rounded ${size === 'compact' ? 'bg-indigo-500 text-white' : 'bg-gray-200'}`}
                >
                  Compact
                </button>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleDownloadPDF}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
              >
                <Download className="h-4 w-4" />
                PDF
              </button>
              <button
                onClick={handleDownloadImage}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
              >
                <Download className="h-4 w-4" />
                Image
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                <Printer className="h-4 w-4" />
                Print
              </button>
              <button
                onClick={handleShare}
                className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600"
              >
                <Share2 className="h-4 w-4" />
                Share
              </button>
            </div>
          </div>
          
          {/* Quick Share Options */}
          <div className="flex gap-2 mt-4 pt-4 border-t">
            <button
              onClick={handleEmailTicket}
              className="flex items-center gap-2 px-3 py-1 bg-gray-100 rounded hover:bg-gray-200"
            >
              <Mail className="h-4 w-4" />
              Email
            </button>
            <button
              onClick={handleWhatsAppShare}
              className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </button>
          </div>
        </div>
        
        {/* Ticket Preview */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div ref={ticketRef} className="mx-auto" style={{ maxWidth: size === 'full' ? '900px' : '400px' }}>
            <TicketTemplate 
              data={ticketData} 
              variant={variant}
              size={size}
            />
          </div>
        </div>
        
        {/* Instructions */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Important Instructions:</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Please carry a printed or digital copy of this ticket</li>
            <li>• Arrive at least 30 minutes before the event time</li>
            <li>• Carry a valid government-issued ID proof</li>
            <li>• This ticket is valid for one-time entry only</li>
            <li>• For any queries, contact: {ticketData.organizerContact}</li>
          </ul>
        </div>
      </div>
      
      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #ticket-container, #ticket-container * {
            visibility: visible;
          }
          #ticket-container {
            position: absolute;
            left: 0;
            top: 0;
          }
        }
      `}</style>
    </div>
  )
}