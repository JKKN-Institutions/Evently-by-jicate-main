-- Create predefined_tickets table for storing ticket templates
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

-- Add RLS policies
ALTER TABLE predefined_tickets ENABLE ROW LEVEL SECURITY;

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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_predefined_tickets_event_id ON predefined_tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_predefined_tickets_ticket_type ON predefined_tickets(ticket_type);
CREATE INDEX IF NOT EXISTS idx_predefined_tickets_created_at ON predefined_tickets(created_at DESC);

-- Grant permissions
GRANT ALL ON predefined_tickets TO authenticated;
GRANT SELECT ON predefined_tickets TO anon;

-- Add comment
COMMENT ON TABLE predefined_tickets IS 'Stores predefined ticket templates with customizable QR code positions';