import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { eventFormSchema } from '@/lib/validations/event'
import { generateEventSeats } from '@/lib/seat-management'

export async function GET(request: NextRequest) {
  try {
    // Initialize Supabase client with error handling
    let supabase
    try {
      supabase = await createClient()
    } catch (clientError) {
      console.error('Failed to create Supabase client:', clientError)
      return NextResponse.json(
        { 
          error: 'Database connection failed',
          message: 'Unable to connect to the database. Please check your configuration.',
          details: clientError instanceof Error ? clientError.message : 'Unknown error'
        },
        { status: 500 }
      )
    }
    
    // Get query parameters
    const searchParams = request.nextUrl.searchParams
    const category = searchParams.get('category')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Retry logic for network failures
    let retries = 3
    let lastError = null
    
    while (retries > 0) {
      try {
        // Build query with safe relationship handling
        // Simplified query without complex joins first
        let query = supabase
          .from('events')
          .select('*')
          .eq('status', 'published')
          .order('start_date', { ascending: true })
          .range(offset, offset + limit - 1)

        // Apply category filter if provided
        if (category && category !== 'all') {
          query = query.eq('category', category)
        }

        const { data: events, error } = await query

        if (error) {
          lastError = error
          console.error(`Database query error (attempt ${4 - retries}/3):`, error)
          
          // If it's a network error, retry
          if (error.message?.includes('fetch failed') && retries > 1) {
            await new Promise(resolve => setTimeout(resolve, 1000))
            retries--
            continue
          }
          
          // For other errors, don't retry
          return NextResponse.json(
            { 
              error: 'Failed to fetch events',
              message: error.message || 'Database query failed',
              details: error
            },
            { status: 500 }
          )
        }

        // Success - map start_date to date for frontend compatibility
        const formattedEvents = (events || []).map(event => ({
          ...event,
          date: event.start_date // Add date field for backward compatibility
        }))
        
        return NextResponse.json({ events: formattedEvents })
        
      } catch (queryError) {
        lastError = queryError
        console.error(`Query execution error (attempt ${4 - retries}/3):`, queryError)
        
        if (retries > 1) {
          await new Promise(resolve => setTimeout(resolve, 1000))
          retries--
          continue
        }
      }
    }
    
    // All retries failed
    console.error('Error fetching events:', {
      message: lastError instanceof Error ? lastError.message : 'Unknown error',
      details: String(lastError),
      hint: 'Check network connectivity and Supabase configuration',
      code: ''
    })
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch events after retries',
        message: 'Unable to retrieve events. Please try again later.',
        events: [] // Return empty array as fallback
      },
      { status: 500 }
    )
    
  } catch (error) {
    console.error('Error fetching events:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      details: String(error),
      hint: error instanceof Error && error.message.includes('fetch failed') ? 
        'Network connection issue. Check your internet connection.' : '',
      code: ''
    })
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'An unexpected error occurred while fetching events',
        events: [] // Return empty array as fallback
      },
      { status: 500 }
    )
  }
}

// Track ongoing requests to prevent duplicates
const ongoingRequests = new Map<string, Promise<NextResponse>>()

export async function POST(request: NextRequest) {
  try {
    // Add request deduplication using a request ID from headers
    const requestId = request.headers.get('X-Request-Id')
    if (requestId && ongoingRequests.has(requestId)) {
      console.log('Duplicate request detected, returning cached response:', requestId)
      return await ongoingRequests.get(requestId)!
    }
    
    const processRequest = async () => {
      const supabase = await createClient()
      
      // Get current user with retry logic
      let retries = 3
      let user = null
      let authError = null
      
      while (retries > 0) {
        const result = await supabase.auth.getUser()
        user = result.data.user
        authError = result.error
        
        if (user) break
        
        // If auth error, try refreshing the session
        if (authError && retries > 1) {
          console.log(`Auth attempt ${4 - retries} failed, retrying...`)
          await new Promise(resolve => setTimeout(resolve, 500))
          
          // Try to refresh the session
          const { data: { session }, error: refreshError } = await supabase.auth.getSession()
          if (!refreshError && session) {
            console.log('Session refreshed successfully')
          }
        }
        retries--
      }
      
      if (authError || !user) {
        console.error('Auth error after retries:', authError)
        return NextResponse.json(
          { error: 'Authentication required. Please sign in again.' },
          { status: 401 }
        )
      }

    // Check if user profile exists, if not create one
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      // Create profile if it doesn't exist
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email!,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User'
        })

      if (profileError) {
        console.error('Error creating profile:', profileError)
        return NextResponse.json(
          { error: 'Failed to create user profile. Please try again.' },
          { status: 500 }
        )
      }
    }

    // Parse and validate request body
    const body = await request.json()
    console.log('Request body:', body)
    

    // Extract seat config, ticket template, ticket generation type, and image data before validation
    const { seat_config, ticket_template, ticket_generation_type, predefined_ticket_url, ...eventData } = body

    
    // Process the event data but keep the image URL as-is
    let processedEventData = { ...eventData }
    
    console.log('Event data to validate:', processedEventData)
    
    const validatedData = eventFormSchema.parse(processedEventData)


    // Create event with ticket template and generation type
    // Transform date to start_date for database and handle all fields
    const eventDataForDB: any = {
      title: validatedData.title,
      description: validatedData.description,
      start_date: validatedData.date, // Map date to start_date
      end_date: validatedData.date, // Set end_date same as start_date by default
      time: validatedData.time || null,
      venue: validatedData.venue,
      location: validatedData.location,
      price: validatedData.price,
      max_attendees: validatedData.max_attendees,
      category: validatedData.category,
      image_url: validatedData.image_url || null,
      organizer_id: user.id,
      status: 'published',
      // New fields for ticket configuration
      ticket_template: ticket_template || null,
      ticket_generation_type: ticket_generation_type || null,
      predefined_ticket_url: predefined_ticket_url || null,
      // Multi-ticket pricing fields
      use_multi_ticket_pricing: validatedData.use_multi_ticket_pricing || false,
      ticket_types: validatedData.ticket_types || [],
      // Seat configuration
      seat_config: seat_config || null
    }

    const { data: event, error: createError } = await supabase
      .from('events')
      .insert(eventDataForDB)
      .select()
      .single()

    if (createError) {
      console.error('Error creating event:', createError)
      console.error('Event data:', { ...validatedData, organizer_id: user.id })
      return NextResponse.json(
        { error: `Failed to create event: ${createError.message}` },
        { status: 500 }
      )
    }

    // Image is already stored in the image_url field
    if (event.image_url) {
      console.log('Event created with image URL:', event.image_url.substring(0, 50) + '...')
    }

    // Handle seat configuration if enabled
    if (seat_config?.enabled && event) {
      console.log('Creating seat configuration for event:', event.id)
      
      // Generate seats for the event using server-side supabase client
      const seatResult = await generateEventSeats(
        event.id,
        seat_config.totalSeats,
        seat_config.layoutType,
        seat_config.sections,
        supabase
      )
      
      if (!seatResult.success) {
        console.error('Failed to generate seats:', seatResult.error)
        // Don't fail the event creation, just log the error
      } else {
        console.log(`Generated ${seatResult.seatsGenerated} seats for event ${event.id}`)
      }
    }

      return NextResponse.json({ event }, { status: 201 })
    }
    
    // Store the promise if request has an ID
    if (requestId) {
      const promise = processRequest()
      ongoingRequests.set(requestId, promise)
      
      // Clean up after 5 seconds
      setTimeout(() => {
        ongoingRequests.delete(requestId)
      }, 5000)
      
      return await promise
    }
    
    return await processRequest()
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      console.error('Validation error:', error)
      return NextResponse.json(
        { error: 'Invalid event data', details: error },
        { status: 400 }
      )
    }
    
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
