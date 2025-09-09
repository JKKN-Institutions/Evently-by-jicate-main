import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the image URL from request body
    const { image_url } = await request.json()
    
    if (!image_url) {
      return NextResponse.json({ error: 'No image URL provided' }, { status: 400 })
    }

    // Check if user owns the event or is admin
    const { data: event, error: fetchError } = await supabase
      .from('events')
      .select('organizer_id')
      .eq('id', id)
      .single()

    if (fetchError || !event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    // Check if user is the organizer
    if (event.organizer_id !== user.id) {
      // Check if user is admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Update the event image
    const { error: updateError } = await supabase
      .from('events')
      .update({ image_url })
      .eq('id', id)

    if (updateError) {
      console.error('Error updating event image:', updateError)
      return NextResponse.json(
        { error: 'Failed to update event image' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Event image updated successfully' 
    })
    
  } catch (error) {
    console.error('Error in update-image route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}