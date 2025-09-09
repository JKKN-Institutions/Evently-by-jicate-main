-- Sample data for testing Evently application
-- Run this in your Supabase SQL editor

-- Insert sample profiles (organizers)
INSERT INTO profiles (id, email, full_name, role, phone, organization, website, bio, created_at, updated_at)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'organizer@example.com', 'John Organizer', 'organizer', '+1234567890', 'Event Co.', 'https://eventco.com', 'Professional event organizer', NOW(), NOW()),
  ('22222222-2222-2222-2222-222222222222', 'admin@example.com', 'Admin User', 'admin', '+1234567891', 'Evently', 'https://evently.com', 'Platform administrator', NOW(), NOW()),
  ('33333333-3333-3333-3333-333333333333', 'user@example.com', 'Regular User', 'user', '+1234567892', NULL, NULL, 'Regular platform user', NOW(), NOW());

-- Insert sample events
INSERT INTO events (id, title, description, date, time, venue, location, price, max_attendees, current_attendees, image_url, category, status, organizer_id, created_at, updated_at)
VALUES 
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Tech Conference 2024', 'Annual technology conference featuring latest trends in AI and Web Development', '2024-12-15', '09:00', 'Convention Center', 'New York, NY', 299.00, 500, 45, 'https://images.unsplash.com/photo-1540575467063-178a50c2df87', 'technology', 'published', '11111111-1111-1111-1111-111111111111', NOW(), NOW()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Music Festival', 'Three-day music festival with top artists from around the world', '2024-12-20', '18:00', 'Central Park', 'New York, NY', 150.00, 1000, 234, 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f', 'music', 'published', '11111111-1111-1111-1111-111111111111', NOW(), NOW()),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Business Workshop', 'Learn essential business skills from industry experts', '2024-12-10', '10:00', 'Business Center', 'San Francisco, CA', 99.00, 50, 12, 'https://images.unsplash.com/photo-1559136555-9303baea8ebd', 'business', 'published', '11111111-1111-1111-1111-111111111111', NOW(), NOW()),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Art Exhibition', 'Contemporary art exhibition featuring local artists', '2024-12-25', '14:00', 'Art Gallery', 'Los Angeles, CA', 25.00, 200, 67, 'https://images.unsplash.com/photo-1578662996442-48f60103fc96', 'art', 'published', '11111111-1111-1111-1111-111111111111', NOW(), NOW()),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Free Community Event', 'Community gathering with food, games, and entertainment', '2024-12-30', '12:00', 'Community Center', 'Chicago, IL', 0.00, 300, 89, 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622', 'community', 'published', '11111111-1111-1111-1111-111111111111', NOW(), NOW());

-- Insert sample bookings
INSERT INTO bookings (id, event_id, user_id, user_email, user_name, user_phone, quantity, total_amount, payment_status, booking_status, created_at, updated_at)
VALUES 
  ('booking1-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'user@example.com', 'Regular User', '+1234567892', 2, 598.00, 'completed', 'confirmed', NOW(), NOW()),
  ('booking2-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333', 'user@example.com', 'Regular User', '+1234567892', 1, 150.00, 'completed', 'confirmed', NOW(), NOW()),
  ('booking3-3333-3333-3333-333333333333', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '33333333-3333-3333-3333-333333333333', 'user@example.com', 'Regular User', '+1234567892', 1, 99.00, 'pending', 'confirmed', NOW(), NOW());

-- Insert sample payments
INSERT INTO payments (id, booking_id, amount, currency, status, razorpay_payment_id, razorpay_order_id, created_at, updated_at)
VALUES 
  ('payment1-1111-1111-1111-111111111111', 'booking1-1111-1111-1111-111111111111', 598.00, 'INR', 'captured', 'pay_test123456789', 'order_test123456789', NOW(), NOW()),
  ('payment2-2222-2222-2222-222222222222', 'booking2-2222-2222-2222-222222222222', 150.00, 'INR', 'captured', 'pay_test987654321', 'order_test987654321', NOW(), NOW()),
  ('payment3-3333-3333-3333-333333333333', 'booking3-3333-3333-3333-333333333333', 99.00, 'INR', 'created', NULL, 'order_test555666777', NOW(), NOW());

-- Insert sample tickets
INSERT INTO tickets (id, booking_id, ticket_number, status, qr_code, created_at, updated_at)
VALUES 
  ('ticket1-1111-1111-1111-111111111111', 'booking1-1111-1111-1111-111111111111', 'TCK-001', 'valid', 'encrypted_qr_data_1', NOW(), NOW()),
  ('ticket2-2222-2222-2222-222222222222', 'booking1-1111-1111-1111-111111111111', 'TCK-002', 'valid', 'encrypted_qr_data_2', NOW(), NOW()),
  ('ticket3-3333-3333-3333-333333333333', 'booking2-2222-2222-2222-222222222222', 'TCK-003', 'valid', 'encrypted_qr_data_3', NOW(), NOW());

-- Verify the data was inserted
SELECT 'Events' as table_name, COUNT(*) as record_count FROM events
UNION ALL
SELECT 'Profiles', COUNT(*) FROM profiles
UNION ALL
SELECT 'Bookings', COUNT(*) FROM bookings
UNION ALL
SELECT 'Payments', COUNT(*) FROM payments
UNION ALL
SELECT 'Tickets', COUNT(*) FROM tickets;
