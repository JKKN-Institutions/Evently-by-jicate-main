import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const diagnostics = []

    // Test 1: Check if events table exists
    try {
      const { data: tableExists, error: tableError } = await supabase.rpc('sql', {
        query: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'events'`
      })
      
      diagnostics.push({
        test: 'Events table exists',
        success: !tableError && tableExists && tableExists.length > 0,
        error: tableError?.message,
        result: tableExists
      })
    } catch (error) {
      diagnostics.push({
        test: 'Events table exists',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    // Test 2: Check events table columns
    try {
      const { data: columns, error: columnsError } = await supabase.rpc('sql', {
        query: `SELECT column_name, data_type, is_nullable, column_default 
                FROM information_schema.columns 
                WHERE table_name = 'events' AND table_schema = 'public' 
                ORDER BY column_name`
      })
      
      diagnostics.push({
        test: 'Events table columns',
        success: !columnsError,
        error: columnsError?.message,
        result: columns
      })
    } catch (error) {
      diagnostics.push({
        test: 'Events table columns',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    // Test 3: Check RLS policies on events table
    try {
      const { data: policies, error: policiesError } = await supabase.rpc('sql', {
        query: `SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
                FROM pg_policies 
                WHERE tablename = 'events' AND schemaname = 'public'`
      })
      
      diagnostics.push({
        test: 'Events table RLS policies',
        success: !policiesError,
        error: policiesError?.message,
        result: policies
      })
    } catch (error) {
      diagnostics.push({
        test: 'Events table RLS policies',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    // Test 4: Check if we can count events (simplest query)
    try {
      const { data: count, error: countError } = await supabase.rpc('sql', {
        query: `SELECT COUNT(*) as total FROM events`
      })
      
      diagnostics.push({
        test: 'Count events (basic access)',
        success: !countError,
        error: countError?.message,
        result: count
      })
    } catch (error) {
      diagnostics.push({
        test: 'Count events (basic access)',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    // Test 5: Try the exact failing query using SQL
    try {
      const { data: eventsWithCategory, error: categoryError } = await supabase.rpc('sql', {
        query: `SELECT id, title, date, category FROM events ORDER BY date DESC LIMIT 5`
      })
      
      diagnostics.push({
        test: 'Events with category via SQL',
        success: !categoryError,
        error: categoryError?.message,
        result: eventsWithCategory
      })
    } catch (error) {
      diagnostics.push({
        test: 'Events with category via SQL',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    // Test 6: Try using the Supabase client directly (like the frontend does)
    try {
      const { data: clientEvents, error: clientError } = await supabase
        .from('events')
        .select('id, title')
        .limit(1)
      
      diagnostics.push({
        test: 'Events via Supabase client (basic)',
        success: !clientError,
        error: clientError?.message,
        result: clientEvents
      })
    } catch (error) {
      diagnostics.push({
        test: 'Events via Supabase client (basic)',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    // Test 7: Try events with category via client
    try {
      const { data: clientCategoryEvents, error: clientCategoryError } = await supabase
        .from('events')
        .select('id, title, date, category')
        .limit(1)
      
      diagnostics.push({
        test: 'Events with category via client',
        success: !clientCategoryError,
        error: clientCategoryError?.message,
        result: clientCategoryEvents
      })
    } catch (error) {
      diagnostics.push({
        test: 'Events with category via client',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    // Test 8: Check user role and permissions
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      diagnostics.push({
        test: 'User profile and role',
        success: true,
        result: {
          userId: user.id,
          email: user.email,
          role: profile?.role || 'unknown'
        }
      })
    } catch (error) {
      diagnostics.push({
        test: 'User profile and role',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    return NextResponse.json({
      success: true,
      diagnostics,
      summary: {
        total_tests: diagnostics.length,
        passed: diagnostics.filter(d => d.success).length,
        failed: diagnostics.filter(d => !d.success).length
      }
    })

  } catch (error) {
    console.error('Error in diagnostics:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}