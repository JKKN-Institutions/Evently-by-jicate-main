-- =====================================================
-- FIX RLS POLICIES FOR DATA FETCHING ISSUES (V2)
-- =====================================================
-- Run this in your Supabase SQL editor to fix data access issues

-- =====================================================
-- STEP 1: DROP ALL EXISTING CONFLICTING POLICIES
-- =====================================================

-- Drop existing profiles policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Enhanced profiles read policy" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Enhanced profiles update policy" ON profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile or admins can update any" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;

-- Drop existing events policies
DROP POLICY IF EXISTS "Public events are viewable by everyone" ON events;
DROP POLICY IF EXISTS "Organizers can view their own events" ON events;
DROP POLICY IF EXISTS "Enhanced events read policy" ON events;
DROP POLICY IF EXISTS "Organizers can create events" ON events;
DROP POLICY IF EXISTS "Enhanced events create policy" ON events;
DROP POLICY IF EXISTS "Organizers can update their own events" ON events;
DROP POLICY IF EXISTS "Enhanced events update policy" ON events;
DROP POLICY IF EXISTS "Published events are viewable by everyone" ON events;
DROP POLICY IF EXISTS "Organizers and admins can create events" ON events;
DROP POLICY IF EXISTS "Organizers can update own events or admins can update any" ON events;

-- Drop existing bookings policies
DROP POLICY IF EXISTS "Users can view their own bookings" ON bookings;
DROP POLICY IF EXISTS "Organizers can view bookings for their events" ON bookings;
DROP POLICY IF EXISTS "Enhanced bookings read policy" ON bookings;
DROP POLICY IF EXISTS "Users can create bookings" ON bookings;
DROP POLICY IF EXISTS "Enhanced bookings create policy" ON bookings;
DROP POLICY IF EXISTS "Users can update their own bookings" ON bookings;
DROP POLICY IF EXISTS "Enhanced bookings update policy" ON bookings;
DROP POLICY IF EXISTS "Users can view own bookings, organizers can view event bookings, admins can view all" ON bookings;
DROP POLICY IF EXISTS "Authenticated users can create bookings" ON bookings;
DROP POLICY IF EXISTS "Users can update own bookings or admins can update any" ON bookings;

-- Drop existing payments policies
DROP POLICY IF EXISTS "Users can view own payments" ON payments;
DROP POLICY IF EXISTS "Enhanced payments read policy" ON payments;
DROP POLICY IF EXISTS "Authenticated users can create payments" ON payments;
DROP POLICY IF EXISTS "Enhanced payments create policy" ON payments;
DROP POLICY IF EXISTS "Users can update own payments" ON payments;
DROP POLICY IF EXISTS "Enhanced payments update policy" ON payments;
DROP POLICY IF EXISTS "Users, organizers, and admins can view relevant payments" ON payments;
DROP POLICY IF EXISTS "Users and admins can update payments" ON payments;

-- Drop existing payment_logs policies
DROP POLICY IF EXISTS "Users can view own payment logs" ON payment_logs;
DROP POLICY IF EXISTS "Authenticated users can create payment logs" ON payment_logs;
DROP POLICY IF EXISTS "Users, organizers, and admins can view relevant payment logs" ON payment_logs;

-- Drop existing tickets policies (if any)
DROP POLICY IF EXISTS "Users, organizers, and admins can view relevant tickets" ON tickets;
DROP POLICY IF EXISTS "System can create tickets" ON tickets;
DROP POLICY IF EXISTS "Organizers and admins can update tickets" ON tickets;

-- =====================================================
-- STEP 2: CREATE NEW COMPREHENSIVE POLICIES (WITHOUT HELPER FUNCTIONS)
-- =====================================================

-- PROFILES POLICIES
CREATE POLICY "evently_profiles_select_policy" ON profiles
    FOR SELECT USING (true);

CREATE POLICY "evently_profiles_update_policy" ON profiles
    FOR UPDATE USING (
        auth.uid() = id OR 
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "evently_profiles_insert_policy" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- EVENTS POLICIES
CREATE POLICY "evently_events_select_policy" ON events
    FOR SELECT USING (
        status = 'published' OR 
        organizer_id = auth.uid() OR 
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "evently_events_insert_policy" ON events
    FOR INSERT WITH CHECK (
        auth.uid() = organizer_id OR 
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "evently_events_update_policy" ON events
    FOR UPDATE USING (
        auth.uid() = organizer_id OR 
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- BOOKINGS POLICIES
CREATE POLICY "evently_bookings_select_policy" ON bookings
    FOR SELECT USING (
        user_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM events 
            WHERE events.id = bookings.event_id 
            AND events.organizer_id = auth.uid()
        ) OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "evently_bookings_insert_policy" ON bookings
    FOR INSERT WITH CHECK (
        auth.uid() = user_id OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "evently_bookings_update_policy" ON bookings
    FOR UPDATE USING (
        auth.uid() = user_id OR 
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- PAYMENTS POLICIES (CRITICAL FOR ADMIN PAYMENTS PAGE)
CREATE POLICY "evently_payments_select_policy" ON payments
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
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "evently_payments_insert_policy" ON payments
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL AND (
            booking_id IN (
                SELECT id FROM bookings WHERE user_id = auth.uid()
            ) OR
            EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        )
    );

CREATE POLICY "evently_payments_update_policy" ON payments
    FOR UPDATE USING (
        booking_id IN (
            SELECT id FROM bookings WHERE user_id = auth.uid()
        ) OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- PAYMENT LOGS POLICIES
CREATE POLICY "evently_payment_logs_select_policy" ON payment_logs
    FOR SELECT USING (
        booking_id IN (
            SELECT id FROM bookings WHERE user_id = auth.uid()
        ) OR
        booking_id IN (
            SELECT b.id FROM bookings b
            JOIN events e ON e.id = b.event_id
            WHERE e.organizer_id = auth.uid()
        ) OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "evently_payment_logs_insert_policy" ON payment_logs
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL
    );

-- =====================================================
-- STEP 3: ADD MISSING TABLES IF THEY DON'T EXIST
-- =====================================================

-- Create tickets table if it doesn't exist
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    ticket_number TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'valid' CHECK (status IN ('valid', 'used', 'cancelled', 'expired')),
    qr_code TEXT,
    checked_in_at TIMESTAMP WITH TIME ZONE,
    checked_in_by UUID REFERENCES profiles(id)
);

-- Enable RLS on tickets
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- Tickets policies
CREATE POLICY "evently_tickets_select_policy" ON tickets
    FOR SELECT USING (
        booking_id IN (
            SELECT id FROM bookings WHERE user_id = auth.uid()
        ) OR
        booking_id IN (
            SELECT b.id FROM bookings b
            JOIN events e ON e.id = b.event_id
            WHERE e.organizer_id = auth.uid()
        ) OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "evently_tickets_insert_policy" ON tickets
    FOR INSERT WITH CHECK (
        auth.uid() IS NOT NULL
    );

CREATE POLICY "evently_tickets_update_policy" ON tickets
    FOR UPDATE USING (
        booking_id IN (
            SELECT b.id FROM bookings b
            JOIN events e ON e.id = b.event_id
            WHERE e.organizer_id = auth.uid()
        ) OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- =====================================================
-- STEP 4: GRANT NECESSARY PERMISSIONS
-- =====================================================
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- =====================================================
-- STEP 5: CREATE INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_events_status_date ON events(status, date);
CREATE INDEX IF NOT EXISTS idx_bookings_user_event ON bookings(user_id, event_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking_status ON payments(booking_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_booking_status ON tickets(booking_id, status);

-- =====================================================
-- STEP 6: VERIFY POLICIES ARE WORKING
-- =====================================================
-- Test query to verify events are accessible
SELECT 
    'Events accessible' as test_name,
    COUNT(*) as count
FROM events;

-- Test query to verify payments are accessible
SELECT 
    'Payments accessible' as test_name,
    COUNT(*) as count
FROM payments;

-- Test query to verify bookings are accessible
SELECT 
    'Bookings accessible' as test_name,
    COUNT(*) as count
FROM bookings;

-- Show current user info for debugging
SELECT 
    'Current user' as test_name,
    auth.uid() as user_id,
    (SELECT role FROM profiles WHERE id = auth.uid()) as user_role;

-- =====================================================
-- STEP 7: ADDITIONAL VERIFICATION QUERIES
-- =====================================================
-- Test admin access specifically
SELECT 
    'Admin check' as test_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') 
        THEN 'User is admin' 
        ELSE 'User is not admin' 
    END as result;

-- Test organizer access
SELECT 
    'Organizer check' as test_name,
    CASE 
        WHEN EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'organizer') 
        THEN 'User is organizer' 
        ELSE 'User is not organizer' 
    END as result;
