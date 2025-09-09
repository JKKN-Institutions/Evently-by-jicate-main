import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CreditCard, TrendingUp, AlertCircle, CheckCircle, Filter, Download } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import AdminPaymentsClient from './admin-payments-client'

async function getAdminPaymentData() {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    redirect('/events')
  }

  // Check if user is admin
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || !profile || (profile as any).role !== 'admin') {
    redirect('/events')
  }

  // Get all payments with booking and event details
  let { data: payments, error } = await supabase
    .from('payments')
    .select(`
      *,
      bookings (
        id,
        user_email,
        user_name,
        quantity,
        total_amount,
        events (
          id,
          title,
          start_date,
          venue,
          organizer_id,
          profiles (
            full_name,
            email
          )
        )
      )
    `)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching payments with relations:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint
    })
    
    // Try a simpler query without deep relations
    const { data: simplePayments, error: simpleError } = await supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (simpleError) {
      console.error('Error fetching simple payments:', {
        message: simpleError.message,
        code: simpleError.code,
        details: simpleError.details,
        hint: simpleError.hint
      })
      return { payments: [], stats: { total: 0, completed: 0, failed: 0, pending: 0, totalRevenue: 0 } }
    }
    
    // If simple query works, fetch related data separately
    if (simplePayments && simplePayments.length > 0) {
      const bookingIds = [...new Set(simplePayments.map(p => p.booking_id).filter(Boolean))]
      
      const { data: bookings } = await supabase
        .from('bookings')
        .select(`
          id,
          user_email,
          user_name,
          quantity,
          total_amount,
          event_id
        `)
        .in('id', bookingIds)
      
      const bookingsMap = new Map(bookings?.map(b => [b.id, b]) || [])
      
      // Fetch events separately if we have bookings
      if (bookings && bookings.length > 0) {
        const eventIds = [...new Set(bookings.map(b => b.event_id).filter(Boolean))]
        const { data: events } = await supabase
          .from('events')
          .select('id, title, start_date, venue, organizer_id')
          .in('id', eventIds)
        
        const eventsMap = new Map(events?.map(e => [e.id, e]) || [])
        
        // Combine the data
        payments = simplePayments.map(payment => {
          const booking = bookingsMap.get(payment.booking_id)
          const event = booking ? eventsMap.get(booking.event_id) : null
          
          return {
            ...payment,
            bookings: booking ? {
              ...booking,
              events: event || null
            } : null
          }
        })
      } else {
        payments = simplePayments
      }
    } else {
      payments = []
    }
  }

  // Calculate stats
  const stats = {
    total: payments?.length || 0,
    completed: payments?.filter((p: any) => p.status === 'captured').length || 0,
    failed: payments?.filter((p: any) => p.status === 'failed').length || 0,
    pending: payments?.filter((p: any) => p.status === 'created' || p.status === 'pending').length || 0,
    totalRevenue: payments?.filter((p: any) => p.status === 'captured').reduce((sum: number, p: any) => sum + p.amount, 0) || 0
  }

  return { payments: payments || [], stats }
}

export default async function MobileAdminPaymentsPage() {
  const { payments, stats } = await getAdminPaymentData()

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 lg:p-6 max-w-7xl mx-auto">
        {/* Page Header */}
        <div className="mb-6 lg:mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Payment Management</h1>
              <p className="text-gray-600 mt-1 lg:mt-2">Monitor and manage all platform payments</p>
            </div>
            <div className="flex items-center gap-2 lg:gap-4">
              <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 lg:hidden">
                <Filter className="h-5 w-5" />
              </button>
              <button className="flex items-center gap-2 px-3 py-2 lg:px-4 bg-[#0b6d41] text-white rounded-xl hover:bg-[#0a5d37] transition-colors text-sm lg:text-base">
                <Download className="h-4 w-4" />
                <span className="hidden lg:inline">Export Data</span>
              </button>
            </div>
          </div>
        </div>
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6 mb-6 lg:mb-8">
          <div className="bg-white rounded-2xl p-4 lg:p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs lg:text-sm font-medium text-gray-600">Total Payments</p>
                <p className="text-xl lg:text-3xl font-bold text-gray-900 mt-1 lg:mt-2">{stats.total}</p>
              </div>
              <div className="bg-blue-600/10 p-2 lg:p-2.5 rounded-xl">
                <CreditCard className="h-5 w-5 lg:h-6 lg:w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 lg:p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs lg:text-sm font-medium text-gray-600">Completed</p>
                <p className="text-xl lg:text-3xl font-bold text-gray-900 mt-1 lg:mt-2">{stats.completed}</p>
              </div>
              <div className="bg-green-600/10 p-2 lg:p-2.5 rounded-xl">
                <CheckCircle className="h-5 w-5 lg:h-6 lg:w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 lg:p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs lg:text-sm font-medium text-gray-600">Failed</p>
                <p className="text-xl lg:text-3xl font-bold text-gray-900 mt-1 lg:mt-2">{stats.failed}</p>
              </div>
              <div className="bg-red-600/10 p-2 lg:p-2.5 rounded-xl">
                <AlertCircle className="h-5 w-5 lg:h-6 lg:w-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 lg:p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs lg:text-sm font-medium text-gray-600">Revenue</p>
                <p className="text-lg lg:text-2xl font-bold text-gray-900 mt-1 lg:mt-2">₹{formatPrice(stats.totalRevenue / 100)}</p>
              </div>
              <div className="bg-purple-600/10 p-2 lg:p-2.5 rounded-xl">
                <TrendingUp className="h-5 w-5 lg:h-6 lg:w-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Client Component */}
        <AdminPaymentsClient payments={payments} />
      </div>
    </div>
  )
}
