# Estimate-Based Meta Ads Setup

## Overview

Your Meta ads are now automatically generated from user estimates. When users create estimates, those estimates become products in your Meta catalog and can be used for Dynamic Product Ads.

## How It Works

### 1. Estimate Tracking (Automatic)

**On Bookings Page** (`/bookings`):
- ✅ Latest estimate is automatically tracked when page loads
- ✅ Meta Pixel fires `ViewContent` event with estimate data
- ✅ This enables Dynamic Product Ads based on user's actual estimates

**On Estimate View** (`/api/estimates/latest`):
- ✅ Server-side tracking sends `EstimateView` event to Conversions API
- ✅ Client-side tracking (when estimate page loads) sends `ViewContent` event

### 2. Estimate Catalog Feed

**API Endpoint**: `/api/meta-catalog/estimates?userId=[user-id]&format=xml`

**What it does**:
- Fetches user's recent estimates (last 50)
- Converts each estimate into a Meta catalog product
- Includes: post title, duration, price, package type, images
- Links to estimate detail page

**Example Products Generated**:
```
- "The Shack - 3 Nights" (R5,400)
- "Park Estate - 7 Nights" (R10,500)
- etc.
```

## Setting Up Estimate-Based Ads

### Step 1: Create Catalog from Estimates

1. Go to **Meta Business Manager** → **Commerce** → **Catalogs**
2. Create new catalog: "Simpleplek Estimates"
3. Add Data Feed - Choose one of these methods:

#### Option A: CSV File Upload (Recommended for Google Sheets)

**CSV Export Endpoint**: `/api/estimates?format=csv&meta=true`

**Steps**:
1. **Import CSV to Google Sheets** (using IMPORTDATA formula):
   ```excel
   =IMPORTDATA("https://www.simpleplek.co.za/api/estimates?format=csv&meta=true&apiKey=YOUR_API_KEY")
   ```
   
   Or manually import:
   - Open Google Sheets
   - Go to **File** → **Import** → **Web**
   - Enter URL: `https://www.simpleplek.co.za/api/estimates?format=csv&meta=true&apiKey=YOUR_API_KEY`
   
2. **Upload CSV to Meta**:
   - In Google Sheets: **File** → **Download** → **Comma-separated values (.csv)**
   - In Meta Commerce Manager → **Data Sources** → **Add Data Source**
   - Select **Data Feed** → **Upload File**
   - Upload your CSV file
   - Meta will automatically map the product fields

**CSV URL Options**:
- **All estimates (Meta format)**: `https://www.simpleplek.co.za/api/estimates?format=csv&meta=true&apiKey=YOUR_API_KEY`
- **All estimates (Google Ads format)**: `https://www.simpleplek.co.za/api/estimates?format=csv&apiKey=YOUR_API_KEY`
- **Alternative Meta endpoint**: `https://www.simpleplek.co.za/api/meta-catalog/estimates-csv?format=csv`

**Note**: Replace `YOUR_API_KEY` with your `ESTIMATES_EXPORT_API_KEY` environment variable value

#### Option B: XML Feed URL (Scheduled Updates)

**Feed URL Options**:
- **For specific user**: `https://www.simpleplek.co.za/api/meta-catalog/estimates?userId=YOUR_USER_ID&format=xml`
- **Alternative endpoint**: `https://www.simpleplek.co.za/api/meta-catalog/feed.xml?userId=YOUR_USER_ID`

**Steps**:
1. In Meta Commerce Manager → **Data Sources** → **Add Data Source**
2. Select **Data Feed** → **Enter a URL from your server**
3. Paste your feed URL
4. Set schedule (hourly, daily, or weekly)
5. Meta will automatically fetch and update products

**Important**: Replace `YOUR_USER_ID` with an actual user ID (not the literal text `[user-id]`)

**Note**: For per-user catalogs, you'll need to create separate feeds per user. Or create one catalog with all estimates.

#### How to Find Your User ID

**Option 1: Payload Admin Panel (Recommended)**
1. Log in to your Payload CMS admin panel at: `https://www.simpleplek.co.za/admin`
2. Navigate to **Collections** → **Users**
3. Click on any user to open their details
4. The **User ID** is displayed at the top of the page (it's a string like `"67abc123def456..."`)
5. Copy this ID and use it in your feed URL

**Option 2: Browser Developer Tools**
1. Log in to your website
2. Open browser Developer Tools (F12)
3. Go to **Console** tab
4. Run: `fetch('/api/users/me').then(r => r.json()).then(d => console.log('User ID:', d.user.id))`
5. Your user ID will be displayed in the console

**Option 3: From Estimates API Response**
1. If you have an estimate, check the estimate's `customer` field - it contains the user ID
2. Or visit: `/api/estimates/latest?userId=YOUR_EMAIL` (if you know the user's email)
3. The response will include the customer ID

**Option 4: Database Query**
- If you have database access, query the `users` collection
- The `_id` or `id` field contains the user ID

#### Troubleshooting Catalog Feed Setup

**If Meta shows "URL does not link to supported file":**

1. **Test the URL first**: Open the feed URL directly in your browser
   - Should download/view an XML/CSV file
   - Should NOT redirect or show an error page
   - Example: `https://www.simpleplek.co.za/api/meta-catalog/estimates?userId=YOUR_USER_ID&format=xml`

2. **Verify format**: The URL should return valid XML (RSS 2.0) or CSV
   - XML: Check Content-Type header is `application/xml`
   - CSV: Check Content-Type header is `text/csv`
   - XML should start with `<?xml version="1.0" encoding="UTF-8"?>`

3. **Check URL accessibility**:
   - URL must be publicly accessible (no authentication required for Meta's crawler)
   - URL must use HTTPS (not HTTP)
   - No redirects or error pages

4. **Try alternative endpoint**:
   - Use `/api/meta-catalog/feed.xml?userId=YOUR_USER_ID` instead
   - Or use CSV: `/api/meta-catalog/estimates-csv?userId=YOUR_USER_ID&format=csv`

**If Meta shows "0 items" or "Not uploaded":**

1. **Validate your feed**: Use the validation endpoint
   ```
   https://www.simpleplek.co.za/api/meta-catalog/validate?userId=YOUR_USER_ID
   ```
   This will show:
   - How many estimates were found
   - How many are valid products
   - Specific issues with each product
   - Sample products from your feed

2. **Check for common issues**:
   - **Empty feed**: Ensure you have estimates with valid posts and totals
   - **Missing images**: All products must have valid image URLs
   - **Invalid URLs**: All links and image URLs must be absolute HTTPS URLs
   - **Price format**: Must be "NUMBER CURRENCY" (e.g., "5400.00 ZAR")

3. **Check server logs**: Look for validation warnings
   - Products with missing fields will be logged
   - Invalid URLs will be logged
   - Filtered products will be logged

4. **Test feed manually**:
   ```bash
   # Test CSV feed
   curl "https://www.simpleplek.co.za/api/meta-catalog/estimates-csv?userId=YOUR_USER_ID&format=csv" | head -5
   
   # Should show CSV headers and at least one product row
   ```

5. **Ensure estimates exist**:
   - Visit `/api/meta-catalog/validate?userId=YOUR_USER_ID` to see how many estimates you have
   - Estimates must have: valid post, total > 0, valid dates

**If no userId provided**: The endpoint returns an empty but valid feed
   - This allows Meta to validate the format
   - You'll need to add `?userId=YOUR_USER_ID` to get actual products

### Step 2: Create Dynamic Product Ad Campaign

1. **Go to Meta Ads Manager**
2. **Create Campaign** → **Catalog Sales**
3. **Select Catalog**: "Simpleplek Estimates"
4. **Audience**: 
   - Retarget users who viewed estimates
   - Show them the exact estimate they viewed
5. **Ad Format**: Dynamic Product Ad
6. **Meta will automatically**:
   - Show the estimate they viewed
   - Include correct price, image, description
   - Link to estimate detail page

### Step 3: Track Conversions

When users complete bookings from estimates:
- ✅ `Purchase` event is tracked (already implemented)
- ✅ Conversion value matches estimate total
- ✅ Links estimate to booking conversion

## Current Implementation

### Components Created

1. **`EstimateAds` Component** (`src/components/MetaAds/EstimateAds.tsx`)
   - Tracks estimate views on bookings page
   - Fires `ViewContent` events for Meta Pixel
   - Enables Dynamic Product Ads

2. **Estimate Catalog API** (`src/app/api/meta-catalog/estimates/route.ts`)
   - Generates XML/JSON feed from user estimates
   - Formats data for Meta catalog
   - Includes all estimate details

### Integration Points

- ✅ **Bookings Page**: Automatically tracks latest estimate
- ✅ **Estimate API**: Tracks estimate views server-side
- ✅ **Booking Conversion**: Tracks purchases when bookings complete

## Testing

### 1. Test Estimate Tracking

1. Create an estimate
2. Visit `/bookings` page
3. Open browser console
4. Should see: `Meta Pixel ViewContent tracked for estimate`
5. Check Meta Events Manager → Test Events tab
6. Should see `ViewContent` event

### 2. Test Catalog Feed

**Test CSV Feed (for Google Sheets & Meta)**:
Visit: `https://www.simpleplek.co.za/api/meta-catalog/estimates-csv?format=csv`

Should download a CSV file with headers:
```
id,title,description,availability,condition,price,currency,link,image_link,brand,product_type,custom_label_0,custom_label_1,custom_label_2,custom_label_3
estimate-123,Property Name - 3 Nights,Description,in stock,new,5400.00,ZAR,https://...,...
```

**Import to Google Sheets**:
1. Open Google Sheets
2. Go to **File** → **Import** → **Web**
3. Paste URL: `https://www.simpleplek.co.za/api/meta-catalog/estimates-csv?format=csv`
4. Click **Import**
5. Your estimates will appear as products ready for Meta Commerce Manager

**Test XML Feed (for Meta)**:
Visit: `https://www.simpleplek.co.za/api/meta-catalog/estimates?userId=YOUR_USER_ID&format=xml`

Should return valid XML starting with:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Simpleplek Estimates Catalog</title>
    ...
```

**Test JSON Feed (for debugging)**:
Visit: `https://www.simpleplek.co.za/api/meta-catalog/estimates?userId=YOUR_USER_ID&format=json`

Should return:
```json
{
  "products": [
    {
      "id": "estimate-[id]",
      "title": "[Post Title] - [Duration] Nights",
      "price": "[Total] ZAR",
      "link": "https://www.simpleplek.co.za/estimate/[id]",
      ...
    }
  ],
  "total": 1
}
```

### 3. Verify in Meta

1. Go to **Meta Events Manager** → **Test Events**
2. Visit bookings page
3. Should see `ViewContent` event appear
4. Event should include estimate data (value, content_ids, etc.)

## Advanced: Per-User Catalogs

For personalized ads per user:

1. **Create separate catalog per user** (if needed)
2. **Or use one catalog** with all estimates and filter by custom labels
3. **Use custom_label_3** (estimate ID) to target specific estimates

## Benefits

✅ **Personalized Ads**: Users see ads for estimates they've actually created  
✅ **Accurate Pricing**: Ads show exact estimate totals  
✅ **Better Conversion**: Users see what they've already shown interest in  
✅ **Automatic**: No manual catalog updates needed  
✅ **Real-time**: Estimates become ads immediately  

## Next Steps

1. ✅ Estimate tracking implemented on bookings page
2. ✅ Catalog feed API created
3. ⏳ Set up catalog in Meta Business Manager
4. ⏳ Create Dynamic Product Ad campaign
5. ⏳ Test and optimize

---

**Status**: ✅ Estimate-based ads tracking implemented
**Next**: Set up catalog in Meta and create your first estimate-based ad campaign

