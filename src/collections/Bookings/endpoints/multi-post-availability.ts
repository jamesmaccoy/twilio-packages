import { Endpoint } from 'payload'

export const multiPostAvailability: Endpoint = {
  method: 'get',
  path: '/multi-post-availability',
  handler: async (req) => {
    const { postIds } = req.query

    if (!postIds) {
      return Response.json({ message: 'Post IDs are required' }, { status: 400 })
    }

    if (!req.user) {
      return Response.json({ message: 'Unauthorized' }, { status: 401 })
    }

    try {
      // Parse postIds - can be comma-separated string or array
      const postIdArray = Array.isArray(postIds) 
        ? postIds 
        : typeof postIds === 'string' 
        ? postIds.split(',').map(id => id.trim())
        : []

      if (postIdArray.length === 0) {
        return Response.json({ message: 'At least one post ID is required' }, { status: 400 })
      }

      // Fetch all bookings for all posts
      const bookings = await req.payload.find({
        collection: 'bookings',
        where: {
          post: {
            in: postIdArray,
          },
        },
        limit: 1000,
        select: {
          post: true,
          fromDate: true,
          toDate: true,
        },
        depth: 1,
      })

      // Group unavailable dates by post
      const unavailableByPost: Record<string, string[]> = {}
      
      // Initialize empty arrays for all posts
      postIdArray.forEach((postId: string) => {
        unavailableByPost[postId] = []
      })

      bookings.docs.forEach((booking) => {
        const postId = typeof booking.post === 'string' ? booking.post : booking.post?.id
        if (!postId || !postIdArray.includes(postId)) return

        const fromDate = new Date(booking.fromDate)
        const toDate = new Date(booking.toDate)
        
        const fromDateStr = fromDate.toISOString().split('T')[0]
        const toDateStr = toDate.toISOString().split('T')[0]
        
        const normalizedFromDate = new Date(fromDateStr + 'T00:00:00.000Z')
        const normalizedToDate = new Date(toDateStr + 'T00:00:00.000Z')

        const currentDate = new Date(normalizedFromDate)
        
        while (currentDate.getTime() < normalizedToDate.getTime()) {
          unavailableByPost[postId].push(currentDate.toISOString())
          currentDate.setUTCDate(currentDate.getUTCDate() + 1)
        }
      })

      // Find dates when ALL posts are available (intersection of available dates)
      // First, get all unique dates from all posts
      const allDates = new Set<string>()
      Object.values(unavailableByPost).forEach((dates) => {
        dates.forEach((date) => allDates.add(date))
      })

      // Find dates that are unavailable in ANY post
      const unavailableInAnyPost = new Set<string>()
      Object.values(unavailableByPost).forEach((dates) => {
        dates.forEach((date) => unavailableInAnyPost.add(date))
      })

      // Get post details for response
      const posts = await req.payload.find({
        collection: 'posts',
        where: {
          id: {
            in: postIdArray,
          },
        },
        select: {
          id: true,
          title: true,
          slug: true,
        },
        limit: 100,
      })

      const postDetails = posts.docs.map((post) => ({
        id: post.id,
        title: post.title,
        slug: post.slug,
        unavailableDates: unavailableByPost[post.id] || [],
      }))

      return Response.json({
        posts: postDetails,
        unavailableByPost,
        // Dates when at least one post is unavailable
        unavailableInAnyPost: Array.from(unavailableInAnyPost).sort(),
      })
    } catch (error) {
      console.error('Error fetching multi-post availability:', error)
      return Response.json({ message: 'Error fetching multi-post availability' }, { status: 500 })
    }
  },
}

