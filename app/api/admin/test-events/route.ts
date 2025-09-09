import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    console.log('Testing events table access...')
    
    // Test different ways to access events
    const results = {}

    // Test 1: Simple select all
    try {
      const { data: allEvents, error: allError } = await supabase
        .from('events')
        .select('*')
        .limit(5)
      
      results.selectAll = {
        success: !allError,
        count: allEvents?.length || 0,
        error: allError?.message,
        sample: allEvents?.[0]
      }
    } catch (error) {
      results.selectAll = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test 2: Select specific columns (without category)
    try {
      const { data: basicEvents, error: basicError } = await supabase
        .from('events')
        .select('id, title, date')
        .limit(5)
      
      results.selectBasic = {
        success: !basicError,
        count: basicEvents?.length || 0,
        error: basicError?.message,
        sample: basicEvents?.[0]
      }
    } catch (error) {
      results.selectBasic = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test 3: Select with category
    try {
      const { data: categoryEvents, error: categoryError } = await supabase
        .from('events')
        .select('id, title, date, category')
        .limit(5)
      
      results.selectWithCategory = {
        success: !categoryError,
        count: categoryEvents?.length || 0,
        error: categoryError?.message,
        sample: categoryEvents?.[0]
      }
    } catch (error) {
      results.selectWithCategory = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test 4: Raw SQL query
    try {
      const { data: sqlEvents, error: sqlError } = await supabase.rpc('sql', {
        query: 'SELECT id, title, date FROM events LIMIT 5'
      })
      
      results.rawSQL = {
        success: !sqlError,
        count: sqlEvents?.length || 0,
        error: sqlError?.message,
        sample: sqlEvents?.[0]
      }
    } catch (error) {
      results.rawSQL = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test 5: Check what columns actually exist
    try {
      const { data: columns, error: columnsError } = await supabase.rpc('sql', {
        query: `SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'events' AND table_schema = 'public' 
                ORDER BY column_name`
      })
      
      results.actualColumns = {
        success: !columnsError,
        error: columnsError?.message,
        columns: columns?.map(c => c.column_name) || []
      }
    } catch (error) {
      results.actualColumns = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Server-side events table test completed',
      results,
      working_queries: Object.entries(results).filter(([key, value]) => value.success).map(([key]) => key),
      failing_queries: Object.entries(results).filter(([key, value]) => !value.success).map(([key]) => key)
    })

  } catch (error) {
    console.error('Error in test-events:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}