-- =====================================================
-- COMPLETE STORAGE SETUP FOR EVENT IMAGES
-- =====================================================
-- Run this entire script in Supabase SQL Editor

-- 1. CREATE THE STORAGE BUCKET
-- =====================================================
DO $$
BEGIN
    -- Check if bucket exists
    IF NOT EXISTS (
        SELECT 1 FROM storage.buckets WHERE id = 'event-images'
    ) THEN
        -- Create the bucket
        INSERT INTO storage.buckets (
            id, 
            name, 
            public, 
            file_size_limit, 
            allowed_mime_types
        ) VALUES (
            'event-images',
            'event-images',
            true,  -- Public bucket for event images
            5242880,  -- 5MB limit
            ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']::text[]
        );
        RAISE NOTICE '✅ Created event-images bucket successfully';
    ELSE
        -- Update existing bucket to ensure it's public
        UPDATE storage.buckets 
        SET public = true,
            file_size_limit = 5242880,
            allowed_mime_types = ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']::text[]
        WHERE id = 'event-images';
        RAISE NOTICE '✅ Updated existing event-images bucket';
    END IF;
END $$;

-- 2. DROP ALL EXISTING POLICIES (CLEAN SLATE)
-- =====================================================
DO $$
DECLARE
    policy_name TEXT;
BEGIN
    -- Drop all existing policies for event-images bucket
    FOR policy_name IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname LIKE '%event%image%'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', policy_name);
    END LOOP;
END $$;

-- 3. CREATE NEW SIMPLE POLICIES
-- =====================================================

-- Allow anyone to view images (public read)
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'event-images');

-- Allow authenticated users to upload
CREATE POLICY "Authenticated Upload" 
ON storage.objects FOR INSERT 
WITH CHECK (
    bucket_id = 'event-images' 
    AND auth.role() = 'authenticated'
);

-- Allow authenticated users to update their own uploads
CREATE POLICY "Authenticated Update" 
ON storage.objects FOR UPDATE 
USING (
    bucket_id = 'event-images' 
    AND auth.role() = 'authenticated'
);

-- Allow authenticated users to delete their own uploads
CREATE POLICY "Authenticated Delete" 
ON storage.objects FOR DELETE 
USING (
    bucket_id = 'event-images' 
    AND auth.role() = 'authenticated'
);

-- 4. VERIFY THE SETUP
-- =====================================================
DO $$
DECLARE
    bucket_exists BOOLEAN;
    policy_count INTEGER;
BEGIN
    -- Check if bucket exists and is public
    SELECT EXISTS(
        SELECT 1 FROM storage.buckets 
        WHERE id = 'event-images' AND public = true
    ) INTO bucket_exists;
    
    -- Count policies
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects'
    AND policyname IN ('Public Access', 'Authenticated Upload', 'Authenticated Update', 'Authenticated Delete');
    
    IF bucket_exists THEN
        RAISE NOTICE '✅ BUCKET STATUS: event-images bucket exists and is PUBLIC';
    ELSE
        RAISE WARNING '❌ BUCKET STATUS: event-images bucket not found or not public';
    END IF;
    
    RAISE NOTICE '✅ POLICIES CREATED: % policies', policy_count;
    
    -- Show the public URL format
    RAISE NOTICE '';
    RAISE NOTICE '📸 Your images will be accessible at:';
    RAISE NOTICE 'https://YOUR_PROJECT_ID.supabase.co/storage/v1/object/public/event-images/YOUR_FILE_NAME';
    RAISE NOTICE '';
    RAISE NOTICE '🎉 Storage setup completed successfully!';
END $$;
