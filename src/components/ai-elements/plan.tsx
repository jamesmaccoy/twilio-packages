'use client'

import React, { createContext, useContext } from 'react'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Shimmer } from './shimmer'
import type { ComponentProps } from 'react'

type PlanContextValue = {
  isStreaming: boolean
}

const PlanContext = createContext<PlanContextValue | null>(null)

const usePlanContext = () => {
  const context = useContext(PlanContext)
  if (!context) {
    throw new Error('Plan components must be used within <Plan>')
  }
  return context
}

export type PlanProps = ComponentProps<typeof Collapsible> & {
  isStreaming?: boolean
}

export const Plan = ({
  isStreaming = false,
  defaultOpen,
  className,
  children,
  ...props
}: PlanProps) => {
  return (
    <PlanContext.Provider value={{ isStreaming }}>
      <Collapsible defaultOpen={defaultOpen} className={cn('mb-4', className)} {...props}>
        <Card>{children}</Card>
      </Collapsible>
    </PlanContext.Provider>
  )
}

export type PlanHeaderProps = ComponentProps<typeof CardHeader>

export const PlanHeader = ({ className, ...props }: PlanHeaderProps) => {
  return <CardHeader className={className} {...props} />
}

export type PlanTitleProps = Omit<ComponentProps<typeof CardTitle>, 'children'> & {
  children?: string
}

export const PlanTitle = ({ children, className, ...props }: PlanTitleProps) => {
  const { isStreaming } = usePlanContext()
  
  return (
    <CardTitle className={className} {...props}>
      {isStreaming && children ? (
        <Shimmer className="h-6 w-48" />
      ) : (
        children
      )}
    </CardTitle>
  )
}

export type PlanDescriptionProps = Omit<ComponentProps<typeof CardDescription>, 'children'> & {
  children?: string
}

export const PlanDescription = ({ children, className, ...props }: PlanDescriptionProps) => {
  const { isStreaming } = usePlanContext()
  
  return (
    <CardDescription className={className} {...props}>
      {isStreaming && children ? (
        <Shimmer className="h-4 w-64 mt-2" />
      ) : (
        children
      )}
    </CardDescription>
  )
}

export type PlanTriggerProps = ComponentProps<typeof CollapsibleTrigger>

export const PlanTrigger = ({ className, children, ...props }: PlanTriggerProps) => {
  return (
    <CollapsibleTrigger asChild>
      <Button
        variant="ghost"
        size="sm"
        className={cn('w-full justify-between', className)}
        {...props}
      >
        {children}
        <ChevronDown className="h-4 w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
      </Button>
    </CollapsibleTrigger>
  )
}

export type PlanContentProps = ComponentProps<typeof CardContent>

export const PlanContent = ({ className, ...props }: PlanContentProps) => {
  return (
    <CollapsibleContent>
      <CardContent
        className={cn(
          'pt-0',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-2',
          className
        )}
        {...props}
      />
    </CollapsibleContent>
  )
}

export type PlanFooterProps = ComponentProps<'div'>

export const PlanFooter = ({ className, ...props }: PlanFooterProps) => {
  return <div className={cn('px-6 py-4', className)} {...props} />
}

export type PlanActionProps = ComponentProps<typeof Button>

export const PlanAction = ({ className, ...props }: PlanActionProps) => {
  return <Button className={className} {...props} />
}

