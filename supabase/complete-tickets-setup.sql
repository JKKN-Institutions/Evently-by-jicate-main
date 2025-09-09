-- =====================================================
-- COMPLETE TICKETS TABLE SETUP
-- Ensures tickets table exists with all required columns
-- =====================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table if it doesn't exist (dependency)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT,
    full_name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create events table if it doesn't exist (dependency)
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    date DATE,
    start_date DATE,
    end_date DATE,
    time TIME,
    venue TEXT,
    location TEXT,
    category TEXT,
    price DECIMAL(10,2) DEFAULT 0,
    max_attendees INTEGER DEFAULT 100,
    image_url TEXT,
    organizer_id UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bookings table if it doesn't exist (dependency)
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id),
    user_name TEXT,
    user_email TEXT,
    quantity INTEGER DEFAULT 1,
    total_amount DECIMAL(10,2),
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create or update tickets table
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    ticket_number TEXT UNIQUE NOT NULL,
    qr_code TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'valid' CHECK (status IN ('valid', 'used', 'cancelled', 'expired')),
    checked_in_at TIMESTAMP WITH TIME ZONE,
    checked_in_by UUID REFERENCES profiles(id),
    seat_number TEXT,
    ticket_type TEXT DEFAULT 'general',
    metadata JSONB,
    scan_count INTEGER DEFAULT 0
);

-- Add missing columns if table already exists
DO $$ 
BEGIN
    -- Add scan_count if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tickets' AND column_name = 'scan_count') THEN
        ALTER TABLE tickets ADD COLUMN scan_count INTEGER DEFAULT 0;
    END IF;
    
    -- Add event_id if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tickets' AND column_name = 'event_id') THEN
        ALTER TABLE tickets ADD COLUMN event_id UUID REFERENCES events(id) ON DELETE CASCADE;
        
        -- Try to populate event_id from bookings if possible
        UPDATE tickets t
        SET event_id = b.event_id
        FROM bookings b
        WHERE t.booking_id = b.id
        AND t.event_id IS NULL;
    END IF;
    
    -- Add metadata if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'tickets' AND column_name = 'metadata') THEN
        ALTER TABLE tickets ADD COLUMN metadata JSONB;
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tickets_booking_id ON tickets(booking_id);
CREATE INDEX IF NOT EXISTS idx_tickets_event_id ON tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_qr_code ON tickets(qr_code);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_scan_count ON tickets(scan_count);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at);

-- Enable RLS
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Anyone can view tickets" ON tickets;
DROP POLICY IF EXISTS "Users can view own tickets" ON tickets;
DROP POLICY IF EXISTS "Admins can manage all tickets" ON tickets;
DROP POLICY IF EXISTS "Service role can do everything" ON tickets;

-- Create simple, permissive policies for testing
CREATE POLICY "Enable read access for all users" ON tickets
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON tickets
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON tickets
    FOR UPDATE USING (true);

-- Grant permissions
GRANT ALL ON tickets TO authenticated;
GRANT ALL ON tickets TO anon;
GRANT ALL ON events TO authenticated;
GRANT ALL ON events TO anon;
GRANT ALL ON bookings TO authenticated;
GRANT ALL ON bookings TO anon;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updating timestamps
DROP TRIGGER IF EXISTS update_tickets_updated_at ON tickets;
CREATE TRIGGER update_tickets_updated_at 
    BEFORE UPDATE ON tickets
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Test data insertion (optional - comment out if not needed)
DO $$
BEGIN
    -- Only insert test data if tables are empty
    IF NOT EXISTS (SELECT 1 FROM tickets LIMIT 1) THEN
        -- Insert a test profile
        INSERT INTO profiles (id, email, full_name)
        VALUES ('11111111-1111-1111-1111-111111111111', 'test@example.com', 'Test User')
        ON CONFLICT (id) DO NOTHING;
        
        -- Insert a test event
        INSERT INTO events (id, title, description, date, venue, organizer_id)
        VALUES ('22222222-2222-2222-2222-222222222222', 'Test Event', 'Test Description', CURRENT_DATE, 'Test Venue', '11111111-1111-1111-1111-111111111111')
        ON CONFLICT (id) DO NOTHING;
        
        -- Insert a test booking
        INSERT INTO bookings (id, event_id, user_id, user_name, user_email, quantity, total_amount)
        VALUES ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Test User', 'test@example.com', 1, 0)
        ON CONFLICT (id) DO NOTHING;
        
        -- Insert a test ticket
        INSERT INTO tickets (booking_id, event_id, ticket_number, qr_code, metadata)
        VALUES (
            '33333333-3333-3333-3333-333333333333',
            '22222222-2222-2222-2222-222222222222',
            'TEST-' || EXTRACT(EPOCH FROM NOW())::TEXT,
            'QR-TEST-' || EXTRACT(EPOCH FROM NOW())::TEXT,
            '{"test": true}'::jsonb
        )
        ON CONFLICT DO NOTHING;
        
        RAISE NOTICE 'Test data inserted successfully';
    END IF;
END $$;

-- Verify setup
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM tickets;
    RAISE NOTICE 'Tickets table setup complete. Current ticket count: %', v_count;
    
    -- Check if all required columns exist
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'scan_count') THEN
        RAISE NOTICE '✓ scan_count column exists';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'event_id') THEN
        RAISE NOTICE '✓ event_id column exists';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'metadata') THEN
        RAISE NOTICE '✓ metadata column exists';
    END IF;
END $$;