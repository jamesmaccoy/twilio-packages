import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { BASE_PACKAGE_TEMPLATES, getDefaultPackageTitle } from '@/lib/package-types'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(request: NextRequest) {
	try {
		const { description, postId, baseRate, hostContext } = await request.json()
		const text = String(description || '').trim()
		if (!text) {
			return NextResponse.json({ recommendations: [] })
		}

		const payload = await getPayload({ config: configPromise })

		// Authenticate optionally; only require host/admin when hostContext is true
		let user: any = null
		try {
			const authResult = await payload.auth({ headers: request.headers })
			user = authResult.user
		} catch {}

		if (hostContext) {
			if (!user) {
				return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
			}
			const role: string[] = Array.isArray(user.role) ? user.role : [user.role].filter(Boolean)
			const isHostOrAdmin = role.includes('host') || role.includes('admin')
			if (!isHostOrAdmin) {
				return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
			}
		}

		// Optionally load post details
		let postTitle = ''
		let postDescription = ''
		if (postId) {
			try {
				const post = await payload.findByID({ collection: 'posts', id: String(postId), depth: 1 })
				postTitle = post?.title || ''
				postDescription = post?.meta?.description || ''
			} catch (e) {}
		}

		const knownTemplates = BASE_PACKAGE_TEMPLATES.map(t => ({
			revenueCatId: t.revenueCatId,
			defaultName: getDefaultPackageTitle(t),
			category: t.category,
			durationTier: t.durationTier,
			minNights: t.minNights,
			maxNights: t.maxNights,
			customerTierRequired: t.customerTierRequired,
			baseMultiplier: t.baseMultiplier,
			features: t.features.map(f => f.label).join(', ')
		}))

		const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
		const prompt = `You are helping a host choose booking packages from a fixed catalog.\n${hostContext ? 'The requester is a host or admin.' : ''}
${postTitle || postDescription || baseRate ? `\nPROPERTY CONTEXT:\n- Title: ${postTitle || 'N/A'}\n- Description: ${postDescription || 'N/A'}\n- Base rate: ${baseRate ? `R${baseRate}/night` : 'Unknown'}\n` : ''}
Here is the catalog of packages (id = revenueCatId):
${knownTemplates.map(t => `- ${t.revenueCatId}: ${t.defaultName} [${t.category}, ${t.durationTier}, ${t.minNights}-${t.maxNights} nights, requires ${t.customerTierRequired}, multiplier: ${t.baseMultiplier}, features: ${t.features}]`).join('\n')}

User description: "${text}"

Return ONLY a compact JSON object with the shape:
{
             "recommendations": [
             {
               "revenueCatId": "string",
               "suggestedName": "string", 
               "description": "string",
               "features": ["string"],
               "baseRate": number,
               "details": {
                 "minNights": number,
                 "maxNights": number,
                 "multiplier": number,
                 "category": "string",
                 "customerTierRequired": "string",
                 "features": "string"
               }
             }
           ]
}

Rules:
- Choose 1-4 packages that best match the description and duration hints (e.g. hourly,daily, weekly, monthly, annual, 3 nights, 7 nights, 14 nights, 30 nights, Allunslusive, Studio hire,  hosted, luxury, add-on).
- For suggestedName, create a contextual name based on the property and description (e.g. "Game Safari Lodge 3-Night Special", "Luxury Hourly Retreat", "Team Building Gathering").
- For description, provide a detailed explanation of what this package offers, including amenities, services, and unique selling points.
- For features, provide an array of 3-5 key features that highlight the package's benefits (e.g. ["Luxury accommodation", "Concierge service", "Premium amenities", "Flexible check-in", "Local experience"]).
- For baseRate, suggest appropriate pricing based on the package type and property context. For addon packages, suggest reasonable one-time fees (e.g., cleaning: 200-500, wine: 150-300, guided hike: 300-800, bath bomb: 50-150). For accommodation packages, use the property's base rate as a starting point.
- If the description mentions add-ons, extras, services, or one-time purchases (like cleaning, wine, guided tours, bath bombs, etc.), prioritize addon category packages.
- For addon packages, focus on service-based features like "Professional cleaning service", "Premium wine selection", "Guided hiking experience", "Luxury bath amenities".
- Prefer 'pro' tier items only if the description implies hosted/concierge/luxury/experiences.
- If unclear, include a safe default like per-night standard and weekly standard.
- If description implies gatherings, events, team offsites, or monthly workspace use, consider 'gathering_monthly' where appropriate.
- Do not include text outside JSON.`

		const result = await model.generateContent(prompt)
		const raw = result.response.text()

		let recommendations: any[] = []
		try {
			const jsonStart = raw.indexOf('{')
			const jsonEnd = raw.lastIndexOf('}')
			const jsonStr = jsonStart >= 0 ? raw.slice(jsonStart, jsonEnd + 1) : '{}'
			const parsed = JSON.parse(jsonStr)
			if (Array.isArray(parsed.recommendations)) {
				recommendations = parsed.recommendations.map((r: any) => ({
					revenueCatId: String(r.revenueCatId || ''),
					suggestedName: String(r.suggestedName || ''),
					description: String(r.description || ''),
					features: Array.isArray(r.features) ? r.features : [],
					baseRate: typeof r.baseRate === 'number' ? r.baseRate : undefined,
					details: r.details || {}
				}))
			}
		} catch {
			recommendations = []
		}

		// Filter to known templates and dedupe
		const knownIds = new Set(BASE_PACKAGE_TEMPLATES.map(t => t.revenueCatId))
		const validRecommendations = recommendations.filter((r) => knownIds.has(r.revenueCatId))
		const finalRecommendations = validRecommendations.length > 0 ? 
			Array.from(new Map(validRecommendations.map(r => [r.revenueCatId, r])).values()).slice(0, 4) : 
			[
				{
					revenueCatId: 'per_night',
					suggestedName: 'Standard Per Night',
					description: 'Basic overnight accommodation with essential amenities',
					features: ['Standard accommodation', 'Basic amenities', 'Self-service'],
					baseRate: baseRate || 150,
					details: BASE_PACKAGE_TEMPLATES.find(t => t.revenueCatId === 'per_night') || {}
				},
				{
					revenueCatId: 'Weekly',
					suggestedName: 'Weekly Stay',
					description: 'Extended weekly accommodation with enhanced comfort',
					features: ['Weekly accommodation', 'Enhanced amenities', 'Flexible check-in'],
					baseRate: (baseRate || 150) * 7,
					details: BASE_PACKAGE_TEMPLATES.find(t => t.revenueCatId === 'Weekly') || {}
				}
			].filter(r => knownIds.has(r.revenueCatId))

		return NextResponse.json({
			recommendations: finalRecommendations,
			...(postId ? { postId: String(postId) } : {}),
			...(hostContext && !postId
				? {
						hint: 'No property was selected. Choose a listing in Manage (sidebar) so new packages can be saved against that post, or use the AI assistant to create a package (a draft listing is created if needed).',
					}
				: {}),
		})
	} catch (error) {
		console.error('Suggest API error:', error)
		const errorMessage = error instanceof Error ? error.message : 'Unknown error'
		console.error('Error details:', errorMessage)
		console.error('Error stack:', error instanceof Error ? error.stack : undefined)
		return NextResponse.json({
			recommendations: [],
			error: errorMessage,
			details: error instanceof Error ? error.stack : undefined
		}, { status: 500 })
	}
} 