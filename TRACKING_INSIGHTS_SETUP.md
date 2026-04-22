# Tracking Insights with Generative UI

## Overview

A generative UI system that leverages your existing Meta Pixel and Google Ads tracking data to provide AI-powered insights and recommendations. Built using AI SDK's generative UI patterns, this system analyzes user behavior patterns and provides actionable feedback.

## What's Implemented

### 1. Tracking Data Aggregation API (`/api/tracking-insights`)

Aggregates user tracking data including:
- **Booking Statistics**: Total bookings, spending, average booking value, favorite properties
- **Conversion Metrics**: Estimate to booking conversion rate
- **Addon Preferences**: Popular addons, purchase rates
- **Engagement Score**: Calculated score based on booking frequency, addon purchases, and conversion rate

**Example Response:**
```json
{
  "stats": {
    "bookings": {
      "totalBookings": 5,
      "upcomingBookings": 2,
      "totalSpent": 12500,
      "averageBookingValue": 2500,
      "addonPurchases": 8,
      "favoriteProperties": [...],
      "bookingFrequency": {
        "averageDaysBetweenBookings": 45,
        "isRegularCustomer": true
      }
    },
    "estimates": {
      "totalEstimates": 10,
      "convertedToBookings": 5,
      "conversionRate": 50
    },
    "addons": {
      "totalAddonsPurchased": 8,
      "addonPurchaseRate": 80,
      "popularAddons": [...]
    },
    "engagementScore": 75
  }
}
```

### 2. AI-Powered Chat API (`/api/tracking-insights/chat`)

Generative UI chat endpoint that uses AI SDK tools to:
- **Analyze Booking Patterns**: Frequency, value, property preferences, addon usage
- **Analyze Conversion Rates**: Estimate to booking conversion insights
- **Recommend Addons**: Personalized addon recommendations based on history

**Tools Available:**
- `analyzeBookingPatterns` - Analyzes booking frequency, value, properties, or addons
- `analyzeConversion` - Analyzes estimate to booking conversion rate
- `recommendAddons` - Provides personalized addon recommendations

### 3. TrackingInsights Component

A React component that displays:
- **Stats Overview**: Key metrics in card format
- **Key Insights**: Conversion rate, addon engagement, booking frequency
- **Generative UI Chat**: Interactive AI assistant for personalized recommendations

**Features:**
- Real-time insights from tracking data
- AI-powered recommendations using tool calls
- Visual indicators (trending up/down, badges)
- Expandable chat interface

## Usage

### Basic Integration

Add the TrackingInsights component to your bookings page:

```tsx
import SuggestedPackages from '@/components/Bookings/SuggestedPackages'

// In your component
<SuggestedPackages userId={user.id} showInsights={true} />
```

### Standalone Usage

Use TrackingInsights independently:

```tsx
import TrackingInsights from '@/components/Bookings/TrackingInsights'

<TrackingInsights userId={user.id} />
```

### Using the Chat API Directly

```tsx
import { useChat } from '@ai-sdk/react'

const { messages, input, handleInputChange, handleSubmit } = useChat({
  api: '/api/tracking-insights/chat',
})

// The chat automatically has access to:
// - analyzeBookingPatterns tool
// - analyzeConversion tool  
// - recommendAddons tool
```

## How It Works

### 1. Data Collection

The system leverages existing tracking:
- **Meta Pixel Events**: ViewContent, Purchase, EstimateView
- **Google Ads Events**: view_item, purchase, estimate_view
- **Database Records**: Bookings, Estimates, Addon Transactions

### 2. Data Analysis

The `/api/tracking-insights` endpoint:
- Queries user's bookings and estimates
- Calculates conversion rates
- Identifies patterns (favorite properties, addon preferences)
- Computes engagement scores

### 3. AI-Powered Insights

The chat API uses AI SDK's tool calling:
- User asks a question
- AI decides which tool to use
- Tool executes and returns structured data
- AI formats response with recommendations
- UI renders tool results as components

### 4. Generative UI Rendering

Following AI SDK patterns:
- Text responses render normally
- Tool calls render as specialized components:
  - `recommendAddons` → Addon recommendation cards
  - `analyzeBookingPatterns` → Pattern analysis cards
  - `analyzeConversion` → Conversion metrics

## Example Interactions

### User: "What are my booking patterns?"

**AI Response:**
- Calls `analyzeBookingPatterns` tool with `focus: 'frequency'`
- Returns: "You're a regular customer, booking every 45 days on average."
- Recommendation: "As a regular customer, you may be eligible for loyalty discounts."

### User: "What addons should I get?"

**AI Response:**
- Calls `recommendAddons` tool
- Returns personalized recommendations based on purchase history
- Renders as addon cards with reasons and prices

### User: "How's my conversion rate?"

**AI Response:**
- Calls `analyzeConversion` tool
- Returns conversion rate with analysis and recommendations

## Integration with Existing Tracking

This system leverages tracking already set up:

### Meta Pixel Events
- `ViewContent` - When addons are viewed (in SuggestedPackages)
- `Purchase` - When bookings are created
- `EstimateView` - When estimates are viewed

### Google Ads Events
- `view_item` - When addons are viewed
- `purchase` - When bookings are created
- `estimate_view` - When estimates are viewed

All tracking data flows into the insights system automatically.

## Benefits

1. **Personalized Recommendations**: Based on actual user behavior
2. **Actionable Insights**: Clear recommendations for improving engagement
3. **Generative UI**: Dynamic, context-aware responses
4. **Leverages Existing Data**: Uses tracking already in place
5. **AI-Powered**: Natural language interaction with structured data

## Future Enhancements

Potential additions:
- Real-time tracking event analysis
- Predictive recommendations (when to book next)
- A/B testing insights
- Cohort analysis
- Revenue projections
- Churn prediction

## Technical Details

### Dependencies
- `@ai-sdk/react` - For useChat hook and generative UI
- `@google/generative-ai` - For Gemini model
- Existing Payload CMS - For data queries

### API Routes
- `GET /api/tracking-insights` - Aggregates tracking data
- `POST /api/tracking-insights/chat` - AI chat with tools

### Components
- `TrackingInsights` - Main insights component
- Integrated into `SuggestedPackages` (optional)

## Testing

1. **Test Insights API**:
   ```bash
   curl http://localhost:3000/api/tracking-insights
   ```

2. **Test Chat API**:
   ```bash
   curl -X POST http://localhost:3000/api/tracking-insights/chat \
     -H "Content-Type: application/json" \
     -d '{"messages": [{"role": "user", "content": "What are my booking patterns?"}]}'
   ```

3. **Test Component**:
   - Add `showInsights={true}` to SuggestedPackages
   - Visit `/bookings` page
   - View insights and interact with AI chat

## Notes

- Insights require user authentication
- Data is aggregated in real-time from database
- AI tools provide structured responses for better UI rendering
- Chat uses streaming for responsive UX
- All tracking data respects user privacy (hashed PII)

