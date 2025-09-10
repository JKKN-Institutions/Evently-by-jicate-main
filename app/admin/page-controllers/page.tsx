'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { Shield, User, Calendar, MapPin, Edit, Trash2, Plus, Search, Layers, UserCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Controller {
  id: string
  user_id: string
  role_type: 'page_controller' | 'event_controller'
  event_page_id?: string
  event_id?: string
  assigned_at: string
  assigned_by: string
  profiles: {
    id: string
    email: string
    full_name: string
  }
  event_pages?: {
    id: string
    title: string
    location: string
    start_date: string
    end_date: string
    status: string
  }
  events?: {
    id: string
    title: string
    location: string
    date: string
    status: string
  }
  assigned_by_profile: {
    full_name: string
    email: string
  }
}

export default function PageControllersManagement() {
  const { profile } = useAuth()
  const router = useRouter()
  const [controllers, setControllers] = useState<Controller[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'page' | 'event'>('all')
  const supabase = createClient()

  useEffect(() => {
    if (!profile) return
    
    // Check if user is admin
    if (profile.role !== 'admin') {
      router.push('/')
      return
    }
    
    fetchControllers()
  }, [profile])

  const fetchControllers = async () => {
    try {
      setLoading(true)
      
      // Fetch both page and event controllers from role_assignments table
      console.log('Fetching controllers from role_assignments...')
      const { data: controllersData, error: controllersError } = await supabase
        .from('role_assignments')
        .select('*')
        .in('role_type', ['page_controller', 'event_controller'])
        .eq('is_active', true)
        .order('assigned_at', { ascending: false })

      if (controllersError) {
        console.error('Error fetching controllers - Full error:', controllersError)
        console.error('Error message:', controllersError.message)
        console.error('Error code:', controllersError.code)
        setControllers([])
        setLoading(false)
        return
      }

      if (!controllersData || controllersData.length === 0) {
        console.log('No controllers found')
        setControllers([])
        setLoading(false)
        return
      }

      // Get unique IDs
      const userIds = [...new Set(controllersData.map(c => c.user_id).filter(Boolean))]
      const pageIds = [...new Set(controllersData.filter(c => c.role_type === 'page_controller').map(c => c.event_page_id).filter(Boolean))]
      const eventIds = [...new Set(controllersData.filter(c => c.role_type === 'event_controller').map(c => c.event_id).filter(Boolean))]
      const assignerIds = [...new Set(controllersData.map(c => c.assigned_by).filter(Boolean))]

      // Fetch profiles for controllers (only if there are user IDs)
      let profiles = []
      if (userIds.length > 0) {
        const { data } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', userIds)
        profiles = data || []
      }

      // Fetch event pages (only if there are page IDs)
      let eventPages = []
      if (pageIds.length > 0) {
        const { data } = await supabase
          .from('event_pages')
          .select('id, title, location, start_date, end_date, status')
          .in('id', pageIds)
        eventPages = data || []
      }

      // Fetch events (only if there are event IDs)
      let events = []
      if (eventIds.length > 0) {
        const { data } = await supabase
          .from('events')
          .select('id, title, location, start_date, status')
          .in('id', eventIds)
        // Map start_date to date for consistency
        events = (data || []).map(event => ({
          ...event,
          date: event.start_date
        }))
      }

      // Fetch profiles for assigners (only if there are assigner IDs)
      let assignerProfiles = []
      if (assignerIds.length > 0) {
        const { data } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', assignerIds)
        assignerProfiles = data || []
      }

      // Map the data together
      const enrichedControllers = controllersData.map(controller => {
        const profile = profiles.find((p: any) => p.id === controller.user_id)
        const assignerProfile = assignerProfiles.find((p: any) => p.id === controller.assigned_by)
        
        let enriched: any = {
          ...controller,
          profiles: profile || null,
          assigned_by_profile: assignerProfile || null
        }

        if (controller.role_type === 'page_controller') {
          const eventPage = eventPages.find((ep: any) => ep.id === controller.event_page_id)
          enriched.event_pages = eventPage || null
        } else if (controller.role_type === 'event_controller') {
          const event = events.find((e: any) => e.id === controller.event_id)
          enriched.events = event || null
        }

        return enriched
      })

      setControllers(enrichedControllers)
    } catch (error) {
      console.error('Error in fetchPageControllers:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      setControllers([])
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveController = async (controllerId: string, pageId: string, pageTitle: string) => {
    if (!confirm(`Remove this user as controller for "${pageTitle}"?`)) return

    try {
      // Deactivate the role assignment instead of deleting
      const { error } = await supabase
        .from('role_assignments')
        .update({ is_active: false })
        .eq('id', controllerId)

      if (error) throw error
      fetchControllers()
    } catch (error) {
      console.error('Error removing controller:', error)
      alert('Failed to remove controller')
    }
  }

  const filteredControllers = controllers.filter(c => {
    const searchLower = searchTerm.toLowerCase()
    const matchesSearch = (
      c.profiles?.full_name?.toLowerCase().includes(searchLower) ||
      c.profiles?.email?.toLowerCase().includes(searchLower) ||
      c.event_pages?.title?.toLowerCase().includes(searchLower) ||
      c.event_pages?.location?.toLowerCase().includes(searchLower) ||
      c.events?.title?.toLowerCase().includes(searchLower) ||
      c.events?.location?.toLowerCase().includes(searchLower)
    )
    
    const matchesTab = 
      activeTab === 'all' ||
      (activeTab === 'page' && c.role_type === 'page_controller') ||
      (activeTab === 'event' && c.role_type === 'event_controller')
    
    return matchesSearch && matchesTab
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0b6d41]"></div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Controller Management</h1>
            <p className="mt-2 text-gray-600">Manage page and event controller assignments</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/admin/event-pages"
              className="flex items-center gap-2 bg-[#0b6d41] text-white px-4 py-2 rounded-lg hover:bg-[#0a5d37] transition-colors"
            >
              <Layers className="h-5 w-5" />
              Assign Page Controllers
            </Link>
            <Link
              href="/admin/events"
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <UserCheck className="h-5 w-5" />
              Assign Event Controllers
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('all')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'all'
                ? 'border-[#0b6d41] text-[#0b6d41]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            All Controllers
          </button>
          <button
            onClick={() => setActiveTab('page')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'page'
                ? 'border-[#0b6d41] text-[#0b6d41]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Page Controllers
          </button>
          <button
            onClick={() => setActiveTab('event')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'event'
                ? 'border-[#0b6d41] text-[#0b6d41]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Event Controllers
          </button>
        </nav>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="Search by name, email, or title..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-[#0b6d41]" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{controllers.length}</p>
              <p className="text-sm text-gray-600">Total Assignments</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center gap-3">
            <User className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {new Set(controllers.map(c => c.user_id)).size}
              </p>
              <p className="text-sm text-gray-600">Unique Controllers</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center gap-3">
            <Calendar className="h-8 w-8 text-purple-600" />
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {new Set([...controllers.filter(c => c.event_page_id).map(c => c.event_page_id),
                         ...controllers.filter(c => c.event_id).map(c => c.event_id)]).size}
              </p>
              <p className="text-sm text-gray-600">Managed Resources</p>
            </div>
          </div>
        </div>
      </div>

      {/* Controllers List */}
      {filteredControllers.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
          <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm ? 'No controllers found' : 'No Controllers Assigned'}
          </h3>
          <p className="text-gray-600">
            {searchTerm 
              ? 'Try adjusting your search terms' 
              : 'Start by assigning controllers to pages or events'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Controller
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Resource
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Assigned
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredControllers.map((controller) => (
                <tr key={controller.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-[#0b6d41] rounded-full flex items-center justify-center">
                        <User className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {controller.profiles?.full_name || 'Unknown User'}
                        </p>
                        <p className="text-sm text-gray-500">{controller.profiles?.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-gray-900">
                        {controller.role_type === 'page_controller' 
                          ? (controller.event_pages?.title || 'Unknown Page')
                          : (controller.events?.title || 'Unknown Event')}
                      </p>
                      {(controller.event_pages?.location || controller.events?.location) && (
                        <div className="flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3 text-gray-400" />
                          <p className="text-sm text-gray-500">
                            {controller.event_pages?.location || controller.events?.location}
                          </p>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      controller.role_type === 'page_controller'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {controller.role_type === 'page_controller' ? 'Page' : 'Event'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      (controller.event_pages?.status || controller.events?.status) === 'published' 
                        ? 'bg-green-100 text-green-800'
                        : (controller.event_pages?.status || controller.events?.status) === 'draft'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {controller.event_pages?.status || controller.events?.status || 'unknown'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">
                      <p className="text-gray-900">
                        {new Date(controller.assigned_at).toLocaleDateString()}
                      </p>
                      <p className="text-gray-500">
                        by {controller.assigned_by_profile?.full_name || 'System'}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {controller.role_type === 'page_controller' ? (
                        <Link
                          href={`/admin/event-pages/${controller.event_page_id}`}
                          className="text-blue-600 hover:text-blue-700"
                          title="View Page"
                        >
                          <Edit className="h-4 w-4" />
                        </Link>
                      ) : (
                        <Link
                          href={`/admin/events/${controller.event_id}`}
                          className="text-blue-600 hover:text-blue-700"
                          title="View Event"
                        >
                          <Edit className="h-4 w-4" />
                        </Link>
                      )}
                      <button
                        onClick={() => handleRemoveController(
                          controller.id, 
                          controller.event_page_id || controller.event_id || '',
                          controller.event_pages?.title || controller.events?.title || 'this resource'
                        )}
                        className="text-red-600 hover:text-red-700"
                        title="Remove Controller"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary by User */}
      <div className="mt-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Controllers Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from(new Set(controllers.map(c => c.user_id).filter(Boolean))).map(userId => {
            const userControllers = controllers.filter(c => c.user_id === userId)
            const user = userControllers[0]?.profiles
            
            return (
              <div key={`user-${userId}`} className="bg-white rounded-lg shadow-sm border p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-[#0b6d41] rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {user?.full_name || 'Unknown User'}
                    </p>
                    <p className="text-sm text-gray-500 truncate">{user?.email}</p>
                    <div className="mt-2">
                      <p className="text-sm font-medium text-gray-700">
                        Managing {userControllers.length} resource{userControllers.length !== 1 ? 's' : ''}:
                      </p>
                      <ul className="mt-1 space-y-1">
                        {userControllers.map(uc => (
                          <li key={uc.id} className="text-sm text-gray-600 truncate">
                            • {uc.role_type === 'page_controller' 
                                ? `[Page] ${uc.event_pages?.title || 'Unknown'}`
                                : `[Event] ${uc.events?.title || 'Unknown'}`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}