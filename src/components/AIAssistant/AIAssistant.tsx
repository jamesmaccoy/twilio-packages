'use client'

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Context as AIContextCard, ContextTrigger, ContextContent } from '@/components/ai-elements/context'
import { Card } from '@/components/ui/card'
import {
  Bot,
  X,
  Lock,
  CalendarDays,
  MapPin,
  Clock,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUserContext } from '@/context/UserContext'
import { useSubscription } from '@/hooks/useSubscription'
import { Conversation, ConversationContent, ConversationScrollButton } from '@/components/ai-elements/conversation'
import { Loader } from '@/components/ai-elements/loader'
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message'
import { Suggestions, Suggestion } from '@/components/ai-elements/suggestion'
import {
  Plan,
  PlanHeader,
  PlanTitle,
  PlanDescription,
  PlanTrigger,
  PlanContent,
  PlanAction,
} from '@/components/ai-elements/plan'
import {
  Queue,
  QueueSection,
  QueueSectionTrigger,
  QueueSectionLabel,
  QueueSectionContent,
  QueueList,
  QueueItem,
  QueueItemIndicator,
  QueueItemContent,
  QueueItemDescription,
  QueueItemActions,
  QueueItemAction,
} from '@/components/ai-elements/queue'
import {
  PromptInput,
  PromptInputHeader,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputSpeechButton,
  PromptInputSubmit,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input'
import { Reasoning, ReasoningTrigger, ReasoningContent } from '@/components/ai-elements/reasoning'

// Types and Interfaces (Keeping existing ones for compatibility)
interface TokenUsageDetails {
  total: number | null
  prompt: number | null
  candidates: number | null
  cached: number | null
  thoughts: number | null
  timestamp: number
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  propertySuggestions?: {
    fromDate: string
    toDate: string
    properties: Array<{
      id: string
      title: string
      slug: string
      description?: string
      baseRate?: number
      categories?: string
    }>
  }
  cleaningSchedule?: any
}

type CleaningScheduleSuggestion = any
interface PackageSuggestion {
  revenueCatId: string
  suggestedName: string
  description: string
  features: string[]
  baseRate?: number
  details: any
}

type AIAssistantMode = 'floating' | 'embedded'

export const AIAssistant = ({ mode = 'floating' }: { mode?: AIAssistantMode }) => {
  const { currentUser } = useUserContext()
  const { isSubscribed } = useSubscription()
  const router = useRouter()
  const pathname = usePathname()

  const isLoggedIn = !!currentUser
  const userRole = useMemo(() => (Array.isArray(currentUser?.role) ? currentUser?.role : [currentUser?.role].filter(Boolean)), [currentUser])
  const isHostOrAdmin = userRole.includes('host') || userRole.includes('admin')
  const subscriptionPlan = currentUser?.subscriptionStatus?.plan || 'none'
  const hasStandardOrPro = isSubscribed && ['basic', 'pro', 'enterprise'].includes(subscriptionPlan) || isHostOrAdmin

  // State
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const [packageSuggestions, setPackageSuggestions] = useState<PackageSuggestion[]>([])
  const [dateSuggestions, setDateSuggestions] = useState<any[]>([])
  const [scheduleSuggestions, setScheduleSuggestions] = useState<CleaningScheduleSuggestion[]>([])
  const [currentContext, setCurrentContext] = useState<any>(null)
  const [lastUsage, setLastUsage] = useState<TokenUsageDetails | null>(null)

  // Refs
  const recognitionRef = useRef<any>(null)
  const synthRef = useRef<SpeechSynthesis | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const activeThreadRef = useRef(0)
  const historyKeyRef = useRef<string | null>(null)

  // Only auto-open/close for floating mode.
  useEffect(() => {
    if (mode !== 'floating') return
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(min-width: 1024px)') // lg
    const apply = () => setIsOpen(mq.matches)
    apply()
    mq.addEventListener?.('change', apply)
    return () => mq.removeEventListener?.('change', apply)
  }, [mode])

  // Helpers
  const normalizeTokenUsage = (usage: any): TokenUsageDetails | null => {
    if (!usage || typeof usage !== 'object') return null
    const normalize = (v: any) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
    return {
      total: normalize(usage.total),
      prompt: normalize(usage.prompt),
      candidates: normalize(usage.candidates),
      cached: normalize(usage.cached),
      thoughts: normalize(usage.thoughts),
      timestamp: Date.now(),
    }
  }

  const persistTokenUsage = (usage: TokenUsageDetails | null) => {
    if (!usage || typeof window === 'undefined') return
    window.localStorage.setItem('ai:lastTokenUsage', JSON.stringify(usage))
    window.dispatchEvent(new CustomEvent('aiTokenUsage', { detail: usage }))
  }

  const extractPlainTextFromContent = useCallback((content: any): string => {
    if (!content) return ''
    if (typeof content === 'string') return content
    if (Array.isArray(content)) return content.map(extractPlainTextFromContent).join('\n')
    if (typeof content === 'object') {
      if (content.text) return content.text
      if (content.children) return extractPlainTextFromContent(content.children)
      return ''
    }
    return ''
  }, [])

  const speak = (text: string) => {
    if (synthRef.current) {
      synthRef.current.cancel()
      const utterance = new SpeechSynthesisUtterance(text.replace(/<[^>]*>?/gm, ''))
      utterance.onstart = () => setIsSpeaking(true)
      utterance.onend = () => setIsSpeaking(false)
      synthRef.current.speak(utterance)
    }
  }

  const handleSendMessage = async (messageToSend: string) => {
    const threadId = ++activeThreadRef.current
    const userMessage: Message = { role: 'user', content: messageToSend }
    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    try {
      const contextPayload = {
        message: messageToSend,
        context: currentContext?.context || 'marketplace-general',
        tier: subscriptionPlan,
        isHost: isHostOrAdmin,
        usage: lastUsage?.total || 0,
        pageData: currentContext,
        path: pathname,
      }

      // Enhanced prompt engineering for "Simple" Marketplace Concierge
      if (currentContext?.context === 'post-article') {
        const rawContent = extractPlainTextFromContent(currentContext.post?.content)
        contextPayload.message = `[Marketplace Concierge Mode] User is viewing property: ${currentContext.post?.title}. 
        Tier: ${subscriptionPlan}. 
        Content: ${rawContent.slice(0, 2000)}
        Question: ${messageToSend}`
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contextPayload),
      })

      const data = await response.json()
      if (activeThreadRef.current !== threadId) return

      const usage = normalizeTokenUsage(data.usage)
      persistTokenUsage(usage)
      setLastUsage(usage)

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message || data.response || 'I am here to help you navigate the marketplace.',
        propertySuggestions: data.propertySuggestions,
        cleaningSchedule: data.cleaningSchedule,
      }

      setMessages((prev) => [...prev, assistantMessage])
      speak(assistantMessage.content)
    } catch (error) {
      console.error('AI Assistant Error:', error)
    } finally {
      if (activeThreadRef.current === threadId) setIsLoading(false)
    }
  }

  const handlePromptSubmit = (message: PromptInputMessage) => {
    if (message.text?.trim()) {
      handleSendMessage(message.text.trim())
      setInput('')
    }
  }

  // UI Components for Tier Awareness
  const TierBadge = () => {
    if (subscriptionPlan === 'enterprise' || isHostOrAdmin) return <ShieldCheck className="h-4 w-4 text-primary" />
    if (subscriptionPlan === 'pro') return <Zap className="h-4 w-4 text-amber-500" />
    return <Sparkles className="h-4 w-4 text-muted-foreground" />
  }

  const panel = (
    <Card className={cn(mode === 'embedded' ? 'w-full' : 'w-[420px] h-full', 'shadow-2xl border-primary/10 overflow-hidden flex flex-col')}>
      {/* Marketplace Header */}
      <div className="p-4 bg-primary/5 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary rounded-lg">
            <Bot className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h3 className="font-bold text-sm leading-none flex items-center gap-2">
              Marketplace Concierge
              <TierBadge />
            </h3>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1 font-medium">
              {subscriptionPlan} Member • {lastUsage?.total || 0} tokens used
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AIContextCard usage={lastUsage || undefined}>
            <ContextTrigger />
            <ContextContent />
          </AIContextCard>
          {mode === 'floating' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="hidden lg:inline-flex text-muted-foreground hover:text-foreground"
              title="Close assistant"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <Conversation className={cn(mode === 'embedded' ? 'h-[520px]' : 'flex-1', 'bg-background/50 backdrop-blur-sm')}>
        <ConversationContent className="p-4 space-y-4">
          {messages.length === 0 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
                <p className="text-sm font-medium text-primary mb-1">Welcome to the Marketplace</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  I'm your Simple assistant, optimized for your <strong>{subscriptionPlan}</strong> tier.
                  I can help you find properties, manage bookings, or optimize schedules.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" className="text-[11px] h-auto py-2 justify-start" onClick={() => handleSendMessage("Show me top properties")}>
                  <MapPin className="h-3 w-3 mr-2" /> Top Properties
                </Button>
                <Button variant="outline" size="sm" className="text-[11px] h-auto py-2 justify-start" onClick={() => handleSendMessage("Check my availability")}>
                  <CalendarDays className="h-3 w-3 mr-2" /> Availability
                </Button>
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <Message key={i} from={msg.role}>
              <MessageContent>
                <MessageResponse>{msg.content}</MessageResponse>
              </MessageContent>
            </Message>
          ))}

          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground animate-pulse">
              <Loader size={14} />
              <span className="text-[10px] font-medium uppercase tracking-widest">Analyzing Context...</span>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="p-4 border-t bg-background">
        <PromptInput onSubmit={handlePromptSubmit}>
          <PromptInputBody>
            <PromptInputTextarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about the marketplace..."
              className="min-h-[80px] text-sm resize-none border-none focus-visible:ring-0 p-0"
            />
          </PromptInputBody>
          <PromptInputFooter className="pt-2">
            <PromptInputTools>
              <PromptInputSpeechButton
                textareaRef={textareaRef}
                onTranscriptionChange={(t) => setInput(t)}
              />
              <PromptInputSubmit status={isLoading ? 'streaming' : 'ready'} />
            </PromptInputTools>
          </PromptInputFooter>
        </PromptInput>
      </div>
    </Card>
  )

  if (mode === 'embedded') {
    return panel
  }

  return (
    <div className="fixed right-4 bottom-4 z-50 lg:top-6 lg:bottom-6 lg:right-6">
      {/* Mobile trigger (chat floats). Desktop is docked-right by default. */}
      <div className="lg:hidden">
        <Button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'rounded-full w-14 h-14 p-0 shadow-2xl transition-all duration-300 hover:scale-105',
            isOpen ? 'bg-destructive rotate-90' : 'bg-primary',
          )}
        >
          {isOpen ? <X className="h-6 w-6" /> : <Bot className="h-7 w-7" />}
        </Button>
      </div>

      {isOpen && (
        <Card
          className={cn(
            // Mobile: modal-like panel above the button
            'lg:hidden absolute bottom-20 right-0 w-[min(420px,calc(100vw-2rem))] shadow-2xl border-primary/10 overflow-hidden flex flex-col animate-in slide-in-from-bottom-4',
          )}
        >
          {panel}
        </Card>
      )}

      {/* Desktop docked-right panel */}
      <div className="hidden lg:block h-full">
        {panel}
      </div>
    </div>
  )
}
