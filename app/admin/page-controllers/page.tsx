'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { Shield, User, Calendar, MapPin, Edit, Trash2, Plus, Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface PageController {
  id: string
  controller_id: string
  event_page_id: string
  assigned_at: string
  assigned_by: string
  profiles: {
    id: string
    email: string
    full_name: string
  }
  event_pages: {
    id: string
    title: string
    location: string
    start_date: string
    end_date: string
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
  const [pageControllers, setPageControllers] = useState<PageController[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const supabase = createClient()

  useEffect(() => {
    if (!profile) return
    
    // Check if user is admin
    if (profile.role !== 'admin') {
      router.push('/')
      return
    }
    
    fetchPageControllers()
  }, [profile])

  const fetchPageControllers = async () => {
    try {
      setLoading(true)
      
      // First fetch page controllers
      const { data: controllers, error: controllersError } = await supabase
        .from('page_controllers')
        .select('*')
        .order('assigned_at', { ascending: false })

      if (controllersError) {
        console.error('Error fetching controllers:', controllersError)
        setPageControllers([])
        return
      }

      if (!controllers || controllers.length === 0) {
        setPageControllers([])
        return
      }

      // Get unique user IDs and page IDs
      const userIds = [...new Set(controllers.map(c => c.controller_id).filter(Boolean))]
      const pageIds = [...new Set(controllers.map(c => c.event_page_id).filter(Boolean))]
      const assignerIds = [...new Set(controllers.map(c => c.assigned_by).filter(Boolean))]

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
      const enrichedControllers = controllers.map(controller => {
        const profile = profiles.find((p: any) => p.id === controller.controller_id)
        const eventPage = eventPages.find((ep: any) => ep.id === controller.event_page_id)
        const assignerProfile = assignerProfiles.find((p: any) => p.id === controller.assigned_by)

        return {
          ...controller,
          profiles: profile || null,
          event_pages: eventPage || null,
          assigned_by_profile: assignerProfile || null
        }
      })

      setPageControllers(enrichedControllers)
    } catch (error) {
      console.error('Error fetching page controllers:', error)
      setPageControllers([])
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveController = async (controllerId: string, pageId: string, pageTitle: string) => {
    if (!confirm(`Remove this user as controller for "${pageTitle}"?`)) return

    try {
      const { error } = await supabase
        .from('page_controllers')
        .delete()
        .eq('id', controllerId)

      if (error) throw error
      fetchPageControllers()
    } catch (error) {
      console.error('Error removing controller:', error)
      alert('Failed to remove controller')
    }
  }

  const filteredControllers = pageControllers.filter(pc => {
    const searchLower = searchTerm.toLowerCase()
    return (
      pc.profiles?.full_name?.toLowerCase().includes(searchLower) ||
      pc.profiles?.email?.toLowerCase().includes(searchLower) ||
      pc.event_pages?.title?.toLowerCase().includes(searchLower) ||
      pc.event_pages?.location?.toLowerCase().includes(searchLower)
    )
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
            <h1 className="text-3xl font-bold text-gray-900">Page Controllers</h1>
            <p className="mt-2 text-gray-600">Manage page controller assignments for all event pages</p>
          </div>
          <Link
            href="/admin/event-pages"
            className="flex items-center gap-2 bg-[#0b6d41] text-white px-4 py-2 rounded-lg hover:bg-[#0a5d37] transition-colors"
          >
            <Plus className="h-5 w-5" />
            Assign Controllers
          </Link>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            placeholder="Search by name, email, or page title..."
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
              <p className="text-2xl font-bold text-gray-900">{pageControllers.length}</p>
              <p className="text-sm text-gray-600">Total Assignments</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center gap-3">
            <User className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {new Set(pageControllers.map(pc => pc.controller_id)).size}
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
                {new Set(pageControllers.map(pc => pc.event_page_id)).size}
              </p>
              <p className="text-sm text-gray-600">Pages with Controllers</p>
            </div>
          </div>
        </div>
      </div>

      {/* Controllers List */}
      {filteredControllers.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
          <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchTerm ? 'No controllers found' : 'No Page Controllers Assigned'}
          </h3>
          <p className="text-gray-600">
            {searchTerm 
              ? 'Try adjusting your search terms' 
              : 'Start by assigning controllers to event pages'}
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
                  Event Page
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Page Status
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
                        {controller.event_pages?.title || 'Unknown Page'}
                      </p>
                      {controller.event_pages?.location && (
                        <div className="flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3 text-gray-400" />
                          <p className="text-sm text-gray-500">{controller.event_pages.location}</p>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      controller.event_pages?.status === 'published' 
                        ? 'bg-green-100 text-green-800'
                        : controller.event_pages?.status === 'draft'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {controller.event_pages?.status || 'unknown'}
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
                      <Link
                        href={`/admin/event-pages/${controller.event_page_id}`}
                        className="text-blue-600 hover:text-blue-700"
                        title="View Page"
                      >
                        <Edit className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => handleRemoveController(
                          controller.id, 
                          controller.event_page_id,
                          controller.event_pages?.title || 'this page'
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
          {Array.from(new Set(pageControllers.map(pc => pc.controller_id))).map(userId => {
            const userControllers = pageControllers.filter(pc => pc.controller_id === userId)
            const user = userControllers[0]?.profiles
            
            return (
              <div key={userId} className="bg-white rounded-lg shadow-sm border p-4">
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
                        Managing {userControllers.length} page{userControllers.length !== 1 ? 's' : ''}:
                      </p>
                      <ul className="mt-1 space-y-1">
                        {userControllers.map(uc => (
                          <li key={uc.id} className="text-sm text-gray-600 truncate">
                            • {uc.event_pages?.title}
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