# Build and Deployment Instructions for Evently

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- npm or yarn package manager
- Supabase account (for database)
- Razorpay account (for payments)

### Installation Steps

1. **Clone the repository**
```bash
git clone https://github.com/JKKN-Institutions/Evently-by-jicate.git
cd Evently-by-jicate
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
Create a `.env.local` file in the root directory with:
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_key

# Razorpay
NEXT_PUBLIC_RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

# QR Encryption
QR_ENCRYPTION_SECRET=your_secure_random_string

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. **Set up Supabase database**
- Go to your Supabase dashboard
- Run the SQL scripts in order from the `supabase/` folder:
  - `setup-database.sql`
  - `ticketing-schema.sql`
  - `payment-tracking.sql`

5. **Run development server**
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🏗️ Building for Production

### Build the application
```bash
npm run build
```

### Run production build locally
```bash
npm start
```

## 📦 Deployment Options

### Deploy to Vercel (Recommended)
1. Push your code to GitHub
2. Connect your GitHub repo to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy!

### Deploy to other platforms
The app can be deployed to any platform that supports Next.js:
- Netlify
- AWS Amplify
- Railway
- Render

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## 🎫 Features Included

### QR Ticketing System
- ✅ Unique encrypted QR codes for each ticket
- ✅ Post-payment ticket popup with confetti
- ✅ Downloadable tickets
- ✅ QR scanner for event check-ins
- ✅ Real-time validation

### Role-Based Access
- **Users**: View and download their tickets
- **Organizers**: Manage events and scan tickets
- **Admins**: Full platform access

### Payment Integration
- Razorpay payment gateway
- Automatic ticket generation after payment
- Payment tracking and logs

### Event Management
- Create and manage events
- Real-time attendee tracking
- Dashboard with analytics

## 🔧 Troubleshooting

### Common Issues

1. **Build fails with permission errors**
   - On Windows: Run as administrator or delete `.next` folder
   - On Mac/Linux: Use `sudo rm -rf .next`

2. **Database connection issues**
   - Verify Supabase URL and keys
   - Check if tables are created properly
   - Ensure RLS policies are configured

3. **Payment gateway not working**
   - Verify Razorpay credentials
   - Use test mode for development
   - Check browser console for errors

## 📝 Latest Updates

### Version 2.0 (Current)
- Complete QR ticketing system
- Post-payment ticket popup
- Role-based ticket viewing
- Reduced FAB button sizes
- Enhanced security with encrypted QR codes

## 🤝 Support

For issues or questions:
- Create an issue on [GitHub](https://github.com/JKKN-Institutions/Evently-by-jicate/issues)
- Check existing documentation in the repo

## 📄 License

This project is proprietary to JKKN Institutions.

---

**Built with ❤️ using Next.js, Supabase, and Razorpay**