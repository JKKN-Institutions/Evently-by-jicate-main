// List of admin email addresses
// Add or remove email addresses here to control admin access
export const ADMIN_EMAILS = [
  'director@jkkn.ac.in',
  'sroja@jkkn.ac.in',
  // Add more admin emails below as needed
  // 'admin@example.com',
]

// Helper function to check if an email is an admin
export function isAdminEmail(email: string | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email.toLowerCase())
}