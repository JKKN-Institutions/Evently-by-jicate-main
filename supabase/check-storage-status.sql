-- =====================================================
-- STORAGE DIAGNOSTIC SCRIPT
-- =====================================================
-- Run this to check your current storage setup status

-- 1. CHECK IF BUCKETS EXIST
-- =====================================================
DO $$
DECLARE
    bucket_count INTEGER;
    event_bucket_exists BOOLEAN;
    event_bucket_public BOOLEAN;
BEGIN
    RAISE NOTICE '🔍 CHECKING STORAGE BUCKETS...';
    RAISE NOTICE '';
    
    -- Check total buckets
    SELECT COUNT(*) INTO bucket_count FROM storage.buckets;
    RAISE NOTICE 'Total buckets found: %', bucket_count;
    
    -- Check event-images bucket specifically
    SELECT EXISTS(
        SELECT 1 FROM storage.buckets WHERE id = 'event-images'
    ) INTO event_bucket_exists;
    
    IF event_bucket_exists THEN
        SELECT public INTO event_bucket_public 
        FROM storage.buckets WHERE id = 'event-images';
        
        RAISE NOTICE '✅ event-images bucket: EXISTS';
        
        IF event_bucket_public THEN
            RAISE NOTICE '✅ event-images bucket: PUBLIC (good for displaying images)';
        ELSE
            RAISE NOTICE '❌ event-images bucket: NOT PUBLIC (images won''t display)';
        END IF;
    ELSE
        RAISE NOTICE '❌ event-images bucket: NOT FOUND';
    END IF;
    
    RAISE NOTICE '';
END $$;

-- 2. CHECK STORAGE POLICIES
-- =====================================================
DO $$
DECLARE
    policy_count INTEGER;
    policy_record RECORD;
BEGIN
    RAISE NOTICE '🔍 CHECKING STORAGE POLICIES...';
    RAISE NOTICE '';
    
    -- Count policies for storage.objects
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects';
    
    RAISE NOTICE 'Total storage policies: %', policy_count;
    
    -- List all storage policies
    FOR policy_record IN 
        SELECT policyname, cmd, qual
FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects'
        ORDER BY policyname
    LOOP
        RAISE NOTICE '  • %: % (%)', policy_record.policyname, policy_record.cmd, 
                     COALESCE(policy_record.qual, 'no conditions');
    END LOOP;
    
    RAISE NOTICE '';
END $$;

-- 3. SHOW BUCKET DETAILS
-- =====================================================
RAISE NOTICE '📋 BUCKET DETAILS:';
SELECT 
    id as "Bucket Name",
    CASE WHEN public THEN '✅ Public' ELSE '❌ Private' END as "Access",
    ROUND(file_size_limit / 1024.0 / 1024.0, 1) || ' MB' as "Size Limit",
    array_to_string(allowed_mime_types, ', ') as "Allowed Types"
FROM storage.buckets
ORDER BY id;

-- 4. RECOMMENDATIONS
-- =====================================================
DO $$
DECLARE
    bucket_exists BOOLEAN;
    bucket_is_public BOOLEAN;
    policy_count INTEGER;
    recommendation TEXT := '';
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '💡 RECOMMENDATIONS:';
    RAISE NOTICE '';
    
    -- Check bucket status
    SELECT EXISTS(
        SELECT 1 FROM storage.buckets WHERE id = 'event-images'
    ) INTO bucket_exists;
    
    IF bucket_exists THEN
        SELECT public INTO bucket_is_public 
        FROM storage.buckets WHERE id = 'event-images';
    END IF;
    
    -- Check policies
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies 
    WHERE schemaname = 'storage' 
    AND tablename = 'objects';
    
    -- Generate recommendations
    IF NOT bucket_exists THEN
        RAISE NOTICE '❌ CRITICAL: event-images bucket missing';
        RAISE NOTICE '   → Run: supabase/fix-storage-complete.sql';
    ELSIF NOT bucket_is_public THEN
        RAISE NOTICE '⚠️  WARNING: event-images bucket is private';
        RAISE NOTICE '   → Run: supabase/fix-storage-complete.sql';
    ELSIF policy_count < 4 THEN
        RAISE NOTICE '⚠️  WARNING: Missing storage policies (found %, need 4+)', policy_count;
        RAISE NOTICE '   → Run: supabase/fix-storage-complete.sql';
    ELSE
        RAISE NOTICE '✅ GOOD: Storage appears to be configured correctly';
        RAISE NOTICE '   → If uploads still fail, check your Supabase project URL and keys';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '🔧 TO FIX ISSUES:';
    RAISE NOTICE '1. Go to Supabase Dashboard → SQL Editor';
    RAISE NOTICE '2. Copy and run: supabase/fix-storage-complete.sql';
    RAISE NOTICE '3. Test image upload in your app';
    RAISE NOTICE '';
END $$;