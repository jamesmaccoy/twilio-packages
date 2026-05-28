# Package Creation Testing Guide

## Server Status
✅ Development server is running at `http://localhost:3000`

## Recent Fixes

### Production Redirect URLs Fixed
✅ **Fixed**: Subscription payment redirects now use production URL (`https://www.simpleplek.co.za`) instead of localhost in production environment.

**Changes Made**:
- Updated `src/lib/yocoService.ts` to detect production environment and use production URL
- Updated `src/app/(frontend)/booking-confirmation/page.tsx` to preserve redirect parameters
- Updated `src/collections/AuthRequests/endpoints/verify-magic-token.ts` to use correct base URL

**How It Works**:
- In **production**: Uses `NEXT_PUBLIC_URL` or defaults to `https://www.simpleplek.co.za`
- In **development**: Uses `NEXT_PUBLIC_URL` or defaults to `http://localhost:3000`

**Environment Variable Required**:
```bash
NEXT_PUBLIC_URL=https://www.simpleplek.co.za  # Production URL
```

## Test Flow: Create Package and Assign to Post

### Prerequisites
1. **Authentication**: You must be logged in as a user with `host` or `admin` role
2. **Post Available**: Post ID `692d80fd22ec2d684a81b164` ("Samphire") is available for testing

### Testing Steps

#### Option 1: Using PackageOnboarding Component

1. **Navigate to Package Creation Page**
   - Go to: `http://localhost:3000/manage/packages/[postId]`
   - Replace `[postId]` with: `692d80fd22ec2d684a81b164`

2. **Step 1: Describe Package**
   - Enter package name (optional): e.g., "Weekend Getaway"
   - Enter description: e.g., "A relaxing weekend package for couples"
   - Click "Next"

3. **Step 2: Review Package Preview**
   - AI will generate package details using `previewPackageTool`
   - Review the preview card showing:
     - Name, description, category
     - Min/max nights
     - Base rate
     - Features
     - Entitlement level

4. **Step 3: Confirm and Create**
   - Click "Create Package" button
   - AI will call `createPackageTool` with the preview data
   - Package will be created and assigned to the post

5. **Step 4: Verify Success**
   - Success message should appear
   - Package should appear in the package list
   - Check API: `GET /api/packages?where[post][equals]=692d80fd22ec2d684a81b164`

#### Option 2: Using PageAIAssistant (Manage Page)

1. **Navigate to Manage Page**
   - Go to: `http://localhost:3000/manage`
   - Ensure you're logged in as host/admin

2. **Use AI Assistant**
   - Type: "Create a new package for my property"
   - Or: "Create a weekend getaway package for R300"
   - AI will automatically call `previewPackageTool`

3. **Review Preview**
   - Package preview card appears
   - Shows all generated details

4. **Confirm Creation**
   - Click "Create Package" on preview card
   - Or say: "Yes, create it" or "Confirm"
   - AI will call `createPackageTool`

5. **Verify**
   - Success message with management links appears
   - Package list refreshes automatically
   - Package is assigned to selected post

### Expected API Flow

#### 1. Preview Request (via `/api/chat/manage`)
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Create a weekend getaway package"
    }
  ],
  "pageData": {
    "posts": [{"id": "692d80fd22ec2d684a81b164"}],
    "postId": "692d80fd22ec2d684a81b164"
  }
}
```

#### 2. AI Calls `previewPackageTool`
- Tool returns preview data with all fields filled
- Frontend displays `PackagePreview` component

#### 3. Create Request (when user confirms)
```json
{
  "messages": [
    {
      "role": "user", 
      "content": "Create this package now using createPackageTool..."
    }
  ],
  "pageData": {
    "posts": [{"id": "692d80fd22ec2d684a81b164"}],
    "postId": "692d80fd22ec2d684a81b164"
  }
}
```

#### 4. AI Calls `createPackageTool`
- Package created in database
- Assigned to post via `post` field
- Returns success with package ID

### Verification Endpoints

1. **Check Package Created**
   ```bash
   curl 'http://localhost:3000/api/packages?where[post][equals]=692d80fd22ec2d684a81b164'
   ```

2. **View Package Details**
   ```bash
   curl 'http://localhost:3000/api/packages/[packageId]?depth=2'
   ```

3. **Check Post Packages**
   ```bash
   curl 'http://localhost:3000/api/packages/post/692d80fd22ec2d684a81b164'
   ```

### Success Indicators

✅ **Package Created Successfully**
- Success message appears: "Package Created Successfully!"
- Package ID is displayed
- Management links are available:
  - View Package API
  - Manage Packages
  - Create Another

✅ **Package Assigned to Post**
- Package appears in post's package list
- `post` field matches post ID
- Package is enabled by default

✅ **Package Preview Works**
- Preview card shows all details
- Category emoji displays correctly
- Features list is populated
- Base rate is formatted correctly

### Troubleshooting

**Issue**: "Generating package details..." but nothing happens
- **Fix**: Check browser console for errors
- Verify `/api/chat/manage` endpoint is accessible
- Check authentication (must be host/admin)

**Issue**: Package preview doesn't appear
- **Fix**: Check `onFinish` callback in `useChat` hook
- Verify `previewPackageTool` is being called
- Check tool output structure matches expected format

**Issue**: Package not assigned to post
- **Fix**: Verify `postId` is passed correctly in `pageData`
- Check `createPackageTool` receives correct `postId`
- Verify post exists: `GET /api/posts/692d80fd22ec2d684a81b164`

**Issue**: Success message doesn't appear
- **Fix**: Check `onFinish` callback detects `createPackageTool` output
- Verify `packageId` is extracted correctly
- Check `createdPackageId` state is set

### Test Cases

1. **Basic Package Creation**
   - Description: "Weekend getaway"
   - Expected: Standard category, 2-7 nights, R200 base rate

2. **Special Package**
   - Description: "Special promotional package"
   - Expected: Special category, 1-7 nights, R350 base rate

3. **Addon Package**
   - Description: "Cleaning service"
   - Expected: Addon category, 1 night, R300 base rate

4. **Hosted Package**
   - Description: "Luxury hosted experience"
   - Expected: Hosted category, 3-14 nights, R450 base rate

5. **Custom Details**
   - Name: "Custom Package Name"
   - Description: "Custom description"
   - Expected: Uses provided name and description

6. **Entitlement + Add-on Visibility (SmartEstimateBlock)**

**Goal**: Ensure the build only presents packages that match the viewer’s entitlement and that add-ons are suggested/visible for **standard** entitlement (but not **pro** add-ons). Also ensure **no-subscription** users only see `none` entitlement packages (and similarly only `none` entitlement add-ons).

#### Setup
- Pick a post with packages and add-ons. You’ll need its `postId` (example: `692d80fd22ec2d684a81b164`).
- Ensure there exist packages with these entitlements:
  - At least **one** package with `entitlement: ['none']` (public / non-member)
  - At least **one** package with `entitlement: ['standard']`
  - At least **one** package with `entitlement: ['pro']`
  - At least **one** add-on package (category includes `addon`) with `entitlement: ['standard']`
  - At least **one** add-on package (category includes `addon`) with `entitlement: ['pro']` (this must never show to standard)

> Note: In this repo, `packages.category` and `packages.entitlement` are `hasMany` arrays in Payload, so the API/UI must treat them as arrays.

#### Test users
- **User A (no subscription)**: `subscriptionStatus.status !== 'active'` OR expired
- **User B (standard/basic)**: `subscriptionStatus.status = 'active'`, `subscriptionStatus.plan = 'basic'` (treated as standard)
- **User C (pro)**: `subscriptionStatus.status = 'active'`, `subscriptionStatus.plan = 'pro'`

#### Verify API behavior (per user)
1) **Packages shown on a post**:
- Request: `GET /api/packages/post/<postId>`
- Expectations:
  - **User A**: only packages where entitlement includes `none`
  - **User B**: only packages where entitlement includes `standard`
  - **User C**: packages where entitlement includes `standard` OR `pro`
  - **All users**: packages with category including `addon` must NOT be returned here

2) **Add-ons for a post**:
- Request: `GET /api/packages/addons/<postId>`
- Expectations:
  - **User A**: only add-ons where entitlement includes `none`
  - **User B**: only add-ons where entitlement includes `none` OR `standard` (and NEVER `pro`)
  - **User C**: add-ons where entitlement includes `none` OR `standard` OR `pro`
  - **All users**: every item returned must have category including `addon`

#### Verify UI behavior (SmartEstimateBlock + subscribe gate)
Open the post page:
- `GET /posts/<slug>` (or navigate in browser)

> **Important**: `entitlement` and `category` are **arrays** in Payload (`hasMany: true`).  
> A package with `entitlement: ['none']` is public bookable — not the string `"none"` alone in all code paths.

##### When at least one non-addon package has `entitlement` including `none` (public bookable)

Example: **The Shack** (`/posts/the-shack`)

| Field | Example value |
|-------|----------------|
| Post slug | `the-shack` |
| Post ID | `69e9d58f7647fb5dd596540b` |
| Package ID | `69fc74ef099ac8a9850a2e71` |
| Package API | `GET /api/packages/69fc74ef099ac8a9850a2e71?depth=2` (admin/host auth) |
| Post packages API | `GET /api/packages/post/69e9d58f7647fb5dd596540b` |

**User A (no subscription) — expected on `/posts/the-shack`:**

| UI element | Expected |
|------------|----------|
| **Subscribe gate** (`PostContentPreview`) | **Hidden** — do not show “This plek is for members only” |
| **SmartEstimateBlock** | **Visible** — AI Booking Assistant loads after subscription check |
| **Packages in assistant** | Only packages whose `entitlement` array includes `none` (e.g. “🔥 Shack's Coastal Escape”) |
| **Add-on suggestions** | Only add-ons whose `entitlement` includes `none` |

**API check (logged out / User A):**

```bash
curl -s "http://localhost:3000/api/packages/post/69e9d58f7647fb5dd596540b" | jq '.access, .packages[].entitlement'
```

Expected:

```json
{
  "guestBookable": true,
  "minEntitlement": "none",
  "primaryCategory": "standard"
}
```

Packages array should include the shack package with `"entitlement": ["none"]`.

**SSR index:** the post page passes `guestBookable={true}` from `getPostPackageAccessIndex()` so the UI does not flash gate → assistant → gate.

##### When no package has `entitlement` including `none` (members only)

**User A (no subscription):**

| UI element | Expected |
|------------|----------|
| **Subscribe gate** | **Shown** (if the post has editorial preview content) |
| **SmartEstimateBlock** | **Hidden** — no empty assistant |

**User B (standard/basic):**
- SmartEstimateBlock visible; packages where `entitlement` includes `standard` (not `none`-only packages unless also tagged `standard`).
- Add-on suggestions: `none` or `standard`, never `pro`-only add-ons.

**User C (pro):**
- SmartEstimateBlock visible; packages where `entitlement` includes `standard` or `pro`.
- Add-on suggestions: any add-on tier the user qualifies for.

### Manual Testing Checklist

- [ ] Server is running (`http://localhost:3000`)
- [ ] Logged in as host/admin user
- [ ] Navigate to manage page
- [ ] Type package creation request
- [ ] Preview appears with all details
- [ ] Click "Create Package"
- [ ] Success message appears
- [ ] Package appears in list
- [ ] Package is assigned to correct post
- [ ] Can view package via API
- [ ] Can manage package via management page

