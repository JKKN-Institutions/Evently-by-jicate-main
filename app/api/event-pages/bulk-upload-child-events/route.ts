import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'
import { parse } from 'papaparse'

interface ChildEventRow {
  title?: string
  description?: string
  date?: string
  time?: string
  venue?: string
  location?: string
  category?: string
  price?: string | number
  max_attendees?: string | number
  // Alternative column names
  'Event name'?: string
  'Event Name'?: string
  'Title'?: string
  'Date'?: string
  'Time'?: string
  'Venue'?: string
  'Venue name'?: string
  'Location'?: string
  'Category'?: string
  'Price'?: string | number
  'Maximum Attendees'?: string | number
  'Max Attendees'?: string | number
  'Description'?: string
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

    // Check if user is admin or has page controller permission
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

    // Get file and event_page_id from form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const eventPageId = formData.get('event_page_id') as string
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    if (!eventPageId) {
      return NextResponse.json(
        { error: 'No event page ID provided' },
        { status: 400 }
      )
    }

    // Verify event page exists and user has permission
    const { data: eventPage, error: pageError } = await supabase
      .from('event_pages')
      .select('id, title')
      .eq('id', eventPageId)
      .single()

    if (pageError || !eventPage) {
      return NextResponse.json(
        { error: 'Event page not found' },
        { status: 404 }
      )
    }

    // Read file content
    const buffer = await file.arrayBuffer()
    const data = new Uint8Array(buffer)
    
    let events: ChildEventRow[] = []
    
    // Parse based on file type
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      // Parse Excel file
      const workbook = XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      events = XLSX.utils.sheet_to_json<ChildEventRow>(worksheet)
    } else if (file.name.endsWith('.csv')) {
      // Parse CSV file
      const text = new TextDecoder().decode(data)
      console.log('CSV content preview:', text.substring(0, 500))
      
      const result = parse<ChildEventRow>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim() // Trim whitespace from headers
      })
      
      if (result.errors.length > 0) {
        console.error('CSV parsing errors:', result.errors)
        return NextResponse.json(
          { 
            error: 'CSV parsing errors', 
            details: result.errors 
          },
          { status: 400 }
        )
      }
      
      console.log(`Parsed ${result.data.length} rows from CSV`)
      console.log('First row:', result.data[0])
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
      
      // Normalize column names (handle various formats)
      const title = row.title || row['Event name'] || row['Event Name'] || row['Title'] || ''
      const date = row.date || row['Date'] || ''
      const time = row.time || row['Time'] || ''
      const venue = row.venue || row['Venue'] || row['Venue name'] || ''
      const description = row.description || row['Description'] || ''
      const location = row.location || row['Location'] || ''
      const category = row.category || row['Category'] || ''
      const price = row.price || row['Price'] || 0
      const maxAttendees = row.max_attendees || row['Maximum Attendees'] || row['Max Attendees'] || 100
      
      // Validate required fields
      if (!title || !title.trim()) {
        rowErrors.push('Title is required')
      }
      if (!date || !date.toString().trim()) {
        rowErrors.push('Date is required')
      }
      // Time is now optional - no validation needed
      if (!venue || !venue.trim()) {
        rowErrors.push('Venue is required')
      }
      
      // Skip row if validation errors
      if (rowErrors.length > 0) {
        const errorMessage = `Row ${rowNum}: ${rowErrors.join(', ')}`
        validationErrors.push(errorMessage)
        skippedRows.push({ row: rowNum, reason: rowErrors.join(', ') })
        continue
      }
      
      // Parse and validate date
      let eventDate: Date
      
      // Try various date formats
      const dateStr = date.toString().trim()
      
      // Handle different date formats (DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD)
      if (dateStr.includes('/')) {
        const parts = dateStr.split('/')
        if (parts.length === 3) {
          // Try DD/MM/YYYY first
          eventDate = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`)
          if (isNaN(eventDate.getTime())) {
            // Try MM/DD/YYYY
            eventDate = new Date(`${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`)
          }
        } else {
          eventDate = new Date(dateStr)
        }
      } else {
        eventDate = new Date(dateStr)
      }
      
      if (isNaN(eventDate.getTime())) {
        validationErrors.push(`Row ${rowNum}: Invalid date format: ${dateStr}`)
        skippedRows.push({ row: rowNum, reason: `Invalid date format: ${dateStr}` })
        continue
      }
      
      // Format time properly (handle HH:MM format) - time is optional
      let formattedTime: string | null = null
      if (time && time.toString().trim()) {
        formattedTime = time.toString().trim()
        if (formattedTime && !formattedTime.includes(':')) {
          // If time is just a number like "1000", convert to "10:00"
          if (formattedTime.length === 4) {
            formattedTime = `${formattedTime.substring(0, 2)}:${formattedTime.substring(2)}`
          } else if (formattedTime.length === 3) {
            formattedTime = `0${formattedTime.substring(0, 1)}:${formattedTime.substring(1)}`
          }
        }
      }
      
      // Prepare event object for insertion
      eventsToInsert.push({
        title: title.trim(),
        description: description?.trim() || '',
        start_date: eventDate.toISOString().split('T')[0], // Use start_date for event pages
        time: formattedTime || '00:00', // Default to '00:00' if no time specified (temporary fix until DB constraint is removed)
        venue: venue.trim(),
        location: location?.trim() || '',
        category: category?.trim() || 'Other',
        price: parseFloat(String(price)) || 0,
        max_attendees: parseInt(String(maxAttendees)) || 100,
        status: 'published',
        organizer_id: user.id,
        event_page_id: eventPageId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
    }
    
    // No events to insert
    if (eventsToInsert.length === 0) {
      return NextResponse.json(
        { 
          error: 'No valid events found in the file',
          validationErrors,
          skippedRows
        },
        { status: 400 }
      )
    }
    
    // Insert events individually to get detailed error info
    const results = []
    const failedEvents: { event: any; error: string; row?: number }[] = []
    
    console.log(`Attempting to insert ${eventsToInsert.length} child events for page ${eventPageId}...`)
    
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
            event: { title: event.title, date: event.start_date, venue: event.venue },
            error: insertError.message || 'Unknown database error',
            row: i + 2
          })
        } else if (insertedEvent) {
          results.push(insertedEvent)
        }
      } catch (error) {
        console.error(`Unexpected error inserting event "${event.title}":`, error)
        failedEvents.push({
          event: { title: event.title, date: event.start_date, venue: event.venue },
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
      message: `Successfully uploaded ${results.length} child events to "${eventPage.title}"`,
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
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const eventPageId = searchParams.get('event_page_id')
    
    // Create a sample Excel template
    const template = [
      {
        title: 'Opening Ceremony',
        description: 'Grand opening of the festival',
        date: '2024-12-25',
        time: '10:00',
        venue: 'Main Stage',
        location: 'Central Plaza',
        category: 'Ceremony',
        price: 0,
        max_attendees: 500
      },
      {
        title: 'Music Concert',
        description: 'Live music performances',
        date: '2024-12-25',
        time: '18:00',
        venue: 'Concert Hall',
        location: 'North Wing',
        category: 'Music',
        price: 100,
        max_attendees: 200
      }
    ]
    
    // Create workbook
    const ws = XLSX.utils.json_to_sheet(template)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Child Events')
    
    // Add instructions sheet
    const instructions = [
      { Field: 'title', Required: 'Yes', Description: 'Name of the event', Example: 'Opening Ceremony' },
      { Field: 'description', Required: 'No', Description: 'Event description', Example: 'Grand opening event' },
      { Field: 'date', Required: 'Yes', Description: 'Event date (YYYY-MM-DD or DD/MM/YYYY)', Example: '2024-12-25' },
      { Field: 'time', Required: 'No', Description: 'Event time (HH:MM) - Optional, leave empty if not specified', Example: '18:00 or leave empty' },
      { Field: 'venue', Required: 'Yes', Description: 'Venue name', Example: 'Main Stage' },
      { Field: 'location', Required: 'No', Description: 'Full address', Example: 'Central Plaza' },
      { Field: 'category', Required: 'No', Description: 'Event category', Example: 'Music, Sports, Food, Art' },
      { Field: 'price', Required: 'No', Description: 'Ticket price (default: 0)', Example: '100' },
      { Field: 'max_attendees', Required: 'No', Description: 'Maximum capacity (default: 100)', Example: '200' }
    ]
    
    const instructionsSheet = XLSX.utils.json_to_sheet(instructions)
    XLSX.utils.book_append_sheet(wb, instructionsSheet, 'Instructions')
    
    // Generate buffer
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    
    // Return as downloadable file
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="child-events-template${eventPageId ? `-${eventPageId}` : ''}.xlsx"`
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