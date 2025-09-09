-- =====================================================
-- SETUP USER ROLES AND FIX AUTHENTICATION ISSUES
-- =====================================================
-- Run this in your Supabase SQL editor to set up proper user roles

-- =====================================================
-- STEP 1: CHECK CURRENT AUTHENTICATION STATUS
-- =====================================================
SELECT 
    'Current Authentication Status' as check_type,
    auth.uid() as current_user_id,
    CASE 
        WHEN auth.uid() IS NULL THEN 'Not authenticated'
        ELSE 'Authenticated'
    END as auth_status;

-- =====================================================
-- STEP 2: VIEW ALL EXISTING PROFILES
-- =====================================================
SELECT 
    'Existing Profiles' as check_type,
    id,
    email,
    full_name,
    role,
    created_at
FROM profiles
ORDER BY created_at DESC;

-- =====================================================
-- STEP 3: UPDATE EXISTING USER TO ADMIN (if authenticated)
-- =====================================================
-- This will make the current authenticated user an admin
-- Only run this if you want to make the current user an admin
UPDATE profiles 
SET role = 'admin'
WHERE id = auth.uid()
AND auth.uid() IS NOT NULL;

-- =====================================================
-- STEP 4: CREATE SAMPLE USERS WITH DIFFERENT ROLES
-- =====================================================
-- Insert sample profiles for testing (these will have fake UUIDs)
-- You can update these with real user IDs later

-- Sample Admin User
INSERT INTO profiles (id, email, full_name, role, created_at, updated_at)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'admin@evently.com', 'Admin User', 'admin', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    role = 'admin',
    updated_at = NOW();

-- Sample Organizer User  
INSERT INTO profiles (id, email, full_name, role, created_at, updated_at)
VALUES 
    ('22222222-2222-2222-2222-222222222222', 'organizer@evently.com', 'Event Organizer', 'organizer', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    role = 'organizer',
    updated_at = NOW();

-- Sample Regular User
INSERT INTO profiles (id, email, full_name, role, created_at, updated_at)
VALUES 
    ('33333333-3333-3333-3333-333333333333', 'user@evently.com', 'Regular User', 'user', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    role = 'user',
    updated_at = NOW();

-- =====================================================
-- STEP 5: CREATE SAMPLE EVENTS FOR TESTING
-- =====================================================
-- Insert sample events (using the organizer user ID)
INSERT INTO events (id, title, description, date, time, venue, location, price, max_attendees, current_attendees, image_url, category, status, organizer_id, created_at, updated_at)
VALUES 
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Tech Conference 2024', 'Annual technology conference featuring latest trends in AI and Web Development', '2024-12-15', '09:00', 'Convention Center', 'New York, NY', 299.00, 500, 45, 'https://images.unsplash.com/photo-1540575467063-178a50c2df87', 'technology', 'published', '22222222-2222-2222-2222-222222222222', NOW(), NOW()),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Music Festival', 'Three-day music festival with top artists from around the world', '2024-12-20', '18:00', 'Central Park', 'New York, NY', 150.00, 1000, 234, 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f', 'music', 'published', '22222222-2222-2222-2222-222222222222', NOW(), NOW()),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Business Workshop', 'Learn essential business skills from industry experts', '2024-12-10', '10:00', 'Business Center', 'San Francisco, CA', 99.00, 50, 12, 'https://images.unsplash.com/photo-1559136555-9303baea8ebd', 'business', 'published', '22222222-2222-2222-2222-222222222222', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    updated_at = NOW();

-- =====================================================
-- STEP 6: CREATE SAMPLE BOOKINGS AND PAYMENTS
-- =====================================================
-- Insert sample bookings
INSERT INTO bookings (id, event_id, user_id, user_email, user_name, user_phone, quantity, total_amount, payment_status, booking_status, created_at)
VALUES 
    ('booking1-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'user@evently.com', 'Regular User', '+1234567892', 2, 598.00, 'completed', 'confirmed', NOW()),
    ('booking2-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', 'user@evently.com', 'Regular User', '+1234567892', 1, 150.00, 'completed', 'confirmed', NOW()),
    ('booking3-3333-3333-3333-333333333333', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', 'user@evently.com', 'Regular User', '+1234567892', 1, 99.00, 'pending', 'confirmed', NOW())
ON CONFLICT (id) DO UPDATE SET
    updated_at = NOW();

-- Insert sample payments
INSERT INTO payments (id, booking_id, amount, currency, status, razorpay_payment_id, razorpay_order_id, created_at, updated_at)
VALUES 
    ('payment1-1111-1111-1111-111111111111', 'booking1-1111-1111-1111-111111111111', 59800, 'INR', 'captured', 'pay_test123456789', 'order_test123456789', NOW(), NOW()),
    ('payment2-2222-2222-2222-222222222222', 'booking2-2222-2222-2222-222222222222', 15000, 'INR', 'captured', 'pay_test987654321', 'order_test987654321', NOW(), NOW()),
    ('payment3-3333-3333-3333-333333333333', 'booking3-3333-3333-3333-333333333333', 9900, 'INR', 'created', NULL, 'order_test555666777', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    updated_at = NOW();

-- =====================================================
-- STEP 7: VERIFY DATA WAS CREATED
-- =====================================================
SELECT 'Data Verification' as check_type, 'Events' as table_name, COUNT(*) as record_count FROM events
UNION ALL
SELECT 'Data Verification', 'Profiles', COUNT(*) FROM profiles
UNION ALL
SELECT 'Data Verification', 'Bookings', COUNT(*) FROM bookings
UNION ALL
SELECT 'Data Verification', 'Payments', COUNT(*) FROM payments;

-- =====================================================
-- STEP 8: TEST ROLE-BASED ACCESS
-- =====================================================
-- Test if current user can see events
SELECT 
    'Access Test' as check_type,
    'Events visible to current user' as test_name,
    COUNT(*) as count
FROM events
WHERE status = 'published' OR organizer_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');

-- Test if current user can see payments
SELECT 
    'Access Test' as check_type,
    'Payments visible to current user' as test_name,
    COUNT(*) as count
FROM payments
WHERE booking_id IN (
    SELECT id FROM bookings WHERE user_id = auth.uid()
) OR booking_id IN (
    SELECT b.id FROM bookings b
    JOIN events e ON e.id = b.event_id
    WHERE e.organizer_id = auth.uid()
) OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');

-- =====================================================
-- STEP 9: SHOW CURRENT USER ROLE STATUS
-- =====================================================
SELECT 
    'Final Status' as check_type,
    auth.uid() as user_id,
    (SELECT email FROM profiles WHERE id = auth.uid()) as email,
    (SELECT role FROM profiles WHERE id = auth.uid()) as current_role,
    CASE 
        WHEN EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') 
        THEN 'User is admin - can access all data' 
        WHEN EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'organizer') 
        THEN 'User is organizer - can access own events and payments'
        WHEN EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'user') 
        THEN 'User is regular user - can access own bookings'
        ELSE 'User role not set or not authenticated' 
    END as access_level;
