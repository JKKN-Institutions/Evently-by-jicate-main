'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Upload, Eye, Trash2, Plus, QrCode, Image as ImageIcon, CheckCircle, Info } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { overlayQRCodeOnTemplate, type QRPosition, type TicketQRData } from '@/lib/ticket-qr-overlay'

interface TicketTemplate {
  id: string
  name: string
  description: string
  template_url: string
  qr_position: QRPosition
  created_at: string
  organizer_id: string
  is_public: boolean
}

export default function OrganizerTicketTemplatesPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<TicketTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [templateName, setTemplateName] = useState('')
  const [templateDescription, setTemplateDescription] = useState('')
  const [qrPosition, setQrPosition] = useState<QRPosition>({ x: 50, y: 50, size: 150 })
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [isPublic, setIsPublic] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    checkAuth()
    loadTemplates()
  }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'organizer' && profile?.role !== 'admin') {
      router.push('/profile/upgrade-to-organizer')
    }
  }

  const loadTemplates = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Load user's templates and public templates
      const { data, error } = await supabase
        .from('ticket_templates')
        .select('*')
        .or(`organizer_id.eq.${user.id},is_public.eq.true`)
        .order('created_at', { ascending: false })

      if (error) throw error
      setTemplates(data || [])
    } catch (error) {
      console.error('Error loading templates:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB')
        return
      }
      setSelectedFile(file)
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      setPreviewMode(true)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile || !templateName) {
      alert('Please select a file and enter a name')
      return
    }

    setUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Convert file to base64
      const reader = new FileReader()
      const base64 = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(selectedFile)
      })

      // Save to database
      const { data, error } = await supabase
        .from('ticket_templates')
        .insert({
          name: templateName,
          description: templateDescription,
          template_url: base64,
          qr_position: qrPosition,
          organizer_id: user.id,
          is_public: isPublic
        })
        .select()
        .single()

      if (error) throw error

      setTemplates([data, ...templates])
      setShowUploadForm(false)
      resetForm()
      alert('Template uploaded successfully!')
    } catch (error) {
      console.error('Error uploading template:', error)
      alert('Failed to upload template')
    } finally {
      setUploading(false)
    }
  }

  const resetForm = () => {
    setSelectedFile(null)
    setPreviewUrl('')
    setTemplateName('')
    setTemplateDescription('')
    setQrPosition({ x: 50, y: 50, size: 150 })
    setPreviewMode(false)
    setIsPublic(false)
  }

  const deleteTemplate = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return

    try {
      const { error } = await supabase
        .from('ticket_templates')
        .delete()
        .eq('id', id)

      if (error) throw error
      setTemplates(templates.filter(t => t.id !== id))
    } catch (error) {
      console.error('Error deleting template:', error)
      alert('Failed to delete template')
    }
  }

  const previewWithQR = async (template: TicketTemplate) => {
    try {
      const sampleData: TicketQRData = {
        ticketId: 'SAMPLE-001',
        eventId: 'event-sample',
        attendeeName: 'John Doe',
        attendeeEmail: 'john@example.com',
        eventName: 'Sample Event',
        eventDate: new Date().toISOString().split('T')[0],
        venue: 'Sample Venue'
      }

      const resultUrl = await overlayQRCodeOnTemplate(
        template.template_url,
        sampleData,
        template.qr_position
      )

      // Open in new tab
      const newWindow = window.open('', '_blank')
      if (newWindow) {
        newWindow.document.write(`
          <html>
            <head><title>Ticket Preview</title></head>
            <body style="margin:0;padding:20px;background:#f5f5f5;display:flex;justify-content:center;align-items:center;min-height:100vh;">
              <img src="${resultUrl}" style="max-width:100%;box-shadow:0 4px 6px rgba(0,0,0,0.1);" />
            </body>
          </html>
        `)
      }
    } catch (error) {
      console.error('Error generating preview:', error)
      alert('Failed to generate preview')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0b6d41]"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-bold text-gray-900">My Ticket Templates</h1>
            </div>
            <Link
              href="/organizer/my-events"
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Events
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Info Banner */}
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <Info className="h-5 w-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-blue-900">About Ticket Templates</h3>
              <p className="text-sm text-blue-700 mt-1">
                Upload your custom ticket designs here. When creating an event, you can choose to use these templates.
                QR codes for ticket verification will be automatically added at the position you specify.
              </p>
            </div>
          </div>
        </div>

        {/* Upload Section */}
        {!showUploadForm ? (
          <button
            onClick={() => setShowUploadForm(true)}
            className="mb-8 inline-flex items-center px-6 py-3 bg-[#0b6d41] text-white rounded-lg hover:bg-[#0a5d37] transition-colors"
          >
            <Plus className="h-5 w-5 mr-2" />
            Upload New Template
          </button>
        ) : (
          <div className="mb-8 bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Upload New Template</h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              {/* Upload Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                    placeholder="e.g., Premium Concert Ticket"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={templateDescription}
                    onChange={(e) => setTemplateDescription(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                    rows={3}
                    placeholder="Describe your template..."
                  />
                </div>

                <div>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPublic}
                      onChange={(e) => setIsPublic(e.target.checked)}
                      className="mr-2 h-4 w-4 text-[#0b6d41] rounded focus:ring-[#0b6d41]"
                    />
                    <span className="text-sm text-gray-700">
                      Make this template available to other organizers
                    </span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload Template Image *
                  </label>
                  {!previewUrl ? (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="template-upload"
                      />
                      <label htmlFor="template-upload" className="cursor-pointer">
                        <span className="text-[#0b6d41] hover:text-[#0a5d37] font-medium">
                          Click to upload
                        </span>
                        <span className="text-gray-500"> or drag and drop</span>
                      </label>
                      <p className="text-xs text-gray-500 mt-2">PNG, JPG up to 10MB</p>
                    </div>
                  ) : (
                    <div className="relative">
                      <img src={previewUrl} alt="Template preview" className="w-full rounded-lg" />
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFile(null)
                          setPreviewUrl('')
                          setPreviewMode(false)
                        }}
                        className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>

                {previewUrl && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      QR Code Position & Size
                    </label>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-600">X Position (px)</label>
                        <input
                          type="number"
                          value={qrPosition.x}
                          onChange={(e) => setQrPosition({...qrPosition, x: parseInt(e.target.value)})}
                          className="w-full px-3 py-1 border border-gray-300 rounded"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Y Position (px)</label>
                        <input
                          type="number"
                          value={qrPosition.y}
                          onChange={(e) => setQrPosition({...qrPosition, y: parseInt(e.target.value)})}
                          className="w-full px-3 py-1 border border-gray-300 rounded"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Size (px)</label>
                        <input
                          type="number"
                          value={qrPosition.size}
                          onChange={(e) => setQrPosition({...qrPosition, size: parseInt(e.target.value)})}
                          className="w-full px-3 py-1 border border-gray-300 rounded"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleUpload}
                    disabled={uploading || !selectedFile || !templateName}
                    className="flex-1 bg-[#0b6d41] text-white py-2 rounded-lg hover:bg-[#0a5d37] disabled:opacity-50"
                  >
                    {uploading ? 'Uploading...' : 'Upload Template'}
                  </button>
                  <button
                    onClick={() => {
                      setShowUploadForm(false)
                      resetForm()
                    }}
                    className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>

              {/* Preview */}
              {previewMode && previewUrl && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-3">Preview with QR Code Position</h3>
                  <div className="relative bg-white rounded-lg shadow-sm overflow-hidden">
                    <img src={previewUrl} alt="Template" className="w-full" />
                    <div 
                      className="absolute border-2 border-dashed border-blue-500 bg-blue-50 bg-opacity-30 flex items-center justify-center"
                      style={{
                        left: `${qrPosition.x}px`,
                        top: `${qrPosition.y}px`,
                        width: `${qrPosition.size}px`,
                        height: `${qrPosition.size}px`
                      }}
                    >
                      <QrCode className="h-8 w-8 text-blue-600" />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    <CheckCircle className="inline h-3 w-3 mr-1" />
                    QR code will be placed at the marked position
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Templates Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <div key={template.id} className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="aspect-[3/2] relative bg-gray-100">
                <img 
                  src={template.template_url} 
                  alt={template.name}
                  className="w-full h-full object-cover"
                />
                {template.is_public && (
                  <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded">
                    Public
                  </div>
                )}
              </div>
              
              <div className="p-4">
                <h3 className="font-semibold text-gray-900">{template.name}</h3>
                {template.description && (
                  <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                )}
                
                <div className="flex items-center justify-between text-xs text-gray-500 mt-3">
                  <span>QR: ({template.qr_position.x}, {template.qr_position.y})</span>
                  <span>Size: {template.qr_position.size}px</span>
                </div>
                
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => previewWithQR(template)}
                    className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Preview
                  </button>
                  {template.organizer_id === templates[0]?.organizer_id && (
                    <button
                      onClick={() => deleteTemplate(template.id)}
                      className="inline-flex items-center justify-center px-3 py-2 border border-red-300 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {templates.length === 0 && !showUploadForm && (
          <div className="text-center py-12">
            <ImageIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No templates yet</h3>
            <p className="text-gray-500 mb-6">Upload your first ticket template</p>
            <button
              onClick={() => setShowUploadForm(true)}
              className="inline-flex items-center px-6 py-3 bg-[#0b6d41] text-white rounded-lg hover:bg-[#0a5d37] transition-colors"
            >
              <Plus className="h-5 w-5 mr-2" />
              Upload Template
            </button>
          </div>
        )}
      </div>
    </div>
  )
}