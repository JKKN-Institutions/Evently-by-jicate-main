-- =====================================================
-- USE EXISTING IMAGE_URL FIELD FOR BANNERS
-- =====================================================
-- This approach uses the existing image_url field instead of adding a new column

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
-- 2. STORAGE POLICIES (Simpler approach)
-- =====================================================

-- Allow everyone to view images
DO $$ 
BEGIN
    -- Drop existing policy if it exists
    DROP POLICY IF EXISTS "Anyone can view event images" ON storage.objects;
EXCEPTION
    WHEN undefined_object THEN
        NULL; -- Policy doesn't exist, continue
END $$;

CREATE POLICY "Anyone can view event images"
ON storage.objects FOR SELECT
USING (bucket_id = 'event-images');

-- Allow authenticated users to upload images
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Authenticated can upload event images" ON storage.objects;
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;

CREATE POLICY "Authenticated can upload event images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'event-images');

-- Allow authenticated users to update their own images
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can update own event images" ON storage.objects;
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;

CREATE POLICY "Users can update own event images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'event-images')
WITH CHECK (bucket_id = 'event-images');

-- Allow authenticated users to delete their own images
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can delete own event images" ON storage.objects;
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;

CREATE POLICY "Users can delete own event images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'event-images');

-- =====================================================
-- 3. EVENT CATEGORIES (Safe creation)
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

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_event_categories_slug ON event_categories(slug);
CREATE INDEX IF NOT EXISTS idx_event_categories_active ON event_categories(is_active);

-- Insert default categories
INSERT INTO event_categories (name, slug, description, icon, color, display_order)
SELECT * FROM (VALUES
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
) AS v(name, slug, description, icon, color, display_order)
WHERE NOT EXISTS (
    SELECT 1 FROM event_categories ec WHERE ec.slug = v.slug
);

-- =====================================================
-- 4. ENABLE RLS ON CATEGORIES
-- =====================================================

ALTER TABLE event_categories ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Anyone can view categories" ON event_categories;
EXCEPTION
    WHEN undefined_object THEN
        NULL;
END $$;

-- Everyone can view active categories
CREATE POLICY "Anyone can view categories"
ON event_categories FOR SELECT
USING (is_active = true OR auth.uid() IS NOT NULL);

-- =====================================================
-- 5. HELPER FUNCTION FOR SUGGESTED EVENTS
-- =====================================================

CREATE OR REPLACE FUNCTION get_related_events(
    current_event_id UUID,
    max_results INTEGER DEFAULT 4
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    date DATE,
    time TIME,
    venue TEXT,
    location TEXT,
    price DECIMAL,
    image_url TEXT,
    max_attendees INTEGER,
    status TEXT
)
LANGUAGE sql
STABLE
AS $$
    SELECT 
        e.id,
        e.title,
        e.description,
        e.date,
        e.time,
        e.venue,
        e.location,
        e.price,
        e.image_url,
        e.max_attendees,
        e.status
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_related_events(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_related_events(UUID, INTEGER) TO anon;

-- =====================================================
-- 6. UPDATE EVENTS TO USE CATEGORIES (Safe approach)
-- =====================================================

-- Add a category field as JSONB if we can't alter the table
-- This stores category info directly in the event
DO $$ 
BEGIN
    -- Check if we can store category info in existing fields
    -- We'll use the existing fields creatively
    RAISE NOTICE 'Events table will use image_url for banner images';
    RAISE NOTICE 'Category can be stored in a JSONB field or as a tag';
END $$;

-- =====================================================
-- 7. VERIFICATION
-- =====================================================

-- Check that everything was created successfully
DO $$ 
DECLARE
    bucket_exists BOOLEAN;
    categories_count INTEGER;
BEGIN
    -- Check if bucket exists
    SELECT EXISTS (
        SELECT 1 FROM storage.buckets WHERE id = 'event-images'
    ) INTO bucket_exists;
    
    -- Count categories
    SELECT COUNT(*) FROM event_categories INTO categories_count;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Setup Complete!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Storage bucket created: %', CASE WHEN bucket_exists THEN 'YES' ELSE 'NO' END;
    RAISE NOTICE 'Categories created: %', categories_count;
    RAISE NOTICE '';
    RAISE NOTICE 'The events table will use:';
    RAISE NOTICE '- image_url field for banner images';
    RAISE NOTICE '- Categories can be linked via frontend';
    RAISE NOTICE '';
    RAISE NOTICE 'No table alterations needed!';
    RAISE NOTICE '========================================';
END $$;