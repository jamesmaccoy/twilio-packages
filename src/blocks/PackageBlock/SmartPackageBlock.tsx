'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { cn } from '@/utilities/cn'
import { Button } from '@/components/ui/button'
import { Bot, Send, Sparkles, Loader2, User, Package, Mic, MicOff, CheckCircle, XCircle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useChat } from '@ai-sdk/react'
import { useUserContext } from '@/context/UserContext'
import { PackagePreview } from '@/components/PackagePreview'
import type { PackageBlockType } from './types'

interface SmartPackageBlockProps {
  className?: string
  postId: string
  blockType?: 'packageBlock'
}

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  id?: string
  parts?: any[]
}

export const SmartPackageBlock: React.FC<SmartPackageBlockProps & PackageBlockType> = ({
  className,
  postId,
  blockType = 'packageBlock',
}) => {
  const { currentUser } = useUserContext()
  const isLoggedIn = !!currentUser
  
  const userRole = Array.isArray(currentUser?.role) ? currentUser?.role : [currentUser?.role].filter(Boolean)
  const isHostOrAdmin = userRole.includes('host') || userRole.includes('admin')
  
  const [input, setInput] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const [pendingPackagePreview, setPendingPackagePreview] = useState<any>(null)
  const [isSavingPackage, setIsSavingPackage] = useState(false)
  const [createdPackages, setCreatedPackages] = useState<any[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<any>(null)

  // Use AI SDK's useChat hook for package creation (generative UI)
  const chatHook = useChat({
    api: '/api/chat/manage',
    body: {
      pageData: {
        posts: [{ id: postId }],
        postId,
      },
    },
    onFinish: (message) => {
      // Check if the finished message has a package preview tool call
      if (message?.role === 'assistant' && message.parts) {
        const previewPart = message.parts.find((part: any) =>
          part.type === 'tool-previewPackage' && part.state === 'output-available'
        )
        if (previewPart?.output) {
          setPendingPackagePreview({
            ...previewPart.output,
            postId, // Ensure postId is included
          })
        }

        // Check if package was created successfully
        const createPart = message.parts.find((part: any) =>
          part.type === 'tool-createPackage' && part.state === 'output-available'
        )
        if (createPart?.output?.success) {
          setIsSavingPackage(false)
          const createdPackage = createPart.output.package || createPart.output
          setCreatedPackages((prev) => [...prev, createdPackage])
          setPendingPackagePreview(null)
          
          // Show success message
          const successMessage: Message = {
            role: 'assistant',
            content: `✅ Package "${createdPackage.name}" created successfully! It's now available for your property.`,
            id: `success-${Date.now()}`,
          }
          // Note: We can't directly add to messages, but the AI will respond
        } else if (createPart?.output?.success === false) {
          setIsSavingPackage(false)
          console.error('Package creation failed:', createPart.output.error)
        }
      }
    },
  })

  // Extract values from chat hook with fallbacks
  const {
    messages = [],
    input: chatInput = '',
    handleInputChange: handleChatInputChange,
    handleSubmit,
    isLoading = false,
    setInput: setChatInput,
  } = chatHook || {}

  // Sync input state
  const currentInput = chatInput || input
  const handleCurrentInputChange = handleChatInputChange || ((e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value))

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRecognition) {
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
            if (setChatInput && typeof setChatInput === 'function') {
              setChatInput(transcript)
            } else {
              setInput(transcript)
            }
          }

          recognitionRef.current.onend = () => {
            setIsListening(false)
          }

          recognitionRef.current.onerror = () => {
            setIsListening(false)
            setMicError('Error with speech recognition. Please try again.')
          }
        } catch (error) {
          console.error('Error initializing speech recognition:', error)
          setMicError('Speech recognition is not supported in your browser.')
        }
      } else {
        setMicError('Speech recognition is not supported in your browser.')
      }
    }
  }, [setChatInput])

  const startListening = () => {
    if (!recognitionRef.current) {
      setMicError('Speech recognition is not available.')
      return
    }

    try {
      setMicError(null)
      recognitionRef.current.start()
      setIsListening(true)
    } catch (error) {
      console.error('Error starting speech recognition:', error)
      setMicError('Failed to start speech recognition. Please try again.')
      setIsListening(false)
    }
  }

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
        setIsListening(false)
      } catch (error) {
        console.error('Error stopping speech recognition:', error)
        setMicError('Error stopping speech recognition.')
        setIsListening(false)
      }
    }
  }

  const handleConfirmPackage = async () => {
    if (!pendingPackagePreview) return

    setIsSavingPackage(true)
    const previewData = { ...pendingPackagePreview }
    setPendingPackagePreview(null)

    // Create a message that explicitly asks the AI to use createPackageTool
    const createMessage = `Please create the package using createPackageTool with these details:
- name: "${previewData.name}"
- description: "${previewData.description}"
- category: "${previewData.category}"
- minNights: ${previewData.minNights}
- maxNights: ${previewData.maxNights}
- baseRate: ${previewData.baseRate || 0}
- multiplier: ${previewData.multiplier || 1}
- entitlement: "${previewData.entitlement || 'standard'}"
- postId: "${postId}"
- features: ${JSON.stringify(previewData.features || [])}
${previewData.revenueCatId ? `- revenueCatId: "${previewData.revenueCatId}"` : ''}
${previewData.yocoId ? `- yocoId: "${previewData.yocoId}"` : ''}`

    if (setChatInput && typeof setChatInput === 'function') {
      setChatInput(createMessage)
      // Wait a tick for input to update, then submit
      setTimeout(() => {
        const syntheticEvent = {
          preventDefault: () => {},
        } as React.FormEvent<HTMLFormElement>
        handleSubmit(syntheticEvent)
      }, 100)
    }
  }

  const handleCancelPackage = () => {
    setPendingPackagePreview(null)
  }

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!currentInput.trim() || isLoading) return
    
    handleSubmit(e)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage(e as any)
    }
  }

  // Render messages
  const renderMessage = (message: any, index: number) => {
    // Handle tool calls
    if (message.parts) {
      return (
        <div key={message.id || index} className="space-y-2">
          {message.parts.map((part: any, partIndex: number) => {
            if (part.type === 'text') {
              return (
                <div
                  key={partIndex}
                  className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
                    message.role === 'user'
                      ? 'bg-slate-900 text-white rounded-tr-sm'
                      : 'bg-zinc-100 text-slate-900 rounded-tl-sm'
                  }`}
                >
                  {part.text}
                </div>
              )
            }

            if (part.type === 'tool-previewPackage') {
              switch (part.state) {
                case 'input-available':
                  return (
                    <div key={partIndex} className="text-sm text-slate-500 italic">
                      Preparing package preview...
                    </div>
                  )
                case 'output-available':
                  return (
                    <div key={partIndex} className="my-4">
                      <PackagePreview
                        {...part.output}
                        postId={postId}
                        onConfirm={handleConfirmPackage}
                        onCancel={handleCancelPackage}
                        isSaving={isSavingPackage}
                      />
                    </div>
                  )
                case 'output-error':
                  return (
                    <div key={partIndex} className="text-sm text-red-600">
                      Error: {part.errorText || 'Failed to preview package'}
                    </div>
                  )
                default:
                  return null
              }
            }

            if (part.type === 'tool-createPackage') {
              switch (part.state) {
                case 'input-available':
                  return (
                    <div key={partIndex} className="text-sm text-slate-500 italic">
                      Creating package...
                    </div>
                  )
                case 'output-available':
                  return (
                    <div
                      key={partIndex}
                      className={cn(
                        'text-sm p-3 rounded-lg',
                        part.output.success
                          ? 'bg-green-50 text-green-800 border border-green-200'
                          : 'bg-red-50 text-red-800 border border-red-200'
                      )}
                    >
                      {part.output.message}
                    </div>
                  )
                case 'output-error':
                  return (
                    <div key={partIndex} className="text-sm text-red-600">
                      Error: {part.errorText || 'Failed to create package'}
                    </div>
                  )
                default:
                  return null
              }
            }

            return null
          })}
        </div>
      )
    }

    // Default text message rendering
    return (
      <div
        key={message.id || index}
        className={`rounded-2xl px-4 py-3 text-sm leading-6 ${
          message.role === 'user'
            ? 'bg-slate-900 text-white rounded-tr-sm'
            : 'bg-zinc-100 text-slate-900 rounded-tl-sm'
        }`}
      >
        {message.content || 'No content'}
      </div>
    )
  }

  if (blockType !== 'packageBlock') {
    return null
  }

  // Check if user is host/admin
  if (!isHostOrAdmin) {
    return (
      <div className={cn('p-6 bg-card rounded-lg border border-border', className)}>
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">
            Package creation is only available to hosts and administrators.
          </p>
          <Button asChild>
            <a href="/login">Log In</a>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'w-full max-w-[672px] mx-auto bg-zinc-50 text-slate-950 shadow-sm border border-zinc-200 rounded-lg overflow-hidden flex flex-col h-[800px]',
        className
      )}
    >
      {/* Header */}
      <div className="flex flex-col border-b border-zinc-200 p-6 bg-white z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-teal-50 rounded-md">
              <Bot className="h-5 w-5 text-teal-500" />
            </div>
            <h3 className="text-xl font-semibold tracking-tight text-slate-900">
              AI Package Creator
            </h3>
          </div>
        </div>
        <p className="text-sm text-slate-500 mt-2">
          Describe your package and I'll help you create it
        </p>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-hidden relative bg-white">
        <div className="h-full overflow-y-auto scroll-smooth p-6 space-y-6">
          {/* Initial message */}
          {messages.length === 0 && (
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center">
                <Bot className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="bg-zinc-100 rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-6 text-slate-900">
                  Hi! I'm here to help you create packages for your property. Just describe what kind of package you'd like to create, and I'll generate a preview for you to review before creating it.
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          <AnimatePresence initial={false}>
            {messages.map((message, index) => (
              <motion.div
                key={message.id || index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex gap-4 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    message.role === 'assistant'
                      ? 'bg-teal-50 text-teal-600'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {message.role === 'assistant' ? (
                    <Bot className="h-5 w-5" />
                  ) : (
                    <User className="h-5 w-5" />
                  )}
                </div>

                <div
                  className={`flex flex-col max-w-[85%] ${
                    message.role === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  {renderMessage(message, index)}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Pending package preview (fallback) */}
          {pendingPackagePreview && (
            <div className="my-4">
              <PackagePreview
                {...pendingPackagePreview}
                postId={postId}
                onConfirm={handleConfirmPackage}
                onCancel={handleCancelPackage}
                isSaving={isSavingPackage}
              />
            </div>
          )}

          {/* Loading indicator */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-4"
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center">
                <Bot className="h-5 w-5" />
              </div>
              <div className="bg-zinc-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 1, delay: 0 }}
                  className="w-1.5 h-1.5 bg-slate-400 rounded-full"
                />
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                  className="w-1.5 h-1.5 bg-slate-400 rounded-full"
                />
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                  className="w-1.5 h-1.5 bg-slate-400 rounded-full"
                />
              </div>
            </motion.div>
          )}

          {/* Created packages list */}
          {createdPackages.length > 0 && (
            <div className="mt-6 pt-6 border-t border-zinc-200">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Recently Created Packages</h4>
              <div className="space-y-2">
                {createdPackages.map((pkg, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"
                  >
                    <div>
                      <div className="font-medium text-sm text-green-900">{pkg.name}</div>
                      <div className="text-xs text-green-700">{pkg.category} • {pkg.minNights}-{pkg.maxNights} nights</div>
                    </div>
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-zinc-200 bg-white p-4">
        <form onSubmit={handleSendMessage} className="relative">
          <div className="relative flex items-end gap-2 bg-white border border-zinc-300 rounded-xl px-3 py-3 shadow-sm focus-within:ring-2 focus-within:ring-teal-500/20 focus-within:border-teal-500 transition-all">
            <textarea
              ref={textareaRef}
              value={currentInput}
              onChange={handleCurrentInputChange}
              onKeyDown={handleKeyDown}
              placeholder={
                isListening
                  ? "I'm listening..."
                  : "Describe a package you'd like to create (e.g., 'Weekend getaway package for couples')"
              }
              disabled={isLoading || isListening}
              className="w-full max-h-[120px] min-h-[24px] bg-transparent border-0 p-0 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-0 resize-none leading-6"
              rows={1}
              style={{ height: 'auto', minHeight: '24px' }}
            />
            <div className="flex items-center gap-2 pb-0.5">
              <button
                type="button"
                onClick={isListening ? stopListening : startListening}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md hover:bg-zinc-100 transition-colors"
                disabled={!!micError}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <button
                type="submit"
                disabled={!currentInput.trim() || isLoading || isListening}
                className={`p-1.5 rounded-md transition-all ${
                  currentInput.trim() && !isLoading && !isListening
                    ? 'bg-teal-500 text-white shadow-sm hover:bg-teal-600'
                    : 'bg-zinc-100 text-zinc-300 cursor-not-allowed'
                }`}
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="text-[10px] text-center text-slate-400 mt-2">
            AI can make mistakes. Please double check important info.
          </div>
        </form>
        {micError && <p className="text-sm text-destructive mt-2 text-center">{micError}</p>}
      </div>
    </div>
  )
}

