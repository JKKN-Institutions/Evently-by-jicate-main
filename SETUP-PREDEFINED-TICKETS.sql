-- =====================================================
-- SETUP PREDEFINED TICKETS WITH TICKET TYPES
-- Run this entire script in Supabase SQL Editor
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop table if you want to start fresh (uncomment if needed)
-- DROP TABLE IF EXISTS predefined_tickets CASCADE;

-- Create the predefined_tickets table
CREATE TABLE IF NOT EXISTS predefined_tickets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    template_url TEXT NOT NULL,
    qr_position JSONB NOT NULL DEFAULT '{"x": 50, "y": 50, "size": 100}'::jsonb,
    ticket_type TEXT DEFAULT 'Bronze' CHECK (ticket_type IN ('Gold', 'Silver', 'Bronze')),
    event_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Add ticket_type to tickets table if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tickets') THEN
        -- Drop old constraint if exists
        ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_ticket_type_check;
        
        -- Ensure ticket_type column exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'ticket_type') THEN
            ALTER TABLE tickets ADD COLUMN ticket_type TEXT DEFAULT 'Bronze';
        END IF;
        
        -- Add new constraint
        ALTER TABLE tickets ADD CONSTRAINT tickets_ticket_type_check 
        CHECK (ticket_type IN ('Gold', 'Silver', 'Bronze', 'General', 'VIP', 'Standard', 'general', 'vip', 'standard'));
        
        -- Create index
        CREATE INDEX IF NOT EXISTS idx_tickets_ticket_type ON tickets(ticket_type);
    END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_predefined_tickets_ticket_type ON predefined_tickets(ticket_type);
CREATE INDEX IF NOT EXISTS idx_predefined_tickets_created_at ON predefined_tickets(created_at DESC);

-- Enable Row Level Security
ALTER TABLE predefined_tickets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Admins can manage predefined tickets" ON predefined_tickets;
DROP POLICY IF EXISTS "Organizers can view predefined tickets" ON predefined_tickets;
DROP POLICY IF EXISTS "Users can view predefined tickets" ON predefined_tickets;

-- Create RLS policies
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

-- Grant permissions
GRANT ALL ON predefined_tickets TO authenticated;
GRANT SELECT ON predefined_tickets TO anon;

-- Create update trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_predefined_tickets_updated_at ON predefined_tickets;
CREATE TRIGGER update_predefined_tickets_updated_at
    BEFORE UPDATE ON predefined_tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data (optional - uncomment if you want sample templates)
/*
INSERT INTO predefined_tickets (name, description, template_url, ticket_type, qr_position)
VALUES 
    ('Gold VIP Template', 'Premium gold ticket template with special benefits', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'Gold', '{"x": 100, "y": 100, "size": 150}'::jsonb),
    ('Silver Standard Template', 'Standard silver ticket template', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'Silver', '{"x": 75, "y": 75, "size": 125}'::jsonb),
    ('Bronze Basic Template', 'Basic bronze ticket template', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'Bronze', '{"x": 50, "y": 50, "size": 100}'::jsonb);
*/

-- Verify the setup
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'predefined_tickets') THEN
        RAISE NOTICE 'SUCCESS: predefined_tickets table created successfully!';
        RAISE NOTICE 'Table has ticket_type field with Gold, Silver, Bronze options.';
    ELSE
        RAISE EXCEPTION 'ERROR: Failed to create predefined_tickets table';
    END IF;
END $$;