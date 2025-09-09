-- Fix RLS policies for event_verification_stats table
-- This migration disables RLS for the stats table to prevent row-level security violations

-- Check if event_verification_stats table exists and fix RLS
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'event_verification_stats'
    ) THEN
        -- Disable RLS for this table since it's for system stats
        ALTER TABLE public.event_verification_stats DISABLE ROW LEVEL SECURITY;
        RAISE NOTICE 'Disabled RLS for event_verification_stats table';
    ELSE
        -- Create the table if it doesn't exist
        CREATE TABLE IF NOT EXISTS public.event_verification_stats (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
            ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE,
            scanned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            scanner_id UUID,
            location TEXT,
            device_info JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Create indexes for better performance
        CREATE INDEX IF NOT EXISTS idx_event_verification_stats_event_id 
            ON public.event_verification_stats(event_id);
        CREATE INDEX IF NOT EXISTS idx_event_verification_stats_ticket_id 
            ON public.event_verification_stats(ticket_id);
        CREATE INDEX IF NOT EXISTS idx_event_verification_stats_scanned_at 
            ON public.event_verification_stats(scanned_at);
        
        -- Disable RLS for this table
        ALTER TABLE public.event_verification_stats DISABLE ROW LEVEL SECURITY;
        
        RAISE NOTICE 'Created event_verification_stats table with RLS disabled';
    END IF;
END $$;

-- Grant necessary permissions
GRANT ALL ON public.event_verification_stats TO authenticated;
GRANT ALL ON public.event_verification_stats TO service_role;