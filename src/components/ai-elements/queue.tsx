'use client'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ComponentProps } from 'react'

export type QueueProps = ComponentProps<'div'>

export const Queue = ({ className, ...props }: QueueProps) => {
  return (
    <div
      className={cn(
        'rounded-lg border bg-card text-card-foreground shadow-sm',
        className,
      )}
      {...props}
    />
  )
}

export type QueueSectionProps = ComponentProps<typeof Collapsible> & {
  defaultOpen?: boolean
}

export const QueueSection = ({
  defaultOpen = true,
  className,
  children,
  ...props
}: QueueSectionProps) => {
  return (
    <Collapsible
      defaultOpen={defaultOpen}
      className={cn('border-b last:border-b-0', className)}
      {...props}
    >
      {children}
    </Collapsible>
  )
}

export type QueueSectionTriggerProps = ComponentProps<typeof Button>

export const QueueSectionTrigger = ({
  className,
  children,
  ...props
}: QueueSectionTriggerProps) => {
  return (
    <CollapsibleTrigger asChild>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'w-full justify-between rounded-none px-4 py-3 text-left text-sm font-medium',
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 data-[state=open]:rotate-180" />
      </Button>
    </CollapsibleTrigger>
  )
}

export type QueueSectionLabelProps = ComponentProps<'span'> & {
  label: string
  count?: number
  icon?: React.ReactNode
}

export const QueueSectionLabel = ({
  label,
  count,
  icon,
  className,
  ...props
}: QueueSectionLabelProps) => {
  return (
    <span className={cn('flex items-center gap-2', className)} {...props}>
      {icon}
      {typeof count === 'number' && (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold">
          {count}
        </span>
      )}
      <span>{label}</span>
    </span>
  )
}

export type QueueSectionContentProps = ComponentProps<typeof CollapsibleContent>

export const QueueSectionContent = ({
  className,
  ...props
}: QueueSectionContentProps) => {
  return (
    <CollapsibleContent
      className={cn(
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-2',
        className,
      )}
      {...props}
    />
  )
}

export type QueueListProps = ComponentProps<typeof ScrollArea>

export const QueueList = ({ className, children, ...props }: QueueListProps) => {
  return (
    <ScrollArea className={cn('max-h-64 px-4', className)} {...props}>
      <ul className="space-y-3 py-3">{children}</ul>
    </ScrollArea>
  )
}

export type QueueItemProps = ComponentProps<'li'>

export const QueueItem = ({ className, ...props }: QueueItemProps) => {
  return (
    <li
      className={cn(
        'group flex items-start gap-3 rounded-md border border-transparent px-2 py-3 transition-colors hover:border-muted',
        className,
      )}
      {...props}
    />
  )
}

export type QueueItemIndicatorProps = ComponentProps<'span'> & {
  completed?: boolean
}

export const QueueItemIndicator = ({
  completed = false,
  className,
  ...props
}: QueueItemIndicatorProps) => {
  return (
    <span
      className={cn(
        'mt-1 h-2.5 w-2.5 rounded-full border border-muted-foreground/40',
        completed ? 'bg-muted-foreground/60' : 'bg-primary',
        className,
      )}
      {...props}
    />
  )
}

export type QueueItemContentProps = ComponentProps<'span'> & {
  completed?: boolean
}

export const QueueItemContent = ({
  completed = false,
  className,
  ...props
}: QueueItemContentProps) => {
  return (
    <span
      className={cn(
        'text-sm font-medium',
        completed ? 'line-through text-muted-foreground' : 'text-foreground',
        className,
      )}
      {...props}
    />
  )
}

export type QueueItemDescriptionProps = ComponentProps<'div'> & {
  completed?: boolean
}

export const QueueItemDescription = ({
  completed = false,
  className,
  ...props
}: QueueItemDescriptionProps) => {
  return (
    <div
      className={cn(
        'mt-1 text-xs leading-relaxed text-muted-foreground',
        completed && 'line-through opacity-60',
        className,
      )}
      {...props}
    />
  )
}

export type QueueItemActionsProps = ComponentProps<'div'>

export const QueueItemActions = ({ className, ...props }: QueueItemActionsProps) => {
  return (
    <div
      className={cn(
        'flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100',
        className,
      )}
      {...props}
    />
  )
}

export type QueueItemActionProps = Omit<ComponentProps<typeof Button>, 'variant' | 'size'>

export const QueueItemAction = ({ className, ...props }: QueueItemActionProps) => {
  return <Button variant="ghost" size="sm" className={className} {...props} />
}

export type QueueItemAttachmentProps = ComponentProps<'div'>

export const QueueItemAttachment = ({
  className,
  ...props
}: QueueItemAttachmentProps) => {
  return (
    <div
      className={cn(
        'mt-2 flex items-center gap-2 rounded-md border px-2 py-1 text-xs',
        className,
      )}
      {...props}
    />
  )
}

export type QueueItemImageProps = ComponentProps<'img'>

export const QueueItemImage = ({ className, ...props }: QueueItemImageProps) => {
  return (
    <img
      className={cn('h-10 w-10 rounded-md object-cover', className)}
      {...props}
    />
  )
}

export type QueueItemFileProps = ComponentProps<'span'>

export const QueueItemFile = ({ className, ...props }: QueueItemFileProps) => {
  return (
    <span className={cn('text-xs font-medium text-muted-foreground', className)} {...props} />
  )
}

