-- =====================================================
-- FIX PRINTED TICKETS ADMIN ACCESS
-- =====================================================

-- Ensure printed_tickets table exists
CREATE TABLE IF NOT EXISTS printed_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ticket identification
    ticket_code TEXT UNIQUE NOT NULL,
    qr_code TEXT UNIQUE NOT NULL,
    
    -- Event association
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    
    -- Status tracking
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'used', 'cancelled')),
    
    -- Usage tracking
    used_at TIMESTAMP WITH TIME ZONE,
    used_by UUID REFERENCES profiles(id),
    scanned_by UUID REFERENCES profiles(id),
    
    -- Additional metadata
    metadata JSONB DEFAULT '{}'
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_printed_tickets_event_id ON printed_tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_printed_tickets_status ON printed_tickets(status);
CREATE INDEX IF NOT EXISTS idx_printed_tickets_ticket_code ON printed_tickets(ticket_code);
CREATE INDEX IF NOT EXISTS idx_printed_tickets_created_at ON printed_tickets(created_at DESC);

-- Enable RLS
ALTER TABLE printed_tickets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Event organizers can manage their printed tickets" ON printed_tickets;
DROP POLICY IF EXISTS "Event staff can view printed tickets" ON printed_tickets;
DROP POLICY IF EXISTS "printed_tickets_organizer_access" ON printed_tickets;
DROP POLICY IF EXISTS "printed_tickets_admin_access" ON printed_tickets;

-- Create new comprehensive policies
-- 1. Event organizers can manage their printed tickets
CREATE POLICY "printed_tickets_organizer_access" ON printed_tickets
    FOR ALL USING (
        event_id IN (
            SELECT id FROM events WHERE organizer_id = auth.uid()
        )
    );

-- 2. Admins can manage all printed tickets
CREATE POLICY "printed_tickets_admin_access" ON printed_tickets
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() 
            AND role = 'admin'
        )
    );

-- 3. Service role can do anything
CREATE POLICY "printed_tickets_service_role" ON printed_tickets
    FOR ALL USING (auth.role() = 'service_role');

-- Create the ticket code generation function if it doesn't exist
CREATE OR REPLACE FUNCTION generate_printed_ticket_code(event_id_param UUID)
RETURNS TEXT AS $$
DECLARE
    event_title TEXT;
    event_prefix TEXT;
    ticket_count INTEGER;
    ticket_code TEXT;
    words TEXT[];
    word TEXT;
    prefix_parts TEXT[];
BEGIN
    -- Get event title
    SELECT title INTO event_title FROM events WHERE id = event_id_param;
    
    IF event_title IS NULL THEN
        RETURN 'UNK-001';
    END IF;
    
    -- Clean title and split into words
    event_title := REGEXP_REPLACE(event_title, '[^a-zA-Z0-9\s]', '', 'g');
    words := STRING_TO_ARRAY(event_title, ' ');
    
    -- Build prefix from first 3 characters of each word, max 6 chars total
    prefix_parts := ARRAY[]::TEXT[];
    FOREACH word IN ARRAY words
    LOOP
        IF word != '' AND LENGTH(ARRAY_TO_STRING(prefix_parts, '')) < 6 THEN
            prefix_parts := prefix_parts || UPPER(SUBSTRING(word FROM 1 FOR 3));
        END IF;
    END LOOP;
    
    event_prefix := SUBSTRING(ARRAY_TO_STRING(prefix_parts, '') FROM 1 FOR 6);
    
    -- Fallback if no valid prefix
    IF event_prefix = '' OR event_prefix IS NULL THEN
        event_prefix := 'EVT';
    END IF;
    
    -- Get current count of printed tickets for this event
    SELECT COUNT(*) INTO ticket_count
    FROM printed_tickets WHERE event_id = event_id_param;
    
    -- Generate ticket code: PREFIX-XXX (e.g., JICEVE-001, MUSCON-002)
    ticket_code := event_prefix || '-' || LPAD((ticket_count + 1)::TEXT, 3, '0');
    
    RETURN ticket_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure qr_codes table supports printed_ticket type
DO $$
BEGIN
    -- Check if qr_codes table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'qr_codes') THEN
        -- Update the check constraint to include 'printed_ticket'
        ALTER TABLE qr_codes DROP CONSTRAINT IF EXISTS qr_codes_qr_type_check;
        ALTER TABLE qr_codes ADD CONSTRAINT qr_codes_qr_type_check 
            CHECK (qr_type IN ('generic', 'ticket', 'event', 'custom', 'printed_ticket'));
        RAISE NOTICE 'Updated qr_codes table to support printed_ticket type';
    ELSE
        -- Create qr_codes table if it doesn't exist
        CREATE TABLE qr_codes (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            
            -- QR Code Data
            qr_data TEXT NOT NULL UNIQUE,
            qr_hash TEXT NOT NULL UNIQUE,
            
            -- Associated Data
            ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
            event_id UUID REFERENCES events(id) ON DELETE CASCADE,
            
            -- QR Code Properties
            qr_type TEXT DEFAULT 'generic' CHECK (qr_type IN ('generic', 'ticket', 'event', 'custom', 'printed_ticket')),
            description TEXT,
            
            -- Status
            is_active BOOLEAN DEFAULT TRUE,
            expires_at TIMESTAMP WITH TIME ZONE,
            
            -- Metadata
            created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
            metadata JSONB DEFAULT '{}'::jsonb
        );
        
        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_qr_codes_hash ON qr_codes(qr_hash);
        CREATE INDEX IF NOT EXISTS idx_qr_codes_ticket ON qr_codes(ticket_id);
        CREATE INDEX IF NOT EXISTS idx_qr_codes_event ON qr_codes(event_id);
        CREATE INDEX IF NOT EXISTS idx_qr_codes_type ON qr_codes(qr_type);
        CREATE INDEX IF NOT EXISTS idx_qr_codes_active ON qr_codes(is_active);
        
        -- Enable RLS
        ALTER TABLE qr_codes ENABLE ROW LEVEL SECURITY;
        
        -- Create policies
        CREATE POLICY "qr_codes_admin_access" ON qr_codes
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM profiles 
                    WHERE id = auth.uid() 
                    AND role = 'admin'
                )
            );
            
        CREATE POLICY "qr_codes_organizer_access" ON qr_codes
            FOR ALL USING (
                created_by = auth.uid() OR
                event_id IN (
                    SELECT id FROM events WHERE organizer_id = auth.uid()
                )
            );
        
        RAISE NOTICE 'Created qr_codes table with printed_ticket support';
    END IF;
END $$;

-- Grant permissions
GRANT ALL ON printed_tickets TO authenticated;
GRANT ALL ON printed_tickets TO service_role;
GRANT ALL ON qr_codes TO authenticated;
GRANT ALL ON qr_codes TO service_role;

-- Verify setup
DO $$
BEGIN
    -- Check if table exists and has proper structure
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'printed_tickets'
    ) THEN
        RAISE NOTICE 'printed_tickets table exists and is ready';
    ELSE
        RAISE EXCEPTION 'printed_tickets table was not created properly';
    END IF;
    
    -- Check if RLS is enabled
    IF EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename = 'printed_tickets' 
        AND rowsecurity = true
    ) THEN
        RAISE NOTICE 'RLS is enabled on printed_tickets table';
    ELSE
        RAISE EXCEPTION 'RLS is not enabled on printed_tickets table';
    END IF;
    
    RAISE NOTICE 'Printed tickets admin access fix completed successfully';
END $$;
