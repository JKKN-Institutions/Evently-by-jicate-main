-- =====================================================
-- QR SCAN ANALYTICS SCHEMA
-- Track all QR code scans and ticket verification
-- =====================================================

-- 1. Create ticket_scan_logs table for tracking all scan attempts
CREATE TABLE IF NOT EXISTS ticket_scan_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    ticket_number TEXT NOT NULL,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    scan_type TEXT CHECK (scan_type IN ('verification', 'check_in', 'preview', 'invalid')),
    scan_result TEXT CHECK (scan_result IN ('success', 'already_used', 'invalid', 'expired', 'wrong_event')),
    scanned_by UUID REFERENCES profiles(id),
    scanner_name TEXT,
    scan_location TEXT,
    device_info JSONB,
    ip_address TEXT,
    qr_data TEXT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 2. Create ticket_statistics table for aggregated metrics
CREATE TABLE IF NOT EXISTS ticket_statistics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    ticket_type TEXT DEFAULT 'Bronze',
    total_generated INTEGER DEFAULT 0,
    total_scanned INTEGER DEFAULT 0,
    total_checked_in INTEGER DEFAULT 0,
    unique_scans INTEGER DEFAULT 0,
    first_scan_at TIMESTAMP WITH TIME ZONE,
    last_scan_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(event_id, ticket_type)
);

-- 3. Add scan tracking columns to tickets table if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'scan_count') THEN
        ALTER TABLE tickets ADD COLUMN scan_count INTEGER DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'first_scanned_at') THEN
        ALTER TABLE tickets ADD COLUMN first_scanned_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'last_scanned_at') THEN
        ALTER TABLE tickets ADD COLUMN last_scanned_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tickets' AND column_name = 'scan_history') THEN
        ALTER TABLE tickets ADD COLUMN scan_history JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- 4. Create function to log ticket scans
CREATE OR REPLACE FUNCTION log_ticket_scan(
    p_ticket_number TEXT,
    p_scan_type TEXT,
    p_scan_result TEXT,
    p_scanner_id UUID DEFAULT NULL,
    p_location TEXT DEFAULT NULL,
    p_device_info JSONB DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_ticket tickets%ROWTYPE;
    v_log_id UUID;
    v_scan_count INTEGER;
BEGIN
    -- Find ticket by number
    SELECT * INTO v_ticket FROM tickets WHERE ticket_number = p_ticket_number;
    
    IF NOT FOUND THEN
        -- Log invalid scan attempt
        INSERT INTO ticket_scan_logs (
            ticket_number,
            scan_type,
            scan_result,
            scanned_by,
            scan_location,
            device_info,
            error_message
        ) VALUES (
            p_ticket_number,
            'invalid',
            'invalid',
            p_scanner_id,
            p_location,
            p_device_info,
            'Ticket not found'
        );
        
        RETURN json_build_object(
            'success', false,
            'error', 'Ticket not found'
        );
    END IF;
    
    -- Log the scan
    INSERT INTO ticket_scan_logs (
        ticket_id,
        ticket_number,
        event_id,
        scan_type,
        scan_result,
        scanned_by,
        scan_location,
        device_info,
        qr_data
    ) VALUES (
        v_ticket.id,
        v_ticket.ticket_number,
        v_ticket.event_id,
        p_scan_type,
        p_scan_result,
        p_scanner_id,
        p_location,
        p_device_info,
        v_ticket.qr_code
    ) RETURNING id INTO v_log_id;
    
    -- Update ticket scan statistics
    UPDATE tickets 
    SET 
        scan_count = COALESCE(scan_count, 0) + 1,
        first_scanned_at = COALESCE(first_scanned_at, NOW()),
        last_scanned_at = NOW(),
        scan_history = scan_history || jsonb_build_array(
            jsonb_build_object(
                'scan_id', v_log_id,
                'timestamp', NOW(),
                'type', p_scan_type,
                'result', p_scan_result,
                'scanner', p_scanner_id,
                'location', p_location
            )
        )
    WHERE id = v_ticket.id
    RETURNING scan_count INTO v_scan_count;
    
    -- Update event statistics
    INSERT INTO ticket_statistics (
        event_id,
        ticket_type,
        total_scanned,
        first_scan_at,
        last_scan_at
    ) VALUES (
        v_ticket.event_id,
        COALESCE(v_ticket.ticket_type, 'Bronze'),
        1,
        NOW(),
        NOW()
    )
    ON CONFLICT (event_id, ticket_type) 
    DO UPDATE SET 
        total_scanned = ticket_statistics.total_scanned + 1,
        last_scan_at = NOW();
    
    RETURN json_build_object(
        'success', true,
        'ticket_id', v_ticket.id,
        'scan_count', v_scan_count,
        'scan_log_id', v_log_id
    );
END;
$$ LANGUAGE plpgsql;

-- 5. Create function to get ticket analytics
CREATE OR REPLACE FUNCTION get_ticket_analytics(p_event_id UUID DEFAULT NULL)
RETURNS TABLE (
    event_id UUID,
    event_title TEXT,
    ticket_type TEXT,
    total_generated BIGINT,
    total_scanned BIGINT,
    total_unscanned BIGINT,
    total_checked_in BIGINT,
    scan_rate NUMERIC,
    check_in_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.event_id,
        e.title as event_title,
        COALESCE(t.ticket_type, 'Bronze') as ticket_type,
        COUNT(DISTINCT t.id) as total_generated,
        COUNT(DISTINCT CASE WHEN t.scan_count > 0 THEN t.id END) as total_scanned,
        COUNT(DISTINCT CASE WHEN t.scan_count IS NULL OR t.scan_count = 0 THEN t.id END) as total_unscanned,
        COUNT(DISTINCT CASE WHEN t.status = 'used' THEN t.id END) as total_checked_in,
        ROUND(COUNT(DISTINCT CASE WHEN t.scan_count > 0 THEN t.id END)::NUMERIC / NULLIF(COUNT(DISTINCT t.id), 0) * 100, 2) as scan_rate,
        ROUND(COUNT(DISTINCT CASE WHEN t.status = 'used' THEN t.id END)::NUMERIC / NULLIF(COUNT(DISTINCT t.id), 0) * 100, 2) as check_in_rate
    FROM tickets t
    LEFT JOIN events e ON t.event_id = e.id
    WHERE (p_event_id IS NULL OR t.event_id = p_event_id)
    GROUP BY t.event_id, e.title, t.ticket_type
    ORDER BY t.event_id, t.ticket_type;
END;
$$ LANGUAGE plpgsql;

-- 6. Create view for real-time analytics
CREATE OR REPLACE VIEW ticket_scan_analytics AS
SELECT 
    t.event_id,
    e.title as event_name,
    t.ticket_type,
    COUNT(DISTINCT t.id) as total_tickets,
    COUNT(DISTINCT CASE WHEN t.scan_count > 0 THEN t.id END) as scanned_tickets,
    COUNT(DISTINCT CASE WHEN t.scan_count IS NULL OR t.scan_count = 0 THEN t.id END) as unscanned_tickets,
    COUNT(DISTINCT CASE WHEN t.status = 'used' THEN t.id END) as checked_in_tickets,
    COUNT(DISTINCT CASE WHEN t.status = 'valid' THEN t.id END) as valid_tickets,
    COUNT(DISTINCT CASE WHEN t.status = 'cancelled' THEN t.id END) as cancelled_tickets,
    SUM(COALESCE(t.scan_count, 0)) as total_scan_attempts,
    AVG(COALESCE(t.scan_count, 0)) as avg_scans_per_ticket,
    MAX(t.last_scanned_at) as last_scan_time,
    MIN(t.first_scanned_at) as first_scan_time
FROM tickets t
LEFT JOIN events e ON t.event_id = e.id
GROUP BY t.event_id, e.title, t.ticket_type;

-- 7. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ticket_scan_logs_ticket_id ON ticket_scan_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_scan_logs_event_id ON ticket_scan_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_ticket_scan_logs_created_at ON ticket_scan_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_scan_logs_scan_type ON ticket_scan_logs(scan_type);
CREATE INDEX IF NOT EXISTS idx_ticket_scan_logs_scan_result ON ticket_scan_logs(scan_result);
CREATE INDEX IF NOT EXISTS idx_tickets_scan_count ON tickets(scan_count);
CREATE INDEX IF NOT EXISTS idx_tickets_first_scanned ON tickets(first_scanned_at);
CREATE INDEX IF NOT EXISTS idx_tickets_last_scanned ON tickets(last_scanned_at);

-- 8. Create trigger to update statistics on ticket generation
CREATE OR REPLACE FUNCTION update_ticket_generation_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Update or insert statistics for new ticket
    INSERT INTO ticket_statistics (
        event_id,
        ticket_type,
        total_generated
    ) VALUES (
        NEW.event_id,
        COALESCE(NEW.ticket_type, 'Bronze'),
        1
    )
    ON CONFLICT (event_id, ticket_type) 
    DO UPDATE SET 
        total_generated = ticket_statistics.total_generated + 1,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_ticket_stats_on_insert ON tickets;
CREATE TRIGGER update_ticket_stats_on_insert
    AFTER INSERT ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_ticket_generation_stats();

-- 9. RLS Policies
ALTER TABLE ticket_scan_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_statistics ENABLE ROW LEVEL SECURITY;

-- Admins can view all scan logs
CREATE POLICY "Admins can view all scan logs" ON ticket_scan_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Event organizers can view their event scan logs
CREATE POLICY "Organizers can view event scan logs" ON ticket_scan_logs
    FOR SELECT
    TO authenticated
    USING (
        event_id IN (
            SELECT id FROM events WHERE organizer_id = auth.uid()
        )
    );

-- Statistics policies
CREATE POLICY "Anyone can view statistics" ON ticket_statistics
    FOR SELECT
    TO authenticated
    USING (true);

-- 10. Grant permissions
GRANT ALL ON ticket_scan_logs TO authenticated;
GRANT ALL ON ticket_statistics TO authenticated;
GRANT SELECT ON ticket_scan_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION log_ticket_scan TO authenticated;
GRANT EXECUTE ON FUNCTION get_ticket_analytics TO authenticated;

-- Success message
DO $$ 
BEGIN
    RAISE NOTICE 'QR Scan Analytics schema created successfully!';
END $$;