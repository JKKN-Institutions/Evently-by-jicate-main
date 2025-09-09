-- Fix Events Table Access for Admin Users (Simple Version)
-- This script ensures events table can be accessed properly

-- 1. Temporarily disable RLS to fix access issues
ALTER TABLE events DISABLE ROW LEVEL SECURITY;

-- 2. Re-enable RLS with proper policies
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies if they exist
DROP POLICY IF EXISTS "Public can view all events" ON events;
DROP POLICY IF EXISTS "Authenticated users can view events" ON events;
DROP POLICY IF EXISTS "Admins can manage events" ON events;
DROP POLICY IF EXISTS "Organizers can manage own events" ON events;
DROP POLICY IF EXISTS "Enable read access for all users" ON events;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON events;
DROP POLICY IF EXISTS "Enable update for users based on organizer_id" ON events;
DROP POLICY IF EXISTS "Enable delete for users based on organizer_id" ON events;

-- 4. Create simple, permissive policies

-- Everyone can view all events (including anonymous users)
CREATE POLICY "Public can view all events" ON events
    FOR SELECT
    USING (true);

-- Authenticated users can create events
CREATE POLICY "Authenticated users can create events" ON events
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Authenticated users can update events
CREATE POLICY "Authenticated users can update events" ON events
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Admins can delete events
CREATE POLICY "Admins can delete events" ON events
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- 5. Grant necessary permissions
GRANT ALL ON events TO authenticated;
GRANT SELECT ON events TO anon;

-- 6. Check which columns exist in the events table
DO $$
DECLARE
    has_category boolean;
    has_organizer_id boolean;
BEGIN
    -- Check if category column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'events' AND column_name = 'category'
    ) INTO has_category;
    
    -- Check if organizer_id column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'events' AND column_name = 'organizer_id'
    ) INTO has_organizer_id;
    
    -- Insert sample events only if table is empty
    IF NOT EXISTS (SELECT 1 FROM events LIMIT 1) THEN
        -- Insert with minimal required columns that should exist in all versions
        INSERT INTO events (
            title,
            description,
            date,
            time,
            venue,
            location,
            price
        ) 
        VALUES 
            ('Annual Tech Conference 2024', 'Join us for the biggest tech conference of the year', CURRENT_DATE + interval '7 days', '09:00:00', 'Convention Center', 'Downtown Plaza, Main Street', 150.00),
            ('Music Festival 2024', 'A weekend of amazing live music performances', CURRENT_DATE + interval '14 days', '18:00:00', 'City Park Amphitheater', 'Central Park, West Side', 75.00),
            ('Business Workshop', 'Learn strategies for business growth and success', CURRENT_DATE + interval '3 days', '14:00:00', 'Business Hub', 'Financial District, Tower A', 200.00);
        
        RAISE NOTICE 'Sample events inserted successfully';
    ELSE
        RAISE NOTICE 'Events already exist in table, skipping sample data';
    END IF;
END $$;

-- 7. Show table columns to verify structure
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'events'
ORDER BY ordinal_position;

-- 8. Check if there are any events now
SELECT COUNT(*) as total_events FROM events;

-- 9. Show the events
SELECT 
    id,
    title,
    venue,
    location,
    date,
    time,
    price,
    category
FROM events 
ORDER BY created_at DESC
LIMIT 10;