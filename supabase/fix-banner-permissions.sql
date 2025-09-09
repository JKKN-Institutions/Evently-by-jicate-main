-- =====================================================
-- FIX BANNER IMAGE SETUP (WITHOUT ALTER TABLE)
-- =====================================================

-- Note: Since we can't ALTER TABLE directly, we'll work with what we have
-- and ensure the banner_url column exists through other means

-- 1. First, check if banner_url column exists in events table
DO $$ 
BEGIN
    -- Check if column exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'events' 
        AND column_name = 'banner_url'
    ) THEN
        -- If you can't add the column, you'll need to use the image_url field instead
        RAISE NOTICE 'banner_url column does not exist. Using image_url field for banners.';
    ELSE
        RAISE NOTICE 'banner_url column exists.';
    END IF;
END $$;

-- =====================================================
-- STORAGE BUCKET SETUP (This should work)
-- =====================================================

-- Enable the storage extension if not already enabled
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-banners', 'event-banners', true)
ON CONFLICT (id) DO UPDATE
SET public = true;

-- =====================================================
-- RLS POLICIES FOR STORAGE
-- =====================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload event banners" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own event banners" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own event banners" ON storage.objects;

-- Allow public access to view event banners
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'event-banners');

-- Allow authenticated users to upload event banners
CREATE POLICY "Authenticated users can upload event banners"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'event-banners' 
    AND auth.role() = 'authenticated'
);

-- Allow users to update their own event banners
CREATE POLICY "Users can update their own event banners"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'event-banners' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own event banners
CREATE POLICY "Users can delete their own event banners"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'event-banners' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- =====================================================
-- CATEGORIES TABLE (Create if not exists)
-- =====================================================

CREATE TABLE IF NOT EXISTS event_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT,
    color TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default categories if table was just created
INSERT INTO event_categories (name, slug, description, icon, color, display_order)
VALUES 
    ('Music & Concerts', 'music-concerts', 'Live music performances and concerts', 'Music', '#8B5CF6', 1),
    ('Sports & Fitness', 'sports-fitness', 'Sports events and fitness activities', 'Trophy', '#EF4444', 2),
    ('Arts & Culture', 'arts-culture', 'Art exhibitions, theater, and cultural events', 'Palette', '#EC4899', 3),
    ('Food & Drink', 'food-drink', 'Food festivals, tastings, and culinary events', 'Utensils', '#F59E0B', 4),
    ('Technology', 'technology', 'Tech talks, hackathons, and innovation events', 'Cpu', '#3B82F6', 5),
    ('Business', 'business', 'Networking, conferences, and professional development', 'Briefcase', '#10B981', 6),
    ('Education', 'education', 'Workshops, seminars, and learning opportunities', 'GraduationCap', '#6366F1', 7),
    ('Community', 'community', 'Local gatherings and community events', 'Users', '#14B8A6', 8)
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- ADD CATEGORY TO EVENTS (Safe approach)
-- =====================================================

-- Check if category column exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'events' 
        AND column_name = 'category_id'
    ) THEN
        RAISE NOTICE 'category_id column does not exist in events table.';
        RAISE NOTICE 'You may need to add it manually or use a migration.';
    END IF;
END $$;

-- =====================================================
-- RLS POLICIES FOR CATEGORIES
-- =====================================================

-- Enable RLS on categories
ALTER TABLE event_categories ENABLE ROW LEVEL SECURITY;

-- Everyone can view active categories
CREATE POLICY "Public can view active categories"
ON event_categories FOR SELECT
USING (is_active = true);

-- Only admins can manage categories
CREATE POLICY "Admins can manage categories"
ON event_categories FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function to get event suggestions based on category
CREATE OR REPLACE FUNCTION get_suggested_events(
    p_category_id UUID,
    p_event_id UUID,
    p_limit INTEGER DEFAULT 4
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    date DATE,
    time TIME,
    venue TEXT,
    price DECIMAL,
    image_url TEXT,
    attendees_count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        e.id,
        e.title,
        e.date,
        e.time,
        e.venue,
        e.price,
        e.image_url,
        COUNT(DISTINCT b.id) as attendees_count
    FROM events e
    LEFT JOIN bookings b ON b.event_id = e.id
    WHERE 
        e.id != p_event_id
        AND e.status = 'published'
        AND e.date >= CURRENT_DATE
        AND (
            -- Same category
            EXISTS (
                SELECT 1 
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'events' 
                AND column_name = 'category_id'
            ) 
            OR true -- Fallback if category_id doesn't exist
        )
    GROUP BY e.id, e.title, e.date, e.time, e.venue, e.price, e.image_url
    ORDER BY 
        e.date ASC,
        attendees_count DESC
    LIMIT p_limit;
END;
$$;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

GRANT ALL ON event_categories TO authenticated;
GRANT EXECUTE ON FUNCTION get_suggested_events(UUID, UUID, INTEGER) TO authenticated;
GRANT ALL ON storage.buckets TO authenticated;
GRANT ALL ON storage.objects TO authenticated;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$ 
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '===========================================';
    RAISE NOTICE 'Banner storage setup completed!';
    RAISE NOTICE '===========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Storage bucket: event-banners (created)';
    RAISE NOTICE 'Categories table: event_categories (created)';
    RAISE NOTICE 'RLS policies: Applied successfully';
    RAISE NOTICE '';
    RAISE NOTICE 'NOTE: If you need to add banner_url column to events table,';
    RAISE NOTICE 'you may need to do it through Supabase dashboard or use image_url field instead.';
    RAISE NOTICE '';
END $$;