'use client'

import { ReactNode, useEffect, useState, Suspense, lazy } from 'react'
import { MagicalCursor } from './magical-cursor'
import { ImmersiveBackground } from './immersive-background'

// Lazy load footer
const Footer = lazy(() => import('@/components/layout/footer'))

interface EnhancedLayoutProps {
  children: ReactNode
  backgroundVariant?: 'default' | 'hero' | 'dark' | 'minimal'
  showCursor?: boolean
  className?: string
}

export function EnhancedLayout({ 
  children, 
  backgroundVariant = 'default', 
  showCursor = true,
  className = ''
}: EnhancedLayoutProps) {
  const [mounted, setMounted] = useState(false)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setMounted(true)
    
    // Page entrance animation
    const timer = setTimeout(() => {
      setIsVisible(true)
    }, 100)

    // Initialize scroll animations
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible')
        }
      })
    }, observerOptions)

    // Observe all scroll animation elements
    const animatedElements = document.querySelectorAll(
      '.scroll-fade-up, .scroll-zoom-in, .scroll-slide-left, .scroll-reveal'
    )
    
    animatedElements.forEach((el) => observer.observe(el))

    return () => {
      clearTimeout(timer)
      observer.disconnect()
    }
  }, [])

  return (
    <div className={`relative min-h-screen overflow-x-hidden ${className}`}>
      {/* Immersive Background */}
      <ImmersiveBackground variant={backgroundVariant} intensity="medium" />
      
      {/* Custom Cursor */}
      {mounted && showCursor && <MagicalCursor />}
      
      {/* Main Content with Page Transition */}
      <div className={`relative z-10 transition-all duration-700 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}>
        <div className="pb-8">
          {children}
        </div>
        {/* Footer */}
        <Suspense fallback={null}>
          <Footer />
        </Suspense>
      </div>
      
      {/* Ambient Lighting Effects */}
      {mounted && (
        <>
          <div className="fixed top-0 left-0 w-96 h-96 bg-gradient-radial from-[#ffde59]/10 to-transparent rounded-full blur-3xl animate-pulse opacity-30 pointer-events-none" />
          <div className="fixed bottom-0 right-0 w-96 h-96 bg-gradient-radial from-[#0b6d41]/10 to-transparent rounded-full blur-3xl animate-pulse animation-delay-2000 opacity-30 pointer-events-none" />
        </>
      )}
    </div>
  )
}

// Specialized layout variants
export function HeroLayout({ children, ...props }: Omit<EnhancedLayoutProps, 'backgroundVariant'>) {
  return (
    <EnhancedLayout backgroundVariant="hero" {...props}>
      {children}
    </EnhancedLayout>
  )
}

export function DarkLayout({ children, ...props }: Omit<EnhancedLayoutProps, 'backgroundVariant'>) {
  return (
    <EnhancedLayout backgroundVariant="dark" {...props}>
      {children}
    </EnhancedLayout>
  )
}

export function MinimalLayout({ children, ...props }: Omit<EnhancedLayoutProps, 'backgroundVariant'>) {
  return (
    <EnhancedLayout backgroundVariant="minimal" {...props}>
      {children}
    </EnhancedLayout>
  )
}