import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = await createClient()

    // Check if user is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use service role to create storage bucket
    const serviceSupabase = await createClient()
    
    // Check if bucket exists
    const { data: buckets, error: listError } = await serviceSupabase.storage.listBuckets()
    
    if (listError) {
      console.error('Error listing buckets:', listError)
      return NextResponse.json({ 
        error: 'Failed to check storage buckets',
        details: listError.message 
      }, { status: 500 })
    }

    const bucketExists = buckets?.some(bucket => bucket.id === 'event-images')
    
    if (!bucketExists) {
      // Create the bucket
      const { data, error: createError } = await serviceSupabase.storage.createBucket('event-images', {
        public: true,
        fileSizeLimit: 5242880, // 5MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      })

      if (createError) {
        console.error('Error creating bucket:', createError)
        return NextResponse.json({ 
          error: 'Failed to create storage bucket',
          details: createError.message 
        }, { status: 500 })
      }

      return NextResponse.json({ 
        success: true,
        message: 'Storage bucket created successfully',
        bucket: data
      })
    } else {
      // Update bucket to ensure it's public
      const { data, error: updateError } = await serviceSupabase.storage.updateBucket('event-images', {
        public: true,
        fileSizeLimit: 5242880,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
      })

      if (updateError) {
        console.error('Error updating bucket:', updateError)
        return NextResponse.json({ 
          error: 'Failed to update storage bucket',
          details: updateError.message 
        }, { status: 500 })
      }

      return NextResponse.json({ 
        success: true,
        message: 'Storage bucket already exists and has been updated',
        bucket: data
      })
    }
    
  } catch (error) {
    console.error('Setup storage error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}