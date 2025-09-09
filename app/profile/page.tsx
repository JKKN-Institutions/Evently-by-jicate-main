import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { User, Mail, Calendar, Ticket, CreditCard } from 'lucide-react'
import Link from 'next/link'

async function getUserProfile() {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    redirect('/')
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Get user stats
  const { count: eventsCount } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('organizer_id', user.id)

  const { count: bookingsCount } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const { count: ticketsCount } = await supabase
    .from('tickets')
    .select('*', { count: 'exact', head: true })
    .eq('bookings.user_id', user.id)
    .eq('status', 'valid')

  return {
    user,
    profile,
    stats: {
      events: eventsCount || 0,
      bookings: bookingsCount || 0,
      tickets: ticketsCount || 0
    }
  }
}

export default async function ProfilePage() {
  const { user, profile, stats } = await getUserProfile()

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">My Profile</h1>

      {/* Profile Info */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center">
            {profile?.avatar_url ? (
              <img 
                src={profile.avatar_url} 
                alt={profile.full_name || 'Profile'} 
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <User className="h-10 w-10 text-gray-500" />
            )}
          </div>
          <div>
            <h2 className="text-2xl font-semibold">{profile?.full_name || user.email?.split('@')[0]}</h2>
            <p className="text-gray-600 flex items-center gap-2 mt-1">
              <Mail className="h-4 w-4" />
              {user.email}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Member since {new Date(user.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Link 
          href="/events?organizer=me"
          className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Events Organized</p>
              <p className="text-3xl font-bold text-gray-900">{stats.events}</p>
            </div>
            <Calendar className="h-8 w-8 text-[#0b6d41]" />
          </div>
        </Link>

        <Link 
          href="/bookings"
          className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Bookings Made</p>
              <p className="text-3xl font-bold text-gray-900">{stats.bookings}</p>
            </div>
            <CreditCard className="h-8 w-8 text-[#0b6d41]" />
          </div>
        </Link>

        <Link 
          href="/tickets"
          className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Tickets</p>
              <p className="text-3xl font-bold text-gray-900">{stats.tickets}</p>
            </div>
            <Ticket className="h-8 w-8 text-[#ffde59]" />
          </div>
        </Link>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/events/create"
            className="flex items-center justify-center gap-2 px-4 py-3 bg-[#0b6d41] text-white rounded-lg hover:bg-[#0a5d37] transition-colors"
          >
            Create New Event
          </Link>
          <Link
            href="/events"
            className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Browse Events
          </Link>
          <Link
            href="/bookings"
            className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            View My Bookings
          </Link>
          <Link
            href="/tickets"
            className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            View My Tickets
          </Link>
        </div>
      </div>
    </div>
  )
}
