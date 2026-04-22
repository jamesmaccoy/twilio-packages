'use client'
import { useHeaderTheme } from '@/providers/HeaderTheme'
import React, { useEffect } from 'react'
import { motion } from 'framer-motion'

interface PageClientProps {
  post?: {
    id: string
    title: string
    content: any
    meta?: {
      title?: string | null
      image?: (string | null) | any
      description?: string | null
    }
    baseRate?: number | null
    relatedPosts?: any[]
  }
}

const PageClient: React.FC<PageClientProps> = ({ post }) => {
  /* Force the header to be dark mode while we have an image behind it */
  const { setHeaderTheme } = useHeaderTheme()

  useEffect(() => {
    setHeaderTheme('dark')
  }, [setHeaderTheme])

  // Create post context for AI Assistant
  const getPostContext = () => {
    if (!post) return null
    
    return {
      context: 'post-article',
      post: {
        id: post.id,
        title: post.title,
        description: post.meta?.description || '',
        content: post.content,
        baseRate: post.baseRate,
        relatedPosts: post.relatedPosts || [],
        categories: Array.isArray(post.categories)
          ? post.categories.map((c: any) => (typeof c === 'object' ? c.title || c.slug : c))
          : [],
        heroImage: post.heroImage
      }
    }
  }

  // Set post context immediately on mount and when post changes
  useEffect(() => {
    if (typeof window === 'undefined') return
    const context = getPostContext()
    if (context) {
      ;(window as any).postContext = context
      try {
        window.dispatchEvent(new CustomEvent('aiPostContextReady', { detail: context }))
      } catch {
        // no-op
      }
    }
  }, [post])

  return (
    <>
      {/* Set context for AI Assistant */}
      {post && (
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('load', function() {
                const context = ${JSON.stringify(getPostContext())};
                window.postContext = context;
              });
            `
          }}
        />
      )}
    </>
  )
}

export default PageClient
