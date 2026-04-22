import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { yocoService } from '@/lib/yocoService'

export async function GET(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    const searchParams = request.nextUrl.searchParams
    const limit = parseInt(searchParams.get('limit') || '4', 10)

    // Get posts that have addon packages
    const postsWithAddons = await payload.find({
      collection: 'posts',
      where: {
        _status: {
          equals: 'published',
        },
      },
      limit: 10,
      depth: 1,
    })

    // Get all addon packages from these posts
    const allAddons: any[] = []
    
    for (const post of postsWithAddons.docs) {
      try {
        const dbPackages = await payload.find({
          collection: 'packages',
          where: {
            post: { equals: post.id },
            isEnabled: { equals: true },
            category: { equals: 'addon' },
          },
          limit: 2,
          depth: 1,
        })

        dbPackages.docs.forEach((pkg: any) => {
          allAddons.push({
            id: pkg.id,
            name: pkg.name,
            description: pkg.description,
            baseRate: pkg.baseRate,
            postTitle: (typeof post.title === 'string' ? post.title : (post.title as any)?.value) || 'Untitled',
            postId: post.id,
            image: typeof post.meta?.image === 'object' ? post.meta.image?.url : null,
          })
        })
      } catch (error) {
        // Continue if post doesn't have packages
        continue
      }
    }

    // Also get Yoco addon products
    try {
      const yocoProducts = await yocoService.getProducts()
      const yocoAddons = yocoProducts
        .filter((product) => product.category === 'addon' && product.isEnabled)
        .slice(0, 2)
        .map((product) => ({
          id: product.id,
          name: product.title,
          description: product.description,
          baseRate: product.price,
          postTitle: 'Yoco Addon',
          postId: null,
          image: null,
        }))

      allAddons.push(...yocoAddons)
    } catch (error) {
      console.error('Error fetching Yoco products:', error)
    }

    // Shuffle and limit
    const shuffled = allAddons.sort(() => Math.random() - 0.5)
    const limited = shuffled.slice(0, limit)

    return NextResponse.json({
      addons: limited,
      total: limited.length,
    })
  } catch (error) {
    console.error('Error fetching sample addon packages:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sample addon packages', addons: [] },
      { status: 500 }
    )
  }
}

