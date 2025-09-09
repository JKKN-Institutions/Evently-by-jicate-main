-- Fix all missing columns in events table
-- This script adds all required columns for the event creation to work

DO $$
BEGIN
    -- 1. Fix date columns (rename date to start_date if needed)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'events' AND column_name = 'start_date') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'events' AND column_name = 'date') THEN
            ALTER TABLE events RENAME COLUMN date TO start_date;
            RAISE NOTICE 'Renamed date column to start_date';
        ELSE
            ALTER TABLE events ADD COLUMN start_date DATE DEFAULT CURRENT_DATE;
            RAISE NOTICE 'Added start_date column';
        END IF;
    END IF;
    
    -- 2. Add end_date if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'events' AND column_name = 'end_date') THEN
        ALTER TABLE events ADD COLUMN end_date DATE;
        UPDATE events SET end_date = start_date WHERE end_date IS NULL;
        RAISE NOTICE 'Added end_date column';
    END IF;
    
    -- 3. Add ticket_template column (JSONB for storing ticket template data)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'events' AND column_name = 'ticket_template') THEN
        ALTER TABLE events ADD COLUMN ticket_template JSONB DEFAULT '{}'::jsonb;
        RAISE NOTICE 'Added ticket_template column';
    END IF;
    
    -- 4. Add ticket_generation_type column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'events' AND column_name = 'ticket_generation_type') THEN
        ALTER TABLE events ADD COLUMN ticket_generation_type TEXT;
        RAISE NOTICE 'Added ticket_generation_type column';
    END IF;
    
    -- 5. Add predefined_ticket_url column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'events' AND column_name = 'predefined_ticket_url') THEN
        ALTER TABLE events ADD COLUMN predefined_ticket_url TEXT;
        RAISE NOTICE 'Added predefined_ticket_url column';
    END IF;
    
    -- 6. Add ticket_types column (for multiple ticket pricing)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'events' AND column_name = 'ticket_types') THEN
        ALTER TABLE events ADD COLUMN ticket_types JSONB DEFAULT '[]'::jsonb;
        RAISE NOTICE 'Added ticket_types column';
    END IF;
    
    -- 7. Add use_multi_ticket_pricing column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'events' AND column_name = 'use_multi_ticket_pricing') THEN
        ALTER TABLE events ADD COLUMN use_multi_ticket_pricing BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added use_multi_ticket_pricing column';
    END IF;
    
    -- 8. Add time column if missing (for optional time)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'events' AND column_name = 'time') THEN
        ALTER TABLE events ADD COLUMN time TIME;
        RAISE NOTICE 'Added time column';
    END IF;
    
    -- 9. Add seat_config column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'events' AND column_name = 'seat_config') THEN
        ALTER TABLE events ADD COLUMN seat_config JSONB DEFAULT '{}'::jsonb;
        RAISE NOTICE 'Added seat_config column';
    END IF;
    
    -- 10. Ensure all basic columns exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'events' AND column_name = 'title') THEN
        ALTER TABLE events ADD COLUMN title TEXT NOT NULL DEFAULT 'Untitled Event';
        RAISE NOTICE 'Added title column';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'events' AND column_name = 'description') THEN
        ALTER TABLE events ADD COLUMN description TEXT;
        RAISE NOTICE 'Added description column';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'events' AND column_name = 'venue') THEN
        ALTER TABLE events ADD COLUMN venue TEXT;
        RAISE NOTICE 'Added venue column';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'events' AND column_name = 'location') THEN
        ALTER TABLE events ADD COLUMN location TEXT;
        RAISE NOTICE 'Added location column';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'events' AND column_name = 'price') THEN
        ALTER TABLE events ADD COLUMN price DECIMAL(10,2) DEFAULT 0;
        RAISE NOTICE 'Added price column';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'events' AND column_name = 'max_attendees') THEN
        ALTER TABLE events ADD COLUMN max_attendees INTEGER DEFAULT 100;
        RAISE NOTICE 'Added max_attendees column';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'events' AND column_name = 'category') THEN
        ALTER TABLE events ADD COLUMN category TEXT DEFAULT 'Other';
        RAISE NOTICE 'Added category column';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'events' AND column_name = 'image_url') THEN
        ALTER TABLE events ADD COLUMN image_url TEXT;
        RAISE NOTICE 'Added image_url column';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'events' AND column_name = 'organizer_id') THEN
        ALTER TABLE events ADD COLUMN organizer_id UUID REFERENCES auth.users(id);
        RAISE NOTICE 'Added organizer_id column';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'events' AND column_name = 'status') THEN
        ALTER TABLE events ADD COLUMN status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'cancelled'));
        RAISE NOTICE 'Added status column';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'events' AND column_name = 'created_at') THEN
        ALTER TABLE events ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
        RAISE NOTICE 'Added created_at column';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'events' AND column_name = 'updated_at') THEN
        ALTER TABLE events ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
        RAISE NOTICE 'Added updated_at column';
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date DESC);
CREATE INDEX IF NOT EXISTS idx_events_organizer_id ON events(organizer_id);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_ticket_types ON events USING GIN (ticket_types);

-- Refresh the PostgREST schema cache
NOTIFY pgrst, 'reload schema';
SELECT pg_notify('pgrst', 'reload schema');

-- Verify all columns
SELECT 
    column_name, 
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'events'
ORDER BY ordinal_position;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ All missing columns have been added to the events table!';
    RAISE NOTICE 'The following columns are now available:';
    RAISE NOTICE '- start_date (renamed from date)';
    RAISE NOTICE '- end_date';
    RAISE NOTICE '- ticket_template';
    RAISE NOTICE '- ticket_generation_type';
    RAISE NOTICE '- predefined_ticket_url';
    RAISE NOTICE '- ticket_types';
    RAISE NOTICE '- use_multi_ticket_pricing';
    RAISE NOTICE '- seat_config';
    RAISE NOTICE '- All other required columns';
END $$;