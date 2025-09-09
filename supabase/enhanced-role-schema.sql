-- =====================================================
-- ENHANCED ROLE-BASED SCHEMA FOR EVENTLY APPLICATION
-- =====================================================
-- This file enhances the existing schema with advanced role-based access control
-- Run this after the complete-schema.sql has been applied

-- =====================================================
-- ROLE PERMISSIONS TABLE
-- =====================================================
-- Create a table to manage role-specific permissions
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    role TEXT NOT NULL CHECK (role IN ('user', 'organizer', 'admin')),
    permission TEXT NOT NULL,
    resource TEXT NOT NULL,
    description TEXT,
    UNIQUE(role, permission, resource)
);

-- Insert default role permissions
INSERT INTO role_permissions (role, permission, resource, description) VALUES
-- User permissions
('user', 'read', 'events', 'Can view published events'),
('user', 'create', 'bookings', 'Can create bookings for events'),
('user', 'read', 'bookings', 'Can view own bookings'),
('user', 'update', 'bookings', 'Can update own bookings'),
('user', 'read', 'tickets', 'Can view own tickets'),
('user', 'read', 'profile', 'Can view own profile'),
('user', 'update', 'profile', 'Can update own profile'),

-- Organizer permissions (includes all user permissions)
('organizer', 'read', 'events', 'Can view all events including own drafts'),
('organizer', 'create', 'events', 'Can create new events'),
('organizer', 'update', 'events', 'Can update own events'),
('organizer', 'delete', 'events', 'Can delete own events'),
('organizer', 'read', 'bookings', 'Can view bookings for own events'),
('organizer', 'read', 'analytics', 'Can view analytics for own events'),
('organizer', 'create', 'tickets', 'Can validate tickets for own events'),
('organizer', 'read', 'payments', 'Can view payment details for own events'),

-- Admin permissions (includes all permissions)
('admin', 'read', 'all_events', 'Can view all events regardless of status'),
('admin', 'update', 'all_events', 'Can update any event'),
('admin', 'delete', 'all_events', 'Can delete any event'),
('admin', 'read', 'all_bookings', 'Can view all bookings'),
('admin', 'update', 'all_bookings', 'Can update any booking'),
('admin', 'read', 'all_users', 'Can view all user profiles'),
('admin', 'update', 'user_roles', 'Can change user roles'),
('admin', 'read', 'all_payments', 'Can view all payment records'),
('admin', 'read', 'system_analytics', 'Can view system-wide analytics')
ON CONFLICT (role, permission, resource) DO NOTHING;

-- =====================================================
-- ROLE MANAGEMENT FUNCTIONS
-- =====================================================

-- Function to check if user has specific permission
CREATE OR REPLACE FUNCTION has_permission(
    user_role TEXT,
    required_permission TEXT,
    required_resource TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM role_permissions 
        WHERE role = user_role 
        AND permission = required_permission 
        AND resource = required_resource
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user role
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID DEFAULT auth.uid())
RETURNS TEXT AS $$
DECLARE
    user_role TEXT;
BEGIN
    SELECT role INTO user_role 
    FROM profiles 
    WHERE id = user_id;
    
    RETURN COALESCE(user_role, 'user');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_user_role(user_id) = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is organizer or admin
CREATE OR REPLACE FUNCTION is_organizer_or_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_user_role(user_id) IN ('organizer', 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to promote user to organizer (admin only)
CREATE OR REPLACE FUNCTION promote_to_organizer(target_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Check if current user is admin
    IF NOT is_admin() THEN
        RAISE EXCEPTION 'Only admins can promote users to organizer';
    END IF;
    
    -- Update user role
    UPDATE profiles 
    SET role = 'organizer', updated_at = NOW()
    WHERE id = target_user_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- ENHANCED ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Drop existing policies to recreate with enhanced role-based logic
DROP POLICY IF EXISTS "Public events are viewable by everyone" ON events;
DROP POLICY IF EXISTS "Organizers can view their own events" ON events;
DROP POLICY IF EXISTS "Organizers can create events" ON events;
DROP POLICY IF EXISTS "Organizers can update their own events" ON events;

-- Enhanced Events Policies
CREATE POLICY "Enhanced events read policy" ON events
    FOR SELECT USING (
        -- Published events are public
        status = 'published' OR
        -- Organizers can see their own events
        (organizer_id = auth.uid()) OR
        -- Admins can see all events
        is_admin()
    );

CREATE POLICY "Enhanced events create policy" ON events
    FOR INSERT WITH CHECK (
        -- Must be organizer or admin
        is_organizer_or_admin() AND
        -- Must be creating for themselves (unless admin)
        (auth.uid() = organizer_id OR is_admin())
    );

CREATE POLICY "Enhanced events update policy" ON events
    FOR UPDATE USING (
        -- Own events
        organizer_id = auth.uid() OR
        -- Admins can update any event
        is_admin()
    );

CREATE POLICY "Enhanced events delete policy" ON events
    FOR DELETE USING (
        -- Own events
        organizer_id = auth.uid() OR
        -- Admins can delete any event
        is_admin()
    );

-- Enhanced Bookings Policies
DROP POLICY IF EXISTS "Users can view their own bookings" ON bookings;
DROP POLICY IF EXISTS "Organizers can view bookings for their events" ON bookings;
DROP POLICY IF EXISTS "Users can create bookings" ON bookings;
DROP POLICY IF EXISTS "Users can update their own bookings" ON bookings;

CREATE POLICY "Enhanced bookings read policy" ON bookings
    FOR SELECT USING (
        -- Users can see their own bookings
        user_id = auth.uid() OR
        -- Organizers can see bookings for their events
        EXISTS (
            SELECT 1 FROM events 
            WHERE events.id = bookings.event_id 
            AND events.organizer_id = auth.uid()
        ) OR
        -- Admins can see all bookings
        is_admin()
    );

CREATE POLICY "Enhanced bookings create policy" ON bookings
    FOR INSERT WITH CHECK (
        -- Must be authenticated and booking for themselves
        auth.uid() = user_id
    );

CREATE POLICY "Enhanced bookings update policy" ON bookings
    FOR UPDATE USING (
        -- Users can update their own bookings
        user_id = auth.uid() OR
        -- Organizers can update bookings for their events (for status changes)
        EXISTS (
            SELECT 1 FROM events 
            WHERE events.id = bookings.event_id 
            AND events.organizer_id = auth.uid()
        ) OR
        -- Admins can update any booking
        is_admin()
    );

-- Enhanced Profiles Policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Enhanced profiles read policy" ON profiles
    FOR SELECT USING (
        -- Basic profile info is public (for event organizers, etc.)
        true
    );

CREATE POLICY "Enhanced profiles update policy" ON profiles
    FOR UPDATE USING (
        -- Users can update their own profile
        auth.uid() = id OR
        -- Admins can update any profile (for role management)
        is_admin()
    );

-- Enhanced Payments Policies (if payments table exists)
DROP POLICY IF EXISTS "Users can view own payments" ON payments;
DROP POLICY IF EXISTS "Authenticated users can create payments" ON payments;
DROP POLICY IF EXISTS "Users can update own payments" ON payments;

CREATE POLICY "Enhanced payments read policy" ON payments
    FOR SELECT USING (
        -- Users can view payments for their bookings
        booking_id IN (
            SELECT id FROM bookings WHERE user_id = auth.uid()
        ) OR
        -- Organizers can view payments for their events
        booking_id IN (
            SELECT b.id FROM bookings b
            JOIN events e ON e.id = b.event_id
            WHERE e.organizer_id = auth.uid()
        ) OR
        -- Admins can view all payments
        is_admin()
    );

CREATE POLICY "Enhanced payments create policy" ON payments
    FOR INSERT WITH CHECK (
        -- Must be authenticated and payment for user's booking
        auth.uid() IS NOT NULL AND
        booking_id IN (
            SELECT id FROM bookings WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Enhanced payments update policy" ON payments
    FOR UPDATE USING (
        -- Users can update payments for their bookings
        booking_id IN (
            SELECT id FROM bookings WHERE user_id = auth.uid()
        ) OR
        -- System can update (for webhook processing)
        current_setting('role') = 'service_role'
    );

-- =====================================================
-- AUDIT LOGGING
-- =====================================================

-- Create audit log table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES profiles(id),
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address TEXT,
    user_agent TEXT
);

-- Function to log audit events
CREATE OR REPLACE FUNCTION log_audit_event(
    p_action TEXT,
    p_table_name TEXT,
    p_record_id UUID,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO audit_logs (
        user_id, action, table_name, record_id, 
        old_values, new_values, ip_address
    ) VALUES (
        auth.uid(), p_action, p_table_name, p_record_id,
        p_old_values, p_new_values, 
        current_setting('request.headers', true)::json->>'x-forwarded-for'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- ROLE-SPECIFIC VIEWS
-- =====================================================

-- View for organizer dashboard
CREATE OR REPLACE VIEW organizer_dashboard AS
SELECT 
    e.id,
    e.title,
    e.date,
    e.status,
    e.max_attendees,
    e.current_attendees,
    COUNT(b.id) as total_bookings,
    SUM(b.total_amount) as total_revenue,
    COUNT(CASE WHEN b.payment_status = 'completed' THEN 1 END) as paid_bookings
FROM events e
LEFT JOIN bookings b ON e.id = b.event_id
WHERE e.organizer_id = auth.uid()
GROUP BY e.id, e.title, e.date, e.status, e.max_attendees, e.current_attendees;

-- View for admin analytics
CREATE OR REPLACE VIEW admin_analytics AS
SELECT 
    COUNT(DISTINCT e.id) as total_events,
    COUNT(DISTINCT p.id) as total_users,
    COUNT(DISTINCT b.id) as total_bookings,
    SUM(b.total_amount) as total_revenue,
    COUNT(CASE WHEN p.role = 'organizer' THEN 1 END) as total_organizers
FROM events e
FULL OUTER JOIN profiles p ON true
FULL OUTER JOIN bookings b ON true;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- =====================================================
-- ENABLE RLS ON NEW TABLES
-- =====================================================
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Role permissions policies
CREATE POLICY "Role permissions are readable by authenticated users" ON role_permissions
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Audit logs policies
CREATE POLICY "Users can view their own audit logs" ON audit_logs
    FOR SELECT USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "System can create audit logs" ON audit_logs
    FOR INSERT WITH CHECK (true);

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
GRANT ALL ON role_permissions TO authenticated;
GRANT ALL ON audit_logs TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- =====================================================
-- HELPER FUNCTIONS FOR APPLICATION
-- =====================================================

-- Function to get user's event statistics
CREATE OR REPLACE FUNCTION get_user_event_stats(user_id UUID DEFAULT auth.uid())
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'total_events_created', COUNT(CASE WHEN organizer_id = user_id THEN 1 END),
        'total_bookings_made', COUNT(CASE WHEN b.user_id = user_id THEN 1 END),
        'total_amount_spent', COALESCE(SUM(CASE WHEN b.user_id = user_id THEN b.total_amount END), 0),
        'upcoming_events', COUNT(CASE WHEN b.user_id = user_id AND e.date >= CURRENT_DATE THEN 1 END)
    ) INTO result
    FROM events e
    LEFT JOIN bookings b ON e.id = b.event_id
    WHERE organizer_id = user_id OR b.user_id = user_id;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check event capacity
CREATE OR REPLACE FUNCTION check_event_capacity(event_id UUID, requested_quantity INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    max_capacity INTEGER;
    current_bookings INTEGER;
BEGIN
    SELECT max_attendees INTO max_capacity
    FROM events
    WHERE id = event_id;
    
    SELECT COALESCE(SUM(quantity), 0) INTO current_bookings
    FROM bookings
    WHERE event_id = check_event_capacity.event_id 
    AND booking_status = 'confirmed'
    AND payment_status = 'completed';
    
    RETURN (current_bookings + requested_quantity) <= max_capacity;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE 'Enhanced role-based schema has been successfully applied!';
    RAISE NOTICE 'Available roles: user, organizer, admin';
    RAISE NOTICE 'New features: role permissions, audit logging, enhanced RLS policies';
END $$;
