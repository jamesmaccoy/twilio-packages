import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')
    const title = searchParams.get('title')
    
    if (!slug && !title) {
      return NextResponse.json({ error: 'slug or title parameter is required' }, { status: 400 })
    }

    const payload = await getPayload({ config: configPromise })
    
    const where: any = {}
    
    if (slug) {
      where.slug = { equals: slug }
    }
    
    if (title) {
      where.title = { contains: title }
    }
    
    const posts = await payload.find({
      collection: 'posts',
      where,
      limit: 10,
      select: {
        id: true,
        title: true,
        slug: true,
      },
    })
    
    return NextResponse.json({ docs: posts.docs })
  } catch (error) {
    console.error('Error searching posts:', error)
    return NextResponse.json(
      { error: 'Failed to search posts' },
      { status: 500 }
    )
  }
}

