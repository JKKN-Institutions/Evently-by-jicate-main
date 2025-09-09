-- =====================================================
-- SETUP USER ROLES AND FIX AUTHENTICATION ISSUES (FINAL)
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
-- STEP 4: CREATE SAMPLE EVENTS FOR TESTING
-- =====================================================
-- We'll create events using the current authenticated user as organizer
-- First, make sure the current user is an organizer or admin
UPDATE profiles 
SET role = CASE 
    WHEN role = 'admin' THEN 'admin'
    ELSE 'organizer'
END
WHERE id = auth.uid()
AND auth.uid() IS NOT NULL;

-- Insert sample events (using the current authenticated user as organizer)
INSERT INTO events (id, title, description, date, time, venue, location, price, max_attendees, current_attendees, image_url, category, status, organizer_id, created_at, updated_at)
SELECT 
    'a1a1a1a1-b2b2-c3c3-d4d4-e5e5e5e5e5e5',
    'Tech Conference 2024',
    'Annual technology conference featuring latest trends in AI and Web Development',
    '2024-12-15',
    '09:00',
    'Convention Center',
    'New York, NY',
    299.00,
    500,
    45,
    'https://images.unsplash.com/photo-1540575467063-178a50c2df87',
    'technology',
    'published',
    auth.uid(),
    NOW(),
    NOW()
WHERE auth.uid() IS NOT NULL
ON CONFLICT (id) DO UPDATE SET
    updated_at = NOW(),
    organizer_id = auth.uid();

INSERT INTO events (id, title, description, date, time, venue, location, price, max_attendees, current_attendees, image_url, category, status, organizer_id, created_at, updated_at)
SELECT 
    'b2b2b2b2-c3c3-d4d4-e5e5-f6f6f6f6f6f6',
    'Music Festival',
    'Three-day music festival with top artists from around the world',
    '2024-12-20',
    '18:00',
    'Central Park',
    'New York, NY',
    150.00,
    1000,
    234,
    'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f',
    'music',
    'published',
    auth.uid(),
    NOW(),
    NOW()
WHERE auth.uid() IS NOT NULL
ON CONFLICT (id) DO UPDATE SET
    updated_at = NOW(),
    organizer_id = auth.uid();

INSERT INTO events (id, title, description, date, time, venue, location, price, max_attendees, current_attendees, image_url, category, status, organizer_id, created_at, updated_at)
SELECT 
    'c3c3c3c3-d4d4-e5e5-f6f6-a7a7a7a7a7a7',
    'Business Workshop',
    'Learn essential business skills from industry experts',
    '2024-12-10',
    '10:00',
    'Business Center',
    'San Francisco, CA',
    99.00,
    50,
    12,
    'https://images.unsplash.com/photo-1559136555-9303baea8ebd',
    'business',
    'published',
    auth.uid(),
    NOW(),
    NOW()
WHERE auth.uid() IS NOT NULL
ON CONFLICT (id) DO UPDATE SET
    updated_at = NOW(),
    organizer_id = auth.uid();

INSERT INTO events (id, title, description, date, time, venue, location, price, max_attendees, current_attendees, image_url, category, status, organizer_id, created_at, updated_at)
SELECT 
    'd4d4d4d4-e5e5-f6f6-a7a7-b8b8b8b8b8b8',
    'Art Exhibition',
    'Contemporary art exhibition featuring local artists',
    '2024-12-25',
    '14:00',
    'Art Gallery',
    'Los Angeles, CA',
    25.00,
    200,
    67,
    'https://images.unsplash.com/photo-1578662996442-48f60103fc96',
    'art',
    'published',
    auth.uid(),
    NOW(),
    NOW()
WHERE auth.uid() IS NOT NULL
ON CONFLICT (id) DO UPDATE SET
    updated_at = NOW(),
    organizer_id = auth.uid();

INSERT INTO events (id, title, description, date, time, venue, location, price, max_attendees, current_attendees, image_url, category, status, organizer_id, created_at, updated_at)
SELECT 
    'e5e5e5e5-f6f6-a7a7-b8b8-c9c9c9c9c9c9',
    'Free Community Event',
    'Community gathering with food, games, and entertainment',
    '2024-12-30',
    '12:00',
    'Community Center',
    'Chicago, IL',
    0.00,
    300,
    89,
    'https://images.unsplash.com/photo-1511795409834-ef04bbd61622',
    'community',
    'published',
    auth.uid(),
    NOW(),
    NOW()
WHERE auth.uid() IS NOT NULL
ON CONFLICT (id) DO UPDATE SET
    updated_at = NOW(),
    organizer_id = auth.uid();

-- =====================================================
-- STEP 5: CREATE SAMPLE BOOKINGS AND PAYMENTS
-- =====================================================
-- Insert sample bookings (using current user as the customer)
INSERT INTO bookings (id, event_id, user_id, user_email, user_name, user_phone, quantity, total_amount, payment_status, booking_status, created_at)
SELECT 
    'f1f1f1f1-a2a2-b3b3-c4c4-d5d5d5d5d5d5',
    'a1a1a1a1-b2b2-c3c3-d4d4-e5e5e5e5e5e5',
    auth.uid(),
    (SELECT email FROM profiles WHERE id = auth.uid()),
    COALESCE((SELECT full_name FROM profiles WHERE id = auth.uid()), 'Test User'),
    '+1234567892',
    2,
    598.00,
    'completed',
    'confirmed',
    NOW()
WHERE auth.uid() IS NOT NULL
ON CONFLICT (id) DO UPDATE SET
    updated_at = NOW();

INSERT INTO bookings (id, event_id, user_id, user_email, user_name, user_phone, quantity, total_amount, payment_status, booking_status, created_at)
SELECT 
    'f2f2f2f2-a3a3-b4b4-c5c5-d6d6d6d6d6d6',
    'b2b2b2b2-c3c3-d4d4-e5e5-f6f6f6f6f6f6',
    auth.uid(),
    (SELECT email FROM profiles WHERE id = auth.uid()),
    COALESCE((SELECT full_name FROM profiles WHERE id = auth.uid()), 'Test User'),
    '+1234567892',
    1,
    150.00,
    'completed',
    'confirmed',
    NOW()
WHERE auth.uid() IS NOT NULL
ON CONFLICT (id) DO UPDATE SET
    updated_at = NOW();

INSERT INTO bookings (id, event_id, user_id, user_email, user_name, user_phone, quantity, total_amount, payment_status, booking_status, created_at)
SELECT 
    'f3f3f3f3-a4a4-b5b5-c6c6-d7d7d7d7d7d7',
    'c3c3c3c3-d4d4-e5e5-f6f6-a7a7a7a7a7a7',
    auth.uid(),
    (SELECT email FROM profiles WHERE id = auth.uid()),
    COALESCE((SELECT full_name FROM profiles WHERE id = auth.uid()), 'Test User'),
    '+1234567892',
    1,
    99.00,
    'pending',
    'confirmed',
    NOW()
WHERE auth.uid() IS NOT NULL
ON CONFLICT (id) DO UPDATE SET
    updated_at = NOW();

-- Insert sample payments
INSERT INTO payments (id, booking_id, amount, currency, status, razorpay_payment_id, razorpay_order_id, created_at, updated_at)
VALUES 
    ('a1a1a1a1-f2f2-a3a3-b4b4-c5c5c5c5c5c5', 'f1f1f1f1-a2a2-b3b3-c4c4-d5d5d5d5d5d5', 59800, 'INR', 'captured', 'pay_test123456789', 'order_test123456789', NOW(), NOW()),
    ('a2a2a2a2-f3f3-a4a4-b5b5-c6c6c6c6c6c6', 'f2f2f2f2-a3a3-b4b4-c5c5-d6d6d6d6d6d6', 15000, 'INR', 'captured', 'pay_test987654321', 'order_test987654321', NOW(), NOW()),
    ('a3a3a3a3-f4f4-a5a5-b6b6-c7c7c7c7c7c7', 'f3f3f3f3-a4a4-b5b5-c6c6-d7d7d7d7d7d7', 9900, 'INR', 'created', NULL, 'order_test555666777', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    updated_at = NOW();

-- =====================================================
-- STEP 6: CREATE SAMPLE TICKETS
-- =====================================================
-- Insert sample tickets for the bookings
INSERT INTO tickets (id, booking_id, ticket_number, status, qr_code, created_at, updated_at)
VALUES 
    ('b1b1b1b1-c2c2-d3d3-e4e4-f5f5f5f5f5f5', 'f1f1f1f1-a2a2-b3b3-c4c4-d5d5d5d5d5d5', 'TCK-001', 'valid', 'encrypted_qr_data_1', NOW(), NOW()),
    ('b2b2b2b2-c3c3-d4d4-e5e5-f6f6f6f6f6f6', 'f1f1f1f1-a2a2-b3b3-c4c4-d5d5d5d5d5d5', 'TCK-002', 'valid', 'encrypted_qr_data_2', NOW(), NOW()),
    ('b3b3b3b3-c4c4-d5d5-e6e6-f7f7f7f7f7f7', 'f2f2f2f2-a3a3-b4b4-c5c5-d6d6d6d6d6d6', 'TCK-003', 'valid', 'encrypted_qr_data_3', NOW(), NOW())
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
SELECT 'Data Verification', 'Payments', COUNT(*) FROM payments
UNION ALL
SELECT 'Data Verification', 'Tickets', COUNT(*) FROM tickets;

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

-- Test if current user can see bookings
SELECT 
    'Access Test' as check_type,
    'Bookings visible to current user' as test_name,
    COUNT(*) as count
FROM bookings
WHERE user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM events 
    WHERE events.id = bookings.event_id 
    AND events.organizer_id = auth.uid()
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

-- =====================================================
-- STEP 10: FINAL VERIFICATION QUERIES
-- =====================================================
-- Show events created by current user
SELECT 
    'My Events' as check_type,
    title,
    status,
    price,
    max_attendees,
    current_attendees
FROM events 
WHERE organizer_id = auth.uid()
ORDER BY created_at DESC;

-- Show bookings made by current user
SELECT 
    'My Bookings' as check_type,
    b.id,
    e.title as event_title,
    b.quantity,
    b.total_amount,
    b.payment_status
FROM bookings b
JOIN events e ON e.id = b.event_id
WHERE b.user_id = auth.uid()
ORDER BY b.created_at DESC;

-- Show payments for current user
SELECT 
    'My Payments' as check_type,
    p.id,
    p.amount,
    p.status,
    p.razorpay_payment_id,
    e.title as event_title
FROM payments p
JOIN bookings b ON b.id = p.booking_id
JOIN events e ON e.id = b.event_id
WHERE b.user_id = auth.uid() OR e.organizer_id = auth.uid()
ORDER BY p.created_at DESC;
