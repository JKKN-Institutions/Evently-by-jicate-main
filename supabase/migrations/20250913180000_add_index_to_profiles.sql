-- =====================================================
-- FIX: ADD INDEX TO PROFILES TABLE FOR PERFORMANCE
-- =====================================================
-- This migration ensures a high-performance B-tree index exists on the `id` column
-- of the `profiles` table. This is critical for fast user profile lookups.

-- The `id` column is the primary key, which should already be indexed.
-- However, if the index was somehow dropped or created inefficiently,
-- this will explicitly create a standard, high-performance index.

-- The "CONCURRENTLY" keyword ensures that this command does not lock
-- the table, allowing the application to remain online while the index is built.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_profiles_id ON public.profiles USING btree (id);

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
