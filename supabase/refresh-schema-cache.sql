-- Refresh Supabase schema cache to recognize column changes
-- This helps when columns have been renamed or added

-- First, ensure the columns exist
DO $$
BEGIN
    -- Check if start_date exists, if not rename date to start_date
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
    
    -- Ensure end_date exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'events' AND column_name = 'end_date') THEN
        ALTER TABLE events ADD COLUMN end_date DATE;
        UPDATE events SET end_date = start_date WHERE end_date IS NULL;
        RAISE NOTICE 'Added end_date column';
    END IF;
END $$;

-- Refresh the PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- Alternative method to refresh schema cache
SELECT pg_notify('pgrst', 'reload schema');

-- Verify the columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'events' 
AND column_name IN ('start_date', 'end_date', 'date')
ORDER BY column_name;

-- Show success message
DO $$
BEGIN
    RAISE NOTICE 'Schema cache refresh complete. The events table now uses start_date and end_date columns.';
END $$;