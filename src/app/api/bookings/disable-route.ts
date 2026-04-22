// app/api/bookings/route.ts
import { NextResponse } from 'next/server'
import { getPayload } from 'payload'
import { getMeUser } from '@/utilities/getMeUser'
import config from '@payload-config'
import type { Booking } from '@/payload-types'

export async function POST(req: Request) {
  try {
    const currentUser = await getMeUser()
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await getPayload({ config })
    const data = await req.json()
    
    const { postId, fromDate, toDate } = data

    console.log('Creating booking with data:', { postId, fromDate, toDate })

    if (!postId) {
      console.error('No postId provided in request')
      return NextResponse.json({ error: 'Post ID is required' }, { status: 400 })
    }

    // First, fetch the post to ensure it exists and get its data
    try {
      console.log('Attempting to fetch post with ID/slug:', postId)
      
      // Try to find the post by slug first
      const postBySlug = await payload.find({
        collection: 'posts',
        where: {
          slug: {
            equals: postId
          }
        },
        limit: 1
      })

      let post
      if (postBySlug.docs.length > 0) {
        post = postBySlug.docs[0]
        console.log('Found post by slug:', { id: post.id, title: post.title })
      } else {
        // If not found by slug, try by ID
        post = await payload.findByID({
          collection: 'posts',
          id: postId,
        })
      }

      if (!post) {
        console.error('Post not found:', postId)
        return NextResponse.json({ error: `Post with ID/slug ${postId} not found in database` }, { status: 404 })
      }

      console.log('Found post:', { id: post.id, title: post.title })

      // Create booking in Payload CMS with the post relationship
      console.log('Creating booking with post:', { postId: post.id, title: post.title })
      
      const booking = await payload.create({
        collection: "bookings",
        data: {
          title: post.title,
          post: post.id, // Use the actual post ID here
          fromDate,
          toDate,
          customer: currentUser.user.id,
          token: Math.random().toString(36).substring(2, 15),
          paymentStatus: 'unpaid'
        },
      })

      console.log('Created booking:', { id: booking.id })

      // Fetch the created booking with populated relationships
      const populatedBooking = await payload.findByID({
        collection: 'bookings',
        id: booking.id,
        depth: 2,
      })

      console.log('Fetched populated booking:', { id: populatedBooking.id })

      return NextResponse.json(populatedBooking)
    } catch (error) {
      console.error('Error in post/booking operation:', error)
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        postId: postId
      })
      return NextResponse.json(
        { error: `Error in post/booking operation: ${(error as Error).message}. PostId: ${postId}` },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error in booking creation:', error)
    return NextResponse.json(
      { error: 'Failed to create booking: ' + (error as Error).message },
      { status: 500 }
    )
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url!);
    const postId = url.searchParams.get('postId');
    if (!postId) {
      return NextResponse.json({ error: 'postId is required' }, { status: 400 });
    }
    const payload = await getPayload({ config });
    // Find all bookings for this post (future and past)
    const bookings = await payload.find({
      collection: 'bookings',
      where: {
        post: { equals: postId },
      },
      limit: 100,
      depth: 0,
      select: {
        fromDate: true,
        toDate: true,
      },
    });
    // Return only fromDate and toDate for each booking
    const result = bookings.docs.map(b => ({ fromDate: b.fromDate, toDate: b.toDate }));
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch bookings: ' + (error as Error).message }, { status: 500 });
  }
}