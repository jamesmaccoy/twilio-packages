import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

export async function POST(req: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })
    
    // Get the authenticated user from the request
    const { user } = await payload.auth({ headers: req.headers })
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Only allow admins to run migrations
    const userRoles = user.role || []
    if (!userRoles.includes('admin')) {
      return NextResponse.json(
        { error: 'Only administrators can run migrations' },
        { status: 403 }
      )
    }

    console.log('Starting content migration...')

    // Get all posts
    const posts = await payload.find({
      collection: 'posts',
      limit: 1000, // Adjust as needed
      depth: 0,
    })

    const migratedPosts = []
    const errors = []

    for (const post of posts.docs) {
      try {
        if (post.content && post.content.root) {
          // Fix any nodes that might have undefined types
          const fixNodeTypes = (node: any): any => {
            if (typeof node === 'object' && node !== null) {
              // Ensure text nodes have type
              if (node.text !== undefined && !node.type) {
                node.type = "text"
                console.log(`Fixed missing type for text node in post ${post.id}`)
              }
              
              // Ensure paragraph nodes have type
              if (node.children && Array.isArray(node.children) && !node.type) {
                node.type = "paragraph"
                console.log(`Fixed missing type for paragraph node in post ${post.id}`)
              }
              
              // Recursively process children
              if (Array.isArray(node.children)) {
                node.children = node.children.map(fixNodeTypes)
              }
            }
            return node
          }

          const fixedContent = {
            root: fixNodeTypes(post.content.root)
          }

          // Only update if content was actually changed
          const originalContent = JSON.stringify(post.content)
          const fixedContentStr = JSON.stringify(fixedContent)
          
          if (originalContent !== fixedContentStr) {
            await payload.update({
              collection: 'posts',
              id: post.id,
              data: {
                content: fixedContent
              },
              user,
            })

            migratedPosts.push({
              id: post.id,
              title: post.title,
              status: 'migrated'
            })
            console.log(`Migrated content for post: ${post.title} (${post.id})`)
          } else {
            migratedPosts.push({
              id: post.id,
              title: post.title,
              status: 'no_changes_needed'
            })
          }
        } else {
          migratedPosts.push({
            id: post.id,
            title: post.title,
            status: 'no_content'
          })
        }
      } catch (error) {
        console.error(`Error migrating post ${post.id}:`, error)
        errors.push({
          id: post.id,
          title: post.title,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    const migratedCount = migratedPosts.filter(p => p.status === 'migrated').length
    const noChangesCount = migratedPosts.filter(p => p.status === 'no_changes_needed').length
    const noContentCount = migratedPosts.filter(p => p.status === 'no_content').length

    console.log('Content migration completed')
    console.log(`Migrated: ${migratedCount}, No changes needed: ${noChangesCount}, No content: ${noContentCount}, Errors: ${errors.length}`)

    return NextResponse.json({
      message: 'Content migration completed',
      summary: {
        total: posts.docs.length,
        migrated: migratedCount,
        noChangesNeeded: noChangesCount,
        noContent: noContentCount,
        errors: errors.length
      },
      details: migratedPosts,
      errors: errors
    })
  } catch (error: any) {
    console.error('Error in content migration:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to migrate content' },
      { status: 500 }
    )
  }
} 