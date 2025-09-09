'use client'

import Link from 'next/link'
import { Calendar, MapPin, Users, Sparkles, Star, Zap, Globe, Shield, Ticket } from 'lucide-react'
import { useEffect, useState } from 'react'
import { HeroLayout } from '@/components/ui/enhanced-layout'
import { MagicalCard } from '@/components/ui/magical-card'
import { MagicalButton } from '@/components/ui/magical-button'

export default function Home() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    // Add scroll animations
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
          }
        })
      },
      { threshold: 0.1 }
    )

    document.querySelectorAll('.scroll-reveal').forEach((el) => {
      observer.observe(el)
    })

    return () => observer.disconnect()
  }, [])

  return (
    <HeroLayout>

      {/* Hero Section with Parallax */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden ambient-warm">
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="animate-slide-up">
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black mb-8 leading-tight">
              <span className="block text-white drop-shadow-2xl animate-neon">Discover</span>
              <span className="block gradient-text-animated text-6xl md:text-8xl lg:text-9xl mt-4">
                Amazing Events
              </span>
              <span className="block text-white text-4xl md:text-6xl lg:text-7xl mt-4 drop-shadow-2xl">
                Near You
              </span>
            </h1>
            <p className="text-xl md:text-2xl lg:text-3xl mb-12 text-white/90 max-w-4xl mx-auto leading-relaxed drop-shadow-lg animate-slide-up stagger-2">
              Book tickets for concerts, workshops, conferences, and more with our 
              <span className="font-bold text-[#ffde59] animate-pulse"> revolutionary </span>
              event platform
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row justify-center gap-6 max-w-lg mx-auto animate-scale-in stagger-3">
            <MagicalButton 
              variant="primary" 
              size="lg"
              className="micro-bounce"
              onClick={() => window.location.href = '/events'}
            >
              <Ticket className="w-5 h-5" />
              Browse Events
            </MagicalButton>
            
            <MagicalButton 
              variant="glass" 
              size="lg"
              className="micro-bounce"
              onClick={() => window.location.href = '/events/create'}
            >
              <Star className="w-5 h-5" />
              Host an Event
            </MagicalButton>
          </div>

          {/* Stats Counter */}
          <div className="grid grid-cols-3 gap-8 mt-20 max-w-3xl mx-auto animate-slide-up stagger-4">
            <MagicalCard variant="glass" className="p-6 text-center micro-lift">
              <div className="text-3xl md:text-4xl font-bold text-[#ffde59] animate-pulse">500+</div>
              <div className="text-white/80 mt-2">Active Events</div>
            </MagicalCard>
            <MagicalCard variant="glass" className="p-6 text-center micro-lift">
              <div className="text-3xl md:text-4xl font-bold text-[#ffde59] animate-pulse">10K+</div>
              <div className="text-white/80 mt-2">Happy Users</div>
            </MagicalCard>
            <MagicalCard variant="glass" className="p-6 text-center micro-lift">
              <div className="text-3xl md:text-4xl font-bold text-[#ffde59] animate-pulse">50+</div>
              <div className="text-white/80 mt-2">Cities</div>
            </MagicalCard>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <div className="w-8 h-12 border-2 border-white/50 rounded-full flex justify-center">
            <div className="w-1 h-3 bg-white/50 rounded-full mt-2 animate-pulse" />
          </div>
        </div>
      </section>

      {/* Features Section with 3D Cards */}
      <section className="py-32 relative overflow-hidden ambient-cool">
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-20 scroll-fade-up">
            <h2 className="text-4xl md:text-6xl font-black mb-6">
              Why Choose{' '}
              <span className="gradient-text-animated">Evently?</span>
            </h2>
            <p className="text-2xl text-slate-600 max-w-3xl mx-auto">
              Experience the future of event management with our cutting-edge platform
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-10 lg:gap-12">
            {[
              {
                icon: Calendar,
                title: 'Smart Discovery',
                description: 'AI-powered recommendations tailored to your interests',
                delay: 'delay-100'
              },
              {
                icon: Globe,
                title: 'Global Reach',
                description: 'Connect with events worldwide, virtual or in-person',
                delay: 'delay-200'
              },
              {
                icon: Shield,
                title: 'Secure & Fast',
                description: 'Lightning-fast bookings with bank-grade security',
                delay: 'delay-300'
              }
            ].map((feature, index) => (
              <div key={index} className={`scroll-zoom-in ${feature.delay}`}>
                <MagicalCard 
                  variant="gradient" 
                  hover3D={true}
                  sparkleEffect={true}
                  glowEffect={true}
                  className="p-8 text-center micro-lift"
                >
                  {/* Icon Container */}
                  <div className="relative mb-8">
                    <div className="w-24 h-24 mx-auto rounded-2xl bg-gradient-to-br from-[#ffde59] to-[#0b6d41] p-5 shadow-2xl micro-bounce">
                      <feature.icon className="w-full h-full text-white" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-8 h-8">
                      <Zap className="w-full h-full text-[#ffde59] animate-pulse" />
                    </div>
                  </div>
                  
                  <h3 className="text-2xl font-bold mb-4 gradient-text">{feature.title}</h3>
                  <p className="text-slate-600 leading-relaxed text-lg">
                    {feature.description}
                  </p>
                </MagicalCard>
              </div>
            ))}
          </div>

          {/* Additional Features Grid */}
          <div className="mt-24 grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { icon: '🎯', title: 'Personalized', value: 'For You' },
              { icon: '⚡', title: 'Lightning', value: 'Fast' },
              { icon: '🔒', title: 'Secure', value: 'Payments' },
              { icon: '🌍', title: 'Global', value: 'Events' }
            ].map((item, index) => (
              <div key={index} className="scroll-slide-left" style={{ animationDelay: `${index * 100}ms` }}>
                <MagicalCard variant="floating" className="p-6 text-center micro-glow">
                  <div className="text-4xl mb-3 animate-bounce-in">{item.icon}</div>
                  <div className="font-bold text-xl gradient-text">{item.title}</div>
                  <div className="text-slate-600 mt-1">{item.value}</div>
                </MagicalCard>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section with Animation */}
      <section className="relative py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0b6d41] via-[#15a862] to-[#ffde59] animate-gradient" />
        
        {/* Animated Circles */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] border border-white/10 rounded-full animate-pulse" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-white/20 rounded-full animate-pulse animation-delay-1000" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-white/30 rounded-full animate-pulse animation-delay-2000" />
        </div>
        
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <div className="scroll-reveal">
            <h2 className="text-5xl md:text-7xl font-black mb-8 text-white leading-tight">
              Ready to Start Your
              <span className="block text-[#ffde59] animate-neon mt-4">
                Event Journey?
              </span>
            </h2>
            <p className="text-2xl md:text-3xl text-white/90 mb-12 leading-relaxed max-w-3xl mx-auto">
              Join <span className="font-bold text-[#ffde59]">thousands</span> creating unforgettable experiences
            </p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-6 max-w-lg mx-auto">
              <MagicalButton 
                variant="neon" 
                size="xl"
                className="micro-bounce"
                onClick={() => window.location.href = '/events/create'}
              >
                <Sparkles className="w-6 h-6" />
                Get Started Now
                <Sparkles className="w-6 h-6" />
              </MagicalButton>
            </div>

            {/* Trust Badges */}
            <div className="mt-16 flex justify-center items-center gap-8 flex-wrap">
              {['⭐ 4.9 Rating', '🔒 Secure', '⚡ Fast', '🌍 Global'].map((badge, index) => (
                <MagicalCard 
                  key={index} 
                  variant="glass" 
                  className="px-6 py-3 text-white font-semibold micro-lift" 
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  {badge}
                </MagicalCard>
              ))}
            </div>
          </div>
        </div>
      </section>
    </HeroLayout>
  )
}
