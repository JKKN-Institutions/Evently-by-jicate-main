-- =====================================================
-- CREATE MISSING TABLES ONLY (SAFE VERSION)
-- =====================================================

-- 1. CREATE EVENT SEAT CONFIGURATION TABLE
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

-- 2. CREATE EVENT SEATS TABLE
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

-- 3. ENABLE RLS ON NEW TABLES
-- =====================================================
ALTER TABLE event_seat_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_seats ENABLE ROW LEVEL SECURITY;

-- 4. CREATE BASIC POLICIES
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view seat configs" ON event_seat_config;
DROP POLICY IF EXISTS "Event organizers can manage seat configs" ON event_seat_config;
DROP POLICY IF EXISTS "Admins can manage all seat configs" ON event_seat_config;
DROP POLICY IF EXISTS "Anyone can view available seats" ON event_seats;
DROP POLICY IF EXISTS "Event organizers can manage seats" ON event_seats;
DROP POLICY IF EXISTS "Admins can manage all seats" ON event_seats;

-- Policies for event_seat_config
CREATE POLICY "Anyone can view seat configs" ON event_seat_config FOR SELECT USING (true);

CREATE POLICY "Event organizers can manage seat configs" ON event_seat_config FOR ALL USING (
    EXISTS (
        SELECT 1 FROM events
        WHERE events.id = event_seat_config.event_id
        AND events.organizer_id = auth.uid()
    )
);

CREATE POLICY "Admins can manage all seat configs" ON event_seat_config FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- Policies for event_seats
CREATE POLICY "Anyone can view available seats" ON event_seats FOR SELECT USING (true);

CREATE POLICY "Event organizers can manage seats" ON event_seats FOR ALL USING (
    EXISTS (
        SELECT 1 FROM events
        WHERE events.id = event_seats.event_id
        AND events.organizer_id = auth.uid()
    )
);

CREATE POLICY "Admins can manage all seats" ON event_seats FOR ALL USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- 5. CREATE INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_event_seat_config_event_id ON event_seat_config(event_id);
CREATE INDEX IF NOT EXISTS idx_event_seats_event_id ON event_seats(event_id);
CREATE INDEX IF NOT EXISTS idx_event_seats_status ON event_seats(status);
CREATE INDEX IF NOT EXISTS idx_event_seats_booking_id ON event_seats(booking_id);

-- 6. GRANT PERMISSIONS
-- =====================================================
GRANT ALL ON event_seat_config TO authenticated;
GRANT ALL ON event_seats TO authenticated;

-- 7. VERIFICATION
-- =====================================================
DO $$
BEGIN
    -- Check if tables exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_seat_config') THEN
        RAISE NOTICE '✅ event_seat_config table created successfully';
    ELSE
        RAISE EXCEPTION '❌ Failed to create event_seat_config table';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_seats') THEN
        RAISE NOTICE '✅ event_seats table created successfully';
    ELSE
        RAISE EXCEPTION '❌ Failed to create event_seats table';
    END IF;
    
    RAISE NOTICE '🎉 Missing tables created successfully!';
END $$;
