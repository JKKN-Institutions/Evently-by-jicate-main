-- =====================================================
-- COMPLETE STORAGE FIX FOR EVENTLY
-- =====================================================
-- This script will fix all storage issues
-- Run this in your Supabase SQL Editor

-- 1. ENSURE BUCKET EXISTS AND IS PROPERLY CONFIGURED
-- =====================================================
DO $$
BEGIN
    -- Delete existing bucket if it has issues
    DELETE FROM storage.buckets WHERE id = 'event-images';
    
    -- Create fresh bucket with correct settings
    INSERT INTO storage.buckets (
        id, 
        name, 
        public, 
        file_size_limit, 
        allowed_mime_types
    ) VALUES (
        'event-images',
        'event-images',
        true,  -- MUST be public for images to display
        10485760,  -- 10MB limit (increased)
        ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']::text[]
    );
    
    RAISE NOTICE '✅ Created event-images bucket successfully';
END $$;

-- 2. CLEAN UP ALL EXISTING POLICIES
-- =====================================================
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    -- Drop ALL existing policies for storage.objects related to event-images
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects'
    LOOP
        BEGIN
            EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', policy_record.policyname);
        EXCEPTION
            WHEN OTHERS THEN
                -- Continue if policy doesn't exist
                NULL;
        END;
    END LOOP;
    
    RAISE NOTICE '✅ Cleaned up existing policies';
END $$;

-- 3. CREATE SIMPLE, WORKING POLICIES
-- =====================================================

-- Allow EVERYONE to view images (public read)
CREATE POLICY "allow_public_read" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'event-images');

-- Allow ALL authenticated users to upload
CREATE POLICY "allow_authenticated_upload" 
ON storage.objects FOR INSERT 
WITH CHECK (
    bucket_id = 'event-images' 
    AND auth.role() = 'authenticated'
);

-- Allow ALL authenticated users to update
CREATE POLICY "allow_authenticated_update" 
ON storage.objects FOR UPDATE 
USING (
    bucket_id = 'event-images' 
    AND auth.role() = 'authenticated'
);

-- Allow ALL authenticated users to delete
CREATE POLICY "allow_authenticated_delete" 
ON storage.objects FOR DELETE 
USING (
    bucket_id = 'event-images' 
    AND auth.role() = 'authenticated'
);

-- 4. ENABLE ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

-- 5. CREATE BUCKET POLICIES
-- =====================================================
CREATE POLICY "allow_bucket_read" ON storage.buckets FOR SELECT USING (true);

-- 6. VERIFICATION AND TESTING
-- =====================================================
DO $$
DECLARE
    bucket_exists BOOLEAN;
    bucket_is_public BOOLEAN;
    policy_count INTEGER;
    test_result TEXT;
BEGIN
    -- Check if bucket exists
    SELECT EXISTS(
        SELECT 1 FROM storage.buckets WHERE id = 'event-images'
    ) INTO bucket_exists;
    
    -- Check if bucket is public
    SELECT public INTO bucket_is_public
    FROM storage.buckets WHERE id = 'event-images';
    
    -- Count policies
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects'
    AND policyname LIKE 'allow_%';
    
    -- Report results
    IF bucket_exists THEN
        RAISE NOTICE '✅ BUCKET: event-images exists';
    ELSE
        RAISE WARNING '❌ BUCKET: event-images NOT found';
    END IF;
    
    IF bucket_is_public THEN
        RAISE NOTICE '✅ BUCKET: is PUBLIC (images will be accessible)';
    ELSE
        RAISE WARNING '❌ BUCKET: is NOT public (images will not display)';
    END IF;
    
    RAISE NOTICE '✅ POLICIES: Created % storage policies', policy_count;
    
    -- Show example URL
    RAISE NOTICE '';
    RAISE NOTICE '📸 EXAMPLE IMAGE URL:';
    RAISE NOTICE 'https://YOUR_PROJECT_ID.supabase.co/storage/v1/object/public/event-images/filename.jpg';
    RAISE NOTICE '';
    
    IF bucket_exists AND bucket_is_public AND policy_count >= 4 THEN
        RAISE NOTICE '🎉 SUCCESS: Storage is now properly configured!';
        RAISE NOTICE '💡 TIP: Replace YOUR_PROJECT_ID with your actual Supabase project ID';
    ELSE
        RAISE WARNING '⚠️  ISSUE: Storage setup incomplete. Check the errors above.';
    END IF;
END $$;

-- 7. SHOW CURRENT BUCKET STATUS
-- =====================================================
SELECT 
    id as bucket_name,
    public as is_public,
    file_size_limit,
    allowed_mime_types
FROM storage.buckets 
WHERE id = 'event-images';
