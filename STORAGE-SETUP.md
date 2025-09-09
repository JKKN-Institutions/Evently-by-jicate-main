# Storage Setup Instructions

## Fix for "event-images bucket not found" Error

The application requires a storage bucket for event images. Follow these steps to set it up:

### Option 1: Via Supabase Dashboard (Recommended)

1. **Go to Supabase Dashboard**
   - Navigate to your project at https://app.supabase.com
   - Click on "Storage" in the left sidebar

2. **Create the Bucket**
   - Click "New bucket"
   - Name: `event-images`
   - Set to **Public** (toggle on)
   - File size limit: 5MB
   - Allowed MIME types: `image/*`
   - Click "Create bucket"

3. **Verify Setup**
   - The bucket should appear in your buckets list
   - It should show as "Public"

### Option 2: Via SQL Editor

1. **Go to SQL Editor**
   - In Supabase Dashboard, click "SQL Editor"
   - Click "New query"

2. **Run the Setup Script**
   - Copy the entire contents of `supabase/CREATE-STORAGE-BUCKET.sql`
   - Paste and run it in the SQL editor
   - You should see "Success" message

3. **Verify**
   - Go to Storage section
   - Confirm `event-images` bucket exists

### Option 3: Automatic Fallback (Already Implemented)

The application now has automatic fallback:
- If storage is unavailable, it uses placeholder images
- Events will still be created successfully
- Placeholder URL: `/event-placeholder.svg` (local SVG file)

### Troubleshooting

**Error: "Storage not available"**
- Check your Supabase project is active
- Verify your environment variables are correct
- Ensure you have proper permissions

**Error: "Cannot create bucket"**
- You may need to manually create it via dashboard
- Check if you have admin permissions
- Try Option 1 (Dashboard method)

**Images not displaying**
- Verify bucket is set to "Public"
- Check browser console for CORS errors
- Ensure the bucket policies allow public SELECT

### Testing Upload

1. Go to any Event Page as Page Controller
2. Click "Add Event"
3. Try uploading an image
4. If upload fails, the event will still be created with a placeholder

### Notes

- Maximum file size: 5MB
- Supported formats: JPG, PNG, WebP, GIF
- Images are organized by: `user-id/event-id/timestamp.extension`
- Fallback placeholder is always available as backup