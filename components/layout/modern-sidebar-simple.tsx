'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
  Printer
} from 'lucide-react'
import React, { useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { getNavigationForRole, hasRole } from '@/lib/auth-helpers'
import BottomNavigation from './bottom-navigation'
import FloatingActionButton from './floating-action-button'


// Icon mapping for navigation items
const iconMap = {
  Home,
  Calendar,
  Ticket,
  CreditCard,
  Users,
  BarChart3,
  CheckCircle,
  Printer
}

interface ModernSidebarProps {
  children: React.ReactNode
}

export default function ModernSidebarSimple({ children }: ModernSidebarProps) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  
  const { user, profile, loading, error, signOut } = useAuth()
  
  // Get navigation based on user role
  const navigation = getNavigationForRole(profile)
  
  // Check if on auth page
  const isOnAuthPage = pathname === '/login' || pathname.startsWith('/auth/') || pathname === '/auth/sign-in'
  
  // If on auth page, render without auth check
  if (isOnAuthPage) {
    return <>{children}</>
  }
  
  // Show loading state only on initial load
  if (loading && !user && !profile) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0b6d41] mx-auto mb-2"></div>
          <p className="text-gray-600 text-sm">Loading...</p>
        </div>
      </div>
    )
  }
  
  // If user is not authenticated and not loading, redirect to login
  if (!user && !loading) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0b6d41] mx-auto mb-2"></div>
          <p className="text-gray-600 text-sm">Redirecting to login...</p>
        </div>
      </div>
    )
  }
  
  // Show error state
  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-red-600 text-sm mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-[#0b6d41] text-white rounded-lg hover:bg-[#0a5d37] transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50">
        <div className="flex items-center justify-between h-full px-4">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Menu className="h-6 w-6 text-gray-600" />
          </button>
          
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#0b6d41] rounded-lg flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-semibold text-gray-900">Evently</span>
          </Link>
          
          {user && (
            <div className="w-8 h-8 bg-[#0b6d41] rounded-full flex items-center justify-center">
              <UserIcon className="h-4 w-4 text-white" />
            </div>
          )}
        </div>
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
              {navigation.map((item) => {
                const isActive = pathname === item.href || 
                  (item.href !== '/' && pathname.startsWith(item.href))
                
                const IconComponent = iconMap[item.icon as keyof typeof iconMap] || Home
                
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
                      <IconComponent className="h-5 w-5 flex-shrink-0" />
                      {desktopSidebarOpen && (
                        <span className="font-medium">{item.name}</span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* Create Event Button */}
          {desktopSidebarOpen && (
            <div className="p-4 border-t border-gray-100">
              {hasRole(profile, 'organizer') ? (
                <Link
                  href="/events/create"
                  className="w-full flex items-center justify-center gap-2 p-3 bg-[#0b6d41] text-white rounded-lg hover:bg-[#0a5d37] transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create Event</span>
                </Link>
              ) : (
                <Link
                  href="/profile/upgrade-to-organizer"
                  className="w-full flex items-center justify-center gap-2 p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <UserIcon className="h-4 w-4" />
                  <span>Become Organizer</span>
                </Link>
              )}
            </div>
          )}

          {/* Profile Menu */}
          {user && desktopSidebarOpen && (
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
                      {profile?.full_name || user.email?.split('@')[0] || 'User'}
                    </div>
                    <div className="text-xs text-gray-500 capitalize">
                      {profile?.role || 'user'}
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
                      onClick={() => {
                        signOut()
                        setShowProfileMenu(false)
                      }}
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
            {navigation.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== '/' && pathname.startsWith(item.href))
              
              const IconComponent = iconMap[item.icon as keyof typeof iconMap] || Home
              
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
                    <IconComponent className="h-5 w-5" />
                    <span className="font-medium">{item.name}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Mobile Action Buttons */}
        <div className="p-4 border-t border-gray-100 space-y-3">
          {hasRole(profile, 'organizer') ? (
            <Link
              href="/events/create"
              onClick={() => setSidebarOpen(false)}
              className="w-full flex items-center justify-center gap-2 p-3 bg-[#0b6d41] text-white rounded-lg hover:bg-[#0a5d37] transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Create Event</span>
            </Link>
          ) : (
            <Link
              href="/profile/upgrade-to-organizer"
              onClick={() => setSidebarOpen(false)}
              className="w-full flex items-center justify-center gap-2 p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <UserIcon className="h-4 w-4" />
              <span>Become Organizer</span>
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
                    {profile?.full_name || user.email?.split('@')[0] || 'User'}
                  </div>
                  <div className="text-xs text-gray-500 capitalize">
                    {profile?.role || 'user'}
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
                      signOut()
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
      </div>

      {/* Mobile Content */}
      <div className="lg:hidden pt-16 pb-20">
        {children}
      </div>
      
      {/* Mobile Bottom Navigation */}
      <BottomNavigation />
      
      {/* Floating Action Button */}
      <FloatingActionButton />
    </>
  )
}
