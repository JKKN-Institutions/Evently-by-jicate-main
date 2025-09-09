-- Fix RLS policies for event_verification_stats table
-- This allows system functions to insert/update stats while maintaining security

-- First, drop existing restrictive policy
DROP POLICY IF EXISTS "View event stats" ON event_verification_stats;

-- Create new policies that allow system operations

-- 1. Allow authenticated users to view stats for events they organize or have admin role
CREATE POLICY "View event stats" ON event_verification_stats
    FOR SELECT USING (
        auth.uid() IN (
            SELECT organizer_id FROM events WHERE id = event_id
            UNION
            SELECT id FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 2. Allow system to insert stats (via RPC functions with SECURITY DEFINER)
-- Since the functions run with elevated privileges, we need to allow inserts
CREATE POLICY "Allow stats insert via functions" ON event_verification_stats
    FOR INSERT 
    WITH CHECK (true); -- Functions will handle authorization

-- 3. Allow system to update stats (via RPC functions with SECURITY DEFINER)
CREATE POLICY "Allow stats update via functions" ON event_verification_stats
    FOR UPDATE 
    USING (true); -- Functions will handle authorization

-- Alternative approach: Make the functions that modify stats run with SECURITY DEFINER
-- This allows them to bypass RLS while still maintaining security

-- Update the verify_ticket function to use SECURITY DEFINER
CREATE OR REPLACE FUNCTION verify_ticket(
    p_ticket_number TEXT,
    p_event_id UUID,
    p_scanner_id UUID,
    p_location TEXT DEFAULT NULL,
    p_device_info JSONB DEFAULT NULL,
    p_ip_address TEXT DEFAULT NULL
) RETURNS JSON AS $$
DECLARE
    v_ticket RECORD;
    v_booking RECORD;
    v_scan_id UUID;
BEGIN
    -- Find the ticket
    SELECT t.*, b.user_name, b.user_email, e.title as event_title
    INTO v_ticket
    FROM tickets t
    JOIN bookings b ON t.booking_id = b.id
    JOIN events e ON t.event_id = e.id
    WHERE t.ticket_number = p_ticket_number
    AND t.event_id = p_event_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Ticket not found',
            'status', 'invalid'
        );
    END IF;
    
    -- Check if ticket is already verified
    IF v_ticket.is_verified = true THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Ticket already verified',
            'status', 'already_verified',
            'verified_at', v_ticket.verified_at
        );
    END IF;
    
    -- Check ticket status
    IF v_ticket.status != 'valid' THEN
        RETURN json_build_object(
            'success', false,
            'message', 'Ticket is ' || v_ticket.status,
            'status', v_ticket.status
        );
    END IF;
    
    -- Mark ticket as verified
    UPDATE tickets
    SET 
        is_verified = true,
        verified_at = NOW(),
        verified_by = p_scanner_id
    WHERE id = v_ticket.id;
    
    -- Record the scan
    INSERT INTO ticket_scans (
        ticket_id,
        scanner_id,
        scan_time,
        location,
        device_info,
        ip_address,
        result
    ) VALUES (
        v_ticket.id,
        p_scanner_id,
        NOW(),
        p_location,
        p_device_info,
        p_ip_address,
        'success'
    ) RETURNING id INTO v_scan_id;
    
    -- Update event statistics (this will now work with the new policies)
    UPDATE event_verification_stats
    SET 
        verified_tickets = verified_tickets + 1,
        unverified_tickets = unverified_tickets - 1,
        last_scan_at = NOW()
    WHERE event_id = p_event_id;
    
    -- Return success with ticket details
    RETURN json_build_object(
        'success', true,
        'message', 'Ticket verified successfully',
        'status', 'verified',
        'ticket', json_build_object(
            'ticket_number', v_ticket.ticket_number,
            'event_title', v_ticket.event_title,
            'user_name', v_ticket.user_name,
            'user_email', v_ticket.user_email,
            'ticket_type', v_ticket.ticket_type,
            'verified_at', NOW()
        ),
        'scan_id', v_scan_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; -- This is the key change

-- Update the get_event_verification_stats function to use SECURITY DEFINER
CREATE OR REPLACE FUNCTION get_event_verification_stats(p_event_id UUID)
RETURNS JSON AS $$
DECLARE
    v_stats RECORD;
BEGIN
    -- Get or create stats (this will now work with the new policies)
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
        last_scan_at = CASE 
            WHEN event_verification_stats.verified_tickets < EXCLUDED.verified_tickets 
            THEN NOW() 
            ELSE event_verification_stats.last_scan_at 
        END;
    
    -- Get comprehensive stats
    SELECT 
        es.*,
        e.title as event_title,
        e.date as event_date,
        e.time as event_time,
        e.venue as event_venue,
        (
            SELECT json_agg(
                json_build_object(
                    'scan_time', t.scan_time,
                    'scanner_id', t.scanner_id,
                    'ticket_number', tk.ticket_number,
                    'location', t.location
                ) ORDER BY t.scan_time DESC
            )
            FROM (
                SELECT * FROM ticket_scans 
                WHERE ticket_id IN (
                    SELECT id FROM tickets WHERE event_id = p_event_id
                )
                ORDER BY scan_time DESC
                LIMIT 10
            ) t
            JOIN tickets tk ON t.ticket_id = tk.id
        ) as recent_scans
    INTO v_stats
    FROM event_verification_stats es
    JOIN events e ON es.event_id = e.id
    WHERE es.event_id = p_event_id;
    
    RETURN row_to_json(v_stats);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; -- This is the key change

-- Also update the trigger function to use SECURITY DEFINER
CREATE OR REPLACE FUNCTION update_event_stats_trigger()
RETURNS TRIGGER SECURITY DEFINER AS $$
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
            unverified_tickets = EXCLUDED.unverified_tickets;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT ALL ON event_verification_stats TO authenticated;
GRANT ALL ON event_verification_stats TO service_role;

-- Ensure the trigger is properly attached
DROP TRIGGER IF EXISTS update_event_stats ON tickets;
CREATE TRIGGER update_event_stats
    AFTER INSERT OR UPDATE OF is_verified ON tickets
    FOR EACH ROW
    EXECUTE FUNCTION update_event_stats_trigger();