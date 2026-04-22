import { streamText, tool } from 'ai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'
import { getMeUser } from '@/utilities/getMeUser'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

/**
 * Generative UI chat endpoint for tracking insights
 * Uses AI SDK tools pattern to analyze tracking data and provide recommendations
 */
export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json()
    const { user } = await getMeUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch tracking insights data
    const insightsResponse = await fetch(`${request.nextUrl.origin}/api/tracking-insights`, {
      headers: request.headers
    })
    const insightsData = await insightsResponse.json()

    // Create tools for analyzing tracking data
    const analyzeBookingPatternsTool = tool({
      description: 'Analyze user booking patterns and provide insights',
      parameters: {
        type: 'object',
        properties: {
          focus: {
            type: 'string',
            enum: ['frequency', 'value', 'properties', 'addons'],
            description: 'What aspect of booking patterns to analyze'
          }
        },
        required: ['focus']
      },
      execute: async ({ focus }) => {
        const stats = insightsData.stats
        const bookings = stats.bookings
        
        switch (focus) {
          case 'frequency':
            return {
              analysis: bookings.bookingFrequency?.isRegularCustomer
                ? `You're a regular customer, booking every ${bookings.bookingFrequency.averageDaysBetweenBookings} days on average.`
                : `You book occasionally. Consider booking more frequently to unlock special offers.`,
              recommendation: bookings.bookingFrequency?.isRegularCustomer
                ? 'As a regular customer, you may be eligible for loyalty discounts.'
                : 'Try booking your next stay within 30 days to become a regular customer.'
            }
          case 'value':
            return {
              analysis: `Your average booking value is R${bookings.averageBookingValue.toFixed(2)}.`,
              recommendation: bookings.averageBookingValue < 1000
                ? 'Consider upgrading to premium packages for a better experience.'
                : 'You consistently book high-value stays. Premium addons would enhance your experience.'
            }
          case 'properties':
            return {
              analysis: `You've booked ${bookings.favoriteProperties.length} different properties.`,
              topProperty: bookings.favoriteProperties[0] || null,
              recommendation: bookings.favoriteProperties.length === 1
                ? 'Try exploring new properties to discover different experiences.'
                : 'You enjoy variety! Consider our curated property collections.'
            }
          case 'addons':
            return {
              analysis: `You've purchased ${stats.addons.totalAddonsPurchased} addons across ${stats.bookings.totalBookings} bookings.`,
              purchaseRate: stats.addons.addonPurchaseRate,
              recommendation: stats.addons.addonPurchaseRate > 50
                ? 'You love addons! Check out our new premium addon packages.'
                : 'Addons can enhance your stay. Consider adding checkin service or premium amenities.'
            }
          default:
            return { analysis: 'No specific analysis available.' }
        }
      }
    })

    const analyzeConversionTool = tool({
      description: 'Analyze estimate to booking conversion rate',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      },
      execute: async () => {
        const stats = insightsData.stats
        const conversionRate = stats.estimates.conversionRate
        
        return {
          conversionRate: `${conversionRate.toFixed(1)}%`,
          analysis: conversionRate > 50
            ? 'You have a high conversion rate from estimates to bookings.'
            : conversionRate > 25
            ? 'You convert estimates to bookings at a moderate rate.'
            : 'You create many estimates but convert fewer to bookings.',
          recommendation: conversionRate < 50
            ? 'Consider booking sooner to secure your preferred dates and packages.'
            : 'Great job converting estimates to bookings! Keep it up.'
        }
      }
    })

    const recommendAddonsTool = tool({
      description: 'Recommend addons based on user preferences and booking history',
      parameters: {
        type: 'object',
        properties: {
          bookingId: {
            type: 'string',
            description: 'Optional: Specific booking ID to recommend addons for'
          }
        },
        required: []
      },
      execute: async ({ bookingId }) => {
        const stats = insightsData.stats
        const popularAddons = stats.addons.popularAddons
        
        return {
          recommendations: popularAddons.length > 0
            ? popularAddons.map((addon: any) => ({
                name: addon.name,
                reason: `You've purchased this ${addon.count} time(s) before`,
                value: addon.totalValue
              }))
            : [
                {
                  name: 'Checkin Service',
                  reason: 'Popular with most guests',
                  value: 2600
                },
                {
                  name: 'Premium Amenities',
                  reason: 'Enhances your stay experience',
                  value: 500
                }
              ],
          message: popularAddons.length > 0
            ? 'Based on your history, you might enjoy these addons again.'
            : 'These addons are popular and would enhance your stay.'
        }
      }
    })

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

    const result = streamText({
      model: model as any, // Gemini model adapter
      system: `You are a helpful assistant that analyzes user tracking data and provides personalized insights and recommendations for bookings, addons, and property preferences.

Current user stats:
- Total bookings: ${insightsData.stats.bookings.totalBookings}
- Total spent: R${insightsData.stats.bookings.totalSpent.toFixed(2)}
- Average booking value: R${insightsData.stats.bookings.averageBookingValue.toFixed(2)}
- Addons purchased: ${insightsData.stats.addons.totalAddonsPurchased}
- Conversion rate: ${insightsData.stats.estimates.conversionRate.toFixed(1)}%
- Engagement score: ${insightsData.stats.engagementScore}/100

Provide actionable, personalized recommendations based on the user's behavior patterns. Be concise and helpful.`,
      messages: messages || [],
      tools: {
        analyzeBookingPatterns: analyzeBookingPatternsTool,
        analyzeConversion: analyzeConversionTool,
        recommendAddons: recommendAddonsTool
      },
      maxSteps: 5
    })

    return result.toDataStreamResponse()
  } catch (error) {
    console.error('Error in tracking insights chat:', error)
    return NextResponse.json(
      { error: 'Failed to generate insights', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

