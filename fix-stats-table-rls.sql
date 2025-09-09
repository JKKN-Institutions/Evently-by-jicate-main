-- Fix RLS policies for event_verification_stats table
-- This script disables RLS for the stats table or creates permissive policies

BEGIN;

-- Check if event_verification_stats table exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_verification_stats') THEN
        -- Option 1: Disable RLS completely for this table (simplest solution)
        ALTER TABLE event_verification_stats DISABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'Disabled RLS for event_verification_stats table';
        
        -- If you prefer to keep RLS enabled but with permissive policies, comment above and uncomment below:
        /*
        -- Enable RLS
        ALTER TABLE event_verification_stats ENABLE ROW LEVEL SECURITY;
        
        -- Drop all existing policies
        DROP POLICY IF EXISTS "Enable all for authenticated" ON event_verification_stats;
        DROP POLICY IF EXISTS "Enable insert for authenticated users" ON event_verification_stats;
        DROP POLICY IF EXISTS "Enable read for authenticated users" ON event_verification_stats;
        DROP POLICY IF EXISTS "Enable update for authenticated users" ON event_verification_stats;
        DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON event_verification_stats;
        
        -- Create a single permissive policy for all operations
        CREATE POLICY "Allow all operations for authenticated users"
        ON event_verification_stats
        FOR ALL
        TO authenticated
        USING (true)
        WITH CHECK (true);
        
        RAISE NOTICE 'Created permissive RLS policy for event_verification_stats table';
        */
    ELSE
        -- Create the table if it doesn't exist
        CREATE TABLE IF NOT EXISTS event_verification_stats (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            event_id UUID REFERENCES events(id) ON DELETE CASCADE,
            ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
            verification_type TEXT NOT NULL,
            verification_status TEXT NOT NULL,
            verified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            verified_by UUID REFERENCES auth.users(id),
            metadata JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_event_verification_stats_event_id ON event_verification_stats(event_id);
        CREATE INDEX IF NOT EXISTS idx_event_verification_stats_ticket_id ON event_verification_stats(ticket_id);
        CREATE INDEX IF NOT EXISTS idx_event_verification_stats_verified_at ON event_verification_stats(verified_at);
        
        -- Disable RLS for this table
        ALTER TABLE event_verification_stats DISABLE ROW LEVEL SECURITY;
        
        RAISE NOTICE 'Created event_verification_stats table with RLS disabled';
    END IF;
END $$;

-- Also ensure tickets table has proper policies
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- Drop old restrictive policies
DROP POLICY IF EXISTS "Users can view their own tickets" ON tickets;
DROP POLICY IF EXISTS "Users can create tickets" ON tickets;
DROP POLICY IF EXISTS "Admin users can manage all tickets" ON tickets;

-- Create permissive policies for authenticated users (admin operations)
-- Drop if exists then create
DROP POLICY IF EXISTS "Authenticated users can create tickets" ON tickets;
CREATE POLICY "Authenticated users can create tickets"
ON tickets
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can view all tickets" ON tickets;
CREATE POLICY "Authenticated users can view all tickets"
ON tickets
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can update tickets" ON tickets;
CREATE POLICY "Authenticated users can update tickets"
ON tickets
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Ensure bookings table also has proper policies
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own bookings" ON bookings;
DROP POLICY IF EXISTS "Users can create bookings" ON bookings;

DROP POLICY IF EXISTS "Authenticated users can create bookings" ON bookings;
CREATE POLICY "Authenticated users can create bookings"
ON bookings
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can view all bookings" ON bookings;
CREATE POLICY "Authenticated users can view all bookings"
ON bookings
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated users can update bookings" ON bookings;
CREATE POLICY "Authenticated users can update bookings"
ON bookings
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

COMMIT;

-- Verify the changes
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
WHERE tablename IN ('tickets', 'bookings', 'event_verification_stats')
ORDER BY tablename, policyname;

-- Check if RLS is enabled/disabled
SELECT 
    relname as table_name,
    relrowsecurity as rls_enabled
FROM pg_class
WHERE relname IN ('tickets', 'bookings', 'event_verification_stats');