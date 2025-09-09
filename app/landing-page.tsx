'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  Calendar, 
  ArrowRight,
  Sparkles,
  CheckCircle,
  Shield,
  Zap,
  ChevronRight,
  Music,
  Monitor,
  Trophy,
  Palette,
  UtensilsCrossed,
  GraduationCap
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function LandingPage() {
  const [user, setUser] = useState<any>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    checkUser()
  }, [])

  const eventCategories = [
    { name: "Music Concerts", icon: "Music", count: "12K+" },
    { name: "Tech Conferences", icon: "Monitor", count: "8K+" },
    { name: "Sports Events", icon: "Trophy", count: "15K+" },
    { name: "Art Exhibitions", icon: "Palette", count: "6K+" },
    { name: "Food Festivals", icon: "UtensilsCrossed", count: "9K+" },
    { name: "Workshops", icon: "GraduationCap", count: "11K+" }
  ]

  return (
    <div className="min-h-screen bg-white">

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0b6d41]/5 via-[#ffde59]/5 to-white"></div>
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-[#ffde59]/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-[#0b6d41]/10 rounded-full blur-3xl"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-8 leading-tight">
              Discover & Book
              <span className="block bg-gradient-to-r from-[#0b6d41] to-[#0a5d37] bg-clip-text text-transparent mt-2">
                Amazing Events
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed">
              Your gateway to unforgettable experiences. From concerts to conferences, 
              find and book events that match your passion.
            </p>
            
            <div className="flex justify-center mb-16">
              <Link
                href="/events"
                className="inline-flex items-center justify-center px-10 py-5 bg-[#0b6d41] text-white text-lg rounded-xl hover:bg-[#0a5d37] transition-all transform hover:scale-105 shadow-xl font-semibold"
              >
                <Calendar className="h-6 w-6 mr-3" />
                Explore Events
                <ArrowRight className="h-6 w-6 ml-3" />
              </Link>
            </div>

            {/* Event Categories */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 max-w-5xl mx-auto">
              {eventCategories.map((category, index) => {
                const IconComponent = 
                  category.icon === "Music" ? Music :
                  category.icon === "Monitor" ? Monitor :
                  category.icon === "Trophy" ? Trophy :
                  category.icon === "Palette" ? Palette :
                  category.icon === "UtensilsCrossed" ? UtensilsCrossed :
                  GraduationCap;
                
                const categorySlug = category.name.toLowerCase().replace(/\s+/g, '-');
                
                return (
                  <Link
                    key={index}
                    href={`/events?category=${categorySlug}`}
                    className="bg-white rounded-xl p-6 shadow-sm hover:shadow-lg transition-all hover:-translate-y-1 cursor-pointer group block"
                  >
                    <div className="w-12 h-12 mx-auto mb-3 bg-gradient-to-br from-[#ffde59]/30 to-[#ffde59]/10 rounded-lg flex items-center justify-center group-hover:from-[#0b6d41]/20 group-hover:to-[#0b6d41]/10 transition-colors">
                      <IconComponent className="h-6 w-6 text-[#0b6d41]" />
                    </div>
                    <p className="text-sm font-semibold text-gray-900">{category.name}</p>
                    <p className="text-xs text-gray-500 mt-1">{category.count} events</p>
                  </Link>
                )
              })}
            </div>
          </div>
        </div>
      </section>


      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-[#0b6d41] to-[#0a5d37]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Start Your Event Journey?
          </h2>
          <p className="text-xl text-white/90 mb-10">
            Discover and book amazing events near you
          </p>
          <div className="flex justify-center">
            <Link
              href="/events"
              className="inline-flex items-center justify-center px-10 py-5 bg-white text-[#0b6d41] rounded-xl hover:bg-gray-100 transition-all transform hover:scale-105 shadow-xl font-semibold text-lg"
            >
              Book Events
              <ArrowRight className="h-6 w-6 ml-3" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}