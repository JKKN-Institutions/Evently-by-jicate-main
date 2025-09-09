-- COMPLETE SETUP FOR PREDEFINED TICKETS FEATURE
-- Run this entire script in your Supabase SQL Editor

-- 1. Create the predefined_tickets table
CREATE TABLE IF NOT EXISTS predefined_tickets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    template_url TEXT NOT NULL, -- Base64 encoded image
    qr_position JSONB NOT NULL DEFAULT '{"x": 50, "y": 50, "size": 100}'::jsonb,
    ticket_type TEXT DEFAULT 'Bronze' CHECK (ticket_type IN ('Gold', 'Silver', 'Bronze')),
    event_id UUID REFERENCES events(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 2. Enable RLS
ALTER TABLE predefined_tickets ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage predefined tickets" ON predefined_tickets;
DROP POLICY IF EXISTS "Organizers can view predefined tickets" ON predefined_tickets;
DROP POLICY IF EXISTS "Public can view predefined tickets" ON predefined_tickets;

-- 4. Create RLS policies
-- Policy for admins to manage all predefined tickets
CREATE POLICY "Admins can manage predefined tickets" ON predefined_tickets
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

-- Policy for organizers to view predefined tickets
CREATE POLICY "Organizers can view predefined tickets" ON predefined_tickets
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('organizer', 'admin')
        )
    );

-- Policy for public viewing (optional - remove if you want authenticated only)
CREATE POLICY "Public can view predefined tickets" ON predefined_tickets
    FOR SELECT
    TO anon
    USING (true);

-- 5. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_predefined_tickets_event_id ON predefined_tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_predefined_tickets_ticket_type ON predefined_tickets(ticket_type);
CREATE INDEX IF NOT EXISTS idx_predefined_tickets_created_at ON predefined_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_predefined_tickets_name ON predefined_tickets(name);

-- 6. Grant permissions
GRANT ALL ON predefined_tickets TO authenticated;
GRANT SELECT ON predefined_tickets TO anon;

-- 7. Add updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Create trigger for updated_at
DROP TRIGGER IF EXISTS update_predefined_tickets_updated_at ON predefined_tickets;
CREATE TRIGGER update_predefined_tickets_updated_at
    BEFORE UPDATE ON predefined_tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 9. Add comment for documentation
COMMENT ON TABLE predefined_tickets IS 'Stores predefined ticket templates with customizable QR code positions for quick ticket generation';
COMMENT ON COLUMN predefined_tickets.template_url IS 'Base64 encoded image data of the ticket template';
COMMENT ON COLUMN predefined_tickets.qr_position IS 'JSON object containing x, y coordinates and size for QR code placement';
COMMENT ON COLUMN predefined_tickets.ticket_type IS 'Type of ticket: Gold, Silver, or Bronze';

-- 10. Insert sample data (optional - comment out if not needed)
/*
INSERT INTO predefined_tickets (name, description, template_url, qr_position, ticket_type)
VALUES 
    ('Gold VIP Template', 'Premium gold ticket template for VIP events', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', '{"x": 100, "y": 100, "size": 150}'::jsonb, 'Gold'),
    ('Silver Standard Template', 'Standard silver ticket template', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', '{"x": 50, "y": 50, "size": 100}'::jsonb, 'Silver'),
    ('Bronze Basic Template', 'Basic bronze ticket template', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', '{"x": 75, "y": 75, "size": 125}'::jsonb, 'Bronze');
*/

-- 11. Verify the table was created successfully
SELECT 
    'Table created successfully' as status,
    COUNT(*) as row_count,
    NOW() as checked_at
FROM predefined_tickets;

-- 12. Check RLS policies
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
WHERE tablename = 'predefined_tickets'
ORDER BY policyname;