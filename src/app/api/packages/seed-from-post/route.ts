import { NextRequest, NextResponse } from 'next/server'
import { getMeUser } from '@/utilities/getMeUser'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { z } from 'zod'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateObject } from 'ai'

const googleAI = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || '',
})

function extractLexicalFirstText(content: any): string {
  const t = content?.root?.children?.[0]?.children?.[0]?.text
  return typeof t === 'string' ? t.trim() : ''
}

export async function POST(req: NextRequest) {
  const { user } = await getMeUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (user as any).role
  const roleArray = Array.isArray(role) ? role : role ? [role] : []
  if (!roleArray.includes('admin') && !roleArray.includes('host')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: any = {}
  try {
    body = await req.json()
  } catch {}

  const postId = typeof body?.postId === 'string' ? body.postId.trim() : ''
  if (!postId) return NextResponse.json({ error: 'postId is required' }, { status: 400 })

  const payload = await getPayload({ config: configPromise })

  // If the post already has at least one package, do not auto-seed another.
  const existing = await payload.find({
    collection: 'packages',
    where: { post: { equals: postId } },
    limit: 1,
    depth: 0,
    user,
  })
  if (existing?.docs?.[0]) {
    return NextResponse.json({ success: true, packageId: existing.docs[0].id, alreadyExisted: true })
  }

  const post = await payload.findByID({ collection: 'posts', id: postId, depth: 1, user })
  const title = typeof (post as any)?.title === 'string' ? (post as any).title.trim() : ''
  const description =
    typeof (post as any)?.meta?.description === 'string'
      ? (post as any).meta.description.trim()
      : extractLexicalFirstText((post as any)?.content)

  const schema = z.object({
    name: z.string().min(3).max(80),
    description: z.string().min(10).max(240),
  })

  const modelName = process.env.GEMINI_STREAMING_MODEL || 'models/gemini-2.5-flash'
  const result = await generateObject({
    model: googleAI(modelName),
    schema,
    prompt: `You are writing guest-facing marketing copy for a booking package that will appear on a property listing.

Property title: "${title || 'Untitled property'}"
Property description: "${description || 'No description provided'}"

Generate a package name and a package description that match this specific property.

Rules:
- Make it specific to the property; avoid generic titles like "Standard Package".
- name: short, guest-friendly, optionally one emoji at the start.
- description: 1-2 sentences, concrete and compelling.
`,
  })

  const seeded = await payload.create({
    collection: 'packages',
    user,
    data: {
      post: postId,
      name: result.object.name,
      description: result.object.description,
      // Mark as draft-ish: host can enable later; avoids accidental sales.
      isEnabled: false,
      // Keep other fields minimal; collection has safe defaults.
      category: 'standard',
      entitlement: 'standard',
      minNights: 1,
      maxNights: 7,
      multiplier: 1,
      features: [],
    },
  })

  return NextResponse.json({
    success: true,
    packageId: seeded.id,
    alreadyExisted: false,
    name: seeded.name,
    description: seeded.description,
  })
}

