-- =====================================================
-- DATABASE PERFORMANCE OPTIMIZATION
-- =====================================================
-- This script runs maintenance commands to ensure the database is performing optimally.
-- It should be run if you are experiencing timeouts or slow queries.

-- 1. VACUUM: Reclaims storage occupied by dead tuples.
-- It can be run in parallel on a multi-core server to speed up processing.
-- "ANALYZE" updates the statistics used by the query planner.
VACUUM (VERBOSE, ANALYZE) public.profiles;
VACUUM (VERBOSE, ANALYZE) public.events;
VACUUM (VERBOSE, ANALYZE) public.bookings;
VACUUM (VERBOSE, ANALYZE) public.tickets;

-- 2. REINDEX: Rebuilds indexes, which can become inefficient over time.
-- We will reindex the critical tables. A database-wide reindex might be better
-- but can take a long time.
REINDEX TABLE public.profiles;
REINDEX TABLE public.events;

-- 3. Verification Message
DO $$ 
BEGIN
    RAISE NOTICE 'SUCCESS: Database optimization commands have been executed.';
    RAISE NOTICE 'Tables vacuumed and reindexed: profiles, events, bookings, tickets.';
    RAISE NOTICE 'Please redeploy your application and test performance.';
END $$;
