'use client'

import React, { createContext, useContext } from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/utilities/ui'

export type ContextUsage = {
  total: number | null
  prompt: number | null
  candidates: number | null
  cached: number | null
  thoughts: number | null
}

type ContextState = {
  usage?: ContextUsage
  maxTokens?: number
}

const AIContext = createContext<ContextState | undefined>(undefined)

export type ContextProps = React.ComponentProps<typeof Popover> & ContextState

export const Context = ({ children, usage, maxTokens, ...props }: ContextProps) => {
  return (
    <AIContext.Provider value={{ usage, maxTokens }}>
      <Popover {...props}>{children}</Popover>
    </AIContext.Provider>
  )
}

export const useAIContext = () => {
  const ctx = useContext(AIContext)
  if (!ctx) throw new Error('Context components must be used within <Context>')
  return ctx
}

export type ContextTriggerProps = React.ComponentProps<typeof Button>

export const ContextTrigger = ({ className, children, ...props }: ContextTriggerProps) => {
  const { usage, maxTokens } = useAIContext()
  const total = usage?.total ?? 0
  const percent =
    typeof maxTokens === 'number' && maxTokens > 0
      ? Math.min(100, Math.round((total / maxTokens) * 100))
      : undefined

  return (
    <PopoverTrigger asChild>
      <Button
        variant="outline"
        size="sm"
        className={cn('h-7 px-2 text-[10px] leading-none', className)}
        {...props}
      >
        {children ? (
          children
        ) : (
          <>
            Tokens: {total != null ? total : '—'}
            {percent != null ? ` (${percent}%)` : ''}
          </>
        )}
      </Button>
    </PopoverTrigger>
  )
}

export type ContextContentProps = React.ComponentProps<typeof PopoverContent>

export const ContextContent = ({ className, ...props }: ContextContentProps) => {
  const { usage, maxTokens } = useAIContext()
  const format = (n: number | null) => (n == null ? '—' : n.toLocaleString())
  const total = usage?.total ?? null
  const percent =
    total != null && typeof maxTokens === 'number' && maxTokens > 0
      ? Math.min(100, Math.round((total / maxTokens) * 100))
      : null

  return (
    <PopoverContent className={cn('w-64 text-xs', className)} align="end" side="bottom" {...props}>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="font-medium">Context usage</div>
          <div className="text-muted-foreground">
            {percent != null ? `${percent}%` : ''}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          <div className="text-muted-foreground">Total</div>
          <div className="text-right">{format(usage?.total ?? null)}</div>
          <div className="text-muted-foreground">Input</div>
          <div className="text-right">{format(usage?.prompt ?? null)}</div>
          <div className="text-muted-foreground">Output</div>
          <div className="text-right">{format(usage?.candidates ?? null)}</div>
          <div className="text-muted-foreground">Cached</div>
          <div className="text-right">{format(usage?.cached ?? null)}</div>
          <div className="text-muted-foreground">Reasoning</div>
          <div className="text-right">{format(usage?.thoughts ?? null)}</div>
        </div>
        {typeof maxTokens === 'number' && (
          <div className="text-[11px] text-muted-foreground">
            Max tokens: {maxTokens.toLocaleString()}
          </div>
        )}
      </div>
    </PopoverContent>
  )
}


