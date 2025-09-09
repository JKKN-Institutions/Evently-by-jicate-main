-- Fix Events Table Access for Admin Users
-- This script ensures events table can be accessed properly

-- 1. Check if RLS is enabled and temporarily disable it for debugging
ALTER TABLE events DISABLE ROW LEVEL SECURITY;

-- 2. Re-enable RLS with proper policies
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies if they exist
DROP POLICY IF EXISTS "Public can view all events" ON events;
DROP POLICY IF EXISTS "Authenticated users can view events" ON events;
DROP POLICY IF EXISTS "Admins can manage events" ON events;
DROP POLICY IF EXISTS "Organizers can manage own events" ON events;

-- 4. Create comprehensive policies

-- Everyone can view published events
CREATE POLICY "Public can view all events" ON events
    FOR SELECT
    USING (true);

-- Authenticated users can view all events
CREATE POLICY "Authenticated users can view events" ON events
    FOR SELECT
    TO authenticated
    USING (true);

-- Admins can do everything
CREATE POLICY "Admins can manage all events" ON events
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Organizers can manage their own events
CREATE POLICY "Organizers can manage own events" ON events
    FOR ALL
    TO authenticated
    USING (
        organizer_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('organizer', 'admin')
        )
    )
    WITH CHECK (
        organizer_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('organizer', 'admin')
        )
    );

-- 5. Grant necessary permissions
GRANT ALL ON events TO authenticated;
GRANT SELECT ON events TO anon;

-- 6. Insert sample events if table is empty (optional)
INSERT INTO events (
    title,
    description,
    date,
    time,
    venue,
    location,
    price,
    category,
    image,
    organizer_id
) 
SELECT 
    'Sample Event ' || generate_series,
    'This is a sample event for testing',
    CURRENT_DATE + (generate_series || ' days')::interval,
    '18:00:00'::time,
    'Main Hall',
    'City Center',
    100.00,
    'conference',
    'https://via.placeholder.com/400x200',
    auth.uid()
FROM generate_series(1, 3)
WHERE NOT EXISTS (SELECT 1 FROM events LIMIT 1);

-- 7. Verify the table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'events'
ORDER BY ordinal_position;

-- 8. Check if there are any events
SELECT COUNT(*) as event_count FROM events;

-- 9. Show first few events
SELECT id, title, venue, date, created_at 
FROM events 
LIMIT 5;