'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Upload } from 'lucide-react'
import { EventPage } from '@/types/event-pages'
import { uploadEventImage } from '@/lib/supabase/storage-helper'

export default function EditEventPage() {
  const { id } = useParams()
  const router = useRouter()
  const { profile } = useAuth()
  const [eventPage, setEventPage] = useState<EventPage | null>(null)
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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadMode, setUploadMode] = useState<'url' | 'file'>('url')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (profile?.role !== 'admin') {
      router.push('/')
      return
    }
    fetchEventPage()
  }, [id, profile])

  const fetchEventPage = async () => {
    try {
      const { data, error } = await supabase
        .from('event_pages')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      
      setEventPage(data)
      setFormData({
        title: data.title || '',
        slug: data.slug || '',
        description: data.description || '',
        location: data.location || '',
        start_date: data.start_date || '',
        end_date: data.end_date || '',
        status: data.status || 'draft',
        banner_image: data.banner_image || ''
      })
    } catch (error) {
      console.error('Error fetching event page:', error)
      router.push('/admin/event-pages')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      let finalBannerImage = formData.banner_image

      // Handle file upload if a file is selected
      if (selectedFile && uploadMode === 'file') {
        setUploading(true)
        const uploadResult = await uploadEventImage(selectedFile, 'page-' + id)
        
        if (uploadResult.success && uploadResult.publicUrl) {
          finalBannerImage = uploadResult.publicUrl
        } else {
          console.warn('Banner upload failed, proceeding with current image:', uploadResult.error)
        }
        setUploading(false)
      }

      // Generate slug from title if not provided
      const slug = formData.slug || formData.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      
      const { error } = await supabase
        .from('event_pages')
        .update({
          title: formData.title,
          slug,
          description: formData.description,
          location: formData.location,
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
          status: formData.status,
          banner_image: finalBannerImage || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      if (error) throw error
      
      router.push(`/admin/event-pages/${id}`)
    } catch (error) {
      console.error('Error updating event page:', error)
      alert('Failed to update event page')
    } finally {
      setSaving(false)
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0b6d41]"></div>
      </div>
    )
  }

  if (!eventPage) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h3 className="text-lg font-medium text-red-800 mb-2">Event Page Not Found</h3>
          <p className="text-red-600">The requested event page could not be found.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => router.back()}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Edit Event Page</h1>
            <p className="text-gray-600 mt-1">Update the details for "{eventPage.title}"</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
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
              rows={4}
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
                Upload New
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
                  Upload a new banner image (will replace current image)
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
                  className="w-full h-48 object-cover"
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
              onClick={() => router.back()}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || uploading}
              className="flex-1 px-4 py-2 bg-[#0b6d41] text-white rounded-lg hover:bg-[#0a5d37] transition-colors disabled:opacity-50"
            >
              {uploading ? 'Uploading Banner...' : saving ? 'Saving Changes...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}