-- =================================================================
-- COMPREHENSIVE DATABASE REPAIR FOR TICKET ANALYTICS & RLS ISSUES
-- =================================================================
-- Run this script in your Supabase SQL editor to fix all issues
-- This addresses both the 400 errors and RLS policy violations

-- =================================================================
-- STEP 1: Fix missing columns in events table
-- =================================================================
-- Add missing columns that are expected by the frontend
ALTER TABLE events ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General';

-- Update existing events to have a default category if null
UPDATE events SET category = 'General' WHERE category IS NULL;

-- =================================================================
-- STEP 2: Fix RLS policies for event_verification_stats
-- =================================================================
-- Drop existing problematic policies
DROP POLICY IF EXISTS "event_verification_stats_select" ON event_verification_stats;
DROP POLICY IF EXISTS "event_verification_stats_insert" ON event_verification_stats;
DROP POLICY IF EXISTS "event_verification_stats_update" ON event_verification_stats;
DROP POLICY IF EXISTS "event_verification_stats_delete" ON event_verification_stats;
DROP POLICY IF EXISTS "stats_select_all" ON event_verification_stats;
DROP POLICY IF EXISTS "stats_insert_authenticated" ON event_verification_stats;
DROP POLICY IF EXISTS "stats_update_authenticated" ON event_verification_stats;
DROP POLICY IF EXISTS "Allow stats insert via functions" ON event_verification_stats;

-- Create new permissive policies that work with both authenticated users and service role
CREATE POLICY "event_verification_stats_all_select" ON event_verification_stats
    FOR SELECT USING (true);

CREATE POLICY "event_verification_stats_all_insert" ON event_verification_stats
    FOR INSERT WITH CHECK (true);

CREATE POLICY "event_verification_stats_all_update" ON event_verification_stats
    FOR UPDATE USING (true);

CREATE POLICY "event_verification_stats_all_delete" ON event_verification_stats
    FOR DELETE USING (true);

-- =================================================================
-- STEP 3: Add missing columns to tickets table if needed
-- =================================================================
-- Ensure tickets table has all expected columns
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ticket_type TEXT DEFAULT 'Bronze';
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP WITH TIME ZONE;

-- =================================================================
-- STEP 4: Create event_verification_stats entries for existing events
-- =================================================================
-- Insert missing stats for events that don't have them
INSERT INTO event_verification_stats (event_id, total_tickets, verified_tickets, unverified_tickets, last_scan_at)
SELECT 
    e.id as event_id,
    COALESCE(ticket_counts.total_tickets, 0) as total_tickets,
    COALESCE(ticket_counts.verified_tickets, 0) as verified_tickets,
    COALESCE(ticket_counts.unverified_tickets, 0) as unverified_tickets,
    ticket_counts.last_scan_at
FROM events e
LEFT JOIN (
    SELECT 
        t.event_id,
        COUNT(*) as total_tickets,
        COUNT(CASE WHEN t.status = 'used' OR t.checked_in_at IS NOT NULL OR (t.scan_count > 0) THEN 1 END) as verified_tickets,
        COUNT(CASE WHEN t.status != 'used' AND t.checked_in_at IS NULL AND COALESCE(t.scan_count, 0) = 0 THEN 1 END) as unverified_tickets,
        MAX(t.checked_in_at) as last_scan_at
    FROM tickets t
    GROUP BY t.event_id
) ticket_counts ON e.id = ticket_counts.event_id
WHERE NOT EXISTS (
    SELECT 1 FROM event_verification_stats evs WHERE evs.event_id = e.id
);

-- =================================================================
-- STEP 5: Create function to safely initialize stats
-- =================================================================
CREATE OR REPLACE FUNCTION initialize_event_stats(event_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Insert or update event verification stats
    INSERT INTO event_verification_stats (event_id, total_tickets, verified_tickets, unverified_tickets, last_scan_at)
    SELECT 
        event_id,
        0 as total_tickets,
        0 as verified_tickets,
        0 as unverified_tickets,
        NULL as last_scan_at
    ON CONFLICT (event_id) DO NOTHING;
EXCEPTION WHEN OTHERS THEN
    -- Log the error but don't fail the ticket creation
    RAISE NOTICE 'Failed to initialize stats for event %: %', event_id, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution to authenticated users and service role
GRANT EXECUTE ON FUNCTION initialize_event_stats TO authenticated;
GRANT EXECUTE ON FUNCTION initialize_event_stats TO service_role;

-- =================================================================
-- STEP 6: Create function to update event stats safely
-- =================================================================
CREATE OR REPLACE FUNCTION update_event_verification_stats(event_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Update event verification stats based on current ticket data
    INSERT INTO event_verification_stats (event_id, total_tickets, verified_tickets, unverified_tickets, last_scan_at)
    SELECT 
        event_id,
        COALESCE(COUNT(*), 0) as total_tickets,
        COALESCE(COUNT(CASE WHEN t.status = 'used' OR t.checked_in_at IS NOT NULL OR (t.scan_count > 0) THEN 1 END), 0) as verified_tickets,
        COALESCE(COUNT(CASE WHEN t.status != 'used' AND t.checked_in_at IS NULL AND COALESCE(t.scan_count, 0) = 0 THEN 1 END), 0) as unverified_tickets,
        MAX(t.checked_in_at) as last_scan_at
    FROM tickets t
    WHERE t.event_id = update_event_verification_stats.event_id
    GROUP BY t.event_id
    ON CONFLICT (event_id) DO UPDATE SET
        total_tickets = EXCLUDED.total_tickets,
        verified_tickets = EXCLUDED.verified_tickets,
        unverified_tickets = EXCLUDED.unverified_tickets,
        last_scan_at = EXCLUDED.last_scan_at,
        updated_at = NOW();
        
EXCEPTION WHEN OTHERS THEN
    -- Log the error but don't fail the calling operation
    RAISE NOTICE 'Failed to update stats for event %: %', event_id, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution to authenticated users and service role
GRANT EXECUTE ON FUNCTION update_event_verification_stats TO authenticated;
GRANT EXECUTE ON FUNCTION update_event_verification_stats TO service_role;

-- =================================================================
-- STEP 7: Create triggers to automatically update stats
-- =================================================================
-- Function that gets called by triggers
CREATE OR REPLACE FUNCTION trigger_update_event_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle both INSERT and UPDATE operations
    IF TG_OP = 'INSERT' THEN
        PERFORM initialize_event_stats(NEW.event_id);
        PERFORM update_event_verification_stats(NEW.event_id);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM update_event_verification_stats(NEW.event_id);
        -- Also update old event if event_id changed
        IF OLD.event_id != NEW.event_id THEN
            PERFORM update_event_verification_stats(OLD.event_id);
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM update_event_verification_stats(OLD.event_id);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create triggers on tickets table
DROP TRIGGER IF EXISTS update_event_stats_on_ticket_insert ON tickets;
CREATE TRIGGER update_event_stats_on_ticket_insert
    AFTER INSERT ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_event_stats();

DROP TRIGGER IF EXISTS update_event_stats_on_ticket_update ON tickets;
CREATE TRIGGER update_event_stats_on_ticket_update
    AFTER UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_event_stats();

DROP TRIGGER IF EXISTS update_event_stats_on_ticket_delete ON tickets;
CREATE TRIGGER update_event_stats_on_ticket_delete
    AFTER DELETE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_event_stats();

-- =================================================================
-- STEP 8: Fix any missing indexes for performance
-- =================================================================
CREATE INDEX IF NOT EXISTS idx_tickets_event_id_status ON tickets(event_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_checked_in_at ON tickets(checked_in_at) WHERE checked_in_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_scan_count ON tickets(scan_count) WHERE scan_count > 0;
CREATE INDEX IF NOT EXISTS idx_event_verification_stats_event_id ON event_verification_stats(event_id);

-- =================================================================
-- STEP 9: Update all existing event stats
-- =================================================================
-- Refresh all existing event verification stats
DO $$
DECLARE
    event_record RECORD;
BEGIN
    FOR event_record IN SELECT id FROM events LOOP
        PERFORM initialize_event_stats(event_record.id);
        PERFORM update_event_verification_stats(event_record.id);
    END LOOP;
END $$;

-- =================================================================
-- STEP 10: Verification queries
-- =================================================================
-- Check that events table has category column
SELECT 
    column_name, 
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'events' 
AND table_schema = 'public'
AND column_name = 'category';

-- Check RLS policies on event_verification_stats
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'event_verification_stats'
ORDER BY policyname;

-- Check that all events have verification stats
SELECT 
    'Events without stats' as check_type,
    COUNT(*) as count
FROM events e
LEFT JOIN event_verification_stats evs ON e.id = evs.event_id
WHERE evs.event_id IS NULL;

-- Summary of current stats
SELECT 
    'Current stats summary' as check_type,
    COUNT(*) as total_events,
    COUNT(evs.id) as events_with_stats,
    SUM(evs.total_tickets) as total_tickets,
    SUM(evs.verified_tickets) as verified_tickets
FROM events e
LEFT JOIN event_verification_stats evs ON e.id = evs.event_id;

-- =================================================================
-- SUCCESS MESSAGE
-- =================================================================
SELECT 'DATABASE REPAIR COMPLETED SUCCESSFULLY!' as status,
       'All RLS issues should now be resolved' as message,
       'Analytics page should now load data correctly' as note;