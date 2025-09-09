-- =====================================================
-- FIX TICKET TEMPLATE VALIDATION
-- =====================================================

-- Drop the existing constraint temporarily
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_ticket_template_valid;

-- Create a more flexible validation function
CREATE OR REPLACE FUNCTION validate_ticket_template(template JSONB)
RETURNS BOOLEAN AS $$
BEGIN
    -- Allow empty template
    IF template IS NULL OR template = '{}'::jsonb THEN
        RETURN TRUE;
    END IF;
    
    -- Check if template has basic structure
    -- At minimum, it should have organizerName and terms
    IF NOT (
        template ? 'organizerName' AND
        template ? 'terms'
    ) THEN
        RETURN FALSE;
    END IF;
    
    -- Check terms is an array if it exists
    IF template ? 'terms' AND jsonb_typeof(template->'terms') != 'array' THEN
        RETURN FALSE;
    END IF;
    
    -- Check ticketTypes is an array if it exists (optional)
    IF template ? 'ticketTypes' AND jsonb_typeof(template->'ticketTypes') != 'array' THEN
        RETURN FALSE;
    END IF;
    
    -- Check themeColor is a string if it exists (optional)
    IF template ? 'themeColor' AND jsonb_typeof(template->'themeColor') != 'string' THEN
        RETURN FALSE;
    END IF;
    
    -- Check organizerContact is a string if it exists (optional)
    IF template ? 'organizerContact' AND jsonb_typeof(template->'organizerContact') != 'string' THEN
        RETURN FALSE;
    END IF;
    
    -- Check enableWatermark is a boolean if it exists (optional)
    IF template ? 'enableWatermark' AND jsonb_typeof(template->'enableWatermark') != 'boolean' THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Re-add the constraint with the updated function
ALTER TABLE events 
ADD CONSTRAINT events_ticket_template_valid 
CHECK (validate_ticket_template(ticket_template));

-- Test the validation function with sample data
DO $$
DECLARE
    simple_template JSONB;
    complex_template JSONB;
    empty_template JSONB;
BEGIN
    -- Test simple template (from our configurator)
    simple_template := '{
        "themeColor": "#3B82F6",
        "organizerName": "JKKN College",
        "organizerContact": "contact@jkkn.ac.in",
        "enableWatermark": true,
        "terms": ["This ticket is valid for one-time entry only"]
    }'::jsonb;
    
    -- Test complex template (full template)
    complex_template := '{
        "themeColor": "#3B82F6",
        "organizerName": "JKKN College",
        "organizerContact": "contact@jkkn.ac.in",
        "enableWatermark": true,
        "terms": ["This ticket is valid for one-time entry only"],
        "ticketTypes": [
            {
                "name": "General Admission",
                "price": 100,
                "color": "#3B82F6",
                "description": "Standard entry ticket"
            }
        ]
    }'::jsonb;
    
    -- Test empty template
    empty_template := '{}'::jsonb;
    
    -- Validate all templates
    IF NOT validate_ticket_template(simple_template) THEN
        RAISE EXCEPTION 'Simple template validation failed';
    END IF;
    
    IF NOT validate_ticket_template(complex_template) THEN
        RAISE EXCEPTION 'Complex template validation failed';
    END IF;
    
    IF NOT validate_ticket_template(empty_template) THEN
        RAISE EXCEPTION 'Empty template validation failed';
    END IF;
    
    RAISE NOTICE 'All ticket template validations passed successfully';
END $$;

-- Update existing events with invalid templates
UPDATE events 
SET ticket_template = jsonb_build_object(
    'themeColor', '#3B82F6',
    'organizerName', '',
    'organizerContact', '',
    'enableWatermark', false,
    'terms', jsonb_build_array('This ticket is valid for one-time entry only')
)
WHERE NOT validate_ticket_template(ticket_template);

-- Verify the fix
DO $$
DECLARE
    invalid_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO invalid_count
    FROM events 
    WHERE NOT validate_ticket_template(ticket_template);
    
    IF invalid_count > 0 THEN
        RAISE WARNING 'Still have % events with invalid ticket templates', invalid_count;
    ELSE
        RAISE NOTICE 'All events now have valid ticket templates';
    END IF;
END $$;
