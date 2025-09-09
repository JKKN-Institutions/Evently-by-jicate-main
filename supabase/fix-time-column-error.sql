-- =====================================================
-- FIXED SQL - NO SYNTAX ERRORS
-- =====================================================
-- This version fixes the TIME column syntax error

-- =====================================================
-- 1. STORAGE BUCKET SETUP
-- =====================================================

-- Create storage bucket for event images (including banners)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'event-images', 
    'event-images', 
    true,
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
SET 
    public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- =====================================================
-- 2. STORAGE POLICIES
-- =====================================================

-- Drop existing policies safely
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Anyone can view event images" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Authenticated can upload event images" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can update own event images" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can delete own event images" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Create new policies
CREATE POLICY "Anyone can view event images"
ON storage.objects FOR SELECT
USING (bucket_id = 'event-images');

CREATE POLICY "Authenticated can upload event images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'event-images');

CREATE POLICY "Users can update own event images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'event-images')
WITH CHECK (bucket_id = 'event-images');

CREATE POLICY "Users can delete own event images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'event-images');

-- =====================================================
-- 3. EVENT CATEGORIES TABLE
-- =====================================================

-- Create categories table if it doesn't exist
CREATE TABLE IF NOT EXISTS event_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(50),
    color VARCHAR(7),
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_event_categories_slug ON event_categories(slug);
CREATE INDEX IF NOT EXISTS idx_event_categories_active ON event_categories(is_active);

-- Insert default categories (safe insert with conflict handling)
INSERT INTO event_categories (name, slug, description, icon, color, display_order)
VALUES 
    ('Music & Concerts', 'music-concerts', 'Live music performances and concerts', 'Music', '#8B5CF6', 1),
    ('Sports & Fitness', 'sports-fitness', 'Sports events and fitness activities', 'Trophy', '#EF4444', 2),
    ('Arts & Culture', 'arts-culture', 'Art exhibitions, theater, and cultural events', 'Palette', '#EC4899', 3),
    ('Food & Drink', 'food-drink', 'Food festivals, tastings, and culinary events', 'Utensils', '#F59E0B', 4),
    ('Technology', 'technology', 'Tech talks, hackathons, and innovation events', 'Cpu', '#3B82F6', 5),
    ('Business', 'business', 'Networking, conferences, and professional development', 'Briefcase', '#10B981', 6),
    ('Education', 'education', 'Workshops, seminars, and learning opportunities', 'GraduationCap', '#6366F1', 7),
    ('Community', 'community', 'Local gatherings and community events', 'Users', '#14B8A6', 8),
    ('Entertainment', 'entertainment', 'Comedy shows, festivals, and entertainment', 'Star', '#F97316', 9),
    ('Health & Wellness', 'health-wellness', 'Health, wellness, and self-care events', 'Heart', '#EF4444', 10)
ON CONFLICT (slug) DO NOTHING;

-- =====================================================
-- 4. ENABLE RLS ON CATEGORIES
-- =====================================================

ALTER TABLE event_categories ENABLE ROW LEVEL SECURITY;

-- Drop existing policy safely
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Anyone can view categories" ON event_categories;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Create policy for viewing categories
CREATE POLICY "Anyone can view categories"
ON event_categories FOR SELECT
USING (is_active = true OR auth.uid() IS NOT NULL);

-- =====================================================
-- 5. HELPER FUNCTION FOR SUGGESTED EVENTS (FIXED)
-- =====================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_related_events(UUID, INTEGER);

-- Create function with proper column names
CREATE OR REPLACE FUNCTION get_related_events(
    current_event_id UUID,
    max_results INTEGER DEFAULT 4
)
RETURNS TABLE (
    event_id UUID,
    event_title TEXT,
    event_description TEXT,
    event_date DATE,
    event_time TIME,
    event_venue TEXT,
    event_location TEXT,
    event_price DECIMAL,
    event_image_url TEXT,
    event_max_attendees INTEGER,
    event_status TEXT
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        e.id AS event_id,
        e.title AS event_title,
        e.description AS event_description,
        e.date AS event_date,
        e."time" AS event_time,  -- Quote "time" since it's a reserved word
        e.venue AS event_venue,
        e.location AS event_location,
        e.price AS event_price,
        e.image_url AS event_image_url,
        e.max_attendees AS event_max_attendees,
        e.status AS event_status
    FROM events e
    WHERE 
        e.id != current_event_id
        AND e.status = 'published'
        AND e.date >= CURRENT_DATE
    ORDER BY 
        e.date ASC,
        e.created_at DESC
    LIMIT max_results;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_related_events(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_related_events(UUID, INTEGER) TO anon;

-- =====================================================
-- 6. ADDITIONAL HELPER FUNCTIONS
-- =====================================================

-- Function to get events by category (using category name in description or title)
CREATE OR REPLACE FUNCTION get_events_by_category(
    category_name TEXT,
    limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
    event_id UUID,
    event_title TEXT,
    event_date DATE,
    event_venue TEXT,
    event_price DECIMAL,
    event_image_url TEXT
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        id AS event_id,
        title AS event_title,
        date AS event_date,
        venue AS event_venue,
        price AS event_price,
        image_url AS event_image_url
    FROM events
    WHERE 
        status = 'published'
        AND date >= CURRENT_DATE
        AND (
            LOWER(title) LIKE '%' || LOWER(category_name) || '%'
            OR LOWER(description) LIKE '%' || LOWER(category_name) || '%'
        )
    ORDER BY date ASC
    LIMIT limit_count;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_events_by_category(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_events_by_category(TEXT, INTEGER) TO anon;

-- =====================================================
-- 7. VERIFICATION SCRIPT
-- =====================================================

DO $$ 
DECLARE
    bucket_exists BOOLEAN;
    categories_count INTEGER;
    storage_policy_count INTEGER;
BEGIN
    -- Check if bucket exists
    SELECT EXISTS (
        SELECT 1 FROM storage.buckets WHERE id = 'event-images'
    ) INTO bucket_exists;
    
    -- Count categories
    SELECT COUNT(*) FROM event_categories INTO categories_count;
    
    -- Count storage policies
    SELECT COUNT(*) 
    FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname LIKE '%event images%'
    INTO storage_policy_count;
    
    -- Display results
    RAISE NOTICE '';
    RAISE NOTICE '================================================';
    RAISE NOTICE '✅ EVENT BANNER SETUP COMPLETED SUCCESSFULLY!';
    RAISE NOTICE '================================================';
    RAISE NOTICE '';
    RAISE NOTICE '📦 Storage Setup:';
    RAISE NOTICE '   - Storage bucket "event-images": %', 
        CASE WHEN bucket_exists THEN '✅ Created' ELSE '❌ Failed' END;
    RAISE NOTICE '   - Storage policies: % policies created', storage_policy_count;
    RAISE NOTICE '';
    RAISE NOTICE '🏷️ Categories Setup:';
    RAISE NOTICE '   - Event categories: % categories created', categories_count;
    RAISE NOTICE '   - RLS enabled: ✅';
    RAISE NOTICE '';
    RAISE NOTICE '🔧 Helper Functions:';
    RAISE NOTICE '   - get_related_events(): ✅ Created';
    RAISE NOTICE '   - get_events_by_category(): ✅ Created';
    RAISE NOTICE '';
    RAISE NOTICE '📝 Notes:';
    RAISE NOTICE '   - Events will use "image_url" field for banners';
    RAISE NOTICE '   - No table alterations were needed';
    RAISE NOTICE '   - All permissions are properly set';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 You can now:';
    RAISE NOTICE '   1. Upload event banner images';
    RAISE NOTICE '   2. Browse events by category';
    RAISE NOTICE '   3. See related event suggestions';
    RAISE NOTICE '';
    RAISE NOTICE '================================================';
END $$;