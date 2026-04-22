# Why Only One Package Uses Yoco Service - Root Cause & Fix

## 🔍 Problem Identified

**Root Cause**: Schema mismatch between Archive and betaplek

### Current State (Archive):
- ❌ Package collection only has `revenueCatId` field (line 86 in `Packages/index.ts`)
- ❌ SmartEstimateBlock references `yocoId` field (line 30, 712, etc.)
- ❌ Package API route only returns `revenueCatId` (line 112 in `packages/post/[postId]/route.ts`)
- ⚠️ Only package `68b6fadf673945d69c1d2418` works because it has a `revenueCatId` that matches a Yoco product ID

### Expected State (betaplek commit dc65b4d):
- ✅ Package collection has BOTH `revenueCatId` (legacy) AND `yocoId` (new)
- ✅ Code uses `yocoId` to match Yoco products
- ✅ API routes map `revenueCatId` → `yocoId` for backward compatibility

---

## 🔧 The Fix

### Step 1: Add `yocoId` field to Package schema

The betaplek commit shows:
```typescript
{ 
  name: 'revenueCatId', 
  type: 'text',
  admin: {
    description: 'Legacy RevenueCat product ID (deprecated, use yocoId instead)'
  }
},
{ 
  name: 'yocoId', 
  type: 'text',
  admin: {
    description: 'Yoco product ID for payment processing'
  }
}
```

### Step 2: Update Package API to map `revenueCatId` → `yocoId`

The API route needs to return `yocoId` field, mapping from `revenueCatId` if `yocoId` is not set.

### Step 3: Update SmartEstimateBlock to handle both fields

Already done - it checks `yocoId` first, then falls back.

---

## 📊 Why Only One Package Works

1. Most packages have `revenueCatId: null` or `revenueCatId: "some_old_id"`
2. SmartEstimateBlock checks `selectedPackage.yocoId` (line 712)
3. Since `yocoId` doesn't exist, it's `undefined`
4. Only package `68b6fadf673945d69c1d2418` has a `revenueCatId` that happens to match a Yoco product ID
5. The matching logic in `getYocoPackageId()` (line 700) might match it by coincidence

---

## ✅ Solution

Apply the changes from betaplek commit dc65b4d to add `yocoId` field and update the API mapping.

