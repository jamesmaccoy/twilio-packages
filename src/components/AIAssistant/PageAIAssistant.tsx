'use client'

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Sparkles, ArrowUpIcon, Mic, Loader2, Package, Calendar, TrendingUp, Home, Star, FileText, BarChart2, Eye, ExternalLink } from 'lucide-react'
import {
  InputGroup,
  InputGroupTextarea,
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
} from '@/components/ui/input-group'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { useUserContext } from '@/context/UserContext'
import { useSubscription } from '@/hooks/useSubscription'
import { cn } from '@/lib/utils'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { PackagePreview } from '@/components/PackagePreview'

/** Editable template — matches manage chat “new listing” routing; user should edit title/description then click Generate. */
const MANAGE_NEW_LISTING_PROMPT = `Create a new listing for my property.

Title: My guest stay (edit this title)
Description: Brief guest-facing summary — space, location, amenities, and who it is for. (edit this paragraph)

Please use createPostTool with the title and description above, then help me choose packages for this listing.`

interface PageAIAssistantProps {
  context?: {
    type: 'account' | 'manage' | 'bookings'
    data?: any
  }
  placeholder?: string
  className?: string
  showActions?: boolean
  variant?: 'default' | 'primary'
}

export function PageAIAssistant({ context, placeholder, className, showActions = true, variant }: PageAIAssistantProps) {
  const getToolName = (part: any): string => {
    const type = typeof part?.type === 'string' ? part.type : ''
    return type.startsWith('tool-') ? type.replace('tool-', '') : ''
  }

  const normalizePackagePreviewOutput = (toolName: string, output: any) => {
    if (!output) return null

    // `buildPackageDraft` wraps the package payload inside { package: ... }.
    const raw = toolName === 'buildPackageDraft' && output.package ? output.package : output
    if (!raw || typeof raw !== 'object') return null

    const hasRequiredFields =
      typeof raw.name === 'string' &&
      typeof raw.description === 'string' &&
      typeof raw.category === 'string'

    if (!hasRequiredFields) return null

    return {
      name: raw.name,
      description: raw.description,
      category: raw.category,
      entitlement: raw.entitlement || 'standard',
      minNights: raw.minNights ?? 1,
      maxNights: raw.maxNights ?? 1,
      baseRate: raw.baseRate ?? 0,
      multiplier: raw.multiplier ?? 1,
      features: Array.isArray(raw.features) ? raw.features : [],
      postId: raw.postId || context?.data?.postId || '',
      revenueCatId: raw.revenueCatId,
      yocoId: raw.yocoId,
      isPreview: true,
    }
  }

  const { currentUser } = useUserContext()
  const { isSubscribed } = useSubscription()
  const router = useRouter()
  const pathname = usePathname()

  const [input, setInput] = useState('')
  const [manageInput, setManageInput] = useState('') // Manual input state for manage context
  const [isListening, setIsListening] = useState(false)
  const [lastResponse, setLastResponse] = useState<string | null>(null)
  const [pendingPackagePreview, setPendingPackagePreview] = useState<any>(null)
  const [isSavingPackage, setIsSavingPackage] = useState(false)
  const [isApprovingSuggestions, setIsApprovingSuggestions] = useState(false)
  const [createdPackageId, setCreatedPackageId] = useState<string | null>(null)
  const [restoredEstimate, setRestoredEstimate] = useState<any>(null)
  const estimateRestoredRef = useRef(false)
  const postCreatedDispatchedRef = useRef<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<any>(null)

  const userRole = useMemo(() =>
    Array.isArray(currentUser?.role) ? currentUser?.role : [currentUser?.role].filter(Boolean),
    [currentUser]
  )
  const isHostOrAdmin = userRole.includes('host') || userRole.includes('admin')
  const subscriptionPlan = currentUser?.subscriptionStatus?.plan || 'none'

  // Use AI SDK's useChat hook for manage context (generative UI)
  // Always call useChat hook (React hooks must be called unconditionally)
  // Note: For manage context, we allow it even if user isn't host/admin yet (they might be creating packages)
  // The API endpoint will handle authorization
  // Fallback: if pathname includes /manage, treat as manage context
  const isManageContext = context?.type === 'manage' || (typeof pathname === 'string' && pathname.includes('/manage'))

  // Debug: Log context detection
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 PageAIAssistant context detection:', {
      contextType: context?.type,
      pathname,
      isManageContext,
      hasContextData: !!context?.data,
      contextDataKeys: context?.data ? Object.keys(context.data) : [],
    })
  }

  // Debug logging
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 PageAIAssistant context:', {
      contextType: context?.type,
      isHostOrAdmin,
      userRole,
      currentUserRole: currentUser?.role,
      isManageContext,
      hasData: !!context?.data,
      pathname,
      contextData: context?.data,
    })
  }

  const manageTransport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat/manage',
        body: {
          pageData: context?.data || {},
        },
      }),
    [context?.data],
  )

  const chatHook = useChat({
    // AI SDK React v3 uses transport instead of top-level `api`.
    transport: manageTransport,
    onFinish: (result: any) => {
      // onFinish receives an object with a 'message' property, not the message directly
      const message = result?.message || result

      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Chat message finished:', {
          role: message?.role,
          hasParts: !!message?.parts,
          partsCount: message?.parts?.length || 0,
          parts: message?.parts?.map((p: any) => ({
            type: p.type,
            state: p.state,
            hasOutput: !!p.output
          }))
        })
      }

      // Package previews render inline from message tool parts only — do not mirror into
      // pendingPackagePreview or a second card appears below the thread.
      if (process.env.NODE_ENV === 'development' && message?.role === 'assistant' && message.parts) {
        const toolParts = message.parts.filter((p: any) => p.type?.startsWith('tool-'))
        if (toolParts.length > 0) {
          console.log('🔧 Finished message tool parts:', toolParts.map((p: any) => ({
            type: p.type,
            state: p.state,
          })))
        }
      }
    },
    // Only make API calls when in manage context
    onError: (error: any) => {
      console.error('Chat error:', error)
    },
  } as any)

  // Extract values from chat hook with AI SDK v2 API
  // v2 provides: messages, sendMessage, stop, status, error (no more append/handleSubmit)
  const {
    messages = [],
    sendMessage,
    stop: chatStop,
    status,
    error: chatError
  } = (chatHook || {}) as any

  // Debug: Log hook state in development
  if (process.env.NODE_ENV === 'development' && isManageContext) {
    console.log('🔍 useChat hook state:', {
      hasChatHook: !!chatHook,
      hasSendMessage: !!sendMessage,
      sendMessageType: typeof sendMessage,
      status,
      messagesCount: messages.length,
      isManageContext,
    })
  }

  // Derive loading state from status (v2 API uses 'submitted' | 'streaming' | 'ready' | 'error')
  const chatIsLoading = status === 'submitted' || status === 'streaming'

  useEffect(() => {
    if (process.env.NODE_ENV === 'development' && isManageContext && chatHook) {
      console.log('🔍 Chat hook structure:', {
        hasChatHook: !!chatHook,
        chatHookKeys: Object.keys(chatHook || {}),
        hasSendMessage: 'sendMessage' in (chatHook || {}),
        sendMessageType: typeof (chatHook as any)?.sendMessage,
        status: (chatHook as any)?.status,
      })
    }
  }, [chatHook, isManageContext])

  // Monitor messages for package preview and creation tool calls as they stream in
  useEffect(() => {
    if (!isManageContext || !messages.length) return

    // Check the last message for tool calls
    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.role === 'assistant' && lastMessage.parts) {
      // Check for package creation success
      const createPart = lastMessage.parts.find((part: any) =>
        getToolName(part) === 'createPackage' && part.state === 'output-available'
      )
      if (createPart?.output?.success) {
        const packageId = createPart.output.packageId ||
          createPart.output.package?.id ||
          createPart.output.id
        if (packageId && packageId !== createdPackageId) {
          if (process.env.NODE_ENV === 'development') {
            console.log('✅ Package created successfully:', {
              packageId,
              output: createPart.output
            })
          }
          setCreatedPackageId(packageId)
          setPendingPackagePreview(null) // Clear preview after successful creation

          // Trigger package list refresh event for parent components (prefer server postId, e.g. new draft listing)
          const eventPostId =
            createPart.output.postId ||
            createPart.output.package?.postId ||
            context?.data?.postId
          if (eventPostId) {
            window.dispatchEvent(new CustomEvent('packageCreated', {
              detail: { packageId, postId: eventPostId, package: createPart.output.package, createdNewPost: createPart.output.createdNewPost }
            }))
          }
        }
      }

      const createPostPart = lastMessage.parts.find(
        (part: any) => getToolName(part) === 'createPost' && part.state === 'output-available',
      )
      if (createPostPart?.output?.success && createPostPart.output.post?.id) {
        const newPostId = createPostPart.output.post.id as string
        if (postCreatedDispatchedRef.current !== newPostId) {
          postCreatedDispatchedRef.current = newPostId
          window.dispatchEvent(
            new CustomEvent('postCreated', {
              detail: {
                postId: newPostId,
                post: createPostPart.output.post,
              },
            }),
          )
        }
      }
    }
  }, [messages, isManageContext, createdPackageId, context])

  // Input change handler for manage context (manual state management)
  const handleManageInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setManageInput(e.target.value)
  }, [])

  // Input change handler for non-manage context
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
  }, [])

  // Use simple fetch for non-manage contexts
  const [isLoadingSimple, setIsLoadingSimple] = useState(false)

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
        // Use the appropriate input handler
        if (isManageContext) {
          setManageInput(transcript)
        } else {
          setInput(transcript)
        }
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
  }, [])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
    }
  }, [])

  const sendSimpleMessage = async (messageToSend: string) => {
    if (isLoadingSimple) return

    setIsLoadingSimple(true)
    setLastResponse(null)

    try {
      // Build context payload based on page type
      let contextPayload: any = {
        message: messageToSend,
        context: context?.type || 'general',
        tier: subscriptionPlan,
        isHost: isHostOrAdmin,
        path: pathname,
      }

      // Add page-specific context
      if (context?.type === 'account' && context.data) {
        contextPayload.pageData = {
          user: {
            name: currentUser?.name,
            email: currentUser?.email,
            roles: userRole,
            subscription: isSubscribed ? 'Active' : 'None',
          },
          transactions: context.data.transactions || [],
          products: context.data.products || [],
        }
      } else if (context?.type === 'bookings' && context.data) {
        contextPayload.pageData = {
          bookings: context.data.bookings || [],
          insights: context.data.insights || null,
          latestEstimate: context.data.latestEstimate || null,
          restoredEstimate: restoredEstimate || null,
        }
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contextPayload),
      })

      const data = await response.json()
      setLastResponse(data.message || data.response || 'I am here to help you.')
    } catch (error) {
      console.error('AI Assistant Error:', error)
      setLastResponse('Sorry, I encountered an error. Please try again.')
    } finally {
      setIsLoadingSimple(false)
    }
  }

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()

    const currentIsManageContext = context?.type === 'manage' || (typeof pathname === 'string' && pathname.includes('/manage'))

    if (process.env.NODE_ENV === 'development') {
      console.log('📤 handleSendMessage called:', {
        isManageContext,
        currentIsManageContext,
        hasSendMessage: !!sendMessage,
        willUse: currentIsManageContext ? 'sendMessage (/api/chat/manage)' : 'sendSimpleMessage (/api/chat)',
      })
    }

    if (currentIsManageContext) {
      // Use AI SDK v2 sendMessage for manage context
      const messageToSend = manageInput.trim()
      if (!messageToSend) return

      if (process.env.NODE_ENV === 'development') {
        console.log('🚀 Sending message via sendMessage to /api/chat/manage:', {
          message: messageToSend.substring(0, 50),
          hasSendMessage: !!sendMessage,
          status,
        })
      }

      // Clear input immediately before sending
      setManageInput('')

      try {
        if (sendMessage && typeof sendMessage === 'function') {
          await sendMessage({ text: messageToSend })
        } else {
          console.warn('⚠️ sendMessage not available, falling back to /api/chat')
          await sendSimpleMessage(messageToSend)
        }
      } catch (error) {
        console.error('Error sending message:', error)
        setManageInput(messageToSend)
      }
    } else {
      // Use simple fetch for other contexts
      const messageToSend = input.trim()
      if (!messageToSend || isLoadingSimple) return
      setInput('')
      await sendSimpleMessage(messageToSend)
    }
  }

  /** Pass preview from the inline tool UI so confirm works without duplicating state into a second card. */
  const handleConfirmPackage = async (previewFromUi?: any) => {
    const source = previewFromUi ?? pendingPackagePreview
    if (!source || !isManageContext || !sendMessage) return

    setIsSavingPackage(true)
    const previewData = { ...source }
    setPendingPackagePreview(null)

    const createMessage = `Please create the package using createPackageTool with these details:
- name: "${previewData.name}"
- description: "${previewData.description}"
- category: "${previewData.category}"
- minNights: ${previewData.minNights}
- maxNights: ${previewData.maxNights}
- baseRate: ${previewData.baseRate || 0}
- multiplier: ${previewData.multiplier || 1}
- entitlement: "${previewData.entitlement || 'standard'}"
- postId: "${previewData.postId}"
- features: ${JSON.stringify(previewData.features || [])}
${previewData.revenueCatId ? `- revenueCatId: "${previewData.revenueCatId}"` : ''}
${previewData.yocoId ? `- yocoId: "${previewData.yocoId}"` : ''}`

    try {
      await sendMessage({ text: createMessage })
    } catch (error) {
      console.error('Error confirming package:', error)
      setPendingPackagePreview(previewData)
    } finally {
      setIsSavingPackage(false)
    }
  }

  const buildCreatePackageMessageFromSuggestion = useCallback(
    (postId: string, suggestion: any) => {
      const name = String(suggestion?.suggestedName || suggestion?.name || '📦 Package').trim()
      const description = String(suggestion?.description || '').trim() || `Package created from catalog suggestion: ${name}`
      const details = suggestion?.details || {}

      const category = String(details?.category || suggestion?.category || 'standard') as any
      const minNightsRaw = Number(details?.minNights ?? suggestion?.minNights ?? 1)
      const maxNightsRaw = Number(details?.maxNights ?? suggestion?.maxNights ?? minNightsRaw ?? 1)
      const minNights = Number.isFinite(minNightsRaw) ? Math.max(0.5, minNightsRaw) : 1
      const maxNights = Number.isFinite(maxNightsRaw) ? Math.max(0.5, maxNightsRaw) : minNights

      const multiplierRaw = Number(details?.multiplier ?? suggestion?.multiplier ?? 1)
      const multiplier = Number.isFinite(multiplierRaw) ? multiplierRaw : 1

      const baseRateRaw = suggestion?.baseRate
      const baseRate = typeof baseRateRaw === 'number' && Number.isFinite(baseRateRaw) ? baseRateRaw : 0

      const customerTierRequired = String(details?.customerTierRequired || 'standard').toLowerCase()
      const entitlement = customerTierRequired.includes('pro') ? 'pro' : 'standard'

      const features = Array.isArray(suggestion?.features)
        ? suggestion.features
        : typeof details?.features === 'string'
          ? String(details.features)
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
              .slice(0, 6)
          : []

      const revenueCatId = String(suggestion?.revenueCatId || '').trim()

      return `Please create the package using createPackageTool with these details:
- name: "${name}"
- description: "${description}"
- category: "${category}"
- minNights: ${minNights}
- maxNights: ${maxNights}
- baseRate: ${baseRate}
- multiplier: ${multiplier}
- entitlement: "${entitlement}"
- postId: "${postId}"
- features: ${JSON.stringify(features)}
${revenueCatId ? `- yocoId: "${revenueCatId}"\n- revenueCatId: "${revenueCatId}"` : ''}`
    },
    [],
  )

  const handleApproveCatalogSuggestions = useCallback(
    async (postId: string, recs: any[]) => {
      if (!isManageContext || !sendMessage) return
      if (!postId || !Array.isArray(recs) || recs.length === 0) return

      if (isApprovingSuggestions) return
      setIsApprovingSuggestions(true)
      try {
        for (const rec of recs) {
          const msg = buildCreatePackageMessageFromSuggestion(postId, rec)
          await sendMessage({ text: msg })
        }
      } catch (e) {
        console.error('Failed approving catalog suggestions:', e)
      } finally {
        setIsApprovingSuggestions(false)
      }
    },
    [isApprovingSuggestions, isManageContext, sendMessage, buildCreatePackageMessageFromSuggestion],
  )

  const handleCancelPackage = () => {
    setPendingPackagePreview(null)
  }

  // Test MCP endpoint
  const [testingMCP, setTestingMCP] = useState(false)
  const [mcpTestResult, setMcpTestResult] = useState<string | null>(null)

  const handleTestMCP = async () => {
    if (testingMCP) return

    setTestingMCP(true)
    setMcpTestResult(null)

    try {
      // First verify we're authenticated
      const meResponse = await fetch('/api/users/me')
      if (!meResponse.ok) {
        throw new Error('Not authenticated. Please log in.')
      }

      // Try to get an API key for MCP (MCP endpoint requires API key auth)
      let apiKey: string | null = null
      let apiKeyError: string | null = null

      try {
        const apiKeysResponse = await fetch(`/api/payload-mcp-api-keys?where[user][equals]=${currentUser?.id}`)

        if (!apiKeysResponse.ok) {
          apiKeyError = `Failed to fetch API keys (HTTP ${apiKeysResponse.status})`
        } else {
          const apiKeysData = await apiKeysResponse.json()
          console.log('API Keys Response:', apiKeysData) // Debug log

          if (apiKeysData.docs && apiKeysData.docs.length > 0) {
            // The API key value should be in the 'apiKey' field
            const firstKey = apiKeysData.docs[0]
            apiKey = firstKey.apiKey || firstKey.key || null

            if (!apiKey) {
              apiKeyError = 'API key found but value is empty. Please regenerate the API key in Payload Admin.'
            }
          } else {
            apiKeyError = 'No API keys found for your account.'
          }
        }
      } catch (e) {
        console.warn('Could not fetch API keys:', e)
        apiKeyError = `Error fetching API keys: ${e instanceof Error ? e.message : 'Unknown error'}`
      }

      // If no API key, provide helpful message with link
      if (!apiKey) {
        const adminUrl = '/admin/collections/payload-mcp-api-keys/create'
        throw new Error(
          `${apiKeyError || 'No API key available'}\n\n💡 To use MCP:\n` +
          `1. Go to Payload Admin → Collections → API Keys (Payload MCP API Keys)\n` +
          `   Direct link: ${adminUrl}\n` +
          `2. Create a new API key\n` +
          `3. Enable all package permissions (find, create, update, delete)\n` +
          `4. Copy the key value and use it in your MCP client configuration\n\n` +
          `Note: The generative UI package creation works without MCP API keys!`
        )
      }

      // Test MCP endpoint by calling the list tools method
      // MCP uses JSON-RPC 2.0 protocol and requires API key authentication with Bearer token
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream', // MCP requires both (returns SSE format)
        'Authorization': `Bearer ${apiKey}`, // MCP endpoint expects "Bearer <token>" format
      }

      const response = await fetch('/api/mcp', {
        method: 'POST',
        headers,
        credentials: 'include', // Include cookies as fallback
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
          params: {},
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`
        try {
          const errorData = JSON.parse(errorText)
          errorMessage = errorData.errors?.[0]?.message || errorData.error?.message || errorMessage
        } catch {
          errorMessage = errorText || errorMessage
        }

        if (response.status === 401) {
          errorMessage += '\n\n💡 The API key may be invalid or expired. Try creating a new one in Payload Admin → Collections → API Keys (Payload MCP API Keys)'
        }

        throw new Error(errorMessage)
      }

      // Parse SSE (Server-Sent Events) response
      const responseText = await response.text()

      // SSE format: "event: message\ndata: {...}\n\n"
      // Extract JSON from SSE data field
      let data: any
      if (responseText.startsWith('event:')) {
        // Parse SSE format
        const lines = responseText.split('\n')
        const dataLine = lines.find(line => line.startsWith('data:'))
        if (dataLine) {
          const jsonStr = dataLine.substring(5).trim() // Remove "data:" prefix
          data = JSON.parse(jsonStr)
        } else {
          throw new Error('Invalid SSE response format')
        }
      } else {
        // Plain JSON response
        data = JSON.parse(responseText)
      }

      if (data.error) {
        setMcpTestResult(`Error: ${data.error.message || JSON.stringify(data.error)}`)
      } else {
        const tools = data.result?.tools || []
        const packageTools = tools.filter((t: any) =>
          t.name?.toLowerCase().includes('package') ||
          t.name?.toLowerCase().includes('create') ||
          t.name?.toLowerCase().includes('update') ||
          t.name?.toLowerCase().includes('delete') ||
          t.name?.toLowerCase().includes('find')
        )
        setMcpTestResult(
          `✅ MCP endpoint is working! Found ${tools.length} tool(s), ${packageTools.length} package-related tool(s) available.`
        )
      }
    } catch (error: any) {
      setMcpTestResult(`❌ MCP test failed: ${error.message || 'Unknown error'}`)
    } finally {
      setTestingMCP(false)
    }
  }

  const applyManageQuickPrompt = useCallback((text: string) => {
    setManageInput(text)
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      try {
        const len = text.length
        textareaRef.current?.setSelectionRange(0, Math.min(80, len))
      } catch {
        /* selection may fail on some browsers */
      }
    })
  }, [])

  const handleActionClick = async (action: string) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔘 Action button clicked:', { action, isManageContext, hasSendMessage: !!sendMessage, status })
    }

    if (isManageContext) {
      if (!sendMessage) {
        console.error('sendMessage is not available')
        return
      }

      try {
        await sendMessage({ text: action })
      } catch (error) {
        console.error('Error sending action:', error)
      }
    } else {
      await sendSimpleMessage(action)
    }
  }

  /** Sends a canned new-listing message immediately (still editable flow preferred via applyManageQuickPrompt). */
  const handleSendNewListingTemplate = async () => {
    if (!isManageContext || !sendMessage) return
    try {
      await sendMessage({ text: MANAGE_NEW_LISTING_PROMPT })
    } catch (error) {
      console.error('Error sending new listing template:', error)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage(e as any)
    }
  }

  // Sync input state for manage context (manual state management)
  // The new useChat API doesn't provide input/handleInputChange, so we manage it manually
  const currentInput = isManageContext ? manageInput : input
  const handleCurrentInputChange = isManageContext
    ? handleManageInputChange
    : handleInputChange

  // Only disable input when actually loading
  const currentIsLoading = isManageContext ? chatIsLoading : isLoadingSimple

  // Debug: Log loading state and messages in development (after variables are declared)
  if (process.env.NODE_ENV === 'development' && isManageContext) {
    console.log('🔍 PageAIAssistant state:', {
      chatIsLoading,
      isManageContext,
      hasChatHook: !!chatHook,
      hasSendMessage: !!sendMessage,
      messagesCount: messages.length,
      currentInput: currentInput.substring(0, 50),
      manageInput: manageInput.substring(0, 50),
    })

    if (messages.length > 0) {
      console.log('📨 Current messages:', messages.map((m: any) => ({
        id: m.id,
        role: m.role,
        hasParts: !!m.parts,
        partsCount: m.parts?.length || 0,
      })))
    }
  }

  const defaultPlaceholder = useMemo(() => {
    if (context?.type === 'account') {
      return 'Ask about bookings, payments, features...'
    } else if (context?.type === 'manage') {
      return 'Ask about packages, statements, or management...'
    } else if (context?.type === 'bookings') {
      return 'Ask about your bookings, estimates, or recommendations...'
    }
    return 'Ask, Search or Chat...'
  }, [context])

  const getActionButtons = () => {
    if (!showActions || !context) return null

    if (context.type === 'bookings') {
      const insights = context.data?.insights
      return (
        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleActionClick('Show me available packages')}
            className="text-xs"
          >
            <Package className="h-3 w-3 mr-1.5" />
            Show Packages
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleActionClick('What are my upcoming bookings?')}
            className="text-xs"
          >
            <Calendar className="h-3 w-3 mr-1.5" />
            My Bookings
          </Button>
          {insights?.estimateLink && !restoredEstimate && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleRestoreEstimate(insights.estimateLink.estimateId)}
              className="text-xs"
            >
              <Sparkles className="h-3 w-3 mr-1.5" />
              Restore Estimate
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleActionClick('Give me recommendations for my next booking')}
            className="text-xs"
          >
            <TrendingUp className="h-3 w-3 mr-1.5" />
            Recommendations
          </Button>
        </div>
      )
    } else if (context.type === 'account') {
      return (
        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleActionClick('Show my transaction history')}
            className="text-xs"
          >
            <Calendar className="h-3 w-3 mr-1.5" />
            Transactions
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleActionClick('What subscription features do I have?')}
            className="text-xs"
          >
            <Package className="h-3 w-3 mr-1.5" />
            My Features
          </Button>
        </div>
      )
    } else if (context.type === 'manage') {
      return (
        <div className="flex flex-wrap gap-2 mb-4">
          <Button
            variant="default"
            size="sm"
            className="text-xs"
            disabled={chatIsLoading}
            onClick={() => applyManageQuickPrompt(MANAGE_NEW_LISTING_PROMPT)}
          >
            <Home className="h-3 w-3 mr-1.5" />
            New property (edit)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleActionClick('Show my packages')}
            className="text-xs"
          >
            <Package className="h-3 w-3 mr-1.5" />
            My Packages
          </Button>
        </div>
      )
    }

    return null
  }

  // Render messages for manage context (generative UI)
  const renderManageMessages = () => {
    if (!isManageContext) return null

    // Debug: log messages to help troubleshoot
    if (process.env.NODE_ENV === 'development' && messages.length > 0) {
      console.log('📨 Rendering manage messages:', {
        messageCount: messages.length,
        messages: messages.map((m: any) => ({ id: m.id, role: m.role, parts: m.parts?.length || 0, content: m.content }))
      })
    }

    return (
      <div className="space-y-4">
        {messages.length === 0 && (
          <div className="text-sm text-slate-500 text-center py-4">
            Start a conversation to see messages here...
          </div>
        )}
        {messages.map((message: any) => (
          <div key={message.id} className={cn("flex gap-4", message.role === 'user' ? 'flex-row-reverse' : '')}>
            <div className="flex-shrink-0">
              <div className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center shadow-sm",
                message.role === 'user' ? "bg-slate-100 text-slate-600" : "bg-teal-50 text-teal-600"
              )}>
                {message.role === 'user' ? (
                  <span className="text-xs font-semibold">You</span>
                ) : (
                  <Sparkles className="h-5 w-5" />
                )}
              </div>
            </div>
            <div className="flex-1 space-y-2">
              {/* Render message parts (Generative UI pattern) */}
              {message.parts && message.parts.length > 0 ? (
                message.parts.map((part: any, index: number) => {
                  if (part.type === 'text') {
                    const textContent = part.text || part.content || ''
                    return (
                      <div
                        key={index}
                        className={cn(
                          "rounded-2xl px-4 py-3 text-sm leading-6 whitespace-pre-wrap",
                          message.role === 'user'
                            ? "bg-slate-900 text-white rounded-tr-sm"
                            : "bg-zinc-100 text-slate-900 rounded-tl-sm"
                        )}
                      >
                        {textContent || 'No content'}
                      </div>
                    )
                  }

                  if (part.type?.startsWith('tool-')) {
                    const toolName = getToolName(part)
                    if (['previewPackage', 'suggestPackage', 'buildPackageDraft'].includes(toolName)) {
                      const normalizedOutput = normalizePackagePreviewOutput(toolName, part.output)
                      switch (part.state) {
                        case 'input-available':
                          return (
                            <div key={index} className="text-sm text-slate-500 italic">
                              Preparing package preview...
                            </div>
                          )
                        case 'output-available':
                          if (!normalizedOutput) return null
                          return (
                            <div key={index} className="my-6 border-t border-slate-200 pt-6">
                              <div className="max-w-2xl mx-auto">
                                <PackagePreview
                                  {...normalizedOutput}
                                  onConfirm={() => void handleConfirmPackage(normalizedOutput)}
                                  onCancel={handleCancelPackage}
                                  isSaving={isSavingPackage}
                                />
                              </div>
                            </div>
                          )
                        case 'output-error':
                          return (
                            <div key={index} className="text-sm text-red-600">
                              Error: {part.errorText || 'Failed to preview package'}
                            </div>
                          )
                        default:
                          return null
                      }
                    }

                    if (toolName === 'suggestCatalogPackages') {
                      switch (part.state) {
                        case 'input-available':
                          return (
                            <div key={index} className="text-sm text-slate-500 italic">
                              Suggesting catalog packages for this listing…
                            </div>
                          )
                        case 'output-available': {
                          const recs = Array.isArray(part.output?.recommendations)
                            ? part.output.recommendations
                            : []
                          const postIdForSuggestions =
                            String(part.output?.postId || context?.data?.postId || '').trim()
                          return (
                            <div
                              key={index}
                              className="my-4 rounded-lg border border-teal-200 bg-teal-50/60 p-4 text-sm"
                            >
                              <p className="font-medium text-teal-900 mb-3">
                                {part.output?.message || 'Catalog package ideas'}
                              </p>
                              {recs.length > 0 && postIdForSuggestions && (
                                <div className="flex justify-end mb-3">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={chatIsLoading || isApprovingSuggestions}
                                    onClick={() => void handleApproveCatalogSuggestions(postIdForSuggestions, recs)}
                                    className="bg-white border-teal-200 text-xs"
                                    title="Create all suggested packages for this listing"
                                  >
                                    {isApprovingSuggestions ? (
                                      <>
                                        <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                                        Approving…
                                      </>
                                    ) : (
                                      <>
                                        <Package className="h-3 w-3 mr-1.5" />
                                        Approve all
                                      </>
                                    )}
                                  </Button>
                                </div>
                              )}
                              {recs.length === 0 ? (
                                <p className="text-xs text-slate-600">No recommendations returned.</p>
                              ) : (
                                <ul className="space-y-3">
                                  {recs.map((r: any, i: number) => (
                                    <li key={i} className="rounded-md border bg-white p-3 shadow-sm">
                                      <div className="font-semibold text-slate-900">{r.suggestedName}</div>
                                      <div className="text-xs text-slate-500 font-mono mt-0.5">
                                        {r.revenueCatId}
                                      </div>
                                      <p className="text-xs text-slate-600 mt-2">{r.description}</p>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )
                        }
                        case 'output-error':
                          return (
                            <div key={index} className="text-sm text-red-600">
                              Error: {part.errorText || 'Failed to suggest packages'}
                            </div>
                          )
                        default:
                          return null
                      }
                    }
                  }

                  if (part.type === 'tool-createPost') {
                    switch (part.state) {
                      case 'input-available':
                        return (
                          <div key={index} className="text-sm text-slate-500 italic">
                            Creating property...
                          </div>
                        )
                      case 'output-available': {
                        const recs = Array.isArray(part.output?.recommendations)
                          ? part.output.recommendations
                          : []
                        return (
                          <div key={index} className="space-y-3">
                            <div
                              className={cn(
                                'text-sm p-3 rounded-lg',
                                part.output.success
                                  ? 'bg-green-50 text-green-800 border border-green-200'
                                  : 'bg-red-50 text-red-800 border border-red-200',
                              )}
                            >
                              <div className="font-medium mb-1 whitespace-pre-wrap">
                                {part.output.message}
                              </div>
                              {part.output.post && (
                                <div className="text-xs mt-2 text-slate-600">
                                  Property: {part.output.post.title} (ID: {part.output.post.id})
                                </div>
                              )}
                            </div>
                            {part.output.success && recs.length > 0 && (
                              <div className="rounded-lg border border-teal-200 bg-teal-50/60 p-4 text-sm">
                                <div className="flex items-start justify-between gap-3 mb-3">
                                  <p className="font-medium text-teal-900">Starter package ideas</p>
                                  {part.output.post?.id && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      disabled={chatIsLoading || isApprovingSuggestions}
                                      onClick={() => void handleApproveCatalogSuggestions(String(part.output.post.id), recs)}
                                      className="bg-white border-teal-200 text-xs"
                                      title="Create all suggested packages for this listing"
                                    >
                                      {isApprovingSuggestions ? (
                                        <>
                                          <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                                          Approving…
                                        </>
                                      ) : (
                                        <>
                                          <Package className="h-3 w-3 mr-1.5" />
                                          Approve all
                                        </>
                                      )}
                                    </Button>
                                  )}
                                </div>
                                <ul className="space-y-3">
                                  {recs.map((r: any, i: number) => (
                                    <li key={i} className="rounded-md border bg-white p-3 shadow-sm">
                                      <div className="font-semibold text-slate-900">{r.suggestedName}</div>
                                      <div className="text-xs text-slate-500 font-mono mt-0.5">
                                        {r.revenueCatId}
                                      </div>
                                      <p className="text-xs text-slate-600 mt-2">{r.description}</p>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )
                      }
                      case 'output-error':
                        return (
                          <div key={index} className="text-sm text-red-600">
                            Error: {part.errorText || 'Failed to create property'}
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
                          <div key={index} className="text-sm text-slate-500 italic">
                            Creating package...
                          </div>
                        )
                      case 'output-available':
                        const packageId = part.output.packageId || part.output.package?.id
                        const postId =
                          part.output.postId || part.output.package?.postId || context?.data?.postId
                        return (
                          <div key={index} className={cn(
                            "text-sm p-4 rounded-lg space-y-3",
                            part.output.success
                              ? "bg-green-50 text-green-800 border border-green-200"
                              : "bg-red-50 text-red-800 border border-red-200"
                          )}>
                            <div className="font-medium">{part.output.message}</div>
                            {part.output.success && packageId && (
                              <div className="flex flex-wrap gap-2 pt-2 border-t border-green-200">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    window.open(`/api/packages/${packageId}?depth=2`, '_blank')
                                  }}
                                  className="bg-white hover:bg-green-50 border-green-300 text-xs"
                                >
                                  <Eye className="h-3 w-3 mr-1" />
                                  View API
                                </Button>
                                {postId && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      window.open(`/manage/packages/${postId}`, '_blank')
                                    }}
                                    className="bg-white hover:bg-green-50 border-green-300 text-xs"
                                  >
                                    <Package className="h-3 w-3 mr-1" />
                                    Manage Packages
                                  </Button>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setCreatedPackageId(null)
                                    setPendingPackagePreview(null)
                                  }}
                                  className="bg-white hover:bg-green-50 border-green-300 text-xs"
                                >
                                  Create Another
                                </Button>
                              </div>
                            )}
                          </div>
                        )
                      case 'output-error':
                        return (
                          <div key={index} className="text-sm text-red-600">
                            Error: {part.errorText || 'Failed to create package'}
                          </div>
                        )
                      default:
                        return null
                    }
                  }

                  if (part.type === 'tool-findPackages') {
                    switch (part.state) {
                      case 'input-available':
                        return (
                          <div key={index} className="text-sm text-slate-500 italic">
                            Finding packages...
                          </div>
                        )
                      case 'output-available':
                        const packages = part.output.packages || []
                        return (
                          <div key={index} className="text-sm">
                            <div className="mb-2 font-medium">{part.output.message}</div>
                            {packages.length > 0 && (
                              <div className="mt-2 space-y-2">
                                {packages.map((pkg: any, idx: number) => (
                                  <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <div className="font-medium">{pkg.name}</div>
                                    <div className="text-xs text-slate-500 mt-1">
                                      {pkg.category} • {pkg.minNights}-{pkg.maxNights} nights • {pkg.isEnabled ? 'Enabled' : 'Disabled'}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      case 'output-error':
                        return (
                          <div key={index} className="text-sm text-red-600">
                            Error: {part.errorText || 'Failed to find packages'}
                          </div>
                        )
                      default:
                        return null
                    }
                  }

                  if (part.type === 'tool-updatePackage') {
                    switch (part.state) {
                      case 'input-available':
                        return (
                          <div key={index} className="text-sm text-slate-500 italic">
                            Updating package...
                          </div>
                        )
                      case 'output-available':
                        return (
                          <div key={index} className={cn(
                            "text-sm p-3 rounded-lg",
                            part.output.success
                              ? "bg-green-50 text-green-800 border border-green-200"
                              : "bg-red-50 text-red-800 border border-red-200"
                          )}>
                            {part.output.message}
                          </div>
                        )
                      case 'output-error':
                        return (
                          <div key={index} className="text-sm text-red-600">
                            Error: {part.errorText || 'Failed to update package'}
                          </div>
                        )
                      default:
                        return null
                    }
                  }

                  if (part.type === 'tool-deletePackage') {
                    switch (part.state) {
                      case 'input-available':
                        return (
                          <div key={index} className="text-sm text-slate-500 italic">
                            Deleting package...
                          </div>
                        )
                      case 'output-available':
                        return (
                          <div key={index} className={cn(
                            "text-sm p-3 rounded-lg",
                            part.output.success
                              ? "bg-green-50 text-green-800 border border-green-200"
                              : "bg-red-50 text-red-800 border border-red-200"
                          )}>
                            {part.output.message}
                          </div>
                        )
                      case 'output-error':
                        return (
                          <div key={index} className="text-sm text-red-600">
                            Error: {part.errorText || 'Failed to delete package'}
                          </div>
                        )
                      default:
                        return null
                    }
                  }

                  return null
                })
              ) : (
                // Fallback: render message content if no parts (backward compatibility)
                <div
                  className={cn(
                    "rounded-2xl px-4 py-3 text-sm leading-6 whitespace-pre-wrap",
                    message.role === 'user'
                      ? "bg-slate-900 text-white rounded-tr-sm"
                      : "bg-zinc-100 text-slate-900 rounded-tl-sm"
                  )}
                >
                  {message.content || message.text || 'No content'}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Primary variant for Magic Patterns design
  const isBookingsContext = context?.type === 'bookings'

  // Handle estimate restoration for bookings context
  // Auto-restore if there's a latest estimate (either from URL param or latest estimate)
  useEffect(() => {
    if (isBookingsContext && context?.data?.latestEstimate && !estimateRestoredRef.current) {
      // Check if we should restore (either explicit flag or just having a latest estimate)
      const shouldRestore = context?.data?.restoreEstimate ||
        (context?.data?.latestEstimate && !lastResponse) // Auto-restore if no response yet

      if (shouldRestore) {
        const estimate = context.data.latestEstimate
        estimateRestoredRef.current = true
        setRestoredEstimate(estimate)

        // Create restoration message
        const post = typeof estimate.post === 'object' ? estimate.post : null
        const postTitle = post?.title || 'your property'
        const fromDate = estimate.fromDate ? new Date(estimate.fromDate) : null
        const toDate = estimate.toDate ? new Date(estimate.toDate) : null

        let restorationMessage = `Welcome back! I've restored your estimate for ${postTitle}.`

        if (fromDate && toDate) {
          const duration = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24))
          const formatDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          restorationMessage += ` Your selected dates are ${formatDate(fromDate)} to ${formatDate(toDate)} (${duration} ${duration === 1 ? 'night' : 'nights'}).`
        }

        if (estimate.total) {
          restorationMessage += ` Total: R${estimate.total.toFixed(0)}.`
        }

        restorationMessage += ` You can continue your booking journey here or ask me anything about your estimate.`

        setLastResponse(restorationMessage)
      }
    }
  }, [isBookingsContext, context?.data?.latestEstimate, context?.data?.restoreEstimate, lastResponse])

  // Function to restore estimate manually
  const handleRestoreEstimate = useCallback(async (estimateId: string) => {
    try {
      const response = await fetch(`/api/estimates/${estimateId}`)
      if (response.ok) {
        const estimate = await response.json()
        setRestoredEstimate(estimate)
        estimateRestoredRef.current = true

        // Create restoration message
        const post = typeof estimate.post === 'object' ? estimate.post : null
        const postTitle = post?.title || 'your property'
        const fromDate = estimate.fromDate ? new Date(estimate.fromDate) : null
        const toDate = estimate.toDate ? new Date(estimate.toDate) : null

        let restorationMessage = `I've restored your estimate for ${postTitle}.`

        if (fromDate && toDate) {
          const duration = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24))
          const formatDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          restorationMessage += ` Your selected dates are ${formatDate(fromDate)} to ${formatDate(toDate)} (${duration} ${duration === 1 ? 'night' : 'nights'}).`
        }

        if (estimate.total) {
          restorationMessage += ` Total: R${estimate.total.toFixed(0)}.`
        }

        restorationMessage += ` You can continue your booking journey here or ask me anything about your estimate.`

        setLastResponse(restorationMessage)

        // Update URL to include restoreEstimate parameter
        const url = new URL(window.location.href)
        url.searchParams.set('restoreEstimate', estimateId)
        window.history.replaceState({}, '', url.toString())
      }
    } catch (error) {
      console.error('Error restoring estimate:', error)
    }
  }, [])
  if (variant === 'primary' && (isManageContext || isBookingsContext)) {
    return (
      <div className={cn("w-full", className)}>
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4 bg-[#f0fdfa] shadow-[0_0_0_0_#fff,0_0_0_1px_#ccfbf1,0_0_0_0_transparent] rounded-full px-2 py-2">
            <Sparkles className="mr-2 h-5 w-5 text-[#0d9488]" />
            <span className="text-sm leading-5 font-medium text-[#134e4a]">
              AI Assistant
            </span>
          </div>
          <h1 className="text-2xl sm:text-[30px] font-bold leading-tight sm:leading-9 tracking-[-0.75px] text-[#0f172a] mb-3">
            {isBookingsContext
              ? "How can I help with your bookings today?"
              : "How can I help manage your properties today?"}
          </h1>
          <p className="text-base sm:text-lg leading-6 sm:leading-7 text-[#64748b] m-0">
            {isBookingsContext
              ? "Ask about your upcoming trips, view booking details, or get recommendations."
              : "Generate packages, analyze pricing, or get insights instantly."}
          </p>
          {isManageContext && (
            <div className="flex flex-wrap justify-center gap-2 mt-6">
              <Button
                type="button"
                variant="default"
                size="sm"
                className="rounded-full bg-[#0f172a] hover:bg-[#1e293b]"
                onClick={() => applyManageQuickPrompt(MANAGE_NEW_LISTING_PROMPT)}
              >
                <Home className="h-3.5 w-3.5 mr-1.5" />
                New plek
              </Button>
            </div>
          )}
        </div>

        {/* Messages Area */}
        <div>
          {isManageContext && chatError && (
            <div
              className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              role="alert"
            >
              {chatError.message || 'Something went wrong. Try again.'}
            </div>
          )}
          {/* Render manage context messages with generative UI */}
          {isManageContext && renderManageMessages()}

          {/* Render simple response for bookings context */}
          {isBookingsContext && lastResponse && (
            <div className="rounded-lg border border-slate-200 bg-white p-6 mb-6 shadow-sm">
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-teal-50 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-teal-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-900 leading-relaxed whitespace-pre-line">
                    {lastResponse}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Empty state placeholder */}
          {isManageContext && (!messages || messages.length === 0) && (
            <div className="py-4 text-center text-sm leading-5 text-[#64748b]">
              Start a conversation to see messages here...
            </div>
          )}

          {/* Empty state for bookings context */}
          {isBookingsContext && !lastResponse && !restoredEstimate && (
            <div className="py-4 text-center text-sm leading-5 text-[#64748b]">
              Start a conversation to see messages here...
            </div>
          )}

          {/* Show restored estimate details */}
          {isBookingsContext && restoredEstimate && (
            <div className="mb-6 rounded-lg border border-teal-200 bg-teal-50/30 p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 rounded-full bg-teal-100 flex items-center justify-center">
                    <Calendar className="h-4 w-4 text-teal-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-slate-900 mb-1">Restored Estimate</h4>
                  {restoredEstimate.fromDate && restoredEstimate.toDate && (
                    <p className="text-xs text-slate-600 mb-2">
                      {new Date(restoredEstimate.fromDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - {new Date(restoredEstimate.toDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  )}
                  {restoredEstimate.total && (
                    <p className="text-sm font-bold text-teal-700">
                      R{Number(restoredEstimate.total).toFixed(0)}
                    </p>
                  )}
                  {typeof restoredEstimate.post === 'object' && restoredEstimate.post?.slug && (
                    <a
                      href={`/posts/${restoredEstimate.post.slug}?restoreEstimate=${restoredEstimate.id}`}
                      className="text-xs text-teal-600 hover:text-teal-700 underline mt-2 inline-block"
                    >
                      View on property page →
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Success message after package creation */}
        {createdPackageId && (
          <div className="my-6 border-t border-slate-200 pt-6">
            <div className="max-w-2xl mx-auto">
              <div className="p-6 border-green-200 bg-green-50 rounded-lg">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-green-100 rounded-full">
                      <Package className="h-5 w-5 text-green-700" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-green-900 mb-1">
                        Package Created Successfully!
                      </h3>
                      <p className="text-sm text-green-700">
                        Your package has been created and is ready to use. It will appear in your package list.
                      </p>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-green-200">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        window.open(`/api/packages/${createdPackageId}?depth=2`, '_blank')
                      }}
                      className="bg-white hover:bg-green-50 border-green-300"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Package API
                    </Button>
                    {context?.data?.postId && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          window.open(`/manage/packages/${context.data.postId}`, '_blank')
                        }}
                        className="bg-white hover:bg-green-50 border-green-300"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Manage Packages
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCreatedPackageId(null)
                        setPendingPackagePreview(null)
                      }}
                      className="bg-white hover:bg-green-50 border-green-300"
                    >
                      <Package className="h-4 w-4 mr-2" />
                      Create Another
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MCP Test Result */}
        {mcpTestResult && (
          <div className={cn(
            "rounded-lg border p-3 text-sm mb-6",
            mcpTestResult.includes('✅')
              ? "bg-green-50 text-green-800 border-green-200"
              : "bg-red-50 text-red-800 border-red-200"
          )}>
            <div className="whitespace-pre-line">{mcpTestResult}</div>
            {mcpTestResult.includes('No API keys found') && (
              <div className="mt-3 pt-3 border-t border-red-200">
                <a
                  href="/admin/collections/payload-mcp-api-keys/create"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-md transition-colors"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Create API Key in Admin Panel
                </a>
              </div>
            )}
          </div>
        )}

        {/* Input Area */}
        <div className="mb-6 bg-white shadow-[0_0_0_0_transparent,0_0_0_0_transparent,0_1px_2px_0_rgba(0,0,0,0.05)] transition-shadow duration-300 border border-[#e2e8f0] rounded-2xl p-2">
          <form onSubmit={handleSendMessage}>
            <textarea
              ref={textareaRef}
              value={currentInput}
              onChange={handleCurrentInputChange}
              onKeyDown={handleKeyDown}
              placeholder={placeholder || (isBookingsContext
                ? "Ask about your bookings, upcoming trips, or get recommendations..."
                : "Describe a new package for your property or ask about recent bookings...")}
              className="w-full min-h-[120px] resize-none bg-transparent outline-none border-0 p-4 text-base font-normal leading-6 text-[#0f172a] placeholder:text-[#94a3b8]"
              disabled={currentIsLoading}
            />
            <div className="flex items-center justify-between px-2 pb-2">
              <div className="flex items-center gap-2">
                {isManageContext && (
                  <>
                    <button
                      type="button"
                      onClick={handleTestMCP}
                      disabled={testingMCP}
                      className="text-[#94a3b8] bg-transparent cursor-pointer transition-colors duration-150 border-0 rounded-full p-2 hover:text-[#64748b]"
                      title="Test MCP endpoint"
                    >
                      {testingMCP ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Sparkles className="h-5 w-5" />
                      )}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={isListening ? stopListening : startListening}
                  className={cn(
                    "text-[#94a3b8] bg-transparent cursor-pointer transition-colors duration-150 border-0 rounded-full p-2 hover:text-[#64748b]",
                    isListening && "text-red-500 hover:text-red-600"
                  )}
                >
                  <Mic className="h-5 w-5" />
                </button>
              </div>
              <button
                type="submit"
                disabled={!currentInput.trim() || currentIsLoading}
                className="text-sm font-medium leading-5 text-white bg-[#0f172a] cursor-pointer flex items-center gap-2 transition-colors duration-150 border-0 rounded-full px-4 py-2 hover:bg-[#1e293b] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {currentIsLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <span>Generate</span>
                    <ArrowUpIcon className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Quick Action Buttons */}
        {isManageContext ? (
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => applyManageQuickPrompt(MANAGE_NEW_LISTING_PROMPT)}
              disabled={chatIsLoading}
              className="text-sm font-medium leading-5 text-white bg-[#0f172a] cursor-pointer flex items-center gap-2 shadow-[0_0_0_0_transparent,0_0_0_0_transparent,0_1px_2px_0_rgba(0,0,0,0.05)] transition-all duration-200 border border-[#0f172a] rounded-full px-4 py-2 hover:bg-[#1e293b] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Home className="h-4 w-4" />
              Draft a new plek
            </button>
            <button
              type="button"
              onClick={() => {
                const pid = String(context?.data?.postId || '').trim()
                if (!pid) {
                  handleActionClick('Create a new package for my property')
                  return
                }
                handleActionClick(
                  `Suggest 1–4 packages for postId "${pid}" using suggestCatalogPackages tool. Include sub-day options where relevant (e.g. 4 hours -> 0.5 nights). Then let me approve them.`,
                )
              }}
              disabled={chatIsLoading}
              className="text-sm font-medium leading-5 text-[#475569] bg-white cursor-pointer flex items-center gap-2 shadow-[0_0_0_0_transparent,0_0_0_0_transparent,0_1px_2px_0_rgba(0,0,0,0.05)] transition-all duration-200 border border-[#e2e8f0] rounded-full px-4 py-2 hover:bg-[#f8fafc] hover:border-[#cbd5e1] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Package className="h-4 w-4" />
              Generate Packages
            </button>
            <button
              onClick={() => handleActionClick('Show my packages')}
              className="text-sm font-medium leading-5 text-[#475569] bg-white cursor-pointer flex items-center gap-2 shadow-[0_0_0_0_transparent,0_0_0_0_transparent,0_1px_2px_0_rgba(0,0,0,0.05)] transition-all duration-200 border border-[#e2e8f0] rounded-full px-4 py-2 hover:bg-[#f8fafc] hover:border-[#cbd5e1]"
            >
              <BarChart2 className="h-4 w-4" />
              Show me examples
            </button>
          </div>
        ) : isBookingsContext ? (
          <div className="flex flex-wrap items-center justify-center gap-3">
            {context?.data?.insights?.estimateLink && !restoredEstimate && (
              <button
                onClick={() => handleRestoreEstimate(context.data.insights.estimateLink.estimateId)}
                className="text-sm font-medium leading-5 text-[#0f172a] bg-[#f0fdfa] cursor-pointer flex items-center gap-2 shadow-[0_0_0_0_transparent,0_0_0_0_transparent,0_1px_2px_0_rgba(0,0,0,0.05)] transition-all duration-200 border border-[#ccfbf1] rounded-full px-4 py-2 hover:bg-[#ccfbf1] hover:border-[#99f6e4]"
              >
                <Sparkles className="h-4 w-4 text-[#0d9488]" />
                Restore Estimate
              </button>
            )}
            <button
              onClick={() => handleActionClick('Show my upcoming bookings')}
              className="text-sm font-medium leading-5 text-[#475569] bg-white cursor-pointer flex items-center gap-2 shadow-[0_0_0_0_transparent,0_0_0_0_transparent,0_1px_2px_0_rgba(0,0,0,0.05)] transition-all duration-200 border border-[#e2e8f0] rounded-full px-4 py-2 hover:bg-[#f8fafc] hover:border-[#cbd5e1]"
            >
              <Calendar className="h-4 w-4" />
              Upcoming Trips
            </button>
            <button
              onClick={() => handleActionClick('Show my past bookings')}
              className="text-sm font-medium leading-5 text-[#475569] bg-white cursor-pointer flex items-center gap-2 shadow-[0_0_0_0_transparent,0_0_0_0_transparent,0_1px_2px_0_rgba(0,0,0,0.05)] transition-all duration-200 border border-[#e2e8f0] rounded-full px-4 py-2 hover:bg-[#f8fafc] hover:border-[#cbd5e1]"
            >
              <Home className="h-4 w-4" />
              Past Bookings
            </button>
            <button
              onClick={() => handleActionClick('What are my booking insights?')}
              className="text-sm font-medium leading-5 text-[#475569] bg-white cursor-pointer flex items-center gap-2 shadow-[0_0_0_0_transparent,0_0_0_0_transparent,0_1px_2px_0_rgba(0,0,0,0.05)] transition-all duration-200 border border-[#e2e8f0] rounded-full px-4 py-2 hover:bg-[#f8fafc] hover:border-[#cbd5e1]"
            >
              <TrendingUp className="h-4 w-4" />
              View Insights
            </button>
          </div>
        ) : null}
      </div>
    )
  }

  // Default variant (existing design)
  return (
    <div className={cn("space-y-4", className)}>
      {getActionButtons()}

      {isManageContext && chatError && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {chatError.message || 'Something went wrong. Try again.'}
        </div>
      )}

      {/* Render manage context messages with generative UI */}
      {isManageContext && renderManageMessages()}

      {/* Render simple response for other contexts */}
      {!isManageContext && lastResponse && (
        <div className="rounded-lg border border-primary/20 bg-card p-4">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shadow-sm">
                <Sparkles className="h-4 w-4 text-primary-foreground" />
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm text-foreground leading-relaxed">
                {lastResponse}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MCP Test Result */}
      {mcpTestResult && (
        <div className={cn(
          "rounded-lg border p-3 text-sm",
          mcpTestResult.includes('✅')
            ? "bg-green-50 text-green-800 border-green-200"
            : "bg-red-50 text-red-800 border-red-200"
        )}>
          <div className="whitespace-pre-line">{mcpTestResult}</div>
          {mcpTestResult.includes('No API keys found') && (
            <div className="mt-3 pt-3 border-t border-red-200">
              <a
                href="/admin/collections/payload-mcp-api-keys/create"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-md transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Create API Key in Admin Panel
              </a>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSendMessage}>
        <InputGroup className="shadow-sm">
          <InputGroupTextarea
            ref={textareaRef}
            value={currentInput}
            onChange={handleCurrentInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || defaultPlaceholder}
            className="min-h-[60px] max-h-[120px] py-3"
            disabled={currentIsLoading}
          />
          <InputGroupAddon align="block-end">
            {isManageContext && (
              <>
                <InputGroupButton
                  variant="outline"
                  size="icon-xs"
                  onClick={handleTestMCP}
                  disabled={testingMCP}
                  type="button"
                  className="rounded-full"
                  title="Test MCP endpoint"
                >
                  {testingMCP ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  <span className="sr-only">Test MCP</span>
                </InputGroupButton>
                <Separator orientation="vertical" className="!h-4" />
              </>
            )}
            <InputGroupButton
              variant={isListening ? 'destructive' : 'outline'}
              size="icon-xs"
              onClick={isListening ? stopListening : startListening}
              type="button"
              className="rounded-full"
            >
              <Mic className="h-3.5 w-3.5" />
            </InputGroupButton>
            <Separator orientation="vertical" className="!h-4" />
            <InputGroupButton
              variant="default"
              size="icon-xs"
              onClick={handleSendMessage}
              disabled={!currentInput.trim() || currentIsLoading}
              className="rounded-full"
              type="submit"
            >
              {currentIsLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowUpIcon className="h-3.5 w-3.5" />
              )}
              <span className="sr-only">Send</span>
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </form>
    </div>
  )
}

