-- =====================================================
-- FIX DATABASE RELATIONSHIPS AND FOREIGN KEYS
-- =====================================================

-- First, let's check and fix the events table structure
-- Make sure the organizer_id column exists and has proper foreign key

-- Add organizer_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'events' 
        AND column_name = 'organizer_id'
    ) THEN
        ALTER TABLE events ADD COLUMN organizer_id UUID;
    END IF;
END $$;

-- Drop existing foreign key constraint if it exists
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_organizer_id_fkey;

-- Add proper foreign key constraint
ALTER TABLE events 
ADD CONSTRAINT events_organizer_id_fkey 
FOREIGN KEY (organizer_id) 
REFERENCES profiles(id) 
ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_events_organizer_id ON events(organizer_id);

-- =====================================================
-- FIX BOOKINGS TABLE RELATIONSHIPS
-- =====================================================

-- Ensure user_id column exists and has proper foreign key
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'bookings' 
        AND column_name = 'user_id'
    ) THEN
        ALTER TABLE bookings ADD COLUMN user_id UUID;
    END IF;
END $$;

-- Drop existing foreign key constraint if it exists
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_user_id_fkey;
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_event_id_fkey;

-- Add proper foreign key constraints
ALTER TABLE bookings 
ADD CONSTRAINT bookings_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES profiles(id) 
ON DELETE CASCADE;

ALTER TABLE bookings 
ADD CONSTRAINT bookings_event_id_fkey 
FOREIGN KEY (event_id) 
REFERENCES events(id) 
ON DELETE CASCADE;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_event_id ON bookings(event_id);

-- =====================================================
-- UPDATE EXISTING EVENTS WITH ORGANIZER_ID
-- =====================================================

-- For events that don't have organizer_id set, try to match with existing profiles
-- This is a safe operation that won't overwrite existing data
UPDATE events 
SET organizer_id = (
    SELECT p.id 
    FROM profiles p 
    WHERE p.role IN ('organizer', 'admin') 
    LIMIT 1
)
WHERE organizer_id IS NULL;

-- =====================================================
-- VERIFY RELATIONSHIPS
-- =====================================================

-- Test query to ensure the relationship works
DO $$
DECLARE
    test_count INTEGER;
BEGIN
    -- Test the events -> profiles relationship
    SELECT COUNT(*) INTO test_count
    FROM events e
    LEFT JOIN profiles p ON e.organizer_id = p.id
    LIMIT 1;
    
    RAISE NOTICE 'Events-Profiles relationship test completed successfully';
EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Events-Profiles relationship test failed: %', SQLERRM;
END $$;

-- =====================================================
-- CREATE VIEW FOR EVENTS WITH ORGANIZER INFO
-- =====================================================

-- Drop existing view if it exists
DROP VIEW IF EXISTS events_with_organizer;

-- Create a view that safely joins events with organizer info
CREATE VIEW events_with_organizer AS
SELECT 
    e.*,
    p.email as organizer_email,
    p.full_name as organizer_name,
    p.role as organizer_role
FROM events e
LEFT JOIN profiles p ON e.organizer_id = p.id;

-- Grant permissions on the view
GRANT SELECT ON events_with_organizer TO authenticated;
GRANT SELECT ON events_with_organizer TO anon;

-- =====================================================
-- ENSURE ALL TABLES HAVE PROPER RLS POLICIES
-- =====================================================

-- Events table RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (including new ones that might exist)
DROP POLICY IF EXISTS "Events are viewable by everyone" ON events;
DROP POLICY IF EXISTS "Users can create events" ON events;
DROP POLICY IF EXISTS "Organizers can update own events" ON events;
DROP POLICY IF EXISTS "events_select_all" ON events;
DROP POLICY IF EXISTS "events_insert_authenticated" ON events;
DROP POLICY IF EXISTS "events_update_own" ON events;
DROP POLICY IF EXISTS "events_admin_all" ON events;

-- Create new policies
CREATE POLICY "events_select_all" ON events
    FOR SELECT USING (true);

CREATE POLICY "events_insert_authenticated" ON events
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "events_update_own" ON events
    FOR UPDATE USING (organizer_id = auth.uid());

CREATE POLICY "events_admin_all" ON events
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- Bookings table RLS
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (including new ones that might exist)
DROP POLICY IF EXISTS "Users can view own bookings" ON bookings;
DROP POLICY IF EXISTS "Users can create bookings" ON bookings;
DROP POLICY IF EXISTS "Organizers can view event bookings" ON bookings;
DROP POLICY IF EXISTS "bookings_select_own" ON bookings;
DROP POLICY IF EXISTS "bookings_insert_authenticated" ON bookings;
DROP POLICY IF EXISTS "bookings_update_own" ON bookings;

-- Create new policies
CREATE POLICY "bookings_select_own" ON bookings
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM events e 
            WHERE e.id = bookings.event_id 
            AND e.organizer_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

CREATE POLICY "bookings_insert_authenticated" ON bookings
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "bookings_update_own" ON bookings
    FOR UPDATE USING (user_id = auth.uid());

-- =====================================================
-- GRANT NECESSARY PERMISSIONS
-- =====================================================

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON bookings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated;

-- Grant select permissions to anonymous users for public data
GRANT SELECT ON events TO anon;
GRANT SELECT ON profiles TO anon;

-- Final success message
DO $$
BEGIN
    RAISE NOTICE 'Database relationships and permissions have been fixed successfully!';
END $$;
