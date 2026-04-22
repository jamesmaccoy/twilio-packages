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

