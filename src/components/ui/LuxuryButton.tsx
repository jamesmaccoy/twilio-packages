'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/utilities/ui'
import Link from 'next/link'

interface LuxuryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'text'
  children: React.ReactNode
  href?: string
  className?: string
}

export function LuxuryButton({
  variant = 'primary',
  children,
  href,
  className,
  ...props
}: LuxuryButtonProps) {
  const baseStyles =
    'inline-flex items-center justify-center px-8 py-4 text-sm tracking-widest uppercase transition-all duration-300 ease-out font-medium'
  
  const variants = {
    primary:
      'bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-sm hover:shadow-md',
    secondary:
      'bg-white text-[#0a0a0a] border border-[#e5e5e5] hover:border-secondary hover:text-secondary',
    outline:
      'bg-transparent border border-white text-white hover:bg-white hover:text-[#0a0a0a]',
    text: 'bg-transparent text-[#0a0a0a] hover:text-secondary px-0 py-2 underline-offset-4 hover:underline',
  }

  if (href) {
    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <Link
          href={href}
          className={cn(baseStyles, variants[variant], className)}
        >
          {children}
        </Link>
      </motion.div>
    )
  }

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(baseStyles, variants[variant], className)}
      {...props}
    >
      {children}
    </motion.button>
  )
}

