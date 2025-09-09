'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Upload, Download, Eye, Trash2, Plus, QrCode, Image as ImageIcon, CheckCircle, Ticket, X, Calendar, Package, Loader2, FileDown, AlertCircle, Layers } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/auth-context'
import { isAdminEmail } from '@/lib/config/admin-emails'
import QRCode from 'qrcode'
import { encryptTicketData, generateTicketNumber, TicketData } from '@/lib/qr-generator'

interface PredefinedTicket {
  id: string
  name: string
  description: string
  template_url: string
  qr_position: {
    x: number
    y: number
    size: number
  }
  ticket_type: string // Now accepts any custom type
  ticket_category?: string // Event category
  created_at: string
  event_id?: string
}

export default function PredefinedTicketsPage() {
  const { user, profile, loading: authLoading } = useAuth()
  const router = useRouter()
  
  // Derive effective role - same logic as professional-sidebar
  const effectiveRole = profile?.role || (user?.email && isAdminEmail(user.email) ? 'admin' : 'user')
  const isAdmin = effectiveRole === 'admin'
  
  const [tickets, setTickets] = useState<PredefinedTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string>('')
  const [ticketName, setTicketName] = useState('')
  const [ticketDescription, setTicketDescription] = useState('')
  const [qrPosition, setQrPosition] = useState({ x: 550, y: 950, size: 180 })
  const [ticketType, setTicketType] = useState<string>('Bronze')
  const [customTicketType, setCustomTicketType] = useState<string>('')
  const [showAddCustomType, setShowAddCustomType] = useState(false)
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [selectedTicket, setSelectedTicket] = useState<PredefinedTicket | null>(null)
  const [dbError, setDbError] = useState<string | null>(null)
  const [events, setEvents] = useState<any[]>([])
  const [selectedEventId, setSelectedEventId] = useState<string>('')
  const [selectedEventCategory, setSelectedEventCategory] = useState<string>('')
  const [customTicketTypes, setCustomTicketTypes] = useState<string[]>(['VIP', 'Premium', 'General', 'Early Bird', 'Student'])
  const [editingTicketId, setEditingTicketId] = useState<string | null>(null)
  const [editQrPosition, setEditQrPosition] = useState({ x: 550, y: 950, size: 180 })
  const [generating, setGenerating] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkQuantity, setBulkQuantity] = useState(10)
  const [customQuantity, setCustomQuantity] = useState('')
  const [bulkGenerating, setBulkGenerating] = useState(false)
  const [bulkProgress, setBulkProgress] = useState(0)
  const [bulkProgressMessage, setBulkProgressMessage] = useState('')
  const [ticketsCreated, setTicketsCreated] = useState(0)
  const [bulkTemplate, setBulkTemplate] = useState<PredefinedTicket | null>(null)
  const [bulkNamePrefix, setBulkNamePrefix] = useState('Guest')
  const [selectedTicketType, setSelectedTicketType] = useState<'Gold' | 'Silver' | 'Bronze' | 'General'>('General')
  const [ticketCategory, setTicketCategory] = useState('predefined')
  const [bulkTicketType, setBulkTicketType] = useState<'Gold' | 'Silver' | 'Bronze' | 'General'>('General')
  const [bulkCategory, setBulkCategory] = useState('predefined')
  const supabase = createClient()

  useEffect(() => {
    if (authLoading) return
    if (!isAdmin) {
      router.replace('/')
      return
    }
    
    const loadData = async () => {
      setLoading(true)
      try {
        // Load both in parallel but don't let one hang the other
        await Promise.allSettled([
          loadTickets(),
          loadEvents()
        ])
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [authLoading, isAdmin])

  // Early return for non-admin users or while loading
  if (authLoading || !isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{authLoading ? 'Checking permissions...' : 'Admin access required'}</p>
        </div>
      </div>
    )
  }

  const loadEvents = async () => {
    try {
      console.log('Loading events from database...')
      
      // First try to get user to ensure we're authenticated
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('User not authenticated, cannot load events')
        setEvents([])
        return
      }
      
      // Add timeout to prevent hanging (5 second timeout)
      const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database query timeout after 5 seconds')), 5000)
      )
      
      const queryPromise = supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false })

      const { data, error } = await Promise.race([queryPromise, timeout])

      if (error) {
        console.error('Error loading events:', error)
        console.error('Error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        
        // Check specific error types
        if (error.code === '42P01' || error.message?.includes('relation')) {
          console.error('Events table not found - Please check if table exists in Supabase')
        } else if (error.code === '42501' || error.message?.includes('permission denied')) {
          console.error('Permission denied - Check RLS policies. Run fix-events-access.sql')
        }
        setEvents([])
      } else if (data) {
        console.log(`Successfully loaded ${data.length} events:`, data)
        setEvents(data)
        
        // If there are events but none selected, auto-select the first one
        if (data.length > 0 && !selectedEventId) {
          setSelectedEventId(data[0].id)
          console.log('Auto-selected first event:', data[0].title)
        }
      } else {
        console.log('No events found in database')
        setEvents([])
      }
    } catch (error) {
      console.error('Unexpected error loading events:', error)
      setEvents([])
    }
  }

  const loadTickets = async () => {
    try {
      console.log('Loading predefined tickets from database...')
      const { data, error } = await supabase
        .from('predefined_tickets')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading tickets:', error)
        // Check if table doesn't exist
        if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          console.error('The predefined_tickets table does not exist. Please run the setup SQL script.')
          setDbError('Database table not found. Please run the SETUP-PREDEFINED-TICKETS.sql script in your Supabase SQL Editor.')
        }
        throw error
      }
      console.log(`Successfully loaded ${data?.length || 0} predefined tickets`)
      setTickets(data || [])
      setDbError(null)
    } catch (error: any) {
      console.error('Error loading tickets:', error)
      // Show user-friendly error message
      if (error?.code === '42P01' || error?.message?.includes('relation') || error?.message?.includes('does not exist')) {
        // Table doesn't exist error is handled above
      } else {
        console.error('Failed to load ticket templates. Please check your database connection.')
        setDbError('Failed to load ticket templates. Please check your database connection.')
      }
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      setPreviewMode(true)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile || !ticketName || !selectedEventId) {
      alert('Please select an event, upload a file and enter a name')
      return
    }

    setUploading(true)
    try {
      // Convert file to base64
      const reader = new FileReader()
      const base64 = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(selectedFile)
      })

      // Save to database - build insert data dynamically
      let insertData: any = {
        name: ticketName,
        description: ticketDescription,
        template_url: base64,
        qr_position: qrPosition,
        ticket_type: ticketType,
        event_id: selectedEventId
      }

      // Only add category if column exists (for backward compatibility)
      // We'll try with category first, then without if it fails
      
      const { data, error } = await supabase
        .from('predefined_tickets')
        .insert(insertData)
        .select()
        .single()

      if (error) {
        console.error('Error details:', error)
        throw error
      }

      setTickets([data, ...tickets])
      setShowUploadForm(false)
      resetForm()
      alert('Ticket template uploaded successfully!')
    } catch (error: any) {
      console.error('Error uploading ticket:', error)
      alert('Failed to upload ticket template: ' + (error.message || 'Unknown error'))
    } finally {
      setUploading(false)
    }
  }

  const resetForm = () => {
    setSelectedFile(null)
    setPreviewUrl('')
    setTicketName('')
    setTicketDescription('')
    setQrPosition({ x: 40, y: 275, size: 50 })
    setTicketType('Bronze')
    setCustomTicketType('')
    setShowAddCustomType(false)
    setPreviewMode(false)
  }

  const deleteTicket = async (id: string) => {
    if (!confirm('Are you sure you want to delete this ticket template?')) return

    try {
      const { error } = await supabase
        .from('predefined_tickets')
        .delete()
        .eq('id', id)

      if (error) throw error
      setTickets(tickets.filter(t => t.id !== id))
    } catch (error) {
      console.error('Error deleting ticket:', error)
      alert('Failed to delete ticket template')
    }
  }

  const updateQrPosition = async (ticketId: string) => {
    try {
      console.log('Updating QR position for ticket:', ticketId)
      console.log('New position:', editQrPosition)
      
      const { data, error } = await supabase
        .from('predefined_tickets')
        .update({ qr_position: editQrPosition })
        .eq('id', ticketId)
        .select()
        .single()

      if (error) throw error
      
      console.log('Updated ticket data:', data)
      
      // Update local state with the returned data to ensure consistency
      setTickets(tickets.map(t => 
        t.id === ticketId ? { ...t, qr_position: data.qr_position } : t
      ))
      setEditingTicketId(null)
      alert(`QR position updated successfully!\nNew position: X=${data.qr_position.x}, Y=${data.qr_position.y}, Size=${data.qr_position.size}`)
    } catch (error: any ) {
      console.error('Error updating QR position:', error)
      alert('Failed to update QR position: ' + error.message)
    }
  }

  const generatePreviewWithQR = async (templateUrl: string, position: typeof qrPosition, ticketData?: any) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''

    // Load template image
    const img = new Image()
    img.src = templateUrl
    await new Promise(resolve => img.onload = resolve)

    canvas.width = img.width
    canvas.height = img.height
    ctx.drawImage(img, 0, 0)

    // Generate simple ticket number for QR code (like your readable example)
    const ticketNumber = ticketData?.ticketNumber || generateTicketNumber(selectedEventId || 'SAMPLE')
    
    // Use simple ticket number as QR content - much more readable!
    const finalQrContent = ticketNumber

    const qrDataUrl = await QRCode.toDataURL(finalQrContent, {
      errorCorrectionLevel: 'M', // Medium - best balance for camera scanning
      width: Math.max(position.size * 4, 400), // Even higher resolution, minimum 400px for camera scanning
      margin: 4, // Larger margin for better camera detection
      scale: 10, // Higher scale for crisp edges
      color: {
        dark: '#000000', // Pure black for better contrast
        light: '#FFFFFF'  // Pure white for better contrast
      }
    })

    // Add white background for QR code
    ctx.fillStyle = 'white'
    ctx.fillRect(position.x - 5, position.y - 5, position.size + 10, position.size + 10)

    // Draw QR code on template
    const qrImg = new Image()
    qrImg.src = qrDataUrl
    await new Promise(resolve => qrImg.onload = resolve)
    
    ctx.drawImage(qrImg, position.x, position.y, position.size, position.size)
    
    // IMPORTANT: Text rendering disabled for server compatibility
    // Servers often lack fonts, causing text to appear as boxes
    // The ticket number is already encoded in the QR code for scanning
    console.log('Ticket generated with number in QR:', ticketNumber)

    return canvas.toDataURL()
  }


  const generateTicketWithTemplate = async (template: PredefinedTicket, customTicketType?: string) => {
    try {
      setGenerating(true)
      console.log('Starting ticket generation with template:', template.name)
      console.log('Template URL type:', typeof template.template_url)
      console.log('Template URL starts with:', template.template_url?.substring(0, 50))
      console.log('QR Position from template:', template.qr_position)
      
      // Use ticket type from template (it was saved when template was created)
      const ticketTypeToUse = template.ticket_type || customTicketType || selectedTicketType || 'General'
      
      // Get event data to fetch category
      const linkedEvent = events.find(e => e.id === (template.event_id || selectedEventId))
      const categoryToUse = linkedEvent?.category || selectedEventCategory || 'General'
      
      console.log('Using ticket type from template:', ticketTypeToUse)
      console.log('Using category from event:', categoryToUse)
      
      // Generate unique ticket number for download
      const ticketNumber = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`
      const attendeeName = `Guest-${ticketNumber}`

      console.log('Generating ticket for:', attendeeName)
      
      // Check if template_url is a blob URL and convert it to base64 if needed
      let templateUrl = template.template_url
      if (templateUrl.startsWith('blob:')) {
        console.log('Converting blob URL to base64...')
        try {
          const response = await fetch(templateUrl)
          const blob = await response.blob()
          const reader = new FileReader()
          templateUrl = await new Promise<string>((resolve) => {
            reader.onloadend = () => resolve(reader.result as string)
            reader.readAsDataURL(blob)
          })
          console.log('Converted to base64, starts with:', templateUrl.substring(0, 50))
        } catch (err) {
          console.error('Failed to convert blob URL to base64:', err)
          // Fallback to using the blob URL directly
        }
      }

      // Call new PDF API to generate ticket with QR
      const response = await fetch('/api/tickets/generate-pdf-simple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId: selectedEventId || template.event_id,
          attendeeName: attendeeName,
          templateUrl: templateUrl,
          qrPos: template.qr_position,
          ticketType: ticketTypeToUse,  // Use from template
          category: categoryToUse        // Use from event
        })
      })

      console.log('API Response status:', response.status)
      
      // If API fails, show error instead of fallback
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to generate ticket' }))
        console.error('API failed:', errorData)
        alert('Failed to generate ticket: ' + (errorData.error || 'Server error'))
        setGenerating(false)
        return
      }
      
      const result = await response.json()
      console.log('API Response data:', result)

      if (result.success && result.ticket) {
        const ticket = result.ticket
        console.log('Ticket generated successfully:', ticket)
        
        // Show success message
        alert(`Ticket generated successfully!\nTicket Number: ${ticket.ticketNumber}\n\nDownloading PDF with QR code...`)
        
        // Check if we need client-side composition and PDF generation
        if (ticket.needsClientComposition && ticket.templateUrl && ticket.qrDataUrl) {
          try {
            // Compose QR on template client-side
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            
            if (ctx) {
              // Load template image
              const templateImg = new Image()
              templateImg.src = ticket.templateUrl
              
              await new Promise((resolve, reject) => {
                templateImg.onload = resolve
                templateImg.onerror = reject
              })
              
              // Set canvas size to match template
              canvas.width = templateImg.width
              canvas.height = templateImg.height
              
              console.log('Template actual dimensions:', templateImg.width, 'x', templateImg.height)
              
              // Draw template
              ctx.drawImage(templateImg, 0, 0)
              
              // Load QR image
              const qrImg = new Image()
              qrImg.src = ticket.qrDataUrl
              
              await new Promise((resolve, reject) => {
                qrImg.onload = resolve
                qrImg.onerror = reject
              })
              
              // Use the exact QR position from ticket response
              const qrPos = ticket.qrPosition || template.qr_position || { x: 50, y: 50, size: 150 }
              console.log('Client-side composition - Using QR Position:', qrPos)
              console.log('Template QR position from predefined:', template.qr_position)
              
              // Draw white background for QR
              ctx.fillStyle = 'white'
              ctx.fillRect(qrPos.x - 5, qrPos.y - 5, qrPos.size + 10, qrPos.size + 10)
              
              // Draw QR at exact position without adjustment
              ctx.drawImage(qrImg, qrPos.x, qrPos.y, qrPos.size, qrPos.size)
              
              console.log('QR drawn at exact position:', qrPos.x, qrPos.y, 'size:', qrPos.size)
              console.log('Ticket number in QR:', ticket.ticketNumber)
              
              // IMPORTANT: Text rendering disabled for server compatibility
              // Server Canvas lacks fonts, causing text to appear as boxes
              // The ticket number is encoded in the QR code which can be scanned
              
              // Convert canvas to base64
              const mergedImageUrl = canvas.toDataURL('image/png')
              
              // Generate PDF with merged image at original size
              const { jsPDF } = await import('jspdf')
              
              // Convert pixels to mm
              const pixelsToMm = (pixels: number) => (pixels * 25.4) / 96
              const pdfWidth = pixelsToMm(canvas.width)
              const pdfHeight = pixelsToMm(canvas.height)
              
              const pdf = new jsPDF({
                orientation: pdfWidth > pdfHeight ? 'landscape' : 'portrait',
                unit: 'mm',
                format: [pdfWidth, pdfHeight]
              })
              
              pdf.addImage(mergedImageUrl, 'PNG', 0, 0, pdfWidth, pdfHeight)
              pdf.save(`ticket-${ticket.ticketNumber}.pdf`)
              console.log('Client-side composition and PDF generated')
            }
          } catch (composeError) {
            console.error('Client-side composition failed:', composeError)
            alert('Failed to generate PDF. Please try again.')
          }
        } else if (ticket.needsClientPDF && ticket.imageUrl) {
          try {
            // Dynamic import of jsPDF for client-side
            const { jsPDF } = await import('jspdf')
            
            // Use dimensions from server or defaults
            const width = ticket.dimensions?.width || 800
            const height = ticket.dimensions?.height || 1200
            
            // Convert pixels to mm
            const pixelsToMm = (pixels: number) => (pixels * 25.4) / 96
            const pdfWidth = pixelsToMm(width)
            const pdfHeight = pixelsToMm(height)
            
            // Create PDF with original image dimensions
            const pdf = new jsPDF({
              orientation: pdfWidth > pdfHeight ? 'landscape' : 'portrait',
              unit: 'mm',
              format: [pdfWidth, pdfHeight]
            })
            
            // Add the image at original size
            pdf.addImage(ticket.imageUrl, 'PNG', 0, 0, pdfWidth, pdfHeight)
            
            // Download the PDF
            pdf.save(`ticket-${ticket.ticketNumber}.pdf`)
            console.log('Client-side PDF generated and downloaded')
          } catch (pdfError) {
            console.error('Client-side PDF generation failed:', pdfError)
            alert('Failed to generate PDF. Please try again.')
          }
        } else if (ticket.pdfData || ticket.pdfUrl) {
          // Server-generated PDF available
          const pdfLink = document.createElement('a')
          pdfLink.href = ticket.pdfData || ticket.pdfUrl
          pdfLink.download = `ticket-${ticket.ticketNumber}.pdf`
          document.body.appendChild(pdfLink)
          pdfLink.click()
          document.body.removeChild(pdfLink)
          console.log('PDF downloaded successfully')
          
          // PDF download completed successfully
        }
        
        // Log the ticket details for verification
        console.log('Generated ticket details:', {
          ticketNumber: ticket.ticketNumber,
          qrData: ticket.qrCode,
          hasPDF: !!ticket.pdfUrl,
          hasImage: !!ticket.imageUrl,
          status: 'Ticket stored in database with QR code'
        })
        setGenerating(false)
      } else {
        console.error('Failed to generate ticket:', result)
        alert('Failed to generate ticket: ' + (result.error || result.message || 'Unknown error'))
        setGenerating(false)
      }
    } catch (error: any) {
      console.error('Error generating ticket:', error)
      alert('Failed to generate ticket: ' + error.message)
      setGenerating(false)
    }
  }

  const generateBulkTickets = async () => {
    if (!bulkTemplate || bulkGenerating) return
    
    const quantity = customQuantity ? parseInt(customQuantity) : bulkQuantity
    if (isNaN(quantity) || quantity < 1) {
      alert('Please enter a valid quantity')
      return
    }
    
    if (quantity > 50) {
      const estimatedTime = Math.ceil(quantity / 20) // Estimate ~20 tickets per second with chunking
      if (!confirm(`Generating ${quantity} tickets will take approximately ${estimatedTime} seconds. Continue?`)) {
        return
      }
    }
    
    setBulkGenerating(true)
    setBulkProgress(0)
    setTicketsCreated(0)
    setBulkProgressMessage('Initializing ticket generation...')
    
    try {
      console.log(`Starting chunked generation of ${quantity} tickets`)
      
      // Use chunked approach for quantities > 50
      if (quantity > 50) {
        const chunkSize = 25 // Process 25 tickets per chunk
        const chunks = Math.ceil(quantity / chunkSize)
        const sessionId = `bulk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const allPdfBuffers: any[] = []
        
        for (let i = 0; i < chunks; i++) {
          const startIndex = i * chunkSize
          const endIndex = Math.min(startIndex + chunkSize, quantity)
          
          setBulkProgress(Math.round((endIndex / quantity) * 100))
          setTicketsCreated(endIndex)
          setBulkProgressMessage(`Creating tickets: ${endIndex} of ${quantity} completed...`)
          console.log(`Processing chunk ${i + 1}/${chunks}: tickets ${startIndex + 1} to ${endIndex}`)
          
          try {
            const chunkResponse = await fetch('/api/tickets/generate-chunk', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                eventId: bulkTemplate.event_id,
                templateUrl: bulkTemplate.template_url,
                qrPosition: bulkTemplate.qr_position,
                startIndex,
                endIndex,
                ticketType: bulkTicketType,
                templateName: bulkTemplate.name,
                namePrefix: bulkNamePrefix || 'Guest',
                sessionId
              })
            })
            
            if (!chunkResponse.ok) {
              console.error(`Chunk ${i + 1} failed`)
              continue
            }
            
            const chunkData = await chunkResponse.json()
            if (chunkData.pdfBuffers) {
              allPdfBuffers.push(...chunkData.pdfBuffers)
            }
            
            // Small delay between chunks to prevent overload
            if (i < chunks - 1) {
              await new Promise(resolve => setTimeout(resolve, 100))
            }
            
          } catch (chunkError) {
            console.error(`Error processing chunk ${i + 1}:`, chunkError)
          }
        }
        
        // Create and download ZIP file from all PDFs
        if (allPdfBuffers.length > 0) {
          setBulkProgress(95)
          setBulkProgressMessage(`Preparing ZIP file with ${allPdfBuffers.length} tickets...`)
          console.log(`Creating ZIP file with ${allPdfBuffers.length} tickets...`)
          
          // Import JSZip dynamically
          const JSZip = (await import('jszip')).default
          const zip = new JSZip()
          const ticketsFolder = zip.folder('tickets')
          
          for (const pdfData of allPdfBuffers) {
            if (ticketsFolder) {
              ticketsFolder.file(pdfData.filename, Buffer.from(pdfData.data, 'base64'))
            }
          }
          
          const zipBlob = await zip.generateAsync({ type: 'blob' })
          
          // Download the ZIP
          const url = window.URL.createObjectURL(zipBlob)
          const link = document.createElement('a')
          link.href = url
          link.download = `bulk-tickets-${sessionId}.zip`
          link.style.display = 'none'
          document.body.appendChild(link)
          link.click()
          
          setTimeout(() => {
            document.body.removeChild(link)
            window.URL.revokeObjectURL(url)
          }, 100)
          
          setBulkProgress(100)
          setBulkProgressMessage(`✅ Successfully generated all ${allPdfBuffers.length} tickets!`)
          alert(`Successfully generated ${allPdfBuffers.length} tickets!\n\nThe ZIP file has been downloaded.`)
        } else {
          throw new Error('No tickets were generated')
        }
        
      } else {
        // Use original endpoint for small quantities
        const response = await fetch('/api/tickets/generate-bulk-stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            eventId: bulkTemplate.event_id,
            templateUrl: bulkTemplate.template_url,
            qrPosition: bulkTemplate.qr_position,
            quantity: quantity,
            ticketType: bulkTicketType,
            category: bulkCategory,
            templateName: bulkTemplate.name,
            batchSize: 10,
            namePrefix: bulkNamePrefix || 'Guest'
          })
        })
        
        if (!response.ok) {
          let errorMessage = 'Failed to generate tickets'
          try {
            const error = await response.json()
            errorMessage = error.error || error.details || errorMessage
          } catch (parseError) {
            errorMessage = `Server error (${response.status})`
          }
          throw new Error(errorMessage)
        }
        
        // Get the counts from headers
        const generatedCount = response.headers.get('X-Generated-Count') || '0'
        const failedCount = response.headers.get('X-Failed-Count') || '0'
        
        console.log(`Generated ${generatedCount} tickets successfully`)
        
        // Handle response for small quantities  
        const contentType = response.headers.get('content-type')
        
        if (contentType && contentType.includes('application/zip')) {
          const blob = await response.blob()
          const url = window.URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = `bulk-tickets-${Date.now()}.zip`
          document.body.appendChild(link)
          link.click()
          setTimeout(() => {
            document.body.removeChild(link)
            window.URL.revokeObjectURL(url)
          }, 100)
          alert(`Successfully generated ${generatedCount} tickets! The ZIP file has been downloaded.`)
        }
      }
      
      setShowBulkModal(false)
      setBulkTemplate(null)
      setCustomQuantity('')
      setBulkQuantity(10)
      setBulkNamePrefix('Guest')
      setBulkProgressMessage('')
      setTicketsCreated(0)
      
    } catch (error: any) {
      console.error('Bulk generation error:', error)
      
      let errorMessage = 'Failed to generate bulk tickets'
      if (error.name === 'AbortError') {
        errorMessage = 'Request timed out. Try generating fewer tickets at once (max 100 recommended).'
      } else if (error.message?.includes('JSON')) {
        errorMessage = 'Server error: Invalid response format. Try generating fewer tickets.'
      } else if (error.message) {
        errorMessage = error.message
      }
      
      alert(errorMessage)
    } finally {
      setBulkGenerating(false)
      setBulkProgress(0)
      // Don't reset progress message immediately so user can see final status
      setTimeout(() => {
        setBulkProgressMessage('')
        setTicketsCreated(0)
      }, 3000)
    }
  }

  const previewTicketWithQR = async (template: PredefinedTicket) => {
    try {
      const previewUrl = await generatePreviewWithQR(
        template.template_url,
        template.qr_position,
        {
          ticketId: 'PREVIEW-001',
          ticketNumber: 'PREVIEW-001',
          eventName: template.name,
          date: new Date().toISOString(),
          venue: 'Preview Venue',
          attendee: 'John Doe',
          status: 'valid',
          verificationCode: 'PREVIEW123'
        }
      )

      // Open preview in new window
      const previewWindow = window.open('', '_blank')
      if (previewWindow) {
        previewWindow.document.write(`
          <html>
            <head>
              <title>Ticket Preview - ${template.name}</title>
              <style>
                body { 
                  margin: 0; 
                  padding: 20px; 
                  background: #f3f4f6;
                  font-family: sans-serif;
                  text-align: center;
                }
                .container {
                  max-width: 800px;
                  margin: 0 auto;
                  background: white;
                  padding: 20px;
                  border-radius: 8px;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
                img { 
                  max-width: 100%; 
                  height: auto;
                  border: 1px solid #ddd;
                  border-radius: 4px;
                }
                h1 { color: #0b6d41; }
                .info {
                  margin: 20px 0;
                  padding: 15px;
                  background: #f9fafb;
                  border-radius: 4px;
                  text-align: left;
                }
                .info p {
                  margin: 5px 0;
                  color: #4b5563;
                }
                .badge {
                  display: inline-block;
                  padding: 4px 8px;
                  background: #10b981;
                  color: white;
                  border-radius: 4px;
                  font-size: 12px;
                  margin-left: 10px;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <h1>Ticket Preview: ${template.name}</h1>
                <img src="${previewUrl}" alt="Ticket Preview" />
                <div class="info">
                  <p><strong>Template:</strong> ${template.name}</p>
                  <p><strong>QR Position:</strong> X: ${template.qr_position.x}px, Y: ${template.qr_position.y}px</p>
                  <p><strong>QR Size:</strong> ${template.qr_position.size}px</p>
                  <p><strong>Status:</strong> <span class="badge">QR Code Readable</span></p>
                </div>
                <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
                  This is a preview. The QR code contains sample data that can be verified by the ticket scanner.
                </p>
              </div>
            </body>
          </html>
        `)
      }
    } catch (error: any) {
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
              <Link href="/admin" className="text-2xl font-bold text-[#0b6d41]">
                Admin
              </Link>
              <div className="h-6 w-px bg-gray-300"></div>
              <h1 className="text-lg font-semibold text-gray-900">Predefined Ticket Templates</h1>
            </div>
            <Link
              href="/admin"
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Admin
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Event Selection for Generation */}
        <div className="mb-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg shadow-sm p-6 border border-blue-200">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Select Event for Ticket Generation
              </label>
              <select
                value={selectedEventId}
                onChange={(e) => {
                  setSelectedEventId(e.target.value)
                  const event = events.find(ev => ev.id === e.target.value)
                  if (event) {
                    setSelectedEventCategory(event.category || '')
                  }
                }}
                className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Choose an event...</option>
                {events.map(event => (
                  <option key={event.id} value={event.id}>
                    {event.title} - {event.venue || 'No venue'} ({new Date(event.start_date || event.date || event.created_at).toLocaleDateString()})
                  </option>
                ))}
              </select>
              {selectedEventId && (
                <div className="mt-2 space-y-1">
                  <p className="text-sm text-green-600 flex items-center">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Tickets will be generated for: {events.find(e => e.id === selectedEventId)?.title}
                  </p>
                  {selectedEventCategory && (
                    <p className="text-sm text-gray-600 flex items-center">
                      <Layers className="h-4 w-4 mr-1" />
                      Category: <span className="font-medium ml-1">{selectedEventCategory}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Event-Template Mapping Header */}
        <div className="mb-8 bg-white rounded-lg shadow-sm p-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Event Ticket Templates</h2>
              <p className="text-gray-600 text-sm mt-1">Manage ticket templates linked to events</p>
            </div>
            <div className="flex gap-3">
              {/* Create Template Button */}
              <button
                onClick={() => setShowUploadForm(!showUploadForm)}
                className="inline-flex items-center px-6 py-3 bg-[#0b6d41] text-white font-medium rounded-lg hover:bg-[#0a5d37] transition-colors shadow-sm"
              >
                {showUploadForm ? (
                  <>
                    <X className="h-5 w-5 mr-2" />
                    Cancel
                  </>
                ) : (
                  <>
                    <Plus className="h-5 w-5 mr-2" />
                    Create Template for Event
                  </>
                )}
              </button>
              
              
              {/* Reset All QR Positions Button */}
              {tickets.length > 0 && (
                <button
                  onClick={async () => {
                    if (confirm(`Update all ${tickets.length} templates to default QR position?\n\nNew Position:\nX: 40, Y: 275, Size: 50`)) {
                      try {
                        const defaultPos = { x: 40, y: 275, size: 50 }
                        let updated = 0
                        
                        for (const ticket of tickets) {
                          const { error } = await supabase
                            .from('predefined_tickets')
                            .update({ qr_position: defaultPos })
                            .eq('id', ticket.id)
                          
                          if (!error) updated++
                        }
                        
                        await loadTickets()
                        alert(`Successfully updated ${updated} templates to default QR position!`)
                      } catch (error: any) {
                        console.error('Error updating templates:', error)
                        alert('Failed to update templates')
                      }
                    }
                  }}
                  className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                >
                  <QrCode className="h-4 w-4 mr-2" />
                  Reset All to Default Position
                </button>
              )}
            </div>
          </div>
          

          {/* Template Statistics */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Total Templates:</span>
                <span className="font-semibold text-gray-900 ml-2">{tickets.length}</span>
              </div>
              <div>
                <span className="text-gray-600">Linked Events:</span>
                <span className="font-semibold text-gray-900 ml-2">
                  {tickets.filter(t => t.event_id).length}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Template Types:</span>
                <div className="inline-flex gap-2 ml-2">
                  <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs">
                    {tickets.filter(t => t.ticket_type === 'Gold').length} Gold
                  </span>
                  <span className="px-2 py-0.5 bg-gray-100 text-gray-800 rounded text-xs">
                    {tickets.filter(t => t.ticket_type === 'Silver').length} Silver
                  </span>
                  <span className="px-2 py-0.5 bg-orange-100 text-orange-800 rounded text-xs">
                    {tickets.filter(t => t.ticket_type === 'Bronze').length} Bronze
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Database Error Alert */}
        {dbError && (
          <div className="mb-8 bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Database Setup Required</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{dbError}</p>
                  <div className="mt-4">
                    <p className="font-semibold">To fix this issue:</p>
                    <ol className="list-decimal list-inside mt-2 space-y-1">
                      <li>Go to your Supabase Dashboard</li>
                      <li>Navigate to the SQL Editor</li>
                      <li>Open and run the file: <code className="bg-red-100 px-1 py-0.5 rounded">supabase/SETUP-PREDEFINED-TICKETS.sql</code></li>
                      <li>Refresh this page after running the script</li>
                    </ol>
                  </div>
                </div>
                <div className="mt-4">
                  <button
                    onClick={() => {
                      setDbError(null)
                      loadTickets()
                    }}
                    className="text-sm bg-red-100 hover:bg-red-200 text-red-800 font-medium px-3 py-1 rounded"
                  >
                    Retry Loading
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Template Section */}
        {showUploadForm && (
          <div className="mb-8 bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold mb-4">Create Event Ticket Template</h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              {/* Upload Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Link to Event *
                  </label>
                  <select
                    value={selectedEventId}
                    onChange={(e) => {
                  setSelectedEventId(e.target.value)
                  const event = events.find(ev => ev.id === e.target.value)
                  if (event) {
                    setSelectedEventCategory(event.category || '')
                  }
                }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                    required
                  >
                    <option value="">Select event to link template...</option>
                    {events.length === 0 ? (
                      <option value="" disabled>No events available - Please create an event first</option>
                    ) : (
                      events.map((event) => (
                        <option key={event.id} value={event.id}>
                          {event.title} - {event.venue || 'No venue'} ({new Date(event.start_date || event.date || event.created_at).toLocaleDateString()})
                        </option>
                      ))
                    )}
                  </select>
                  {events.length === 0 ? (
                    <p className="text-xs text-red-500 mt-1">
                      No events found. <Link href="/events/create" className="underline">Create an event first</Link> to link templates.
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500 mt-1">
                      This template will be automatically used when generating tickets for this event
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    value={ticketName}
                    onChange={(e) => setTicketName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                    placeholder="e.g., VIP Concert Ticket"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={ticketDescription}
                    onChange={(e) => setTicketDescription(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                    rows={3}
                    placeholder="Template description..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ticket Type *
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={ticketType}
                      onChange={(e) => setTicketType(e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                    >
                      <option value="Gold">Gold</option>
                      <option value="Silver">Silver</option>
                      <option value="Bronze">Bronze</option>
                      {customTicketTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowAddCustomType(!showAddCustomType)}
                      className="px-3 py-2 bg-[#0b6d41] text-white rounded-lg hover:bg-[#0a5835]"
                      title="Add custom type"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  {showAddCustomType && (
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={customTicketType}
                        onChange={(e) => setCustomTicketType(e.target.value)}
                        placeholder="Enter custom ticket type..."
                        className="flex-1 px-3 py-1 border border-gray-300 rounded"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (customTicketType && !customTicketTypes.includes(customTicketType)) {
                            setCustomTicketTypes([...customTicketTypes, customTicketType])
                            setTicketType(customTicketType)
                            setCustomTicketType('')
                            setShowAddCustomType(false)
                          }
                        }}
                        className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        Add
                      </button>
                    </div>
                  )}
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
                    <p className="text-xs text-gray-500 mb-2">
                      Template size: 1200x900px | Y=275 is positioned as per your requirement
                    </p>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs text-gray-600">X Position (px)</label>
                        <input
                          type="number"
                          value={qrPosition.x}
                          onChange={(e) => {
                            const value = parseInt(e.target.value)
                            setQrPosition({...qrPosition, x: isNaN(value) ? 0 : value})
                          }}
                          min="0"
                          className="w-full px-3 py-1 border border-gray-300 rounded"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Y Position (px)</label>
                        <input
                          type="number"
                          value={qrPosition.y}
                          onChange={(e) => {
                            const value = parseInt(e.target.value)
                            setQrPosition({...qrPosition, y: isNaN(value) ? 0 : value})
                          }}
                          min="0"
                          className="w-full px-3 py-1 border border-gray-300 rounded"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Size (px)</label>
                        <input
                          type="number"
                          value={qrPosition.size}
                          onChange={(e) => {
                            const value = parseInt(e.target.value)
                            setQrPosition({...qrPosition, size: isNaN(value) ? 100 : Math.max(50, value)})
                          }}
                          min="50"
                          className="w-full px-3 py-1 border border-gray-300 rounded"
                        />
                      </div>
                    </div>
                    
                    {/* Generate with QR Button - Right after QR settings */}
                    <button
                      type="button"
                      onClick={async () => {
                        if (!selectedEventId) {
                          alert('Please select an event first')
                          return
                        }
                        // Convert blob URL to base64 if needed
                        let templateUrlToUse = previewUrl
                        if (previewUrl.startsWith('blob:')) {
                          console.log('Converting preview blob to base64...')
                          try {
                            const response = await fetch(previewUrl)
                            const blob = await response.blob()
                            const reader = new FileReader()
                            templateUrlToUse = await new Promise<string>((resolve) => {
                              reader.onloadend = () => resolve(reader.result as string)
                              reader.readAsDataURL(blob)
                            })
                            console.log('Preview converted to base64')
                          } catch (err) {
                            console.error('Failed to convert preview blob to base64:', err)
                          }
                        }
                        
                        // Create temporary template object with current preview QR position
                        const tempTemplate = {
                          id: 'temp-' + Date.now(),
                          name: ticketName || 'Temporary Template',
                          description: ticketDescription,
                          template_url: templateUrlToUse,
                          qr_position: qrPosition, // Uses current position from preview adjustments
                          ticket_type: ticketType,
                          created_at: new Date().toISOString(),
                          event_id: selectedEventId
                        }
                        console.log('Generating with preview QR position:', qrPosition)
                        // Generate ticket with this template
                        await generateTicketWithTemplate(tempTemplate)
                      }}
                      className="mt-4 w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
                      disabled={!selectedEventId}
                    >
                      <QrCode className="h-5 w-5 mr-2" />
                      Generate PDF with QR at ({qrPosition.x}, {qrPosition.y})
                    </button>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleUpload}
                    disabled={uploading || !selectedFile || !ticketName || !selectedEventId}
                    className="flex-1 bg-[#0b6d41] text-white py-2 rounded-lg hover:bg-[#0a5d37] disabled:opacity-50"
                  >
                    {uploading ? 'Creating...' : 'Create & Link Template'}
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
                  <h3 className="font-medium text-gray-900 mb-3">Preview with QR Code</h3>
                  <div className="relative bg-white rounded-lg shadow-sm p-4">
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

        {/* Templates Grid - Organized by Event */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tickets.map((ticket) => {
            const linkedEvent = events.find(e => e.id === ticket.event_id)
            return (
              <div 
                key={ticket.id} 
                className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-lg transition-shadow"
              >
                {/* Event Badge */}
                {linkedEvent && (
                  <div className="bg-gradient-to-r from-[#0b6d41] to-[#0a5d37] text-white px-4 py-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span className="text-sm font-medium">{linkedEvent.title}</span>
                      </div>
                      <span className="text-xs opacity-90">
                        {new Date(linkedEvent.start_date || linkedEvent.date || linkedEvent.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                )}
                
                <div className="aspect-[3/2] relative bg-gray-100">
                  <img 
                    src={ticket.template_url} 
                    alt={ticket.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                  <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                    <h3 className="font-semibold text-lg">{ticket.name}</h3>
                    {ticket.description && (
                      <p className="text-sm opacity-90 mt-1">{ticket.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${
                        ticket.ticket_type === 'Gold' ? 'bg-yellow-500 text-yellow-900' :
                        ticket.ticket_type === 'Silver' ? 'bg-gray-300 text-gray-900' :
                        ticket.ticket_type === 'Bronze' ? 'bg-orange-600 text-orange-100' :
                        ticket.ticket_type === 'VIP' ? 'bg-purple-600 text-white' :
                        ticket.ticket_type === 'Premium' ? 'bg-indigo-600 text-white' :
                        ticket.ticket_type === 'Early Bird' ? 'bg-green-600 text-white' :
                        ticket.ticket_type === 'Student' ? 'bg-blue-600 text-white' :
                        'bg-gray-600 text-white'
                      }`}>
                        {ticket.ticket_type}
                      </span>
                      {linkedEvent?.category && (
                        <span className="inline-block px-2 py-1 text-xs bg-[#0b6d41]/10 text-[#0b6d41] font-medium rounded-full">
                          {linkedEvent.category}
                        </span>
                      )}
                      {!linkedEvent && (
                        <span className="inline-block px-2 py-1 text-xs bg-red-500 text-white rounded-full">
                          No Event Linked
                        </span>
                      )}
                    </div>
                  </div>
              </div>
              
                <div className="p-4">
                  {linkedEvent ? (
                    <div className="text-sm text-gray-600 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Venue:</span>
                        <span>{linkedEvent.venue}</span>
                      </div>
                      {editingTicketId === ticket.id ? (
                        <div className="mt-2 p-2 bg-gray-50 rounded">
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <label className="text-xs">X:</label>
                              <input
                                type="number"
                                value={editQrPosition.x}
                                onChange={(e) => setEditQrPosition({...editQrPosition, x: parseInt(e.target.value) || 0})}
                                className="w-full px-1 py-1 text-sm border rounded"
                              />
                            </div>
                            <div>
                              <label className="text-xs">Y:</label>
                              <input
                                type="number"
                                value={editQrPosition.y}
                                onChange={(e) => setEditQrPosition({...editQrPosition, y: parseInt(e.target.value) || 0})}
                                className="w-full px-1 py-1 text-sm border rounded"
                              />
                            </div>
                            <div>
                              <label className="text-xs">Size:</label>
                              <input
                                type="number"
                                value={editQrPosition.size}
                                onChange={(e) => setEditQrPosition({...editQrPosition, size: Math.max(50, parseInt(e.target.value) || 100)})}
                                className="w-full px-1 py-1 text-sm border rounded"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => updateQrPosition(ticket.id)}
                              className="flex-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingTicketId(null)}
                              className="flex-1 px-2 py-1 text-xs bg-gray-400 text-white rounded hover:bg-gray-500"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between mt-1">
                          <span>QR: ({ticket.qr_position.x}, {ticket.qr_position.y})</span>
                          <div className="flex items-center gap-2">
                            <span>Size: {ticket.qr_position.size}px</span>
                            <button
                              onClick={() => {
                                setEditingTicketId(ticket.id)
                                setEditQrPosition(ticket.qr_position)
                              }}
                              className="text-xs text-blue-600 hover:text-blue-800"
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    editingTicketId === ticket.id ? (
                      <div className="mt-2 p-2 bg-gray-50 rounded mb-3">
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="text-xs">X:</label>
                            <input
                              type="number"
                              value={editQrPosition.x}
                              onChange={(e) => setEditQrPosition({...editQrPosition, x: parseInt(e.target.value) || 0})}
                              className="w-full px-1 py-1 text-sm border rounded"
                            />
                          </div>
                          <div>
                            <label className="text-xs">Y:</label>
                            <input
                              type="number"
                              value={editQrPosition.y}
                              onChange={(e) => setEditQrPosition({...editQrPosition, y: parseInt(e.target.value) || 0})}
                              className="w-full px-1 py-1 text-sm border rounded"
                            />
                          </div>
                          <div>
                            <label className="text-xs">Size:</label>
                            <input
                              type="number"
                              value={editQrPosition.size}
                              onChange={(e) => setEditQrPosition({...editQrPosition, size: Math.max(50, parseInt(e.target.value) || 100)})}
                              className="w-full px-1 py-1 text-sm border rounded"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => updateQrPosition(ticket.id)}
                            className="flex-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingTicketId(null)}
                            className="flex-1 px-2 py-1 text-xs bg-gray-400 text-white rounded hover:bg-gray-500"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                        <span>QR: ({ticket.qr_position.x}, {ticket.qr_position.y})</span>
                        <div className="flex items-center gap-2">
                          <span>Size: {ticket.qr_position.size}px</span>
                          <button
                            onClick={() => {
                              setEditingTicketId(ticket.id)
                              setEditQrPosition(ticket.qr_position)
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            Edit
                          </button>
                        </div>
                      </div>
                    )
                  )}
                  
                  <div className="space-y-2">
                    {/* Generate Buttons - Only show if event is linked */}
                    {linkedEvent ? (
                      <>
                        {/* Ticket Type and Category Selection */}
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs font-medium text-gray-600">Ticket Type</label>
                              <select
                                value={selectedTicketType}
                                onChange={(e) => setSelectedTicketType(e.target.value as any)}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#0b6d41]"
                              >
                                <option value="General">General</option>
                                <option value="Gold">Gold</option>
                                <option value="Silver">Silver</option>
                                <option value="Bronze">Bronze</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-600">Category</label>
                              <select
                                value={ticketCategory}
                                onChange={(e) => setTicketCategory(e.target.value)}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#0b6d41]"
                              >
                                <option value="predefined">Predefined</option>
                                <option value="vip">VIP</option>
                                <option value="early-bird">Early Bird</option>
                                <option value="standard">Standard</option>
                                <option value="group">Group</option>
                              </select>
                            </div>
                          </div>
                          <button
                            onClick={() => generateTicketWithTemplate(ticket)}
                            className="w-full inline-flex items-center justify-center px-4 py-3 bg-[#0b6d41] text-white font-medium rounded-lg hover:bg-[#0a5d37] transition-colors shadow-sm"
                          >
                            <Ticket className="h-5 w-5 mr-2" />
                            Generate {ticket.ticket_type} Ticket
                          </button>
                        </div>
                        
                        {/* Bulk Generate Button */}
                        <button
                          onClick={() => {
                            setBulkTemplate(ticket)
                            setShowBulkModal(true)
                            setBulkQuantity(10)
                            setCustomQuantity('')
                            setBulkNamePrefix(ticket.ticket_type === 'Gold' ? 'VIP' : 'Guest')
                          }}
                          className="w-full inline-flex items-center justify-center px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-sm"
                        >
                          <Package className="h-4 w-4 mr-2" />
                          Bulk Generate (10, 50, 100+)
                        </button>
                      </>
                    ) : (
                      <button
                        disabled
                        className="w-full inline-flex items-center justify-center px-4 py-3 bg-gray-300 text-gray-500 font-medium rounded-lg cursor-not-allowed"
                      >
                        <Ticket className="h-5 w-5 mr-2" />
                        Link Event to Generate
                      </button>
                    )}
                  
                  {/* Secondary Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedTicket(ticket)
                        previewTicketWithQR(ticket)
                      }}
                      className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Preview
                    </button>
                    <button
                      onClick={() => deleteTicket(ticket.id)}
                      className="inline-flex items-center justify-center px-3 py-2 border border-red-300 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
              </div>
            )
          })}
        </div>

        {/* Bulk Generation Modal */}
        {showBulkModal && bulkTemplate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900">Bulk Generate Tickets</h2>
                <button
                  onClick={() => {
                    setShowBulkModal(false)
                    setBulkTemplate(null)
                    setCustomQuantity('')
                  }}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
              
              <div className="space-y-4">
                {/* Template Info */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm text-gray-600">Template:</p>
                  <p className="font-medium text-gray-900">{bulkTemplate.name}</p>
                  {events.find(e => e.id === bulkTemplate.event_id) && (
                    <p className="text-sm text-gray-500 mt-1">
                      Event: {events.find(e => e.id === bulkTemplate.event_id)?.title}
                    </p>
                  )}
                </div>
                
                {/* Ticket Type and Category for Bulk */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Ticket Type
                    </label>
                    <select
                      value={bulkTicketType}
                      onChange={(e) => setBulkTicketType(e.target.value as any)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                    >
                      <option value="General">General</option>
                      <option value="Gold">Gold</option>
                      <option value="Silver">Silver</option>
                      <option value="Bronze">Bronze</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category
                    </label>
                    <select
                      value={bulkCategory}
                      onChange={(e) => setBulkCategory(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                    >
                      <option value="predefined">Predefined</option>
                      <option value="vip">VIP</option>
                      <option value="early-bird">Early Bird</option>
                      <option value="standard">Standard</option>
                      <option value="group">Group</option>
                    </select>
                  </div>
                </div>
                
                {/* Name Prefix */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Attendee Name Prefix
                  </label>
                  <input
                    type="text"
                    value={bulkNamePrefix}
                    onChange={(e) => setBulkNamePrefix(e.target.value)}
                    placeholder="e.g., Guest, Attendee, VIP"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Names will be: {bulkNamePrefix}-0001, {bulkNamePrefix}-0002, etc.
                  </p>
                </div>
                
                {/* Quantity Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Quantity
                  </label>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <button
                      onClick={() => {
                        setBulkQuantity(10)
                        setCustomQuantity('')
                      }}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        bulkQuantity === 10 && !customQuantity
                          ? 'bg-[#0b6d41] text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      10
                    </button>
                    <button
                      onClick={() => {
                        setBulkQuantity(50)
                        setCustomQuantity('')
                      }}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        bulkQuantity === 50 && !customQuantity
                          ? 'bg-[#0b6d41] text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      50
                    </button>
                    <button
                      onClick={() => {
                        setBulkQuantity(100)
                        setCustomQuantity('')
                      }}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        bulkQuantity === 100 && !customQuantity
                          ? 'bg-[#0b6d41] text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      100
                    </button>
                  </div>
                  
                  <div className="relative">
                    <input
                      type="number"
                      value={customQuantity}
                      onChange={(e) => setCustomQuantity(e.target.value)}
                      placeholder="Enter custom quantity (max 500 per batch)"
                      min="1"
                      max="500"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0b6d41]"
                    />
                    {customQuantity && parseInt(customQuantity) > 500 && (
                      <p className="text-xs text-red-500 mt-1">
                        <AlertCircle className="inline h-3 w-3 mr-1" />
                        Maximum 500 tickets per batch. For larger quantities, generate multiple batches.
                      </p>
                    )}
                  </div>
                </div>
                
                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div className="text-sm text-blue-800">
                      <p className="font-medium mb-1">Bulk Generation Info:</p>
                      <ul className="list-disc list-inside space-y-1 text-xs">
                        <li>Each ticket will have a unique QR code</li>
                        <li>All tickets will be saved to database</li>
                        <li>Downloads as a ZIP file with all tickets</li>
                        <li>Large quantities may take a few minutes</li>
                      </ul>
                    </div>
                  </div>
                </div>
                
                {/* Progress Bar */}
                {bulkGenerating && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Generating tickets...</span>
                      <span className="text-gray-900 font-medium">
                        {bulkProgress > 0 ? `${bulkProgress}%` : 'Processing...'}
                      </span>
                    </div>
                    
                    {/* Progress Message */}
                    {bulkProgressMessage && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-5 w-5 text-green-600 animate-pulse" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-green-800">
                              {bulkProgressMessage}
                            </p>
                            {ticketsCreated > 0 && (
                              <p className="text-xs text-green-600 mt-1">
                                {ticketsCreated} tickets created • 
                                {ticketsCreated > 0 && ticketsCreated % 50 === 0 && ' Milestone reached! 🎉'}
                                {ticketsCreated > 0 && ticketsCreated % 100 === 0 && ' Century completed! 🎯'}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-[#0b6d41] h-2 rounded-full transition-all duration-300"
                        style={{ width: bulkProgress > 0 ? `${bulkProgress}%` : '100%' }}
                      >
                        {bulkProgress === 0 && (
                          <div className="h-full bg-gradient-to-r from-[#0b6d41] to-[#0a5d37] rounded-full animate-pulse" />
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => {
                      setShowBulkModal(false)
                      setBulkTemplate(null)
                      setCustomQuantity('')
                    }}
                    disabled={bulkGenerating}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={generateBulkTickets}
                    disabled={bulkGenerating || (customQuantity && parseInt(customQuantity) > 500)}
                    className="flex-1 px-4 py-2 bg-[#0b6d41] text-white rounded-lg hover:bg-[#0a5d37] disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {bulkGenerating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Package className="h-4 w-4" />
                        Generate {customQuantity || bulkQuantity} Tickets
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {tickets.length === 0 && !showUploadForm && (
          <div className="text-center py-12 bg-white rounded-lg shadow-sm">
            <ImageIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No ticket templates yet</h3>
            <p className="text-gray-500 mb-6">Upload your first predefined ticket template or use a sample</p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => setShowUploadForm(true)}
                className="inline-flex items-center px-6 py-3 bg-[#0b6d41] text-white rounded-lg hover:bg-[#0a5d37] transition-colors"
              >
                <Plus className="h-5 w-5 mr-2" />
                Upload Template
              </button>
              
              {/* Generate Sample Ticket Button */}
              <button
                onClick={async () => {
                  // Generate a sample ticket without template
                  const attendeeName = prompt('Enter attendee name for sample ticket:')
                  if (!attendeeName) return
                  
                  alert(`Sample ticket generation for ${attendeeName}.\n\nNote: Please upload a template first for actual ticket generation with QR codes.`)
                }}
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Ticket className="h-5 w-5 mr-2" />
                Generate Sample Ticket
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}