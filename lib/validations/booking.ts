import { z } from 'zod'

export const bookingFormSchema = z.object({
  user_name: z.string().min(2, 'Name must be at least 2 characters'),
  user_email: z.string().email('Invalid email address'),
  user_phone: z.string().regex(/^[0-9]{10}$/, 'Phone number must be 10 digits'),
  quantity: z.coerce.number().min(1, 'Must book at least 1 ticket').max(20, 'Maximum 20 tickets per booking'),
})

export type BookingFormData = z.infer<typeof bookingFormSchema>
