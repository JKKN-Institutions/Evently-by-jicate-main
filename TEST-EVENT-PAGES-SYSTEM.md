# Event Pages System - Complete Testing Guide

## Pre-Requisites
1. **Database Schema Applied**: Run the EVENT-PAGES-SCHEMA.sql in Supabase
2. **Application Running**: Development server at http://localhost:3001
3. **Admin User**: At least one user with admin role for testing

## Test Plan Overview
This system implements hierarchical event management:
- **Admin** → Can manage everything
- **Page Controller** → Manages Event Pages and assigns Event Controllers  
- **Event Controller** → Manages specific child events within pages
- **User** → Standard user access

## 1. Database Schema Verification

### Step 1: Check Tables Created
```sql
-- Verify new tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('event_pages', 'role_assignments', 'role_audit_log');

-- Verify events table has new columns
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'events' 
AND column_name IN ('event_page_id', 'is_child_event');
```

### Step 2: Check Functions Created
```sql
-- Verify functions exist
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
  'assign_page_controller', 
  'assign_event_controller', 
  'check_page_permission',
  'check_event_permission'
);
```

### Step 3: Check Views Created
```sql
-- Verify views exist
SELECT table_name FROM information_schema.views 
WHERE table_schema = 'public' 
AND table_name IN ('page_controllers_view', 'event_controllers_view');
```

## 2. UI Component Testing

### Admin Interface Tests
1. **Navigate to Event Pages Management**
   - URL: `http://localhost:3001/admin/event-pages`
   - Expected: Admin interface showing Event Pages grid
   - Features: Create new page, assign controllers, view details

2. **Create Event Page Test**
   - Click "Create Event Page" button
   - Fill form with test data:
     - Title: "Test Festival 2025"
     - Slug: "test-festival-2025"  
     - Description: "Test event page for hierarchy testing"
     - Location: "Test City"
     - Start Date: Future date
     - End Date: Future date + 1 week
   - Submit form
   - Verify page appears in grid

3. **Page Controller Assignment Test**
   - Select created Event Page
   - Click "Assign Controller" 
   - Select a user from dropdown
   - Verify assignment appears in UI
   - Check database: `SELECT * FROM role_assignments WHERE role_type = 'page_controller';`

### Page Controller Dashboard Tests
1. **Access Page Controller Dashboard**
   - URL: `http://localhost:3001/page-controller`
   - Expected: If no assignments -> "No Page Assignments" message
   - If assigned -> Dashboard showing managed pages

2. **Assign User as Page Controller** (Admin action)
   ```sql
   SELECT assign_page_controller(
     '[event_page_id]'::UUID, 
     '[user_id]'::UUID, 
     '[admin_user_id]'::UUID
   );
   ```

3. **Test Page Controller View**
   - Login as assigned Page Controller user
   - Navigate to `/page-controller`
   - Expected: Dashboard showing assigned pages with stats
   - Verify can see child events and event controllers

### Event Controller Assignment Tests
1. **Create Child Event** (Admin or Page Controller)
   - Navigate to Event Page detail: `/admin/event-pages/[page_id]`
   - Click "Add Child Event"
   - Create event with:
     - `event_page_id` set to parent page
     - `is_child_event` = true
   - Verify event appears under parent page

2. **Assign Event Controller**
   - From Event Page detail view
   - Select child event 
   - Click "Assign Controller"
   - Select user from dropdown
   - Verify assignment in database:
     ```sql
     SELECT * FROM role_assignments WHERE role_type = 'event_controller';
     ```

### Event Controller Dashboard Tests
1. **Access Event Controller Dashboard**
   - URL: `http://localhost:3001/event-controller`
   - Expected: If no assignments -> "No Event Assignments" message
   - If assigned -> Dashboard showing assigned events

2. **Test Event Controller View**
   - Login as assigned Event Controller
   - Navigate to `/event-controller`
   - Expected: Dashboard showing assigned events with:
     - Event stats (bookings, revenue, etc.)
     - Management actions
     - Quick action buttons

## 3. Permission Testing

### Admin Permissions
- Can access `/admin/event-pages` ✓
- Can create Event Pages ✓
- Can assign Page Controllers ✓
- Can assign Event Controllers ✓
- Can see all data ✓

### Page Controller Permissions
- Can access `/page-controller` ✓
- Can see assigned pages only
- Can manage child events of their pages
- Can assign Event Controllers to their events
- Cannot access other pages

### Event Controller Permissions  
- Can access `/event-controller` ✓
- Can see assigned events only
- Can manage specific event details
- Cannot assign other controllers
- Cannot access other events

### User Permissions
- Can access public pages
- Cannot access controller dashboards
- Can see published Event Pages
- Cannot see admin functions

## 4. Navigation Testing

### Sidebar Navigation Updates
1. **All Authenticated Users** should see:
   - "Page Controller" menu item (shows permissions check on page)
   - "Event Controller" menu item (shows permissions check on page)

2. **Admin Users** should see:
   - "Event Pages" menu item under admin section

3. **Role-based Access**:
   - Users without assignments see "No assignments" message
   - Users with assignments see appropriate dashboards

## 5. Database Function Testing

### Test Permission Functions
```sql
-- Test page permission check
SELECT check_page_permission('[user_id]'::UUID, '[page_id]'::UUID);
-- Should return: 'admin', 'page_controller', or 'none'

-- Test event permission check  
SELECT check_event_permission('[user_id]'::UUID, '[event_id]'::UUID);
-- Should return: 'admin', 'page_controller', 'event_controller', or 'none'
```

### Test Assignment Functions
```sql
-- Test page controller assignment (as admin)
SELECT assign_page_controller(
  '[page_id]'::UUID,
  '[user_id]'::UUID, 
  '[admin_id]'::UUID
);

-- Test event controller assignment (as admin or page controller)
SELECT assign_event_controller(
  '[event_id]'::UUID,
  '[user_id]'::UUID,
  '[assigner_id]'::UUID
);
```

## 6. Expected Results

### Successful Implementation Should Show:
1. ✅ All new tables created without errors
2. ✅ Functions and views working correctly  
3. ✅ Admin can create Event Pages and assign controllers
4. ✅ Page Controllers see only their assigned pages
5. ✅ Event Controllers see only their assigned events
6. ✅ Navigation shows appropriate menu items for all users
7. ✅ Permission checks work correctly
8. ✅ Role delegation hierarchy functions as designed
9. ✅ Audit logging tracks all role changes
10. ✅ RLS policies secure data access appropriately

## 7. Common Issues & Solutions

### Build Issues
- ✅ **FIXED**: Missing UserCheck icon import in sidebar
- Check for TypeScript compilation errors: `npm run build`

### Database Issues
- Verify EVENT-PAGES-SCHEMA.sql applied successfully
- Check RLS policies don't block legitimate access
- Ensure users table has proper roles set

### Permission Issues  
- Verify user roles are set correctly in profiles table
- Check role_assignments table has active assignments
- Test permission functions return expected values

### UI Issues
- Verify all navigation components import correctly
- Check dashboard components handle empty states
- Test responsive design on mobile devices

## 8. Performance Testing

### Database Performance
- Check indexes on role_assignments table
- Verify view queries are optimized
- Test with larger datasets (100+ events, 50+ assignments)

### UI Performance
- Test dashboard loading with many events
- Check navigation responsiveness
- Verify no memory leaks in real-time subscriptions

---

## Complete Test Success Criteria

The Event Pages system passes testing when:

1. **Database Schema**: All tables, functions, views created successfully
2. **Admin Interface**: Can create pages and assign controllers
3. **Role Delegation**: Hierarchy works as Admin → Page Controller → Event Controller
4. **Permissions**: Users see only appropriate data and functions
5. **Navigation**: All role types can access their dashboards 
6. **Security**: RLS policies protect data appropriately
7. **Performance**: System responds quickly with test data load
8. **Build**: Application compiles and runs without errors

**Status**: ✅ READY FOR TESTING - All components implemented and build successful