-- =====================================================
-- ADD TICKET TEMPLATE CONFIGURATION TO EVENTS
-- =====================================================

-- Add ticket_template column to events table
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS ticket_template JSONB DEFAULT '{}'::jsonb;

-- Create index for ticket template queries
CREATE INDEX IF NOT EXISTS idx_events_ticket_template ON events USING gin(ticket_template);

-- Add comment for documentation
COMMENT ON COLUMN events.ticket_template IS 'Stores ticket template configuration including branding, ticket types, security features, and terms';

-- Update existing events with default ticket template
UPDATE events 
SET ticket_template = jsonb_build_object(
  'themeColor', '#3B82F6',
  'backgroundStyle', 'solid',
  'ticketTypes', jsonb_build_array(
    jsonb_build_object(
      'name', 'General Admission',
      'price', COALESCE(price, 0),
      'color', '#3B82F6',
      'description', 'Standard entry ticket'
    )
  ),
  'showVenueDetails', true,
  'showEntryTime', false,
  'showGateNumber', false,
  'collectAttendeeInfo', jsonb_build_object(
    'name', true,
    'email', true,
    'phone', false,
    'idRequired', false
  ),
  'organizerName', '',
  'sponsors', jsonb_build_array(),
  'enableWatermark', false,
  'enableHologram', false,
  'qrCodeStyle', 'standard',
  'terms', jsonb_build_array(
    'This ticket is valid for one-time entry only',
    'Please carry a valid government-issued ID proof',
    'Entry subject to security check'
  ),
  'transferPolicy', 'allowed',
  'enableSeatSelection', false,
  'enableCheckIn', true
)
WHERE ticket_template = '{}'::jsonb OR ticket_template IS NULL;

-- Create a function to get ticket template with defaults
CREATE OR REPLACE FUNCTION get_event_ticket_template(event_id_param UUID)
RETURNS JSONB AS $$
DECLARE
    template JSONB;
    event_data RECORD;
BEGIN
    -- Get event data and template
    SELECT title, price, ticket_template INTO event_data
    FROM events 
    WHERE id = event_id_param;
    
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    
    template := event_data.ticket_template;
    
    -- Ensure template has required fields with defaults
    IF template IS NULL OR template = '{}'::jsonb THEN
        template := jsonb_build_object(
            'themeColor', '#3B82F6',
            'backgroundStyle', 'solid',
            'ticketTypes', jsonb_build_array(
                jsonb_build_object(
                    'name', 'General Admission',
                    'price', COALESCE(event_data.price, 0),
                    'color', '#3B82F6',
                    'description', 'Standard entry ticket'
                )
            ),
            'showVenueDetails', true,
            'showEntryTime', false,
            'showGateNumber', false,
            'collectAttendeeInfo', jsonb_build_object(
                'name', true,
                'email', true,
                'phone', false,
                'idRequired', false
            ),
            'organizerName', '',
            'sponsors', jsonb_build_array(),
            'enableWatermark', false,
            'enableHologram', false,
            'qrCodeStyle', 'standard',
            'terms', jsonb_build_array(
                'This ticket is valid for one-time entry only',
                'Please carry a valid government-issued ID proof',
                'Entry subject to security check'
            ),
            'transferPolicy', 'allowed',
            'enableSeatSelection', false,
            'enableCheckIn', true
        );
    END IF;
    
    RETURN template;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to validate ticket template structure
CREATE OR REPLACE FUNCTION validate_ticket_template(template JSONB)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check required fields exist
    IF NOT (
        template ? 'themeColor' AND
        template ? 'ticketTypes' AND
        template ? 'organizerName' AND
        template ? 'terms'
    ) THEN
        RETURN FALSE;
    END IF;
    
    -- Check ticketTypes is an array
    IF jsonb_typeof(template->'ticketTypes') != 'array' THEN
        RETURN FALSE;
    END IF;
    
    -- Check terms is an array
    IF jsonb_typeof(template->'terms') != 'array' THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add constraint to ensure valid ticket template
ALTER TABLE events 
ADD CONSTRAINT events_ticket_template_valid 
CHECK (validate_ticket_template(ticket_template));

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_event_ticket_template(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_ticket_template(JSONB) TO authenticated;

-- Create view for events with ticket template info
CREATE OR REPLACE VIEW events_with_ticket_info AS
SELECT 
    e.*,
    get_event_ticket_template(e.id) as full_ticket_template,
    (ticket_template->>'organizerName') as organizer_name_from_template,
    jsonb_array_length(COALESCE(ticket_template->'ticketTypes', '[]'::jsonb)) as ticket_type_count
FROM events e;

GRANT SELECT ON events_with_ticket_info TO authenticated;

-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
BEGIN
    -- Check if column was added successfully
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'events' 
        AND column_name = 'ticket_template'
    ) THEN
        RAISE NOTICE 'ticket_template column added successfully to events table';
    ELSE
        RAISE EXCEPTION 'Failed to add ticket_template column to events table';
    END IF;
    
    -- Check if function exists
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'get_event_ticket_template'
    ) THEN
        RAISE NOTICE 'get_event_ticket_template function created successfully';
    ELSE
        RAISE EXCEPTION 'Failed to create get_event_ticket_template function';
    END IF;
    
    RAISE NOTICE 'Ticket template system setup completed successfully';
END $$;
