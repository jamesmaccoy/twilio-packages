'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { BookmarkIcon } from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

export interface CheckpointProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export const Checkpoint = ({ className, children, ...props }: CheckpointProps) => {
  return (
    <div className={cn('flex items-center gap-2 my-4', className)} {...props}>
      {children}
      <Separator className="flex-1" />
    </div>
  )
}

export interface CheckpointIconProps extends React.ComponentProps<typeof BookmarkIcon> {
  children?: React.ReactNode
}

export const CheckpointIcon = ({ children, className, ...props }: CheckpointIconProps) => {
  if (children) {
    return <>{children}</>
  }
  return <BookmarkIcon className={cn('h-4 w-4 text-muted-foreground', className)} {...props} />
}

export interface CheckpointTriggerProps extends React.ComponentProps<typeof Button> {
  children: React.ReactNode
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

export const CheckpointTrigger = ({ 
  children, 
  variant = 'ghost', 
  size = 'sm',
  className,
  ...props 
}: CheckpointTriggerProps) => {
  return (
    <Button
      variant={variant}
      size={size}
      className={cn('text-xs', className)}
      {...props}
    >
      {children}
    </Button>
  )
}

