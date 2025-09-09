-- =====================================================
-- TICKET VERIFICATION SYSTEM
-- =====================================================
-- Real-time ticket scanning and verification tracking

-- 1. Create ticket_scans table to track all scan attempts
CREATE TABLE IF NOT EXISTS ticket_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    scanned_by UUID REFERENCES profiles(id),
    scan_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    scan_status VARCHAR(50) NOT NULL, -- 'success', 'already_used', 'invalid', 'expired'
    scan_location VARCHAR(255),
    device_info JSONB,
    ip_address INET,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add verification fields to tickets table if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tickets' AND column_name = 'is_verified'
    ) THEN
        ALTER TABLE tickets ADD COLUMN is_verified BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tickets' AND column_name = 'verified_at'
    ) THEN
        ALTER TABLE tickets ADD COLUMN verified_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tickets' AND column_name = 'verified_by'
    ) THEN
        ALTER TABLE tickets ADD COLUMN verified_by UUID REFERENCES profiles(id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tickets' AND column_name = 'scan_count'
    ) THEN
        ALTER TABLE tickets ADD COLUMN scan_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- 3. Create event_verification_stats table for real-time statistics
CREATE TABLE IF NOT EXISTS event_verification_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE UNIQUE,
    total_tickets INTEGER DEFAULT 0,
    verified_tickets INTEGER DEFAULT 0,
    unverified_tickets INTEGER DEFAULT 0,
    invalid_attempts INTEGER DEFAULT 0,
    last_scan_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Function to verify ticket with one-time scan protection
CREATE OR REPLACE FUNCTION verify_ticket(
    p_ticket_number VARCHAR,
    p_event_id UUID,
    p_scanner_id UUID,
    p_location VARCHAR DEFAULT NULL,
    p_device_info JSONB DEFAULT NULL,
    p_ip_address INET DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_ticket RECORD;
    v_result JSON;
    v_scan_id UUID;
BEGIN
    -- Find the ticket
    SELECT t.*, e.title as event_title, e.date as event_date
    INTO v_ticket
    FROM tickets t
    JOIN events e ON t.event_id = e.id
    WHERE t.ticket_number = p_ticket_number
    AND t.event_id = p_event_id
    FOR UPDATE; -- Lock the row
    
    -- Check if ticket exists
    IF NOT FOUND THEN
        -- Log invalid scan attempt
        INSERT INTO ticket_scans (
            event_id, scanned_by, scan_status, 
            scan_location, device_info, ip_address
        ) VALUES (
            p_event_id, p_scanner_id, 'invalid',
            p_location, p_device_info, p_ip_address
        );
        
        RETURN json_build_object(
            'success', false,
            'status', 'invalid',
            'message', 'Invalid ticket number'
        );
    END IF;
    
    -- Check if ticket is already verified
    IF v_ticket.is_verified = true THEN
        -- Log duplicate scan attempt
        INSERT INTO ticket_scans (
            ticket_id, event_id, scanned_by, scan_status,
            scan_location, device_info, ip_address,
            notes
        ) VALUES (
            v_ticket.id, p_event_id, p_scanner_id, 'already_used',
            p_location, p_device_info, p_ip_address,
            'Ticket was already verified at ' || v_ticket.verified_at
        ) RETURNING id INTO v_scan_id;
        
        -- Increment scan count
        UPDATE tickets 
        SET scan_count = scan_count + 1
        WHERE id = v_ticket.id;
        
        RETURN json_build_object(
            'success', false,
            'status', 'already_used',
            'message', 'Ticket already verified',
            'verified_at', v_ticket.verified_at,
            'verified_by', v_ticket.verified_by,
            'ticket_info', json_build_object(
                'ticket_number', v_ticket.ticket_number,
                'event_title', v_ticket.event_title,
                'verified_time', v_ticket.verified_at
            )
        );
    END IF;
    
    -- Check if ticket is valid status
    IF v_ticket.status != 'valid' THEN
        -- Log invalid status scan
        INSERT INTO ticket_scans (
            ticket_id, event_id, scanned_by, scan_status,
            scan_location, device_info, ip_address,
            notes
        ) VALUES (
            v_ticket.id, p_event_id, p_scanner_id, 'invalid',
            p_location, p_device_info, p_ip_address,
            'Ticket status is ' || v_ticket.status
        );
        
        RETURN json_build_object(
            'success', false,
            'status', 'invalid',
            'message', 'Ticket is ' || v_ticket.status
        );
    END IF;
    
    -- Check if event date has passed (optional)
    IF v_ticket.event_date < CURRENT_DATE - INTERVAL '1 day' THEN
        -- Log expired ticket scan
        INSERT INTO ticket_scans (
            ticket_id, event_id, scanned_by, scan_status,
            scan_location, device_info, ip_address,
            notes
        ) VALUES (
            v_ticket.id, p_event_id, p_scanner_id, 'expired',
            p_location, p_device_info, p_ip_address,
            'Event date was ' || v_ticket.event_date
        );
        
        RETURN json_build_object(
            'success', false,
            'status', 'expired',
            'message', 'Event has already passed'
        );
    END IF;
    
    -- Verify the ticket
    UPDATE tickets
    SET 
        is_verified = true,
        verified_at = NOW(),
        verified_by = p_scanner_id,
        status = 'used',
        scan_count = scan_count + 1
    WHERE id = v_ticket.id;
    
    -- Log successful scan
    INSERT INTO ticket_scans (
        ticket_id, event_id, scanned_by, scan_status,
        scan_location, device_info, ip_address
    ) VALUES (
        v_ticket.id, p_event_id, p_scanner_id, 'success',
        p_location, p_device_info, p_ip_address
    ) RETURNING id INTO v_scan_id;
    
    -- Update event statistics
    UPDATE event_verification_stats
    SET 
        verified_tickets = verified_tickets + 1,
        unverified_tickets = unverified_tickets - 1,
        last_scan_time = NOW(),
        updated_at = NOW()
    WHERE event_id = p_event_id;
    
    -- Return success with ticket details
    RETURN json_build_object(
        'success', true,
        'status', 'success',
        'message', 'Ticket verified successfully',
        'scan_id', v_scan_id,
        'ticket_info', json_build_object(
            'ticket_number', v_ticket.ticket_number,
            'event_title', v_ticket.event_title,
            'event_date', v_ticket.event_date,
            'seat_number', v_ticket.seat_number,
            'section', v_ticket.section,
            'row_number', v_ticket.row_number
        )
    );
END;
$$ LANGUAGE plpgsql;

-- 5. Function to get real-time event statistics
CREATE OR REPLACE FUNCTION get_event_verification_stats(p_event_id UUID)
RETURNS JSON AS $$
DECLARE
    v_stats RECORD;
BEGIN
    -- Get or create stats
    INSERT INTO event_verification_stats (event_id, total_tickets, verified_tickets, unverified_tickets)
    SELECT 
        p_event_id,
        COUNT(*),
        COUNT(*) FILTER (WHERE is_verified = true),
        COUNT(*) FILTER (WHERE is_verified = false)
    FROM tickets
    WHERE event_id = p_event_id
    ON CONFLICT (event_id) DO UPDATE
    SET 
        total_tickets = EXCLUDED.total_tickets,
        verified_tickets = EXCLUDED.verified_tickets,
        unverified_tickets = EXCLUDED.unverified_tickets,
        updated_at = NOW();
    
    -- Get the stats
    SELECT 
        es.*,
        e.title as event_title,
        e.date as event_date,
        e.venue as event_venue,
        (
            SELECT COUNT(*) 
            FROM ticket_scans 
            WHERE event_id = p_event_id 
            AND scan_time >= NOW() - INTERVAL '1 hour'
        ) as scans_last_hour,
        (
            SELECT COUNT(*) 
            FROM ticket_scans 
            WHERE event_id = p_event_id 
            AND scan_time >= CURRENT_DATE
        ) as scans_today,
        (
            SELECT json_agg(
                json_build_object(
                    'time', scan_time,
                    'status', scan_status,
                    'ticket_number', t.ticket_number
                )
                ORDER BY scan_time DESC
            )
            FROM (
                SELECT ts.*, t.ticket_number
                FROM ticket_scans ts
                LEFT JOIN tickets t ON ts.ticket_id = t.id
                WHERE ts.event_id = p_event_id
                ORDER BY ts.scan_time DESC
                LIMIT 10
            ) t
        ) as recent_scans
    INTO v_stats
    FROM event_verification_stats es
    JOIN events e ON es.event_id = e.id
    WHERE es.event_id = p_event_id;
    
    RETURN row_to_json(v_stats);
END;
$$ LANGUAGE plpgsql;

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ticket_scans_ticket_id ON ticket_scans(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_scans_event_id ON ticket_scans(event_id);
CREATE INDEX IF NOT EXISTS idx_ticket_scans_scan_time ON ticket_scans(scan_time DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_is_verified ON tickets(is_verified);
CREATE INDEX IF NOT EXISTS idx_tickets_ticket_number ON tickets(ticket_number);

-- 7. Enable RLS
ALTER TABLE ticket_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_verification_stats ENABLE ROW LEVEL SECURITY;

-- 8. Create policies
-- Anyone can view ticket scans for events they organize
CREATE POLICY "Organizers can view ticket scans" ON ticket_scans
    FOR SELECT USING (
        event_id IN (
            SELECT id FROM events WHERE organizer_id = auth.uid()
        )
        OR auth.uid() IN (
            SELECT id FROM profiles WHERE role IN ('admin', 'scanner')
        )
    );

-- Authenticated users can create scans
CREATE POLICY "Authenticated can create scans" ON ticket_scans
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- View stats for own events
CREATE POLICY "View event stats" ON event_verification_stats
    FOR SELECT USING (
        event_id IN (
            SELECT id FROM events WHERE organizer_id = auth.uid()
        )
        OR auth.uid() IN (
            SELECT id FROM profiles WHERE role IN ('admin', 'scanner')
        )
    );

-- 9. Grant permissions
GRANT ALL ON ticket_scans TO authenticated;
GRANT ALL ON event_verification_stats TO authenticated;
GRANT EXECUTE ON FUNCTION verify_ticket TO authenticated;
GRANT EXECUTE ON FUNCTION get_event_verification_stats TO authenticated;

-- 10. Create trigger to update stats on ticket changes
CREATE OR REPLACE FUNCTION update_event_stats_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- Update stats when ticket verification status changes
    IF (TG_OP = 'UPDATE' AND OLD.is_verified != NEW.is_verified) OR TG_OP = 'INSERT' THEN
        INSERT INTO event_verification_stats (event_id, total_tickets, verified_tickets, unverified_tickets)
        SELECT 
            NEW.event_id,
            COUNT(*),
            COUNT(*) FILTER (WHERE is_verified = true),
            COUNT(*) FILTER (WHERE is_verified = false)
        FROM tickets
        WHERE event_id = NEW.event_id
        ON CONFLICT (event_id) DO UPDATE
        SET 
            total_tickets = EXCLUDED.total_tickets,
            verified_tickets = EXCLUDED.verified_tickets,
            unverified_tickets = EXCLUDED.unverified_tickets,
            updated_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_event_stats ON tickets;
CREATE TRIGGER update_event_stats
    AFTER INSERT OR UPDATE ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_event_stats_trigger();

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Ticket verification system is ready!';
    RAISE NOTICE '🎟️ One-time scan protection enabled';
    RAISE NOTICE '📊 Real-time statistics tracking enabled';
    RAISE NOTICE '🔒 Security policies applied';
END $$;