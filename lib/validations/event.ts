import { z } from 'zod'

// Ticket type schema
export const ticketTypeSchema = z.object({
  name: z.string().min(1, 'Ticket type name is required'),
  price: z.coerce.number().min(0, 'Price cannot be negative'),
  quantity: z.coerce.number().min(1, 'Must have at least 1 ticket').optional(),
  description: z.string().optional()
})

export const eventFormSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(100),
  description: z.string().min(10, 'Description must be at least 10 characters').max(1000),
  date: z.string().refine((date) => {
    const eventDate = new Date(date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return eventDate >= today
  }, 'Event date must be in the future'),
  time: z.string().optional().or(z.literal('')),
  venue: z.string().min(3, 'Venue must be at least 3 characters'),
  location: z.string().min(3, 'Location must be at least 3 characters'),
  price: z.coerce.number().min(0, 'Price cannot be negative'),
  max_attendees: z.coerce.number().min(1, 'Must have at least 1 attendee'),
  category: z.string().min(1, 'Please select a category'),
  image_url: z.union([z.string().url(), z.literal(''), z.null()]).optional(),
  // New ticket types field
  ticket_types: z.array(ticketTypeSchema).optional(),
  // Flag to use multiple ticket types
  use_multi_ticket_pricing: z.boolean().optional()
})

export type EventFormData = z.infer<typeof eventFormSchema>

export const eventCategories = [
  'Music',
  'Sports',
  'Technology',
  'Business',
  'Arts',
  'Food & Drink',
  'Health & Wellness',
  'Education',
  'Community',
  'Other'
] as const
