'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { isAdminEmail } from '@/lib/config/admin-emails'
import { Plus, Edit, Trash2, Users, Calendar, MapPin, Eye, Archive, ChevronRight, Shield, Upload } from 'lucide-react'
import { EventPage, PageControllerView } from '@/types/event-pages'
import { uploadEventImage } from '@/lib/supabase/storage-helper'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function EventPagesManagement() {
  const { user, profile, loading: authLoading } = useAuth()
  
  // Derive effective role - same logic as professional-sidebar
  const effectiveRole = profile?.role || (user?.email && isAdminEmail(user.email) ? 'admin' : 'user')
  const isAdmin = effectiveRole === 'admin'
  const router = useRouter()
  const [eventPages, setEventPages] = useState<EventPage[]>([])
  const [pageControllers, setPageControllers] = useState<PageControllerView[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const PAGE_SIZE = 12
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedPage, setSelectedPage] = useState<EventPage | null>(null)
  const [supabase] = useState(() => createClient())

  useEffect(() => {
    // Wait for auth to complete before checking permissions
    if (authLoading) {
      console.log('Waiting for auth to complete...')
      return
    }
    
    // Check if user has admin access
    if (!user) {
      console.log('No user found, redirecting to login')
      router.replace('/login')
      return
    }
    
    if (!isAdmin) {
      console.log('User is not admin, redirecting to home')
      router.replace('/')
      return
    }
    
    // User is admin, load the page
    console.log('User is admin, loading event pages')
    loadPage(1)
  }, [authLoading, isAdmin, user])

  // Prevent re-fetching on every render
  const loadPageRef = useRef<number>(0)

  const loadPage = async (pageNumber: number) => {
    // Prevent duplicate loads
    if (loadPageRef.current === pageNumber && eventPages.length > 0) return
    loadPageRef.current = pageNumber
    
    try {
      setLoading(true)
      const from = (pageNumber - 1) * PAGE_SIZE
      const to = from + PAGE_SIZE - 1

      console.log('Loading event pages, range:', from, 'to', to)

      // Fetch only required columns and with pagination
      const { data, error, count } = await supabase
        .from('event_pages')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) {
        console.error('Supabase query error:', error)
        // Don't throw, handle gracefully
        setEventPages([])
        setTotal(0)
        setPage(1)
      } else {
        const pages = data || []
        console.log('Loaded event pages:', pages.length)
        setEventPages(pages)
        setTotal(count || 0)
        setPage(pageNumber)

        // Fetch controllers only for visible pages
        if (pages.length > 0) {
          const pageIds = pages.map(p => p.id)
          await fetchPageControllersFor(pageIds)
        }
      }
    } catch (error) {
      console.error('Error loading event pages:', error)
      // Set empty state on error
      setEventPages([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  const fetchPageControllersFor = async (pageIds: string[]) => {
    try {
      if (pageIds.length === 0) {
        setPageControllers([])
        return
      }

      const { data, error } = await supabase
        .from('page_controllers_view')
        .select('*')
        .in('event_page_id', pageIds)

      if (error) throw error
      setPageControllers(data || [])
    } catch (error) {
      console.error('Error fetching page controllers:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this event page?')) return

    try {
      const { error } = await supabase
        .from('event_pages')
        .delete()
        .eq('id', id)

      if (error) throw error
      loadPage(page)
    } catch (error) {
      console.error('Error deleting event page:', error)
      alert('Failed to delete event page')
    }
  }

  const getPageController = (pageId: string) => {
    return pageControllers.find(pc => pc.event_page_id === pageId)
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Show loading spinner while auth is loading
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0b6d41] mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    )
  }

  // If not admin after auth loads, show message (will redirect)
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600">Redirecting...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Event Pages Management</h1>
            <p className="mt-2 text-gray-600">Manage festival pages and assign page controllers</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-[#0b6d41] text-white px-4 py-2 rounded-lg hover:bg-[#0a5d37] transition-colors"
          >
            <Plus className="h-5 w-5" />
            Create Event Page
          </button>
        </div>
      </div>

      {/* Event Pages Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading && Array.from({ length: 6 }).map((_, i) => (
          <div key={`skeleton-${i}`} className="bg-white rounded-lg shadow-md overflow-hidden animate-pulse">
            <div className="w-full h-48 bg-gray-200" />
            <div className="p-6 space-y-3">
              <div className="h-5 bg-gray-200 rounded w-2/3" />
              <div className="h-4 bg-gray-100 rounded w-full" />
              <div className="h-4 bg-gray-100 rounded w-5/6" />
              <div className="flex gap-2 pt-2">
                <div className="h-9 bg-gray-200 rounded w-1/3" />
                <div className="h-9 bg-gray-200 rounded w-1/3" />
                <div className="h-9 bg-gray-200 rounded w-10" />
              </div>
            </div>
          </div>
        ))}

        {!loading && eventPages.map((page) => {
          const controller = getPageController(page.id)
          return (
            <div key={page.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
              {page.banner_image && (
                <img 
                  src={page.banner_image} 
                  alt={page.title}
                  className="w-full h-48 object-cover"
                />
              )}
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-semibold text-gray-900">{page.title}</h3>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    page.status === 'published' ? 'bg-green-100 text-green-800' :
                    page.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {page.status}
                  </span>
                </div>
                
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                  {page.description || 'No description provided'}
                </p>

                {/* Page Info */}
                <div className="space-y-2 mb-4">
                  {page.location && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPin className="h-4 w-4" />
                      {page.location}
                    </div>
                  )}
                  {page.start_date && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="h-4 w-4" />
                      {new Date(page.start_date).toLocaleDateString()} - {page.end_date ? new Date(page.end_date).toLocaleDateString() : 'Ongoing'}
                    </div>
                  )}
                </div>

                {/* Page Controller */}
                <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Page Controller:</span>
                    {controller ? (
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-[#0b6d41]" />
                        <span className="text-sm font-medium">{controller.controller_name}</span>
                        <button
                          onClick={() => {
                            setSelectedPage(page)
                            setShowAssignModal(true)
                          }}
                          className="ml-2 text-xs text-blue-600 hover:text-blue-700"
                          title="Change controller"
                        >
                          <Edit className="h-3 w-3 inline" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setSelectedPage(page)
                          setShowAssignModal(true)
                        }}
                        className="text-sm text-[#0b6d41] hover:underline"
                      >
                        Assign Controller
                      </button>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Link
                    href={`/admin/event-pages/${page.id}`}
                    className="flex-1 flex items-center justify-center gap-2 bg-[#0b6d41] text-white px-3 py-2 rounded-lg hover:bg-[#0a5d37] transition-colors"
                  >
                    <Eye className="h-4 w-4" />
                    View
                  </Link>
                  <button
                    onClick={() => router.push(`/admin/event-pages/${page.id}/edit`)}
                    className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(page.id)}
                    className="flex items-center justify-center bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {!loading && eventPages.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Event Pages Yet</h3>
          <p className="text-gray-600 mb-4">Create your first event page to get started</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 bg-[#0b6d41] text-white px-4 py-2 rounded-lg hover:bg-[#0a5d37] transition-colors"
          >
            <Plus className="h-5 w-5" />
            Create Event Page
          </button>
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between mt-8">
        <div className="text-sm text-gray-600">
          Showing {(page - 1) * PAGE_SIZE + 1} - {Math.min(page * PAGE_SIZE, total)} of {total}
        </div>
        <div className="flex items-center gap-2">
          <button
            disabled={page === 1 || loading}
            onClick={() => loadPage(page - 1)}
            className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-50"
          >
            Prev
          </button>
          <span className="text-sm text-gray-700">
            Page {page} / {totalPages}
          </span>
          <button
            disabled={page === totalPages || loading}
            onClick={() => loadPage(page + 1)}
            className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <CreateEventPageModal 
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            loadPage(1)
          }}
        />
      )}

      {/* Assign Controller Modal */}
      {showAssignModal && selectedPage && (
        <AssignControllerModal
          eventPage={selectedPage}
          onClose={() => {
            setShowAssignModal(false)
            setSelectedPage(null)
          }}
          onSuccess={() => {
            setShowAssignModal(false)
            setSelectedPage(null)
            // refresh controllers for current page only
            fetchPageControllersFor(eventPages.map(p => p.id))
          }}
        />
      )}
    </div>
  )
}

// Create Event Page Modal Component
function CreateEventPageModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    description: '',
    location: '',
    start_date: '',
    end_date: '',
    status: 'draft',
    banner_image: ''
  })
  const [loading, setLoading] = useState(false)
  const [uploadMode, setUploadMode] = useState<'url' | 'file'>('url')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const supabase = createClient()
  const { user } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      let finalBannerImage = formData.banner_image

      // Handle file upload if a file is selected
      if (selectedFile && uploadMode === 'file') {
        setUploading(true)
        const uploadResult = await uploadEventImage(selectedFile, 'page-' + Date.now())
        
        if (uploadResult.success && uploadResult.publicUrl) {
          finalBannerImage = uploadResult.publicUrl
        } else {
          console.warn('Banner upload failed, proceeding without image:', uploadResult.error)
        }
        setUploading(false)
      }

      // Generate slug from title if not provided
      const slug = formData.slug || formData.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      
      const { error } = await supabase
        .from('event_pages')
        .insert({
          title: formData.title,
          slug,
          description: formData.description,
          location: formData.location,
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
          status: formData.status,
          banner_image: finalBannerImage || null,
          created_by: user?.id
        })

      if (error) throw error
      onSuccess()
    } catch (error) {
      console.error('Error creating event page:', error)
      alert('Failed to create event page')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Create Event Page</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL Slug</label>
            <input
              type="text"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              placeholder="auto-generated-from-title"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Banner Image</label>
            
            {/* Upload Mode Toggle */}
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setUploadMode('url')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  uploadMode === 'url' 
                    ? 'bg-[#0b6d41] text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                URL
              </button>
              <button
                type="button"
                onClick={() => setUploadMode('file')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  uploadMode === 'file' 
                    ? 'bg-[#0b6d41] text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                <Upload className="h-4 w-4 inline mr-1" />
                Upload
              </button>
            </div>

            {/* URL Input */}
            {uploadMode === 'url' && (
              <div>
                <input
                  type="url"
                  value={formData.banner_image}
                  onChange={(e) => setFormData({ ...formData, banner_image: e.target.value })}
                  placeholder="https://example.com/banner.jpg"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                />
                <p className="text-xs text-gray-500 mt-1">Enter a banner image URL</p>
              </div>
            )}

            {/* File Upload */}
            {uploadMode === 'file' && (
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null
                    setSelectedFile(file)
                    // Clear URL when file is selected
                    if (file) setFormData({ ...formData, banner_image: '' })
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41] file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-[#0b6d41] file:text-white hover:file:bg-[#0a5d37]"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Upload a banner image file (JPG, PNG, WebP) - will be stored in Supabase Storage
                </p>
                {selectedFile && (
                  <p className="text-xs text-green-600 mt-1">
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>
            )}
            
            {/* Image Preview */}
            {(formData.banner_image || selectedFile) && (
              <div className="mt-3 rounded-lg overflow-hidden border border-gray-200">
                <img 
                  src={selectedFile ? URL.createObjectURL(selectedFile) : formData.banner_image} 
                  alt="Banner preview"
                  className="w-full h-32 object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || uploading}
              className="flex-1 px-4 py-2 bg-[#0b6d41] text-white rounded-lg hover:bg-[#0a5d37] transition-colors disabled:opacity-50"
            >
              {uploading ? 'Uploading Banner...' : loading ? 'Creating Event Page...' : 'Create Event Page'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Assign Controller Modal Component
function AssignControllerModal({ 
  eventPage, 
  onClose, 
  onSuccess 
}: { 
  eventPage: EventPage
  onClose: () => void
  onSuccess: () => void 
}) {
  const [users, setUsers] = useState<any[]>([])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [currentController, setCurrentController] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const { user } = useAuth()

  useEffect(() => {
    fetchUsers()
    fetchCurrentController()
  }, [])

  const fetchCurrentController = async () => {
    try {
      const { data, error } = await supabase
        .from('page_controllers')
        .select('*, profiles(id, email, full_name)')
        .eq('event_page_id', eventPage.id)
        .single()

      if (data && !error) {
        setCurrentController(data)
        setSelectedUserId(data.controller_id)
      }
    } catch (error) {
      console.log('No current controller assigned')
    }
  }

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .order('full_name')

      if (error) throw error
      setUsers(data || [])
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const handleAssign = async () => {
    if (!selectedUserId) return
    setLoading(true)

    try {
      // If there's a current controller and we're changing to a different user
      if (currentController && selectedUserId !== currentController.controller_id) {
        // First remove the current controller
        const { error: removeError } = await supabase
          .from('page_controllers')
          .delete()
          .eq('event_page_id', eventPage.id)

        if (removeError) throw removeError
      }

      // Only assign if we're not removing (selectedUserId is not empty)
      if (selectedUserId && selectedUserId !== currentController?.controller_id) {
        const { data, error } = await supabase.rpc('assign_page_controller', {
          p_page_id: eventPage.id,
          p_user_id: selectedUserId,
          p_assigned_by: user?.id
        })

        if (error) throw error
        if (!data.success) throw new Error(data.error)
      }
      
      onSuccess()
    } catch (error) {
      console.error('Error updating controller:', error)
      alert('Failed to update page controller')
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = async () => {
    if (!currentController) return
    
    if (!confirm('Are you sure you want to remove the current page controller?')) return
    
    setLoading(true)
    try {
      const { error } = await supabase
        .from('page_controllers')
        .delete()
        .eq('event_page_id', eventPage.id)

      if (error) throw error
      onSuccess()
    } catch (error) {
      console.error('Error removing controller:', error)
      alert('Failed to remove page controller')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-4">
          {currentController ? 'Update Page Controller' : 'Assign Page Controller'}
        </h2>
        <p className="text-gray-600 mb-4">
          {currentController ? 'Change' : 'Assign'} the Page Controller for <strong>{eventPage.title}</strong>
        </p>
        
        {currentController && (
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              Current Controller: <strong>{currentController.profiles?.full_name || currentController.profiles?.email}</strong>
            </p>
          </div>
        )}
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">Select User</label>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
          >
            <option value="">Choose a user...</option>
            {users.map(user => (
              <option key={user.id} value={user.id}>
                {user.full_name || user.email}
                {user.id === currentController?.controller_id && ' (Current)'}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3">
          {currentController && (
            <button
              onClick={handleRemove}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Remove
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={!selectedUserId || loading || selectedUserId === currentController?.controller_id}
            className="flex-1 px-4 py-2 bg-[#0b6d41] text-white rounded-lg hover:bg-[#0a5d37] transition-colors disabled:opacity-50"
          >
            {loading ? 'Updating...' : currentController ? 'Update Controller' : 'Assign Controller'}
          </button>
        </div>
      </div>
    </div>
  )
}