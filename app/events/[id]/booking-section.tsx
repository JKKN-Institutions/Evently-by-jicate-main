'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { IndianRupee, Loader2 } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import { Event } from '@/types'
import { loadRazorpayScript, RazorpayOptions, RazorpayResponse } from '@/lib/razorpay'
import TicketPopup from '@/components/tickets/ticket-popup'

interface BookingSectionProps {
  event: Event
  availableSeats: number
  isFullyBooked: boolean
}

export default function BookingSection({ 
  event, 
  availableSeats, 
  isFullyBooked 
}: BookingSectionProps) {
  const router = useRouter()
  const [showBookingForm, setShowBookingForm] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showTicketPopup, setShowTicketPopup] = useState(false)
  const [generatedTickets, setGeneratedTickets] = useState<any[]>([])
  const [currentBooking, setCurrentBooking] = useState<any>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: ''
  })

  const handleBooking = () => {
    if (!isFullyBooked) {
      setShowBookingForm(true)
    }
  }

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsProcessing(true)

    try {
      // Create booking
      const bookingResponse = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event_id: event.id,
          user_name: formData.name,
          user_email: formData.email,
          user_phone: formData.phone,
          quantity: quantity
        })
      })

      if (!bookingResponse.ok) {
        const error = await bookingResponse.json()
        throw new Error(error.error || 'Failed to create booking')
      }

      const { booking } = await bookingResponse.json()

      // Handle payment
      if (event.price > 0) {
        // Load Razorpay script
        const scriptLoaded = await loadRazorpayScript()
        if (!scriptLoaded) {
          throw new Error('Failed to load payment gateway')
        }

        // Create Razorpay order
        const orderResponse = await fetch('/api/payments/create-order', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            bookingId: booking.id
          })
        })

        if (!orderResponse.ok) {
          throw new Error('Failed to create payment order')
        }

        const orderData = await orderResponse.json()
        console.log('Order created:', orderData)

        // Initialize Razorpay
        const razorpayKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
        console.log('Razorpay Key:', razorpayKey ? `${razorpayKey.substring(0, 8)}...` : 'NOT SET')
        
        if (!razorpayKey) {
          throw new Error('Razorpay key is not configured. Please add NEXT_PUBLIC_RAZORPAY_KEY_ID to your .env.local file')
        }
        
        const options: RazorpayOptions = {
          key: razorpayKey,
          amount: orderData.amount,
          currency: 'INR',
          name: 'Evently',
          description: `Booking for ${event.title}`,
          order_id: orderData.orderId,
          handler: async (response: RazorpayResponse) => {
            // Verify payment
            const verifyResponse = await fetch('/api/payments/verify', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                ...response,
                bookingId: booking.id,
                paymentId: orderData.paymentId
              })
            })

            if (verifyResponse.ok) {
              // Generate tickets after successful payment
              const ticketResponse = await fetch('/api/tickets/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookingId: booking.id })
              })
              
              if (ticketResponse.ok) {
                const { tickets } = await ticketResponse.json()
                setGeneratedTickets(tickets)
                setCurrentBooking(booking)
                setShowTicketPopup(true)
                setShowBookingForm(false)
                setFormData({ name: '', email: '', phone: '' })
              } else {
                alert('Payment successful! Check your email for booking confirmation.')
                router.push('/tickets')
              }
            } else {
              alert('Payment verification failed. Please contact support.')
            }
          },
          prefill: {
            name: formData.name,
            email: formData.email,
            contact: formData.phone
          },
          theme: {
            color: '#0b6d41'
          },
          modal: {
            ondismiss: () => {
              setIsProcessing(false)
            },
            confirm_close: true
          },
          retry: {
            enabled: true,
            max_count: 3
          }
        }

        const razorpay = new window.Razorpay(options)
        
        razorpay.on('payment.failed', async (response: any) => {
          console.log('Payment failed, handling gracefully:', response.error)
          
          // Track payment failure - always handle gracefully
          try {
            const failureResponse = await fetch('/api/payments/failed', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                bookingId: booking.id,
                paymentId: orderData.paymentId,
                error: response.error
              })
            })
            
            const failureData = await failureResponse.json()
            console.log('Payment failure recorded:', failureData)
          } catch (error) {
            console.log('Failed to track payment failure, continuing:', error)
            // Don't throw error, just log it
          }
          
          // Show user-friendly message
          const errorMessage = response.error?.description || 'Payment could not be completed'
          alert(`Payment Failed\n\n${errorMessage}\n\nDon't worry! No money has been charged. You can try again or contact support if needed.`)
          setIsProcessing(false)
        })
        
        razorpay.open()
      } else {
        // For free events, generate tickets immediately
        const ticketResponse = await fetch('/api/tickets/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId: booking.id })
        })
        
        if (ticketResponse.ok) {
          const { tickets } = await ticketResponse.json()
          setGeneratedTickets(tickets)
          setCurrentBooking(booking)
          setShowTicketPopup(true)
          setShowBookingForm(false)
          setFormData({ name: '', email: '', phone: '' })
        } else {
          alert('Booking confirmed! Check your email for details.')
          router.push('/tickets')
        }
      }
    } catch (error) {
      console.log('Booking error, handling gracefully:', error)
      
      // Show user-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'Unable to process booking'
      alert(`Booking Error\n\n${errorMessage}\n\nPlease try again. If the problem persists, contact support.`)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6 sticky top-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-2xl font-bold mb-2">
          {event.price === 0 ? (
            <span className="text-[#0b6d41]">Free</span>
          ) : (
            <>
              <IndianRupee className="h-6 w-6" />
              <span>{formatPrice(event.price)}</span>
            </>
          )}
          {event.price > 0 && <span className="text-base font-normal text-gray-600">per ticket</span>}
        </div>
      </div>

      {!showBookingForm ? (
        <>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Number of tickets
            </label>
            
            {/* Enhanced quantity selector with buttons */}
            <div className="flex items-center gap-3 mb-2">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={isFullyBooked || quantity <= 1}
                className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                -
              </button>
              
              <div className="flex-1">
                <select
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value))}
                  disabled={isFullyBooked}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0b6d41] text-center font-medium"
                >
                  {[...Array(Math.min(20, availableSeats))].map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1} {i === 0 ? 'ticket' : 'tickets'}
                    </option>
                  ))}
                </select>
              </div>
              
              <button
                type="button"
                onClick={() => setQuantity(Math.min(Math.min(20, availableSeats), quantity + 1))}
                disabled={isFullyBooked || quantity >= Math.min(20, availableSeats)}
                className="w-10 h-10 rounded-full border border-gray-300 flex items-center justify-center hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                +
              </button>
            </div>
            
            {/* Helpful text */}
            <div className="text-xs text-gray-500 space-y-1">
              <p>• Maximum 20 tickets per booking</p>
              {availableSeats < 20 && (
                <p>• Only {availableSeats} seats available</p>
              )}
              {quantity > 1 && (
                <p>• Each ticket will have a unique QR code</p>
              )}
              {quantity >= 10 && (
                <p className="text-blue-600 font-medium">🎉 Group booking discount may apply!</p>
              )}
            </div>
          </div>

          {quantity > 1 && (
            <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-green-50 rounded-md border border-blue-200">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Price per ticket</span>
                  <span>{event.price === 0 ? 'Free' : formatPrice(event.price)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Quantity</span>
                  <span>{quantity} tickets</span>
                </div>
                <div className="border-t border-blue-200 pt-2 flex justify-between font-semibold">
                  <span>Total Amount</span>
                  <span className="text-[#0b6d41]">
                    {event.price === 0 ? 'Free' : formatPrice(event.price * quantity)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleBooking}
            disabled={isFullyBooked}
            className={`w-full py-3 px-4 rounded-md font-semibold ${
              isFullyBooked
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-[#0b6d41] text-white hover:bg-[#0a5d37]'
            }`}
          >
            {isFullyBooked ? 'Fully Booked' : 'Book Now'}
          </button>
        </>
      ) : (
        <form onSubmit={handlePayment} className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Booking Details</h3>
            <div className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
              {quantity} {quantity === 1 ? 'ticket' : 'tickets'}
            </div>
          </div>
          
          {/* Booking Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
            <h4 className="font-medium text-blue-900 mb-2">Booking Summary</h4>
            <div className="space-y-1 text-sm text-blue-800">
              <div className="flex justify-between">
                <span>Event:</span>
                <span className="font-medium">{event.title}</span>
              </div>
              <div className="flex justify-between">
                <span>Tickets:</span>
                <span>{quantity} × {event.price === 0 ? 'Free' : formatPrice(event.price)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t border-blue-200 pt-1">
                <span>Total:</span>
                <span>{event.price === 0 ? 'Free' : formatPrice(event.price * quantity)}</span>
              </div>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
              disabled={isProcessing}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
              disabled={isProcessing}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              required
              pattern="[0-9]{10}"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
              placeholder="10 digit mobile number"
              disabled={isProcessing}
            />
          </div>

          <div className="border-t pt-4">
            <div className="flex justify-between font-semibold text-lg mb-4">
              <span>Total Amount</span>
              <span>{formatPrice(event.price * quantity)}</span>
            </div>

            <button
              type="submit"
              disabled={isProcessing}
              className="w-full bg-[#0b6d41] text-white py-3 px-4 rounded-md font-semibold hover:bg-[#0a5d37] mb-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Proceed to Payment'
              )}
            </button>
            
            <button
              type="button"
              onClick={() => setShowBookingForm(false)}
              disabled={isProcessing}
              className="w-full text-gray-600 hover:text-gray-800 disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {!isFullyBooked && (
        <p className="text-sm text-gray-600 mt-4 text-center">
          {availableSeats < 50 && `Hurry! Only ${availableSeats} seats left`}
        </p>
      )}

      {/* Razorpay badge */}
      {event.price > 0 && (
        <div className="mt-4 pt-4 border-t text-center">
          <p className="text-xs text-gray-500">Secure payments powered by</p>
          <img 
            src="https://badges.razorpay.com/badge-light.png" 
            alt="Razorpay" 
            className="h-8 mx-auto mt-1"
          />
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-2 p-2 bg-yellow-50 rounded text-xs text-yellow-800">
              <p className="font-semibold">Test Mode</p>
              <p>Card: 4111 1111 1111 1111</p>
              <p>CVV: Any 3 digits, Expiry: Any future date</p>
            </div>
          )}
        </div>
      )}

      {/* Ticket Popup */}
      {showTicketPopup && (
        <TicketPopup
          isOpen={showTicketPopup}
          onClose={() => {
            setShowTicketPopup(false)
            router.push('/tickets')
          }}
          tickets={generatedTickets}
          event={event}
          booking={currentBooking}
        />
      )}
    </div>
  )
}