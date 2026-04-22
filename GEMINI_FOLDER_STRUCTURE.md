# Gemini Token Usage - Crucial Files & Folder Structure

## 📁 Project Structure Overview

```
yocogoogle/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/                    # 🎯 PRIMARY CHAT ENDPOINTS
│   │   │   │   ├── route.ts             # Direct Gemini API (gemini-2.5-flash)
│   │   │   │   └── manage/
│   │   │   │       └── route.ts         # AI SDK streaming (gemini-2.0-flash-exp)
│   │   │   ├── packages/
│   │   │   │   └── suggest/
│   │   │   │       └── route.ts         # Package suggestions (gemini-2.5-flash)
│   │   │   └── tracking-insights/
│   │   │       └── chat/
│   │   │           └── route.ts          # Analytics chat (gemini-2.0-flash-exp)
│   │   └── (frontend)/
│   │       └── notifications/
│   │           ├── page.tsx              # Server component
│   │           └── page.client.tsx      # Token display dashboard
│   ├── components/
│   │   └── AIAssistant/
│   │       ├── AIAssistant.tsx           # Floating chat widget
│   │       └── PageAIAssistant.tsx       # Full-page AI assistant
│   └── utilities/
│       └── getMeUser.ts                  # User authentication helper
├── package.json                          # Dependencies (@google/generative-ai, @ai-sdk/google)
└── GEMINI_TOKEN_USAGE_ANALYSIS.md        # This analysis document
```

---

## 🎯 Crucial Files Explained

### 1. **API Endpoints (Backend)**

#### 📄 `src/app/api/chat/route.ts` ⭐ PRIMARY
**Purpose**: Main chat endpoint using direct Google Generative AI SDK  
**Model**: `gemini-2.5-flash`  
**Key Functions**:
- `serializeUsageMetadata()` - **Token tracking core function** (lines 10-22)
- Handles multiple contexts: general chat, package updates, cleaning schedules
- Returns token usage in every response: `{ message, usage }`
- Token types tracked: total, prompt, candidates, cached, thoughts

**Token Tracking Flow**:
```typescript
const result = await chat.sendMessage(messageText)
const usage = serializeUsageMetadata(response.usageMetadata)
return NextResponse.json({ message: text, usage })
```

**Estimated Token Usage**: 500-5000 tokens per request (varies by context)

---

#### 📄 `src/app/api/chat/manage/route.ts` ⭐ GENERATIVE UI
**Purpose**: Streaming chat endpoint with tool calling for package management  
**Model**: `gemini-2.0-flash-exp`  
**Key Features**:
- Uses `@ai-sdk/google` provider
- Implements `streamText()` for real-time responses
- Tool calling: `previewPackage`, `createPackage`, `findPackages`, `updatePackage`, `deletePackage`
- Token tracking handled by AI SDK internally

**Tools Available**:
- `previewPackageTool` - Preview before creation
- `createPackageTool` - Create packages in database
- `findPackagesTool` - List/search packages
- `updatePackageTool` - Modify existing packages
- `deletePackageTool` - Remove packages
- `createPostTool` - Create properties

**Estimated Token Usage**: 1000-3000 tokens per request

---

#### 📄 `src/app/api/packages/suggest/route.ts`
**Purpose**: AI-powered package suggestions  
**Model**: `gemini-2.5-flash`  
**Key Features**:
- Analyzes user description
- Matches against package catalog
- Returns JSON recommendations
- **Note**: Token tracking not explicitly returned (could be added)

---

#### 📄 `src/app/api/tracking-insights/chat/route.ts`
**Purpose**: Analytics insights chat endpoint  
**Model**: `gemini-2.0-flash-exp`  
**Key Features**:
- Uses AI SDK streaming
- Tool calling for analytics: `analyzeBookingPatterns`, `analyzeConversion`, `recommendAddons`
- Token tracking via AI SDK metadata

---

### 2. **Frontend Components**

#### 📄 `src/components/AIAssistant/PageAIAssistant.tsx` ⭐ MAIN UI
**Purpose**: Full-page AI assistant component  
**Key Features**:
- Handles both manage context (generative UI) and simple chat
- Uses `useChat` hook from `@ai-sdk/react` for manage context
- Manual state management for input
- Displays package previews and creation results
- **Token Tracking**: Receives `usage` from API, but doesn't display directly

**State Management**:
- `manageInput` - Input for manage context
- `input` - Input for simple chat
- `messages` - Chat history (from useChat hook)
- `pendingPackagePreview` - Package preview state
- `createdPackageId` - Success state

---

#### 📄 `src/components/AIAssistant/AIAssistant.tsx` ⭐ WIDGET
**Purpose**: Floating chat widget component  
**Key Features**:
- Compact UI for marketplace concierge
- **Token Tracking Functions**:
  - `normalizeTokenUsage()` - Normalizes API token data (lines 136-147)
  - `persistTokenUsage()` - Saves to localStorage + dispatches events (lines 149-153)
- Displays token count in header: `{lastUsage?.total || 0} tokens used`
- Uses `/api/chat` endpoint (not manage)

**Token Persistence**:
```typescript
localStorage.setItem('ai:lastTokenUsage', JSON.stringify(usage))
window.dispatchEvent(new CustomEvent('aiTokenUsage', { detail: usage }))
```

---

### 3. **Dashboard & Display**

#### 📄 `src/app/(frontend)/notifications/page.client.tsx` ⭐ DASHBOARD
**Purpose**: Notifications dashboard with token metrics  
**Key Features**:
- Reads token usage from localStorage (line 164)
- Calculates monthly token change (lines 166-176)
- Displays in user stats:
  - `tokenBalance` - Current total tokens used
  - `tokenChange` - Monthly token consumption
- Listens to `aiTokenUsage` custom events (line 143)

**Token Display**:
```typescript
const tokenBalance = latestTokenUsage?.total ?? 0
const tokenChange = monthlyNotifications.reduce((sum, n) => {
  const metadata = n.metadata as any
  if (metadata?.tokens && typeof metadata.tokens === 'number') {
    return sum + metadata.tokens
  }
  return sum
}, 0)
```

---

### 4. **Utilities**

#### 📄 `src/utilities/getMeUser.ts`
**Purpose**: User authentication helper  
**Usage**: Used in all API endpoints to verify user identity  
**Returns**: `{ user }` object for authorization checks

---

### 5. **Configuration**

#### 📄 `package.json`
**Key Dependencies**:
```json
{
  "@ai-sdk/google": "^3.0.10",           // AI SDK Google provider
  "@google/generative-ai": "^0.24.1",   // Direct Gemini SDK
  "@google/genai": "^1.0.1"              // Additional Google AI package
}
```

**Environment Variables Required**:
- `GEMINI_API_KEY` - Primary API key
- `GOOGLE_GENERATIVE_AI_API_KEY` - Fallback API key

---

## 🔄 Token Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INTERACTION                          │
└────────────────────┬────────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
    [PageAIAssistant]    [AIAssistant Widget]
         │                       │
         │                       │
    ┌────┴────┐            ┌─────┴─────┐
    │         │            │           │
/api/chat/manage      /api/chat
    │         │            │           │
    │         │            │           │
┌───┴─────────┴───┐  ┌────┴───────────┴───┐
│ AI SDK Streaming │  │ Direct Gemini API │
│ gemini-2.0-flash │  │ gemini-2.5-flash  │
└────────┬─────────┘  └─────────┬─────────┘
         │                      │
         │  serializeUsageMetadata()
         │                      │
         └──────────┬───────────┘
                    │
         ┌──────────┴──────────┐
         │   { usage: {...} }  │
         └──────────┬──────────┘
                    │
         ┌──────────┴──────────┐
         │  normalizeTokenUsage│
         └──────────┬──────────┘
                    │
         ┌──────────┴──────────┐
         │  persistTokenUsage │
         │  (localStorage)    │
         └──────────┬──────────┘
                    │
         ┌──────────┴──────────┐
         │  Custom Event:     │
         │  'aiTokenUsage'     │
         └──────────┬──────────┘
                    │
         ┌──────────┴──────────┐
         │  Notifications     │
         │  Dashboard Display  │
         └─────────────────────┘
```

---

## 📊 File Importance Matrix

| File | Importance | Token Tracking | Model Used | Use Case |
|------|-----------|----------------|------------|----------|
| `api/chat/route.ts` | ⭐⭐⭐⭐⭐ | ✅ Explicit | gemini-2.5-flash | General chat, cleaning schedules |
| `api/chat/manage/route.ts` | ⭐⭐⭐⭐⭐ | ✅ AI SDK | gemini-2.0-flash-exp | Package management, tool calling |
| `components/AIAssistant.tsx` | ⭐⭐⭐⭐ | ✅ Client-side | N/A | Token persistence & display |
| `components/PageAIAssistant.tsx` | ⭐⭐⭐⭐ | ⚠️ Receives only | N/A | Main UI component |
| `notifications/page.client.tsx` | ⭐⭐⭐ | ✅ Dashboard | N/A | Token metrics display |
| `api/packages/suggest/route.ts` | ⭐⭐ | ❌ Not tracked | gemini-2.5-flash | Package suggestions |
| `api/tracking-insights/chat/route.ts` | ⭐⭐ | ✅ AI SDK | gemini-2.0-flash-exp | Analytics chat |

---

## 🔑 Key Functions Reference

### Token Serialization (Backend)
**Location**: `src/app/api/chat/route.ts:10-22`
```typescript
serializeUsageMetadata(usage) → {
  total, prompt, candidates, cached, thoughts
}
```

### Token Normalization (Frontend)
**Location**: `src/components/AIAssistant/AIAssistant.tsx:136-147`
```typescript
normalizeTokenUsage(usage) → TokenUsageDetails
```

### Token Persistence (Frontend)
**Location**: `src/components/AIAssistant/AIAssistant.tsx:149-153`
```typescript
persistTokenUsage(usage) → localStorage + CustomEvent
```

---

## 📝 Summary

**Critical Path for Token Tracking**:
1. **Backend**: `api/chat/route.ts` → `serializeUsageMetadata()` extracts tokens
2. **API Response**: Returns `{ message, usage }` to frontend
3. **Frontend**: `AIAssistant.tsx` → `normalizeTokenUsage()` → `persistTokenUsage()`
4. **Storage**: Saved to `localStorage` + broadcast via events
5. **Display**: `notifications/page.client.tsx` reads and displays metrics

**Two Implementation Patterns**:
- **Direct SDK**: Full control, explicit token tracking (`route.ts`)
- **AI SDK**: Streaming, tool calling, automatic token tracking (`manage/route.ts`)

---

**Last Updated**: 2024  
**Document Version**: 1.0

