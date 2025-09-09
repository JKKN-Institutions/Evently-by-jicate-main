import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    console.log('Testing predefined tickets table...')
    
    const results = {}

    // Test 1: Check if table exists and count rows
    try {
      const { data: countData, error: countError } = await supabase
        .from('predefined_tickets')
        .select('id')
      
      results.tableExists = {
        success: !countError,
        count: countData?.length || 0,
        error: countError?.message
      }
    } catch (error) {
      results.tableExists = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test 2: Get all predefined tickets
    try {
      const { data: allData, error: allError } = await supabase
        .from('predefined_tickets')
        .select('*')
        .order('created_at', { ascending: false })
      
      results.allTickets = {
        success: !allError,
        count: allData?.length || 0,
        error: allError?.message,
        data: allData
      }
    } catch (error) {
      results.allTickets = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test 3: Check table structure
    try {
      const { data: firstRow } = await supabase
        .from('predefined_tickets')
        .select('*')
        .limit(1)
        .single()
      
      results.tableStructure = {
        success: !!firstRow,
        columns: firstRow ? Object.keys(firstRow) : [],
        sampleData: firstRow
      }
    } catch (error) {
      results.tableStructure = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // Test 4: Test with specific columns that might be expected
    try {
      const { data: specificData, error: specificError } = await supabase
        .from('predefined_tickets')
        .select('id, name, event_id, template_url, created_at')
      
      results.specificColumns = {
        success: !specificError,
        count: specificData?.length || 0,
        error: specificError?.message,
        data: specificData
      }
    } catch (error) {
      results.specificColumns = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Predefined tickets test completed',
      results,
      summary: {
        tableExists: results.tableExists?.success || false,
        hasData: (results.allTickets?.count || 0) > 0,
        totalRows: results.allTickets?.count || 0
      }
    })

  } catch (error) {
    console.error('Error in test-predefined:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}