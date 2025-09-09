-- Quick schema fix for ticket analytics
-- Run this in your Supabase SQL Editor

-- 1. Add missing category column to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General';

-- 2. Update existing events to have a category
UPDATE events SET category = 'General' WHERE category IS NULL;

-- 3. Add missing columns to tickets table if they don't exist
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS ticket_type TEXT DEFAULT 'Bronze';
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMP WITH TIME ZONE;

-- 4. Verify the columns were added
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name IN ('events', 'tickets')
AND column_name IN ('category', 'ticket_type', 'checked_in_at')
AND table_schema = 'public'
ORDER BY table_name, column_name;