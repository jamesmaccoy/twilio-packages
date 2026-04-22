'use client'

import { useEffect, useState, useMemo } from 'react'

export function DivineLightEffect() {
  const [isVisible, setIsVisible] = useState(true)
  const [isMounted, setIsMounted] = useState(false)

  // Generate particle positions only on client to avoid hydration mismatch
  const particles = useMemo(() => {
    if (typeof window === 'undefined') return []
    
    return Array.from({ length: 20 }, (_, i) => ({
      id: i,
      delay: Math.random() * 2,
      duration: 3 + Math.random() * 2,
      size: 3 + Math.random() * 8,
      left: 20 + Math.random() * 60,
      top: Math.random() * 40,
    }))
  }, [])

  useEffect(() => {
    setIsMounted(true)
    
    // Inject CSS keyframes
    const style = document.createElement('style')
    style.textContent = `
      @keyframes divine-shimmer {
        0%, 100% {
          opacity: 0.3;
        }
        50% {
          opacity: 0.8;
        }
      }

      @keyframes divine-float {
        0%, 100% {
          transform: translateY(0) scale(1);
          opacity: 0.6;
        }
        50% {
          transform: translateY(-20px) scale(1.2);
          opacity: 1;
        }
      }

      @keyframes divine-fade {
        0% {
          opacity: 0.8;
        }
        100% {
          opacity: 0;
        }
      }
    `
    document.head.appendChild(style)

    // Hide after animation completes
    const timer = setTimeout(() => {
      setIsVisible(false)
    }, 4000) // 4 seconds

    return () => {
      clearTimeout(timer)
      document.head.removeChild(style)
    }
  }, [])

  // Don't render until mounted to avoid hydration mismatch
  if (!isMounted || !isVisible) return null

  return (
    <div className="fixed top-0 left-0 right-0 pointer-events-none z-50 overflow-hidden" style={{ height: '40vh' }}>
      {/* Divine light from top - wider */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2">
        <div className="relative" style={{ width: '600px', height: '40vh' }}>
          {/* Main light source - wider */}
          <div 
            className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-br from-yellow-200 via-yellow-100 to-white opacity-80 blur-3xl animate-pulse" 
            style={{ width: '600px', height: '40vh' }} 
          />
          
          {/* Shimmering rays - emanating downward, wider spread */}
          {[...Array(16)].map((_, i) => (
            <div
              key={i}
              className="absolute top-0 left-1/2 -translate-x-1/2"
              style={{
                width: '600px',
                height: '40vh',
                transform: `rotate(${i * 22.5}deg)`,
                transformOrigin: 'center top',
              }}
            >
              <div 
                className="absolute top-0 left-1/2 w-1 h-full bg-gradient-to-b from-yellow-300 via-transparent to-transparent opacity-60 -translate-x-1/2"
                style={{
                  animation: `divine-shimmer 3s ease-in-out infinite`,
                  animationDelay: `${i * 0.08}s`,
                }}
              />
            </div>
          ))}

          {/* Rotating light rings - wider */}
          <div 
            className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full border-2 border-yellow-300/40 animate-spin" 
            style={{ width: '600px', height: '40vh', animationDuration: '8s' }} 
          />
          <div 
            className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full border border-yellow-200/30 animate-spin" 
            style={{ width: '550px', height: '40vh', animationDuration: '12s', animationDirection: 'reverse' }} 
          />
        </div>
      </div>

      {/* Floating light particles - spread wider */}
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute rounded-full bg-yellow-200/60 blur-sm"
          style={{
            left: `${particle.left}%`,
            top: `${particle.top}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            animation: `divine-float ${particle.duration}s ease-in-out infinite`,
            animationDelay: `${particle.delay}s`,
          }}
        />
      ))}

      {/* Overlay gradient - focused at top */}
      <div 
        className="absolute inset-0 bg-gradient-to-b from-yellow-50/30 via-yellow-50/10 to-transparent"
        style={{
          animation: 'divine-fade 4s ease-out forwards',
        }}
      />
    </div>
  )
}

