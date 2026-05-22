"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Post } from '@/payload-types'
import { Sidebar, SidebarMenuButton } from './components/Sidebar'
import { PropertyHeroEditor } from './components/PropertyHeroEditor'
import { PageAIAssistant } from '@/components/AIAssistant/PageAIAssistant'
import PackageDashboard, {
  ManageDashboardEmptyState,
} from '@/app/(frontend)/manage/packages/PackageDashboard'
import AnnualStatementClient from '@/app/(frontend)/bookings/annual-statement/page.client'
import { useUserContext } from '@/context/UserContext'
import { LayoutDashboard, MessageSquare } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'

type ManagePageClientProps = {
  posts: Post[]
  latestEstimatePostId: string | null
}

export default function ManagePageClient({ posts, latestEstimatePostId }: ManagePageClientProps) {
  const { currentUser } = useUserContext()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [postsState, setPostsState] = useState(posts)

  const requestedPostId = useMemo(() => {
    const q = searchParams?.get('postId')
    return typeof q === 'string' && q.trim() ? q.trim() : null
  }, [searchParams])

  const shouldStartOnboarding = useMemo(() => {
    return searchParams?.get('onboard') === '1'
  }, [searchParams])

  const [selectedPostId, setSelectedPostId] = useState<string | null>(() => {
    if (requestedPostId && posts.some((p) => p.id === requestedPostId)) return requestedPostId
    return null
  })

  const replaceManageUrl = useCallback(
    (postId: string | null) => {
      const params = new URLSearchParams(searchParams?.toString() || '')
      if (postId) {
        params.set('postId', postId)
      } else {
        params.delete('postId')
      }
      const qs = params.toString()
      router.replace(qs ? `/manage?${qs}` : '/manage', { scroll: false })
    },
    [router, searchParams],
  )

  const handleSelectProperty = useCallback(
    (id: string) => {
      setSelectedPostId(id)
      replaceManageUrl(id)
    },
    [replaceManageUrl],
  )

  useEffect(() => {
    setPostsState(posts)
  }, [posts])

  // Deep link: keep sidebar selection in sync when postId query changes (refresh, back/forward).
  useEffect(() => {
    if (!requestedPostId) return
    if (!postsState.some((p) => p.id === requestedPostId)) return
    setSelectedPostId(requestedPostId)
  }, [requestedPostId, postsState])

  // Drop selection if the listing was removed; do not auto-select another property.
  useEffect(() => {
    setSelectedPostId((sel) => {
      if (!sel) return null
      if (postsState.some((p) => p.id === sel)) return sel
      return null
    })
  }, [postsState])

  // New listing created from assistant → add to sidebar immediately and select it.
  useEffect(() => {
    const handlePostCreated = (event: Event) => {
      const detail = (event as CustomEvent<any>)?.detail
      const newPost = detail?.post
      const newId = String(detail?.postId || newPost?.id || '').trim()
      if (!newId) return

      setPostsState((prev) => {
        if (prev.some((p) => p.id === newId)) return prev
        const normalized: Post = {
          ...(newPost || {}),
          id: newId,
        }
        return [normalized, ...prev]
      })
      handleSelectProperty(newId)
    }

    window.addEventListener('postCreated', handlePostCreated as EventListener)
    return () => window.removeEventListener('postCreated', handlePostCreated as EventListener)
  }, [handleSelectProperty])

  const selectedProperty = useMemo(() => {
    if (!selectedPostId) return null
    const post = postsState.find((p) => p.id === selectedPostId)
    if (!post) return null
    const metaDesc =
      typeof post.meta?.description === 'string' ? post.meta.description.trim() : ''
    return {
      id: post.id,
      title: post.title,
      description: metaDesc || null,
      wifi: typeof post.wifi === 'string' && post.wifi.trim() ? post.wifi.trim() : null,
      lockbox:
        typeof post.lockbox === 'string' && post.lockbox.trim() ? post.lockbox.trim() : null,
    }
  }, [postsState, selectedPostId])

  const [activeTab, setActiveTab] = useState<'packages' | 'statement'>('packages')
  const [mobileView, setMobileView] = useState<'dashboard' | 'assistant'>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Consume ?onboard=1 once so selecting properties doesn't keep re-opening onboarding.
  useEffect(() => {
    if (!shouldStartOnboarding) return
    const postId = requestedPostId || selectedPostId
    if (!postId) return
    router.replace(`/manage?postId=${encodeURIComponent(postId)}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldStartOnboarding])

  return (
    <div className="h-screen flex flex-col bg-[rgba(248,250,252,0.5)] dark:bg-background">
      {/* Mobile Toggle */}
      <div className="lg:hidden sticky top-0 z-10 bg-white dark:bg-background border-b border-[#e2e8f0] dark:border-border px-4 py-3 flex items-center gap-2">
        <SidebarMenuButton open={sidebarOpen} onOpen={() => setSidebarOpen(true)} />
        <div className="flex-1 flex gap-2 bg-[#f1f5f9] dark:bg-muted rounded-lg p-1 min-w-0">
          <button 
            onClick={() => setMobileView('dashboard')} 
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
              mobileView === 'dashboard' 
                ? 'bg-white dark:bg-card text-[#0f172a] dark:text-foreground shadow-sm' 
                : 'text-[#64748b] dark:text-muted-foreground hover:text-[#0f172a] dark:hover:text-foreground'
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </button>
          <button 
            onClick={() => setMobileView('assistant')} 
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
              mobileView === 'assistant' 
                ? 'bg-white dark:bg-card text-[#0f172a] dark:text-foreground shadow-sm' 
                : 'text-[#64748b] dark:text-muted-foreground hover:text-[#0f172a] dark:hover:text-foreground'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            AI Assistant
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex">
          {/* Sidebar */}
          <Sidebar
            activeProperty={selectedPostId}
            onSelectProperty={handleSelectProperty}
            properties={postsState}
            activeTab={activeTab}
            onSelectTab={setActiveTab}
            mobileOpen={sidebarOpen}
            onMobileOpenChange={setSidebarOpen}
            currentUser={{
              name: currentUser?.name || null,
              email: currentUser?.email || null,
            }}
          />

          {/* Dashboard and Assistant Split */}
          <div className="flex-1 h-full lg:grid lg:grid-cols-[1fr,450px] xl:grid-cols-[1fr,500px]">
            {/* Dashboard Section */}
            <div className={`h-full overflow-y-auto ${mobileView === 'dashboard' ? 'block' : 'hidden lg:block'}`}>
              <div className="max-w-[1400px] mx-auto px-6 py-8">
                {/* Content based on active tab */}
                {activeTab === 'packages' && (
                  <>
                    {selectedPostId ? (
                      <>
                        <PropertyHeroEditor
                          postId={selectedPostId}
                          onListingDeleted={(id) => {
                            setPostsState((prev) => prev.filter((p) => p.id !== id))
                            if (selectedPostId === id) {
                              setSelectedPostId(null)
                              replaceManageUrl(null)
                            }
                          }}
                        />
                        <PackageDashboard postId={selectedPostId} startOnboarding={shouldStartOnboarding} />
                      </>
                    ) : (
                      <ManageDashboardEmptyState propertyCount={postsState.length} />
                    )}
                  </>
                )}

                {activeTab === 'statement' && (
                  <AnnualStatementClient
                    postId={latestEstimatePostId}
                    year={undefined}
                  />
                )}
              </div>
            </div>

            {/* AI Assistant Section - Docked Right */}
            <div className={`h-full bg-white dark:bg-background border-l border-[#e2e8f0] dark:border-border overflow-y-auto ${mobileView === 'assistant' ? 'block' : 'hidden lg:block'}`}>
              <div className="h-full flex flex-col">
                <div className="flex-1 overflow-y-auto px-6 py-8">
                  <PageAIAssistant
                    context={{
                      type: 'manage',
                      data: {
                        posts: postsState,
                        latestEstimatePostId,
                        postId: selectedPostId,
                        selectedProperty,
                      },
                    }}
                    variant="primary"
                    className="max-w-2xl mx-auto"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

