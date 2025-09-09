-- =====================================================
-- SETUP USER ROLES AND SAMPLE DATA (SIMPLE VERSION)
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
-- STEP 2: UPDATE EXISTING USER TO ADMIN (if authenticated)
-- =====================================================
UPDATE profiles 
SET role = 'admin'
WHERE id = auth.uid()
AND auth.uid() IS NOT NULL;

-- =====================================================
-- STEP 3: CREATE SAMPLE EVENTS
-- =====================================================
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

-- =====================================================
-- STEP 4: CREATE SAMPLE BOOKINGS
-- =====================================================
-- Insert bookings only if user is authenticated and events exist
INSERT INTO bookings (id, event_id, user_id, user_email, user_name, user_phone, quantity, total_amount, payment_status, booking_status, created_at)
SELECT 
    'f1f1f1f1-a2a2-b3b3-c4c4-d5d5d5d5d5d5',
    'a1a1a1a1-b2b2-c3c3-d4d4-e5e5e5e5e5e5',
    auth.uid(),
    COALESCE((SELECT email FROM profiles WHERE id = auth.uid()), 'test@example.com'),
    COALESCE((SELECT full_name FROM profiles WHERE id = auth.uid()), 'Test User'),
    '+1234567892',
    2,
    598.00,
    'completed',
    'confirmed',
    NOW()
WHERE auth.uid() IS NOT NULL 
AND EXISTS (SELECT 1 FROM events WHERE id = 'a1a1a1a1-b2b2-c3c3-d4d4-e5e5e5e5e5e5')
ON CONFLICT (id) DO NOTHING;

INSERT INTO bookings (id, event_id, user_id, user_email, user_name, user_phone, quantity, total_amount, payment_status, booking_status, created_at)
SELECT 
    'f2f2f2f2-a3a3-b4b4-c5c5-d6d6d6d6d6d6',
    'b2b2b2b2-c3c3-d4d4-e5e5-f6f6f6f6f6f6',
    auth.uid(),
    COALESCE((SELECT email FROM profiles WHERE id = auth.uid()), 'test@example.com'),
    COALESCE((SELECT full_name FROM profiles WHERE id = auth.uid()), 'Test User'),
    '+1234567892',
    1,
    150.00,
    'completed',
    'confirmed',
    NOW()
WHERE auth.uid() IS NOT NULL 
AND EXISTS (SELECT 1 FROM events WHERE id = 'b2b2b2b2-c3c3-d4d4-e5e5-f6f6f6f6f6f6')
ON CONFLICT (id) DO NOTHING;

INSERT INTO bookings (id, event_id, user_id, user_email, user_name, user_phone, quantity, total_amount, payment_status, booking_status, created_at)
SELECT 
    'f3f3f3f3-a4a4-b5b5-c6c6-d7d7d7d7d7d7',
    'c3c3c3c3-d4d4-e5e5-f6f6-a7a7a7a7a7a7',
    auth.uid(),
    COALESCE((SELECT email FROM profiles WHERE id = auth.uid()), 'test@example.com'),
    COALESCE((SELECT full_name FROM profiles WHERE id = auth.uid()), 'Test User'),
    '+1234567892',
    1,
    99.00,
    'pending',
    'confirmed',
    NOW()
WHERE auth.uid() IS NOT NULL 
AND EXISTS (SELECT 1 FROM events WHERE id = 'c3c3c3c3-d4d4-e5e5-f6f6-a7a7a7a7a7a7')
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- STEP 5: CREATE SAMPLE PAYMENTS (only if bookings exist)
-- =====================================================
INSERT INTO payments (id, booking_id, amount, currency, status, razorpay_payment_id, razorpay_order_id, created_at, updated_at)
SELECT 
    'a1a1a1a1-f2f2-a3a3-b4b4-c5c5c5c5c5c5',
    'f1f1f1f1-a2a2-b3b3-c4c4-d5d5d5d5d5d5',
    59800,
    'INR',
    'captured',
    'pay_test123456789',
    'order_test123456789',
    NOW(),
    NOW()
WHERE EXISTS (SELECT 1 FROM bookings WHERE id = 'f1f1f1f1-a2a2-b3b3-c4c4-d5d5d5d5d5d5')
ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

INSERT INTO payments (id, booking_id, amount, currency, status, razorpay_payment_id, razorpay_order_id, created_at, updated_at)
SELECT 
    'a2a2a2a2-f3f3-a4a4-b5b5-c6c6c6c6c6c6',
    'f2f2f2f2-a3a3-b4b4-c5c5-d6d6d6d6d6d6',
    15000,
    'INR',
    'captured',
    'pay_test987654321',
    'order_test987654321',
    NOW(),
    NOW()
WHERE EXISTS (SELECT 1 FROM bookings WHERE id = 'f2f2f2f2-a3a3-b4b4-c5c5-d6d6d6d6d6d6')
ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

INSERT INTO payments (id, booking_id, amount, currency, status, razorpay_payment_id, razorpay_order_id, created_at, updated_at)
SELECT 
    'a3a3a3a3-f4f4-a5a5-b6b6-c7c7c7c7c7c7',
    'f3f3f3f3-a4a4-b5b5-c6c6-d7d7d7d7d7d7',
    9900,
    'INR',
    'created',
    NULL,
    'order_test555666777',
    NOW(),
    NOW()
WHERE EXISTS (SELECT 1 FROM bookings WHERE id = 'f3f3f3f3-a4a4-b5b5-c6c6-d7d7d7d7d7d7')
ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

-- =====================================================
-- STEP 6: CREATE SAMPLE TICKETS (only if bookings exist)
-- =====================================================
INSERT INTO tickets (id, booking_id, ticket_number, status, qr_code, created_at, updated_at)
SELECT 
    'b1b1b1b1-c2c2-d3d3-e4e4-f5f5f5f5f5f5',
    'f1f1f1f1-a2a2-b3b3-c4c4-d5d5d5d5d5d5',
    'TCK-001',
    'valid',
    'encrypted_qr_data_1',
    NOW(),
    NOW()
WHERE EXISTS (SELECT 1 FROM bookings WHERE id = 'f1f1f1f1-a2a2-b3b3-c4c4-d5d5d5d5d5d5')
ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

INSERT INTO tickets (id, booking_id, ticket_number, status, qr_code, created_at, updated_at)
SELECT 
    'b2b2b2b2-c3c3-d4d4-e5e5-f6f6f6f6f6f6',
    'f1f1f1f1-a2a2-b3b3-c4c4-d5d5d5d5d5d5',
    'TCK-002',
    'valid',
    'encrypted_qr_data_2',
    NOW(),
    NOW()
WHERE EXISTS (SELECT 1 FROM bookings WHERE id = 'f1f1f1f1-a2a2-b3b3-c4c4-d5d5d5d5d5d5')
ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

INSERT INTO tickets (id, booking_id, ticket_number, status, qr_code, created_at, updated_at)
SELECT 
    'b3b3b3b3-c4c4-d5d5-e6e6-f7f7f7f7f7f7',
    'f2f2f2f2-a3a3-b4b4-c5c5-d6d6d6d6d6d6',
    'TCK-003',
    'valid',
    'encrypted_qr_data_3',
    NOW(),
    NOW()
WHERE EXISTS (SELECT 1 FROM bookings WHERE id = 'f2f2f2f2-a3a3-b4b4-c5c5-d6d6d6d6d6d6')
ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

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
-- STEP 8: SHOW CURRENT USER ROLE STATUS
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
-- STEP 9: FINAL VERIFICATION QUERIES
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
