import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { readFileSync } from 'fs'
import { join } from 'path'

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

    // Execute database fixes
    const results = []
    
    try {
      // Fix 1: Add category column to events table if missing
      const { error: categoryError } = await supabase.rpc('sql', {
        query: 'ALTER TABLE events ADD COLUMN IF NOT EXISTS category TEXT DEFAULT \'General\''
      })
      
      results.push({
        step: 'Add category column',
        success: !categoryError,
        error: categoryError?.message || null
      })

      // Fix 2: Update existing events to have category
      const { error: updateError } = await supabase.rpc('sql', {
        query: 'UPDATE events SET category = \'General\' WHERE category IS NULL'
      })
      
      results.push({
        step: 'Update existing events category',
        success: !updateError,
        error: updateError?.message || null
      })

      // Fix 3: Drop and recreate RLS policies for event_verification_stats
      const policies = [
        'DROP POLICY IF EXISTS "event_verification_stats_select" ON event_verification_stats',
        'DROP POLICY IF EXISTS "event_verification_stats_insert" ON event_verification_stats', 
        'DROP POLICY IF EXISTS "event_verification_stats_update" ON event_verification_stats',
        'DROP POLICY IF EXISTS "event_verification_stats_delete" ON event_verification_stats',
        'DROP POLICY IF EXISTS "View event stats" ON event_verification_stats',
        'DROP POLICY IF EXISTS "Allow stats insert via functions" ON event_verification_stats',
        'DROP POLICY IF EXISTS "Allow stats update via functions" ON event_verification_stats',
        'DROP POLICY IF EXISTS "Anyone can view stats" ON event_verification_stats',
        'DROP POLICY IF EXISTS "Insert stats for own events" ON event_verification_stats',
        'DROP POLICY IF EXISTS "Update stats for own events" ON event_verification_stats',
        'CREATE POLICY "Allow all for authenticated" ON event_verification_stats FOR ALL USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)'
      ]

      for (const policy of policies) {
        const { error: policyError } = await supabase.rpc('sql', { query: policy })
        results.push({
          step: `Policy: ${policy.substring(0, 50)}...`,
          success: !policyError,
          error: policyError?.message || null
        })
      }

      // Fix 4: Add missing columns to tickets table
      const ticketColumns = [
        'ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ticket_type TEXT DEFAULT \'Bronze\'',
        'ALTER TABLE tickets ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP WITH TIME ZONE'
      ]

      for (const column of ticketColumns) {
        const { error: columnError } = await supabase.rpc('sql', { query: column })
        results.push({
          step: `Add ticket column: ${column.split(' ')[5]}`,
          success: !columnError,
          error: columnError?.message || null
        })
      }

      // Fix 5: Create initialization function
      const initFunction = `
        CREATE OR REPLACE FUNCTION initialize_event_stats(event_id UUID)
        RETURNS VOID AS $$
        BEGIN
            INSERT INTO event_verification_stats (event_id, total_tickets, verified_tickets, unverified_tickets, last_scan_at)
            SELECT 
                event_id,
                0 as total_tickets,
                0 as verified_tickets,
                0 as unverified_tickets,
                NULL as last_scan_at
            ON CONFLICT (event_id) DO NOTHING;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Failed to initialize stats for event %: %', event_id, SQLERRM;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
      `
      
      const { error: funcError } = await supabase.rpc('sql', { query: initFunction })
      results.push({
        step: 'Create initialize_event_stats function',
        success: !funcError,
        error: funcError?.message || null
      })

      // Fix 6: Initialize stats for events without them
      const initStats = `
        INSERT INTO event_verification_stats (event_id, total_tickets, verified_tickets, unverified_tickets)
        SELECT 
            e.id,
            COALESCE(t.total, 0),
            COALESCE(t.verified, 0),
            COALESCE(t.total, 0) - COALESCE(t.verified, 0)
        FROM events e
        LEFT JOIN (
            SELECT 
                event_id,
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'used' OR checked_in_at IS NOT NULL THEN 1 END) as verified
            FROM tickets
            GROUP BY event_id
        ) t ON e.id = t.event_id
        WHERE NOT EXISTS (SELECT 1 FROM event_verification_stats WHERE event_id = e.id)
        ON CONFLICT (event_id) DO NOTHING
      `
      
      const { error: statsError } = await supabase.rpc('sql', { query: initStats })
      results.push({
        step: 'Initialize missing event stats',
        success: !statsError,
        error: statsError?.message || null
      })

    } catch (error) {
      console.error('Error running database fixes:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to execute database fixes',
        details: error instanceof Error ? error.message : 'Unknown error',
        results
      }, { status: 500 })
    }

    // Test the fixes
    const { data: testEvents, error: testError } = await supabase
      .from('events')
      .select('id, title, category')
      .limit(5)

    results.push({
      step: 'Test events query with category',
      success: !testError && testEvents && testEvents.length >= 0,
      error: testError?.message || null,
      data: testEvents?.length || 0
    })

    const successfulFixes = results.filter(r => r.success).length
    const totalFixes = results.length

    return NextResponse.json({
      success: successfulFixes === totalFixes,
      message: `Database repair completed: ${successfulFixes}/${totalFixes} fixes successful`,
      results,
      recommendation: successfulFixes === totalFixes 
        ? 'All fixes applied successfully. Try accessing the ticket analytics page now.'
        : 'Some fixes failed. Check the details and run the SQL script manually in Supabase.'
    })

  } catch (error) {
    console.error('Error in database fix endpoint:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}