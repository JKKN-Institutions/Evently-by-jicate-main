-- =====================================================
-- EVENT PAGES SYSTEM - DATABASE SCHEMA
-- =====================================================
-- Implements hierarchical event management with role delegation
-- Admin → Page Controller → Event Controller → User

BEGIN;

-- Step 1: Create Event Pages table (Parent Container)
CREATE TABLE IF NOT EXISTS event_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL, -- URL-friendly identifier
    description TEXT,
    banner_image VARCHAR(500),
    location VARCHAR(255),
    start_date DATE,
    end_date DATE,
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Modify events table to support parent-child relationship
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_page_id UUID REFERENCES event_pages(id) ON DELETE CASCADE;
ALTER TABLE events ADD COLUMN IF NOT EXISTS is_child_event BOOLEAN DEFAULT FALSE;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_events_page_id ON events(event_page_id);

-- Step 3: Create role assignments table
CREATE TABLE IF NOT EXISTS role_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    role_type VARCHAR(50) NOT NULL CHECK (role_type IN ('page_controller', 'event_controller')),
    event_page_id UUID REFERENCES event_pages(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES profiles(id),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Constraints
    CONSTRAINT check_role_assignment CHECK (
        (role_type = 'page_controller' AND event_page_id IS NOT NULL AND event_id IS NULL) OR
        (role_type = 'event_controller' AND event_id IS NOT NULL)
    ),
    
    -- Ensure unique active assignments
    CONSTRAINT unique_page_controller UNIQUE (user_id, event_page_id, is_active),
    CONSTRAINT unique_event_controller UNIQUE (user_id, event_id, is_active)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_role_assignments_user ON role_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_role_assignments_page ON role_assignments(event_page_id);
CREATE INDEX IF NOT EXISTS idx_role_assignments_event ON role_assignments(event_id);

-- Step 4: Create audit log for role changes
CREATE TABLE IF NOT EXISTS role_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(50) NOT NULL, -- 'assigned', 'removed', 'updated'
    user_id UUID REFERENCES profiles(id),
    target_user_id UUID REFERENCES profiles(id),
    role_type VARCHAR(50),
    event_page_id UUID REFERENCES event_pages(id),
    event_id UUID REFERENCES events(id),
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 5: Create functions for role management

-- Function to assign Page Controller
CREATE OR REPLACE FUNCTION assign_page_controller(
    p_page_id UUID,
    p_user_id UUID,
    p_assigned_by UUID
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_assigner_role TEXT;
BEGIN
    -- Check if assigner is admin
    SELECT role INTO v_assigner_role FROM profiles WHERE id = p_assigned_by;
    
    IF v_assigner_role != 'admin' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only admins can assign page controllers');
    END IF;
    
    -- Deactivate any existing page controller for this page
    UPDATE role_assignments 
    SET is_active = FALSE 
    WHERE event_page_id = p_page_id 
    AND role_type = 'page_controller' 
    AND is_active = TRUE;
    
    -- Insert new assignment
    INSERT INTO role_assignments (user_id, role_type, event_page_id, assigned_by)
    VALUES (p_user_id, 'page_controller', p_page_id, p_assigned_by);
    
    -- Log the action
    INSERT INTO role_audit_log (action, user_id, target_user_id, role_type, event_page_id)
    VALUES ('assigned', p_assigned_by, p_user_id, 'page_controller', p_page_id);
    
    RETURN jsonb_build_object('success', true, 'message', 'Page controller assigned successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to assign Event Controller
CREATE OR REPLACE FUNCTION assign_event_controller(
    p_event_id UUID,
    p_user_id UUID,
    p_assigned_by UUID
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_assigner_role TEXT;
    v_event_page_id UUID;
    v_is_page_controller BOOLEAN;
BEGIN
    -- Get the event's page ID
    SELECT event_page_id INTO v_event_page_id FROM events WHERE id = p_event_id;
    
    -- Check if assigner is admin
    SELECT role INTO v_assigner_role FROM profiles WHERE id = p_assigned_by;
    
    -- Check if assigner is page controller for this event's page
    SELECT EXISTS (
        SELECT 1 FROM role_assignments 
        WHERE user_id = p_assigned_by 
        AND event_page_id = v_event_page_id 
        AND role_type = 'page_controller' 
        AND is_active = TRUE
    ) INTO v_is_page_controller;
    
    -- Allow if admin or page controller of the parent page
    IF v_assigner_role != 'admin' AND NOT v_is_page_controller THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only admins or page controllers can assign event controllers');
    END IF;
    
    -- Deactivate any existing event controller for this event
    UPDATE role_assignments 
    SET is_active = FALSE 
    WHERE event_id = p_event_id 
    AND role_type = 'event_controller' 
    AND is_active = TRUE;
    
    -- Insert new assignment
    INSERT INTO role_assignments (user_id, role_type, event_id, assigned_by)
    VALUES (p_user_id, 'event_controller', p_event_id, p_assigned_by);
    
    -- Log the action
    INSERT INTO role_audit_log (action, user_id, target_user_id, role_type, event_id)
    VALUES ('assigned', p_assigned_by, p_user_id, 'event_controller', p_event_id);
    
    RETURN jsonb_build_object('success', true, 'message', 'Event controller assigned successfully');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check user permissions for an event page
CREATE OR REPLACE FUNCTION check_page_permission(
    p_user_id UUID,
    p_page_id UUID
)
RETURNS TEXT AS $$
DECLARE
    v_user_role TEXT;
    v_is_page_controller BOOLEAN;
BEGIN
    -- Check if user is admin
    SELECT role INTO v_user_role FROM profiles WHERE id = p_user_id;
    IF v_user_role = 'admin' THEN
        RETURN 'admin';
    END IF;
    
    -- Check if user is page controller
    SELECT EXISTS (
        SELECT 1 FROM role_assignments 
        WHERE user_id = p_user_id 
        AND event_page_id = p_page_id 
        AND role_type = 'page_controller' 
        AND is_active = TRUE
    ) INTO v_is_page_controller;
    
    IF v_is_page_controller THEN
        RETURN 'page_controller';
    END IF;
    
    RETURN 'none';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check user permissions for an event
CREATE OR REPLACE FUNCTION check_event_permission(
    p_user_id UUID,
    p_event_id UUID
)
RETURNS TEXT AS $$
DECLARE
    v_user_role TEXT;
    v_event_page_id UUID;
    v_is_page_controller BOOLEAN;
    v_is_event_controller BOOLEAN;
BEGIN
    -- Check if user is admin
    SELECT role INTO v_user_role FROM profiles WHERE id = p_user_id;
    IF v_user_role = 'admin' THEN
        RETURN 'admin';
    END IF;
    
    -- Get event's page ID
    SELECT event_page_id INTO v_event_page_id FROM events WHERE id = p_event_id;
    
    -- Check if user is page controller for this event's page
    IF v_event_page_id IS NOT NULL THEN
        SELECT EXISTS (
            SELECT 1 FROM role_assignments 
            WHERE user_id = p_user_id 
            AND event_page_id = v_event_page_id 
            AND role_type = 'page_controller' 
            AND is_active = TRUE
        ) INTO v_is_page_controller;
        
        IF v_is_page_controller THEN
            RETURN 'page_controller';
        END IF;
    END IF;
    
    -- Check if user is event controller
    SELECT EXISTS (
        SELECT 1 FROM role_assignments 
        WHERE user_id = p_user_id 
        AND event_id = p_event_id 
        AND role_type = 'event_controller' 
        AND is_active = TRUE
    ) INTO v_is_event_controller;
    
    IF v_is_event_controller THEN
        RETURN 'event_controller';
    END IF;
    
    RETURN 'none';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 6: Create views for easier querying

-- View for page controllers with their pages
CREATE OR REPLACE VIEW page_controllers_view AS
SELECT 
    ra.id,
    ra.user_id,
    p.full_name as controller_name,
    p.email as controller_email,
    ra.event_page_id,
    ep.title as page_title,
    ra.assigned_at,
    ra.assigned_by,
    ap.full_name as assigned_by_name
FROM role_assignments ra
JOIN profiles p ON ra.user_id = p.id
JOIN event_pages ep ON ra.event_page_id = ep.id
LEFT JOIN profiles ap ON ra.assigned_by = ap.id
WHERE ra.role_type = 'page_controller' AND ra.is_active = TRUE;

-- View for event controllers with their events
CREATE OR REPLACE VIEW event_controllers_view AS
SELECT 
    ra.id,
    ra.user_id,
    p.full_name as controller_name,
    p.email as controller_email,
    ra.event_id,
    e.title as event_title,
    e.event_page_id,
    ep.title as page_title,
    ra.assigned_at,
    ra.assigned_by,
    ap.full_name as assigned_by_name
FROM role_assignments ra
JOIN profiles p ON ra.user_id = p.id
JOIN events e ON ra.event_id = e.id
LEFT JOIN event_pages ep ON e.event_page_id = ep.id
LEFT JOIN profiles ap ON ra.assigned_by = ap.id
WHERE ra.role_type = 'event_controller' AND ra.is_active = TRUE;

-- Step 7: Set up RLS policies

-- Event Pages RLS
ALTER TABLE event_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published event pages" ON event_pages
    FOR SELECT
    USING (status = 'published' OR auth.uid() IN (
        SELECT user_id FROM role_assignments 
        WHERE event_page_id = event_pages.id 
        AND is_active = TRUE
    ) OR EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    ));

CREATE POLICY "Admins can manage all event pages" ON event_pages
    FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Page controllers can manage their pages" ON event_pages
    FOR ALL
    USING (EXISTS (
        SELECT 1 FROM role_assignments 
        WHERE user_id = auth.uid() 
        AND event_page_id = event_pages.id 
        AND role_type = 'page_controller' 
        AND is_active = TRUE
    ));

-- Role Assignments RLS
ALTER TABLE role_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own assignments" ON role_assignments
    FOR SELECT
    USING (user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    ));

CREATE POLICY "Only admins can manage role assignments" ON role_assignments
    FOR ALL
    USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Grant permissions
GRANT ALL ON event_pages TO authenticated;
GRANT ALL ON role_assignments TO authenticated;
GRANT ALL ON role_audit_log TO authenticated;
GRANT SELECT ON page_controllers_view TO authenticated;
GRANT SELECT ON event_controllers_view TO authenticated;
GRANT EXECUTE ON FUNCTION assign_page_controller TO authenticated;
GRANT EXECUTE ON FUNCTION assign_event_controller TO authenticated;
GRANT EXECUTE ON FUNCTION check_page_permission TO authenticated;
GRANT EXECUTE ON FUNCTION check_event_permission TO authenticated;

-- Step 8: Add sample data for testing (optional)
-- Uncomment to add sample data
/*
INSERT INTO event_pages (title, slug, description, location, start_date, end_date, status)
VALUES 
    ('Coimbatore Vizha 2025', 'coimbatore-vizha-2025', 'Annual cultural festival featuring music, art, and food', 'Coimbatore', '2025-02-01', '2025-02-07', 'published'),
    ('Tech Summit 2025', 'tech-summit-2025', 'Technology conference and expo', 'Chennai', '2025-03-15', '2025-03-17', 'draft');
*/

COMMIT;

-- Verification
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '   EVENT PAGES SCHEMA CREATED';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Tables Created:';
    RAISE NOTICE '  • event_pages - Parent container for events';
    RAISE NOTICE '  • role_assignments - Role delegation tracking';
    RAISE NOTICE '  • role_audit_log - Activity tracking';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Functions Created:';
    RAISE NOTICE '  • assign_page_controller()';
    RAISE NOTICE '  • assign_event_controller()';
    RAISE NOTICE '  • check_page_permission()';
    RAISE NOTICE '  • check_event_permission()';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Views Created:';
    RAISE NOTICE '  • page_controllers_view';
    RAISE NOTICE '  • event_controllers_view';
    RAISE NOTICE '';
    RAISE NOTICE '✅ RLS Policies Applied';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;