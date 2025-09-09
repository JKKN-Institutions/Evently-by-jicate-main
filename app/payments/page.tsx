import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatDate, formatPrice } from '@/lib/utils'
import { CheckCircle, XCircle, Clock, RefreshCw, ArrowLeft } from 'lucide-react'

async function getPaymentHistory() {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    redirect('/events')
  }

  // Check if user is organizer or admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'organizer') {
    // If user is admin, redirect to admin payments page
    if (profile?.role === 'admin') {
      redirect('/admin/payments')
    }
    redirect('/bookings')
  }

  // Get payments for events organized by the user
  const { data: payments, error } = await supabase
    .from('payments')
    .select(`
      *,
      bookings (
        id,
        user_name,
        user_email,
        user_phone,
        quantity,
        events (
          id,
          title,
          date,
          time
        )
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching payments:', error)
    return []
  }

  return payments || []
}

export default async function PaymentsPage() {
  const payments = await getPaymentHistory()

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'captured':
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-[#0b6d41]" />
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />
      case 'pending':
      case 'created':
        return <Clock className="h-5 w-5 text-[#ffde59]" />
      case 'refunded':
      case 'partially_refunded':
        return <RefreshCw className="h-5 w-5 text-[#0b6d41]" />
      default:
        return <Clock className="h-5 w-5 text-gray-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'captured':
      case 'completed':
        return 'bg-[#0b6d41]/10 text-[#0b6d41]'
      case 'failed':
        return 'bg-red-100 text-red-800'
      case 'pending':
      case 'created':
        return 'bg-[#ffde59]/20 text-[#ffde59]'
      case 'refunded':
      case 'partially_refunded':
        return 'bg-[#0b6d41]/10 text-[#0b6d41]'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <Link
            href="/bookings"
            className="inline-flex items-center text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Bookings
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-8">Payment History</h1>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm font-medium text-gray-600">Total Payments</p>
            <p className="text-2xl font-bold text-gray-900">{payments.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm font-medium text-gray-600">Successful</p>
            <p className="text-2xl font-bold text-[#0b6d41]">
              {payments.filter(p => p.status === 'captured').length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm font-medium text-gray-600">Failed</p>
            <p className="text-2xl font-bold text-red-600">
              {payments.filter(p => p.status === 'failed').length}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-sm font-medium text-gray-600">Total Revenue</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatPrice(
                payments
                  .filter(p => p.status === 'captured')
                  .reduce((sum, p) => sum + p.amount, 0)
              )}
            </p>
          </div>
        </div>

        {/* Payments Table */}
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Transaction ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Event / Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {payment.razorpay_payment_id || payment.razorpay_order_id || payment.id.slice(0, 8)}
                    </div>
                    <div className="text-xs text-gray-500">
                      Order: {payment.razorpay_order_id?.slice(-8) || 'N/A'}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {payment.bookings?.events?.title || 'Event'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {payment.bookings?.user_name} ({payment.bookings?.user_email})
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900">
                      {formatPrice(payment.amount)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(payment.status)}
                      <span className={`inline-flex text-xs leading-5 font-semibold rounded-full px-2 py-1 ${getStatusColor(payment.status)}`}>
                        {payment.status}
                      </span>
                    </div>
                    {payment.error_description && (
                      <div className="text-xs text-red-600 mt-1">
                        {payment.error_description}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(payment.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <Link
                      href={`/payments/${payment.id}`}
                      className="text-[#0b6d41] hover:text-[#0a5d37]"
                    >
                      View Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {payments.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No payment records found.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
