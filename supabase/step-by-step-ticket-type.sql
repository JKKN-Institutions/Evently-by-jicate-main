-- =====================================================
-- STEP BY STEP TICKET TYPE SETUP
-- Run each section one at a time if you encounter errors
-- =====================================================

-- STEP 1: Create the predefined_tickets table
-- Run this first:
CREATE TABLE IF NOT EXISTS predefined_tickets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    template_url TEXT NOT NULL,
    qr_position JSONB NOT NULL DEFAULT '{"x": 50, "y": 50, "size": 100}'::jsonb,
    ticket_type TEXT DEFAULT 'Bronze',
    event_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- STEP 2: Add the check constraint for ticket_type
-- Run this after table is created:
ALTER TABLE predefined_tickets 
ADD CONSTRAINT predefined_tickets_ticket_type_check 
CHECK (ticket_type IN ('Gold', 'Silver', 'Bronze'));

-- STEP 3: Update the tickets table (if it exists)
-- Check if tickets table exists first, then run:
ALTER TABLE tickets 
DROP CONSTRAINT IF EXISTS tickets_ticket_type_check;

ALTER TABLE tickets 
ALTER COLUMN ticket_type SET DEFAULT 'Bronze';

ALTER TABLE tickets 
ADD CONSTRAINT tickets_ticket_type_check 
CHECK (ticket_type IN ('Gold', 'Silver', 'Bronze', 'General', 'VIP', 'Standard', 'general', 'vip', 'standard'));

-- STEP 4: Create indexes
CREATE INDEX IF NOT EXISTS idx_predefined_tickets_ticket_type ON predefined_tickets(ticket_type);
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_type ON tickets(ticket_type);

-- STEP 5: Enable RLS and create policies
ALTER TABLE predefined_tickets ENABLE ROW LEVEL SECURITY;

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

-- STEP 6: Grant permissions
GRANT ALL ON predefined_tickets TO authenticated;