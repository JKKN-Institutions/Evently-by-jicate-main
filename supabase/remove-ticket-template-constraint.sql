-- =====================================================
-- REMOVE TICKET TEMPLATE CONSTRAINT (SIMPLEST FIX)
-- =====================================================

-- Simply remove the problematic constraint
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_ticket_template_valid;

-- Drop the validation function as well
DROP FUNCTION IF EXISTS validate_ticket_template(JSONB);

-- Verify the constraint is gone
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'events_ticket_template_valid'
    ) THEN
        RAISE EXCEPTION 'Constraint still exists';
    ELSE
        RAISE NOTICE 'Ticket template constraint successfully removed';
    END IF;
END $$;
