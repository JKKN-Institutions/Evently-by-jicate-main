import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
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

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin privileges required' },
        { status: 403 }
      )
    }

    const results = []

    // Fix 1: Add category column to events
    try {
      await supabase.rpc('sql', {
        query: `ALTER TABLE events ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General'`
      })
      results.push({ step: 'Add category column', success: true })
    } catch (error) {
      results.push({ step: 'Add category column', success: false, error: error.message })
    }

    // Fix 2: Update existing events
    try {
      await supabase.rpc('sql', {
        query: `UPDATE events SET category = 'General' WHERE category IS NULL`
      })
      results.push({ step: 'Update existing events', success: true })
    } catch (error) {
      results.push({ step: 'Update existing events', success: false, error: error.message })
    }

    // Fix 3: Add ticket columns
    try {
      await supabase.rpc('sql', {
        query: `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ticket_type TEXT DEFAULT 'Bronze'`
      })
      results.push({ step: 'Add ticket_type column', success: true })
    } catch (error) {
      results.push({ step: 'Add ticket_type column', success: false, error: error.message })
    }

    try {
      await supabase.rpc('sql', {
        query: `ALTER TABLE tickets ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP WITH TIME ZONE`
      })
      results.push({ step: 'Add checked_in_at column', success: true })
    } catch (error) {
      results.push({ step: 'Add checked_in_at column', success: false, error: error.message })
    }

    // Test the fix
    const { data: testEvents, error: testError } = await supabase
      .from('events')
      .select('id, title, category')
      .limit(1)

    results.push({
      step: 'Test events query',
      success: !testError,
      error: testError?.message || null,
      data: testEvents
    })

    const successCount = results.filter(r => r.success).length
    const totalCount = results.length

    return NextResponse.json({
      success: successCount === totalCount,
      message: `Schema fix completed: ${successCount}/${totalCount} operations successful`,
      results,
      recommendation: successCount === totalCount 
        ? 'Schema fixed! The ticket analytics page should now work properly.'
        : 'Some operations failed. Check the results and try running the SQL manually.'
    })

  } catch (error) {
    console.error('Error in schema fix:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}