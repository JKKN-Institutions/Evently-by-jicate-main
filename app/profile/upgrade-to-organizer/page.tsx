import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import OrganizerUpgradeForm from '@/components/organizer/upgrade-form'

async function checkUserStatus() {
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    redirect('/events')
  }

  // Check current role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'organizer' || profile?.role === 'admin') {
    redirect('/organizer/dashboard')
  }

  return { user, profile }
}

export default async function UpgradeToOrganizerPage() {
  const { user, profile } = await checkUserStatus()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Become an Event Organizer
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Join thousands of organizers who trust Evently to manage their events. 
            Complete your organizer profile to start creating amazing events.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Benefits Section */}
          <div className="space-y-8">
            <div className="bg-white rounded-2xl p-8 shadow-lg">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Organizer Benefits</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-gradient-to-r from-[#ffde59] to-[#f5c842] rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-[#0b6d41] font-bold text-sm">✓</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Create Unlimited Events</h3>
                    <p className="text-gray-600 text-sm">Host as many events as you want with no restrictions</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-gradient-to-r from-[#ffde59] to-[#f5c842] rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-[#0b6d41] font-bold text-sm">✓</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Advanced Analytics</h3>
                    <p className="text-gray-600 text-sm">Track bookings, revenue, and attendee insights</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-gradient-to-r from-[#ffde59] to-[#f5c842] rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-[#0b6d41] font-bold text-sm">✓</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">QR Code Check-ins</h3>
                    <p className="text-gray-600 text-sm">Seamless attendee check-in with QR code scanning</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-gradient-to-r from-[#ffde59] to-[#f5c842] rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-[#0b6d41] font-bold text-sm">✓</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Payment Management</h3>
                    <p className="text-gray-600 text-sm">Secure payment processing and revenue tracking</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Form Section */}
          <div className="bg-white rounded-2xl p-8 shadow-lg">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Complete Your Profile</h2>
            <OrganizerUpgradeForm user={user} currentProfile={profile} />
          </div>
        </div>
      </div>
    </div>
  )
}
