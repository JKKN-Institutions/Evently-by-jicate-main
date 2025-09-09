'use client'

import React, { useEffect, useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { 
  LayoutDashboard, 
  Calendar, 
  Ticket, 
  User, 
  Settings, 
  Shield, 
  PlusCircle, 
  LogOut,
  TrendingUp,
  Menu,
  X,
  ChevronDown
} from 'lucide-react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { User as SupabaseUser } from '@supabase/supabase-js'

interface NavigationItem {
  name: string
  href: string
  icon: React.ElementType
  badge: string | null
}

interface Stats {
  totalEvents: number
  upcomingEvents: number
  totalBookings: number
  totalRevenue: number
}

export default function ModernSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [userRole, setUserRole] = useState<'user' | 'organizer' | 'admin'>('user')
  const [isLoading, setIsLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [stats, setStats] = useState<Stats>({
    totalEvents: 0,
    upcomingEvents: 0,
    totalBookings: 0,
    totalRevenue: 0
  })
  
  const supabase = createClient()

  // Initialize auth state
  useEffect(() => {
    let mounted = true

    const initAuth = async () => {
      try {
        // Get session without timeout
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!mounted) return
        
        if (session?.user) {
          setUser(session.user)
          
          // Try to get profile, but don't wait forever
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', session.user.id)
              .maybeSingle()
            
            if (profile?.role) {
              setUserRole(profile.role as 'user' | 'organizer' | 'admin')
            }
          } catch (error) {
            console.error('Profile fetch error:', error)
          }
        } else {
          setUser(null)
          setUserRole('user')
        }
      } catch (error) {
        console.error('Auth init error:', error)
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    initAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setUserRole('user')
        setIsLoading(false)
        router.push('/login')
      } else if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user)
        // Fetch profile for new sign in
        supabase
          .from('profiles')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle()
          .then(({ data }) => {
            if (data?.role) {
              setUserRole(data.role as 'user' | 'organizer' | 'admin')
            }
          })
        setIsLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [router, supabase])

  // Build navigation based on role
  const navigation = useMemo(() => {
    if (!user) return []

    const items: NavigationItem[] = [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard, badge: null },
      { name: 'Events', href: '/events', icon: Calendar, badge: null },
      { name: 'My Tickets', href: '/my-tickets', icon: Ticket, badge: null }
    ]

    if (userRole === 'organizer' || userRole === 'admin') {
      items.push(
        { name: 'Create Event', href: '/events/create', icon: PlusCircle, badge: null },
        { name: 'My Events', href: '/my-events', icon: Calendar, badge: null }
      )
    }

    if (userRole === 'admin') {
      items.push({ name: 'Admin Panel', href: '/admin', icon: Shield, badge: null })
    }

    items.push(
      { name: 'Profile', href: '/profile', icon: User, badge: null },
      { name: 'Settings', href: '/settings', icon: Settings, badge: null }
    )

    return items
  }, [user, userRole])

  // Fetch stats
  useEffect(() => {
    if (!user) return

    const fetchStats = async () => {
      try {
        const now = new Date().toISOString()
        
        const [eventsResult, upcomingResult, bookingsResult] = await Promise.all([
          supabase.from('events').select('*', { count: 'exact', head: true }),
          supabase.from('events').select('*', { count: 'exact', head: true })
            .gte('start_date', now).eq('status', 'published'),
          supabase.from('bookings').select('total_amount').eq('user_id', user.id)
        ])

        const totalRevenue = bookingsResult.data?.reduce((sum, b) => sum + (b.total_amount || 0), 0) || 0

        setStats({
          totalEvents: eventsResult.count || 0,
          upcomingEvents: upcomingResult.count || 0,
          totalBookings: bookingsResult.data?.length || 0,
          totalRevenue
        })
      } catch (error) {
        console.error('Error fetching stats:', error)
      }
    }

    fetchStats()
  }, [user, supabase])

  // Sign out handler
  const handleSignOut = useCallback(async () => {
    try {
      setIsLoading(true)
      await supabase.auth.signOut()
      // The onAuthStateChange listener will handle the rest
    } catch (error) {
      console.error('Sign out error:', error)
      setIsLoading(false)
    }
  }, [supabase])

  // Show loading state
  if (isLoading) {
    return (
      <div className="h-screen w-64 bg-white border-r flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  // Show sign-in prompt if not authenticated
  if (!user) {
    return (
      <div className="h-screen w-64 bg-white border-r flex flex-col items-center justify-center p-6">
        <p className="text-gray-600 mb-4">Please sign in to continue</p>
        <Link
          href="/login"
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Sign In
        </Link>
      </div>
    )
  }

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md"
      >
        {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {/* Backdrop */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white border-r transition-transform lg:transform-none",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-full flex flex-col">
          {/* Logo */}
          <div className="p-6 border-b">
            <Link href="/" className="flex items-center gap-2">
              <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">E</span>
              </div>
              <span className="font-bold text-xl">Evently</span>
            </Link>
          </div>

          {/* Stats */}
          <div className="p-4 border-b bg-gray-50">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500">Total Events</p>
                <p className="text-lg font-semibold">{stats.totalEvents}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Upcoming</p>
                <p className="text-lg font-semibold">{stats.upcomingEvents}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Bookings</p>
                <p className="text-lg font-semibold">{stats.totalBookings}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Revenue</p>
                <p className="text-lg font-semibold">₹{stats.totalRevenue}</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                    isActive
                      ? "bg-indigo-50 text-indigo-600"
                      : "text-gray-700 hover:bg-gray-50"
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{item.name}</span>
                  {item.badge && (
                    <span className="ml-auto bg-indigo-100 text-indigo-600 text-xs px-2 py-1 rounded-full">
                      {item.badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>

          {/* User profile */}
          <div className="border-t p-4">
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="w-full flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <div className="h-8 w-8 bg-indigo-100 rounded-full flex items-center justify-center">
                  <User className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-gray-900">
                    {user.email?.split('@')[0]}
                  </p>
                  <p className="text-xs text-gray-500 capitalize">{userRole}</p>
                </div>
                <ChevronDown className={cn(
                  "h-4 w-4 transition-transform",
                  showProfileMenu && "rotate-180"
                )} />
              </button>

              {showProfileMenu && (
                <div className="absolute bottom-full left-0 right-0 mb-2 bg-white border rounded-lg shadow-lg">
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <LogOut className="h-4 w-4 text-red-500" />
                    <span className="text-sm text-red-600">Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}