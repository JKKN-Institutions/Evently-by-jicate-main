-- =====================================================
-- TICKETING SYSTEM SCHEMA
-- =====================================================

-- Create tickets table
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    ticket_number TEXT UNIQUE NOT NULL,
    qr_code TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'valid' CHECK (status IN ('valid', 'used', 'cancelled', 'expired')),
    checked_in_at TIMESTAMP WITH TIME ZONE,
    checked_in_by UUID REFERENCES profiles(id),
    seat_number TEXT,
    ticket_type TEXT DEFAULT 'general',
    metadata JSONB
);

-- Create check_ins table for tracking all check-in attempts
CREATE TABLE IF NOT EXISTS check_ins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    scanned_by UUID NOT NULL REFERENCES profiles(id),
    scan_result TEXT NOT NULL CHECK (scan_result IN ('success', 'already_used', 'invalid', 'expired', 'wrong_event')),
    device_info JSONB,
    location TEXT,
    ip_address TEXT
);

-- Create event_staff table for managing who can scan tickets
CREATE TABLE IF NOT EXISTS event_staff (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'scanner' CHECK (role IN ('scanner', 'manager', 'admin')),
    permissions JSONB DEFAULT '{"can_scan": true, "can_view_analytics": false, "can_manage_staff": false}'::jsonb,
    UNIQUE(event_id, user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tickets_booking_id ON tickets(booking_id);
CREATE INDEX IF NOT EXISTS idx_tickets_event_id ON tickets(event_id);
CREATE INDEX IF NOT EXISTS idx_tickets_qr_code ON tickets(qr_code);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_check_ins_ticket_id ON check_ins(ticket_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_event_id ON check_ins(event_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_created_at ON check_ins(created_at);
CREATE INDEX IF NOT EXISTS idx_event_staff_event_id ON event_staff(event_id);
CREATE INDEX IF NOT EXISTS idx_event_staff_user_id ON event_staff(user_id);

-- Update trigger for tickets
DROP TRIGGER IF EXISTS update_tickets_updated_at ON tickets;
CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate ticket after successful payment
CREATE OR REPLACE FUNCTION generate_tickets_after_payment()
RETURNS TRIGGER AS $$
DECLARE
    v_booking bookings%ROWTYPE;
    v_event events%ROWTYPE;
    v_ticket_number TEXT;
    v_qr_data TEXT;
    i INTEGER;
BEGIN
    -- Only generate tickets when payment is captured
    IF NEW.status = 'captured' AND OLD.status != 'captured' THEN
        -- Get booking details
        SELECT * INTO v_booking FROM bookings WHERE id = NEW.booking_id;
        
        -- Get event details
        SELECT * INTO v_event FROM events WHERE id = v_booking.event_id;
        
        -- Generate tickets based on quantity
        FOR i IN 1..v_booking.quantity LOOP
            -- Generate unique ticket number
            v_ticket_number := v_event.id::TEXT || '-' || v_booking.id::TEXT || '-' || i::TEXT || '-' || 
                              EXTRACT(EPOCH FROM NOW())::TEXT;
            
            -- Generate QR code data (this will be encrypted in the application)
            v_qr_data := json_build_object(
                'ticket_id', uuid_generate_v4(),
                'event_id', v_event.id,
                'booking_id', v_booking.id,
                'ticket_number', v_ticket_number
            )::TEXT;
            
            -- Insert ticket
            INSERT INTO tickets (
                booking_id,
                event_id,
                ticket_number,
                qr_code,
                ticket_type,
                metadata
            ) VALUES (
                v_booking.id,
                v_event.id,
                v_ticket_number,
                v_qr_data,
                'general',
                json_build_object(
                    'event_title', v_event.title,
                    'event_date', v_event.date,
                    'event_time', v_event.time,
                    'venue', v_event.venue,
                    'customer_name', v_booking.user_name,
                    'customer_email', v_booking.user_email
                )
            );
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to generate tickets after payment
DROP TRIGGER IF EXISTS generate_tickets_on_payment_success ON payments;
CREATE TRIGGER generate_tickets_on_payment_success
    AFTER UPDATE OF status ON payments
    FOR EACH ROW
    WHEN (NEW.status = 'captured' AND OLD.status != 'captured')
    EXECUTE FUNCTION generate_tickets_after_payment();

-- Function to validate and check-in ticket
CREATE OR REPLACE FUNCTION validate_ticket_checkin(
    p_qr_code TEXT,
    p_event_id UUID,
    p_scanner_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_ticket tickets%ROWTYPE;
    v_result JSON;
    v_scan_result TEXT;
    v_check_in_id UUID;
BEGIN
    -- Find ticket by QR code
    SELECT * INTO v_ticket FROM tickets WHERE qr_code = p_qr_code;
    
    -- Check if ticket exists
    IF NOT FOUND THEN
        v_scan_result := 'invalid';
        v_result := json_build_object(
            'success', false,
            'message', 'Invalid ticket - QR code not found',
            'scan_result', v_scan_result
        );
    -- Check if ticket is for the correct event
    ELSIF v_ticket.event_id != p_event_id THEN
        v_scan_result := 'wrong_event';
        v_result := json_build_object(
            'success', false,
            'message', 'This ticket is for a different event',
            'scan_result', v_scan_result,
            'ticket_info', json_build_object(
                'ticket_number', v_ticket.ticket_number
            )
        );
    -- Check if ticket was already used
    ELSIF v_ticket.status = 'used' THEN
        v_scan_result := 'already_used';
        v_result := json_build_object(
            'success', false,
            'message', 'Ticket already checked in at ' || v_ticket.checked_in_at,
            'scan_result', v_scan_result,
            'ticket_info', json_build_object(
                'ticket_number', v_ticket.ticket_number,
                'checked_in_at', v_ticket.checked_in_at
            )
        );
    -- Check if ticket is cancelled
    ELSIF v_ticket.status = 'cancelled' THEN
        v_scan_result := 'invalid';
        v_result := json_build_object(
            'success', false,
            'message', 'This ticket has been cancelled',
            'scan_result', v_scan_result
        );
    -- Valid ticket - proceed with check-in
    ELSE
        v_scan_result := 'success';
        
        -- Update ticket status
        UPDATE tickets 
        SET status = 'used',
            checked_in_at = NOW(),
            checked_in_by = p_scanner_id
        WHERE id = v_ticket.id;
        
        v_result := json_build_object(
            'success', true,
            'message', 'Check-in successful!',
            'scan_result', v_scan_result,
            'ticket_info', v_ticket.metadata
        );
    END IF;
    
    -- Log the check-in attempt
    INSERT INTO check_ins (
        ticket_id,
        event_id,
        scanned_by,
        scan_result
    ) VALUES (
        v_ticket.id,
        p_event_id,
        p_scanner_id,
        v_scan_result
    ) RETURNING id INTO v_check_in_id;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies for tickets
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- Users can view their own tickets
CREATE POLICY "Users can view own tickets" ON tickets
    FOR SELECT USING (
        booking_id IN (
            SELECT id FROM bookings WHERE user_id = auth.uid()
        )
    );

-- Event staff can view event tickets
CREATE POLICY "Event staff can view event tickets" ON tickets
    FOR SELECT USING (
        event_id IN (
            SELECT event_id FROM event_staff WHERE user_id = auth.uid()
        )
    );

-- RLS Policies for check_ins
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;

-- Event staff can view check-ins for their events
CREATE POLICY "Event staff can view event check-ins" ON check_ins
    FOR SELECT USING (
        event_id IN (
            SELECT event_id FROM event_staff WHERE user_id = auth.uid()
        )
    );

-- Event staff can create check-ins
CREATE POLICY "Event staff can create check-ins" ON check_ins
    FOR INSERT WITH CHECK (
        event_id IN (
            SELECT event_id FROM event_staff WHERE user_id = auth.uid()
        ) AND scanned_by = auth.uid()
    );

-- RLS Policies for event_staff
ALTER TABLE event_staff ENABLE ROW LEVEL SECURITY;

-- Event organizers can manage staff
CREATE POLICY "Organizers can manage event staff" ON event_staff
    FOR ALL USING (
        event_id IN (
            SELECT id FROM events WHERE organizer_id = auth.uid()
        )
    );

-- Staff can view their own assignments
CREATE POLICY "Staff can view own assignments" ON event_staff
    FOR SELECT USING (user_id = auth.uid());

-- Grant permissions
GRANT ALL ON tickets TO authenticated;
GRANT ALL ON check_ins TO authenticated;
GRANT ALL ON event_staff TO authenticated;
