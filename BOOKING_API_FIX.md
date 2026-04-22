# ✅ Booking API Fixed

## Problem
Booking creation was failing with a 400 error because the booking API route was disabled.

## Root Cause
The file was named `disableee-route.ts` instead of `route.ts`, which meant Next.js couldn't find the API endpoint.

## Solution
Renamed the file to activate the API:
```bash
mv src/app/api/bookings/disableee-route.ts src/app/api/bookings/route.ts
```

## What the Booking API Does

### POST /api/bookings
Creates a new booking with:
- Post/property reference
- Date range (fromDate, toDate)
- Customer reference (from auth)
- Payment status
- Unique token

**Required fields:**
- `postId` - Property ID or slug
- `fromDate` - Start date (ISO string)
- `toDate` - End date (ISO string)

**Optional fields:**
- `paymentStatus` - 'paid' or 'pending' (defaults to 'pending')

### GET /api/bookings?postId=xxx
Fetches all bookings for a property (used for availability checking)

## Status
✅ **Fixed** - API route is now active

## Test the Booking Flow

1. Go to a property page
2. Create an estimate
3. Select a package
4. Click "Book Now"
5. **Booking should now be created successfully** ✅

## Related Files
- `src/app/api/bookings/route.ts` - Active booking API
- `src/app/api/bookings/disable-route.ts` - Legacy route (can be deleted)
- `src/blocks/EstimateBlock/SmartEstimateBlock.tsx` - Calls this API

---

**Status**: ✅ Resolved  
**Action**: Test the booking flow - should work now!

