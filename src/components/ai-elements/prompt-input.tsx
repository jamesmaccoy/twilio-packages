'use client'

import React, { useRef, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { Send, Mic, Loader2 } from 'lucide-react'

export interface PromptInputMessage {
  text?: string
  files?: File[]
}

export interface PromptInputProps extends React.FormHTMLAttributes<HTMLFormElement> {
  onSubmit: (message: PromptInputMessage, event: React.FormEvent) => void
  accept?: string
  multiple?: boolean
  globalDrop?: boolean
  syncHiddenInput?: boolean
  maxFiles?: number
  maxFileSize?: number
  onError?: (err: { code: 'max_files' | 'max_file_size' | 'accept'; message: string }) => void
}

export const PromptInput = ({ 
  onSubmit, 
  className, 
  children,
  ...props 
}: PromptInputProps) => {
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const text = formData.get('text') as string || ''
    onSubmit({ text }, e)
  }

  return (
    <form onSubmit={handleSubmit} className={cn('relative', className)} {...props}>
      {children}
    </form>
  )
}

export interface PromptInputBodyProps extends React.HTMLAttributes<HTMLDivElement> {}

export const PromptInputBody = ({ className, children, ...props }: PromptInputBodyProps) => {
  return (
    <div className={cn('relative', className)} {...props}>
      {children}
    </div>
  )
}

export interface PromptInputTextareaProps extends React.ComponentProps<typeof Textarea> {}

export const PromptInputTextarea = React.forwardRef<HTMLTextAreaElement, PromptInputTextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <Textarea
        ref={ref}
        name="text"
        className={cn('min-h-[60px] max-h-[200px] resize-none pr-12', className)}
        {...props}
      />
    )
  }
)
PromptInputTextarea.displayName = 'PromptInputTextarea'

export interface PromptInputFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export const PromptInputFooter = ({ className, children, ...props }: PromptInputFooterProps) => {
  return (
    <div className={cn('flex items-center justify-between mt-2', className)} {...props}>
      {children}
    </div>
  )
}

export interface PromptInputToolsProps extends React.HTMLAttributes<HTMLDivElement> {}

export const PromptInputTools = ({ className, children, ...props }: PromptInputToolsProps) => {
  return (
    <div className={cn('flex items-center gap-2', className)} {...props}>
      {children}
    </div>
  )
}

export interface PromptInputSpeechButtonProps extends React.ComponentProps<typeof Button> {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  onTranscriptionChange: (text: string) => void
}

export const PromptInputSpeechButton = ({
  textareaRef,
  onTranscriptionChange,
  className,
  ...props
}: PromptInputSpeechButtonProps) => {
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<any>(null)

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      console.warn('Speech recognition not supported')
      return
    }

    try {
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.continuous = true
      recognitionRef.current.interimResults = true
      recognitionRef.current.lang = 'en-US'

      recognitionRef.current.onresult = (event: any) => {
        let transcript = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript
        }
        onTranscriptionChange(transcript)
      }

      recognitionRef.current.onend = () => {
        setIsListening(false)
      }

      recognitionRef.current.onerror = () => {
        setIsListening(false)
      }

      recognitionRef.current.start()
      setIsListening(true)
    } catch (error) {
      console.error('Error starting speech recognition:', error)
      setIsListening(false)
    }
  }, [onTranscriptionChange])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
    }
  }, [])

  return (
    <Button
      type="button"
      variant={isListening ? 'destructive' : 'outline'}
      size="icon"
      onClick={isListening ? stopListening : startListening}
      className={className}
      {...props}
    >
      {isListening ? <Mic className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
    </Button>
  )
}

export type ChatStatus = 'ready' | 'streaming' | 'submitted' | 'error'

export interface PromptInputSubmitProps extends React.ComponentProps<typeof Button> {
  status?: ChatStatus
}

export const PromptInputSubmit = ({ status = 'ready', className, ...props }: PromptInputSubmitProps) => {
  return (
    <Button
      type="submit"
      size="icon"
      className={cn('absolute bottom-1 right-1', className)}
      {...props}
    >
      {status === 'streaming' ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Send className="h-4 w-4" />
      )}
    </Button>
  )
}

// Placeholder components for other PromptInput subcomponents
export const PromptInputHeader = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div {...props}>{children}</div>
)

export const PromptInputAttachments = ({ 
  children 
}: { 
  children: (attachment: any) => React.ReactNode 
}) => null

export const PromptInputAttachment = ({ data }: { data: any }) => null

export const PromptInputActionMenu = ({ children }: { children: React.ReactNode }) => <>{children}</>
export const PromptInputActionMenuTrigger = () => null
export const PromptInputActionMenuContent = ({ children }: { children: React.ReactNode }) => <>{children}</>
export const PromptInputActionAddAttachments = () => null
export const PromptInputSelect = ({ children }: { children: React.ReactNode }) => <>{children}</>
export const PromptInputSelectTrigger = () => null
export const PromptInputSelectContent = ({ children }: { children: React.ReactNode }) => <>{children}</>
export const PromptInputSelectItem = () => null
export const PromptInputSelectValue = () => null
export const PromptInputButton = Button

