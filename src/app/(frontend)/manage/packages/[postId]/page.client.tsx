"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { User } from "@/payload-types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Settings, 
  Eye, 
  Edit3, 
  Plus, 
  Trash2, 
  DollarSign,
  Package,
  Users,
  Calendar,
  Star,
  Loader2
} from 'lucide-react'
import { Mic, MicOff, Wand2, RotateCcw, Bot } from 'lucide-react'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog"
import { useRevenueCat } from "@/providers/RevenueCat"
import { Purchases, type Package as RevenueCatPackage } from "@revenuecat/purchases-js"
import { 
  BASE_PACKAGE_TEMPLATES,
  getPackagesByCategory,
  createHostPackageConfig,
  getDisplayTitle,
  getDisplayDescription,
  getEffectiveMultiplier,
  getEffectiveFeatures,
  getDefaultPackageTitle,
  type HostPackageConfig,
  type BasePackageConfig,
  type PackageCategory
} from "@/lib/package-types"
import { PageAIAssistant } from "@/components/AIAssistant/PageAIAssistant"

interface Props {
  user: User
}

interface PackagePreview {
  duration: number
  baseRate: number
  effectiveRate: number
  savings: number
  total: number
}

interface EnhancedSuggestion {
  revenueCatId: string
  suggestedName: string
  description: string
  features: string[]
  baseRate?: number
  details: {
    minNights?: number
    maxNights?: number
    multiplier?: number
    category?: string
    customerTierRequired?: string
    features?: string
  }
}

export default function ManagePackagesPage({
  postId,
  posts = [],
}: {
  postId: string
  posts?: { id: string; title?: string | null; slug?: string | null }[]
}) {
  const router = useRouter()
  const { packages, loading, error, setPackages, reload } = useHostPackages(postId);

  // AI Assistant suggestions state
  const [suggestions, setSuggestions] = useState<EnhancedSuggestion[]>([])
  const [suggesting, setSuggesting] = useState(false)

  // Listen for apply package suggestion events from AI Assistant
  useEffect(() => {
    const handleApplySuggestion = (event: CustomEvent) => {
      const { suggestion, postId: suggestionPostId } = event.detail
      if (suggestionPostId === postId) {
        upsertPackage(suggestion)
      }
    }

    window.addEventListener('applyPackageSuggestionFromHook', handleApplySuggestion as EventListener)
    
    return () => {
      window.removeEventListener('applyPackageSuggestionFromHook', handleApplySuggestion as EventListener)
    }
  }, [postId])

  // Listen for package creation events from AI Assistant
  useEffect(() => {
    const handlePackageCreated = (event: CustomEvent) => {
      const { packageId, postId: createdPostId } = event.detail
      if (createdPostId === postId) {
        // Refresh the package list
        reload()
        console.log('📦 Package created, refreshing list:', packageId)
      }
    }

    window.addEventListener('packageCreated', handlePackageCreated as EventListener)
    
    return () => {
      window.removeEventListener('packageCreated', handlePackageCreated as EventListener)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId])

  // New listing created from assistant → open that listing’s package page
  useEffect(() => {
    const handlePostCreated = (event: CustomEvent) => {
      const newId = event.detail?.postId as string | undefined
      if (!newId) return
      if (newId === postId) {
        router.refresh()
        return
      }
      router.push(`/manage/packages/${newId}`)
    }
    window.addEventListener('postCreated', handlePostCreated as EventListener)
    return () => window.removeEventListener('postCreated', handlePostCreated as EventListener)
  }, [postId, router])

  // Self destruct state
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [destroying, setDestroying] = useState(false)
  const [destroyError, setDestroyError] = useState<string | null>(null)

  // Add or update a package from suggestion
  const upsertPackage = async (suggestion: EnhancedSuggestion, updates: any = {}) => {
    const existing = packages.find(p => p.revenueCatId === suggestion.revenueCatId);
    
    if (existing) {
      // Update
      const res = await fetch(`/api/packages/${existing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: suggestion.suggestedName,
          description: suggestion.description,
          features: suggestion.features.map(feature => ({ feature })),
          baseRate: suggestion.baseRate,
          ...updates,
        }),
      });
      const updated = await res.json();
      setPackages(pkgs => pkgs.map(p => p.id === updated.id ? updated : p));
    } else {
      // Create
      const res = await fetch(`/api/packages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post: postId,
          name: suggestion.suggestedName,
          description: suggestion.description,
          features: suggestion.features.map(feature => ({ feature })),
          baseRate: suggestion.baseRate,
          revenueCatId: suggestion.revenueCatId,
          isEnabled: true,
          ...updates,
        }),
      });
      const created = await res.json();
      setPackages(pkgs => [...pkgs, created]);
    }
  };

  // Add or update a package from template
  const upsertPackageFromTemplate = async (template: any, updates: any = {}) => {
    const existing = packages.find(p => p.revenueCatId === template.revenueCatId);
    
    if (existing) {
      // Update
      const res = await fetch(`/api/packages/${existing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const updated = await res.json();
      setPackages(pkgs => pkgs.map(p => p.id === updated.id ? updated : p));
    } else {
      // Create
      const res = await fetch(`/api/packages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post: postId,
          name: template.defaultName,
          revenueCatId: template.revenueCatId,
          isEnabled: true,
          ...updates,
        }),
      });
      const created = await res.json();
      setPackages(pkgs => [...pkgs, created]);
    }
  };

  const handleSuggest = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) {
      setSuggestions([])
      return
    }
    try {
      setSuggesting(true)
      const res = await fetch('/api/packages/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: trimmed, postId, hostContext: true })
      })
      const data = await res.json()
      const recommendations: EnhancedSuggestion[] = Array.isArray(data.recommendations) ? data.recommendations : []
      setSuggestions(recommendations.length ? recommendations : getSuggestionsFromText(trimmed))
    } catch (e) {
      setSuggestions(getSuggestionsFromText(trimmed))
    } finally {
      setSuggesting(false)
    }
  }

  const getSuggestionsFromText = (text: string): EnhancedSuggestion[] => {
    const t = text.toLowerCase()
    const picks = new Set<string>()
    if (/\bweek(ly)?\b/.test(t)) picks.add('Weekly')
    if (/(three|3).*night|night(s)?.*(three|3)/.test(t)) picks.add('3nights')
    if (/\bluxury\b|hosted|concierge/.test(t)) picks.add('per_night_luxury')
    if (/gathering|offsite|event|team|monthly workspace/.test(t)) picks.add('gathering_monthly')
    if (/per night|nightly|\bnight(s)?\b/.test(t)) picks.add('per_night')
    if (/hour(ly)?/.test(t)) picks.add('per_hour')
    if (/hour(ly)?.*luxury/.test(t)) picks.add('per_hour_luxury')
    if (/week.*3|3.*week/.test(t)) picks.add('week_x3_customer')
    if (/gathering|event/.test(t)) picks.add('gathering')
    
    // Addon package detection
    if (/cleaning|clean/.test(t)) picks.add('cleaning')
    if (/wine|bottle/.test(t)) picks.add('Bottle_wine')
    if (/hike|guided|tour/.test(t)) picks.add('Hike')
    if (/bath|bomb|soak/.test(t)) picks.add('bathBomb')
    if (/add.?on|extra|service|amenity/.test(t)) {
      // Add common addon packages when addon is mentioned
      picks.add('cleaning')
      picks.add('Bottle_wine')
      picks.add('Hike')
      picks.add('bathBomb')
    }
    
    return PACKAGE_TEMPLATES.filter(tpl => picks.has(tpl.revenueCatId)).map(tpl => ({
      revenueCatId: tpl.revenueCatId,
      suggestedName: tpl.defaultName,
      description: `Standard ${tpl.defaultName} package with ${tpl.features.map(f => f.label).join(', ')}`,
      features: tpl.features.map(f => f.label),
      baseRate: tpl.category === 'addon' ? 
        (tpl.revenueCatId === 'cleaning' ? 300 : 
         tpl.revenueCatId === 'Bottle_wine' ? 200 : 
         tpl.revenueCatId === 'Hike' ? 500 : 
         tpl.revenueCatId === 'bathBomb' ? 100 : 150) : 
        undefined,
      details: {
        minNights: tpl.minNights,
        maxNights: tpl.maxNights,
        multiplier: tpl.baseMultiplier,
        category: tpl.category,
        customerTierRequired: tpl.customerTierRequired,
        features: tpl.features.map(f => f.label).join(', ')
      }
    }))
  }

  const handleStartOver = async () => {
    setSuggestions([])
    await reload()
  }

  const handleSelfDestruct = async () => {
    setDestroyError(null)
    setDestroying(true)
    try {
      // Load all packages for this post
      const res = await fetch(`/api/packages?where[post][equals]=${postId}`)
      const data = await res.json()
      const ids: string[] = (data.docs || []).map((d: any) => d.id)
      if (!ids.length) {
        setConfirmOpen(false)
        setConfirmText('')
        setDestroying(false)
        return
      }
      const params = new URLSearchParams()
      ids.forEach(id => params.append('where[id][in][]', id))
      const del = await fetch(`/api/packages?${params.toString()}`, { method: 'DELETE' })
      if (!del.ok) {
        const errJson = await del.json().catch(() => ({}))
        throw new Error(errJson?.error || 'Failed to delete packages')
      }
      await reload()
      setConfirmOpen(false)
      setConfirmText('')
    } catch (e: any) {
      setDestroyError(e?.message || 'Failed to self destruct')
    } finally {
      setDestroying(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-10">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading packages...</span>
      </div>
    );
  }
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">Manage Packages</h1>

      {/* AI Assistant Package Suggestions */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Button 
            onClick={() => {
              // This will trigger the AI Assistant to open with package context
              const event = new CustomEvent('openAIAssistant', { 
                detail: { 
                  context: 'package-suggestions',
                  postId,
                  message: "I need help creating packages for my property. Can you suggest some packages based on my needs?"
                }
              })
              window.dispatchEvent(event)
            }}
            className="flex items-center gap-2"
          >
            <Bot className="h-4 w-4" />
            Ask AI for Package Suggestions
          </Button>
          {suggesting && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Getting suggestions...
            </div>
          )}
        </div>
        
        {suggestions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {suggestions.map((suggestion) => {
              const existing = packages.find(p => p.revenueCatId === suggestion.revenueCatId)
              return (
                <Card key={`suggest-${suggestion.revenueCatId}`} className="p-4">
                  <div className="space-y-3">
                    <div>
                      <div className="font-medium text-lg">{suggestion.suggestedName}</div>
                      <div className="text-sm text-muted-foreground">{suggestion.description}</div>
                      {suggestion.features && suggestion.features.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-1">
                          <strong>Features:</strong> {suggestion.features.join(', ')}
                        </div>
                      )}
                      <div className="text-xs font-mono text-muted-foreground mt-1">{suggestion.revenueCatId}</div>
                    </div>
                    
                    {/* Package Details */}
                    <div className="text-xs space-y-1 bg-muted p-2 rounded">
                      <div><strong>Duration:</strong> {suggestion.details.minNights}-{suggestion.details.maxNights} nights</div>
                      <div><strong>Category:</strong> {suggestion.details.category}</div>
                      <div><strong>Multiplier:</strong> {suggestion.details.multiplier}x</div>
                      <div><strong>Entitlement:</strong> {suggestion.details.customerTierRequired}</div>
                      {suggestion.baseRate && (
                        <div><strong>Base Rate:</strong> R{suggestion.baseRate}</div>
                      )}
                      {suggestion.details.features && (
                        <div><strong>Features:</strong> {suggestion.details.features}</div>
                      )}
                    </div>
                    
                    <div className="flex justify-end">
                      {existing ? (
                        <Badge>Already added</Badge>
                      ) : (
                        <Button size="sm" onClick={() => upsertPackage(suggestion)}>
                          Add Package
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {PACKAGE_TEMPLATES.map(template => {
          const pkg = packages.find(p => p.revenueCatId === template.revenueCatId);
          return (
            
            <Card key={template.revenueCatId}>
              <CardHeader>
                <CardTitle>{pkg?.name || template.defaultName}</CardTitle>
                <CardDescription>
                  RevenueCat Product: <span className="font-mono">{template.revenueCatId}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Display Name</label>
                  <div className="flex gap-2">
                    <Input
                      value={pkg?.name || template.defaultName}
                      onChange={e => upsertPackageFromTemplate(template, { name: e.target.value })}
                      disabled={!pkg}
                    />
                    {/* Quick AI suggestion button */}
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      onClick={() => {
                        const event = new CustomEvent('openAIAssistant', { 
                          detail: { 
                            context: 'package-rename',
                            postId,
                            currentName: pkg?.name || template.defaultName,
                            message: `I want to rename my "${pkg?.name || template.defaultName}" package. Can you suggest a better name?`
                          }
                        })
                        window.dispatchEvent(event)
                      }}
                      title="Get AI suggestions for this package name"
                    >
                      <Wand2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id={`enabled-${template.revenueCatId}`}
                    checked={!!pkg?.isEnabled}
                    onCheckedChange={checked => upsertPackageFromTemplate(template, { isEnabled: checked })}
                    disabled={!pkg}
                  />
                  <label htmlFor={`enabled-${template.revenueCatId}`}>Enabled</label>
                </div>
              </CardContent>
              <CardFooter>
                {!pkg ? (
                  <Button onClick={() => upsertPackageFromTemplate(template)}>
                    Add Package
                  </Button>
                ) : (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      const event = new CustomEvent('openAIAssistant', { 
                        detail: { 
                          context: 'package-update',
                          postId,
                          packageId: pkg.id,
                          currentName: pkg.name,
                          currentCategory: pkg.category || template.category,
                          message: `I want to update my "${pkg.name}" package. Can you help me modify it?`
                        }
                      })
                      window.dispatchEvent(event)
                    }}
                  >
                    <Wand2 className="h-4 w-4 mr-1" />
                    Update Package
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <div className="mt-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
        <Button variant="outline" onClick={handleStartOver}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Start Over
        </Button>

        <Dialog open={confirmOpen} onOpenChange={(o) => { setConfirmOpen(o); if (!o) { setConfirmText(''); setDestroyError(null) } }}>
          <DialogTrigger asChild>
            <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Self Destruct (Delete All)
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete all packages for this post?</DialogTitle>
              <DialogDescription>
                This action will permanently delete all packages for this post. This cannot be undone.
                Type DELETE to confirm.
              </DialogDescription>
            </DialogHeader>
            {destroyError && <p className="text-sm text-destructive">{destroyError}</p>}
            <div className="mt-2">
              <Label htmlFor="confirm">Confirmation</Label>
              <Input id="confirm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="Type DELETE" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={destroying}>Cancel</Button>
              <Button variant="destructive" onClick={handleSelfDestruct} disabled={confirmText !== 'DELETE' || destroying}>
                {destroying ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Delete All
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* AI Assistant */}
      <div className="mt-12 border-t border-primary/20 pt-12">
        <div className="max-w-3xl mx-auto">
          <PageAIAssistant
            context={{
              type: 'manage',
              data: {
                posts: posts.length > 0 ? posts : [{ id: postId }],
                postId,
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}

function useHostPackages(postId: string) {
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPackages = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/packages?where[post][equals]=${postId}`)
      const data = await res.json()
      setPackages(data.docs || [])
      setLoading(false)
    } catch (err) {
      setError('Failed to load packages')
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!postId) return;
    fetchPackages()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId]);

  // Listen for apply package suggestion events from AI Assistant
  useEffect(() => {
    const handleApplySuggestion = (event: CustomEvent) => {
      const { suggestion, postId: suggestionPostId } = event.detail
      if (suggestionPostId === postId) {
        // This will be handled by the main component
        window.dispatchEvent(new CustomEvent('applyPackageSuggestionFromHook', { 
          detail: { suggestion, postId: suggestionPostId }
        }))
      }
    }

    window.addEventListener('applyPackageSuggestion', handleApplySuggestion as EventListener)
    
    return () => {
      window.removeEventListener('applyPackageSuggestion', handleApplySuggestion as EventListener)
    }
  }, [postId])

  const reload = async () => {
    await fetchPackages()
  }

  return { packages, loading, error, setPackages, reload };
}

const PACKAGE_TEMPLATES = BASE_PACKAGE_TEMPLATES.map(t => ({
  revenueCatId: t.revenueCatId,
  defaultName: getDefaultPackageTitle(t),
  minNights: t.minNights,
  maxNights: t.maxNights,
  baseMultiplier: t.baseMultiplier,
  category: t.category,
  customerTierRequired: t.customerTierRequired,
  features: t.features
})) 