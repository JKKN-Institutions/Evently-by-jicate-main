import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatDate, formatPrice } from '@/lib/utils'
import { ArrowLeft, Download, RefreshCw } from 'lucide-react'

async function getPaymentDetails(id: string) {
  const supabase = await createClient()
  
  const { data: payment, error } = await supabase
    .from('payments')
    .select(`
      *,
      bookings (
        *,
        events (
          id,
          title,
          date,
          time,
          venue,
          location
        )
      )
    `)
    .eq('id', id)
    .single()

  if (error || !payment) {
    return null
  }

  // Get payment logs
  const { data: logs } = await supabase
    .from('payment_logs')
    .select('*')
    .eq('payment_id', id)
    .order('created_at', { ascending: false })

  return { payment, logs: logs || [] }
}

export default async function PaymentDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await getPaymentDetails(id)

  if (!data) {
    notFound()
  }

  const { payment, logs } = data

  const getStatusBadge = (status: string) => {
    const colors = {
      created: 'bg-gray-100 text-gray-800',
      captured: 'bg-[#0b6d41]/10 text-[#0b6d41]',
      failed: 'bg-red-100 text-red-800',
      pending: 'bg-[#ffde59]/20 text-[#ffde59]',
      refunded: 'bg-[#0b6d41]/10 text-[#0b6d41]',
    }
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link
            href="/payments"
            className="inline-flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Payments
          </Link>
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold">Payment Details</h1>
              <span className={`inline-flex text-sm leading-5 font-semibold rounded-full px-3 py-1 ${getStatusBadge(payment.status)}`}>
                {payment.status.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Payment Information */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Payment Information</h2>
              <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Payment ID</dt>
                  <dd className="mt-1 text-sm text-gray-900 font-mono">
                    {payment.razorpay_payment_id || 'Not yet processed'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Order ID</dt>
                  <dd className="mt-1 text-sm text-gray-900 font-mono">
                    {payment.razorpay_order_id || 'N/A'}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Amount</dt>
                  <dd className="mt-1 text-sm text-gray-900 font-semibold">
                    {formatPrice(payment.amount)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Currency</dt>
                  <dd className="mt-1 text-sm text-gray-900">{payment.currency}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Created At</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {formatDate(payment.created_at)} at {new Date(payment.created_at).toLocaleTimeString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {formatDate(payment.updated_at)} at {new Date(payment.updated_at).toLocaleTimeString()}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Error Details (if any) */}
            {payment.error_description && (
              <div className="bg-red-50 p-4 rounded-md">
                <h3 className="text-sm font-medium text-red-800 mb-2">Error Details</h3>
                <dl className="text-sm">
                  <div className="mb-2">
                    <dt className="inline font-medium text-red-700">Code: </dt>
                    <dd className="inline text-red-600">{payment.error_code || 'Unknown'}</dd>
                  </div>
                  <div className="mb-2">
                    <dt className="inline font-medium text-red-700">Description: </dt>
                    <dd className="inline text-red-600">{payment.error_description}</dd>
                  </div>
                  {payment.error_source && (
                    <div className="mb-2">
                      <dt className="inline font-medium text-red-700">Source: </dt>
                      <dd className="inline text-red-600">{payment.error_source}</dd>
                    </div>
                  )}
                  {payment.error_step && (
                    <div>
                      <dt className="inline font-medium text-red-700">Step: </dt>
                      <dd className="inline text-red-600">{payment.error_step}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {/* Booking Information */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Booking Information</h2>
              <dl className="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Event</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {payment.bookings?.events?.title}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Event Date</dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {payment.bookings?.events?.date && formatDate(payment.bookings.events.date)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Customer Name</dt>
                  <dd className="mt-1 text-sm text-gray-900">{payment.bookings?.user_name}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Customer Email</dt>
                  <dd className="mt-1 text-sm text-gray-900">{payment.bookings?.user_email}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Customer Phone</dt>
                  <dd className="mt-1 text-sm text-gray-900">{payment.bookings?.user_phone}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Quantity</dt>
                  <dd className="mt-1 text-sm text-gray-900">{payment.bookings?.quantity} tickets</dd>
                </div>
              </dl>
            </div>

            {/* Payment Timeline */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Payment Timeline</h2>
              <div className="flow-root">
                <ul className="-mb-8">
                  {logs.map((log, idx) => (
                    <li key={log.id}>
                      <div className="relative pb-8">
                        {idx !== logs.length - 1 && (
                          <span
                            className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                            aria-hidden="true"
                          />
                        )}
                        <div className="relative flex space-x-3">
                          <div>
                            <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                              log.event_type.includes('failed') ? 'bg-red-500' : 
                              log.event_type.includes('captured') ? 'bg-[#0b6d41]' : 
                              'bg-gray-400'
                            }`}>
                              <span className="h-2.5 w-2.5 rounded-full bg-white" />
                            </span>
                          </div>
                          <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                            <div>
                              <p className="text-sm text-gray-500">
                                {log.event_type.replace(/_/g, ' ').toUpperCase()}
                              </p>
                              {log.event_data && (
                                <pre className="mt-1 text-xs text-gray-400 overflow-x-auto">
                                  {JSON.stringify(log.event_data, null, 2)}
                                </pre>
                              )}
                            </div>
                            <div className="whitespace-nowrap text-right text-sm text-gray-500">
                              {new Date(log.created_at).toLocaleString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
