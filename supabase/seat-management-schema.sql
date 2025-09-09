-- =====================================================
-- SEAT MANAGEMENT SYSTEM FOR EVENTS
-- =====================================================

-- 1. Add seat configuration columns to events table
-- (Since we can't ALTER TABLE, we'll use a separate configuration table)

-- =====================================================
-- SEAT CONFIGURATION TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS event_seat_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    
    -- Seat Configuration
    has_seat_allocation BOOLEAN DEFAULT false,
    total_seats INTEGER,
    seat_layout_type TEXT CHECK (seat_layout_type IN ('sequential', 'rows', 'sections', 'custom')),
    
    -- For Row-based seating (like theaters)
    rows_count INTEGER,
    seats_per_row INTEGER,
    
    -- For Section-based seating (like stadiums)
    sections JSONB, -- Array of sections with names and seat counts
    
    -- Pricing per seat type
    seat_pricing JSONB, -- Different prices for different sections/rows
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_event_seat_config UNIQUE(event_id)
);

-- =====================================================
-- SEAT INVENTORY TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS event_seats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    
    -- Seat Identification
    seat_number VARCHAR(10) NOT NULL, -- e.g., "A1", "B12", "101"
    row_number VARCHAR(5), -- e.g., "A", "B", "1"
    section VARCHAR(50), -- e.g., "VIP", "General", "Balcony"
    
    -- Seat Status
    status TEXT DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'booked', 'blocked')),
    
    -- Booking Information (when seat is booked)
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    booked_at TIMESTAMPTZ,
    
    -- Seat Properties
    seat_type TEXT DEFAULT 'standard' CHECK (seat_type IN ('standard', 'vip', 'premium', 'wheelchair', 'companion')),
    price_override DECIMAL(10, 2), -- Override event's base price for special seats
    
    -- Additional Info
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_event_seat UNIQUE(event_id, seat_number)
);

-- =====================================================
-- BOOKING SEATS TABLE (Many-to-many relationship)
-- =====================================================
CREATE TABLE IF NOT EXISTS booking_seats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    seat_id UUID NOT NULL REFERENCES event_seats(id) ON DELETE CASCADE,
    
    -- Attendee info for this specific seat
    attendee_name VARCHAR(255),
    attendee_email VARCHAR(255),
    attendee_phone VARCHAR(20),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_booking_seat UNIQUE(booking_id, seat_id)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_event_seats_event_id ON event_seats(event_id);
CREATE INDEX IF NOT EXISTS idx_event_seats_status ON event_seats(status);
CREATE INDEX IF NOT EXISTS idx_event_seats_booking_id ON event_seats(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_seats_booking_id ON booking_seats(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_seats_seat_id ON booking_seats(seat_id);

-- =====================================================
-- FUNCTION TO GENERATE SEATS FOR AN EVENT
-- =====================================================
CREATE OR REPLACE FUNCTION generate_event_seats(
    p_event_id UUID,
    p_total_seats INTEGER,
    p_layout_type TEXT DEFAULT 'sequential'
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_seat_counter INTEGER := 1;
    v_row_letter CHAR;
    v_row_counter INTEGER;
    v_seat_in_row INTEGER;
    v_seats_per_row INTEGER;
    v_total_rows INTEGER;
    v_generated_count INTEGER := 0;
BEGIN
    -- Clear existing seats for this event (in case of regeneration)
    DELETE FROM event_seats WHERE event_id = p_event_id;
    
    IF p_layout_type = 'sequential' THEN
        -- Generate simple sequential seats (1, 2, 3, ...)
        WHILE v_seat_counter <= p_total_seats LOOP
            INSERT INTO event_seats (event_id, seat_number, status)
            VALUES (p_event_id, v_seat_counter::TEXT, 'available');
            
            v_seat_counter := v_seat_counter + 1;
            v_generated_count := v_generated_count + 1;
        END LOOP;
        
    ELSIF p_layout_type = 'rows' THEN
        -- Generate row-based seats (A1, A2, B1, B2, ...)
        v_seats_per_row := CEIL(SQRT(p_total_seats::FLOAT))::INTEGER;
        v_total_rows := CEIL(p_total_seats::FLOAT / v_seats_per_row)::INTEGER;
        
        FOR v_row_counter IN 1..v_total_rows LOOP
            v_row_letter := CHR(64 + v_row_counter); -- A, B, C, ...
            
            FOR v_seat_in_row IN 1..v_seats_per_row LOOP
                EXIT WHEN v_generated_count >= p_total_seats;
                
                INSERT INTO event_seats (event_id, seat_number, row_number, status)
                VALUES (
                    p_event_id, 
                    v_row_letter || v_seat_in_row::TEXT,
                    v_row_letter::TEXT,
                    'available'
                );
                
                v_generated_count := v_generated_count + 1;
            END LOOP;
        END LOOP;
        
    END IF;
    
    RETURN v_generated_count;
END;
$$;

-- =====================================================
-- FUNCTION TO ALLOCATE SEATS TO A BOOKING
-- =====================================================
CREATE OR REPLACE FUNCTION allocate_seats_to_booking(
    p_booking_id UUID,
    p_event_id UUID,
    p_quantity INTEGER
)
RETURNS TABLE (
    seat_id UUID,
    seat_number VARCHAR(10),
    row_number VARCHAR(5),
    section VARCHAR(50)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_allocated_count INTEGER := 0;
    v_seat RECORD;
BEGIN
    -- Find and allocate available seats
    FOR v_seat IN 
        SELECT id, seat_number AS s_number, row_number AS r_number, section AS s_section
        FROM event_seats
        WHERE event_id = p_event_id
        AND status = 'available'
        ORDER BY 
            CASE 
                WHEN row_number IS NOT NULL THEN row_number
                ELSE '999'
            END,
            seat_number
        LIMIT p_quantity
        FOR UPDATE
    LOOP
        -- Mark seat as booked
        UPDATE event_seats
        SET 
            status = 'booked',
            booking_id = p_booking_id,
            booked_at = NOW()
        WHERE id = v_seat.id;
        
        -- Add to booking_seats
        INSERT INTO booking_seats (booking_id, seat_id)
        VALUES (p_booking_id, v_seat.id);
        
        -- Return the allocated seat
        seat_id := v_seat.id;
        seat_number := v_seat.s_number;
        row_number := v_seat.r_number;
        section := v_seat.s_section;
        RETURN NEXT;
        
        v_allocated_count := v_allocated_count + 1;
    END LOOP;
    
    -- Check if we allocated enough seats
    IF v_allocated_count < p_quantity THEN
        RAISE EXCEPTION 'Not enough available seats. Requested: %, Available: %', 
            p_quantity, v_allocated_count;
    END IF;
END;
$$;

-- =====================================================
-- FUNCTION TO GET AVAILABLE SEATS COUNT
-- =====================================================
CREATE OR REPLACE FUNCTION get_available_seats_count(p_event_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
    SELECT COUNT(*)::INTEGER
    FROM event_seats
    WHERE event_id = p_event_id
    AND status = 'available';
$$;

-- =====================================================
-- FUNCTION TO RELEASE SEATS (for cancelled bookings)
-- =====================================================
CREATE OR REPLACE FUNCTION release_booking_seats(p_booking_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_released_count INTEGER;
BEGIN
    -- Release the seats
    UPDATE event_seats
    SET 
        status = 'available',
        booking_id = NULL,
        booked_at = NULL
    WHERE booking_id = p_booking_id;
    
    GET DIAGNOSTICS v_released_count = ROW_COUNT;
    
    -- Remove from booking_seats
    DELETE FROM booking_seats WHERE booking_id = p_booking_id;
    
    RETURN v_released_count;
END;
$$;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE event_seat_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_seats ENABLE ROW LEVEL SECURITY;

-- Policies for event_seat_config
CREATE POLICY "Anyone can view seat configs"
ON event_seat_config FOR SELECT
USING (true);

CREATE POLICY "Event organizers can manage seat configs"
ON event_seat_config FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM events
        WHERE events.id = event_seat_config.event_id
        AND events.organizer_id = auth.uid()
    )
);

-- Policies for event_seats
CREATE POLICY "Anyone can view available seats"
ON event_seats FOR SELECT
USING (true);

CREATE POLICY "Event organizers can manage seats"
ON event_seats FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM events
        WHERE events.id = event_seats.event_id
        AND events.organizer_id = auth.uid()
    )
);

-- Policies for booking_seats
CREATE POLICY "Users can view their booked seats"
ON booking_seats FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM bookings
        WHERE bookings.id = booking_seats.booking_id
        AND bookings.user_id = auth.uid()
    )
);

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
GRANT ALL ON event_seat_config TO authenticated;
GRANT ALL ON event_seats TO authenticated;
GRANT ALL ON booking_seats TO authenticated;
GRANT EXECUTE ON FUNCTION generate_event_seats(UUID, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION allocate_seats_to_booking(UUID, UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_available_seats_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION release_booking_seats(UUID) TO authenticated;

-- =====================================================
-- SAMPLE: Generate seats for testing
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '================================================';
    RAISE NOTICE '✅ SEAT MANAGEMENT SYSTEM CREATED SUCCESSFULLY!';
    RAISE NOTICE '================================================';
    RAISE NOTICE '';
    RAISE NOTICE '📺 Tables Created:';
    RAISE NOTICE '   - event_seat_config (seat configuration)';
    RAISE NOTICE '   - event_seats (individual seats)';
    RAISE NOTICE '   - booking_seats (seat assignments)';
    RAISE NOTICE '';
    RAISE NOTICE '🔧 Functions Available:';
    RAISE NOTICE '   - generate_event_seats() - Auto-generate seats';
    RAISE NOTICE '   - allocate_seats_to_booking() - Assign seats';
    RAISE NOTICE '   - get_available_seats_count() - Check availability';
    RAISE NOTICE '   - release_booking_seats() - Cancel seat bookings';
    RAISE NOTICE '';
    RAISE NOTICE '🎫 Seat Layout Types:';
    RAISE NOTICE '   - sequential: 1, 2, 3, 4...';
    RAISE NOTICE '   - rows: A1, A2, B1, B2...';
    RAISE NOTICE '   - sections: VIP, General, Balcony';
    RAISE NOTICE '';
    RAISE NOTICE '================================================';
END $$;