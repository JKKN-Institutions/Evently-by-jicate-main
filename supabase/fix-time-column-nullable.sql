-- Fix time column to allow NULL values for events
-- This allows events to be created without specifying a time

-- First, alter the events table to allow NULL values in the time column
ALTER TABLE events 
ALTER COLUMN time DROP NOT NULL;

-- Verify the change
DO $$
BEGIN
    -- Check if the time column allows NULL
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'events' 
        AND column_name = 'time' 
        AND is_nullable = 'YES'
    ) THEN
        RAISE NOTICE 'Success: time column now allows NULL values';
    ELSE
        RAISE EXCEPTION 'Failed: time column still requires NOT NULL';
    END IF;
END $$;

-- Update any existing constraints if needed
COMMENT ON COLUMN events.time IS 'Event time in HH:MM format (optional)';