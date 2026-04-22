# Google AI Studio (Gemini) Token Usage Analysis

## Executive Summary

This document analyzes how the application implements and tracks Google AI Studio (Gemini) token usage across multiple AI assistant endpoints. The system uses two primary SDKs: `@google/generative-ai` for direct API calls and `@ai-sdk/google` for generative UI patterns with tool calling.

---

## Architecture Overview

### 1. **Dual SDK Implementation**

The application uses two different approaches to interact with Gemini:

#### A. Direct Google Generative AI SDK (`@google/generative-ai`)
- **Location**: `src/app/api/chat/route.ts`
- **Model**: `gemini-2.5-flash`
- **Use Case**: Traditional chat interactions, cleaning schedule optimization, package updates
- **Pattern**: Request/Response with manual token tracking

#### B. AI SDK with Google Provider (`@ai-sdk/google`)
- **Location**: `src/app/api/chat/manage/route.ts`
- **Model**: `gemini-2.0-flash-exp`
- **Use Case**: Generative UI with tool calling (package creation, property management)
- **Pattern**: Streaming responses with tool execution

---

## Token Tracking Implementation

### 2. **Token Serialization Function**

Located in `src/app/api/chat/route.ts` (lines 10-22):

```typescript
const serializeUsageMetadata = (usage: any) => {
  if (!usage) return undefined

  const safeNumber = (value: any) => 
    (typeof value === 'number' && Number.isFinite(value) ? value : null)

  return {
    total: safeNumber(usage.totalTokenCount),
    prompt: safeNumber(usage.promptTokenCount),
    candidates: safeNumber(usage.candidatesTokenCount),
    cached: safeNumber(usage.cachedContentTokenCount),
    thoughts: safeNumber(usage.thoughtsTokenCount),
  }
}
```

**Key Token Types Tracked:**
- **`totalTokenCount`**: Total tokens consumed (input + output)
- **`promptTokenCount`**: Tokens in the input prompt/system message
- **`candidatesTokenCount`**: Tokens in the generated response
- **`cachedContentTokenCount`**: Tokens from cached content (Gemini's caching feature)
- **`thoughtsTokenCount`**: Tokens used for reasoning/thinking (Gemini 2.0+ feature)

### 3. **Token Extraction Points**

#### A. Direct API Calls (`/api/chat`)
After each API call, tokens are extracted from `response.usageMetadata`:

```typescript
const result = await chat.sendMessage(messageText)
const response = await result.response
const text = response.text()
const usage = serializeUsageMetadata(response.usageMetadata)
return NextResponse.json({ message: text, usage })
```

**Token Usage Scenarios:**
1. **General Chat** (line 1024): Basic user queries
2. **Package Updates** (line 348): Context-aware package modification
3. **Cleaning Schedule** (line 660): Complex multi-property analysis
4. **Manage Context** (line 929): MCP-enabled package management

#### B. Streaming API Calls (`/api/chat/manage`)
The AI SDK handles token tracking internally through the `streamText` function. Token usage is included in the streaming response metadata.

---

## Token Consumption Patterns

### 4. **Context Size Impact**

The application builds extensive context payloads that significantly impact token consumption:

#### A. Booking Context (lines 192-244)
- User bookings history
- Estimates data
- Available packages (up to 100 packages)
- Property details
- Customer entitlement levels

**Estimated Token Impact**: ~500-2000 tokens per request depending on data volume

#### B. Cleaning Schedule Context (lines 394-549)
- All upcoming bookings (up to 200)
- Property details with sleep capacity
- Next booking relationships
- Same-day checkout/checkin analysis
- Proximity categories

**Estimated Token Impact**: ~2000-5000 tokens per request (largest context)

#### C. Package Management Context (lines 604-616)
- Existing packages list
- Package statistics
- Property details
- System prompts with tool definitions

**Estimated Token Impact**: ~1000-3000 tokens per request

### 5. **System Prompt Engineering**

Large system prompts are used to guide model behavior:

#### Example: Package Management Prompt (lines 618-705)
- **Length**: ~87 lines of instructions
- **Contains**: Tool calling rules, CRUD guidelines, category definitions
- **Token Estimate**: ~500-800 tokens per request

#### Example: Cleaning Schedule Prompt (lines 550-637)
- **Length**: ~87 lines with booking data
- **Contains**: Booking details, time windows, proximity analysis
- **Token Estimate**: ~1000-2000 tokens per request

---

## Frontend Token Tracking

### 6. **Client-Side Token Persistence**

Located in `src/components/AIAssistant/AIAssistant.tsx`:

```typescript
const normalizeTokenUsage = (usage: any): TokenUsageDetails | null => {
  if (!usage || typeof usage !== 'object') return null
  const normalize = (v: any) => 
    (typeof v === 'number' && Number.isFinite(v) ? v : null)
  return {
    total: normalize(usage.total),
    prompt: normalize(usage.prompt),
    candidates: normalize(usage.candidates),
    cached: normalize(usage.cached),
    thoughts: normalize(usage.thoughts),
    timestamp: Date.now(),
  }
}

const persistTokenUsage = (usage: TokenUsageDetails | null) => {
  if (!usage || typeof window === 'undefined') return
  window.localStorage.setItem('ai:lastTokenUsage', JSON.stringify(usage))
  window.dispatchEvent(new CustomEvent('aiTokenUsage', { detail: usage }))
}
```

**Features:**
- Normalizes token data from API responses
- Stores in `localStorage` for persistence
- Dispatches custom events for cross-component communication
- Used in notifications dashboard (`src/app/(frontend)/notifications/page.client.tsx`)

### 7. **Token Display in UI**

#### A. AIAssistant Component (lines 272-273)
```typescript
<p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1 font-medium">
  {subscriptionPlan} Member • {lastUsage?.total || 0} tokens used
</p>
```

#### B. Notifications Dashboard (lines 163-184)
- Displays token balance from localStorage
- Calculates monthly token change
- Shows token usage in notification metadata

---

## Model Selection Strategy

### 8. **Model Variants Used**

| Endpoint | Model | Use Case | Token Efficiency |
|----------|-------|----------|-----------------|
| `/api/chat` | `gemini-2.5-flash` | General chat, cleaning schedules | Balanced speed/cost |
| `/api/chat/manage` | `gemini-2.0-flash-exp` | Tool calling, package creation | Optimized for tools |
| `/api/packages/suggest` | `gemini-2.5-flash` | Package suggestions | Fast inference |
| `/api/tracking-insights/chat` | `gemini-2.0-flash-exp` | Analytics insights | Tool-enabled |

**Rationale:**
- **Flash models**: Faster, lower cost, sufficient for most tasks
- **Experimental models**: Used for advanced features (tool calling, reasoning)

---

## Token Optimization Strategies

### 9. **Implemented Optimizations**

#### A. Context Truncation
- Property content limited to 2000 characters (line 199)
- Package lists limited to 100 items (line 173)
- Booking history sorted by recency (line 157)

#### B. Selective Data Inclusion
- Only includes relevant context based on request type
- Filters disabled packages when not needed
- Omits unnecessary relationship data

#### C. Caching Opportunities
- Gemini's `cachedContentTokenCount` suggests caching is enabled
- System prompts could be cached (currently regenerated each request)
- Property details could be cached per session

### 10. **Potential Optimizations**

#### A. System Prompt Caching
**Current**: System prompts rebuilt every request (~500-800 tokens)
**Optimization**: Cache system prompts, only update dynamic data

#### B. Incremental Context Loading
**Current**: Loads all bookings/packages upfront
**Optimization**: Load context incrementally based on query intent

#### C. Response Streaming
**Current**: Full response before token count
**Optimization**: Stream responses, track tokens incrementally

---

## Token Usage Monitoring

### 11. **Tracking Points**

1. **API Response Level**: Every `/api/chat` response includes `usage` object
2. **Client Storage**: Token usage persisted in localStorage
3. **Event System**: Custom events broadcast token updates
4. **Dashboard Display**: Notifications page shows token metrics

### 12. **Token Cost Estimation**

Based on Gemini pricing (as of 2024):
- **Input tokens**: ~$0.075 per 1M tokens
- **Output tokens**: ~$0.30 per 1M tokens

**Example Request Breakdown:**
- System prompt: ~600 tokens (input)
- User message: ~50 tokens (input)
- Context data: ~1000 tokens (input)
- Response: ~200 tokens (output)
- **Total**: ~1850 tokens ≈ **$0.0002 per request**

**High-Volume Scenarios:**
- Cleaning schedule: ~5000 tokens ≈ **$0.0005 per request**
- Package management: ~3000 tokens ≈ **$0.0003 per request**

---

## Error Handling & Token Tracking

### 13. **Token Tracking in Error Cases**

The `serializeUsageMetadata` function safely handles:
- Missing usage metadata (`if (!usage) return undefined`)
- Invalid number types (`safeNumber` function)
- NaN/Infinity values (filtered out)

**Result**: Token tracking never breaks the application, gracefully degrades to `null` values.

---

## Integration Patterns

### 14. **How Components Use Token Data**

#### A. PageAIAssistant Component
- Receives `usage` from API responses
- Displays loading states during token consumption
- No direct token display (focused on UX)

#### B. AIAssistant Component
- Tracks `lastUsage` state
- Displays token count in header
- Persists to localStorage
- Broadcasts via events

#### C. Notifications Dashboard
- Reads from localStorage
- Calculates monthly token change
- Shows in user stats

---

## Best Practices Observed

### 15. **Token Management Best Practices**

✅ **Implemented:**
- Safe number normalization
- Graceful error handling
- Client-side persistence
- Cross-component event system

✅ **Model Selection:**
- Using Flash models for cost efficiency
- Experimental models only when needed

⚠️ **Areas for Improvement:**
- System prompt caching
- Context size optimization
- Token usage analytics/alerting
- Rate limiting based on token consumption

---

## Conclusion

The application implements comprehensive token tracking across multiple endpoints, with careful attention to:
1. **Accurate tracking** via `serializeUsageMetadata`
2. **Client persistence** for user visibility
3. **Cost optimization** through model selection
4. **Error resilience** in token handling

The dual SDK approach (direct API vs AI SDK) provides flexibility but requires maintaining two token tracking patterns. Future improvements should focus on caching system prompts and optimizing context payload sizes.

---

## Appendix: Token Usage Flow Diagram

```
User Request
    ↓
[PageAIAssistant] → POST /api/chat/manage
    ↓
[AI SDK] → streamText() → Gemini API
    ↓
[Gemini] → Processes request → Returns tokens in metadata
    ↓
[serializeUsageMetadata] → Normalizes token data
    ↓
[Response] → { usage: { total, prompt, candidates, cached, thoughts } }
    ↓
[Frontend] → normalizeTokenUsage() → persistTokenUsage()
    ↓
[localStorage] → Stored for dashboard display
    ↓
[Notifications] → Displays token metrics
```

---

**Document Version**: 1.0  
**Last Updated**: 2024  
**Author**: AI Analysis




