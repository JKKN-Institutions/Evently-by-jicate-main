-- Fix RLS policies for ticket generation
-- Run this script in Supabase SQL Editor

-- First, check if event_verification_stats table exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_verification_stats') THEN
        -- Drop existing RLS policies that might be causing issues
        DROP POLICY IF EXISTS "Enable insert for authenticated users" ON event_verification_stats;
        DROP POLICY IF EXISTS "Enable read for authenticated users" ON event_verification_stats;
        DROP POLICY IF EXISTS "Enable update for authenticated users" ON event_verification_stats;
        
        -- Create more permissive policies for admin operations
        CREATE POLICY "Allow all operations for authenticated users"
        ON event_verification_stats
        FOR ALL
        TO authenticated
        USING (true)
        WITH CHECK (true);
        
        RAISE NOTICE 'Fixed RLS policies for event_verification_stats table';
    ELSE
        RAISE NOTICE 'event_verification_stats table does not exist';
    END IF;
END $$;

-- Fix RLS policies for tickets table
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view their own tickets" ON tickets;
DROP POLICY IF EXISTS "Users can create tickets" ON tickets;
DROP POLICY IF EXISTS "Admin users can manage all tickets" ON tickets;

-- Create more permissive policies for tickets
CREATE POLICY "Authenticated users can create tickets"
ON tickets
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can view tickets"
ON tickets
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can update tickets"
ON tickets
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Fix RLS policies for bookings table
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view their own bookings" ON bookings;
DROP POLICY IF EXISTS "Users can create bookings" ON bookings;
DROP POLICY IF EXISTS "Admin users can manage all bookings" ON bookings;

-- Create more permissive policies for bookings
CREATE POLICY "Authenticated users can create bookings"
ON bookings
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can view bookings"
ON bookings
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can update bookings"
ON bookings
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Fix RLS policies for qr_codes table
ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view QR codes" ON qr_codes;
DROP POLICY IF EXISTS "Users can create QR codes" ON qr_codes;

-- Create more permissive policies for qr_codes
CREATE POLICY "Authenticated users can create QR codes"
ON qr_codes
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated users can view QR codes"
ON qr_codes
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated users can update QR codes"
ON qr_codes
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Verify the policies are applied
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
WHERE tablename IN ('tickets', 'bookings', 'qr_codes', 'event_verification_stats')
ORDER BY tablename, policyname;