-- =====================================================
-- SEAT ALLOCATION SETUP
-- =====================================================
-- This script sets up seat allocation for events

-- 1. Create event_seat_config table if not exists
CREATE TABLE IF NOT EXISTS event_seat_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE UNIQUE,
    has_seat_allocation BOOLEAN DEFAULT false,
    total_seats INTEGER,
    seat_layout_type VARCHAR(50) DEFAULT 'sequential', -- sequential, rows, sections
    sections JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create event_seats table if not exists
CREATE TABLE IF NOT EXISTS event_seats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    seat_number VARCHAR(20) NOT NULL,
    row_number VARCHAR(10),
    section VARCHAR(50),
    zone VARCHAR(50),
    seat_type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'available', -- available, reserved, booked, blocked
    price_override DECIMAL(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(event_id, seat_number)
);

-- 3. Create booking_seats table if not exists (links bookings to seats)
CREATE TABLE IF NOT EXISTS booking_seats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
    seat_id UUID REFERENCES event_seats(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(booking_id, seat_id)
);

-- 4. Add seat_id column to tickets table if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tickets' AND column_name = 'seat_id'
    ) THEN
        ALTER TABLE tickets ADD COLUMN seat_id UUID REFERENCES event_seats(id);
    END IF;
END $$;

-- 5. Create function to generate seats for an event
CREATE OR REPLACE FUNCTION generate_event_seats(
    p_event_id UUID,
    p_total_seats INTEGER,
    p_layout_type VARCHAR(50) DEFAULT 'sequential'
)
RETURNS INTEGER AS $$
DECLARE
    v_seat_count INTEGER := 0;
    v_row_number INTEGER;
    v_seat_in_row INTEGER;
    v_seats_per_row INTEGER := 10; -- Default seats per row
BEGIN
    -- Delete existing seats for this event
    DELETE FROM event_seats WHERE event_id = p_event_id;
    
    IF p_layout_type = 'sequential' THEN
        -- Generate sequential seat numbers
        FOR i IN 1..p_total_seats LOOP
            INSERT INTO event_seats (event_id, seat_number, status)
            VALUES (p_event_id, i::VARCHAR, 'available');
            v_seat_count := v_seat_count + 1;
        END LOOP;
    ELSIF p_layout_type = 'rows' THEN
        -- Generate seats with rows (e.g., A1, A2, B1, B2)
        v_row_number := 0;
        FOR i IN 1..p_total_seats LOOP
            v_seat_in_row := ((i - 1) % v_seats_per_row) + 1;
            IF v_seat_in_row = 1 THEN
                v_row_number := v_row_number + 1;
            END IF;
            
            INSERT INTO event_seats (event_id, seat_number, row_number, status)
            VALUES (
                p_event_id, 
                CHR(64 + v_row_number) || v_seat_in_row::VARCHAR,
                CHR(64 + v_row_number),
                'available'
            );
            v_seat_count := v_seat_count + 1;
        END LOOP;
    END IF;
    
    RETURN v_seat_count;
END;
$$ LANGUAGE plpgsql;

-- 6. Create function to allocate next available seat
CREATE OR REPLACE FUNCTION allocate_next_available_seat(
    p_event_id UUID,
    p_booking_id UUID DEFAULT NULL,
    p_ticket_id UUID DEFAULT NULL
)
RETURNS TABLE(
    seat_id UUID,
    seat_number VARCHAR,
    row_number VARCHAR,
    section VARCHAR
) AS $$
DECLARE
    v_seat RECORD;
BEGIN
    -- Find the first available seat
    SELECT * INTO v_seat
    FROM event_seats
    WHERE event_id = p_event_id
    AND status = 'available'
    ORDER BY 
        CASE 
            WHEN seat_number ~ '^[0-9]+$' THEN CAST(seat_number AS INTEGER)
            ELSE 999999
        END,
        seat_number
    LIMIT 1
    FOR UPDATE; -- Lock the row to prevent race conditions
    
    IF v_seat IS NOT NULL THEN
        -- Mark seat as booked
        UPDATE event_seats
        SET status = 'booked',
            updated_at = NOW()
        WHERE id = v_seat.id;
        
        -- Link to booking if provided
        IF p_booking_id IS NOT NULL THEN
            INSERT INTO booking_seats (booking_id, seat_id)
            VALUES (p_booking_id, v_seat.id)
            ON CONFLICT DO NOTHING;
        END IF;
        
        -- Update ticket with seat if provided
        IF p_ticket_id IS NOT NULL THEN
            UPDATE tickets
            SET seat_id = v_seat.id
            WHERE id = p_ticket_id;
        END IF;
        
        RETURN QUERY
        SELECT v_seat.id, v_seat.seat_number, v_seat.row_number, v_seat.section;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 7. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_event_seats_event_id ON event_seats(event_id);
CREATE INDEX IF NOT EXISTS idx_event_seats_status ON event_seats(status);
CREATE INDEX IF NOT EXISTS idx_booking_seats_booking_id ON booking_seats(booking_id);
CREATE INDEX IF NOT EXISTS idx_tickets_seat_id ON tickets(seat_id);

-- 8. Enable RLS
ALTER TABLE event_seat_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_seats ENABLE ROW LEVEL SECURITY;

-- 9. Create policies
-- Public can view seat configuration
CREATE POLICY "Public can view seat config" ON event_seat_config
    FOR SELECT USING (true);

-- Public can view seats
CREATE POLICY "Public can view seats" ON event_seats
    FOR SELECT USING (true);

-- Authenticated users can book seats
CREATE POLICY "Users can book seats" ON event_seats
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Users can view their booking seats
CREATE POLICY "Users can view their booking seats" ON booking_seats
    FOR SELECT USING (
        booking_id IN (
            SELECT id FROM bookings WHERE user_id = auth.uid()
        )
    );

-- 10. Grant permissions
GRANT ALL ON event_seat_config TO authenticated;
GRANT SELECT ON event_seat_config TO anon;
GRANT ALL ON event_seats TO authenticated;
GRANT SELECT ON event_seats TO anon;
GRANT ALL ON booking_seats TO authenticated;
GRANT EXECUTE ON FUNCTION generate_event_seats TO authenticated;
GRANT EXECUTE ON FUNCTION allocate_next_available_seat TO authenticated;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Seat allocation system is ready!';
    RAISE NOTICE '🎟️ Tables created: event_seat_config, event_seats, booking_seats';
    RAISE NOTICE '🔧 Functions created: generate_event_seats, allocate_next_available_seat';
    RAISE NOTICE '🔒 RLS policies applied';
END $$;