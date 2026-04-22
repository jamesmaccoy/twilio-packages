# Package Management with Generative UI & MCP

## Overview

This system implements **AI-powered package creation** using generative UI patterns from the [AI SDK](https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces). Packages are created through a two-step flow: preview → confirm, powered by AI tools that generate complete package details.

## Architecture

### Two-Step Package Creation Flow

1. **Preview Step** (`previewPackageTool`): AI generates a complete package preview with all fields filled in
2. **Creation Step** (`createPackageTool`): User confirms and package is created in Payload CMS

### Payment Integration

**⚠️ Important**: We use **Yoco** for payment processing.

- **Current Field**: `yocoId` (Yoco product ID for payment processing) ⭐ **USE THIS**
- **Legacy Field**: `revenueCatId` (deprecated, set to `null` - do not use)

## Generative UI Flow

### Step 1: Package Preview (`previewPackageTool`)

The AI generates a complete package preview with intelligent defaults:

**Endpoint**: `/api/chat/manage`  
**Tool**: `previewPackageTool`

**What it does**:
- Takes user description (e.g., "Weekend getaway package")
- Generates missing values intelligently:
  - **Category**: Infers from description (addon, hosted, special, standard)
  - **Base Rate**: Guesses based on category (R200-R600)
  - **Nights**: Sets appropriate min/max based on category
  - **Features**: Generates 3-5 relevant features
  - **Multiplier**: Sets based on category (1.0-1.2)
- Returns complete preview object with ALL fields filled

**Preview Output Format**:
```typescript
{
  name: string                    // e.g., "🏠 Weekend Getaway"
  description: string             // Generated description
  category: 'standard' | 'hosted' | 'addon' | 'special'
  entitlement: 'standard' | 'pro'
  minNights: number               // Can be 0.5 for half-day
  maxNights: number
  baseRate: number                // In cents (ZAR), e.g., 20000 = R200
  multiplier: number              // 0.1-3.0
  features: string[]              // Array of feature strings
  postId: string                  // Property ID
  yocoId?: string                 // Yoco product ID ⭐ USE THIS for payments
  revenueCatId?: null             // ⚠️ DEPRECATED - Set to null, do not use
  isPreview: true
}
```

### Step 2: Package Creation (`createPackageTool`)

After user confirms the preview, the package is created:

**Tool**: `createPackageTool`

**What it does**:
- Validates all required fields
- Creates package in Payload CMS `packages` collection
- Returns created package with database ID
- Sets `isEnabled: true` by default

**Created Package Format**:
```typescript
{
  success: true
  package: {
    id: string                    // Database ID
    name: string
    description: string
    category: string
    isEnabled: boolean
    minNights: number
    maxNights: number
    baseRate?: number
    multiplier: number
    entitlement: string
    features: Array<{ feature: string }>
  }
  message: string                 // Success message
}
```

## Frontend Implementation

### PackageOnboarding Component

Located at: `src/components/PackageOnboarding/PackageOnboarding.tsx`

**Two-Step UI**:
1. **Describe Step**: User enters name and description (Instagram AI Studio style)
2. **Details Step**: Shows AI-generated preview with confirm/cancel options

**Key Features**:
- Uses `useChat` hook from `@ai-sdk/react`
- Listens for `tool-previewPackage` and `tool-createPackage` tool calls
- Renders preview using `PackagePreview` component
- Handles success/failure states

**Example Usage**:
```tsx
<PackageOnboarding
  postId="property-id"
  onComplete={(packageData) => {
    // Package created successfully
    console.log('Created:', packageData.id)
  }}
  onCancel={() => {
    // User cancelled
  }}
/>
```

### Tool Call Detection

The component listens for tool calls in the `onFinish` callback:

```typescript
onFinish: (message) => {
  // Detect preview tool call
  const previewPart = message.parts?.find((part: any) => 
    part.type === 'tool-previewPackage' && 
    part.state === 'output-available'
  )
  
  // Detect creation tool call
  const createPart = message.parts?.find((part: any) => 
    part.type === 'tool-createPackage' && 
    part.state === 'output-available'
  )
}
```

**Tool Call States**:
- `input-available`: Tool is being called
- `output-available`: Tool completed successfully
- `output-error`: Tool failed

## API Endpoint

### `/api/chat/manage`

**Authentication**: Session-based (via `getMeUser()`)

**Required Role**: `host` or `admin`

**Request Format**:
```typescript
{
  messages: UIMessage[]           // Chat messages
  pageData: {
    posts: Array<{ id: string }> // User's properties
    postId: string                // Selected property ID
  }
}
```

**Available Tools**:
1. `previewPackage` - Generate package preview
2. `createPackage` - Create package in database
3. `findPackages` - List/search packages
4. `updatePackage` - Modify existing package
5. `deletePackage` - Remove package

## Package Fields Reference

### Required Fields
- `name`: Package display name (string)
- `post`: Property relationship (Post ID)
- `category`: standard | hosted | addon | special
- `minNights`: Minimum nights (number, can be 0.5)
- `maxNights`: Maximum nights (number)

### Optional Fields
- `description`: Package description (string)
- `baseRate`: Base rate in cents (number, ZAR)
- `multiplier`: Price multiplier (number, 0.1-3.0, default: 1)
- `entitlement`: standard | pro (default: standard)
- `features`: Array of feature strings
- `yocoId`: Yoco product ID (string) ⭐ **Use this for payments - REQUIRED for payment processing**
- `revenueCatId`: ⚠️ **DEPRECATED** - Set to `null`, do not use for new packages
- `isEnabled`: Enable/disable package (boolean, default: true)

### Payment Integration

**Yoco Integration**:
- ⭐ **Use `yocoId` field exclusively** to link packages to Yoco products
- Yoco product IDs are used for payment processing
- ⚠️ **`revenueCatId` is deprecated** - Set to `null` for all packages
- Example: Package `68a58832420e4517de8d2bdb` (📸 Studio hire) uses `yocoId: "per_hour"` and `revenueCatId: null`

## Default Value Generation

The AI intelligently guesses missing values based on category:

### Standard Packages
- Base Rate: R150-R300 (15000-30000 cents)
- Nights: 2-7 nights
- Multiplier: 1.0
- Features: ["Comfortable accommodation", "Essential amenities", "Flexible check-in"]

### Hosted Packages
- Base Rate: R300-R600 (30000-60000 cents)
- Nights: 3-14 nights
- Multiplier: 1.2
- Features: ["Concierge service", "Premium amenities", "Personalized experience"]

### Add-on Packages
- Base Rate: R200-R500 (20000-50000 cents)
- Nights: 1 night (or 0.5 for half-day)
- Multiplier: 1.0
- Features: ["Professional service", "One-time fee", "Quick setup"]

### Special Packages
- Base Rate: R250-R500 (25000-50000 cents)
- Nights: 1-7 nights
- Multiplier: 0.9
- Features: ["Special offer", "Limited availability", "Unique experience"]

## MCP Integration (Optional)

### MCP Plugin Configuration

The Payload MCP plugin provides external tool access (for Cursor, Claude Desktop, etc.):

**Configuration** (`payload.config.ts`):
```typescript
mcpPlugin({
  collections: {
    packages: {
      description: 'Property packages for hosts to manage pricing tiers',
      enabled: {
        create: true,
        delete: true,
        find: true,
        update: true,
      },
    },
  },
})
```

### MCP API Keys

**Note**: MCP endpoint (`/api/mcp`) requires API key authentication and is separate from the generative UI flow.

**To use MCP**:
1. Go to Payload Admin → Collections → API Keys (Payload MCP API Keys)
2. Create an API key
3. Associate it with a user who has `host` or `admin` role
4. Configure package permissions (find, create, update, delete)
5. Use the API key in MCP client configuration

**MCP API Key Structure**:
```json
{
  "apiKey": "8bc4412f-c6a1-419d-a32e-c52a9ea0090a",
  "enableAPIKey": true,
  "packages": {
    "find": true,
    "create": true,
    "update": true,
    "delete": true
  },
  "user": {
    "id": "68721eadfb2b22d4264d55e3",
    "role": "admin"
  }
}
```

**MCP Endpoint**:
- Development: `http://localhost:3000/api/mcp`
- Production: `https://simpleplek.com/api/mcp`

**Testing MCP**:
```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: YOUR_API_KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list",
    "params": {}
  }'
```

**Expected Response** (when working):
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "create_packages",
        "description": "Create a new package..."
      },
      {
        "name": "find_packages",
        "description": "Find packages..."
      },
      {
        "name": "update_packages",
        "description": "Update a package..."
      },
      {
        "name": "delete_packages",
        "description": "Delete a package..."
      }
    ]
  }
}
```

**Important**: The generative UI package creation (`/api/chat/manage`) does **NOT** require MCP API keys. It uses session-based authentication. MCP API keys are only needed for external MCP clients (Cursor, Claude Desktop, etc.).

## Complete Example Flow

### 1. User Describes Package
```
User: "Create a weekend getaway package for couples"
```

### 2. AI Calls previewPackageTool
```typescript
previewPackageTool({
  description: "weekend getaway package for couples",
  category: "standard",  // Inferred
  minNights: 2,           // Guessed
  maxNights: 3,           // Guessed
  baseRate: 25000,        // Guessed (R250)
  features: [             // Generated
    "Romantic setting",
    "Couples amenities",
    "Weekend special"
  ]
})
```

### 3. Preview Displayed
User sees `PackagePreview` component with all details filled in.

### 4. User Confirms
User clicks "Create Package" button.

### 5. AI Calls createPackageTool
```typescript
createPackageTool({
  name: "🏠 Weekend Getaway",
  description: "Romantic weekend package for couples...",
  category: "standard",
  minNights: 2,
  maxNights: 3,
  baseRate: 25000,
  multiplier: 1,
  features: ["Romantic setting", "Couples amenities", "Weekend special"],
  postId: "property-id",
  entitlement: "standard",
  yocoId: "weekend_package_id",  // ⭐ Yoco product ID for payment processing
  revenueCatId: null              // ⚠️ Set to null - deprecated field
})
```

### 6. Package Created
```typescript
{
  success: true,
  package: {
    id: "69579fbc34d2a2bd2cb67424",
    name: "🏠 Weekend Getaway",
    // ... all fields
  }
}
```

## Troubleshooting

### Package Creation Fails

**Check**:
1. User has `host` or `admin` role
2. `postId` is valid and user owns the property
3. Required fields are provided
4. Check server logs for detailed errors

### Preview Not Showing

**Check**:
1. `useChat` hook is properly configured
2. `onFinish` callback is detecting `tool-previewPackage`
3. Check browser console for errors
4. Verify API endpoint `/api/chat/manage` is accessible

### MCP Errors

**Note**: MCP errors are unrelated to package creation. The generative UI uses `/api/chat/manage` which doesn't require MCP API keys.

**Common MCP Issues**:

1. **"Unauthorized, you must be logged in"**
   - Solution: Create an API key in Payload Admin → Collections → API Keys (Payload MCP API Keys)
   - Ensure the API key has `enableAPIKey: true`
   - Use the API key in the `Authorization` header: `Authorization: YOUR_API_KEY`
   - Verify the API key exists: `GET /api/payload-mcp-api-keys?where[user][equals]=USER_ID`

2. **"Forbidden" or Permission Errors**
   - Solution: Ensure the API key's user has `host` or `admin` role
   - Check that package permissions are enabled (find, create, update, delete)
   - Verify `packages` object in API key has all operations set to `true`

3. **"MCP endpoint requires an API key"**
   - Solution: This is expected - MCP endpoint requires API key authentication
   - The web UI uses `/api/chat/manage` (session-based, no API key needed)
   - MCP is only for external tools like Cursor/Claude Desktop

**Success Example**:
When MCP is properly configured, you should see:
```
✅ MCP endpoint is working! Found 4 tool(s), 4 package-related tool(s) available.
```

**API Key Response Example**:
```json
{
  "docs": [
    {
      "apiKey": "8bc4412f-c6a1-419d-a32e-c52a9ea0090a",
      "enableAPIKey": true,
      "packages": {
        "find": true,
        "create": true,
        "update": true,
        "delete": true
      },
      "user": {
        "id": "68721eadfb2b22d4264d55e3",
        "role": "admin"
      }
    }
  ]
}
```

## Migration Notes

**Removing `revenueCatId` from packages**:
- All packages should have `revenueCatId: null`
- Use `yocoId` field exclusively for payment processing
- Example: Package `68a58832420e4517de8d2bdb` (📸 Studio hire) has been updated:
  - ✅ `yocoId: "per_hour"` (used for payments)
  - ✅ `revenueCatId: null` (deprecated, removed)

**When creating new packages**:
- Always set `yocoId` to match your Yoco product ID
- Always set `revenueCatId: null` (or omit the field)
- Never use `revenueCatId` for payment processing

## References

- [AI SDK Generative UI](https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces)
- [Payload CMS Documentation](https://payloadcms.com/docs)
- [Yoco Payment Integration](https://developer.yoco.com/)

