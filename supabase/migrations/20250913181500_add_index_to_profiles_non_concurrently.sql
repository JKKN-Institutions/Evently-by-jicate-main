-- =====================================================
-- FIX: ADD INDEX TO PROFILES TABLE (NON-CONCURRENTLY)
-- =====================================================
-- This migration ensures a high-performance B-tree index exists on the `id` column
-- of the `profiles` table. This is critical for fast user profile lookups.

-- This version removes the "CONCURRENTLY" keyword to ensure it can be run
-- inside the Supabase SQL Editor, which uses a transaction block.
-- This will briefly lock the table, which is acceptable as the app is not currently usable.
CREATE INDEX IF NOT EXISTS idx_profiles_id ON public.profiles USING btree (id);

-- Verify the index has been created
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1
        FROM   pg_class c
        JOIN   pg_namespace n ON n.oid = c.relnamespace
        WHERE  c.relname = 'idx_profiles_id'
        AND    n.nspname = 'public'
    ) THEN
        RAISE NOTICE 'SUCCESS: High-performance index "idx_profiles_id" on profiles table has been successfully created or already existed.';
    ELSE
        RAISE WARNING 'FAILURE: Index "idx_profiles_id" on profiles table could not be created.';
    END IF;
END $$;
