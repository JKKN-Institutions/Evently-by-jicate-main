# 📁 Storage Setup Instructions

## ❌ Issue: "Image storage is not configured" Error

If you're getting this error when trying to upload event images, it means the Supabase storage buckets and policies aren't properly configured.

## 🚀 COMPLETE FIX (Recommended)

### Step 1: Check Current Status
1. **Open Supabase Dashboard** → Go to your project
2. **Navigate to SQL Editor** 
3. **Run Diagnostic Script**:
   ```sql
   -- Copy and paste the contents of:
   supabase/check-storage-status.sql
   ```
4. **Click "Run"** - This will show you what's missing

### Step 2: Fix All Issues
1. **In the same SQL Editor**
2. **Run Complete Fix Script**:
   ```sql
   -- Copy and paste the contents of:
   supabase/fix-storage-complete.sql
   ```
3. **Click "Run"** - This will:
   - Create the `event-images` bucket
   - Set it to public (so images display)
   - Create all necessary policies
   - Fix permissions

### Step 3: Verify Fix
- You should see "🎉 SUCCESS: Storage is now properly configured!" message
- Try uploading an image in your app

## 🔍 Alternative: Manual Setup (Not Recommended)

If you prefer manual setup:

1. **Go to Storage** in Supabase Dashboard
2. **Create Bucket**: 
   - Name: `event-images`
   - Public: ✅ **MUST be checked**
   - File size limit: 10MB
3. **Set Policies** (in SQL Editor):
   ```sql
   -- You'll need to create 4 policies manually
   -- It's easier to just run the fix script above
   ```

**⚠️ Warning**: Manual setup is error-prone. Use the SQL script instead.

## 🎯 What This Fixes

After running the setup:
- ✅ **Event image uploads** will work properly
- ✅ **Organizer logos** can be uploaded
- ✅ **User avatars** can be uploaded
- ✅ **Proper security** with RLS policies
- ✅ **File size limits** to prevent abuse

## 🔒 Security Features

The setup includes:
- **Public read access** for displaying images
- **Authenticated upload only** to prevent spam
- **User-specific folders** for organization
- **File size limits** (1-5MB depending on type)
- **MIME type restrictions** (images only)

## 🧪 Testing

After setup, test by:
1. Creating a new event
2. Uploading an image
3. Verifying the image appears in the event

## 🚨 Troubleshooting

### Still getting errors?
- Check Supabase project permissions
- Verify you're using the correct project URL and keys
- Ensure your user has proper authentication

### Images not displaying?
- Check if buckets are set to "public"
- Verify RLS policies are correctly applied
- Check browser console for CORS errors

## 📞 Need Help?

If you continue to have issues:
1. Check the browser console for detailed error messages
2. Verify your Supabase configuration
3. Ensure all environment variables are set correctly

---

*This setup only needs to be done once per Supabase project.*
