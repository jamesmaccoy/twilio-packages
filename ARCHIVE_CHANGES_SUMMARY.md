# Archive Changes Summary

## Overview
This document summarizes the changes between the **betaplek** repository and the **Archive** codebase over the past 3 weeks.

**Stats**: 77 files changed, 11,296 insertions(+), 6,428 deletions(-)

---

## 🔄 Major Migration: RevenueCat → Yoco

### Payment Provider Change
The biggest change is a complete migration from **RevenueCat** to **Yoco** as the payment processor.

#### Files Removed (RevenueCat-related):
- `src/lib/revenueCatService.ts` (637 lines)
- `src/providers/RevenueCat/index.tsx` (145 lines)
- `src/components/PackageDisplay/` (entire component removed)
- `src/components/BookingInfoCard/` (entire component removed)

#### Files Added (Yoco-related):
- `src/lib/yocoService.ts` (588 lines) - Complete Yoco payment service
- `src/providers/Yoco/index.tsx` (174 lines) - Yoco context provider
- `src/app/api/yoco/payment-links/route.ts` - Create Yoco payment links
- `src/app/api/yoco/products/route.ts` - Fetch Yoco products

### Key Code Changes:

**Before (RevenueCat)**:
```typescript
import { useRevenueCat } from '@/providers/RevenueCat'
import { Purchases } from '@revenuecat/purchases-js'
// Package field: revenueCatId
// Source: 'database' | 'revenuecat'
```

**After (Yoco)**:
```typescript
import { useYoco } from '@/providers/Yoco'
import { yocoService } from '@/lib/yocoService'
// Package field: yocoId
// Source: 'database' | 'yoco'
```

### Backward Compatibility
The code includes backward compatibility aliases:
```typescript
// src/providers/Yoco/index.tsx
export const useRevenueCat = useYoco
export const RevenueCatProvider = YocoProvider
```

---

## 🗑️ Removed Features

### 1. AuthRequests Collection
Completely removed the magic link authentication system:
- `src/collections/AuthRequests/` (entire collection)
  - `endpoints/initiate-magic-auth.ts`
  - `endpoints/verify-code.ts`
  - `endpoints/verify-magic-token.ts`
  - `hooks/remove-auth-request.ts`
  - `hooks/send-magic-email.ts`
- `src/emails/MagicAuth.tsx`
- `src/lib/transporter.ts`
- `src/lib/emailNotifications.ts`

### 2. New API Routes Added
Auth requests now handled at API level:
- `src/app/api/authRequests/magic/route.ts`
- `src/app/api/authRequests/verify-code/route.ts`
- `src/app/api/authRequests/verify-link/route.ts`

### 3. API Route Cleanups
Several API routes were renamed/moved:
- `disable-route.ts` → `route.ts` (bookings, users, posts)
- `disablroute.ts` → `route.ts` (posts typo fix)

### 4. Removed Components
- **BookingInfoCard**: Display component for booking information
- **PackageDisplay**: RevenueCat package display component

### 5. Removed Hooks
- `src/collections/Estimates/hooks/createBooking.ts`

---

## ✏️ Modified Files

### SmartEstimateBlock.tsx (362 lines changed)
Major refactoring for Yoco integration:
- Replaced RevenueCat API calls with Yoco API
- Changed package loading from `Purchases.getOfferings()` to `/api/yoco/products`
- Updated payment link creation flow
- Modified package field references (`revenueCatId` → `yocoId`)

### Collections Modified
- **Bookings**: Simplified endpoints and availability checks
- **Estimates**: Removed createBooking hook, streamlined flow

### API Routes Modified
Multiple API routes updated for Yoco:
- `src/app/api/check-subscription/route.ts`
- `src/app/api/estimates/route.ts`
- `src/app/api/packages/` (multiple files)
- `src/app/api/test-revenuecat/route.ts`
- `src/app/api/upgrade-role/route.ts`
- `src/app/api/users/promote-host/route.ts`

### Frontend Pages Modified
- `src/app/(frontend)/bookings/` - Updated for Yoco payment flow
- `src/app/(frontend)/estimate/` - Modified for Yoco products
- `src/app/(frontend)/login/` - Updated components
- `src/app/(frontend)/register/` - Minor changes
- `src/app/(frontend)/subscribe/` - Updated for Yoco

### Components Modified
- `src/components/AIAssistant/AIAssistant.tsx` - Updated for Yoco
- `src/components/CurrencyExample.tsx` & `CurrencyTest.tsx` - Currency changes
- `src/blocks/Form/Component.tsx` - Field updates
- `src/blocks/RenderBlocks.tsx` - Block rendering updates

---

## 📦 Package Management

### package.json Changes
- Removed RevenueCat dependencies
- Added Yoco dependencies
- Added yarn.lock (8,501 lines) - Now using Yarn

### Removed Development Files
- `.editorconfig`
- `.eslintrc.json` 
- `.npmrc`
- `.prettierignore`
- `.prettierrc.json`
- `.vscode/` (entire directory)

---

## 🔧 Configuration Changes

### payload.config.ts
- Removed RevenueCat plugin
- Added Yoco provider
- Updated authentication configuration

### payload-types.ts
- Updated types for Yoco integration
- Modified package schema (revenueCatId → yocoId)
- Updated authentication request types

---

## 📁 File Structure Changes

### Moved Collections → API
**Before**: Collections with endpoints and hooks
- `src/collections/AuthRequests/endpoints/`
- `src/collections/AuthRequests/hooks/`

**After**: Direct API routes
- `src/app/api/authRequests/`

This suggests a move to a more direct API-first architecture.

---

## 🎯 Yoco Integration Highlights

### Key Features Added:

1. **Payment Links**: Create Yoco checkout payment links for packages
2. **Product Management**: Fetch and manage Yoco products via API
3. **Mock Mode**: Built-in mock products for development without API keys
4. **Customer Info**: Track customer purchase history
5. **Subscription Validation**: Validate package subscriptions

### Payment Flow:
1. User selects a package (database or Yoco product)
2. System creates a Yoco payment link via `/api/yoco/payment-links`
3. User redirected to Yoco checkout
4. On success, redirected to booking confirmation

---

## 🔍 Notable Code Patterns

### Provider Usage
```typescript
// Before
const { customerInfo, isInitialized } = useRevenueCat()

// After  
const { customerInfo, isInitialized } = useYoco()
```

### Package Sources
```typescript
// Before
source: 'database' | 'revenuecat'

// After
source: 'database' | 'yoco'
```

### Product Fetching
```typescript
// Before
const offerings = await Purchases.getSharedInstance().getOfferings()

// After
const response = await fetch('/api/yoco/products')
const { products } = await response.json()
```

---

## 📊 Impact Analysis

### Breaking Changes:
1. All RevenueCat code removed - not backward compatible
2. AuthRequests collection removed - authentication flow changed
3. Package field renamed: `revenueCatId` → `yocoId`

### Migration Required:
- Update all RevenueCat references to Yoco
- Migrate package IDs from RevenueCat to Yoco format
- Update any custom RevenueCat integrations
- Update environment variables for Yoco API keys

---

## 🚀 Next Steps Suggestions

1. **Review Yoco Integration**: Ensure all payment flows work correctly
2. **Update Environment Variables**: Set up Yoco API keys
3. **Test Package Purchases**: Verify end-to-end payment flow
4. **Update Documentation**: Reflect Yoco integration in docs
5. **Consider Deprecation**: Mark old RevenueCat references for removal
6. **Monitor API Usage**: Track Yoco API rate limits and usage

---

## 📝 Files to Review

### High Priority:
- `src/lib/yocoService.ts` - Core Yoco service
- `src/blocks/EstimateBlock/SmartEstimateBlock.tsx` - Major changes
- `src/app/api/yoco/` - New API routes
- `src/providers/Yoco/index.tsx` - Context provider

### Medium Priority:
- `src/app/api/authRequests/` - Authentication changes
- `src/collections/Bookings/` - Availability changes
- `src/collections/Estimates/` - Booking flow changes

### Low Priority:
- Configuration files
- Removed development configs
- Package lock files

---

*Generated: 2025*
*Base Repository: betaplek*
*Branch: main*

