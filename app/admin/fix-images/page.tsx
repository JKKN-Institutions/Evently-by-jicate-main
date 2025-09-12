'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function FixImagesPage() {
  const [events, setEvents] = useState<any[]>([])
  const [storageFiles, setStorageFiles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      // Load events
      const { data: eventsData } = await supabase
        .from('events')
        .select('id, title, image_url')
        .limit(20)
      
      // List storage files
      const { data: files } = await supabase.storage
        .from('event-images')
        .list('', { limit: 100 })
      
      setEvents(eventsData || [])
      setStorageFiles(files || [])
      console.log('Storage files:', files)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateEventImage = async (eventId: string, fileName: string) => {
    setUpdating(true)
    try {
      const imagePath = `event-images/${fileName}`
      
      const { error } = await supabase
        .from('events')
        .update({ image_url: imagePath })
        .eq('id', eventId)
      
      if (!error) {
        alert(`Updated event with image path: ${imagePath}`)
        loadData()
      } else {
        alert(`Error: ${error.message}`)
      }
    } catch (error) {
      console.error('Error updating:', error)
    } finally {
      setUpdating(false)
    }
  }

  const getPublicUrl = (fileName: string) => {
    const { data } = supabase.storage
      .from('event-images')
      .getPublicUrl(fileName)
    return data.publicUrl
  }

  if (loading) return <div className="p-8">Loading...</div>

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Fix Event Images</h1>
      
      <div className="grid grid-cols-2 gap-8">
        {/* Events */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Events ({events.length})</h2>
          <div className="space-y-4">
            {events.map(event => (
              <div key={event.id} className="border p-4 rounded">
                <h3 className="font-medium">{event.title}</h3>
                <p className="text-sm text-gray-600">ID: {event.id}</p>
                <p className="text-sm text-gray-600">
                  Current image_url: {event.image_url || 'None'}
                </p>
                {!event.image_url && (
                  <div className="mt-2">
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          updateEventImage(event.id, e.target.value)
                        }
                      }}
                      disabled={updating}
                      className="text-sm border rounded px-2 py-1"
                    >
                      <option value="">Select image...</option>
                      {storageFiles.map(file => (
                        <option key={file.name} value={file.name}>
                          {file.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Storage Files */}
        <div>
          <h2 className="text-xl font-semibold mb-4">
            Storage Files ({storageFiles.length})
          </h2>
          <div className="space-y-2">
            {storageFiles.map(file => (
              <div key={file.name} className="border p-2 rounded">
                <p className="text-sm font-medium">{file.name}</p>
                <img 
                  src={getPublicUrl(file.name)} 
                  alt={file.name}
                  className="w-20 h-20 object-cover mt-1"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}