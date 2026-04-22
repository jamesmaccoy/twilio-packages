# Yoco Integration Setup Guide

## Environment Variables Required

Add these to your `.env` file:

```bash
# Yoco Payment Integration
YOCO_SECRET_KEY=sk_live_xxxxxxxxxxxxx    # Primary API key
YOCO_SECRET_KEY_V2=sk_live_xxxxxxxxxxxxx  # V2 API key (optional, defaults to primary)
NEXT_PUBLIC_URL=http://localhost:3000     # Or your production URL
```

## Testing Without API Keys

The system includes **mock mode** that works without API keys:
- Mock products are returned automatically
- Payment links use a mock URL
- Logs will show "Yoco API key not configured, using mock data"

## Key Endpoints

### API Routes
- `POST /api/yoco/payment-links` - Create payment link for package
- `GET /api/yoco/products` - Fetch available products

### Integration Points
- `useYoco()` hook - Access customer info and payment functions
- `yocoService` - Core service for all Yoco operations

## Package Migration

All packages migrated from RevenueCat to Yoco:
- `revenueCatId` → `yocoId`
- `source: 'revenuecat'` → `source: 'yoco'`

## Backward Compatibility

For existing code, these aliases exist:
```typescript
import { useRevenueCat, RevenueCatProvider } from '@/providers/Yoco'
// Both map to Yoco internally
```

