-- Fix date column issue in events table
-- This script renames 'date' column to 'start_date' if it exists

DO $$
BEGIN
    -- Check if 'date' column exists and 'start_date' doesn't
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'events' AND column_name = 'date')
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'events' AND column_name = 'start_date') THEN
        
        -- Rename date to start_date
        ALTER TABLE events RENAME COLUMN date TO start_date;
        RAISE NOTICE 'Renamed column: date -> start_date';
        
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                      WHERE table_name = 'events' AND column_name = 'start_date') THEN
        
        -- Add start_date column if neither exists
        ALTER TABLE events ADD COLUMN start_date DATE DEFAULT CURRENT_DATE;
        RAISE NOTICE 'Added column: start_date';
        
    ELSE
        RAISE NOTICE 'Column start_date already exists';
    END IF;
    
    -- Ensure end_date exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'events' AND column_name = 'end_date') THEN
        ALTER TABLE events ADD COLUMN end_date DATE;
        UPDATE events SET end_date = start_date WHERE end_date IS NULL;
        RAISE NOTICE 'Added column: end_date';
    END IF;
    
    -- Create index on start_date for performance
    IF NOT EXISTS (SELECT 1 FROM pg_indexes 
                   WHERE tablename = 'events' AND indexname = 'idx_events_start_date') THEN
        CREATE INDEX idx_events_start_date ON events(start_date DESC);
        RAISE NOTICE 'Created index on start_date';
    END IF;
END $$;

-- Update any views that might be using 'date' column
-- Check if organizer_dashboard view exists and recreate if needed
DROP VIEW IF EXISTS organizer_dashboard CASCADE;

CREATE OR REPLACE VIEW organizer_dashboard AS
SELECT 
    e.id as event_id,
    e.title as event_title,
    e.start_date,
    e.end_date,
    e.organizer_id,
    COUNT(DISTINCT b.id) as total_bookings,
    COUNT(DISTINCT t.id) as total_tickets,
    COALESCE(SUM(b.total_amount), 0) as total_revenue,
    e.max_attendees,
    e.status as event_status
FROM events e
LEFT JOIN bookings b ON b.event_id = e.id
LEFT JOIN tickets t ON t.booking_id = b.id
GROUP BY e.id, e.title, e.start_date, e.end_date, e.organizer_id, e.max_attendees, e.status;

-- Grant permissions
GRANT SELECT ON organizer_dashboard TO authenticated;

RAISE NOTICE 'Database schema fix completed successfully!';