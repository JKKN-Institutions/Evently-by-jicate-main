-- =====================================================
-- SETUP STORAGE BUCKETS (SIMPLE VERSION)
-- =====================================================

-- 1. CREATE STORAGE BUCKETS
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

-- 2. SET UP PERMISSIVE STORAGE POLICIES
-- =====================================================

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public read access for event images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload event images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their event images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their event images" ON storage.objects;

-- Create simple, permissive policies
CREATE POLICY "Public read access for event images" ON storage.objects FOR SELECT USING (bucket_id = 'event-images');

CREATE POLICY "Authenticated users can upload event images" ON storage.objects FOR INSERT WITH CHECK (
    bucket_id = 'event-images' AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can update event images" ON storage.objects FOR UPDATE USING (
    bucket_id = 'event-images' AND auth.role() = 'authenticated'
);

CREATE POLICY "Authenticated users can delete event images" ON storage.objects FOR DELETE USING (
    bucket_id = 'event-images' AND auth.role() = 'authenticated'
);

-- 3. VERIFICATION
-- =====================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'event-images') THEN
        RAISE NOTICE '✅ event-images bucket created successfully';
    ELSE
        RAISE NOTICE '⚠️ event-images bucket creation may have failed';
    END IF;
    
    RAISE NOTICE '🎉 Storage setup completed!';
    RAISE NOTICE 'You can now upload images to: https://your-project.supabase.co/storage/v1/object/public/event-images/';
END $$;
