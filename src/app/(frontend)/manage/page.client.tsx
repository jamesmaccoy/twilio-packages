"use client"

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { Post } from '@/payload-types'
import { Sidebar, SidebarMenuButton } from './components/Sidebar'
import { PropertyHeroEditor } from './components/PropertyHeroEditor'
import { PageAIAssistant } from '@/components/AIAssistant/PageAIAssistant'
import PackageDashboard from '@/app/(frontend)/manage/packages/PackageDashboard'
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

  const [selectedPostId, setSelectedPostId] = useState<string | null>(
    requestedPostId || (posts.length > 0 && posts[0] ? posts[0].id : null)
  )

  useEffect(() => {
    setPostsState(posts)
  }, [posts])

  useEffect(() => {
    setSelectedPostId((sel) => {
      if (!sel) return postsState[0]?.id ?? null
      if (postsState.some((p) => p.id === sel)) return sel
      return postsState[0]?.id ?? null
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
      setSelectedPostId(newId)
    }

    window.addEventListener('postCreated', handlePostCreated as EventListener)
    return () => window.removeEventListener('postCreated', handlePostCreated as EventListener)
  }, [])
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
            onSelectProperty={setSelectedPostId}
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
                    {postsState.length === 0 ? (
                      <div className="text-center py-16 bg-white dark:bg-card rounded-xl border border-slate-200 dark:border-border p-8">
                        <div className="text-gray-500 dark:text-muted-foreground text-lg mb-4">
                          You have no properties yet.
                        </div>
                        <Link 
                          href="/manage/properties/new" 
                          className="inline-block bg-slate-900 hover:bg-slate-800 text-white dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 px-6 py-3 rounded-lg transition"
                        >
                          Create your first property
                        </Link>
                      </div>
                    ) : selectedPostId ? (
                      <>
                        <PropertyHeroEditor
                          postId={selectedPostId}
                          onListingDeleted={(id) => {
                            setPostsState((prev) => prev.filter((p) => p.id !== id))
                          }}
                        />
                        <PackageDashboard postId={selectedPostId} startOnboarding={shouldStartOnboarding} />
                      </>
                    ) : (
                      <div className="text-center py-16 bg-white dark:bg-card rounded-xl border border-slate-200 dark:border-border p-8">
                        <div className="text-gray-500 dark:text-muted-foreground text-lg mb-4">
                          Select a property from the sidebar to manage packages.
                        </div>
                      </div>
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

