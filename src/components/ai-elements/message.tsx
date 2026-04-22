'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
// Tooltip component - using title attribute as fallback

export interface MessageProps extends React.HTMLAttributes<HTMLDivElement> {
  from: 'user' | 'assistant' | 'system'
}

export const Message = ({ from, className, children, ...props }: MessageProps) => {
  return (
    <div
      className={cn(
        'mb-4 break-words',
        from === 'user' ? 'ml-auto max-w-[85%]' : 'max-w-full',
        className
      )}
      {...props}
    >
      <div
        className={cn(
          'p-3 rounded-lg',
          from === 'user'
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted'
        )}
      >
        {children}
      </div>
    </div>
  )
}

export interface MessageContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export const MessageContent = ({ className, children, ...props }: MessageContentProps) => {
  return (
    <div className={cn('text-sm', className)} {...props}>
      {children}
    </div>
  )
}

export interface MessageResponseProps extends React.HTMLAttributes<HTMLDivElement> {
  children: string | React.ReactNode
  parseIncompleteMarkdown?: boolean
  className?: string
}

export const MessageResponse = ({ children, className, ...props }: MessageResponseProps) => {
  // For now, render as plain text/markdown. Streamdown will be added when properly installed
  const content = typeof children === 'string' ? children : String(children)
  
  // Convert markdown links to HTML links
  const processMarkdown = (text: string): string => {
    // Convert markdown links [text](url) to HTML <a> tags
    let processed = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
      // Handle relative URLs
      const href = url.startsWith('http') ? url : url
      return `<a href="${href}" class="text-primary underline hover:text-primary/80" target="_self">${text}</a>`
    })
    
    // Convert **bold** to <strong>
    processed = processed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    
    // Convert *italic* to <em>
    processed = processed.replace(/\*([^*]+)\*/g, '<em>$1</em>')
    
    // Convert line breaks
    processed = processed.replace(/\n/g, '<br />')
    
    return processed
  }
  
  return (
    <div
      className={cn('prose prose-sm max-w-none dark:prose-invert', className)}
      {...props}
      dangerouslySetInnerHTML={{ __html: processMarkdown(content) }}
    />
  )
}

export interface MessageActionsProps extends React.HTMLAttributes<HTMLDivElement> {}

export const MessageActions = ({ className, children, ...props }: MessageActionsProps) => {
  return (
    <div
      className={cn('flex gap-2 mt-2', className)}
      {...props}
    >
      {children}
    </div>
  )
}

export interface MessageActionProps extends React.ComponentProps<typeof Button> {
  tooltip?: string
  label: string
}

export const MessageAction = ({ tooltip, label, children, title, ...props }: MessageActionProps) => {
  return (
    <Button 
      variant="ghost" 
      size="sm" 
      title={tooltip || label || title}
      aria-label={label}
      {...props}
    >
      {children}
    </Button>
  )
}

