'use client'

import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import React from 'react'

interface SuggestionsProps extends React.ComponentProps<typeof ScrollArea> {
  children: React.ReactNode
}

export function Suggestions({ children, className, ...props }: SuggestionsProps) {
  return (
    <ScrollArea className={cn('w-full', className)} {...props}>
      <div className="flex gap-2 pb-4 whitespace-nowrap">
        {children}
      </div>
    </ScrollArea>
  )
}

interface SuggestionProps extends Omit<React.ComponentProps<typeof Button>, 'onClick'> {
  suggestion: string
  onClick: (suggestion: string) => void
}

export function Suggestion({ 
  suggestion, 
  onClick, 
  className,
  variant = 'outline',
  size = 'sm',
  ...props 
}: SuggestionProps) {
  return (
    <Button
      variant={variant}
      size={size}
      className={cn('whitespace-nowrap', className)}
      onClick={() => onClick(suggestion)}
      {...props}
    >
      {suggestion}
    </Button>
  )
}

