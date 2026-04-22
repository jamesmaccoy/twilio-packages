# Meta Paid Ads Setup Guide

## Overview

This guide helps you set up Meta (Facebook/Instagram) paid ad campaigns using your product/package data for Dynamic Product Ads.

## Your Product Data

Based on your API endpoint (`/api/packages/post/691b3c7280616a717c9c4620`), you have:
- **4 packages** available for the post
- Packages include: Re Wild Food, Monthly market stall, Reserve the deck, Join the Studio market
- Each package has pricing, descriptions, and features

## Step 1: Create Meta Catalog Feed

### Option A: Use the Catalog Feed API (Recommended)

I've created two Meta Catalog Feed API endpoints:

**1. Packages Catalog** (for specific post):
**URL**: `https://www.simpleplek.co.za/api/meta-catalog?postId=691b3c7280616a717c9c4620&format=xml`

**2. Estimates Catalog** (based on user's estimates):
**URL**: `https://www.simpleplek.co.za/api/meta-catalog/estimates?userId=[user-id]&format=xml`

**Features**:
- ✅ Generates XML feed in Meta's required format
- ✅ Includes all package data (prices, descriptions, images)
- ✅ Custom labels for filtering (category, min/max nights, etc.)
- ✅ Links directly to your post with package pre-selected
- ✅ **Estimates-based catalog**: Creates products from user's actual estimates
- ✅ **Automatic tracking**: Estimates are tracked on bookings page for Dynamic Product Ads

**Test the feed**:
```bash
# JSON format (for testing)
curl https://www.simpleplek.co.za/api/meta-catalog?postId=691b3c7280616a717c9c4620

# XML format (for Meta)
curl https://www.simpleplek.co.za/api/meta-catalog?postId=691b3c7280616a717c9c4620&format=xml
```

### Option B: Manual Catalog Upload

1. Export your packages to CSV/XML
2. Upload to Meta Business Manager → Commerce → Catalogs

### Option C: Estimate-Based Ads (Automatic)

**Already implemented!** Your estimates automatically become ads:

1. **Estimate tracking**: When users view estimates, Meta Pixel tracks `ViewContent` events
2. **Bookings page**: Estimates are tracked on `/bookings` page automatically
3. **Dynamic Product Ads**: Meta will show ads based on what users have estimated
4. **Catalog feed**: Use `/api/meta-catalog/estimates?userId=[id]&format=xml` for estimate-based catalog

**How it works**:
- User creates an estimate → Tracked as `ViewContent` event
- User visits bookings page → Latest estimate is tracked
- Meta Pixel uses this data to show relevant Dynamic Product Ads
- Ads link back to the estimate detail page

## Step 2: Set Up Meta Catalog in Business Manager

1. **Go to Meta Business Manager**
   - [business.facebook.com](https://business.facebook.com)
   - Navigate to **Commerce** → **Catalogs**

2. **Create New Catalog**
   - Click **Create Catalog**
   - Select **E-commerce** catalog type
   - Name: "Simpleplek Packages"
   - Choose **Data Source**: **Data Feed**

3. **Add Data Feed**
   - **Feed URL**: `https://www.simpleplek.co.za/api/meta-catalog?postId=691b3c7280616a717c9c4620&format=xml`
   - **Feed Type**: XML
   - **Schedule**: Daily (or as needed)
   - **Currency**: ZAR (South African Rand)

4. **Map Product Fields**
   - Meta will auto-detect fields from your XML feed
   - Verify mappings:
     - `g:id` → Product ID
     - `g:title` → Product Name
     - `g:description` → Description
     - `g:price` → Price
     - `g:image_link` → Product Image
     - `g:link` → Product URL

5. **Upload and Verify**
   - Click **Upload** or **Test Feed**
   - Wait for processing (usually 15-30 minutes)
   - Verify products appear correctly

## Step 3: Create Dynamic Product Ad Campaign

1. **Go to Meta Ads Manager**
   - [business.facebook.com/adsmanager](https://business.facebook.com/adsmanager)

2. **Create Campaign**
   - Click **Create** → **Campaign**
   - **Objective**: **Catalog Sales** (or **Conversions**)
   - **Campaign Name**: "Simpleplek Packages - Dynamic Ads"

3. **Set Up Ad Set**
   - **Catalog**: Select "Simpleplek Packages" catalog
   - **Optimization**: Conversions (or Catalog Sales)
   - **Conversion Event**: Purchase (or InitiateCheckout)
   - **Audience**: 
     - **Retargeting**: People who viewed products but didn't purchase
     - **Lookalike**: Based on your customers
     - **Custom**: Target by interests, demographics

4. **Create Ad**
   - **Format**: **Dynamic Product Ad**
   - **Template**: Choose a template (Single Image, Carousel, Collection)
   - **Primary Text**: Write compelling copy about your packages
   - **Headline**: Auto-populated from product titles
   - **Description**: Auto-populated from product descriptions
   - **Call to Action**: "Book Now" or "Learn More"

## Step 4: Track Conversions

Your Meta Pixel is already set up to track:
- ✅ **PageView** - When users visit your site
- ✅ **EstimateView** - When users view estimates
- ✅ **Purchase** - When bookings are completed

**Verify tracking**:
1. Go to [Meta Events Manager](https://business.facebook.com/events_manager2)
2. Select your Pixel (ID: 2659582847593179)
3. Go to **Test Events** tab
4. Visit your site and complete actions
5. Events should appear in real-time

## Step 5: Optimize Your Ads

### Use Custom Labels for Targeting

Your catalog feed includes custom labels:
- `custom_label_0`: Package category (standard, wine, hiking, film)
- `custom_label_1`: Min nights
- `custom_label_2`: Max nights
- `custom_label_3`: Revenue Cat ID

**Use these to**:
- Create separate ad sets for different package types
- Target users based on stay duration preferences
- A/B test different package categories

### Retargeting Strategies

1. **Product View Retargeting**
   - Target: People who viewed specific packages
   - Show: The exact package they viewed
   - Duration: 7-30 days after view

2. **Abandoned Booking Retargeting**
   - Target: People who started booking but didn't complete
   - Show: Similar packages or same package with discount
   - Duration: 1-7 days after abandonment

3. **Lookalike Audiences**
   - Create: Based on people who completed bookings
   - Target: Similar users who haven't visited yet
   - Size: 1-3% lookalike (start with 1%)

## Step 6: Link Products to Ads

### Product URLs Format

Your catalog feed generates URLs like:
```
https://www.simpleplek.co.za/posts/[post-slug]?packageId=[package-id]
```

**Make sure**:
- ✅ URLs work correctly
- ✅ Package is pre-selected when user clicks
- ✅ Booking flow is smooth
- ✅ Pixel fires on product pages

### Add UTM Parameters

Enhance tracking by adding UTM parameters:
```
https://www.simpleplek.co.za/posts/[slug]?packageId=[id]&utm_source=facebook&utm_medium=cpc&utm_campaign=[campaign-name]
```

## Testing Checklist

- [ ] Catalog feed URL is accessible
- [ ] XML feed validates correctly
- [ ] Products appear in Meta Catalog
- [ ] Product images load correctly
- [ ] Product links work
- [ ] Pixel fires on product pages
- [ ] Conversions track correctly
- [ ] Dynamic ads show correct products

## Advanced: Multiple Posts/Catalogs

If you want to advertise multiple posts:

1. **Create separate catalogs** for each post
   - Feed URL: `/api/meta-catalog?postId=[post-id]&format=xml`
   - Name: "Simpleplek - [Post Name]"

2. **Or create one catalog** with all packages
   - Modify API to accept multiple postIds
   - Combine all packages into one feed

## Troubleshooting

### Products Not Appearing in Catalog
- Check feed URL is accessible
- Verify XML format is correct
- Check Meta Business Manager → Catalogs → Data Sources for errors
- Wait 15-30 minutes for processing

### Dynamic Ads Not Showing Products
- Verify catalog is connected to ad set
- Check product availability (must be "in stock")
- Ensure products have valid images
- Check ad approval status

### Conversions Not Tracking
- Verify Pixel is installed correctly
- Check Events Manager → Test Events
- Ensure Purchase events fire on booking completion
- Verify conversion events are set up in Ads Manager

## Resources

- [Meta Catalog Setup Guide](https://www.facebook.com/business/help/120325381656392)
- [Dynamic Product Ads Guide](https://www.facebook.com/business/help/402791146561054)
- [Meta Events Manager](https://business.facebook.com/events_manager2)
- [Meta Ads Manager](https://business.facebook.com/adsmanager)

---

**Status**: ✅ Catalog Feed API created
**Next**: Set up catalog in Meta Business Manager and create your first Dynamic Product Ad campaign

