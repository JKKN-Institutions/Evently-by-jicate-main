-- =====================================================
-- CREATE SEAT TABLES (SIMPLE VERSION)
-- =====================================================

-- 1. CREATE EVENT SEAT CONFIGURATION TABLE
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
    sections JSONB,
    
    -- Pricing per seat type
    seat_pricing JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_event_seat_config UNIQUE(event_id)
);

-- 2. CREATE EVENT SEATS TABLE
CREATE TABLE IF NOT EXISTS event_seats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    
    -- Seat Identification
    seat_number VARCHAR(10) NOT NULL,
    row_number VARCHAR(5),
    section VARCHAR(50),
    
    -- Seat Status
    status TEXT DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'booked', 'blocked')),
    
    -- Booking Information (when seat is booked)
    booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    booked_at TIMESTAMPTZ,
    
    -- Seat Properties
    seat_type TEXT DEFAULT 'standard' CHECK (seat_type IN ('standard', 'vip', 'premium', 'wheelchair', 'companion')),
    price_override DECIMAL(10, 2),
    
    -- Additional Info
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_event_seat UNIQUE(event_id, seat_number)
);

-- 3. ENABLE RLS BUT WITH PERMISSIVE POLICIES
ALTER TABLE event_seat_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_seats ENABLE ROW LEVEL SECURITY;

-- 4. CREATE VERY PERMISSIVE POLICIES FOR NOW
-- (We can make them more restrictive later)

-- Drop any existing policies first
DROP POLICY IF EXISTS "Allow all for event_seat_config" ON event_seat_config;
DROP POLICY IF EXISTS "Allow all for event_seats" ON event_seats;

-- Create permissive policies
CREATE POLICY "Allow all for event_seat_config" ON event_seat_config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for event_seats" ON event_seats FOR ALL USING (true) WITH CHECK (true);

-- 5. CREATE INDEXES
CREATE INDEX IF NOT EXISTS idx_event_seat_config_event_id ON event_seat_config(event_id);
CREATE INDEX IF NOT EXISTS idx_event_seats_event_id ON event_seats(event_id);
CREATE INDEX IF NOT EXISTS idx_event_seats_status ON event_seats(status);

-- 6. GRANT PERMISSIONS
GRANT ALL ON event_seat_config TO authenticated;
GRANT ALL ON event_seats TO authenticated;

-- 7. CREATE SEAT GENERATION FUNCTION
CREATE OR REPLACE FUNCTION generate_event_seats(
    p_event_id UUID,
    p_total_seats INTEGER,
    p_layout_type TEXT DEFAULT 'sequential'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    seat_count INTEGER := 0;
    seat_num TEXT;
BEGIN
    -- Generate sequential seats
    FOR i IN 1..p_total_seats LOOP
        seat_num := i::TEXT;
        
        INSERT INTO event_seats (
            event_id,
            seat_number,
            status
        ) VALUES (
            p_event_id,
            seat_num,
            'available'
        );
        
        seat_count := seat_count + 1;
    END LOOP;
    
    RETURN seat_count;
END;
$$;

-- 8. VERIFICATION
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_seat_config') THEN
        RAISE NOTICE '✅ event_seat_config table created successfully';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_seats') THEN
        RAISE NOTICE '✅ event_seats table created successfully';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'generate_event_seats') THEN
        RAISE NOTICE '✅ generate_event_seats function created successfully';
    END IF;
    
    RAISE NOTICE '🎉 Seat management setup completed!';
END $$;
