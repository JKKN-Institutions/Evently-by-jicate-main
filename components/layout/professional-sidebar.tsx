'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  Home, 
  Calendar, 
  Ticket, 
  CreditCard, 
  User as UserIcon,
  Menu,
  X,
  Plus,
  BarChart3,
  Users,
  Settings,
  ChevronRight,
  LogOut,
  CheckCircle,
  Printer,
  Bell,
  HelpCircle,
  Shield,
  UserCheck,
  Zap,
  ChevronLeft,
  LayoutDashboard,
  Star,
  TrendingUp,
  FolderOpen,
  Activity,
  Layers
} from 'lucide-react'
import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { getNavigationForRole, getNavigationForRoleAsync, hasRole } from '@/lib/auth-helpers'
import { isAdminEmail } from '@/lib/config/admin-emails'
import { createClient } from '@/lib/supabase/client'
import Footer from './footer'

// Icon mapping for navigation items
const iconMap = {
  Home: LayoutDashboard,
  Calendar,
  Ticket,
  CreditCard,
  Users,
  BarChart3,
  CheckCircle,
  Printer,
  FolderOpen,
  Layers,
  Shield,
  UserCheck
}

interface ModernSidebarProps {
  children: React.ReactNode
}

interface QuickStats {
  totalEvents: number
  thisMonthGrowth: string
  activeUsers: number
  totalTickets?: number
  loading: boolean
}

export default function ProfessionalSidebar({ children }: ModernSidebarProps) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [hasNotifications] = useState(true)
  const [loadingTimeout, setLoadingTimeout] = useState(false)
  const [initialLoadComplete, setInitialLoadComplete] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [navigation, setNavigation] = useState<any[]>([])
  const [quickStats, setQuickStats] = useState<QuickStats>({
    totalEvents: 0,
    thisMonthGrowth: '0%',
    activeUsers: 0,
    totalTickets: 0,
    loading: true
  })
  
  const { user, profile, loading, error, signOut } = useAuth()
  const supabase = createClient()

  // Derive an effective role quickly to avoid flashing user menu for admins
  // If we have a user but no profile yet, check if they're admin by email
  // Enhanced admin detection for production reliability
  const effectiveRole = (() => {
    // First priority: database profile role
    if (profile?.role) return profile.role
    
    // Second priority: admin email check
    if (user?.email && isAdminEmail(user.email)) {
      console.log('🔧 ADMIN: Detected admin by email:', user.email)
      return 'admin'
    }
    
    // Third priority: fallback for specific admin emails (production safety)
    if (user?.email === 'sroja@jkkn.ac.in' || user?.email === 'director@jkkn.ac.in') {
      console.log('🔧 ADMIN: Force-detected admin by hardcoded email:', user.email)
      return 'admin'
    }
    
    // Default: no role determined yet
    return null
  })()
  
  // Enhanced debug logging for production admin detection
  if (user?.email === 'sroja@jkkn.ac.in' || user?.email === 'director@jkkn.ac.in') {
    console.log('🔧 PRODUCTION ADMIN DEBUG:', {
      userEmail: user.email,
      profileRole: profile?.role,
      effectiveRole,
      isAdminEmail: isAdminEmail(user.email),
      profileExists: !!profile,
      environment: process.env.NODE_ENV,
      adminEmails: ['director@jkkn.ac.in', 'sroja@jkkn.ac.in'],
      userAuthenticated: !!user,
      loadingState: loading,
      supabaseConnected: !!supabase
    })
  }
  
  // Only create effectiveProfile if we have determined a role
  const effectiveProfile = profile || (effectiveRole && user ? { 
    id: user.id, 
    email: user.email || '', 
    full_name: user.email?.split('@')[0] || 'User', 
    role: effectiveRole as any, 
    avatar_url: null 
  } : null)
  
  // Debug logging only in dev
  if (process.env.NODE_ENV === 'development') {
    console.log('ProfessionalSidebar - Profile:', profile)
    console.log('ProfessionalSidebar - User email:', user?.email)
    console.log('ProfessionalSidebar - Is admin email?:', user?.email ? isAdminEmail(user.email) : 'no email')
    console.log('ProfessionalSidebar - Profile Role:', profile?.role, 'Effective Role:', effectiveRole)
  }
  
  // Load navigation based on user role
  useEffect(() => {
    const loadNavigation = async () => {
      // Use effectiveProfile OR create fallback profile with effectiveRole
      const profileForNav = effectiveProfile || (effectiveRole && user ? {
        id: user.id,
        email: user.email || '',
        full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        role: effectiveRole as any,
        avatar_url: user.user_metadata?.avatar_url || null
      } : null)

      if (profileForNav) {
        console.log('🔧 Using profile for navigation:', {
          email: profileForNav.email,
          role: profileForNav.role,
          source: effectiveProfile ? 'database' : 'fallback'
        })
        
        // Get initial navigation synchronously for immediate render
        const initialNav = getNavigationForRole(profileForNav)
        console.log('🔧 Navigation groups loaded:', Object.keys(initialNav))
        setNavigation(initialNav)
        
        // Then check for controller assignments for regular users
        if (profileForNav.role === 'user') {
          const asyncNav = await getNavigationForRoleAsync(profileForNav)
          setNavigation(asyncNav)
        }
      } else {
        setNavigation({})
      }
    }
    
    loadNavigation()
  }, [effectiveProfile?.id, effectiveProfile?.role, effectiveRole, user?.id])

  // Fetch real-time stats with enhanced error handling for production
  const fetchQuickStats = async (retryCount = 0) => {
    // Use fallback profile if effectiveProfile is null but we have user + effectiveRole
    const profileForStats = effectiveProfile || (effectiveRole && user ? {
      id: user.id,
      email: user.email || '',
      full_name: user.user_metadata?.full_name || 'User',
      role: effectiveRole as any,
      avatar_url: user.user_metadata?.avatar_url || null
    } : null)

    if (!profileForStats || !user) {
      console.log('🔧 STATS: No profile or user for stats')
      return
    }

    console.log('🔧 STATS: Fetching stats with profile:', {
      role: profileForStats.role,
      email: profileForStats.email,
      retry: retryCount
    })

    try {
      setQuickStats(prev => ({ ...prev, loading: true }))

      // Test connection first with a simple query
      const { data: connectionTest, error: connectionError } = await supabase
        .from('events')
        .select('id')
        .limit(1)

      if (connectionError) {
        throw new Error(`Connection test failed: ${connectionError.message}`)
      }

      console.log('🔧 STATS: Supabase connection successful')

      // Use Promise.allSettled for parallel queries with individual error handling
      const queries = [
        // Total events count
        supabase.from('events').select('*', { count: 'exact', head: true }),
        
        // This month's events  
        (() => {
          const startOfThisMonth = new Date()
          startOfThisMonth.setDate(1)
          startOfThisMonth.setHours(0, 0, 0, 0)
          return supabase
            .from('events')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', startOfThisMonth.toISOString())
        })(),
        
        // Last month's events
        (() => {
          const now = new Date()
          const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
          const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
          return supabase
            .from('events')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', startOfLastMonth.toISOString())
            .lte('created_at', endOfLastMonth.toISOString())
        })(),
        
        // Active users (last 30 days)
        (() => {
          const thirtyDaysAgo = new Date()
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
          return supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', thirtyDaysAgo.toISOString())
        })()
      ]

      // Add tickets query for admin users
      if (hasRole(profileForStats, 'admin') || profileForStats.role === 'admin') {
        queries.push(
          supabase.from('tickets').select('*', { count: 'exact', head: true })
        )
      }

      const results = await Promise.allSettled(queries)
      
      // Process results with fallbacks
      const totalEvents = results[0].status === 'fulfilled' ? (results[0].value.count || 0) : 0
      const thisMonthEvents = results[1].status === 'fulfilled' ? (results[1].value.count || 0) : 0  
      const lastMonthEvents = results[2].status === 'fulfilled' ? (results[2].value.count || 0) : 0
      const activeUsers = results[3].status === 'fulfilled' ? (results[3].value.count || 0) : 0
      const totalTickets = (results[4]?.status === 'fulfilled' ? (results[4].value.count || 0) : 0)

      // Calculate growth percentage
      let growthPercentage = '0%'
      if (lastMonthEvents > 0) {
        const growth = ((thisMonthEvents - lastMonthEvents) / lastMonthEvents) * 100
        growthPercentage = growth >= 0 ? `+${growth.toFixed(1)}%` : `${growth.toFixed(1)}%`
      } else if (thisMonthEvents > 0) {
        growthPercentage = '+100%'
      }

      console.log('🔧 STATS: Successfully fetched stats:', {
        totalEvents,
        thisMonthEvents,
        lastMonthEvents,
        activeUsers,
        totalTickets,
        growthPercentage
      })

      setQuickStats({
        totalEvents,
        thisMonthGrowth: growthPercentage,
        activeUsers,
        totalTickets,
        loading: false
      })

    } catch (error) {
      console.error('🔧 STATS: Error fetching quick stats:', error)
      
      // Retry logic for production reliability
      if (retryCount < 2) {
        console.log(`🔧 STATS: Retrying stats fetch (attempt ${retryCount + 1})`)
        setTimeout(() => fetchQuickStats(retryCount + 1), 2000 * (retryCount + 1))
        return
      }
      
      // Final fallback - set reasonable defaults
      setQuickStats({
        totalEvents: 0,
        thisMonthGrowth: '0%',
        activeUsers: 0,
        totalTickets: 0,
        loading: false
      })
    }
  }

  // Fetch stats when profile is ready - TEMPORARILY DISABLED  
  useEffect(() => {
    // if ((effectiveProfile || effectiveRole) && user && mounted) {
    //   fetchQuickStats()
    //   
    //   // Refresh stats every 5 minutes
    //   const interval = setInterval(fetchQuickStats, 5 * 60 * 1000)
    //   return () => clearInterval(interval)
    // }
    console.log('🔧 STATS: Quick Stats fetching temporarily disabled')
  }, [effectiveProfile?.id, effectiveRole, user?.id, mounted])
  
  if (process.env.NODE_ENV === 'development' && Object.keys(navigation).length > 0) {
    console.log('ProfessionalSidebar - Navigation groups:', Object.keys(navigation))
  }
  
  // Check if on auth page
  const isOnAuthPage = pathname === '/login' || pathname.startsWith('/auth/')
  
  // If on auth page, render without auth check
  if (isOnAuthPage) {
    return <>{children}</>
  }
  
  // Set mounted state to true after hydration
  useEffect(() => {
    setMounted(true)
    
    // Clear any old redirect timestamps in development for immediate testing
    if (process.env.NODE_ENV === 'development') {
      const lastRedirect = localStorage.getItem('lastAuthRedirect')
      if (lastRedirect) {
        const timeSince = Date.now() - parseInt(lastRedirect)
        if (timeSince < 30000) { // If less than 30 seconds old, clear it
          console.log('🧹 Clearing recent redirect timestamp for immediate testing')
          localStorage.removeItem('lastAuthRedirect')
        }
      }
    }
  }, [])
  
  // Set timeout for loading state and track initial load - INCREASED FOR PRODUCTION
  useEffect(() => {
    if (loading) {
      const timeout = setTimeout(() => {
        console.warn('🔧 AUTH TIMEOUT: Loading timeout in ProfessionalSidebar - proceeding with fallback auth')
        setLoadingTimeout(true)
      }, 15000) // Increased to 15 seconds for production
      
      return () => clearTimeout(timeout)
    } else if (!initialLoadComplete) {
      // Once loading is done, mark initial load as complete
      setInitialLoadComplete(true)
    }
  }, [loading, initialLoadComplete])
  
  // Show loading state only on initial mount to avoid hydration mismatch
  // Always render the full UI structure for consistent hydration
  // More forgiving auth check for production - show sidebar if we have user OR effectiveRole
  const shouldShowLoading = !mounted || (loading && !user && !effectiveRole && !loadingTimeout)
  
  if (shouldShowLoading) {
    // Return the full layout structure but with loading state content
    // This ensures the DOM structure matches between server and client
    return (
      <div className="flex h-screen bg-gray-50">
        <div className="flex-1 overflow-auto bg-gray-50">
          <div className="h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white">
            <div className="text-center">
              <div className="relative">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#0b6d41] border-t-transparent mx-auto"></div>
                <div className="absolute inset-0 animate-ping rounded-full h-12 w-12 border-2 border-[#0b6d41] opacity-20 mx-auto"></div>
              </div>
              <p className="text-gray-600 text-sm mt-4 font-medium">Loading...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  // Enhanced logging for debugging
  console.log('🔍 ProfessionalSidebar auth check:', {
    user: user ? `${user.email} (${user.id})` : 'null',
    profile: profile ? `${profile.email} (${profile.role})` : 'null',
    effectiveRole,
    loading,
    loadingTimeout,
    mounted,
    error,
    pathname: typeof window !== 'undefined' ? window.location.pathname : 'server'
  })

  // IMPROVED: Smart redirect for unauthenticated users
  const isProduction = process.env.NODE_ENV === 'production'
  
  // Immediate redirect if:
  // - Not loading AND no user AND no effectiveRole AND mounted
  // - For production: wait a bit longer to ensure auth completes
  // - For development: redirect immediately after auth check completes
  const shouldRedirect = mounted && !loading && !user && !effectiveRole && 
    (isProduction ? loadingTimeout : true)
  
  if (shouldRedirect) {
    console.log('❌ No user or effective role found after timeout, checking if redirect needed...')
    
    // Check if we're in a redirect loop by looking for recent redirects
    const now = Date.now()
    const lastRedirect = typeof window !== 'undefined' ? 
      parseInt(localStorage.getItem('lastAuthRedirect') || '0') : 0
    const timeSinceLastRedirect = now - lastRedirect
    
    // Only redirect if we're not already on auth page AND not in a redirect loop
    const redirectCooldown = isProduction ? 5000 : 1000 // Reduced: 5s for prod, 1s for dev
    
    if (typeof window !== 'undefined' && 
        !window.location.pathname.startsWith('/auth/') &&
        timeSinceLastRedirect > redirectCooldown) {
      
      console.log('🔄 No authentication detected - redirecting to sign-in...')
      localStorage.setItem('lastAuthRedirect', now.toString())
      window.location.replace('/auth/sign-in')
    } else if (timeSinceLastRedirect <= redirectCooldown) {
      console.log(`⚠️ Redirect cooldown active (${Math.ceil((redirectCooldown - timeSinceLastRedirect) / 1000)}s remaining)`)
    }
    
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0b6d41] mx-auto mb-2"></div>
          <p className="text-gray-600 text-sm">
            {timeSinceLastRedirect <= 3000 ? 'Checking authentication...' : 'Redirecting to sign in...'}
          </p>
        </div>
      </div>
    )
  }
  
  // If we have a user, show success message
  if (user) {
    console.log('✅ User authenticated, showing main app:', {
      email: user.email,
      role: profile?.role,
      navigationItems: navigation.length
    })
  }
  
  // Show error state
  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white">
        <div className="text-center bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <X className="h-8 w-8 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Connection Error</h3>
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-6 py-2.5 bg-[#0b6d41] text-white rounded-xl hover:bg-[#0a5d37] transition-colors font-medium shadow-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile Header - Clean White */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50 shadow-sm">
        <div className="flex items-center justify-between h-full px-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors group"
          >
            <Menu className="h-6 w-6 text-gray-700 group-hover:text-gray-900" />
          </button>
          
          <Link href="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-[#0b6d41] to-[#15a862] rounded-xl flex items-center justify-center shadow-md">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-[#0b6d41] to-[#15a862] bg-clip-text text-transparent">
              Evently
            </span>
          </Link>
          
          <div className="flex items-center gap-2">
            <button className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors">
              <Bell className="h-5 w-5 text-gray-700" />
              {hasNotifications && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              )}
            </button>
            {user && (
              <div className="w-10 h-10 bg-gradient-to-br from-[#0b6d41] to-[#15a862] rounded-xl flex items-center justify-center shadow-sm">
                <UserIcon className="h-5 w-5 text-white" />
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Desktop Sidebar - Clean White Design */}
      <div className={`hidden lg:flex flex-col ${desktopSidebarOpen ? 'w-72' : 'w-20'} transition-all duration-300 bg-white border-r border-gray-200 shadow-sm`}>
        
        {/* Logo Section - Clean and Minimal */}
        <div className="h-20 px-6 flex items-center justify-between border-b border-gray-100">
          {desktopSidebarOpen ? (
            <>
              <Link href="/" className="flex items-center gap-3 group">
                <div className="w-11 h-11 bg-gradient-to-br from-[#0b6d41] to-[#15a862] rounded-xl flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
                  <Activity className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Evently</h1>
                  <p className="text-xs text-gray-500 font-medium">Event Platform</p>
                </div>
              </Link>
              <button
                onClick={() => setDesktopSidebarOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors group"
              >
                <ChevronLeft className="h-4 w-4 text-gray-400 group-hover:text-gray-700" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setDesktopSidebarOpen(true)}
              className="w-11 h-11 bg-gradient-to-br from-[#0b6d41] to-[#15a862] rounded-xl flex items-center justify-center shadow-md hover:shadow-lg transition-all mx-auto"
            >
              <ChevronRight className="w-5 h-5 text-white" />
            </button>
          )}
        </div>

        {/* Navigation - Grouped and Clean */}
        <nav className="flex-1 px-4 py-6 overflow-y-auto">
          {Object.entries(navigation).map(([groupName, items], groupIndex) => (
            <div key={groupName} className={groupIndex > 0 ? "mb-8 pt-6 border-t border-gray-100" : "mb-8"}>
              {/* Group Header */}
              {desktopSidebarOpen && (
                <div className="px-4 mb-3">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 px-2 py-1 rounded">
                    {groupName}
                  </h3>
                </div>
              )}
              
              {/* Group Items */}
              <ul className="space-y-1.5">
                {items.map((item: any, index: number) => {
                  const isActive = pathname === item.href || 
                    (item.href !== '/' && pathname.startsWith(item.href))
                  
                  const IconComponent = iconMap[item.icon as keyof typeof iconMap] || Home
                  
                  return (
                    <li key={`${groupName}-${item.name}-${index}`} className="relative">
                      <Link
                        href={item.href}
                        className={`relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                          isActive
                            ? 'bg-gradient-to-r from-[#0b6d41] to-[#15a862] text-white shadow-md'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                        }`}
                      >
                        <IconComponent className={`h-5 w-5 flex-shrink-0 ${!isActive && 'group-hover:scale-110'} transition-transform`} />
                        {desktopSidebarOpen && (
                          <>
                            <span className="font-medium text-sm">{item.name}</span>
                            {item.badge && (
                              <span className="ml-auto px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                                {item.badge}
                              </span>
                            )}
                          </>
                        )}
                        {!desktopSidebarOpen && (
                          <div className="absolute left-full ml-3 px-3 py-1.5 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10 transition-opacity shadow-lg">
                            {item.name}
                          </div>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}

          {/* Quick Stats - Real-time Data - TEMPORARILY DISABLED */}
          {false && desktopSidebarOpen && (
            <div className="mt-8 p-5 bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700">Quick Stats</h3>
                {quickStats.loading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-[#0b6d41]"></div>
                ) : (
                  <TrendingUp className={`h-4 w-4 ${
                    quickStats.thisMonthGrowth.startsWith('+') ? 'text-green-500' : 
                    quickStats.thisMonthGrowth.startsWith('-') ? 'text-red-500' : 'text-gray-400'
                  }`} />
                )}
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Total Events</span>
                  {quickStats.loading ? (
                    <div className="w-8 h-4 bg-gray-200 rounded animate-pulse"></div>
                  ) : (
                    <span className="text-sm font-bold text-gray-900">
                      {quickStats.totalEvents.toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">This Month</span>
                  {quickStats.loading ? (
                    <div className="w-10 h-4 bg-gray-200 rounded animate-pulse"></div>
                  ) : (
                    <span className={`text-sm font-bold ${
                      quickStats.thisMonthGrowth.startsWith('+') ? 'text-green-600' : 
                      quickStats.thisMonthGrowth.startsWith('-') ? 'text-red-600' : 'text-gray-500'
                    }`}>
                      {quickStats.thisMonthGrowth}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Active Users</span>
                  {quickStats.loading ? (
                    <div className="w-12 h-4 bg-gray-200 rounded animate-pulse"></div>
                  ) : (
                    <span className="text-sm font-bold text-gray-900">
                      {quickStats.activeUsers.toLocaleString()}
                    </span>
                  )}
                </div>
                {(hasRole(effectiveProfile, 'admin') || effectiveRole === 'admin') && (
                  <div className="flex items-center justify-between border-t border-gray-100 pt-3 mt-3">
                    <span className="text-sm text-gray-500">Total Tickets</span>
                    {quickStats.loading ? (
                      <div className="w-12 h-4 bg-gray-200 rounded animate-pulse"></div>
                    ) : (
                      <span className="text-sm font-bold text-blue-600">
                        {quickStats.totalTickets?.toLocaleString() || '0'}
                      </span>
                    )}
                  </div>
                )}
              </div>
              {/* Last Updated */}
              {!quickStats.loading && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Auto-refresh: 5min</span>
                    <button
                      onClick={fetchQuickStats}
                      className="text-xs text-[#0b6d41] hover:text-[#0a5d37] font-medium"
                    >
                      Refresh
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Action Buttons - Clean Design */}
        <div className="p-4 border-t border-gray-100">
          {desktopSidebarOpen ? (
            <>
              {hasRole(profile, 'organizer') ? (
                <Link
                  href="/events/create"
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-[#0b6d41] to-[#15a862] text-white rounded-xl hover:shadow-lg transition-all font-medium"
                >
                  <Plus className="h-5 w-5" />
                  <span>Create Event</span>
                </Link>
              ) : (
                <Link
                  href="/profile/upgrade-to-organizer"
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:shadow-lg transition-all font-medium"
                >
                  <Shield className="h-5 w-5" />
                  <span>Become Organizer</span>
                </Link>
              )}
            </>
          ) : (
            <Link
              href="/events/create"
              className="w-11 h-11 flex items-center justify-center bg-gradient-to-br from-[#0b6d41] to-[#15a862] text-white rounded-xl hover:shadow-lg transition-all mx-auto"
            >
              <Plus className="h-5 w-5" />
            </Link>
          )}
        </div>

        {/* Profile Section - Clean and Modern */}
        {user && (
          <div className="p-4 border-t border-gray-100">
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className={`w-full flex items-center ${desktopSidebarOpen ? 'gap-3' : 'justify-center'} p-3 rounded-xl hover:bg-gray-50 transition-all`}
              >
                <div className="relative">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#0b6d41] to-[#15a862] rounded-xl flex items-center justify-center">
                    <UserIcon className="h-5 w-5 text-white" />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                </div>
                {desktopSidebarOpen && (
                  <>
                    <div className="flex-1 text-left">
                      <div className="text-sm font-semibold text-gray-900">
                        {profile?.full_name || user.email?.split('@')[0] || 'User'}
                      </div>
                      <div className="text-xs text-gray-500 capitalize flex items-center gap-1">
                        <Star className="h-3 w-3 text-yellow-500" />
                        {effectiveRole || profile?.role || 'user'}
                      </div>
                    </div>
                    <ChevronRight className={`h-4 w-4 text-gray-400 transition-transform ${showProfileMenu ? 'rotate-90' : ''}`} />
                  </>
                )}
              </button>

              {/* Profile Dropdown - Clean Design */}
              {showProfileMenu && (
                <div className={`absolute bottom-full ${desktopSidebarOpen ? 'left-0 right-0' : 'left-full ml-3'} mb-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden`}>
                  <Link
                    href="/profile"
                    onClick={() => setShowProfileMenu(false)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group"
                  >
                    <Settings className="h-4 w-4 text-gray-400 group-hover:text-gray-700" />
                    <span className="text-sm text-gray-700 font-medium">Profile Settings</span>
                  </Link>
                  <Link
                    href="/help"
                    onClick={() => setShowProfileMenu(false)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group"
                  >
                    <HelpCircle className="h-4 w-4 text-gray-400 group-hover:text-gray-700" />
                    <span className="text-sm text-gray-700 font-medium">Help & Support</span>
                  </Link>
                  <button
                    onClick={() => {
                      signOut()
                      setShowProfileMenu(false)
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 transition-colors text-left group border-t border-gray-100"
                  >
                    <LogOut className="h-4 w-4 text-red-500 group-hover:text-red-600" />
                    <span className="text-sm text-red-500 group-hover:text-red-600 font-medium">Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto bg-gray-50">
        {/* Desktop Content */}
        <div className="hidden lg:block min-h-full">
          <div className="flex flex-col min-h-screen">
            <div className="flex-1">
              {children}
            </div>
            <Footer />
          </div>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar - Clean White */}
      <div className={`lg:hidden fixed left-0 top-0 h-full w-72 bg-white shadow-2xl transform transition-transform duration-300 z-50 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        
        {/* Mobile Sidebar Content */}
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="h-20 px-6 flex items-center justify-between border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-gradient-to-br from-[#0b6d41] to-[#15a862] rounded-xl flex items-center justify-center shadow-md">
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Evently</h1>
                <p className="text-xs text-gray-500 font-medium">Event Platform</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X className="h-5 w-5 text-gray-400" />
            </button>
          </div>

          {/* Navigation - Grouped */}
          <nav className="flex-1 px-4 py-6 overflow-y-auto">
            {Object.entries(navigation).map(([groupName, items]) => (
              <div key={groupName} className="mb-6">
                {/* Group Header */}
                <div className="px-4 mb-3">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {groupName}
                  </h3>
                </div>
                
                {/* Group Items */}
                <ul className="space-y-1.5">
                  {items.map((item: any) => {
                    const isActive = pathname === item.href || 
                      (item.href !== '/' && pathname.startsWith(item.href))
                    
                    const IconComponent = iconMap[item.icon as keyof typeof iconMap] || Home
                    
                    return (
                      <li key={`mobile-${groupName}-${item.name}`}>
                        <Link
                          href={item.href}
                          onClick={() => setSidebarOpen(false)}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                            isActive
                              ? 'bg-gradient-to-r from-[#0b6d41] to-[#15a862] text-white shadow-md'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                          }`}
                        >
                          <IconComponent className="h-5 w-5" />
                          <span className="font-medium text-sm">{item.name}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </nav>

          {/* Mobile Actions */}
          <div className="p-4 border-t border-gray-100 space-y-3">
            {hasRole(effectiveProfile, 'organizer') ? (
              <Link
                href="/events/create"
                onClick={() => setSidebarOpen(false)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-[#0b6d41] to-[#15a862] text-white rounded-xl hover:shadow-lg transition-all font-medium"
              >
                <Plus className="h-5 w-5" />
                <span>Create Event</span>
              </Link>
            ) : (
              <Link
                href="/profile/upgrade-to-organizer"
                onClick={() => setSidebarOpen(false)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:shadow-lg transition-all font-medium"
              >
                <Shield className="h-5 w-5" />
                <span>Become Organizer</span>
              </Link>
            )}

            {/* Mobile Profile */}
            {user && (
              <div className="pt-3 border-t border-gray-100">
                <div className="flex items-center gap-3 px-3">
                  <div className="relative">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#0b6d41] to-[#15a862] rounded-xl flex items-center justify-center">
                      <UserIcon className="h-5 w-5 text-white" />
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-gray-900">
                      {profile?.full_name || user.email?.split('@')[0] || 'User'}
                    </div>
                    <div className="text-xs text-gray-500 capitalize flex items-center gap-1">
                      <Star className="h-3 w-3 text-yellow-500" />
                      {profile?.role || 'user'}
                    </div>
                  </div>
                </div>
                <div className="mt-3 space-y-1">
                  <Link
                    href="/profile"
                    onClick={() => setSidebarOpen(false)}
                    className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                  >
                    <Settings className="h-4 w-4 text-gray-400" />
                    <span>Settings</span>
                  </Link>
                  <button
                    onClick={() => {
                      signOut()
                      setSidebarOpen(false)
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors text-left"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Content */}
      <div className="lg:hidden pt-16">
        <div className="flex flex-col min-h-screen">
          <div className="flex-1">
            {children}
          </div>
          <Footer />
        </div>
      </div>
    </div>
  )
}