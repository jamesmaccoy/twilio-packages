'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import { Loader2, Sparkles, ArrowRight, X, Package, ExternalLink, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { PackagePreview } from '@/components/PackagePreview'
import { toast } from '@payloadcms/ui'

interface PackageOnboardingProps {
  postId: string
  /** When set, user is enriching an existing package (updatePackageTool) instead of creating new */
  existingPackageId?: string
  onComplete?: (packageData: any) => void
  onCancel?: () => void
  className?: string
}

type Step = 'describe' | 'details'

function getToolName(part: { type?: string }): string {
  const type = typeof part?.type === 'string' ? part.type : ''
  return type.startsWith('tool-') ? type.replace('tool-', '') : ''
}

export function PackageOnboarding({
  postId,
  existingPackageId,
  onComplete,
  onCancel,
  className,
}: PackageOnboardingProps) {
  const [step, setStep] = useState<Step>('describe')
  const [packageName, setPackageName] = useState('')
  const [packageDescription, setPackageDescription] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [descriptionTouched, setDescriptionTouched] = useState(false)
  const [propertyTitle, setPropertyTitle] = useState<string | null>(null)
  const [propertyDescription, setPropertyDescription] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [pendingPackagePreview, setPendingPackagePreview] = useState<any>(null)
  const [isSavingPackage, setIsSavingPackage] = useState(false)
  const [createdPackageId, setCreatedPackageId] = useState<string | null>(null)
  const [lastSuccessWasUpdate, setLastSuccessWasUpdate] = useState(false)
  const [isSuggestingCopy, setIsSuggestingCopy] = useState(false)
  const [copySuggestionError, setCopySuggestionError] = useState<string | null>(null)

  const isUpdateMode = Boolean(existingPackageId?.trim())

  // When switching properties, always bring user back to the editable step.
  useEffect(() => {
    setStep('describe')
    setPendingPackagePreview(null)
    setCreatedPackageId(null)
    setIsGenerating(false)
    setIsSavingPackage(false)
    setIsSuggestingCopy(false)
    setCopySuggestionError(null)
    setNameTouched(false)
    setDescriptionTouched(false)
    // Let derived defaults re-apply for the new property
    setPackageName('')
    setPackageDescription('')
  }, [postId])

  // If we're editing an existing package, prefill from it (so the user can edit immediately).
  useEffect(() => {
    let cancelled = false
    async function loadExistingPackage() {
      const id = existingPackageId?.trim()
      if (!id) return
      try {
        const res = await fetch(`/api/packages/${id}?depth=0`)
        const data = await res.json()
        if (!res.ok) return
        const name = typeof data?.name === 'string' ? data.name.trim() : ''
        const description = typeof data?.description === 'string' ? data.description.trim() : ''
        if (cancelled) return
        if (name && !nameTouched) setPackageName(name)
        if (description && !descriptionTouched) setPackageDescription(description)
      } catch {
        // best-effort only
      }
    }
    loadExistingPackage()
    return () => {
      cancelled = true
    }
  }, [existingPackageId, nameTouched, descriptionTouched])

  const manageTransport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat/manage',
        body: {
          pageData: {
            posts: [{ id: postId }],
            postId,
            ...(existingPackageId?.trim() ? { existingPackageId: existingPackageId.trim() } : {}),
          },
        },
      }),
    [postId, existingPackageId],
  )

  // Derive defaults from the selected property so "new property → packages" and
  // "create new package" feel like one consistent flow.
  useEffect(() => {
    let cancelled = false
    async function loadProperty() {
      if (!postId?.trim()) return
      try {
        const res = await fetch(`/api/posts/${postId}`)
        const data = await res.json()
        if (!res.ok) return

        const doc = data?.doc || data
        const title = typeof doc?.title === 'string' ? doc.title.trim() : ''
        // Content is Lexical; best-effort extract first text as a description hint.
        const lexicalText =
          doc?.content?.root?.children?.[0]?.children?.[0]?.text &&
          typeof doc.content.root.children[0].children[0].text === 'string'
            ? (doc.content.root.children[0].children[0].text as string).trim()
            : ''

        if (cancelled) return
        setPropertyTitle(title || null)
        setPropertyDescription(lexicalText || null)
      } catch {
        // best-effort only
      }
    }
    loadProperty()
    return () => {
      cancelled = true
    }
  }, [postId])

  // Apply derived defaults once, without clobbering user edits.
  useEffect(() => {
    if (!propertyTitle) return

    if (!packageName.trim() && !nameTouched) {
      setPackageName(propertyTitle)
    }
    if (!packageDescription.trim() && !descriptionTouched) {
      const desc = propertyDescription?.trim()
      setPackageDescription(desc ? desc : `Packages for ${propertyTitle}.`)
    }
    // Only run when property data arrives; do not re-run as user types.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyTitle, propertyDescription, nameTouched, descriptionTouched])

  const derivedDefaultName = propertyTitle?.trim() || ''
  const derivedDefaultDescription = propertyTitle
    ? (propertyDescription?.trim() ? propertyDescription.trim() : `Packages for ${propertyTitle}.`)
    : ''

  const chatHook = useChat({
    transport: manageTransport,
    onFinish: (result: any) => {
      const message = result?.message || result

      if (message?.role !== 'assistant' || !message.parts) return

      const parts = message.parts as any[]

      const previewPart = parts.find(
        (p: any) =>
          getToolName(p) === 'previewPackage' && p.state === 'output-available',
      )
      if (previewPart?.output && !isUpdateMode) {
        setPendingPackagePreview({
          ...previewPart.output,
          name: packageName || previewPart.output.name,
          description: packageDescription || previewPart.output.description,
        })
        setIsGenerating(false)
        setStep('details')
      }

      const updatePart = parts.find(
        (p: any) => getToolName(p) === 'updatePackage' && p.state === 'output-available',
      )
      if (updatePart?.output?.success) {
        setIsGenerating(false)
        setIsSavingPackage(false)
        const id =
          updatePart.output.package?.id || existingPackageId || null
        if (id) setCreatedPackageId(id)
        setLastSuccessWasUpdate(true)
        setStep('details')
        if (onComplete) {
          onComplete({
            ...updatePart.output.package,
            id,
            ...pendingPackagePreview,
          })
        }
        return
      }
      if (updatePart?.output && updatePart.output.success === false) {
        setIsGenerating(false)
        setIsSavingPackage(false)
        console.error('Package update failed:', updatePart.output)
      }

      const createPart = parts.find(
        (p: any) => getToolName(p) === 'createPackage' && p.state === 'output-available',
      )
      if (createPart?.output?.success) {
        setIsSavingPackage(false)
        setLastSuccessWasUpdate(false)
        const createdPackage = createPart.output.package || createPart.output
        const packageId =
          createPart.output.packageId ||
          createPart.output.package?.id ||
          createdPackage.id ||
          createPart.output.id

        if (packageId) setCreatedPackageId(packageId)

        if (onComplete) {
          onComplete({
            ...createdPackage,
            id: packageId || createdPackage.id,
            ...pendingPackagePreview,
          })
        }
      } else if (createPart?.output && createPart.output.success === false) {
        setIsSavingPackage(false)
        console.error('Package creation failed:', createPart.output)
      }
    },
  } as any)

  const { messages = [], sendMessage, status } = (chatHook || {}) as any
  const chatIsLoading = status === 'submitted' || status === 'streaming'

  const handleSuggestCopyFromProperty = async () => {
    setIsSuggestingCopy(true)
    setCopySuggestionError(null)

    try {
      const res = await fetch('/api/packages/suggest-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to suggest copy')

      const suggestedName = typeof data?.name === 'string' ? data.name.trim() : ''
      const suggestedDescription = typeof data?.description === 'string' ? data.description.trim() : ''
      if (!suggestedName || !suggestedDescription) throw new Error('Missing suggestion')

      setPackageName((prev) =>
        !nameTouched || prev.trim() === derivedDefaultName ? suggestedName : prev,
      )
      setPackageDescription((prev) =>
        !descriptionTouched || prev.trim() === derivedDefaultDescription ? suggestedDescription : prev,
      )
    } catch (e) {
      console.error(e)
      setCopySuggestionError('Could not generate suggestion. Try again.')
    } finally {
      setIsSuggestingCopy(false)
    }
  }

  const handleDescribeSubmit = async () => {
    if (!packageDescription.trim()) {
      toast.error('Please add a short package description.')
      return
    }
    if (!sendMessage) {
      console.error('sendMessage is not available on useChat')
      toast.error('Assistant is not ready yet. Please try again.')
      return
    }

    setIsGenerating(true)
    setStep('details')

    const name = packageName.trim() || propertyTitle?.trim() || 'New Package'
    const desc = packageDescription.trim()
    const propertyContextTitle = propertyTitle?.trim() || ''
    const propertyContextDescription = propertyDescription?.trim() || ''

    const prompt = isUpdateMode
      ? `Use the property context, then call updatePackageTool with packageId="${existingPackageId!.trim()}", postId="${postId}", name="${name}", description="${desc}". Set category, minNights, maxNights, baseRate (ZAR), multiplier, features, entitlement. Tool call only.`
      : `Property context:\n- title: "${propertyContextTitle}"\n- description: "${propertyContextDescription}"\n\nCall previewPackageTool with name="${name}", description="${desc}", postId="${postId}". If name/description are vague, improve them using the property context. Tool call only.`

    try {
      await sendMessage({ text: prompt })
    } catch (e) {
      console.error(e)
      setIsGenerating(false)
      toast.error('Could not generate a package preview. Please try again.')
    }
  }

  const handleConfirmPackage = async () => {
    if (!pendingPackagePreview || isUpdateMode) return
    setIsSavingPackage(true)
    const previewData = { ...pendingPackagePreview }
    const packagePostId = previewData.postId || postId

    try {
      // Persist directly to the DB (do not rely on the model to call createPackageTool).
      const res = await fetch(`/api/packages`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post: packagePostId,
          name: previewData.name,
          description: previewData.description,
          category: previewData.category,
          entitlement: previewData.entitlement || 'standard',
          minNights: previewData.minNights,
          maxNights: previewData.maxNights,
          baseRate: previewData.baseRate || undefined,
          multiplier: previewData.multiplier || 1,
          features: Array.isArray(previewData.features)
            ? previewData.features.map((f: string) => ({ feature: f }))
            : [],
          revenueCatId: previewData.revenueCatId || undefined,
          yocoId: previewData.yocoId || undefined,
          isEnabled: true,
        }),
      })

      const created = await res.json()
      if (!res.ok) {
        throw new Error(created?.error || 'Failed to create package')
      }

      const createdId = created?.id
      if (typeof createdId === 'string' && createdId.trim()) {
        setCreatedPackageId(createdId.trim())
      }
      setIsSavingPackage(false)
      setLastSuccessWasUpdate(false)

      if (onComplete) {
        onComplete({
          ...created,
          id: createdId,
          ...pendingPackagePreview,
        })
      }
    } catch (e) {
      console.error(e)
      setIsSavingPackage(false)
    }
  }

  const handleCancelPackage = () => {
    setPendingPackagePreview(null)
    if (onCancel) {
      onCancel()
    } else {
      setStep('describe')
      setPackageName('')
      setPackageDescription('')
    }
  }

  const renderToolPart = (part: any, index: number) => {
    const tool = getToolName(part)

    if (tool === 'previewPackage') {
      switch (part.state) {
        case 'input-available':
          return (
            <div key={index} className="text-sm text-slate-500 italic">
              Generating package details...
            </div>
          )
        case 'output-available':
          return (
            <div key={index} className="my-4">
              <PackagePreview
                {...part.output}
                name={packageName || part.output.name}
                description={packageDescription || part.output.description}
                onConfirm={handleConfirmPackage}
                onCancel={handleCancelPackage}
                isSaving={isSavingPackage}
              />
            </div>
          )
        case 'output-error':
          return (
            <div key={index} className="text-sm text-red-600">
              Error: {part.errorText || 'Failed to generate package details'}
            </div>
          )
        default:
          return null
      }
    }

    if (tool === 'updatePackage') {
      switch (part.state) {
        case 'input-available':
          return (
            <div key={index} className="text-sm text-slate-500 italic">
              Updating package...
            </div>
          )
        case 'output-available':
          return (
            <div
              key={index}
              className={cn(
                'text-sm p-3 rounded-lg',
                part.output.success
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200',
              )}
            >
              {part.output.message || (part.output.success ? 'Package updated.' : 'Update failed.')}
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

    if (tool === 'createPackage') {
      switch (part.state) {
        case 'input-available':
          return (
            <div key={index} className="text-sm text-slate-500 italic">
              Creating package...
            </div>
          )
        case 'output-available':
          return (
            <div
              key={index}
              className={cn(
                'text-sm p-3 rounded-lg',
                part.output.success
                  ? 'bg-green-50 text-green-800 border border-green-200'
                  : 'bg-red-50 text-red-800 border border-red-200',
              )}
            >
              {part.output.message}
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

    return null
  }

  const renderMessages = () => {
    return (
      <div className="space-y-4">
        {messages.map((message: any) => (
          <div key={message.id} className="flex gap-3">
            <div className="flex-shrink-0">
              <div
                className={cn(
                  'h-8 w-8 rounded-full flex items-center justify-center shadow-sm',
                  message.role === 'user' ? 'bg-slate-200' : 'bg-primary',
                )}
              >
                {message.role === 'user' ? (
                  <span className="text-xs font-semibold text-slate-600">You</span>
                ) : (
                  <Sparkles className="h-4 w-4 text-primary-foreground" />
                )}
              </div>
            </div>
            <div className="flex-1 space-y-2">
              {message.parts?.map((part: any, index: number) => {
                if (part.type === 'text') {
                  return (
                    <p key={index} className="text-sm text-foreground leading-relaxed">
                      {part.text}
                    </p>
                  )
                }
                if (typeof part.type === 'string' && part.type.startsWith('tool-')) {
                  const rendered = renderToolPart(part, index)
                  if (rendered) return rendered
                }
                return null
              })}
            </div>
          </div>
        ))}
      </div>
    )
  }

  const showLoadingCard =
    (isGenerating || chatIsLoading) && !pendingPackagePreview && !createdPackageId

  if (step === 'describe') {
    return (
      <div className={cn('w-full max-w-2xl mx-auto', className)}>
        <Card className="border-2 border-slate-200 shadow-lg">
          <div className="p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                {isUpdateMode ? 'Update package' : 'Create a Package'}
              </h2>
              <p className="text-slate-500">
                {isUpdateMode
                  ? 'Describe how you want this package to read and price. We will apply it to your existing listing.'
                  : 'Start by describing your package'}
              </p>
            </div>

            <div className="mb-8">
              <div className="relative w-full aspect-square max-w-[200px] mx-auto mb-4">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-teal-100 via-pink-100 to-blue-100 flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-white/80 flex items-center justify-center shadow-lg">
                    <Package className="h-8 w-8 text-slate-600" />
                  </div>
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-slate-900">
                  {isUpdateMode ? 'Existing package' : 'Custom Package'}
                </h3>
                {isUpdateMode && (
                  <p className="text-xs text-slate-500 mt-1 font-mono">{existingPackageId}</p>
                )}
              </div>
            </div>

            <div className="mb-4">
              <label htmlFor="package-name" className="block text-sm font-medium text-slate-700 mb-2">
                Package Name (optional)
              </label>
              <input
                id="package-name"
                type="text"
                value={packageName}
                onChange={(e) => {
                  setNameTouched(true)
                  setPackageName(e.target.value)
                }}
                placeholder="e.g., Weekend Getaway"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
              />
            </div>

            <div className="mb-6">
              <label htmlFor="package-description" className="block text-sm font-medium text-slate-700 mb-2">
                Description
              </label>
              <Textarea
                id="package-description"
                value={packageDescription}
                onChange={(e) => {
                  setDescriptionTouched(true)
                  setPackageDescription(e.target.value)
                }}
                placeholder={
                  isUpdateMode
                    ? 'e.g., Winter special, 3-night min, R4500 base...'
                    : 'Describe what guests get, pricing hints, and duration...'
                }
                className="min-h-[120px] resize-none border-slate-300 focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
              {!isUpdateMode && (
                <div className="mt-3 flex items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSuggestCopyFromProperty}
                    disabled={!propertyTitle || isSuggestingCopy || chatIsLoading}
                    className="border-teal-200 hover:bg-teal-50"
                  >
                    {isSuggestingCopy ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Suggesting…
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2 text-teal-600" />
                        Suggest from property
                      </>
                    )}
                  </Button>
                  {copySuggestionError && (
                    <p className="text-xs text-red-600">{copySuggestionError}</p>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-4">
              {onCancel && (
                <Button variant="outline" onClick={onCancel} className="flex-1">
                  Cancel
                </Button>
              )}
              <Button
                onClick={handleDescribeSubmit}
                disabled={!packageDescription.trim() || isGenerating || chatIsLoading}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white"
              >
                {isGenerating || chatIsLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {isUpdateMode ? 'Applying...' : 'Generating...'}
                  </>
                ) : (
                  <>
                    {isUpdateMode ? 'Apply' : 'Next'}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className={cn('w-full max-w-6xl mx-auto', className)}>
      <div className="grid grid-cols-1 gap-6">
        {/* Package details (tool output only) */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">
                {isUpdateMode ? 'Package update' : 'Package Details'}
              </h2>
              <p className="text-slate-500 mt-1">
                {isUpdateMode
                  ? 'Review the assistant result below'
                  : 'Review and customize your package settings'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setStep('describe')
                setPendingPackagePreview(null)
                setCreatedPackageId(null)
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {pendingPackagePreview && !createdPackageId && !isUpdateMode && (
            <div className="my-4">
              <PackagePreview
                {...pendingPackagePreview}
                name={packageName || pendingPackagePreview.name}
                description={packageDescription || pendingPackagePreview.description}
                onConfirm={handleConfirmPackage}
                onCancel={handleCancelPackage}
                isSaving={isSavingPackage}
              />
            </div>
          )}

          {createdPackageId && (
            <Card className="p-6 border-green-200 bg-green-50">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-100 rounded-full">
                    <Package className="h-5 w-5 text-green-700" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-green-900 mb-1">
                      {lastSuccessWasUpdate ? 'Package updated!' : 'Package created successfully!'}
                    </h3>
                    <p className="text-sm text-green-700">
                      {lastSuccessWasUpdate
                        ? 'Changes are saved; you can keep editing in the dashboard.'
                        : 'Your package is saved and ready to use.'}
                    </p>
                  </div>
                </div>

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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      window.open(`/manage/packages/${postId}`, '_blank')
                    }}
                    className="bg-white hover:bg-green-50 border-green-300"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Manage Packages
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCreatedPackageId(null)
                      setPendingPackagePreview(null)
                      setLastSuccessWasUpdate(false)
                      setStep('describe')
                      setPackageName('')
                      setPackageDescription('')
                    }}
                    className="bg-white hover:bg-green-50 border-green-300"
                  >
                    <Package className="h-4 w-4 mr-2" />
                    {isUpdateMode ? 'Another update' : 'Create Another'}
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {showLoadingCard && (
            <Card className="p-8">
              <div className="flex flex-col items-center justify-center space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
                <p className="text-sm text-slate-500">
                  {isUpdateMode ? 'Applying your package changes...' : 'Generating package details...'}
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
