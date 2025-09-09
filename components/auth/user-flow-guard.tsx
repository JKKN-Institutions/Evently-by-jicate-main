'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { LogIn, UserPlus, Building2, Shield } from 'lucide-react'

interface UserFlowGuardProps {
  children: React.ReactNode
  requiredRole?: 'user' | 'organizer' | 'admin'
  allowGuest?: boolean
  redirectTo?: string
}

export default function UserFlowGuard({ 
  children, 
  requiredRole, 
  allowGuest = false,
  redirectTo = '/events'
}: UserFlowGuardProps) {
  const [user, setUser] = useState<User | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkUserAndRole = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)

        if (user) {
          // Get user profile and role
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()
          
          setUserRole(profile?.role || 'user')
        }
      } catch (error) {
        console.error('Error checking user role:', error)
      } finally {
        setLoading(false)
      }
    }

    checkUserAndRole()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
        checkUserAndRole()
      } else {
        setUser(null)
        setUserRole(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0b6d41]"></div>
      </div>
    )
  }

  // Guest user trying to access protected content
  if (!user && !allowGuest) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <div className="max-w-md mx-auto text-center p-8 bg-white rounded-2xl shadow-xl">
          <LogIn className="h-16 w-16 text-[#0b6d41] mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Sign In Required</h2>
          <p className="text-gray-600 mb-6">
            You need to sign in to access this feature. Join Evently to book events and manage your tickets!
          </p>
          <button
            onClick={() => router.push('/events')}
            className="w-full bg-gradient-to-r from-[#0b6d41] to-[#0f7a4a] text-white py-3 px-6 rounded-xl font-semibold hover:shadow-lg transition-all duration-300"
          >
            Browse Events as Guest
          </button>
        </div>
      </div>
    )
  }

  // Role-based access control
  if (user && requiredRole && userRole !== requiredRole && userRole !== 'admin') {
    const getRoleUpgradeInfo = () => {
      switch (requiredRole) {
        case 'organizer':
          return {
            icon: Building2,
            title: 'Organizer Access Required',
            description: 'You need to complete your organizer profile to create and manage events.',
            actionText: 'Become an Organizer',
            actionPath: '/profile/upgrade-to-organizer'
          }
        case 'admin':
          return {
            icon: Shield,
            title: 'Admin Access Required',
            description: 'This area is restricted to administrators only.',
            actionText: 'Contact Admin',
            actionPath: '/contact'
          }
        default:
          return {
            icon: UserPlus,
            title: 'User Account Required',
            description: 'Please complete your user profile to continue.',
            actionText: 'Complete Profile',
            actionPath: '/profile'
          }
      }
    }

    const roleInfo = getRoleUpgradeInfo()
    const IconComponent = roleInfo.icon

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <div className="max-w-md mx-auto text-center p-8 bg-white rounded-2xl shadow-xl">
          <IconComponent className="h-16 w-16 text-[#ffde59] mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{roleInfo.title}</h2>
          <p className="text-gray-600 mb-6">{roleInfo.description}</p>
          <div className="space-y-3">
            <button
              onClick={() => router.push(roleInfo.actionPath)}
              className="w-full bg-gradient-to-r from-[#ffde59] to-[#f5c842] text-[#0b6d41] py-3 px-6 rounded-xl font-semibold hover:shadow-lg transition-all duration-300"
            >
              {roleInfo.actionText}
            </button>
            <button
              onClick={() => router.push(redirectTo)}
              className="w-full text-gray-600 py-2 px-4 rounded-xl hover:bg-gray-100 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  // User has access - render children
  return <>{children}</>
}
