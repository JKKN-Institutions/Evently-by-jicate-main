'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { Calendar, Users, Settings, Plus, Eye, Edit, UserCheck, Shield, MapPin, Clock } from 'lucide-react'
import { EventPage, ChildEvent, PageControllerView, EventControllerView } from '@/types/event-pages'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function PageControllerDashboard() {
  const { user, profile, loading: authLoading } = useAuth()
  const router = useRouter()
  const [myPages, setMyPages] = useState<EventPage[]>([])
  const [pageStats, setPageStats] = useState<any[]>([])
  const [eventControllers, setEventControllers] = useState<EventControllerView[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    // Wait for auth to load
    if (authLoading) {
      console.log('Waiting for auth to load...')
      return
    }
    
    // Use user.id if profile is not yet loaded
    const userId = profile?.id || user?.id
    if (!userId) {
      console.log('No user ID available')
      setLoading(false)
      return
    }
    
    console.log('Fetching pages for user:', userId)
    fetchMyPages()
    fetchEventControllers()
  }, [profile, user, authLoading])

  const fetchMyPages = async () => {
    const userId = profile?.id || user?.id
    if (!userId) return

    try {
      console.log('Fetching page assignments for user:', userId)
      
      // Create abort controller for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout
      
      try {
        // Simplified query - just get the page IDs first
        const { data: controllerAssignments, error: controllerError } = await supabase
          .from('page_controllers')
          .select('event_page_id')
          .eq('controller_id', userId)
          .abortSignal(controller.signal)
        
        clearTimeout(timeoutId)
        
        let pageIds = []
        
        if (!controllerError && controllerAssignments && controllerAssignments.length > 0) {
          console.log('Found controller assignments:', controllerAssignments.length)
          pageIds = controllerAssignments.map(a => a.event_page_id)
        }
        
        // If no pages found in page_controllers, skip role_assignments for now to speed up
        if (pageIds.length === 0) {
          console.log('No page controller assignments found')
          setMyPages([])
          return
        }
        
        // Fetch the actual page details
        const { data: pages, error: pagesError } = await supabase
          .from('event_pages')
          .select('*')
          .in('id', pageIds)
        
        if (pagesError) {
          console.error('Error fetching event pages:', pagesError)
          setMyPages([])
          return
        }
        
        console.log('Found pages:', pages?.length || 0)
        setMyPages(pages || [])
        
        // Get stats for each page after fetching pages
        if (pages && pages.length > 0) {
          fetchPageStats(pages)
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.error('Query timeout - fetching pages took too long')
        } else {
          console.error('Error fetching pages:', error)
        }
        setMyPages([])
      }
    } catch (error) {
      console.error('Error fetching my pages:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPageStats = async (pages: EventPage[]) => {
    try {
      const stats = await Promise.all(
        pages.map(async (page) => {
          // Use a simpler count query for performance
          const { count, error } = await supabase
            .from('events')
            .select('*', { count: 'exact', head: true })
            .eq('event_page_id', page.id)
          
          if (error) {
            console.error('Error fetching event count for page:', page.id, error)
            return { pageId: page.id, totalEvents: 0, upcomingEvents: 0, totalCapacity: 0 }
          }
          
          // For now, just return the count without detailed stats for performance
          return {
            pageId: page.id,
            totalEvents: count || 0,
            upcomingEvents: 0, // Skip this for performance
            totalCapacity: 0 // Skip this for performance
          }
        })
      )
      
      setPageStats(stats)
    } catch (error) {
      console.error('Error fetching page stats:', error)
    }
  }

  const fetchEventControllers = async () => {
    const userId = profile?.id || user?.id
    if (!userId) return

    try {
      // Skip fetching event controllers initially for performance
      // Load them on demand if needed
      setEventControllers([])
      console.log('Skipping event controllers fetch for initial load performance')
    } catch (error) {
      console.error('Error in event controllers:', error)
    }
  }

  const getPageStats = (pageId: string) => {
    return pageStats.find(s => s.pageId === pageId) || { totalEvents: 0, upcomingEvents: 0, totalCapacity: 0 }
  }

  const getPageControllers = (pageId: string) => {
    return eventControllers.filter(ec => ec.event_page_id === pageId)
  }

  // Show loading state while auth or data is loading
  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0b6d41] mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  // Check if user is actually a page controller
  if (myPages.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <Shield className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-yellow-800 mb-2">No Page Assignments</h3>
          <p className="text-yellow-600">You are not assigned as a Page Controller for any event pages.</p>
          <p className="text-yellow-600 mt-2">Contact an administrator to get assigned to an event page.</p>
          
          {/* Debug info in development */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4 p-4 bg-gray-100 rounded text-left text-xs">
              <p className="font-mono">User ID: {user?.id || 'No user'}</p>
              <p className="font-mono">Profile ID: {profile?.id || 'No profile'}</p>
              <p className="font-mono">Email: {user?.email || profile?.email || 'No email'}</p>
              <button 
                onClick={async () => {
                  const res = await fetch('/api/debug/page-controllers')
                  const data = await res.json()
                  console.log('Debug data:', data)
                  alert('Check console for debug data')
                }}
                className="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-sm"
              >
                Debug Assignments
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Page Controller Dashboard</h1>
        <p className="mt-2 text-gray-600">Manage your assigned event pages and their child events</p>
      </div>

      {/* My Pages */}
      <div className="space-y-8">
        {myPages.map((page) => {
          const stats = getPageStats(page.id)
          const controllers = getPageControllers(page.id)

          return (
            <div key={page.id} className="bg-white rounded-lg shadow-lg overflow-hidden">
              {/* Page Header */}
              <div className="bg-gradient-to-r from-[#0b6d41] to-[#15a862] px-6 py-4">
                <div className="flex justify-between items-start">
                  <div className="text-white">
                    <h2 className="text-2xl font-bold">{page.title}</h2>
                    <p className="text-green-100 mt-1">{page.description}</p>
                    <div className="flex items-center gap-4 mt-3 text-green-100">
                      {page.location && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          <span className="text-sm">{page.location}</span>
                        </div>
                      )}
                      {page.start_date && page.end_date && (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          <span className="text-sm">
                            {new Date(page.start_date).toLocaleDateString()} - {new Date(page.end_date).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/page-controller/${page.id}`}
                      className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                    >
                      <Settings className="h-4 w-4" />
                      Manage
                    </Link>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-8 w-8 text-blue-600" />
                      <div>
                        <p className="text-sm text-blue-600">Total Events</p>
                        <p className="text-2xl font-bold text-blue-900">{stats.totalEvents}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <Clock className="h-8 w-8 text-green-600" />
                      <div>
                        <p className="text-sm text-green-600">Upcoming Events</p>
                        <p className="text-2xl font-bold text-green-900">{stats.upcomingEvents}</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <Users className="h-8 w-8 text-purple-600" />
                      <div>
                        <p className="text-sm text-purple-600">Total Capacity</p>
                        <p className="text-2xl font-bold text-purple-900">{stats.totalCapacity.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Event Controllers */}
              <div className="px-6 py-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Event Controllers</h3>
                  <span className="text-gray-500 text-sm">{controllers.length} assigned</span>
                </div>
                
                {controllers.length === 0 ? (
                  <div className="text-center py-4 text-gray-500">
                    <UserCheck className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p>No event controllers assigned yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {controllers.map((controller) => (
                      <div key={controller.id} className="bg-gray-50 rounded-lg p-4 border">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-[#0b6d41] rounded-full flex items-center justify-center">
                            <UserCheck className="h-5 w-5 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900">{controller.controller_name}</p>
                            <p className="text-sm text-gray-600 truncate">{controller.controller_email}</p>
                            <p className="text-sm text-[#0b6d41] font-medium mt-1">{controller.event_title}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              Assigned {new Date(controller.assigned_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Actions */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                <div className="flex gap-2">
                  <Link
                    href={`/page-controller/${page.id}`}
                    className="flex items-center gap-2 bg-[#0b6d41] text-white px-4 py-2 rounded-lg hover:bg-[#0a5d37] transition-colors"
                  >
                    <Settings className="h-4 w-4" />
                    Manage Page & Events
                  </Link>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Quick Stats Summary */}
      <div className="mt-8 bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-[#0b6d41]">{myPages.length}</p>
            <p className="text-sm text-gray-600">Event Pages</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{pageStats.reduce((sum, s) => sum + s.totalEvents, 0)}</p>
            <p className="text-sm text-gray-600">Total Events</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{pageStats.reduce((sum, s) => sum + s.upcomingEvents, 0)}</p>
            <p className="text-sm text-gray-600">Upcoming Events</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-purple-600">{eventControllers.length}</p>
            <p className="text-sm text-gray-600">Event Controllers</p>
          </div>
        </div>
      </div>
    </div>
  )
}