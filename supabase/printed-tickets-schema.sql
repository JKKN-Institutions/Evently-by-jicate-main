-- =====================================================
-- PRINTED TICKETS SCHEMA
-- =====================================================

-- Create printed_tickets table for physical ticket QR codes
CREATE TABLE IF NOT EXISTS printed_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ticket identification
    ticket_code TEXT UNIQUE NOT NULL, -- Human-readable code like "EVT-001", "EVT-002"
    qr_code TEXT UNIQUE NOT NULL, -- Encrypted QR code data
    
    -- Event association
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    
    -- Status tracking
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'used', 'cancelled')),
    
    -- Usage tracking
    used_at TIMESTAMP WITH TIME ZONE,
    used_by UUID REFERENCES profiles(id),
    scanned_by UUID REFERENCES profiles(id),
    
    -- Additional metadata
    metadata JSONB DEFAULT '{}',
    
    -- Indexes for performance
    CONSTRAINT printed_tickets_ticket_code_key UNIQUE (ticket_code),
    CONSTRAINT printed_tickets_qr_code_key UNIQUE (qr_code)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_printed_tickets_event_id ON printed_tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_printed_tickets_status ON printed_tickets(status);
CREATE INDEX IF NOT EXISTS idx_printed_tickets_ticket_code ON printed_tickets(ticket_code);
CREATE INDEX IF NOT EXISTS idx_printed_tickets_created_at ON printed_tickets(created_at DESC);

-- Create printed_ticket_scans table for tracking all scan attempts
CREATE TABLE IF NOT EXISTS printed_ticket_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ticket reference
    printed_ticket_id UUID NOT NULL REFERENCES printed_tickets(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    
    -- Scan details
    scanned_by UUID NOT NULL REFERENCES profiles(id),
    scan_result TEXT NOT NULL CHECK (scan_result IN ('success', 'already_used', 'invalid', 'expired', 'wrong_event', 'cancelled')),
    
    -- Device and location info
    device_info JSONB DEFAULT '{}',
    location TEXT,
    ip_address TEXT,
    user_agent TEXT
);

-- Create indexes for scan tracking
CREATE INDEX IF NOT EXISTS idx_printed_ticket_scans_ticket_id ON printed_ticket_scans(printed_ticket_id);
CREATE INDEX IF NOT EXISTS idx_printed_ticket_scans_event_id ON printed_ticket_scans(event_id);
CREATE INDEX IF NOT EXISTS idx_printed_ticket_scans_created_at ON printed_ticket_scans(created_at DESC);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_printed_tickets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_printed_tickets_updated_at_trigger
    BEFORE UPDATE ON printed_tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_printed_tickets_updated_at();

-- RLS Policies for printed_tickets
ALTER TABLE printed_tickets ENABLE ROW LEVEL SECURITY;

-- Allow event organizers to manage their printed tickets
CREATE POLICY "Event organizers can manage their printed tickets" ON printed_tickets
    FOR ALL USING (
        event_id IN (
            SELECT id FROM events WHERE organizer_id = auth.uid()
        )
    );

-- Allow event staff to view and scan printed tickets
CREATE POLICY "Event staff can view printed tickets" ON printed_tickets
    FOR SELECT USING (
        event_id IN (
            SELECT event_id FROM event_staff WHERE user_id = auth.uid()
        )
    );

-- RLS Policies for printed_ticket_scans
ALTER TABLE printed_ticket_scans ENABLE ROW LEVEL SECURITY;

-- Allow event organizers and staff to view scan logs
CREATE POLICY "Event organizers and staff can view scan logs" ON printed_ticket_scans
    FOR SELECT USING (
        event_id IN (
            SELECT id FROM events WHERE organizer_id = auth.uid()
            UNION
            SELECT event_id FROM event_staff WHERE user_id = auth.uid()
        )
    );

-- Allow event staff to create scan records
CREATE POLICY "Event staff can create scan records" ON printed_ticket_scans
    FOR INSERT WITH CHECK (
        event_id IN (
            SELECT event_id FROM event_staff WHERE user_id = auth.uid()
        )
        AND scanned_by = auth.uid()
    );

-- Create a function to generate unique ticket codes based on event name
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
$$ LANGUAGE plpgsql;

-- Create a view for easy ticket management
CREATE OR REPLACE VIEW printed_tickets_with_event AS
SELECT 
    pt.*,
    e.title as event_title,
    e.date as event_date,
    e.venue as event_venue,
    e.organizer_id,
    p.full_name as scanned_by_name
FROM printed_tickets pt
JOIN events e ON pt.event_id = e.id
LEFT JOIN profiles p ON pt.scanned_by = p.id;

-- Grant necessary permissions
GRANT SELECT ON printed_tickets_with_event TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON printed_tickets TO authenticated;
GRANT ALL ON printed_ticket_scans TO authenticated;
