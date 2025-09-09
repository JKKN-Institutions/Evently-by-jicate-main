'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
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
  Sparkles,
  Users,
  Settings,
  ChevronDown,
  Mail,
  LogOut,
  CheckCircle,

  Printer,
  Image as ImageIcon

} from 'lucide-react'
import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'


// Navigation items for different user types
const userNavigation = [
  { name: 'Home', href: '/', icon: Home },
  { name: 'Events', href: '/events', icon: Calendar },
  { name: 'My Bookings', href: '/bookings', icon: Ticket },
]

const organizerNavigation = [
  { name: 'My Events', href: '/organizer/my-events', icon: Calendar },
  { name: 'Payments', href: '/payments', icon: CreditCard },
  { name: 'Verify Tickets', href: '/verify', icon: CheckCircle },
  { name: 'Ticket Templates', href: '/organizer/ticket-templates', icon: ImageIcon },

]

const adminNavigation = [
  { name: 'User Management', href: '/admin/users', icon: Users },
  { name: 'Admin Payments', href: '/admin/payments', icon: CreditCard },

  { name: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
  { name: 'Verify Tickets', href: '/verify', icon: CheckCircle },
  { name: 'Enhanced Ticket Generator', href: '/admin/enhanced-ticket-generator', icon: Ticket },
  { name: 'Predefined Tickets', href: '/admin/predefined-tickets', icon: ImageIcon },

]

interface ModernSidebarProps {
  children: React.ReactNode
}

export default function ModernSidebar({ children }: ModernSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [userRole, setUserRole] = useState<string>('user')
  const [isLoading, setIsLoading] = useState(true)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const supabase = createClient()
  
  // Add supabase to window for debugging
  if (typeof window !== 'undefined') {
    (window as any).supabase = supabase
  }

  useEffect(() => {
    setMounted(true)
    let loadingTimeout: NodeJS.Timeout
    
    const checkUser = async () => {
      try {
        setIsLoading(true)
        console.log('🔍 Checking user authentication...')
        
        // Check if we're on the login page
        const isLoginPage = typeof window !== 'undefined' && window.location.pathname.includes('/login')
        
        if (isLoginPage) {
          console.log('📝 On login page, skipping auth check')
          setUser(null)
          setUserRole('user')
          setIsLoading(false)
          return
        }

        // Use getSession instead of getUser to avoid AuthSessionMissingError
        const { data: { session }, error: authError } = await supabase.auth.getSession()
        
        if (authError) {
          console.error('Auth error:', authError)
          // Clear any cached auth data on error
          localStorage.removeItem('supabase.auth.token')
          sessionStorage.clear()
          setUser(null)
          setUserRole('user')
          return
        }
        
        const user = session?.user || null
        console.log('👤 User:', user ? 'Authenticated' : 'Not authenticated')
        
        // If no user but we think we should have one, clear cache
        if (!user) {
          console.log('🧹 No user found, clearing any cached auth data')
          localStorage.removeItem('supabase.auth.token')
          const keysToRemove = []
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (key && key.includes('supabase')) {
              keysToRemove.push(key)
            }
          }
          keysToRemove.forEach(key => localStorage.removeItem(key))
        }
        
        setUser(user)
        
        if (user) {
          console.log('📋 Fetching user profile...')
          try {
            const { data: profile, error } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', user.id)
              .single()
            
            const role = (profile as any)?.role || 'user'
            console.log('🎭 User role from initial check:', role)
            console.log('🎭 User email:', user.email)
            setUserRole(role)
            
            // Force update for admin users
            if (role === 'admin') {
              console.log('🔄 Admin detected in initial check, forcing update')
              setTimeout(() => setUserRole('admin'), 100)
            }
          } catch (profileError) {
            console.warn('⚠️ Profile fetch error:', profileError)
            setUserRole('user')
          }
        } else {
          setUserRole('user') // Default to user instead of null
        }
      } catch (error) {
        console.error('❌ Error checking user:', error)
        // Check if it's an auth session error
        if (error && typeof error === 'object' && 'message' in error) {
          const errorMessage = (error as any).message
          if (errorMessage?.includes('Auth session missing') || errorMessage?.includes('session')) {
            console.log('🔄 Auth session missing, setting defaults')
            setUser(null)
            setUserRole('user')
            setIsLoading(false)
            return
          }
        }
        setUser(null)
        setUserRole('user')
      } finally {
        console.log('✅ Auth check completed')
        setIsLoading(false)
      }
    }

    // Add timeout to prevent infinite loading
    loadingTimeout = setTimeout(() => {
      console.warn('Auth check timeout - setting default state')
      setIsLoading(false)
      // Don't set user to null here, let the auth check complete
    }, 8000) // 8 seconds timeout for slower connections

    checkUser().finally(() => {
      if (loadingTimeout) clearTimeout(loadingTimeout)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 Auth state change:', event, session?.user ? 'User present' : 'No user')
      console.log('🔄 Session details:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        userEmail: session?.user?.email,
        userId: session?.user?.id
      })
      
      // Clear the loading timeout since auth state is changing
      if (loadingTimeout) {
        clearTimeout(loadingTimeout)
        console.log('🔄 Clearing loading timeout due to auth state change')
      }
      
      // Handle sign out events by clearing cache
      if (event === 'SIGNED_OUT' || !session?.user) {
        console.log('🧹 User signed out or no session, clearing cache')
        // Clear all Supabase-related localStorage items
        const keysToRemove = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && key.includes('supabase')) {
            keysToRemove.push(key)
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key))
        sessionStorage.clear()
        setUser(null)
        setUserRole('user')
        setIsLoading(false)
        return
      }
      
      setUser(session?.user ?? null)
      setIsLoading(false) // Always stop loading when auth state changes
      
      if (session?.user) {
        try {
          console.log('👤 Processing authenticated user...')
          
          // Small delay for OAuth redirects to ensure profile is created
          if (event === 'SIGNED_IN') {
            console.log('🔐 New sign-in detected, waiting for profile creation...')
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
          
          // Use the session from the callback instead of fetching again
          console.log('✅ Using session from auth state change callback')
          const currentSession = session
          
          if (!currentSession?.user) {
            console.warn('⚠️ No user in auth state change session')
            setUserRole('user')
            return
          }
          
          console.log('🔍 Session user details:', {
            id: currentSession.user.id,
            email: currentSession.user.email,
            hasMetadata: !!currentSession.user.user_metadata
          })
          
          console.log('✅ Session validated, fetching profile...')
          console.log('🔍 Looking for user ID:', currentSession.user.id)
          console.log('🔍 User email:', currentSession.user.email)
          
          // Try to fetch profile by ID
          console.log('🔄 Fetching profile by ID...')
          let profile = null
          
          try {
            const { data, error } = await supabase
              .from('profiles')
              .select('role, email, id')
              .eq('id', currentSession.user.id)
              .maybeSingle()
            
            profile = data
            console.log('📋 Profile fetch result:', { profile, error })
          } catch (fetchError) {
            console.warn('⚠️ Profile fetch error:', fetchError)
          }
          
          // If profile not found by ID, try by email
          if (!profile) {
            console.log('🔄 Trying to fetch by email:', currentSession.user.email)
            try {
              const { data } = await supabase
                .from('profiles')
                .select('role, email, id')
                .eq('email', currentSession.user.email as string)
                .maybeSingle()
              
              if (data) {
                console.log('✅ Found profile by email')
                profile = data
              }
            } catch (emailFetchError) {
              console.warn('⚠️ Email fetch error:', emailFetchError)
            }
          }
          
          // If still no profile found, try to create one
          if (!profile) {
            console.log('📝 No profile found, attempting to create...')
            
            // For the specific admin user, create with admin role
            const isAdminUser = currentSession.user.email === 'sroja@jkkn.ac.in'
            const defaultRole = isAdminUser ? 'admin' : 'user'
            
            console.log('🎭 Creating profile with role:', defaultRole, 'for user:', currentSession.user.email)
            
            try {
              const { data: newProfile, error: insertError } = await supabase
                .from('profiles')
                .insert({
                  id: currentSession.user.id,
                  email: currentSession.user.email,
                  full_name: currentSession.user.user_metadata?.full_name || currentSession.user.user_metadata?.name || '',
                  role: defaultRole
                } as any)
                .select('role, email, id')
                .single()
              
              if (insertError) {
                console.error('❌ Error creating profile:', insertError)
              } else {
                console.log('✅ Profile created:', newProfile)
                profile = newProfile
                profileError = null
              }
            } catch (createError) {
              console.error('❌ Profile creation failed:', createError)
            }
          }
          
          // Set the user role from the profile
          let role = (profile as any)?.role || 'user'
          
          // IMMEDIATE ADMIN ROLE OVERRIDE for specific admin user
          if (currentSession.user.email === 'sroja@jkkn.ac.in') {
            console.log('🔧 FORCING ADMIN ROLE for admin user:', currentSession.user.email)
            console.log('🔧 Previous role was:', role)
            role = 'admin'
            console.log('🔧 New role is:', role)
          }
          
          console.log('🎭 Final user role determined:', role)
          console.log('📋 Final profile data:', profile)
          console.log('👤 User email:', currentSession.user.email)
          
          // Force update the role
          setUserRole(role)
          
          // If this is an admin user, force multiple updates to ensure it sticks
          if (role === 'admin') {
            console.log('🔄 Admin user detected, forcing navigation update...')
            // Force immediate update
            setUserRole('admin')
            // Also set after delays to ensure state is updated
            setTimeout(() => {
              setUserRole('admin')
              console.log('🔄 Admin role re-applied after 100ms delay')
            }, 100)
            setTimeout(() => {
              setUserRole('admin')
              console.log('🔄 Admin role re-applied after 500ms delay')
            }, 500)
          }
          
        } catch (error) {
          console.error('❌ Error fetching user role:', error)
          // Check if it's an auth session error
          if (error && typeof error === 'object' && 'message' in error) {
            const errorMessage = (error as any).message
            if (errorMessage?.includes('Auth session missing') || errorMessage?.includes('session')) {
              console.log('🔄 Auth session missing, will retry on next auth state change')
              setUserRole('user')
              return
            }
          }
          setUserRole('user')
        }
      } else {
        console.log('👤 No user, setting default role')
        setUserRole('user')
      }
    })

    return () => {
      subscription.unsubscribe()
      if (loadingTimeout) clearTimeout(loadingTimeout)
    }
  }, [supabase])

  // NUCLEAR OPTION: Force admin role for specific user immediately
  React.useEffect(() => {
    if (user && user.email === 'sroja@jkkn.ac.in' && userRole !== 'admin') {
      console.log('🚨 NUCLEAR OPTION: Forcing admin role for', user.email)
      setUserRole('admin')
    }
  }, [user?.email]) // Remove userRole from dependencies to prevent infinite loop

  // Handle redirect to login when not authenticated
  React.useEffect(() => {
    if (!user && mounted && !isLoading) {
      // Check if we're not already on a login/auth page to prevent infinite loops
      const isOnAuthPage = pathname === '/login' || pathname.startsWith('/auth/') || pathname === '/auth/sign-in'
      if (!isOnAuthPage) {
        console.log('🔐 Redirecting to login page - no authenticated user found')
        router.push('/login')
      }
    }
  }, [user, mounted, isLoading, router, pathname])

  // Use useMemo to recompute navigation when userRole changes
  const navigation = React.useMemo(() => {
    console.log('🧭 Computing navigation for role:', userRole, 'Loading:', isLoading, 'Mounted:', mounted, 'User:', !!user)
    console.log('🧭 User details:', user ? { id: user.id, email: user.email } : 'No user')
    
    // IMMEDIATE ADMIN OVERRIDE - bypass all logic
    if (user && user.email === 'sroja@jkkn.ac.in') {
      console.log('🚨 IMMEDIATE ADMIN OVERRIDE for', user.email)
      const adminNav = [
        ...userNavigation,
        ...organizerNavigation,
        ...adminNavigation
      ]
      console.log('🚨 FORCING ADMIN NAVIGATION:', adminNav.map(item => item.name))
      return adminNav
    }
    
    // If still loading, show basic navigation
    if (isLoading && !user) {
      console.log('🧭 Still loading - showing basic navigation')
      return userNavigation // Show basic nav while loading
    }
    
    // If not mounted yet, return empty
    if (!mounted) {
      console.log('🧭 Not mounted yet')
      return []
    }
    
    // If no user, show public navigation
    if (!user) {
      console.log('🧭 No user - showing public navigation')
      return userNavigation
    }
    
    let nav = [...userNavigation]
    console.log('🧭 Base user navigation:', nav.length, 'items')
    
    if (userRole === 'organizer' || userRole === 'admin') {
      nav = [...nav, ...organizerNavigation]
      console.log('🧭 Added organizer navigation, total:', nav.length, 'items')
    }
    
    if (userRole === 'admin') {
      nav = [...nav, ...adminNavigation]
      console.log('🧭 Added admin navigation, total:', nav.length, 'items')
    }
    
         console.log('🧭 Final navigation for role', userRole, ':', nav.map(item => item.name))
     return nav
   }, [userRole, isLoading, mounted, user?.email]) // More specific dependencies


  // Sign Out function
  const handleSignOut = async () => {
    try {
      console.log('🚪 Signing out user...')
      
      // Sign out from Supabase first
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('❌ Error signing out:', error)
      } else {
        console.log('✅ Successfully signed out')
      }
      
      // Clear all storage
      localStorage.clear()
      sessionStorage.clear()
      
      // Reset all state
      setUser(null)
      setUserRole('user')
      setShowProfileMenu(false)
      setIsLoading(false)
      
      // Redirect to login page
      router.push('/login')
    } catch (error) {
      console.error('❌ Sign out error:', error)
      // Force reload as fallback
      window.location.href = '/login'
    }
  }

  // If user is not authenticated and component is mounted, handle appropriately
  // The actual redirect is handled in the useEffect hook above
  if (!user && mounted && !isLoading) {
    // If we're on an auth page, render the children (login form)
    const isOnAuthPage = pathname === '/login' || pathname.startsWith('/auth/') || pathname === '/auth/sign-in'
    if (isOnAuthPage) {
      return <>{children}</>
    }
    
    // Otherwise show loading while redirecting
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0b6d41] mx-auto mb-2"></div>
          <p className="text-gray-600 text-sm">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  // Show loading if still processing auth
  if (isLoading && mounted) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0b6d41] mx-auto mb-2"></div>
          <p className="text-gray-600 text-sm">Authenticating...</p>
        </div>
      </div>
    )
  }

  // Show loading state only for initial mount
  if (!mounted) {
    return null // Return null to avoid hydration mismatch
  }

  return (
    <>
      {/* Mobile menu button - Hidden since mobile uses bottom navigation */}
      <div className="hidden lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg bg-white shadow-lg border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          {sidebarOpen ? (
            <X className="h-5 w-5 text-gray-600" />
          ) : (
            <Menu className="h-5 w-5 text-gray-600" />
          )}
        </button>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex h-screen relative">
        <div className={`${desktopSidebarOpen ? 'w-64' : 'w-16'} transition-all duration-300 bg-white border-r border-gray-200 flex flex-col`}>
          
          {/* Logo Section */}
          <div className="p-4 border-b border-gray-100">
            {desktopSidebarOpen ? (
              <div className="flex items-center justify-between">
                <Link href="/" className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#0b6d41] rounded-lg flex items-center justify-center">
                    <Sparkles className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h1 className="text-lg font-semibold text-gray-900">Evently</h1>
                    <p className="text-xs text-gray-500">Event Platform</p>
                  </div>
                </Link>
                <button
                  onClick={() => setDesktopSidebarOpen(false)}
                  className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
                >
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setDesktopSidebarOpen(true)}
                className="w-8 h-8 bg-[#0b6d41] rounded-lg flex items-center justify-center hover:bg-[#0a5d37] transition-colors"
              >
                <Menu className="w-4 w-4 text-white" />
              </button>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4">
            <ul className="space-y-1">
              {isLoading ? (
                // Loading skeleton
                [...Array(3)].map((_, index) => (
                  <li key={index}>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-100 animate-pulse">
                      <div className="w-5 h-5 bg-gray-300 rounded"></div>
                      {desktopSidebarOpen && <div className="h-4 bg-gray-300 rounded flex-1"></div>}
                    </div>
                  </li>
                ))
              ) : (
                navigation.map((item) => {
                  const isActive = pathname === item.href || 
                    (item.href !== '/' && pathname.startsWith(item.href))
                  
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                          isActive
                            ? 'bg-[#0b6d41] text-white'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <item.icon className="h-5 w-5 flex-shrink-0" />
                        {desktopSidebarOpen && (
                          <span className="font-medium">{item.name}</span>
                        )}
                      </Link>
                    </li>
                  )
                })
              )}
            </ul>
          </nav>

          {/* Create Event Button */}
          {!isLoading && desktopSidebarOpen && (
            <div className="p-4 border-t border-gray-100">
              {(userRole === 'organizer' || userRole === 'admin') ? (
                <Link
                  href="/events/create"
                  className="w-full flex items-center justify-center gap-2 p-3 bg-[#0b6d41] text-white rounded-lg hover:bg-[#0a5d37] transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create Event</span>
                </Link>
              ) : user && userRole === 'user' ? (
                <Link
                  href="/profile/upgrade-to-organizer"
                  className="w-full flex items-center justify-center gap-2 p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <UserIcon className="h-4 w-4" />
                  <span>Become Organizer</span>
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="w-full flex items-center justify-center gap-2 p-3 bg-[#0b6d41] text-white rounded-lg hover:bg-[#0a5d37] transition-colors"
                >
                  <Mail className="h-4 w-4" />
                  <span>Sign In</span>
                </Link>
              )}
            </div>
          )}

          {/* Profile Menu */}
          {!isLoading && user && desktopSidebarOpen && (
            <div className="p-4 border-t border-gray-100">
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="w-8 h-8 bg-[#0b6d41] rounded-full flex items-center justify-center">
                    <UserIcon className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium text-gray-900">
                      {user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'}
                    </div>
                    <div className="text-xs text-gray-500 capitalize">
                      {userRole || 'user'}
                    </div>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showProfileMenu ? 'rotate-180' : ''}`} />
                </button>

                {/* Profile Dropdown */}
                {showProfileMenu && (
                  <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
                    <Link
                      href="/profile"
                      onClick={() => setShowProfileMenu(false)}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors"
                    >
                      <Settings className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-700">Profile Settings</span>
                    </Link>
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
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div className={`lg:hidden fixed left-0 top-0 h-full w-64 bg-white shadow-xl transform transition-transform duration-300 z-50 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        
        {/* Mobile Header */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#0b6d41] rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Evently</h1>
              <p className="text-xs text-gray-500">Event Platform</p>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        <nav className="p-4 flex-1">
          <ul className="space-y-1">
            {isLoading ? (
              // Loading skeleton
              [...Array(3)].map((_, index) => (
                <li key={index}>
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-100 animate-pulse">
                    <div className="w-5 h-5 bg-gray-300 rounded"></div>
                    <div className="h-4 bg-gray-300 rounded flex-1"></div>
                  </div>
                </li>
              ))
            ) : (
              navigation.map((item) => {
                const isActive = pathname === item.href || 
                  (item.href !== '/' && pathname.startsWith(item.href))
                
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-[#0b6d41] text-white'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <item.icon className="h-5 w-5" />
                      <span className="font-medium">{item.name}</span>
                    </Link>
                  </li>
                )
              })
            )}
          </ul>
        </nav>

        {/* Mobile Action Buttons */}
        {!isLoading && (
          <div className="p-4 border-t border-gray-100 space-y-3">
            {(userRole === 'organizer' || userRole === 'admin') ? (
              <Link
                href="/events/create"
                onClick={() => setSidebarOpen(false)}
                className="w-full flex items-center justify-center gap-2 p-3 bg-[#0b6d41] text-white rounded-lg hover:bg-[#0a5d37] transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Create Event</span>
              </Link>
            ) : user && userRole === 'user' ? (
              <Link
                href="/profile/upgrade-to-organizer"
                onClick={() => setSidebarOpen(false)}
                className="w-full flex items-center justify-center gap-2 p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <UserIcon className="h-4 w-4" />
                <span>Become Organizer</span>
              </Link>
            ) : (
              <Link
                href="/login"
                onClick={() => setSidebarOpen(false)}
                className="w-full flex items-center justify-center gap-2 p-3 bg-[#0b6d41] text-white rounded-lg hover:bg-[#0a5d37] transition-colors"
              >
                <Mail className="h-4 w-4" />
                <span>Sign In</span>
              </Link>
            )}

            {/* Mobile Profile Menu */}
            {user && (
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="w-8 h-8 bg-[#0b6d41] rounded-full flex items-center justify-center">
                    <UserIcon className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-sm font-medium text-gray-900">
                      {user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'}
                    </div>
                    <div className="text-xs text-gray-500 capitalize">
                      {userRole || 'user'}
                    </div>
                  </div>
                  <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${showProfileMenu ? 'rotate-180' : ''}`} />
                </button>

                {/* Mobile Profile Dropdown */}
                {showProfileMenu && (
                  <div className="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
                    <Link
                      href="/profile"
                      onClick={() => {
                        setShowProfileMenu(false)
                        setSidebarOpen(false)
                      }}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors"
                    >
                      <Settings className="h-4 w-4 text-gray-500" />
                      <span className="text-sm text-gray-700">Profile Settings</span>
                    </Link>
                    <button
                      onClick={() => {
                        handleSignOut()
                        setSidebarOpen(false)
                      }}
                      className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left"
                    >
                      <LogOut className="h-4 w-4 text-red-500" />
                      <span className="text-sm text-red-600">Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile Content */}
      <div className="lg:hidden pt-16">
        {children}
      </div>
    </>
  )
}
