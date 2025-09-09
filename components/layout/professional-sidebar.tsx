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
import { getNavigationForRole, hasRole } from '@/lib/auth-helpers'
import { isAdminEmail } from '@/lib/config/admin-emails'
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

export default function ProfessionalSidebar({ children }: ModernSidebarProps) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [hasNotifications] = useState(true)
  const [loadingTimeout, setLoadingTimeout] = useState(false)
  
  const { user, profile, loading, error, signOut } = useAuth()

  // Derive an effective role quickly to avoid flashing user menu for admins
  const effectiveRole = profile?.role || (user?.email && isAdminEmail(user.email) ? 'admin' : 'user')
  const effectiveProfile = profile || (user ? { id: user.id, email: user.email || '', full_name: user.email?.split('@')[0] || 'User', role: effectiveRole as any, avatar_url: null } : null)
  
  // Debug logging only in dev
  if (process.env.NODE_ENV === 'development') {
    console.log('ProfessionalSidebar - Profile:', profile)
    console.log('ProfessionalSidebar - Profile Role:', profile?.role, 'Effective Role:', effectiveRole)
  }
  
  // Get navigation based on user role
  const navigation = getNavigationForRole(effectiveProfile)
  if (process.env.NODE_ENV === 'development') {
    console.log('ProfessionalSidebar - Navigation items:', navigation.map(n => n.name))
  }
  
  // Check if on auth page
  const isOnAuthPage = pathname === '/login' || pathname.startsWith('/auth/')
  
  // If on auth page, render without auth check
  if (isOnAuthPage) {
    return <>{children}</>
  }
  
  // Set timeout for loading state
  useEffect(() => {
    if (loading) {
      const timeout = setTimeout(() => {
        console.warn('Loading timeout in ProfessionalSidebar - proceeding without auth')
        setLoadingTimeout(true)
      }, 3000) // 3 second timeout
      
      return () => clearTimeout(timeout)
    }
  }, [loading])
  
  // Show loading state briefly while auth initializes, but not if timeout exceeded
  if (loading && !loadingTimeout) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#0b6d41] border-t-transparent mx-auto"></div>
            <div className="absolute inset-0 animate-ping rounded-full h-12 w-12 border-2 border-[#0b6d41] opacity-20 mx-auto"></div>
          </div>
          <p className="text-gray-600 text-sm mt-4 font-medium">Loading...</p>
        </div>
      </div>
    )
  }
  
  // Enhanced logging for debugging
  console.log('🔍 ProfessionalSidebar auth check:', {
    user: user ? `${user.email} (${user.id})` : 'null',
    profile: profile ? `${profile.email} (${profile.role})` : 'null',
    loading,
    error,
    pathname: typeof window !== 'undefined' ? window.location.pathname : 'server'
  })

  // If not authenticated after loading completes, redirect to sign-in
  if (!user && !loading) {
    console.log('❌ No user found, checking if redirect needed...')
    // Only redirect if we're not already on the auth page
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth/')) {
      console.log('🔄 Redirecting to sign-in page...')
      window.location.replace('/auth/sign-in')
    }
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0b6d41] mx-auto mb-2"></div>
          <p className="text-gray-600 text-sm">Redirecting to sign in...</p>
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

        {/* Navigation - Clean and Crispy */}
        <nav className="flex-1 px-4 py-6 overflow-y-auto">
          <ul className="space-y-1.5">
            {navigation.map((item, index) => {
              const isActive = pathname === item.href || 
                (item.href !== '/' && pathname.startsWith(item.href))
              
              const IconComponent = iconMap[item.icon as keyof typeof iconMap] || Home
              
              return (
                <li key={`${item.name}-${index}`} className="relative">
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

          {/* Quick Stats - Clean Card Design */}
          {desktopSidebarOpen && (
            <div className="mt-8 p-5 bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700">Quick Stats</h3>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Total Events</span>
                  <span className="text-sm font-bold text-gray-900">24</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">This Month</span>
                  <span className="text-sm font-bold text-green-600">+12%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Active Users</span>
                  <span className="text-sm font-bold text-gray-900">1,234</span>
                </div>
              </div>
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
                        {profile?.role || 'user'}
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

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 overflow-y-auto">
            <ul className="space-y-1.5">
              {navigation.map((item) => {
                const isActive = pathname === item.href || 
                  (item.href !== '/' && pathname.startsWith(item.href))
                
                const IconComponent = iconMap[item.icon as keyof typeof iconMap] || Home
                
                return (
                  <li key={item.name}>
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