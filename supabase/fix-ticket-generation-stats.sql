-- Fix for ticket generation RLS issue
-- This script resolves the event_verification_stats RLS policy violation

-- 1. Drop existing policies that are too restrictive
DROP POLICY IF EXISTS "View event stats" ON event_verification_stats;
DROP POLICY IF EXISTS "Allow stats insert via functions" ON event_verification_stats;
DROP POLICY IF EXISTS "Allow stats update via functions" ON event_verification_stats;

-- 2. Enable RLS on the table
ALTER TABLE event_verification_stats ENABLE ROW LEVEL SECURITY;

-- 3. Create more permissive policies for authenticated users
-- Allow authenticated users to view all stats (read-only is safe)
CREATE POLICY "Anyone can view stats" ON event_verification_stats
    FOR SELECT 
    USING (true);

-- Allow authenticated users to insert stats for events they're involved with
CREATE POLICY "Insert stats for own events" ON event_verification_stats
    FOR INSERT 
    WITH CHECK (
        auth.uid() IS NOT NULL AND (
            -- Check if user is the organizer or has a booking for this event
            EXISTS (
                SELECT 1 FROM events WHERE id = event_id AND organizer_id = auth.uid()
            ) OR
            EXISTS (
                SELECT 1 FROM bookings WHERE event_id = event_verification_stats.event_id AND user_id = auth.uid()
            ) OR
            EXISTS (
                SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'organizer')
            )
        )
    );

-- Allow authenticated users to update stats for events they're involved with  
CREATE POLICY "Update stats for own events" ON event_verification_stats
    FOR UPDATE 
    USING (
        auth.uid() IS NOT NULL AND (
            EXISTS (
                SELECT 1 FROM events WHERE id = event_id AND organizer_id = auth.uid()
            ) OR
            EXISTS (
                SELECT 1 FROM bookings WHERE event_id = event_verification_stats.event_id AND user_id = auth.uid()
            ) OR
            EXISTS (
                SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'organizer')
            )
        )
    );

-- 4. Drop ALL existing versions of the function
DROP FUNCTION IF EXISTS safe_update_event_stats CASCADE;
DROP FUNCTION IF EXISTS safe_update_event_stats(UUID) CASCADE;
DROP FUNCTION IF EXISTS safe_update_event_stats(p_event_id UUID) CASCADE;

-- Create a simplified function to handle stats updates (bypasses RLS)
CREATE OR REPLACE FUNCTION safe_update_event_stats(p_event_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER -- This allows the function to bypass RLS
SET search_path = public
AS $$
BEGIN
    -- Insert or update stats (without last_scan_at since column doesn't exist)
    INSERT INTO event_verification_stats (
        event_id, 
        total_tickets, 
        verified_tickets, 
        unverified_tickets
    )
    SELECT 
        p_event_id,
        COUNT(*),
        COUNT(*) FILTER (WHERE is_verified = true),
        COUNT(*) FILTER (WHERE is_verified = false)
    FROM tickets
    WHERE event_id = p_event_id
    ON CONFLICT (event_id) DO UPDATE
    SET 
        total_tickets = EXCLUDED.total_tickets,
        verified_tickets = EXCLUDED.verified_tickets,
        unverified_tickets = EXCLUDED.unverified_tickets;
END;
$$;

-- 5. Update the trigger to use the safe function
CREATE OR REPLACE FUNCTION update_event_stats_on_ticket_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Call the safe function that bypasses RLS
    PERFORM safe_update_event_stats(NEW.event_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Recreate the trigger
DROP TRIGGER IF EXISTS update_event_stats_on_ticket ON tickets;
CREATE TRIGGER update_event_stats_on_ticket
    AFTER INSERT OR UPDATE OF is_verified ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_event_stats_on_ticket_change();

-- 7. Grant necessary permissions
GRANT EXECUTE ON FUNCTION safe_update_event_stats TO authenticated;
GRANT EXECUTE ON FUNCTION safe_update_event_stats TO service_role;
GRANT ALL ON event_verification_stats TO authenticated;
GRANT ALL ON event_verification_stats TO service_role;

-- 8. Initialize stats for all existing events
DO $$
DECLARE
    event_record RECORD;
BEGIN
    FOR event_record IN SELECT DISTINCT event_id FROM tickets
    LOOP
        PERFORM safe_update_event_stats(event_record.event_id);
    END LOOP;
END;
$$;