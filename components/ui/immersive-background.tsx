'use client'

import { useEffect, useState } from 'react'
import { Sparkles, Star, Circle, Triangle, Square, Diamond } from 'lucide-react'

interface ImmersiveBackgroundProps {
  variant?: 'default' | 'hero' | 'dark' | 'minimal'
  intensity?: 'low' | 'medium' | 'high'
}

export function ImmersiveBackground({ variant = 'default', intensity = 'medium' }: ImmersiveBackgroundProps) {
  const [mounted, setMounted] = useState(false)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
    setMounted(true)

    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100
      })
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  const particleCount = {
    low: { floating: 15, geometric: 8 },
    medium: { floating: 25, geometric: 12 },
    high: { floating: 40, geometric: 18 }
  }

  const getVariantStyles = () => {
    switch (variant) {
      case 'hero':
        return {
          background: 'bg-gradient-to-br from-[#0b6d41] via-[#15a862] to-[#ffde59]',
          overlay: 'bg-black/10'
        }
      case 'dark':
        return {
          background: 'bg-gradient-to-br from-[#0a0f1b] via-[#1a1f2e] to-[#0b6d41]/20',
          overlay: 'bg-gradient-to-t from-black/50 to-transparent'
        }
      case 'minimal':
        return {
          background: 'bg-gradient-to-br from-white via-[#fff4a3]/5 to-[#0b6d41]/5',
          overlay: 'bg-white/20'
        }
      default:
        return {
          background: 'bg-gradient-to-br from-white via-[#fff4a3]/10 to-[#0b6d41]/10',
          overlay: 'bg-white/10'
        }
    }
  }

  const styles = getVariantStyles()
  const particles = particleCount[intensity]

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {/* Animated Gradient Background */}
      <div className={`absolute inset-0 ${styles.background} animate-gradient`} />
      
      {/* Interactive Gradient Overlay */}
      <div 
        className="absolute inset-0 opacity-30 transition-all duration-1000"
        style={{
          background: `radial-gradient(circle at ${mousePosition.x}% ${mousePosition.y}%, rgba(255, 222, 89, 0.3) 0%, rgba(11, 109, 65, 0.1) 50%, transparent 70%)`
        }}
      />

      {/* Animated Blob Shapes */}
      <div className="absolute inset-0">
        <div className="blob blob-yellow w-96 h-96 -top-48 -left-48 animate-blob opacity-20" />
        <div className="blob blob-green w-96 h-96 -bottom-48 -right-48 animate-blob animation-delay-2000 opacity-15" />
        <div className="blob blob-yellow w-64 h-64 top-1/2 left-1/3 animate-blob animation-delay-4000 opacity-10" />
        {intensity === 'high' && (
          <>
            <div className="blob blob-green w-48 h-48 top-1/4 right-1/4 animate-blob animation-delay-1000 opacity-15" />
            <div className="blob blob-yellow w-32 h-32 bottom-1/4 left-1/4 animate-blob animation-delay-3000 opacity-20" />
          </>
        )}
      </div>

      {/* Floating Geometric Particles */}
      {mounted && (
        <div className="absolute inset-0">
          {[...Array(particles.geometric)].map((_, i) => {
            const shapes = [Circle, Triangle, Square, Diamond, Star]
            const Shape = shapes[i % shapes.length]
            const size = Math.random() * 16 + 8
            
            return (
              <div
                key={`geo-${i}`}
                className="absolute animate-float opacity-20"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 5}s`,
                  animationDuration: `${15 + Math.random() * 10}s`
                }}
              >
                <Shape 
                  size={size} 
                  className={`${i % 2 === 0 ? 'text-[#ffde59]/30' : 'text-[#0b6d41]/30'} animate-pulse`}
                  style={{ animationDelay: `${Math.random() * 2}s` }}
                />
              </div>
            )
          })}
        </div>
      )}

      {/* Floating Sparkles */}
      {mounted && (
        <div className="absolute inset-0">
          {[...Array(particles.floating)].map((_, i) => (
            <div
              key={`sparkle-${i}`}
              className="absolute animate-float"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${10 + Math.random() * 8}s`
              }}
            >
              <Sparkles 
                className={`w-3 h-3 ${
                  i % 3 === 0 ? 'text-[#ffde59]/40' : 
                  i % 3 === 1 ? 'text-[#0b6d41]/30' : 
                  'text-[#f5c842]/35'
                } animate-pulse`}
                style={{ animationDelay: `${Math.random() * 2}s` }}
              />
            </div>
          ))}
        </div>
      )}

      {/* Ambient Light Rays */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div
            key={`ray-${i}`}
            className="absolute opacity-10 animate-pulse"
            style={{
              left: `${20 + i * 15}%`,
              top: '-50%',
              width: '2px',
              height: '200%',
              background: `linear-gradient(180deg, transparent 0%, ${i % 2 === 0 ? '#ffde59' : '#0b6d41'} 50%, transparent 100%)`,
              transform: `rotate(${15 + i * 10}deg)`,
              animationDelay: `${i * 0.5}s`,
              animationDuration: `${3 + Math.random() * 2}s`
            }}
          />
        ))}
      </div>

      {/* Mesh Gradient Overlay */}
      <div className={`absolute inset-0 ${styles.overlay} opacity-40`} />

      {/* Noise Texture */}
      <div 
        className="absolute inset-0 opacity-5 mix-blend-overlay"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
        }}
      />

      {/* Depth Layers */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-radial from-transparent via-[#ffde59]/5 to-transparent animate-pulse" />
        <div className="absolute inset-0 bg-gradient-radial from-transparent via-[#0b6d41]/5 to-transparent animate-pulse animation-delay-2000" />
      </div>
    </div>
  )
}

// Specialized background variants
export function HeroBackground() {
  return <ImmersiveBackground variant="hero" intensity="high" />
}

export function DarkBackground() {
  return <ImmersiveBackground variant="dark" intensity="medium" />
}

export function MinimalBackground() {
  return <ImmersiveBackground variant="minimal" intensity="low" />
}