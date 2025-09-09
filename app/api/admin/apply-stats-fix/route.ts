import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    console.log('Applying stats RLS fix for ticket generation...')

    // First, try to create the safe update function
    const { error: funcError } = await supabase.rpc('safe_update_event_stats', { 
      p_event_id: '00000000-0000-0000-0000-000000000000' // Test with dummy UUID
    }).catch(err => ({ error: err }))

    if (funcError?.message?.includes('function') || funcError?.message?.includes('does not exist')) {
      console.log('Function does not exist, needs to be created in Supabase dashboard')
      
      return NextResponse.json({
        success: false,
        message: 'RLS fix requires database function creation',
        instructions: 'Please run the SQL script in supabase/fix-ticket-generation-stats.sql in your Supabase SQL editor',
        sqlFile: '/supabase/fix-ticket-generation-stats.sql'
      })
    }

    // Test updating stats for all events
    const { data: events } = await supabase
      .from('events')
      .select('id, title')

    let successCount = 0
    let errorCount = 0
    const errors: any[] = []

    if (events) {
      for (const event of events) {
        try {
          await supabase.rpc('safe_update_event_stats', { p_event_id: event.id })
          console.log(`Updated stats for event: ${event.title}`)
          successCount++
        } catch (err: any) {
          console.log(`Failed to update stats for event ${event.title}:`, err.message)
          errorCount++
          errors.push({ event: event.title, error: err.message })
        }
      }
    }

    return NextResponse.json({
      success: errorCount === 0,
      message: errorCount === 0 
        ? 'Stats fix applied successfully' 
        : 'Stats fix partially applied',
      details: {
        eventsProcessed: events?.length || 0,
        successful: successCount,
        failed: errorCount,
        errors: errors.slice(0, 5) // Only show first 5 errors
      }
    })

  } catch (error: any) {
    console.error('Error applying stats fix:', error)
    return NextResponse.json(
      { 
        error: 'Failed to apply stats fix', 
        details: error.message,
        suggestion: 'Please run the SQL script manually in Supabase SQL editor'
      },
      { status: 500 }
    )
  }
}