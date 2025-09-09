import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Calendar, Users, Ticket, QrCode, Download, Scan } from 'lucide-react'
import Link from 'next/link'
import BulkQRDownload from '@/components/qr/bulk-qr-download'

async function getEventQRData(eventId: string) {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    redirect('/events')
  }

  // Get event details
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single()

  if (eventError || !event) {
    redirect('/events')
  }

  // Check authorization - must be event organizer or admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const userRole = profile?.role || 'user'
  const isOrganizer = event.organizer_id === user.id
  const isAdmin = userRole === 'admin'

  if (!isOrganizer && !isAdmin) {
    redirect('/events')
  }

  // Get tickets with booking details
  const { data: tickets, error: ticketsError } = await supabase
    .from('tickets')
    .select(`
      *,
      bookings (
        user_name,
        user_email,
        user_phone,
        payment_status
      )
    `)
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })

  if (ticketsError) {
    console.error('Error fetching tickets:', ticketsError)
  }

  // Get scan statistics
  const { data: scanStats } = await supabase
    .from('check_ins')
    .select('scan_result')
    .eq('event_id', eventId)

  const stats = {
    totalTickets: tickets?.length || 0,
    validTickets: tickets?.filter(t => t.status === 'valid').length || 0,
    usedTickets: tickets?.filter(t => t.status === 'used').length || 0,
    totalScans: scanStats?.length || 0,
    successfulScans: scanStats?.filter(s => s.scan_result === 'success').length || 0
  }

  return { event, tickets: tickets || [], stats, user }
}

export default async function EventQRCodesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { event, tickets, stats, user } = await getEventQRData(id)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <Link
                  href={`/events/${event.id}`}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ← Back to Event
                </Link>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
              <p className="text-gray-600 mt-1">QR Code Management</p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href={`/events/${event.id}/scan`}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Scan className="h-4 w-4" />
                Scan Tickets
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Tickets</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalTickets}</p>
              </div>
              <Ticket className="h-8 w-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Valid Tickets</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.validTickets}</p>
              </div>
              <QrCode className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Checked In</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.usedTickets}</p>
              </div>
              <Users className="h-8 w-8 text-purple-600" />
            </div>
          </div>

          <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Scans</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalScans}</p>
              </div>
              <Scan className="h-8 w-8 text-orange-600" />
            </div>
          </div>
        </div>

        {/* Bulk Download Section */}
        <div className="mb-8">
          <BulkQRDownload 
            eventId={event.id}
            eventTitle={event.title}
            totalTickets={stats.validTickets}
          />
        </div>

        {/* Tickets List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Individual Tickets</h2>
            <p className="text-sm text-gray-600 mt-1">Download QR codes for specific tickets</p>
          </div>

          {tickets.length === 0 ? (
            <div className="p-12 text-center">
              <QrCode className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No tickets yet</h3>
              <p className="text-gray-600 mb-6">Tickets will appear here once people book your event</p>
              <Link
                href={`/events/${event.id}`}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                View Event Details
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ticket
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tickets.map((ticket) => (
                    <tr key={ticket.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <QrCode className="h-5 w-5 text-gray-400 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {ticket.ticket_number}
                            </div>
                            <div className="text-sm text-gray-500">
                              {ticket.ticket_type}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{ticket.bookings?.user_name}</div>
                        <div className="text-sm text-gray-500">{ticket.bookings?.user_email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          ticket.status === 'valid' 
                            ? 'bg-green-100 text-green-800'
                            : ticket.status === 'used'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {ticket.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          ticket.bookings?.payment_status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {ticket.bookings?.payment_status || 'pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-2">
                          <a
                            href={`/api/tickets/${ticket.id}/qr-download?format=png&size=512`}
                            download
                            className="text-purple-600 hover:text-purple-900 flex items-center gap-1"
                          >
                            <Download className="h-4 w-4" />
                            PNG
                          </a>
                          <span className="text-gray-300">|</span>
                          <a
                            href={`/api/tickets/${ticket.id}/qr-download?format=svg&size=512`}
                            download
                            className="text-indigo-600 hover:text-indigo-900 flex items-center gap-1"
                          >
                            <Download className="h-4 w-4" />
                            SVG
                          </a>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">How to Use QR Codes</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-blue-800">
            <div>
              <h4 className="font-semibold mb-2">📥 For Printing:</h4>
              <ul className="space-y-1">
                <li>• Download bulk QR codes as ZIP file</li>
                <li>• Use PNG format for best print quality</li>
                <li>• Print at 300 DPI or higher</li>
                <li>• Each QR code is named with ticket number</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">📱 For Scanning:</h4>
              <ul className="space-y-1">
                <li>• Use the mobile scanner at the venue</li>
                <li>• Each QR code can only be used once</li>
                <li>• Scan results are logged automatically</li>
                <li>• Works offline after initial load</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
