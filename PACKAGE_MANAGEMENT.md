# Enhanced Package Management System

## Overview

This system implements a **comprehensive SaaS pattern** for package management with RevenueCat integration, payment validation, and role-based access control. It's designed for multi-tenant applications where hosts can manage their service offerings with different pricing tiers.

## Architecture Pattern

This follows the **"Multi-tenant SaaS with Role-Based Access Control (RBAC) and Revenue Management"** pattern, similar to:

- **Airbnb** (hosts manage listings with different pricing tiers)
- **Uber** (drivers manage service offerings)
- **Shopify** (merchants manage products with different subscription tiers)
- **Stripe** (merchants manage payment products)
- **Calendly** (users manage booking types)

## Key Features

### 1. **Enhanced Security & Payment Validation**
- Payment validation before role promotion
- Subscription status tracking in user profiles
- Host verification with payment requirements
- RevenueCat integration for subscription management

### 2. **Yoco Payment Integration**
- Yoco product integration for payment processing
- Real-time pricing from Yoco products
- Payment validation for bookings
- Support for Yoco product IDs via `yocoId` field

### 3. **Enhanced User Experience**
- Visual indicators for RevenueCat products
- Better error handling and user feedback
- Sync functionality to import products
- Payment-required promotions with clear messaging

## API Endpoints

### Package Management
- `GET /api/packages` - List packages with filtering
- `POST /api/packages` - Create new package
- `DELETE /api/packages` - Bulk delete packages
- `GET /api/packages/[id]` - Get single package
- `PATCH /api/packages/[id]` - Update package
- `DELETE /api/packages/[id]` - Delete single package

### Yoco Payment Integration
- Packages use `yocoId` field to link to Yoco products
- Payment processing handled through Yoco payment gateway

### User Management
- `POST /api/users/promote-host` - Promote user to host with payment validation

## Database Schema

### Users Collection
```typescript
{
  name: string (required)
  email: string (required, unique)
  role: 'guest' | 'customer' | 'host' | 'admin'
  subscriptionStatus: {
    status: 'none' | 'trial' | 'active' | 'past_due' | 'canceled'
    plan: 'free' | 'basic' | 'pro' | 'enterprise'
    expiresAt: Date
    revenueCatCustomerId: string
  }
  paymentValidation: {
    lastPaymentDate: Date
    paymentMethod: 'none' | 'credit_card' | 'paypal' | 'apple_pay'
    paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded'
  }
  hostProfile: {
    isVerified: boolean
    verificationDate: Date
    hostRating: number
    totalBookings: number
    bio: string
    specialties: Array<{ specialty: string }>
  }
}
```

### Packages Collection
```typescript
{
  post: Relationship to Posts (required)
  name: string (required)
  description: string
  multiplier: number (required, 0.1-3.0)
  category: 'standard' | 'hosted' | 'addon' | 'special'
  minNights: number (required)
  maxNights: number (required)
  yocoId: string                    // Yoco product ID for payment processing ⭐ USE THIS
  revenueCatId: string | null        // ⚠️ DEPRECATED - Do not use, set to null
  isEnabled: boolean
  baseRate: number
  features: Array<{ feature: string }>
}
```

**⚠️ Important**: The `revenueCatId` field is deprecated and should be set to `null`. Use `yocoId` for all payment processing.

## Usage Examples

### 1. Create Package with Yoco Integration
```javascript
// Frontend
const response = await fetch('/api/packages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    postId: 'your-post-id',
    name: '📸 Studio hire',
    description: 'Classic beach bungalow',
    yocoId: 'per_hour',  // ⭐ Use yocoId for payment processing
    revenueCatId: null,  // ⚠️ Set to null - deprecated field
    baseRate: 1999,
    category: 'standard',
    minNights: 0.5,
    maxNights: 1
  })
});

const result = await response.json();
console.log('Package created:', result.id);
```

### 2. Promote User to Host
```javascript
// Frontend
const response = await fetch('/api/users/promote-host', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    targetUserId: 'user-id',
    productId: 'pro_subscription_id'
  })
});

const result = await response.json();
if (result.message) {
  console.log('User promoted successfully');
}
```

### 3. Use Package with Yoco Payment
```javascript
// Frontend - Package selection uses yocoId
const selectedPackage = {
  id: '68a58832420e4517de8d2bdb',
  name: '📸 Studio hire',
  yocoId: 'per_hour',  // ⭐ This is used for payment processing
  baseRate: 1999
}

// Payment processing uses yocoId to create payment link
const paymentLink = await createYocoPaymentLink({
  productId: selectedPackage.yocoId,  // Uses yocoId, not revenueCatId
  amount: selectedPackage.baseRate
})
```

## Environment Variables

```bash
# Yoco Configuration
YOCO_SECRET_KEY=your_yoco_secret_key
YOCO_PUBLIC_KEY=your_yoco_public_key

# Server Configuration
NEXT_PUBLIC_SITE_URL=https://your-domain.com
NEXT_PUBLIC_SERVER_URL=https://your-domain.com
VERCEL_URL=your-vercel-url
```

## Security Features

### 1. **Role-Based Access Control**
- Only admins can create/delete users
- Users can only access their own data
- Hosts have additional permissions for package management

### 2. **Payment Validation**
- Payment validation before booking confirmation
- Payment status tracking via Yoco transactions
- Yoco integration for payment processing

### 3. **Data Validation**
- Input sanitization and validation
- Type checking for all API endpoints
- Error handling with detailed messages

## Testing

### Test Package Creation
```bash
curl -X POST http://localhost:3000/api/packages \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "post": "your-post-id",
    "name": "Test Package",
    "yocoId": "test_product_id",
    "revenueCatId": null,
    "baseRate": 2000,
    "category": "standard",
    "minNights": 1,
    "maxNights": 7
  }'
```

## Deployment Considerations

1. **Environment Variables**: Ensure all Yoco keys and server URLs are properly configured
2. **Database Migration**: Update existing packages to set `revenueCatId: null` and use `yocoId` instead
3. **Yoco Setup**: Configure Yoco products and ensure `yocoId` matches Yoco product IDs
4. **Access Control**: Verify access control functions work correctly in production
5. **Package Updates**: Remove `revenueCatId` from all packages (set to `null`) - example: Package ID `68a58832420e4517de8d2bdb` has been updated

## Future Enhancements

1. **Webhook Integration**: Real-time Yoco webhook handling for payment events
2. **Analytics Dashboard**: Package usage and revenue analytics
3. **Multi-currency Support**: International pricing support
4. **Advanced Host Features**: Host rating system, verification badges
5. **Automated Testing**: Comprehensive test suite for all endpoints
6. **Migration Script**: Automated script to remove `revenueCatId` from all packages

## Troubleshooting

### Common Issues

1. **Yoco Payment Failed**
   - Check Yoco API key configuration
   - Verify Yoco account status
   - Ensure `yocoId` matches Yoco product ID
   - Check network connectivity

2. **Package Payment Processing Errors**
   - Verify `yocoId` is set correctly (not `revenueCatId`)
   - Ensure `revenueCatId` is set to `null` (deprecated field)
   - Check that Yoco product exists with matching ID
   - Review package configuration

3. **Package Not Found in Payment Flow**
   - Verify package has valid `yocoId` field
   - Check that package is enabled (`isEnabled: true`)
   - Ensure package belongs to correct post

### Migration Notes

**Removing `revenueCatId` from packages**:
- Example: Package `68a58832420e4517de8d2bdb` (📸 Studio hire) has been updated
- Set `revenueCatId: null` for all packages
- Use `yocoId` field exclusively for payment processing
- Update any code that references `revenueCatId` to use `yocoId` instead

### Debug Endpoints

- Check server logs for detailed error messages
- Use browser developer tools for frontend debugging
- Verify package `yocoId` matches Yoco product configuration 