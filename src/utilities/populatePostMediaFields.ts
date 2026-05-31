import type { Media, Post } from '@/payload-types'
import type { Payload } from 'payload'

type PostMediaFields = {
  heroImage?: Post['heroImage']
  meta?: Post['meta'] | null
}

function mediaIdFromPost(post: PostMediaFields): string | null {
  if (typeof post.heroImage === 'string' && post.heroImage.length > 0) {
    return post.heroImage
  }
  if (typeof post.meta?.image === 'string' && post.meta.image.length > 0) {
    return post.meta.image
  }
  return null
}

function hasPopulatedMedia(post: PostMediaFields): boolean {
  return typeof post.heroImage === 'object' && post.heroImage !== null
}

/** Populate heroImage + meta.image when they are still relationship IDs. */
export async function populatePostMediaFields(
  payload: Payload,
  post: PostMediaFields,
): Promise<PostMediaFields> {
  if (hasPopulatedMedia(post)) return post

  const mediaId = mediaIdFromPost(post)
  if (!mediaId) return post

  try {
    const media = (await payload.findByID({
      collection: 'media',
      id: mediaId,
      depth: 0,
      overrideAccess: true,
    })) as Media

    return {
      ...post,
      heroImage: media,
      meta: {
        ...(typeof post.meta === 'object' && post.meta ? post.meta : {}),
        image: media,
      },
    }
  } catch {
    return post
  }
}

/** Populate media on related post docs returned as shallow relationship objects. */
export async function populateRelatedPostsMedia(
  payload: Payload,
  relatedPosts: Post['relatedPosts'],
): Promise<Post['relatedPosts']> {
  if (!Array.isArray(relatedPosts) || relatedPosts.length === 0) {
    return relatedPosts
  }

  const populated = await Promise.all(
    relatedPosts.map(async (relatedPost) => {
      if (!relatedPost || typeof relatedPost !== 'object') return relatedPost
      return populatePostMediaFields(payload, relatedPost)
    }),
  )

  return populated as Post['relatedPosts']
}
