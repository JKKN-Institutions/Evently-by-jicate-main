-- Create registrations table for ticket storage
CREATE TABLE IF NOT EXISTS registrations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id TEXT,
    user_id UUID REFERENCES auth.users(id),
    attendee_name TEXT NOT NULL,
    attendee_email TEXT,
    ticket_number TEXT UNIQUE NOT NULL,
    ticket_type TEXT DEFAULT 'general',
    amount_paid DECIMAL(10,2) DEFAULT 0,
    payment_status TEXT DEFAULT 'completed',
    registration_status TEXT DEFAULT 'confirmed',
    ticket_image TEXT,
    qr_code TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Enable RLS
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own registrations" ON registrations
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all registrations" ON registrations
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

CREATE POLICY "Organizers can view event registrations" ON registrations
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('organizer', 'admin')
        )
    );

-- Indexes
CREATE INDEX idx_registrations_event_id ON registrations(event_id);
CREATE INDEX idx_registrations_user_id ON registrations(user_id);
CREATE INDEX idx_registrations_ticket_number ON registrations(ticket_number);

-- Grant permissions
GRANT ALL ON registrations TO authenticated;