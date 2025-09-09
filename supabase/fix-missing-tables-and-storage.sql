-- =====================================================
-- FIX MISSING TABLES AND STORAGE CONFIGURATION
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

-- 3. CREATE STORAGE BUCKETS
-- =====================================================

-- Create event-images bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'event-images',
    'event-images',
    true,
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- Create organizer-logos bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'organizer-logos',
    'organizer-logos',
    true,
    2097152, -- 2MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
) ON CONFLICT (id) DO NOTHING;

-- Create user-avatars bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'user-avatars',
    'user-avatars',
    true,
    1048576, -- 1MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- 4. SET UP RLS POLICIES FOR TABLES
-- =====================================================

-- Enable RLS
ALTER TABLE event_seat_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_seats ENABLE ROW LEVEL SECURITY;

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

-- 5. SET UP STORAGE POLICIES (SAFE - SKIP IF EXISTS)
-- =====================================================

-- Drop existing policies first to avoid conflicts
DROP POLICY IF EXISTS "Anyone can view event images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload event images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own event images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own event images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view organizer logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload organizer logos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view user avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can manage their own avatars" ON storage.objects;

-- Event Images Storage Policies
CREATE POLICY "Anyone can view event images" ON storage.objects FOR SELECT USING (bucket_id = 'event-images');

CREATE POLICY "Authenticated users can upload event images" ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'event-images' AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can update their own event images" ON storage.objects FOR UPDATE USING (
    bucket_id = 'event-images' AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own event images" ON storage.objects FOR DELETE USING (
    bucket_id = 'event-images' AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Organizer Logos Storage Policies
CREATE POLICY "Anyone can view organizer logos" ON storage.objects FOR SELECT USING (bucket_id = 'organizer-logos');

CREATE POLICY "Authenticated users can upload organizer logos" ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'organizer-logos' AND auth.role() = 'authenticated'
);

-- User Avatars Storage Policies
CREATE POLICY "Anyone can view user avatars" ON storage.objects FOR SELECT USING (bucket_id = 'user-avatars');

CREATE POLICY "Users can manage their own avatars" ON storage.objects FOR ALL USING (
    bucket_id = 'user-avatars' AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 6. CREATE INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_event_seat_config_event_id ON event_seat_config(event_id);
CREATE INDEX IF NOT EXISTS idx_event_seats_event_id ON event_seats(event_id);
CREATE INDEX IF NOT EXISTS idx_event_seats_status ON event_seats(status);
CREATE INDEX IF NOT EXISTS idx_event_seats_booking_id ON event_seats(booking_id);

-- 7. GRANT PERMISSIONS
-- =====================================================
GRANT ALL ON event_seat_config TO authenticated;
GRANT ALL ON event_seats TO authenticated;

-- 8. VERIFICATION
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
    
    -- Check if buckets exist
    IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'event-images') THEN
        RAISE NOTICE '✅ event-images bucket created successfully';
    ELSE
        RAISE NOTICE '⚠️ event-images bucket may need manual creation';
    END IF;
    
    RAISE NOTICE '🎉 Database setup completed successfully!';
END $$;
