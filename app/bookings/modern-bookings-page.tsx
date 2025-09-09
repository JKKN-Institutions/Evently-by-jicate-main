import Link from 'next/link'
import { Calendar, MapPin, Ticket, QrCode, Clock, User, CheckCircle, AlertCircle, XCircle } from 'lucide-react'
import { formatDate, formatTime, formatPrice } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { lazy, Suspense } from 'react'

// Lazy load the heavy TicketTemplate component
const TicketTemplate = lazy(() => import('@/components/ticket-template'))

async function getUserBookings() {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    redirect('/events')
  }

  try {
    // Get bookings with tickets - simplified query first
    const { data: bookings, error } = await supabase
      .from('bookings')
      .select(`
        *,
        events!inner (
          id,
          title,
          date,
          time,
          venue,
          location,
          image_url,
          price
        ),
        tickets (
          id,
          status,
          qr_code,
          checked_in_at
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Supabase error fetching bookings:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      })
      
      // Try a simpler query without joins if the complex one fails
      const { data: simpleBookings, error: simpleError } = await supabase
        .from('bookings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      
      if (simpleError) {
        console.error('Simple query also failed:', simpleError)
        return []
      }
      
      // Return simple bookings without event details
      return simpleBookings || []
    }

    return bookings || []
  } catch (err) {
    console.error('Unexpected error in getUserBookings:', err)
    return []
  }
}

export default async function ModernBookingsPage() {
  const bookings = await getUserBookings()

  // Calculate stats
  const totalBookings = bookings.length
  const totalTickets = bookings.reduce((sum, booking) => sum + (booking.tickets?.length || 0), 0)
  const totalSpent = bookings.reduce((sum, booking) => sum + booking.total_amount, 0)
  const upcomingEvents = bookings.filter(booking => 
    booking.events && new Date(booking.events.date) > new Date()
  ).length

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="px-6 py-6">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">My Bookings & Tickets</h1>
                  <p className="text-gray-600 mt-2">Manage your event bookings and download tickets</p>
                </div>
                <div className="hidden md:flex items-center gap-4">
                  <Link
                    href="/events"
                    className="bg-[#0b6d41] text-white px-6 py-3 rounded-xl hover:bg-[#0a5d37] transition-colors font-medium"
                  >
                    Browse Events
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Stats Cards */}
          {totalBookings > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Bookings</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{totalBookings}</p>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-xl">
                    <Ticket className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Tickets</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{totalTickets}</p>
                  </div>
                  <div className="bg-green-50 p-3 rounded-xl">
                    <QrCode className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Upcoming</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">{upcomingEvents}</p>
                  </div>
                  <div className="bg-orange-50 p-3 rounded-xl">
                    <Clock className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Spent</p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">₹{formatPrice(totalSpent)}</p>
                  </div>
                  <div className="bg-purple-50 p-3 rounded-xl">
                    <Calendar className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bookings List */}
          {bookings.length === 0 ? (
            <div className="text-center py-20">
              <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 max-w-lg mx-auto">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Ticket className="h-10 w-10 text-gray-400" />
                </div>
                <h3 className="text-2xl font-semibold text-gray-900 mb-4">No bookings yet</h3>
                <p className="text-gray-600 mb-8">
                  You haven&apos;t booked any events yet. Start exploring amazing events near you!
                </p>
                <Link
                  href="/events"
                  className="bg-[#0b6d41] text-white px-8 py-4 rounded-xl hover:bg-[#0a5d37] transition-colors font-semibold inline-flex items-center gap-2"
                >
                  <Calendar className="h-5 w-5" />
                  Browse Events
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {bookings.map((booking) => (
                <div key={booking.id} className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
                  <div className="lg:flex">
                    {/* Event Image */}
                    <div className="lg:w-80 h-64 lg:h-auto bg-gray-200 flex-shrink-0 relative">
                      {booking.events?.image_url ? (
                        <img
                          src={booking.events.image_url}
                          alt={booking.events.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#0b6d41] to-[#ffde59]">
                          <Calendar className="h-16 w-16 text-white" />
                        </div>
                      )}
                      
                      {/* Status Badge */}
                      <div className="absolute top-4 right-4">
                        <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                          booking.payment_status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : booking.payment_status === 'pending'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {booking.payment_status === 'completed' ? (
                            <span className="flex items-center gap-1">
                              <CheckCircle className="h-3 w-3" />
                              Confirmed
                            </span>
                          ) : booking.payment_status === 'pending' ? (
                            <span className="flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              Pending
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <XCircle className="h-3 w-3" />
                              Failed
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Booking Details */}
                    <div className="flex-1 p-8">
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex-1">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                                <Link
                                  href={`/events/${booking.events?.id}`}
                                  className="hover:text-[#0b6d41] transition-colors"
                                >
                                  {booking.events?.title}
                                </Link>
                              </h3>
                              
                              <div className="space-y-3 text-gray-600">
                                <div className="flex items-center gap-3">
                                  <div className="bg-blue-50 p-2 rounded-lg">
                                    <Calendar className="h-4 w-4 text-blue-600" />
                                  </div>
                                  <span className="font-medium">
                                    {booking.events?.date && formatDate(booking.events.date)} at{' '}
                                    {booking.events?.time && formatTime(booking.events.time)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="bg-green-50 p-2 rounded-lg">
                                    <MapPin className="h-4 w-4 text-green-600" />
                                  </div>
                                  <span>{booking.events?.venue}, {booking.events?.location}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="bg-purple-50 p-2 rounded-lg">
                                    <Ticket className="h-4 w-4 text-purple-600" />
                                  </div>
                                  <span>{booking.quantity} {booking.quantity === 1 ? 'ticket' : 'tickets'}</span>
                                </div>
                              </div>
                            </div>

                            <div className="text-right ml-6">
                              <div className="text-3xl font-bold text-gray-900 mb-2">
                                ₹{formatPrice(booking.total_amount)}
                              </div>
                            </div>
                          </div>

                          {/* Booking Info */}
                          <div className="bg-gray-50 rounded-xl p-4 mb-6">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-gray-600">Booking ID:</span>
                                <span className="font-mono font-semibold text-gray-900 ml-2">
                                  {booking.id.slice(0, 8).toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-600">Booked on:</span>
                                <span className="font-semibold text-gray-900 ml-2">
                                  {formatDate(booking.created_at)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Tickets Section */}
                          {booking.payment_status === 'completed' && booking.tickets && booking.tickets.length > 0 && (
                            <div className="border-t border-gray-100 pt-6">
                              <div className="flex items-center gap-3 mb-6">
                                <div className="bg-[#0b6d41] p-2 rounded-lg">
                                  <QrCode className="h-5 w-5 text-white" />
                                </div>
                                <h4 className="text-xl font-semibold text-gray-900">
                                  Your Tickets ({booking.tickets.length})
                                </h4>
                                <div className="text-sm text-green-600 bg-green-50 px-3 py-1 rounded-full font-medium">
                                  ✓ Ready to use
                                </div>
                              </div>
                              
                              <div className="grid gap-6">
                                {booking.tickets.map((ticket) => (
                                  <div key={ticket.id} className="bg-gradient-to-r from-gray-50 to-white rounded-xl p-6 border border-gray-200">
                                    <div className="flex items-center justify-between mb-4">
                                      <div className="flex items-center gap-3">
                                        <div className="bg-[#0b6d41] text-white px-3 py-1 rounded-lg text-sm font-semibold">
                                          #{ticket.id.slice(0, 8).toUpperCase()}
                                        </div>
                                        <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                                          ticket.status === 'valid' 
                                            ? 'bg-green-100 text-green-800' 
                                            : ticket.status === 'used'
                                            ? 'bg-gray-100 text-gray-800'
                                            : 'bg-red-100 text-red-800'
                                        }`}>
                                          {ticket.status === 'valid' ? (
                                            <>
                                              <CheckCircle className="h-3 w-3" />
                                              Valid
                                            </>
                                          ) : ticket.status === 'used' ? (
                                            <>
                                              <Clock className="h-3 w-3" />
                                              Used
                                            </>
                                          ) : (
                                            <>
                                              <XCircle className="h-3 w-3" />
                                              Cancelled
                                            </>
                                          )}
                                        </span>
                                      </div>
                                    </div>
                                    
                                    {ticket.checked_in_at && (
                                      <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                                        <p className="text-sm text-blue-800 font-medium">
                                          ✓ Checked in: {new Date(ticket.checked_in_at).toLocaleString()}
                                        </p>
                                      </div>
                                    )}

                                    {ticket.status === 'valid' && (
                                      <Suspense fallback={
                                        <div className="animate-pulse bg-gray-200 rounded-xl h-40 flex items-center justify-center">
                                          <div className="text-gray-500 text-sm">Loading ticket...</div>
                                        </div>
                                      }>
                                        <TicketTemplate
                                          ticket={{
                                            ...ticket,
                                            event: booking.events,
                                            booking: {
                                              user_name: booking.user_name,
                                              user_email: booking.user_email
                                            }
                                          }}
                                        />
                                      </Suspense>
                                    )}

                                    {ticket.status === 'used' && (
                                      <div className="bg-gray-100 rounded-xl p-6 text-center">
                                        <QrCode className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                                        <p className="text-gray-600 font-medium">This ticket has been used</p>
                                        <p className="text-sm text-gray-500 mt-1">Thank you for attending!</p>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
