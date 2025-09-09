-- =====================================================
-- COMPLETE TICKET TYPE SETUP
-- This script safely creates/updates all necessary tables
-- =====================================================

-- 1. First ensure UUID extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create predefined_tickets table if it doesn't exist
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

-- 3. Add ticket_type column to predefined_tickets if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'predefined_tickets' 
        AND column_name = 'ticket_type'
    ) THEN
        ALTER TABLE predefined_tickets 
        ADD COLUMN ticket_type TEXT DEFAULT 'Bronze' 
        CHECK (ticket_type IN ('Gold', 'Silver', 'Bronze'));
    END IF;
END $$;

-- 4. Update tickets table to include new ticket types
DO $$ 
BEGIN
    -- First check if the tickets table exists
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_name = 'tickets'
    ) THEN
        -- Drop existing constraint if it exists
        ALTER TABLE tickets 
        DROP CONSTRAINT IF EXISTS tickets_ticket_type_check;
        
        -- Add ticket_type column if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'tickets' 
            AND column_name = 'ticket_type'
        ) THEN
            ALTER TABLE tickets 
            ADD COLUMN ticket_type TEXT DEFAULT 'Bronze';
        ELSE
            -- Set default value if column exists
            ALTER TABLE tickets 
            ALTER COLUMN ticket_type SET DEFAULT 'Bronze';
        END IF;
        
        -- Add new constraint with all ticket types
        ALTER TABLE tickets 
        ADD CONSTRAINT tickets_ticket_type_check 
        CHECK (ticket_type IN ('Gold', 'Silver', 'Bronze', 'General', 'VIP', 'Standard', 'general', 'vip', 'standard'));
    END IF;
END $$;

-- 5. Add ticket_type to printed_tickets table if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_name = 'printed_tickets'
    ) THEN
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_name = 'printed_tickets' 
            AND column_name = 'ticket_type'
        ) THEN
            ALTER TABLE printed_tickets 
            ADD COLUMN ticket_type TEXT DEFAULT 'Bronze' 
            CHECK (ticket_type IN ('Gold', 'Silver', 'Bronze'));
        END IF;
    END IF;
END $$;

-- 6. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_predefined_tickets_event_id ON predefined_tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_predefined_tickets_ticket_type ON predefined_tickets(ticket_type);
CREATE INDEX IF NOT EXISTS idx_predefined_tickets_created_at ON predefined_tickets(created_at DESC);

-- Only create these indexes if the tickets table exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_name = 'tickets'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_tickets_ticket_type ON tickets(ticket_type);
    END IF;
END $$;

-- 7. Set up Row Level Security (RLS) for predefined_tickets
ALTER TABLE predefined_tickets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Admins can manage predefined tickets" ON predefined_tickets;
DROP POLICY IF EXISTS "Organizers can view predefined tickets" ON predefined_tickets;

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

-- 8. Create a view for ticket analytics by type (only if tickets table exists)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_name = 'tickets'
    ) THEN
        -- Drop view if exists
        DROP VIEW IF EXISTS ticket_analytics_by_type;
        
        -- Create the view
        CREATE VIEW ticket_analytics_by_type AS
        SELECT 
            event_id,
            ticket_type,
            COUNT(*) as total_tickets,
            COUNT(CASE WHEN status = 'used' THEN 1 END) as checked_in_tickets,
            COUNT(CASE WHEN status = 'valid' THEN 1 END) as available_tickets,
            COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_tickets
        FROM tickets
        GROUP BY event_id, ticket_type;
        
        -- Grant permissions on the view
        GRANT SELECT ON ticket_analytics_by_type TO authenticated;
    END IF;
END $$;

-- 9. Grant permissions
GRANT ALL ON predefined_tickets TO authenticated;
GRANT SELECT ON predefined_tickets TO anon;

-- 10. Add helpful comments
COMMENT ON TABLE predefined_tickets IS 'Stores predefined ticket templates with customizable QR code positions and ticket types';
COMMENT ON COLUMN predefined_tickets.ticket_type IS 'Ticket tier: Gold, Silver, or Bronze';

-- 11. Update existing records to have default ticket type if null
UPDATE predefined_tickets 
SET ticket_type = 'Bronze' 
WHERE ticket_type IS NULL;

-- Update existing tickets to have default type if null (only if table exists)
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_name = 'tickets'
    ) THEN
        UPDATE tickets 
        SET ticket_type = COALESCE(ticket_type, 'Bronze')
        WHERE ticket_type IS NULL OR ticket_type = '';
    END IF;
END $$;

-- 12. Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS update_predefined_tickets_updated_at ON predefined_tickets;
CREATE TRIGGER update_predefined_tickets_updated_at
    BEFORE UPDATE ON predefined_tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Success message
DO $$ 
BEGIN
    RAISE NOTICE 'Ticket type setup completed successfully!';
END $$;