import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'
import { parse } from 'papaparse'

interface EventRow {
  title: string
  description: string
  date: string
  time: string
  venue: string
  location: string
  category: string
  price: string | number
  max_attendees: string | number
  status?: string
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is organizer or admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || (profile.role !== 'organizer' && profile.role !== 'admin')) {
      return NextResponse.json(
        { error: 'Only organizers and admins can bulk upload events' },
        { status: 403 }
      )
    }

    // Get file from form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Read file content
    const buffer = await file.arrayBuffer()
    const data = new Uint8Array(buffer)
    
    let events: EventRow[] = []
    
    // Parse based on file type
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      // Parse Excel file
      const workbook = XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      events = XLSX.utils.sheet_to_json<EventRow>(worksheet)
    } else if (file.name.endsWith('.csv')) {
      // Parse CSV file
      const text = new TextDecoder().decode(data)
      const result = parse<EventRow>(text, {
        header: true,
        skipEmptyLines: true
      })
      
      if (result.errors.length > 0) {
        return NextResponse.json(
          { 
            error: 'CSV parsing errors', 
            details: result.errors 
          },
          { status: 400 }
        )
      }
      
      events = result.data
    } else {
      return NextResponse.json(
        { error: 'Invalid file format. Please upload Excel (.xlsx, .xls) or CSV (.csv) file' },
        { status: 400 }
      )
    }

    // Validate and prepare events
    const validationErrors: string[] = []
    const eventsToInsert = []
    const skippedRows: { row: number; reason: string }[] = []
    
    for (let i = 0; i < events.length; i++) {
      const row = events[i]
      const rowNum = i + 2 // Account for header row
      const rowErrors: string[] = []
      
      // Validate required fields
      if (!row.title) {
        rowErrors.push('Title is required')
      }
      if (!row.date) {
        rowErrors.push('Date is required')
      }
      if (!row.time) {
        rowErrors.push('Time is required')
      }
      if (!row.venue) {
        rowErrors.push('Venue is required')
      }
      if (!row.location) {
        rowErrors.push('Location is required')
      }
      
      // Skip row if validation errors
      if (rowErrors.length > 0) {
        const errorMessage = `Row ${rowNum}: ${rowErrors.join(', ')}`
        validationErrors.push(errorMessage)
        skippedRows.push({ row: rowNum, reason: rowErrors.join(', ') })
        continue
      }
      
      // Parse and validate date
      const eventDate = new Date(row.date)
      if (isNaN(eventDate.getTime())) {
        validationErrors.push(`Row ${rowNum}: Invalid date format`)
        continue
      }
      
      // Prepare event object
      eventsToInsert.push({
        title: row.title.trim(),
        description: row.description?.trim() || '',
        date: eventDate.toISOString().split('T')[0],
        time: row.time.trim(),
        venue: row.venue.trim(),
        location: row.location.trim(),
        category: row.category?.trim() || 'Other',
        price: parseFloat(String(row.price)) || 0,
        max_attendees: parseInt(String(row.max_attendees)) || 100,
        status: row.status?.trim() || 'draft',
        organizer_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    }
    
    // Return validation errors if any
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { 
          error: 'Validation errors found',
          validationErrors,
          validRows: eventsToInsert.length
        },
        { status: 400 }
      )
    }
    
    // No events to insert
    if (eventsToInsert.length === 0) {
      return NextResponse.json(
        { error: 'No valid events found in the file' },
        { status: 400 }
      )
    }
    
    // Insert events individually to get detailed error info
    const results = []
    const failedEvents: { event: any; error: string; row?: number }[] = []
    
    console.log(`Attempting to insert ${eventsToInsert.length} events...`)
    
    for (let i = 0; i < eventsToInsert.length; i++) {
      const event = eventsToInsert[i]
      
      try {
        // Try to insert individual event
        const { data: insertedEvent, error: insertError } = await supabase
          .from('events')
          .insert(event)
          .select()
          .single()
        
        if (insertError) {
          console.error(`Failed to insert event "${event.title}":`, insertError)
          failedEvents.push({
            event: { title: event.title, date: event.date, venue: event.venue },
            error: insertError.message || 'Unknown database error',
            row: i + 2
          })
        } else if (insertedEvent) {
          results.push(insertedEvent)
        }
      } catch (error) {
        console.error(`Unexpected error inserting event "${event.title}":`, error)
        failedEvents.push({
          event: { title: event.title, date: event.date, venue: event.venue },
          error: error instanceof Error ? error.message : 'Unexpected error',
          row: i + 2
        })
      }
    }
    
    // Return detailed results
    if (failedEvents.length > 0 && results.length > 0) {
      return NextResponse.json({
        success: 'partial',
        message: `Successfully uploaded ${results.length} out of ${eventsToInsert.length} events`,
        successCount: results.length,
        failureCount: failedEvents.length,
        skippedCount: skippedRows.length,
        failedEvents,
        skippedRows,
        uploadedEvents: results
      }, { status: 207 }) // Multi-status
    } else if (failedEvents.length > 0 && results.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'All events failed to upload',
        failureCount: failedEvents.length,
        skippedCount: skippedRows.length,
        failedEvents,
        skippedRows,
        validationErrors
      }, { status: 400 })
    }
    
    return NextResponse.json({
      success: true,
      message: `Successfully uploaded ${results.length} events`,
      count: results.length,
      events: results
    })
    
  } catch (error) {
    console.error('Bulk upload error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to process bulk upload',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Endpoint to download template
export async function GET() {
  try {
    // Create a sample Excel template
    const template = [
      {
        title: 'Event Title',
        description: 'Event Description',
        date: '2024-12-25',
        time: '18:00',
        venue: 'Venue Name',
        location: 'Full Address',
        category: 'Technology',
        price: 100,
        max_attendees: 200,
        status: 'draft'
      },
      {
        title: 'Sample Tech Conference',
        description: 'Annual technology conference',
        date: '2024-12-15',
        time: '09:00',
        venue: 'Convention Center',
        location: '123 Main St, City',
        category: 'Technology',
        price: 299,
        max_attendees: 500,
        status: 'published'
      }
    ]
    
    // Create workbook
    const ws = XLSX.utils.json_to_sheet(template)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Events')
    
    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    
    // Return as downloadable file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="bulk-events-template.xlsx"'
      }
    })
  } catch (error) {
    console.error('Template download error:', error)
    return NextResponse.json(
      { error: 'Failed to generate template' },
      { status: 500 }
    )
  }
}