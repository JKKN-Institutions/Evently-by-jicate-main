'use client'

import { useState } from 'react'
import { Search, CreditCard, Eye, Download } from 'lucide-react'
import { formatPrice } from '@/lib/utils'

interface Payment {
  id: string
  amount: number
  currency: string
  status: string
  razorpay_payment_id: string | null
  razorpay_order_id: string | null
  created_at: string
  updated_at: string
  error_code: string | null
  error_description: string | null
  attempts: number
  bookings: {
    id: string
    user_name: string
    user_email: string
    quantity: number
    total_amount: number
    created_at: string
    events: {
      id: string
      title: string
      start_date: string
      time: string
      venue: string
      location: string
      organizer_id: string
      profiles: {
        full_name: string | null
        email: string
      }
    } | null
  }
}

interface AdminPaymentsClientProps {
  payments: Payment[]
}

export default function AdminPaymentsClient({ payments }: AdminPaymentsClientProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [eventFilter, setEventFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('date')

  // Get unique events for filter dropdown
  const uniqueEvents = Array.from(
    new Map(
      payments
        .filter(payment => payment.bookings?.events)
        .map(payment => [
          payment.bookings.events.id,
          {
            id: payment.bookings.events.id,
            title: payment.bookings.events.title
          }
        ])
    ).values()
  )

  // Filter and sort payments
  const filteredPayments = payments
    .filter(payment => {
      if (!payment.bookings?.events) return false
      
      const event = payment.bookings.events
      const organizer = event.profiles
      
      const matchesSearch = 
        event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.bookings.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.bookings.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (organizer?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
        (payment.razorpay_payment_id?.toLowerCase().includes(searchTerm.toLowerCase()) || false)
      
      const matchesStatus = statusFilter === 'all' || payment.status === statusFilter
      const matchesEvent = eventFilter === 'all' || event.id === eventFilter
      
      return matchesSearch && matchesStatus && matchesEvent
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'amount':
          return b.amount - a.amount
        case 'event':
          return (a.bookings?.events?.title || '').localeCompare(b.bookings?.events?.title || '')
        case 'status':
          return a.status.localeCompare(b.status)
        default:
          return 0
      }
    })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'captured':
        return 'bg-green-100 text-green-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      case 'created':
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'authorized':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'captured':
        return 'Completed'
      case 'failed':
        return 'Failed'
      case 'created':
        return 'Created'
      case 'pending':
        return 'Pending'
      case 'authorized':
        return 'Authorized'
      default:
        return status.charAt(0).toUpperCase() + status.slice(1)
    }
  }

  const exportPayments = () => {
    const csvContent = [
      ['Payment ID', 'Event Name', 'Event ID', 'Customer Name', 'Customer Email', 'Amount', 'Status', 'Date', 'Organizer', 'Razorpay Payment ID'].join(','),
      ...filteredPayments.map(payment => [
        payment.id,
        `"${payment.bookings?.events?.title || 'N/A'}"`,
        payment.bookings?.events?.id || 'N/A',
        `"${payment.bookings?.user_name || 'N/A'}"`,
        payment.bookings?.user_email || 'N/A',
        payment.amount,
        payment.status,
        new Date(payment.created_at).toLocaleDateString(),
        `"${payment.bookings?.events?.profiles?.full_name || payment.bookings?.events?.profiles?.email || 'N/A'}"`,
        payment.razorpay_payment_id || 'N/A'
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `payments-export-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by event name, event ID, customer name, email, or payment ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0b6d41] focus:border-transparent"
              />
            </div>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0b6d41] focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="captured">Completed</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
              <option value="created">Created</option>
              <option value="authorized">Authorized</option>
            </select>
            
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0b6d41] focus:border-transparent min-w-[200px]"
            >
              <option value="all">All Events</option>
              {uniqueEvents.map(event => (
                <option key={event.id} value={event.id}>
                  {event.title.length > 30 ? `${event.title.substring(0, 30)}...` : event.title}
                </option>
              ))}
            </select>
            
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#0b6d41] focus:border-transparent"
            >
              <option value="date">Sort by Date</option>
              <option value="amount">Sort by Amount</option>
              <option value="event">Sort by Event</option>
              <option value="status">Sort by Status</option>
            </select>

            <button
              onClick={exportPayments}
              className="px-4 py-2 bg-[#0b6d41] text-white rounded-lg hover:bg-[#0a5d37] transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Results Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <p className="text-sm text-gray-600">
          Showing <span className="font-medium">{filteredPayments.length}</span> of <span className="font-medium">{payments.length}</span> payments
          {searchTerm && <span> matching &quot;<span className="font-medium">{searchTerm}</span>&quot;</span>}
          {statusFilter !== 'all' && <span> with status &quot;<span className="font-medium">{statusFilter}</span>&quot;</span>}
          {eventFilter !== 'all' && <span> for selected event</span>}
        </p>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Event Information
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No payments found</h3>
                    <p className="text-gray-600">
                      {searchTerm || statusFilter !== 'all' || eventFilter !== 'all'
                        ? 'Try adjusting your search or filters'
                        : 'No payment transactions have been recorded yet'
                      }
                    </p>
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">
                          {payment.id.substring(0, 8)}...
                        </div>
                        <div className="text-gray-500">
                          {payment.razorpay_payment_id ? (
                            <span>Razorpay: {payment.razorpay_payment_id.substring(0, 12)}...</span>
                          ) : (
                            <span>Order: {payment.razorpay_order_id?.substring(0, 12)}...</span>
                          )}
                        </div>
                        <div className="text-gray-500 text-xs">
                          {new Date(payment.created_at).toLocaleDateString()} {new Date(payment.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">
                          {payment.bookings?.events?.title || 'N/A'}
                        </div>
                        <div className="text-gray-500">
                          ID: {payment.bookings?.events?.id?.substring(0, 8)}...
                        </div>
                        <div className="text-gray-500">
                          Organizer: {payment.bookings?.events?.profiles?.full_name || payment.bookings?.events?.profiles?.email || 'N/A'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">
                          {payment.bookings?.user_name || 'N/A'}
                        </div>
                        <div className="text-gray-500">
                          {payment.bookings?.user_email || 'N/A'}
                        </div>
                        <div className="text-gray-500">
                          Qty: {payment.bookings?.quantity || 0}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {formatPrice(payment.amount)}
                      </div>
                      {payment.attempts > 1 && (
                        <div className="text-xs text-yellow-600">
                          {payment.attempts} attempts
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(payment.status)}`}>
                        {getStatusText(payment.status)}
                      </span>
                      {payment.error_description && (
                        <div className="text-xs text-red-600 mt-1" title={payment.error_description}>
                          Error: {payment.error_code}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        className="p-2 text-gray-600 hover:text-[#0b6d41] hover:bg-gray-100 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
